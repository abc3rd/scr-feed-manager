import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import OrderStatusBadge from '@/components/OrderStatusBadge';
import FulfillmentProgress from '@/components/FulfillmentProgress';
import { Package, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Orders() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [ticketsByOrder, setTicketsByOrder] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    loadOrders();
  }, [isAuthenticated]);

  const loadOrders = async () => {
    try {
      const myOrders = await base44.entities.Order.filter({ user_id: user.id }, '-created_date', 50);
      setOrders(myOrders);
      const ticketMap = {};
      await Promise.all(myOrders.map(async (o) => {
        const tickets = await base44.entities.PickTicket.filter({ order_id: o.id }, '-created_date', 20);
        ticketMap[o.id] = tickets;
      }));
      setTicketsByOrder(ticketMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadOrders();
    } finally {
      setRefreshing(false);
    }
  };

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-xl">My Orders</h2>
        <button onClick={refresh} className="text-muted-foreground hover:text-foreground p-1" aria-label="Refresh orders">
          <RotateCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </button>
      </div>
      {orders.map(order => {
        const tickets = ticketsByOrder[order.id] || [];
        return (
          <Link key={order.id} to={`/orders/${order.id}`}>
            <Card className="p-4 space-y-3 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{order.order_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.created_date).toLocaleDateString()}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>
              <FulfillmentProgress tickets={tickets} />
              <div className="flex justify-between text-sm pt-1">
                <span className="text-muted-foreground">{order.items?.length || 0} item(s)</span>
                <span className="font-medium">${Number(order.total).toFixed(2)}</span>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}