import React, { useMemo } from 'react';
import ProductCard from '@/components/ProductCard';
import { TrendingUp } from 'lucide-react';

export default function TrendingNow({ products, trending }) {
  const items = useMemo(() => {
    const productMap = new Map((products || []).map(p => [p.id, p]));
    return (trending || [])
      .map(r => ({ product: productMap.get(r.product_id), qty: r.quantity }))
      .filter(e => e.product)
      .slice(0, 6);
  }, [trending, products]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h3 className="font-heading font-bold text-base">Trending Now</h3>
        <span className="text-xs text-muted-foreground">Most ordered this week</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
        {items.map(({ product }) => (
          <div key={product.id} className="w-40 shrink-0">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </div>
  );
}