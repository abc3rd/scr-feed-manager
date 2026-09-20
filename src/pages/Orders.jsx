import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCart } from '@/lib/CartContext';
import { useToast } from '@/components/ui/use-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import OrderStatusBadge from '@/components/OrderStatusBadge';
import FulfillmentProgress from '@/components/FulfillmentProgress';
import { Package, RotateCw, Plus, Repeat2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import PullToRefresh from '@/components/PullToRefresh';

function monthKey(d) {
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export default function Orders() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { toast } = useToast();

  const ordersQuery = useQuery({
    queryKey: ['orders', user?.id],
    enabled: !!isAuthenticated && !!user?.id,
    queryFn: async () => {
      const [myOrders, myTickets, products] = await Promise.all([
        base44.entities.Order.filter({ user_id: user.id }, '-created_date', 50),
        base44.entities.PickTicket.filter({ user_id: user.id }, '-created_date', 200),
        base44.entities.Product.list('-created_date', 200),
      ]);
      const ticketMap = {};
      for (const t of myTickets) (ticketMap[t.order_id] ||= []).push(t);
      const stockMap = {};
      for (const p of products) stockMap[p.id] = p;
      return { orders: myOrders, ticketsByOrder: ticketMap, stockMap };
    },
  });

  const orders = ordersQuery.data?.orders || [];
  const ticketsByOrder = ordersQuery.data?.ticketsByOrder || {};
  const stockMap = ordersQuery.data?.stockMap || {};
  const loading = ordersQuery.isLoading;
  const refreshing = ordersQuery.isFetching;
  const refresh = () => ordersQuery.refetch();

  const reorderItem = (item) => {
    const product = stockMap[item.product_id];
    const available = product ? Number(product.stock_quantity || 0) - Number(product.reserved_quantity || 0) : 0;
    if (!product || available <= 0) {
      toast({ title: 'Unavailable', description: `${item.name} is out of stock.`, variant: 'destructive' });
      return;
    }
    addItem({ id: product.id, name: product.name, unit_of_measure: product.unit_of_measure, price: product.price }, 1);
    toast({ title: 'Added to cart', description: item.name });
  };

  const reorderAll = (order) => {
    let added = 0;
    const skipped = [];
    for (const item of (order.items || [])) {
      const product = stockMap[item.product_id];
      const available = product ? Number(product.stock_quantity || 0) - Number(product.reserved_quantity || 0) : 0;
      if (!product || available <= 0) { skipped.push(item.name); continue; }
      addItem({ id: product.id, name: product.name, unit_of_measure: product.unit_of_measure, price: product.price }, Number(item.quantity) || 1);
      added++;
    }
    if (added > 0) {
      toast({
        title: `${added} item${added === 1 ? '' : 's'} added to cart`,
        description: skipped.length ? `Skipped (unavailable): ${skipped.join(', ')}` : undefined,
      });
      navigate('/cart');
    } else {
      toast({ title: 'Nothing to reorder', description: 'All items from this order are unavailable.', variant: 'destructive' });
    }
  };

  const groups = {};
  for (const o of orders) (groups[monthKey(o.created_date)] ||= []).push(o);
  const groupKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  if (!isAuthenticated) {
    return (
      <div className="text-center py-20 space-y-4">
        <Package className="h-12 w-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">Sign in to view your orders.</p>
        <Button onClick={() => navigate('/login')}>Sign In</Button>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-20 text-muted-foreground">Loading orders…</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <Package className="h-12 w-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">No orders yet.</p>
        <Button onClick={() => navigate('/')}>Start Shopping</Button>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={refresh}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold text-xl">My Orders</h2>
          <button onClick={refresh} className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Refresh orders">
            <RotateCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {groupKeys.map((key) => (
          <div key={key} className="space-y-2">
            <div className="sticky top-14 z-10 -mx-1 px-1 py-1 bg-background">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{monthLabel(key)}</p>
            </div>
            {groups[key].map((order) => {
              const tickets = ticketsByOrder[order.id] || [];
              return (
                <Card key={order.id} className="p-4 space-y-3">
                  <Link to={`/orders/${order.id}`} className="block space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{order.order_number}</p>
                        <p className="text-sm text-muted-foreground">{new Date(order.created_date).toLocaleDateString()}</p>
                      </div>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <FulfillmentProgress tickets={tickets} />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{order.items?.length || 0} item(s)</span>
                      <span className="font-medium">${Number(order.total).toFixed(2)}</span>
                    </div>
                  </Link>

                  <div className="space-y-1 pt-2 border-t">
                    {order.items?.map((item, i) => {
                      const product = stockMap[item.product_id];
                      const available = product ? Number(product.stock_quantity || 0) - Number(product.reserved_quantity || 0) : 0;
                      const out = available <= 0;
                      return (
                        <div key={i} className="flex items-center justify-between text-sm gap-2">
                          <span className={cn('flex-1 truncate', out && 'text-muted-foreground line-through')}>
                            {item.quantity}× {item.name}
                          </span>
                          {out ? (
                            <span className="text-xs text-muted-foreground shrink-0">unavailable</span>
                          ) : (
                            <button
                              onClick={() => reorderItem(item)}
                              className="h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-primary shrink-0"
                              aria-label={`Add ${item.name} to cart`}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <Button variant="outline" className="w-full h-11" onClick={() => reorderAll(order)}>
                    <Repeat2 className="h-4 w-4" /> Reorder all
                  </Button>
                </Card>
              );
            })}
          </div>
        ))}
      </div>
    </PullToRefresh>
  );
}