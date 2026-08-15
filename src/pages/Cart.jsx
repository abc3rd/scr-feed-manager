import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCart } from '@/lib/CartContext';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trash2, Minus, Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const TIER_DISCOUNTS = {
  bronze: 0,
  silver: 0.05,
  gold: 0.10,
  platinum: 0.15,
};

export default function Cart() {
  const { items, updateQuantity, removeItem, clear, subtotal } = useCart();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const tier = user?.loyalty_tier || 'bronze';
  const discountRate = isAuthenticated ? (TIER_DISCOUNTS[tier] || 0) : 0;
  const discountAmount = +(subtotal * discountRate).toFixed(2);
  const total = +(subtotal - discountAmount).toFixed(2);

  const handleCheckout = async () => {
    if (window.self !== window.top) {
      toast({
        title: 'Checkout unavailable',
        description: 'Checkout works only from the published app.',
        variant: 'destructive',
      });
      return;
    }
    if (items.length === 0) return;
    setLoading(true);
    try {
      const lineItems = items.map(i => ({
        product_id: i.product_id,
        name: i.name,
        unit_of_measure: i.unit_of_measure,
        quantity: i.quantity,
        unit_price: i.unit_price,
        line_total: +(i.unit_price * i.quantity).toFixed(2),
      }));
      const res = await base44.functions.invoke('create-checkout-session', {
        items: lineItems,
        user_id: user?.id || null,
        discount_amount: discountAmount,
        tier_applied: isAuthenticated ? tier : null,
        success_url: `${window.location.origin}/order-success`,
        cancel_url: `${window.location.origin}/cart`,
      });
      const data = res.data;
      if (data.url) {
        clear();
        window.location.href = data.url;
      } else {
        toast({ title: 'Checkout failed', description: data.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (err) {
      toast({
        title: 'Checkout failed',
        description: err.response?.data?.error || err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-muted-foreground">Your cart is empty.</p>
        <Button onClick={() => navigate('/')}>Browse Products</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-heading font-bold text-xl">Your Cart</h2>

      <div className="space-y-2">
        {items.map(item => (
          <Card key={item.product_id} className="p-3 flex items-center gap-3">
            <div className="flex-1">
              <p className="font-medium text-sm">{item.name}</p>
              <p className="text-xs text-muted-foreground">${item.unit_price.toFixed(2)} / {item.unit_of_measure}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-11 w-11" onClick={() => updateQuantity(item.product_id, item.quantity - 1)}>
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
              <Button size="icon" variant="outline" className="h-11 w-11" onClick={() => updateQuantity(item.product_id, item.quantity + 1)}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="text-right w-16">
              <p className="font-medium text-sm">${(item.unit_price * item.quantity).toFixed(2)}</p>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => removeItem(item.product_id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </Card>
        ))}
      </div>

      <Card className="p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span className="capitalize">{tier} discount ({discountRate * 100}%)</span>
            <span>−${discountAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold pt-2 border-t">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </Card>

      {!isAuthenticated && (
        <p className="text-xs text-muted-foreground text-center">
          <button onClick={() => navigate('/login')} className="text-primary underline">Sign in</button> to earn loyalty points on this order.
        </p>
      )}

      <Button className="w-full" size="lg" onClick={handleCheckout} disabled={loading}>
        {loading ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redirecting to checkout…</>
        ) : (
          `Checkout · $${total.toFixed(2)}`
        )}
      </Button>
    </div>
  );
}