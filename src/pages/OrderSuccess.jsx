import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Package } from 'lucide-react';
import OrderStatusBadge from '@/components/OrderStatusBadge';

export default function OrderSuccess() {
  const [params] = useSearchParams();
  const orderId = params.get('order_id');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    base44.entities.Order.get(orderId)
      .then(setOrder)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orderId]);

  return (
    <div className="text-center py-10 space-y-6">
      <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
      <div>
        <h1 className="font-heading font-bold text-2xl">Order Confirmed</h1>
        <p className="text-muted-foreground mt-1">Thanks for your purchase!</p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading order details…</p>
      ) : order ? (
        <Card className="p-4 text-left space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Order</span>
            <span className="font-medium">{order.order_number}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Status</span>
            <OrderStatusBadge status={order.status} />
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-medium">${Number(order.total).toFixed(2)}</span>
          </div>
        </Card>
      ) : null}

      <div className="bg-muted/50 rounded-lg p-4 text-left text-sm text-muted-foreground">
        <Package className="h-4 w-4 inline mr-1" />
        Your order is now awaiting pick verification at the yard. We'll update the status once your items are pulled and confirmed.
      </div>

      <div className="flex gap-2 justify-center">
        <Button variant="outline" onClick={() => (window.location.href = '/')}>Continue Shopping</Button>
        <Button onClick={() => (window.location.href = '/orders')}>View Orders</Button>
      </div>
    </div>
  );
}