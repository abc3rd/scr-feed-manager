import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Returns the products with the most units ordered in the last 7 days.
// Uses the service role so anonymous shop visitors (no order read access)
// still see store-wide popularity. Only non-sensitive product ids + quantities
// are returned; no customer or order data leaves the server.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const orders = await base44.asServiceRole.entities.Order.list('-created_date', 200);
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const counts = new Map();
    for (const o of orders) {
      if (!o.created_date) continue;
      // Sorted desc by created_date — once we pass the 7-day cutoff, stop.
      if (new Date(o.created_date).getTime() < since) break;
      if (o.status === 'cancelled') continue;
      for (const item of (o.items || [])) {
        if (!item.product_id) continue;
        counts.set(item.product_id, (counts.get(item.product_id) || 0) + (item.quantity || 0));
      }
    }
    const trending = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([product_id, quantity]) => ({ product_id, quantity }));
    return Response.json({ trending });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}