import { describe, it, expect } from 'vitest';
import { useFakeBase44 } from './fakes/base44-sdk.js';
import { jsonRequest } from './helpers.js';
import checkout from '../base44/functions/create-checkout-session/entry.ts';

const base = { category: 'feed', unit_of_measure: 'bag', stock_quantity: 10, reserved_quantity: 0, is_active: true, shopify_variant_id: '111' };

describe('a product without a real price never sells', () => {
  for (const [label, price] of [['a $0 price', 0], ['no price', undefined], ['a negative price', -4]]) {
    it(`rejects checkout for ${label} and creates nothing`, async () => {
      const db = useFakeBase44({ products: [{ ...base, id: 'p_x', name: 'Mystery feed', price }] });

      const res = await checkout(jsonRequest({ items: [{ product_id: 'p_x', quantity: 1 }] }));
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.needs_price).toEqual(['p_x']);
      expect(db.orders()).toHaveLength(0);
      expect(db.tickets()).toHaveLength(0);
      expect(db.product('p_x').reserved_quantity).toBe(0);
    });
  }
});
