import React from 'react';
import { ShoppingBasket, Plus } from 'lucide-react';
import { availableQty } from '@/lib/stock';

// Lists a customer's previously ordered items (deduplicated, most-recent first)
// with a quick add-to-cart so common feed supplies are one tap to restock.
export default function BuyAgain({ orders, stockMap, onAdd }) {
  const seen = new Set();
  const items = [];
  for (const o of orders) {
    for (const it of (o.items || [])) {
      if (!it.product_id || seen.has(it.product_id)) continue;
      seen.add(it.product_id);
      items.push(it);
    }
  }

  const buyable = items.filter((it) => {
    const product = stockMap[it.product_id];
    return product && product.is_active !== false && availableQty(product) > 0;
  }).slice(0, 12);

  if (buyable.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <ShoppingBasket className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Buy Again</h3>
      </div>
      <p className="text-sm text-muted-foreground">Tap to restock the supplies you order most.</p>
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        {buyable.map((it) => {
          const product = stockMap[it.product_id];
          return (
            <div key={it.product_id} className="shrink-0 w-36 rounded-xl border bg-card p-3 space-y-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium leading-snug line-clamp-2">{product.name}</p>
                <p className="text-sm text-muted-foreground capitalize">{product.unit_of_measure}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">${Number(product.price).toFixed(2)}</span>
                <button
                  onClick={() => onAdd(it)}
                  className="h-11 w-11 md:h-9 md:w-9 flex items-center justify-center rounded-full bg-primary text-primary-foreground shrink-0"
                  aria-label={`Add ${product.name} to cart`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}