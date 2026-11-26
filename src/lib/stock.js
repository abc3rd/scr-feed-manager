// How many units of a product can be ordered right now.
// Products synced from the Shopify store keep selling at zero stock (the yard
// count at pick time is the check), so the app does not limit them.
export const UNTRACKED_LIMIT = 999;

export function availableQty(product) {
  if (!product) return 0;
  if (product.track_stock === false) return UNTRACKED_LIMIT;
  return Number(product.stock_quantity || 0) - Number(product.reserved_quantity || 0);
}

export const tracksStock = (product) => !!product && product.track_stock !== false;
