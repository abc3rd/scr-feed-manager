import { describe, it, expect } from 'vitest';
import { recordsFromShopifyProduct } from '../base44/functions/sync-shopify-catalog/entry.ts';

const node = (over = {}) => ({
  id: 'gid://shopify/Product/1', title: 'Wellness Dynasport.       12/14/18', handle: 'wellness-dynasport',
  productType: 'Livestock Feed', tags: ['Horse Feed'], description: 'A feed.',
  featuredImage: { url: 'https://cdn.shopify.com/a.jpg' },
  variants: { nodes: [{ id: 'gid://shopify/ProductVariant/9', title: 'Default Title', sku: null, availableForSale: true, price: { amount: '40.94' }, image: null }] },
  ...over,
});

describe('Shopify catalog sync', () => {
  it('keeps the store price and links the Shopify variant', () => {
    const [r] = recordsFromShopifyProduct(node());
    expect(r).toMatchObject({
      name: 'Wellness Dynasport. 12/14/18', price: 40.94, category: 'feed', unit_of_measure: 'bag',
      shopify_variant_id: '9', shopify_product_id: '1', shopify_handle: 'wellness-dynasport',
      track_stock: false, is_active: true,
    });
  });

  it('names variants and maps hay bales', () => {
    const rs = recordsFromShopifyProduct(node({ title: 'Coastal Square Bale', productType: 'Hay', variants: { nodes: [
      { id: 'gid://shopify/ProductVariant/1', title: 'Small', availableForSale: true, price: { amount: '12.00' } },
      { id: 'gid://shopify/ProductVariant/2', title: 'Large', availableForSale: false, price: { amount: '15.00' } },
    ] } }));
    expect(rs.map((r) => [r.name, r.category, r.unit_of_measure, r.is_active])).toEqual([
      ['Coastal Square Bale - Small', 'hay', 'bale', true],
      ['Coastal Square Bale - Large', 'hay', 'bale', false],
    ]);
  });

  it('never sells a $0 variant and skips memberships', () => {
    expect(recordsFromShopifyProduct(node({ variants: { nodes: [{ id: 'x/3', title: 'Default Title', availableForSale: true, price: { amount: '0.00' } }] } }))[0].is_active).toBe(false);
    expect(recordsFromShopifyProduct(node({ productType: 'Membership' }))).toEqual([]);
  });

  it('tags Supplements as supplements', () => {
    expect(recordsFromShopifyProduct(node({ productType: 'Horse Care', tags: ['Supplements'] }))[0].category).toBe('supplements');
  });
});
