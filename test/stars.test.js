import { describe, it, expect, beforeEach } from 'vitest';
import { useFakeBase44 } from './fakes/base44-sdk.js';
import { stripeCalls } from './fakes/stripe.js';
import { jsonRequest } from './helpers.js';
import checkout from '../base44/functions/create-checkout-session/entry.ts';
import completePickTicket from '../base44/functions/complete-pick-ticket/entry.ts';

// ADR 0001 (syncloudconnect-main): Stars never reduce the price of a sale.
const feed = {
  id: 'p_feed', name: 'Sweet feed', category: 'feed', price: 20,
  unit_of_measure: 'bag', stock_quantity: 50, reserved_quantity: 0, is_active: true,
};
const longtimeMember = {
  id: 'u_member', role: 'customer', membership: 'paid',
  loyalty_points: 6000, lifetime_points: 6000, loyalty_tier: 'platinum',
};

describe('Stars never discount a sale', () => {
  beforeEach(() => { stripeCalls.sessions.length = 0; stripeCalls.coupons.length = 0; });

  it('a long-time Paid Member pays full price', async () => {
    const db = useFakeBase44({ user: longtimeMember, products: [feed] });

    const res = await checkout(jsonRequest({ items: [{ product_id: 'p_feed', quantity: 3 }] }));

    expect(res.status).toBe(200);
    const order = db.orders()[0];
    expect(order.total).toBe(60);
    expect(order.discount_amount).toBe(0);
    expect(stripeCalls.coupons).toHaveLength(0);
    expect(stripeCalls.sessions[0].discounts).toBeUndefined();
  });

  it('completing an order earns Stars for every dollar but assigns no tier', async () => {
    const member = { id: 'u_new', role: 'customer', membership: 'free', loyalty_points: 0, lifetime_points: 0 };
    const db = useFakeBase44({ user: member, products: [feed] });
    await checkout(jsonRequest({ items: [{ product_id: 'p_feed', quantity: 3 }] }));
    db.signIn({ id: 'u_staff', role: 'staff' });

    await completePickTicket(jsonRequest({
      ticket_id: db.tickets()[0].id,
      verified_items: [{ product_id: 'p_feed', verified_quantity: 3 }],
    }));

    expect(db.user('u_new').loyalty_points).toBe(60);
    expect(db.user('u_new').lifetime_points).toBe(60);
    expect(db.user('u_new').loyalty_tier).toBeUndefined();
  });
});
