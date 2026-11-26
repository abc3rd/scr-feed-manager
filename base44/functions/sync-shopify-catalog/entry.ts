import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Copies the SCR Online Shopify catalog (scrfeed.com) into Product records so
// barn QR quick-orders and the shop show the store's real products and
// prices. Shopify stays the source of truth: prices and names are overwritten
// on every run, and checkout hands the cart back to Shopify by variant id.
//
// Reads the store's public /products.json feed, so no Shopify credentials are
// needed. Callable by an admin, or with the CATALOG_SYNC_KEY secret in the
// x-sync-key header (for a scheduled run).

const STORE_URL = Deno.env.get('SHOPIFY_STORE_URL') || 'https://scrfeed.com';
const SKIP_TYPES = new Set(['Membership', 'Services']);

const TYPE_CATEGORY: Record<string, string> = {
  'Hay': 'hay',
  'Livestock Feed': 'feed',
  'Pet Feed': 'feed',
  'Bedding': 'bedding',
  'Tack': 'equipment',
  'Hardware': 'equipment',
  'Fencing': 'equipment',
  'Barn Items': 'equipment',
  'Hunting Supplies': 'equipment',
};

const clean = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').replace(/\s+\./g, '.').trim();
const stripHtml = (s: unknown) => clean(String(s ?? '').replace(/<[^>]*>/g, ' ')).slice(0, 600);

export function categoryFor(product: { product_type?: string; tags?: string[] | string }) {
  const tags = Array.isArray(product.tags) ? product.tags : String(product.tags || '').split(',');
  if (tags.some((t) => clean(t).toLowerCase() === 'supplements')) return 'supplements';
  return TYPE_CATEGORY[clean(product.product_type)] || 'other';
}

export function unitFor(name: string, category: string) {
  if (/\bbales?\b/i.test(name)) return 'bale';
  if (/\bblocks?\b/i.test(name)) return 'block';
  if (category === 'feed' || category === 'bedding') return 'bag';
  return 'each';
}

// One Product record per Shopify variant.
export function recordsFromShopifyProduct(p: any) {
  if (SKIP_TYPES.has(clean(p.product_type))) return [];
  const category = categoryFor(p);
  const title = clean(p.title);
  const productImage = p.images?.[0]?.src || p.image?.src || null;
  return (p.variants || []).map((v: any) => {
    const variantTitle = clean(v.title);
    const name = variantTitle && variantTitle !== 'Default Title' ? `${title} - ${variantTitle}` : title;
    const image = (p.images || []).find((img: any) => (img.variant_ids || []).includes(v.id))?.src || productImage;
    return {
      name,
      sku: v.sku || undefined,
      description: stripHtml(p.body_html) || undefined,
      category,
      price: Number(v.price),
      unit_of_measure: unitFor(name, category),
      image_url: image || undefined,
      is_active: v.available !== false && Number(v.price) > 0,
      track_stock: false,
      shopify_product_id: String(p.id),
      shopify_variant_id: String(v.id),
      shopify_handle: p.handle,
      product_type: clean(p.product_type) || undefined,
    };
  });
}

async function fetchAllShopifyProducts(fetchImpl = fetch) {
  const all: any[] = [];
  for (let page = 1; page <= 40; page++) {
    const res = await fetchImpl(`${STORE_URL}/products.json?limit=250&page=${page}`, {
      headers: { 'accept': 'application/json', 'user-agent': 'SCR-Feed-Catalog-Sync/1.0' },
    });
    if (!res.ok) throw new Error(`Shopify catalog page ${page} returned ${res.status}`);
    const body = await res.json();
    const products = body?.products || [];
    all.push(...products);
    if (products.length < 250) break;
  }
  return all;
}

const CHANGED_FIELDS = ['name', 'price', 'category', 'unit_of_measure', 'image_url', 'is_active', 'shopify_handle', 'sku'];

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);

    const key = Deno.env.get('CATALOG_SYNC_KEY');
    const keyOk = !!key && req.headers.get('x-sync-key') === key;
    if (!keyOk) {
      let me = null;
      try { me = await base44.auth.me(); } catch { /* no session */ }
      if (!me || me.role !== 'admin') {
        return Response.json({ error: 'Only an admin can sync the catalog' }, { status: 403 });
      }
    }

    let dryRun = false;
    try { dryRun = !!(await req.json())?.dry_run; } catch { /* no body */ }

    const shopifyProducts = await fetchAllShopifyProducts();
    const wanted = shopifyProducts.flatMap(recordsFromShopifyProduct);

    // Existing Shopify-linked records, keyed by variant id.
    const existing = new Map<string, any>();
    for (let skip = 0; ; skip += 500) {
      const batch = await base44.asServiceRole.entities.Product.list('created_date', 500, skip);
      for (const r of batch) if (r.shopify_variant_id) existing.set(String(r.shopify_variant_id), r);
      if (batch.length < 500) break;
    }

    const toCreate = [];
    const toUpdate = [];
    const seen = new Set<string>();
    for (const rec of wanted) {
      seen.add(rec.shopify_variant_id);
      const cur = existing.get(rec.shopify_variant_id);
      if (!cur) { toCreate.push(rec); continue; }
      const patch: Record<string, unknown> = {};
      for (const f of CHANGED_FIELDS) {
        if ((rec as any)[f] !== undefined && (rec as any)[f] !== cur[f]) patch[f] = (rec as any)[f];
      }
      if (Object.keys(patch).length) toUpdate.push({ id: cur.id, patch });
    }
    // Variants removed from the store stop selling here too.
    const toDeactivate = [...existing.values()].filter((r) => !seen.has(String(r.shopify_variant_id)) && r.is_active !== false);

    if (!dryRun) {
      for (let i = 0; i < toCreate.length; i += 200) {
        await base44.asServiceRole.entities.Product.bulkCreate(toCreate.slice(i, i + 200));
      }
      for (const u of toUpdate) await base44.asServiceRole.entities.Product.update(u.id, u.patch);
      for (const r of toDeactivate) await base44.asServiceRole.entities.Product.update(r.id, { is_active: false });
    }

    return Response.json({
      dry_run: dryRun,
      shopify_products: shopifyProducts.length,
      variants: wanted.length,
      created: toCreate.length,
      updated: toUpdate.length,
      deactivated: toDeactivate.length,
    });
  } catch (error) {
    console.error('sync-shopify-catalog error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
