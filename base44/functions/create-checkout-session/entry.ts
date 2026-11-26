import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Pricing is never trusted from the client; prices come from the database,
// which the Shopify catalog sync keeps equal to scrfeed.com.
// Stars never reduce the price of a sale (ADR 0001, syncloudconnect-main).
//
// Payment happens in the SCR Online Shopify checkout: the order and its Pick
// Ticket are created here (two-step fulfillment), then the customer is sent to
// a Shopify cart permalink holding the same variants and quantities. The
// Shopify order carries this order's number as the "SCR order" attribute.

const STORE_URL = Deno.env.get('SHOPIFY_STORE_URL') || 'https://scrfeed.com';
const MAX_LINE_QTY = 999;
const MAX_ORDER_LINES = 100;

const availableFor = (product: any) =>
  product.track_stock === false
    ? MAX_LINE_QTY
    : Number(product.stock_quantity || 0) - Number(product.reserved_quantity || 0);

export function shopifyCartUrl({ lines, orderNumber, fulfillment, email }: {
  lines: { variantId: string; quantity: number }[];
  orderNumber: string;
  fulfillment: string;
  email?: string | null;
}) {
  const merged = new Map<string, number>();
  for (const l of lines) merged.set(l.variantId, (merged.get(l.variantId) || 0) + l.quantity);
  const path = [...merged.entries()].map(([v, q]) => `${v}:${q}`).join(',');
  const params = new URLSearchParams();
  params.set('attributes[SCR order]', orderNumber);
  params.set('attributes[Fulfillment]', fulfillment);
  params.set('note', `SCR Feed app order ${orderNumber} (${fulfillment})`);
  if (email) params.set('checkout[email]', email);
  params.set('ref', 'scr-feed-app');
  return `${STORE_URL}/cart/${path}?${params.toString()}`;
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { items, points_redeemed, notes, barn_qr_id, fulfillment_type, delivery_address } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json({ error: 'Cart is empty' }, { status: 400 });
    }
    if (items.length > MAX_ORDER_LINES) {
      return Response.json({ error: 'Too many items in cart' }, { status: 400 });
    }

    // Resolve the authenticated user. Guest checkout is allowed, but the user
    // id is ALWAYS derived from the verified session, never from the request.
    let user: any = null;
    try {
      user = await base44.auth.me();
    } catch {
      // No authenticated session — may still be a barn-profile order below.
    }
    // Barn Profile quick-order: a barn QR token identifies a member, but the
    // token alone (a physical sticker anyone near the barn can scan or
    // photograph) is not enough to act on the member's account. Require an
    // authenticated session that matches the barn's member before attributing
    // the order to them.
    if (barn_qr_id) {
      const members = await base44.asServiceRole.entities.User.filter({ barn_qr_id }, '-created_date', 1);
      const barnMember = members && members[0] ? members[0] : null;
      if (!barnMember) {
        return Response.json({ error: 'Invalid or unassigned barn code' }, { status: 404 });
      }
      if (!user || user.id !== barnMember.id) {
        return Response.json(
          { error: 'Sign in to your Stars Club account to order from your barn profile.', requires_auth: true },
          { status: 401 }
        );
      }
      user = barnMember;
    }
    const userId = user ? user.id : null;

    // Fetch every product server-side and build a price map.
    const productMap = new Map<string, any>();
    for (const i of items) {
      if (!i.product_id) {
        return Response.json({ error: 'Cart item missing product_id' }, { status: 400 });
      }
      if (productMap.has(i.product_id)) continue;
      let product = null;
      try { product = await base44.asServiceRole.entities.Product.get(i.product_id); } catch { /* not found */ }
      if (!product) {
        return Response.json({ error: `Product not found: ${i.product_id}` }, { status: 400 });
      }
      if (product.is_active === false) {
        return Response.json({ error: `Product no longer available: ${product.name}` }, { status: 400 });
      }
      productMap.set(i.product_id, product);
    }

    // A product without a real price must never sell at $0.
    const needsPrice = [...productMap.values()].filter((p) => !(Number(p.price) > 0)).map((p) => p.id);
    if (needsPrice.length > 0) {
      const names = needsPrice.map((id) => productMap.get(id).name).join(', ');
      return Response.json(
        { error: `Needs a price before it can be sold: ${names}. Please ask SCR staff.`, needs_price: needsPrice },
        { status: 400 }
      );
    }

    // Only products that exist in the Shopify store can be checked out there.
    const notOnline = [...productMap.values()].filter((p) => !p.shopify_variant_id);
    if (notOnline.length > 0) {
      return Response.json(
        { error: `Not available for online checkout yet: ${notOnline.map((p) => p.name).join(', ')}. Please ask SCR staff.`, not_online: notOnline.map((p) => p.id) },
        { status: 400 }
      );
    }

    // Verified line items: quantity from client, price from DB, bounded by
    // available stock for products whose stock the app tracks.
    const consumed = new Map<string, number>();
    const verifiedItems = [];
    for (const i of items) {
      const product = productMap.get(i.product_id);
      const quantity = Math.floor(Number(i.quantity) || 0);
      if (quantity <= 0) {
        return Response.json({ error: `Invalid quantity for ${product.name}` }, { status: 400 });
      }
      if (quantity > MAX_LINE_QTY) {
        return Response.json({ error: `Quantity too large for ${product.name} (max ${MAX_LINE_QTY})` }, { status: 400 });
      }
      const soFar = consumed.get(i.product_id) || 0;
      const available = availableFor(product) - soFar;
      if (quantity > available) {
        return Response.json({ error: `Only ${Math.max(0, available)} ${product.unit_of_measure} of ${product.name} available` }, { status: 400 });
      }
      consumed.set(i.product_id, soFar + quantity);
      const unitPrice = Number(product.price);
      verifiedItems.push({
        product_id: i.product_id,
        name: product.name,
        unit_of_measure: product.unit_of_measure,
        quantity,
        unit_price: unitPrice,
        line_total: +(unitPrice * quantity).toFixed(2),
        shopify_variant_id: String(product.shopify_variant_id),
      });
    }

    const subtotal = +verifiedItems.reduce((sum, i) => sum + i.line_total, 0).toFixed(2);
    // Members pay full price: Stars are earned, never spent as a discount.
    const total = subtotal;
    const fulfillment = fulfillment_type === 'delivery' ? 'delivery' : 'pickup';

    // Create the Order — status pending, NO inventory deduction (two-step fulfillment)
    const order = await base44.asServiceRole.entities.Order.create({
      user_id: userId,
      status: 'pending',
      payment_status: 'unpaid',
      fulfillment_type: fulfillment,
      delivery_address: fulfillment === 'delivery' ? (delivery_address || null) : null,
      items: verifiedItems,
      subtotal,
      discount_amount: 0,
      total,
      tier_applied: null,
      points_redeemed: Number(points_redeemed || 0),
      notes: notes || null,
      checkout_channel: 'shopify',
    });

    const orderNumber = 'ORD-' + order.id.slice(-8).toUpperCase();

    // Generate the internal Pick Ticket — open, awaiting yard worker verification
    const ticketNumber = 'PT-' + order.id.slice(-8).toUpperCase();
    await base44.asServiceRole.entities.PickTicket.create({
      ticket_number: ticketNumber,
      order_id: order.id,
      user_id: userId,
      status: 'open',
      pick_items: verifiedItems.map((i) => ({
        product_id: i.product_id,
        name: i.name,
        unit_of_measure: i.unit_of_measure,
        requested_quantity: i.quantity,
        verified_quantity: 0,
        line_status: 'pending',
      })),
    });

    // Soft-reserve tracked stock — does NOT deduct; deduction happens at pick verification
    for (const i of verifiedItems) {
      const product = productMap.get(i.product_id);
      if (product.track_stock === false) continue;
      await base44.asServiceRole.entities.Product.update(i.product_id, {
        reserved_quantity: Number(product.reserved_quantity || 0) + i.quantity,
      });
    }

    const url = shopifyCartUrl({
      lines: verifiedItems.map((i) => ({ variantId: i.shopify_variant_id, quantity: i.quantity })),
      orderNumber,
      fulfillment: fulfillment === 'delivery' ? `Delivery to ${delivery_address || 'address on file'}` : 'Pickup at the yard',
      email: user?.email || null,
    });

    await base44.asServiceRole.entities.Order.update(order.id, { order_number: orderNumber, checkout_url: url });

    return Response.json({ url, order_id: order.id, order_number: orderNumber });
  } catch (error) {
    console.error('create-checkout-session error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
