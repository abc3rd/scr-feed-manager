import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useFakeBase44 } from './fakes/base44-sdk.js';
import handler, { parseScan, buildCountPayload } from '../base44/functions/submit-count/entry.ts';

const req = (body) => new Request('http://x/submit-count', { method: 'POST', body: JSON.stringify(body) });
const staff = { id: 'u1', role: 'staff', email: 'yard@scr.test' };
const product = { id: 'p1', name: 'Tribute Kalm N EZ', sku: '920P', shopify_variant_id: '68445086580973' };

describe('parseScan', () => {
  it('reads a Product QR link, a bare id or a variant number', () => {
    expect(parseScan('https://app.scrfeed.com/q/p1')).toEqual({ productId: 'p1' });
    expect(parseScan('p1')).toEqual({ productId: 'p1' });
    expect(parseScan('  68445086580973 ')).toEqual({ variantId: '68445086580973' });
    expect(parseScan('')).toBeNull();
  });
});

describe('buildCountPayload', () => {
  it('keeps the last count of an item scanned twice and drops bad counts', () => {
    const p = buildCountPayload({
      counted_by: 'yard@scr.test',
      lines: [
        { product: { ...product }, counted_qty: 4 },
        { product: { ...product }, counted_qty: 6 },
        { product: { ...product, id: 'p2', shopify_variant_id: '' }, counted_qty: 3 },
        { product: { ...product, id: 'p3', shopify_variant_id: '9' }, counted_qty: -1 },
      ],
    });
    expect(p.lines).toEqual([{ base44_product_id: 'p1', shopify_variant_id: '68445086580973', name: 'Tribute Kalm N EZ', sku: '920P', counted_qty: 6 }]);
    expect(p.location).toBe('Fort Myers');
  });
});

describe('submit-count', () => {
  beforeEach(() => {
    globalThis.Deno = { env: { get: (n) => ({ SCR_COUNT_KEY: 'k', SCR_COUNT_WEBHOOK: 'https://n8n.test/hook' }[n]) } };
  });

  it('turns away customers', async () => {
    useFakeBase44({ user: { id: 'c1', role: 'customer' }, products: [product] });
    const res = await handler(req({ lines: [{ product_id: 'p1', counted_qty: 2 }] }));
    expect(res.status).toBe(403);
  });

  it('sends the session to n8n with the key and stores nothing', async () => {
    const db = useFakeBase44({ user: staff, products: [product] });
    const fetchSpy = vi.fn(async () => Response.json({ ok: true, session_code: 'CNT-1', matched: 0, waiting: 1 }));
    globalThis.fetch = fetchSpy;
    const res = await handler(req({ lines: [{ product_id: 'p1', counted_qty: 12 }] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ session_code: 'CNT-1', waiting: 1 });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://n8n.test/hook');
    expect(init.headers['x-scr-count-key']).toBe('k');
    expect(JSON.parse(init.body)).toMatchObject({ counted_by: 'yard@scr.test', lines: [{ shopify_variant_id: '68445086580973', counted_qty: 12 }] });
    expect(db.product('p1')).toEqual(product);
  });
});
