import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import Stripe from 'npm:stripe@17.3.1';
import { secrets } from 'base44:runtime';

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
        // Mark the order as paid. Fulfillment status stays pending (two-step flow).
        // Loyalty points are awarded at pick-ticket completion, not at payment.
        await base44.asServiceRole.entities.Order.update(orderId, {
          payment_status: 'paid'
        });
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