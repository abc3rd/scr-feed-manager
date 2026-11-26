import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Copies the SCR Online Shopify catalog (scrfeed.com) into Product records so
// barn QR quick-orders and the shop show the store's real products and
// prices. Shopify stays the source of truth: prices and names are overwritten
// on every run, and checkout hands the cart back to Shopify by variant id.
//
// Reads the store's public Storefront API (tokenless access to published
// products), so no Shopify credentials are needed. Callable by an admin, or with the CATALOG_SYNC_KEY secret in the
// x-sync-key header (for a scheduled run).

const SHOP_DOMAIN = Deno.env.get('SHOPIFY_SHOP_DOMAIN') || 'mdppwz-j0.myshopify.com';
const STOREFRONT_API = `https://${SHOP_DOMAIN}/api/2025-07/graphql.json`;
const numericId = (gid: unknown) => String(gid ?? '').split('/').pop() || '';
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

// One Product record per Shopify variant. `p` is a Storefront API product node.
export function recordsFromShopifyProduct(p: any) {
  const productType = clean(p.productType);
  if (SKIP_TYPES.has(productType)) return [];
  const category = categoryFor({ product_type: productType, tags: p.tags });
  const title = clean(p.title);
  const productImage = p.featuredImage?.url || null;
  const description = stripHtml(p.description) || undefined;
  return (p.variants?.nodes || []).map((v: any) => {
    const variantTitle = clean(v.title);
    const name = variantTitle && variantTitle !== 'Default Title' ? `${title} - ${variantTitle}` : title;
    const price = Number(v.price?.amount);
    return {
      name,
      sku: v.sku || undefined,
      description,
      category,
      price,
      unit_of_measure: unitFor(name, category),
      image_url: v.image?.url || productImage || undefined,
      is_active: v.availableForSale !== false && price > 0,
      track_stock: false,
      shopify_product_id: numericId(p.id),
      shopify_variant_id: numericId(v.id),
      shopify_handle: p.handle,
      product_type: productType || undefined,
    };
  });
}

const CATALOG_QUERY = `query Catalog($after: String) {
  products(first: 50, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id title handle productType tags description(truncateAt: 400)
      featuredImage { url }
      variants(first: 100) { nodes { id title sku availableForSale price { amount } image { url } } }
    }
  }
}`;

async function fetchAllShopifyProducts(fetchImpl = fetch) {
  const all: any[] = [];
  let after: string | null = null;
  for (let page = 1; page <= 200; page++) {
    let res: Response | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      res = await fetchImpl(STOREFRONT_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify({ query: CATALOG_QUERY, variables: { after } }),
      });
      if (res.status !== 429 && res.status < 500) break;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
    if (!res || !res.ok) throw new Error(`Shopify catalog page ${page} returned ${res?.status}`);
    const body = await res.json();
    if (body.errors) throw new Error(`Shopify catalog error: ${JSON.stringify(body.errors).slice(0, 300)}`);
    const conn = body?.data?.products;
    all.push(...(conn?.nodes || []));
    if (!conn?.pageInfo?.hasNextPage) break;
    after = conn.pageInfo.endCursor;
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
