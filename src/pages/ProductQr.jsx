import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCart } from '@/lib/CartContext';
import { availableQty } from '@/lib/stock';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';

// Product QR: the sticker on a shelf or bag opens /q/<product id>. The product
// goes straight into the cart, and the cart's checkout is the SCR Online
// Shopify checkout. Point, tap, done.
export default function ProductQr() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    base44.entities.Product.get(productId)
      .then((product) => {
        if (cancelled) return;
        if (!product || product.is_active === false || !(Number(product.price) > 0) || availableQty(product) <= 0) {
          setError('This product is not available to order right now.');
          return;
        }
        addItem(product, 1);
        navigate('/cart', { replace: true });
      })
      .catch(() => !cancelled && setError('This code is not linked to a product.'));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  if (!error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <p className="font-medium">{error}</p>
      <Button variant="outline" onClick={() => navigate('/shop')}>Browse the shop</Button>
    </div>
  );
}
