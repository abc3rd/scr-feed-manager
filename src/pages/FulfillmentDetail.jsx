import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ArrowLeft, Check } from 'lucide-react';

export default function FulfillmentDetail() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [verified, setVerified] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const ticketQuery = useQuery({
    queryKey: ['pick-ticket', ticketId],
    queryFn: () => base44.entities.PickTicket.get(ticketId),
    enabled: !!ticketId,
  });
  const ticket = ticketQuery.data;

  useEffect(() => {
    if (ticket) {
      const v = {};
      (ticket.pick_items || []).forEach(item => {
        v[item.product_id] = Number(item.verified_quantity || 0);
      });
      setVerified(v);
    }
  }, [ticket?.id]);

  if (ticketQuery.isLoading) {
    return <div className="text-center py-20 text-muted-foreground">Loading ticket…</div>;
  }
  if (!ticket) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-muted-foreground">Ticket not found.</p>
        <Button onClick={() => navigate('/fulfillment')}>Back to queue</Button>
      </div>
    );
  }

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      const verifiedItems = (ticket.pick_items || []).map(item => {
        const qty = Number(verified[item.product_id] || 0);
        const lineStatus = qty >= Number(item.requested_quantity) ? 'verified' : 'short';
        return { product_id: item.product_id, verified_quantity: qty, line_status: lineStatus };
      });
      const res = await base44.functions.invoke('complete-pick-ticket', {
        ticket_id: ticket.id,
        verified_items: verifiedItems,
      });
      const data = res.data;
      toast({
        title: 'Ticket completed',
        description:
          data.order_status === 'completed'
            ? 'Order fully fulfilled & points awarded.'
            : `Order ${data.order_status}. ${data.open_tickets_remaining} ticket(s) remaining.`,
      });
      navigate('/fulfillment');
    } catch (err) {
      toast({
        title: 'Completion failed',
        description: err.response?.data?.error || err.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const items = ticket.pick_items || [];

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/fulfillment')} className="inline-flex items-center gap-1 min-h-11 px-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to tickets
      </button>

      <div>
        <h1 className="font-heading font-bold text-xl">{ticket.ticket_number}</h1>
        <p className="text-sm text-muted-foreground">Verify physical counts before completing.</p>
      </div>

      <Card className="p-4">
        <div className="divide-y">
          {items.map(item => {
            const qty = Number(verified[item.product_id] || 0);
            const short = qty < Number(item.requested_quantity);
            return (
              <div key={item.product_id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex-1">
                  <p className="font-medium text-sm">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Requested: {item.requested_quantity} {item.unit_of_measure}
                  </p>
                  {qty > 0 && short && (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      Short by {item.requested_quantity - qty}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max={item.requested_quantity}
                    value={qty}
                    aria-label="Verified quantity"
                    onChange={e => setVerified(v => ({ ...v, [item.product_id]: Number(e.target.value) }))}
                    className="w-20 text-right"
                  />
                  <span className="text-sm text-muted-foreground w-12">{item.unit_of_measure}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Button className="w-full" size="lg" onClick={handleComplete} disabled={submitting}>
        {submitting ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Completing…</>
        ) : (
          <><Check className="h-4 w-4 mr-2" /> Complete Ticket</>
        )}
      </Button>
    </div>
  );
}