import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Tier thresholds based on lifetime points
const TIER_THRESHOLDS = [
  { tier: 'platinum', min: 2000 },
  { tier: 'gold', min: 1000 },
  { tier: 'silver', min: 500 },
  { tier: 'bronze', min: 0 }
];

function tierFor(lifetimePoints) {
  return TIER_THRESHOLDS.find(t => lifetimePoints >= t.min).tier;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'staff') {
      return Response.json({ error: 'Only staff can complete pick tickets' }, { status: 403 });
    }

    const body = await req.json();
    const { ticket_id, verified_items, notes } = body;
    // verified_items: [{ product_id, verified_quantity, line_status }]

    if (!ticket_id) return Response.json({ error: 'ticket_id required' }, { status: 400 });

    let ticket;
    try {
      ticket = await base44.asServiceRole.entities.PickTicket.get(ticket_id);
    } catch {
      return Response.json({ error: 'Pick ticket not found' }, { status: 404 });
    }

    // Guard: only fire on the open/in_progress -> done transition (mirrors the trigger condition)
    if (ticket.status === 'done') {
      return Response.json({ error: 'Pick ticket already completed', ticket_number: ticket.ticket_number }, { status: 409 });
    }

    // Merge yard-worker verified counts into the pick items
    const verifiedMap = new Map();
    (verified_items || []).forEach(v => verifiedMap.set(v.product_id, v));

    const updatedPickItems = ticket.pick_items.map(item => {
      const v = verifiedMap.get(item.product_id);
      if (v) {
        const verifiedQty = Number(v.verified_quantity || 0);
        const lineStatus = v.line_status || (verifiedQty >= item.requested_quantity ? 'verified' : 'short');
        return {
          ...item,
          verified_quantity: verifiedQty,
          line_status: lineStatus
        };
      }
      return item;
    });

    // STEP 1 — Deduct verified inventory from Products + release the soft-reserved hold
    for (const item of updatedPickItems) {
      const deduct = Number(item.verified_quantity || 0);
      const release = Number(item.requested_quantity || 0);
      const product = await base44.asServiceRole.entities.Product.get(item.product_id);
      if (product) {
        const newStock = Math.max(0, Number(product.stock_quantity || 0) - deduct);
        const newReserved = Math.max(0, Number(product.reserved_quantity || 0) - release);
        await base44.asServiceRole.entities.Product.update(item.product_id, {
          stock_quantity: newStock,
          reserved_quantity: newReserved
        });
      }
    }

    // STEP 2 — Complete the pick ticket and timestamp it
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.PickTicket.update(ticket_id, {
      status: 'done',
      pick_items: updatedPickItems,
      verified_by: user.id,
      verified_at: now,
      notes: notes || ticket.notes
    });

    // STEP 3 — Elevate parent Order to 'completed' and calculate points (1 pt / $1)
    const order = await base44.asServiceRole.entities.Order.get(ticket.order_id);
    let pointsEarned = 0;
    if (order) {
      pointsEarned = Math.floor(Number(order.total || 0));
      await base44.asServiceRole.entities.Order.update(ticket.order_id, {
        status: 'completed',
        points_earned: pointsEarned
      });

      // STEP 4 — Credit SCR Stars Club loyalty points + recompute tier
      if (order.user_id && pointsEarned > 0) {
        const customer = await base44.asServiceRole.entities.User.get(order.user_id);
        if (customer) {
          const newPoints = Number(customer.loyalty_points || 0) + pointsEarned;
          const newLifetime = Number(customer.lifetime_points || 0) + pointsEarned;
          const newTier = tierFor(newLifetime);
          await base44.asServiceRole.entities.User.update(order.user_id, {
            loyalty_points: newPoints,
            lifetime_points: newLifetime,
            loyalty_tier: newTier
          });
        }
      }
    }

    return Response.json({
      success: true,
      ticket_number: ticket.ticket_number,
      order_id: ticket.order_id,
      points_earned: pointsEarned,
      completed_at: now,
      verified_by: user.id
    });
  } catch (error) {
    console.error('complete-pick-ticket error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}