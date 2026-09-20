import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { TrendingUp, Package, DollarSign, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import PullToRefresh from '@/components/PullToRefresh';

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day; // Sunday start
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function Sales() {
  const { user } = useAuth();
  const isStaff = user && (user.role === 'admin' || user.role === 'staff');

  const query = useQuery({
    queryKey: ['sales', 'orders-products'],
    queryFn: async () => {
      const [orders, products] = await Promise.all([
        base44.entities.Order.list('-created_date', 500),
        base44.entities.Product.list('-created_date', 200),
      ]);
      return { orders, products };
    },
    enabled: !!isStaff,
  });

  if (!isStaff) {
    return <div className="text-center py-20 text-muted-foreground">Staff access required.</div>;
  }
  if (query.isLoading) {
    return <div className="text-center py-20 text-muted-foreground">Loading sales…</div>;
  }

  const orders = query.data?.orders || [];
  const products = query.data?.products || [];

  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  const weeklyOrders = orders.filter(o => new Date(o.created_date) >= new Date(weekStart.getTime() - weekMs + 1));
  const weeklyCount = weeklyOrders.length;
  const weeklyRevenue = weeklyOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  const allTimeRevenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  // Top products by units sold across all orders.
  const productTotals = {};
  for (const o of orders) {
    for (const item of o.items || []) {
      const key = item.product_id || item.name;
      const entry = (productTotals[key] ||= { name: item.name, units: 0, revenue: 0 });
      entry.units += Number(item.quantity || 0);
      entry.revenue += Number(item.line_total || 0);
    }
  }
  const topProducts = Object.values(productTotals).sort((a, b) => b.units - a.units).slice(0, 5);

  const lowStock = products.filter(p => p.reorder_threshold > 0 && (p.stock_quantity - (p.reserved_quantity || 0)) <= p.reorder_threshold);

  const refresh = () => query.refetch();

  return (
    <PullToRefresh onRefresh={refresh}>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold text-xl">Sales Dashboard</h2>
          <button onClick={refresh} className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Refresh sales">
            <RotateCw className={cn('h-4 w-4', query.isFetching && 'animate-spin')} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span className="text-sm">Weekly Orders</span>
            </div>
            <p className="text-2xl font-bold">{weeklyCount}</p>
            <p className="text-sm text-muted-foreground">last 7 days</p>
          </Card>
          <Card className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">Weekly Revenue</span>
            </div>
            <p className="text-2xl font-bold">${weeklyRevenue.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">all-time ${allTimeRevenue.toFixed(2)}</p>
          </Card>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <h3 className="font-semibold">Top Products</h3>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <Card key={i} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-sm text-muted-foreground">{p.units} units · ${p.revenue.toFixed(2)}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold">Low Stock Alerts</h3>
          {lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">All products above reorder threshold.</p>
          ) : (
            <div className="space-y-2">
              {lowStock.map(p => (
                <Card key={p.id} className="p-3 flex items-center justify-between">
                  <p className="text-sm font-medium">{p.name}</p>
                  <span className="text-sm text-amber-700 dark:text-amber-300">
                    {p.stock_quantity - (p.reserved_quantity || 0)} left (reorder at {p.reorder_threshold})
                  </span>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}