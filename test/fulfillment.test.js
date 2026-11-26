import { describe, it, expect } from 'vitest';
import { useFakeBase44 } from './fakes/base44-sdk.js';
import { jsonRequest } from './helpers.js';
import checkout from '../base44/functions/create-checkout-session/entry.ts';
import completePickTicket from '../base44/functions/complete-pick-ticket/entry.ts';

const hay = {
  id: 'p_hay', name: 'Coastal hay', category: 'hay', price: 12.5,
  unit_of_measure: 'bale', stock_quantity: 40, reserved_quantity: 0, is_active: true,
  shopify_variant_id: '333',
};
const staff = { id: 'u_staff', role: 'staff' };

describe('two-step fulfillment', () => {
  it('placing an order reserves stock but does not deduct it', async () => {
    const db = useFakeBase44({ products: [hay] });

    const res = await checkout(jsonRequest({ items: [{ product_id: 'p_hay', quantity: 5 }] }));

    expect(res.status).toBe(200);
    expect(db.product('p_hay').stock_quantity).toBe(40);
    expect(db.product('p_hay').reserved_quantity).toBe(5);
    expect(db.orders()[0].status).toBe('pending');
    expect(db.tickets()[0].status).toBe('open');
  });
});

async function placeOrder(db, quantity) {
  await checkout(jsonRequest({ items: [{ product_id: 'p_hay', quantity }] }));
  return db.tickets().at(-1);
}

describe('completing a pick ticket', () => {
  it('deducts the verified count and releases the reservation', async () => {
    const db = useFakeBase44({ products: [hay] });
    const ticket = await placeOrder(db, 5);
    db.signIn(staff);

    const res = await completePickTicket(jsonRequest({
      ticket_id: ticket.id,
      verified_items: [{ product_id: 'p_hay', verified_quantity: 5 }],
    }));

    expect(res.status).toBe(200);
    expect(db.product('p_hay').stock_quantity).toBe(35);
    expect(db.product('p_hay').reserved_quantity).toBe(0);
    expect(db.tickets()[0].status).toBe('done');
    expect(db.orders()[0].status).toBe('completed');
  });

  it('a short pick deducts only what the yard worker counted', async () => {
    const db = useFakeBase44({ products: [hay] });
    const ticket = await placeOrder(db, 5);
    db.signIn(staff);

    await completePickTicket(jsonRequest({
      ticket_id: ticket.id,
      verified_items: [{ product_id: 'p_hay', verified_quantity: 3 }],
    }));

    expect(db.product('p_hay').stock_quantity).toBe(37);
    expect(db.product('p_hay').reserved_quantity).toBe(0);
    expect(db.tickets()[0].pick_items[0].line_status).toBe('short');
  });

  it('refuses to complete while any line is unverified, leaving stock untouched', async () => {
    const db = useFakeBase44({ products: [hay] });
    const ticket = await placeOrder(db, 5);
    db.signIn(staff);

    const res = await completePickTicket(jsonRequest({ ticket_id: ticket.id, verified_items: [] }));

    expect(res.status).toBe(400);
    expect(db.product('p_hay').stock_quantity).toBe(40);
    expect(db.product('p_hay').reserved_quantity).toBe(5);
    expect(db.tickets()[0].status).toBe('open');
  });

  it('cannot be completed twice', async () => {
    const db = useFakeBase44({ products: [hay] });
    const ticket = await placeOrder(db, 5);
    db.signIn(staff);
    const done = { ticket_id: ticket.id, verified_items: [{ product_id: 'p_hay', verified_quantity: 5 }] };

    await completePickTicket(jsonRequest(done));
    const again = await completePickTicket(jsonRequest(done));

    expect(again.status).toBe(409);
    expect(db.product('p_hay').stock_quantity).toBe(35);
  });

  it('only staff can complete a ticket', async () => {
    const db = useFakeBase44({ products: [hay] });
    const ticket = await placeOrder(db, 5);
    db.signIn({ id: 'u_cust', role: 'customer' });

    const res = await completePickTicket(jsonRequest({
      ticket_id: ticket.id,
      verified_items: [{ product_id: 'p_hay', verified_quantity: 5 }],
    }));

    expect(res.status).toBe(403);
    expect(db.product('p_hay').stock_quantity).toBe(40);
  });
});
