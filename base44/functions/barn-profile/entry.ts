import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Resolves a member by their barn QR token and returns a personalized
// quick-order payload: most-ordered items, available hay, promoted/popular
// items, and active promo announcements. No other member's data is exposed.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    let token = new URL(req.url).searchParams.get('token');
    if (!token) {
      try {
        const body = await req.json();
        token = body?.token;
      } catch { /* no body */ }
    }
    if (!token) {
      return Response.json({ error: 'Missing barn token' }, { status: 400 });
    }

    // Resolve the member by their barn QR token (service role).
    const users = await base44.asServiceRole.entities.User.filter(
      { barn_qr_id: token },
      '-created_date',
      1
    );
    const member = users && users[0];
    if (!member) {
      return Response.json({ error: 'Invalid or unassigned barn code' }, { status: 404 });
    }

    // Aggregate this member's most-ordered items from their past orders.
    const memberOrders = await base44.asServiceRole.entities.Order.filter(
      { user_id: member.id },
      '-created_date',
      200
    );
    const mostOrderedAgg = {};
    for (const o of memberOrders) {
      for (const it of (o.items || [])) {
        if (!it.product_id) continue;
        const entry = (mostOrderedAgg[it.product_id] ||= {
          product_id: it.product_id,
          name: it.name,
          unit_of_measure: it.unit_of_measure,
          units: 0,
          last_price: it.unit_price,
        });
        entry.units += Number(it.quantity || 0);
        entry.last_price = it.unit_price;
      }
    }
    const mostOrderedIds = Object.values(mostOrderedAgg)
      .sort((a, b) => b.units - a.units)
      .slice(0, 8)
      .map((e) => e.product_id);

    // Fetch all active products once; build a lookup map.
    const allProducts = await base44.asServiceRole.entities.Product.filter(
      { is_active: true },
      '-created_date',
      200
    );
    const productById = new Map(allProducts.map((p) => [p.id, p]));
    const available = (p) =>
      Number(p.stock_quantity || 0) - Number(p.reserved_quantity || 0) > 0;

    const hay = allProducts
      .filter((p) => p.category === 'hay' && available(p))
      .slice(0, 12);

    // Popular items across all orders (top sellers).
    const allOrders = await base44.asServiceRole.entities.Order.list('-created_date', 500);
    const popularAgg = {};
    for (const o of allOrders) {
      for (const it of (o.items || [])) {
        if (!it.product_id) continue;
        (popularAgg[it.product_id] ||= { product_id: it.product_id, units: 0 }).units +=
          Number(it.quantity || 0);
      }
    }
    const popularIds = Object.values(popularAgg)
      .sort((a, b) => b.units - a.units)
      .slice(0, 8)
      .map((e) => e.product_id);

    // Active promo announcements.
    const promos = await base44.asServiceRole.entities.Announcement.filter(
      { is_active: true, type: 'promo' },
      '-created_date',
      5
    );

    // Merge into a single deduped form item list, ordered: most-ordered, hay, popular.
    const seen = new Set();
    const formItems = [];
    const addProduct = (p, tag) => {
      if (!p || seen.has(p.id)) return;
      seen.add(p.id);
      formItems.push({
        product_id: p.id,
        name: p.name,
        category: p.category,
        unit_of_measure: p.unit_of_measure,
        price: Number(p.price),
        available: Number(p.stock_quantity || 0) - Number(p.reserved_quantity || 0),
        tags: tag,
      });
    };
    for (const id of mostOrderedIds) {
      addProduct(productById.get(id), 'most-ordered');
    }
    for (const p of hay) addProduct(p, 'hay');
    for (const id of popularIds) {
      addProduct(productById.get(id), 'popular');
    }

    return Response.json({
      member: {
        id: member.id,
        full_name: member.full_name,
        email: member.email,
        loyalty_tier: member.loyalty_tier || 'bronze',
        loyalty_points: member.loyalty_points || 0,
      },
      items: formItems,
      promos: promos.map((a) => ({
        title: a.title,
        message: a.message,
        description: a.description,
      })),
    });
  } catch (error) {
    console.error('barn-profile error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}