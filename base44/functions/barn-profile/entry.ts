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

    // Loyalty and order history are private to the member. Reveal them only
    // when the caller is signed in as THIS barn's member — not to anyone who
    // merely holds or photographs the physical QR sticker.
    let me = null;
    try { me = await base44.auth.me(); } catch { /* no session */ }
    const authenticated = !!(me && me.id === member.id);

    // Aggregate this member's most-ordered items from their past orders — this
    // is purchase history, so it is computed only for the authenticated member.
    const mostOrderedAgg = {};
    if (authenticated) {
      const memberOrders = await base44.asServiceRole.entities.Order.filter(
        { user_id: member.id },
        '-created_date',
        200
      );
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
    }
    const mostOrderedIds = Object.values(mostOrderedAgg)
      .sort((a, b) => b.units - a.units)
      .slice(0, 8)
      .map((e) => e.product_id);

    // Products synced from Shopify keep selling at zero stock (the yard count
    // at pick time is the check), so only tracked products are limited.
    const availableQty = (p) =>
      p.track_stock === false
        ? 999
        : Number(p.stock_quantity || 0) - Number(p.reserved_quantity || 0);
    const available = (p) => availableQty(p) > 0;

    // The catalog is the whole Shopify store, so fetch only what this page shows.
    const hay = (await base44.asServiceRole.entities.Product.filter(
      { is_active: true, category: 'hay' },
      'name',
      60
    )).filter(available).slice(0, 24);

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

    // Old orders can hold product ids that are not record ids; skip those.
    const wantedIds = [...new Set([...(authenticated ? mostOrderedIds : []), ...popularIds])]
      .filter((id) => /^[a-f0-9]{24}$/i.test(String(id)));
    const ordered = wantedIds.length
      ? await base44.asServiceRole.entities.Product.filter(
          { id: { $in: wantedIds }, is_active: true },
          'name',
          wantedIds.length
        )
      : [];
    const productById = new Map([...ordered, ...hay].map((p) => [p.id, p]));

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
        available: availableQty(p),
        tracks_stock: p.track_stock !== false,
        tags: tag,
      });
    };
    if (authenticated) {
      for (const id of mostOrderedIds) {
        addProduct(productById.get(id), 'most-ordered');
      }
    }
    for (const p of hay) addProduct(p, 'hay');
    for (const id of popularIds) {
      addProduct(productById.get(id), 'popular');
    }

    return Response.json({
      authenticated,
      member: authenticated
        ? {
            full_name: member.full_name,
            membership: member.membership === 'paid' ? 'paid' : 'free',
          }
        : null,
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