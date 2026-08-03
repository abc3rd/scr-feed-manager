import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.3.1';
import { secrets } from 'base44:runtime';

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
    const stripe = new Stripe(secrets.get('STRIPE_SECRET_KEY'));
    const signature = req.headers.get('stripe-signature');
    const rawBody = await req.text();

    const event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      secrets.get('STRIPE_WEBHOOK_SECRET')
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = session.metadata?.order_id;

      if (orderId) {
        // Mark the order as paid (fulfillment status stays pending — two-step flow)
        await base44.asServiceRole.entities.Order.update(orderId, {
          payment_status: 'paid'
        });

        const order = await base44.asServiceRole.entities.Order.get(orderId);
        // Award loyalty points: 1 point per $1 spent
        const pointsEarned = Math.floor(Number(order.total || 0));
        await base44.asServiceRole.entities.Order.update(orderId, { points_earned: pointsEarned });

        if (order.user_id && pointsEarned > 0) {
          const user = await base44.asServiceRole.entities.User.get(order.user_id);
          const newPoints = Number(user.loyalty_points || 0) + pointsEarned;
          const newLifetime = Number(user.lifetime_points || 0) + pointsEarned;
          const newTier = tierFor(newLifetime);
          await base44.asServiceRole.entities.User.update(order.user_id, {
            loyalty_points: newPoints,
            lifetime_points: newLifetime,
            loyalty_tier: newTier
          });
        }
      }
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object;
      const orderId = session.metadata?.order_id;
      if (orderId) {
        const order = await base44.asServiceRole.entities.Order.get(orderId);
        if (order && order.payment_status === 'unpaid') {
          await base44.asServiceRole.entities.Order.update(orderId, { status: 'cancelled' });
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('stripe-webhook error:', error);
    return Response.json({ error: error.message }, { status: 400 });
  }
}