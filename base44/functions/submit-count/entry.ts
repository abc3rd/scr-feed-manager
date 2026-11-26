import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Count screen -> n8n. A staff member's count session (scanned items with typed
// counts) goes to the "SCR Inventory Count Session" workflow, which compares it
// with Shopify on-hand at Fort Myers. Nothing is stored in Base44: Shopify is
// the system of record and the count log lives in Supabase.
// Kept free of app-specific UI so it can move into a standalone QRAPID app.

export const LOCATION = 'Fort Myers';

// What a scanned code points at: a Product QR link (/q/<id>), a bare product
// id, or a Shopify variant number.
export function parseScan(raw: unknown): { productId?: string; variantId?: string } | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const m = s.match(/\/q\/([^/?#\s]+)/);
  if (m) return { productId: decodeURIComponent(m[1]) };
  if (/^\d{6,}$/.test(s)) return { variantId: s };
  return { productId: s };
}

type Line = { product: any; counted_qty: unknown };

export function buildCountPayload({ counted_by, lines, is_test = false }: { counted_by: string; lines: Line[]; is_test?: boolean }) {
  const byVariant = new Map<string, any>();
  for (const l of lines) {
    const p = l.product || {};
    const qty = Number(l.counted_qty);
    const variant = String(p.shopify_variant_id || '').replace(/\D/g, '');
    if (!variant || !Number.isInteger(qty) || qty < 0) continue;
    byVariant.set(variant, { base44_product_id: p.id, shopify_variant_id: variant, name: p.name, sku: p.sku || null, counted_qty: qty });
  }
  return { location: LOCATION, counted_by, is_test: is_test === true, lines: [...byVariant.values()] };
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    let me = null;
    try { me = await base44.auth.me(); } catch { /* no session */ }
    if (!me) return Response.json({ error: 'Sign in first' }, { status: 401 });
    if (me.role !== 'admin' && me.role !== 'staff') return Response.json({ error: 'Staff only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const input = Array.isArray(body?.lines) ? body.lines.slice(0, 500) : [];
    if (!input.length) return Response.json({ error: 'Add at least one item' }, { status: 400 });

    const lines: Line[] = [];
    for (const l of input) {
      try {
        const product = await base44.asServiceRole.entities.Product.get(String(l.product_id));
        lines.push({ product, counted_qty: l.counted_qty });
      } catch { /* unknown product: skipped */ }
    }
    const payload = buildCountPayload({ counted_by: me.email || me.id, lines, is_test: body.is_test === true });
    if (!payload.lines.length) return Response.json({ error: 'None of these items are linked to Shopify' }, { status: 400 });

    const hook = Deno.env.get('SCR_COUNT_WEBHOOK');
    const key = Deno.env.get('SCR_COUNT_KEY');
    if (!hook || !key) return Response.json({ error: 'Counting is not set up yet' }, { status: 503 });

    const res = await fetch(hook, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-scr-count-key': key },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let out: any = null;
    try { out = JSON.parse(text); } catch { /* not json */ }
    if (!res.ok || !out?.session_code) {
      console.error('submit-count: workflow answered', res.status, text.slice(0, 300));
      return Response.json({ error: 'The count could not be checked against Shopify right now. Your list is still on screen; try again.' }, { status: 502 });
    }
    return Response.json(out);
  } catch (error) {
    console.error('submit-count error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
