import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.3.1';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { items, user_id, discount_amount, tier_applied, points_redeemed, notes, success_url, cancel_url } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // Compute totals
    const subtotal = items.reduce((sum, i) => sum + Number(i.line_total || 0), 0);
    const discount = Math.min(Number(discount_amount || 0), subtotal);
    const total = Math.max(0, subtotal - discount);

    // Create the Order — status pending, NO inventory deduction (two-step fulfillment)
    const order = await base44.asServiceRole.entities.Order.create({
      user_id: user_id || null,
      status: 'pending',
      payment_status: 'unpaid',
      items: items.map(i => ({
        product_id: i.product_id,
        name: i.name,
        unit_of_measure: i.unit_of_measure,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
        line_total: Number(i.line_total)
      })),
      subtotal,
      discount_amount: discount,
      total,
      tier_applied: tier_applied || null,
      points_redeemed: Number(points_redeemed || 0),
      notes: notes || null
    });

    const orderNumber = 'ORD-' + order.id.slice(-8).toUpperCase();
    await base44.asServiceRole.entities.Order.update(order.id, { order_number: orderNumber });

    // Generate the internal Pick Ticket — open, awaiting yard worker verification
    const ticketNumber = 'PT-' + order.id.slice(-8).toUpperCase();
    await base44.asServiceRole.entities.PickTicket.create({
      ticket_number: ticketNumber,
      order_id: order.id,
      user_id: user_id || null,
      status: 'open',
      pick_items: items.map(i => ({
        product_id: i.product_id,
        name: i.name,
        unit_of_measure: i.unit_of_measure,
        requested_quantity: Number(i.quantity),
        verified_quantity: 0,
        line_status: 'pending'
      }))
    });

    // Soft-reserve stock — does NOT deduct; true deduction happens at pick verification
    for (const i of items) {
      const product = await base44.asServiceRole.entities.Product.get(i.product_id);
      if (product) {
        await base44.asServiceRole.entities.Product.update(i.product_id, {
          reserved_quantity: Number(product.reserved_quantity || 0) + Number(i.quantity)
        });
      }
    }

    // Build Stripe checkout session
    const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));
    const origin = new URL(req.url).origin;

    const lineItems = items.map(i => ({
      price_data: {
        currency: 'usd',
        product_data: { name: `${i.name} (${i.unit_of_measure})` },
        unit_amount: Math.round(Number(i.unit_price) * 100)
      },
      quantity: Number(i.quantity)
    }));

    const sessionParams = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: success_url || `${origin}/order-success?order_id=${order.id}`,
      cancel_url: cancel_url || `${origin}/cart`,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        order_id: order.id,
        order_number: orderNumber,
        user_id: user_id || ''
      }
    };

    // Apply loyalty discount as a one-time coupon
    if (discount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: Math.round(discount * 100),
        currency: 'usd',
        duration: 'once',
        name: `${tier_applied || 'Loyalty'} discount`
      });
      sessionParams.discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Store the Stripe session id on the order
    await base44.asServiceRole.entities.Order.update(order.id, { stripe_session_id: session.id });

    return Response.json({ url: session.url, order_id: order.id, order_number: orderNumber });
  } catch (error) {
    console.error('create-checkout-session error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}