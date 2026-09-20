import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import OrderStatusBadge from '@/components/OrderStatusBadge';
import FulfillmentProgress from '@/components/FulfillmentProgress';
import { ArrowLeft, Ticket } from 'lucide-react';

const TICKET_STATUS_STYLES = {
  open: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  done: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
};

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const orderQuery = useQuery({
    queryKey: ['order', id],
    queryFn: () => base44.entities.Order.get(id),
    enabled: !!id,
  });
  const ticketsQuery = useQuery({
    queryKey: ['pick-tickets', id],
    queryFn: () => base44.entities.PickTicket.filter({ order_id: id }, '-created_date', 20),
    enabled: !!id,
  });

  const order = orderQuery.data ?? null;
  const tickets = ticketsQuery.data || [];
  const loading = orderQuery.isLoading || ticketsQuery.isLoading;

  if (loading) return <div className="text-center py-20 text-muted-foreground">Loading…</div>;
  if (!order) return (
    <div className="text-center py-20 space-y-4">
      <p className="text-muted-foreground">Order not found.</p>
      <Button onClick={() => navigate('/orders')}>Back to Orders</Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <Link to="/orders" className="inline-flex items-center gap-1 min-h-11 px-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Orders
      </Link>

      <div className="flex justify-between items-start">
        <div>
          <h1 className="font-heading font-bold text-xl">{order.order_number}</h1>
          <p className="text-sm text-muted-foreground">{new Date(order.created_date).toLocaleString()}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <Card className="p-4 space-y-3">
        <h3 className="font-medium text-sm">Fulfillment Progress</h3>
        <FulfillmentProgress tickets={tickets} />
        <p className="text-sm text-muted-foreground">
          {tickets.length} pick ticket(s) · {tickets.filter(t => t.status === 'done').length} completed
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="font-medium text-sm mb-3">Order Items</h3>
        <div className="space-y-2">
          {order.items?.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>{item.quantity}× {item.name}</span>
              <span>${Number(item.line_total).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="border-t mt-3 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span><span>${Number(order.subtotal).toFixed(2)}</span>
          </div>
          {order.discount_amount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span><span>−${Number(order.discount_amount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold pt-1">
            <span>Total</span><span>${Number(order.total).toFixed(2)}</span>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        <h3 className="font-medium text-sm flex items-center gap-1.5">
          <Ticket className="h-4 w-4" /> Pick Tickets
        </h3>
        {tickets.map(ticket => (
          <Card key={ticket.id} className="p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium text-sm">{ticket.ticket_number}</span>
              <span className={`text-sm px-2 py-0.5 rounded-full font-medium capitalize ${TICKET_STATUS_STYLES[ticket.status] || ''}`}>
                {ticket.status.replace('_', ' ')}
              </span>
            </div>
            <div className="space-y-1">
              {ticket.pick_items?.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.name}</span>
                  <span>
                    {Number(item.verified_quantity || 0)} / {item.requested_quantity} {item.unit_of_measure}
                  </span>
                </div>
              ))}
            </div>
            {ticket.verified_at && (
              <p className="text-sm text-muted-foreground pt-1">
                Verified {new Date(ticket.verified_at).toLocaleString()}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}