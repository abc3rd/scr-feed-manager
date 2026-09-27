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
        // Only cancel still-pending unpaid orders — the status guard also
        // prevents double-decrementing reservations on a retried webhook.
        if (order && order.payment_status === 'unpaid' && order.status === 'pending') {
          for (const i of (order.items || [])) {
            const product = await base44.asServiceRole.entities.Product.get(i.product_id);
            if (product) {
              await base44.asServiceRole.entities.Product.update(i.product_id, {
                reserved_quantity: Math.max(0, Number(product.reserved_quantity || 0) - Number(i.quantity || 0))
              });
            }
          }
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