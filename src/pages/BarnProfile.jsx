import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Minus, Plus, Truck, Store, Megaphone, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const TAG_LABELS = {
  'most-ordered': 'Your usual',
  hay: 'Available hay',
  popular: 'Popular',
};

const TAG_STYLES = {
  'most-ordered': 'bg-primary/10 text-primary',
  hay: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  popular: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
};

export default function BarnProfile() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const profileQuery = useQuery({
    queryKey: ['barn-profile', token],
    queryFn: () => base44.functions.invoke('barn-profile', { token }).then((r) => r.data),
    retry: false,
  });

  const [selection, setSelection] = useState({}); // product_id -> { checked, quantity }
  const [fulfillmentType, setFulfillmentType] = useState('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [placing, setPlacing] = useState(false);

  const member = profileQuery.data?.member;
  const items = profileQuery.data?.items || [];
  const promos = profileQuery.data?.promos || [];

  const toggle = (item) => {
    setSelection((prev) => {
      const cur = prev[item.product_id];
      if (cur?.checked) {
        const next = { ...prev };
        delete next[item.product_id];
        return next;
      }
      return { ...prev, [item.product_id]: { checked: true, quantity: 1 } };
    });
  };

  const setQty = (productId, qty, maxAvailable) => {
    const q = Math.max(1, Math.min(Math.floor(Number(qty) || 1), Math.max(1, maxAvailable)));
    setSelection((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], checked: true, quantity: q },
    }));
  };

  const selectedList = useMemo(
    () => items.filter((i) => selection[i.product_id]?.checked),
    [items, selection]
  );
  const itemCount = selectedList.length;
  const estimatedTotal = useMemo(
    () =>
      +selectedList
        .reduce((sum, i) => sum + i.price * (selection[i.product_id]?.quantity || 0), 0)
        .toFixed(2),
    [selectedList, selection]
  );

  const handlePlaceOrder = async (type) => {
    if (selectedList.length === 0) {
      toast({ title: 'No items selected', description: 'Check at least one item to order.', variant: 'destructive' });
      return;
    }
    if (type === 'delivery' && !deliveryAddress.trim()) {
      toast({ title: 'Delivery address required', description: 'Enter a delivery address to continue.', variant: 'destructive' });
      return;
    }
    if (window.self !== window.top) {
      toast({ title: 'Checkout unavailable', description: 'Checkout works only from the published app.', variant: 'destructive' });
      return;
    }
    setPlacing(true);
    try {
      const lineItems = selectedList.map((i) => ({
        product_id: i.product_id,
        name: i.name,
        unit_of_measure: i.unit_of_measure,
        quantity: selection[i.product_id].quantity,
        unit_price: i.price,
        line_total: +(i.price * selection[i.product_id].quantity).toFixed(2),
      }));
      const res = await base44.functions.invoke('create-checkout-session', {
        items: lineItems,
        barn_qr_id: token,
        fulfillment_type: type,
        delivery_address: type === 'delivery' ? deliveryAddress.trim() : null,
        success_url: `${window.location.origin}/order-success`,
        cancel_url: `${window.location.origin}/barn/${token}`,
      });
      const data = res.data;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast({ title: 'Checkout failed', description: data?.error || 'Unknown error', variant: 'destructive' });
        setPlacing(false);
      }
    } catch (err) {
      toast({ title: 'Checkout failed', description: err.response?.data?.error || err.message, variant: 'destructive' });
      setPlacing(false);
    }
  };

  if (profileQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (profileQuery.isError || profileQuery.data?.error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="font-medium">Barn code not recognized</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          {profileQuery.data?.error || 'This QR code is not linked to a Stars Club member. Ask the store to assign your barn sticker.'}
        </p>
        <Button variant="outline" onClick={() => navigate('/shop')}>Browse the shop</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="border-b bg-background/95 backdrop-blur pt-safe sticky top-0 z-20">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">SCR Stars Club · Barn Profile</p>
          <h1 className="font-heading font-bold text-xl mt-0.5">
            Welcome back{member?.full_name ? `, ${member.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">{member?.loyalty_tier} member · {member?.loyalty_points || 0} pts</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-5">
        {promos.length > 0 && (
          <div className="space-y-2">
            {promos.map((p, i) => (
              <Card key={i} className="p-3 flex gap-3 bg-primary/5 border-primary/20">
                <Megaphone className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium">{p.title}</p>
                  <p className="text-sm text-muted-foreground">{p.message}</p>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div>
          <h2 className="font-semibold mb-2">Quick order</h2>
          <p className="text-sm text-muted-foreground mb-3">Check the items you need, set quantities, then place your order.</p>
          <div className="space-y-2">
            {items.map((item) => {
              const sel = selection[item.product_id];
              const checked = !!sel?.checked;
              const qty = sel?.quantity || 1;
              const out = item.available <= 0;
              return (
                <Card key={item.product_id} className={cn('p-3', out && 'opacity-60')}>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={checked}
                      disabled={out}
                      onCheckedChange={() => !out && toggle(item)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium leading-tight">{item.name}</p>
                          <p className="text-sm text-muted-foreground capitalize">{item.unit_of_measure} · ${item.price.toFixed(2)}</p>
                        </div>
                        <span className="font-heading font-bold text-sm">${(item.price * qty).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex flex-wrap gap-1">
                          {item.tags.map((t) => (
                            <span key={t} className={cn('text-xs px-2 py-0.5 rounded-full', TAG_STYLES[t])}>
                              {TAG_LABELS[t]}
                            </span>
                          ))}
                          {out ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">Unavailable</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">{item.available} available</span>
                          )}
                        </div>
                        {checked && !out && (
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => setQty(item.product_id, qty - 1, item.available)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              value={qty}
                              onChange={(e) => setQty(item.product_id, e.target.value, item.available)}
                              className="h-9 w-14 text-center"
                            />
                            <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => setQty(item.product_id, qty + 1, item.available)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {fulfillmentType === 'delivery' && (
          <div>
            <label className="text-sm font-medium">Delivery address</label>
            <Input
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="Street address, city"
              className="mt-1"
            />
          </div>
        )}
      </main>

      <div className="fixed bottom-0 inset-x-0 z-30 border-t bg-background/95 backdrop-blur pb-safe">
        <div className="mx-auto max-w-2xl px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{itemCount} item{itemCount === 1 ? '' : 's'} selected</span>
            <span className="font-heading font-bold">Est. ${estimatedTotal.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-11"
              disabled={placing || itemCount === 0}
              onClick={() => { setFulfillmentType('pickup'); handlePlaceOrder('pickup'); }}
            >
              <Store className="h-4 w-4" /> Pickup
            </Button>
            <Button
              className="h-11"
              disabled={placing || itemCount === 0}
              onClick={() => { setFulfillmentType('delivery'); handlePlaceOrder('delivery'); }}
            >
              {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} Delivery
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}