import { describe, it, expect } from 'vitest';
import { useFakeBase44 } from './fakes/base44-sdk.js';
import { jsonRequest } from './helpers.js';
import checkout from '../base44/functions/create-checkout-session/entry.ts';

// Shopify-synced products: Shopify keeps selling at zero stock, and the yard
// count at pick time is the check (count-before-charge).
const pellet = {
  id: 'p_pellet', name: 'Tribute Kalm N EZ', category: 'feed', price: 25.59,
  unit_of_measure: 'bag', stock_quantity: 0, reserved_quantity: 0, is_active: true,
  track_stock: false, shopify_variant_id: '68445086580973',
};
const hay = {
  id: 'p_hay', name: 'Coastal hay', category: 'hay', price: 12.5,
  unit_of_measure: 'bale', stock_quantity: 0, reserved_quantity: 0, is_active: true,
  track_stock: false, shopify_variant_id: '444',
};

describe('checkout hands the cart to the Shopify store', () => {
  it('returns a scrfeed.com cart link with each variant and quantity', async () => {
    const db = useFakeBase44({ products: [pellet, hay] });

    const res = await checkout(jsonRequest({ items: [
      { product_id: 'p_pellet', quantity: 2 },
      { product_id: 'p_hay', quantity: 10 },
    ] }));
    const body = await res.json();

    expect(res.status).toBe(200);
    const url = new URL(body.url);
    expect(url.origin).toBe('https://scrfeed.com');
    expect(url.pathname).toBe('/cart/68445086580973:2,444:10');
    expect(url.searchParams.get('attributes[SCR order]')).toBe(body.order_number);
    const order = db.orders()[0];
    expect(order.total).toBe(176.18);
    expect(order.checkout_channel).toBe('shopify');
    expect(order.checkout_url).toBe(body.url);
    expect(db.tickets()[0].status).toBe('open');
  });

  it('does not limit or reserve products whose stock the app does not track', async () => {
    const db = useFakeBase44({ products: [pellet] });

    const res = await checkout(jsonRequest({ items: [{ product_id: 'p_pellet', quantity: 30 }] }));

    expect(res.status).toBe(200);
    expect(db.product('p_pellet').reserved_quantity).toBe(0);
  });

  it('merges repeated lines for the same variant', async () => {
    useFakeBase44({ products: [pellet] });

    const res = await checkout(jsonRequest({ items: [
      { product_id: 'p_pellet', quantity: 1 },
      { product_id: 'p_pellet', quantity: 2 },
    ] }));

    expect(new URL((await res.json()).url).pathname).toBe('/cart/68445086580973:3');
  });

  it('refuses a product that is not in the Shopify store and creates nothing', async () => {
    const db = useFakeBase44({ products: [{ ...pellet, id: 'p_local', shopify_variant_id: undefined }] });

    const res = await checkout(jsonRequest({ items: [{ product_id: 'p_local', quantity: 1 }] }));

    expect(res.status).toBe(400);
    expect(db.orders()).toHaveLength(0);
    expect(db.tickets()).toHaveLength(0);
  });

  it('a signed-in member gets their email filled in at checkout', async () => {
    useFakeBase44({ user: { id: 'u_m', role: 'customer', email: 'member@example.com' }, products: [pellet] });

    const res = await checkout(jsonRequest({ items: [{ product_id: 'p_pellet', quantity: 1 }] }));

    expect(new URL((await res.json()).url).searchParams.get('checkout[email]')).toBe('member@example.com');
  });
});
