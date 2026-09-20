import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.3.1';
import { secrets } from 'base44:runtime';

// Server-side loyalty tier discounts — must mirror src/lib/loyalty.js.
// Pricing is never trusted from the client; this is the authoritative source.
const TIER_DISCOUNTS = {
  bronze: 0,
  silver: 0.05,
  gold: 0.10,
  platinum: 0.15,
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { items, points_redeemed, notes, success_url, cancel_url } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // Resolve the authenticated user. Guest checkout is allowed, but the user
    // id and loyalty discount are ALWAYS derived from the verified session —
    // never from client-supplied user_id / tier_applied / discount_amount.
    let user = null;
    try {
      user = await base44.auth.me();
    } catch {
      // No authenticated session — guest checkout, no discount.
    }
    const userId = user ? user.id : null;

    // Fetch every product server-side and build a price map. Unit prices come
    // from the database, not the request body.
    const productMap = new Map();
    for (const i of items) {
      if (!i.product_id) {
        return Response.json({ error: 'Cart item missing product_id' }, { status: 400 });
      }
      if (productMap.has(i.product_id)) continue;
      const product = await base44.asServiceRole.entities.Product.get(i.product_id);
      if (!product) {
        return Response.json({ error: `Product not found: ${i.product_id}` }, { status: 400 });
      }
      if (product.is_active === false) {
        return Response.json({ error: `Product no longer available: ${product.name}` }, { status: 400 });
      }
      productMap.set(i.product_id, product);
    }

    // Build verified line items: quantity from client, price from DB.
    const verifiedItems = [];
    for (const i of items) {
      const product = productMap.get(i.product_id);
      const quantity = Math.floor(Number(i.quantity) || 0);
      if (quantity <= 0) {
        return Response.json({ error: `Invalid quantity for ${product.name}` }, { status: 400 });
      }
      const unitPrice = Number(product.price);
      const lineTotal = +(unitPrice * quantity).toFixed(2);
      verifiedItems.push({
        product_id: i.product_id,
        name: product.name,
        unit_of_measure: product.unit_of_measure,
        quantity,
        unit_price: unitPrice,
        line_total: lineTotal
      });
    }

    // Compute totals entirely server-side.
    const subtotal = +verifiedItems.reduce((sum, i) => sum + i.line_total, 0).toFixed(2);

    // Discount is derived from the verified user's loyalty tier only.
    let discount = 0;
    let tierApplied = null;
    if (user) {
      const tier = user.loyalty_tier || 'bronze';
      const rate = TIER_DISCOUNTS[tier] || 0;
      if (rate > 0) {
        discount = +(subtotal * rate).toFixed(2);
        tierApplied = tier;
      }
    }
    discount = Math.min(discount, subtotal);
    const total = +Math.max(0, subtotal - discount).toFixed(2);

    // Create the Order — status pending, NO inventory deduction (two-step fulfillment)
    const order = await base44.asServiceRole.entities.Order.create({
      user_id: userId,
      status: 'pending',
      payment_status: 'unpaid',
      items: verifiedItems,
      subtotal,
      discount_amount: discount,
      total,
      tier_applied: tierApplied,
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
      user_id: userId,
      status: 'open',
      pick_items: verifiedItems.map(i => ({
        product_id: i.product_id,
        name: i.name,
        unit_of_measure: i.unit_of_measure,
        requested_quantity: i.quantity,
        verified_quantity: 0,
        line_status: 'pending'
      }))
    });

    // Soft-reserve stock — does NOT deduct; true deduction happens at pick verification
    for (const i of verifiedItems) {
      const product = productMap.get(i.product_id);
      await base44.asServiceRole.entities.Product.update(i.product_id, {
        reserved_quantity: Number(product.reserved_quantity || 0) + i.quantity
      });
    }

    // Build Stripe checkout session with server-verified unit prices
    const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));
    const origin = new URL(req.url).origin;

    const lineItems = verifiedItems.map(i => ({
      price_data: {
        currency: 'usd',
        product_data: { name: `${i.name} (${i.unit_of_measure})` },
        unit_amount: Math.round(i.unit_price * 100)
      },
      quantity: i.quantity
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
        user_id: userId || ''
      }
    };

    // Apply loyalty discount as a one-time coupon (server-computed amount)
    if (discount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: Math.round(discount * 100),
        currency: 'usd',
        duration: 'once',
        name: `${tierApplied || 'Loyalty'} discount`
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