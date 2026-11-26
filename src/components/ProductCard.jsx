import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Image } from '@/components/ui/image';
import { Plus } from 'lucide-react';
import { useCart } from '@/lib/CartContext';
import { availableQty, tracksStock } from '@/lib/stock';

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const available = availableQty(product);
  const outOfStock = available <= 0;
  const needsPrice = !(Number(product.price) > 0);

  return (
    <Card className="overflow-hidden flex flex-col">
      <div className="aspect-square bg-muted">
        {product.image_url ? (
          <Image src={product.image_url} alt={product.name} className="h-full w-full" fittingType="fill" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground text-4xl">
            🌾
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1 flex-1">
        <h3 className="font-medium text-sm leading-tight">{product.name}</h3>
        <p className="text-sm text-muted-foreground capitalize">{product.category} · per {product.unit_of_measure}</p>
        <div className="mt-auto flex items-center justify-between pt-2">
          {needsPrice ? (
            <span className="text-sm text-muted-foreground">Price coming soon</span>
          ) : (
            <span className="font-heading font-bold">${Number(product.price).toFixed(2)}</span>
          )}
          <Button size="sm" className="h-11" disabled={outOfStock || needsPrice} onClick={() => addItem(product)}>
            {outOfStock ? <span className="text-sm md:text-xs">Sold out</span> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        {tracksStock(product) && !outOfStock && available <= 5 && (
          <p className="text-sm text-amber-600 dark:text-amber-400">Only {available} left</p>
        )}
      </div>
    </Card>
  );
}