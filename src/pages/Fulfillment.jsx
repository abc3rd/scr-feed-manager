import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { ClipboardCheck, Loader2, ArrowLeft, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Fulfillment() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [verified, setVerified] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const isStaff = user && (user.role === 'admin' || user.role === 'staff');

  useEffect(() => {
    if (isStaff) loadTickets();
    else setLoading(false);
  }, [isStaff]);

  const loadTickets = async () => {
    try {
      const all = await base44.entities.PickTicket.filter({}, '-created_date', 100);
      setTickets(all.filter(t => t.status === 'open' || t.status === 'in_progress'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openTicket = (ticket) => {
    setSelected(ticket);
    const v = {};
    ticket.pick_items.forEach(item => {
      v[item.product_id] = Number(item.verified_quantity || 0);
    });
    setVerified(v);
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      const verifiedItems = selected.pick_items.map(item => {
        const qty = Number(verified[item.product_id] || 0);
        const lineStatus = qty >= Number(item.requested_quantity) ? 'verified' : 'short';
        return { product_id: item.product_id, verified_quantity: qty, line_status: lineStatus };
      });
      const res = await base44.functions.invoke('complete-pick-ticket', {
        ticket_id: selected.id,
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
      setSelected(null);
      loadTickets();
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

  if (!isAuthenticated) {
    return <div className="text-center py-20 text-muted-foreground">Sign in to access the fulfillment dashboard.</div>;
  }
  if (!isStaff) {
    return <div className="text-center py-20 text-muted-foreground">Staff access required.</div>;
  }
  if (loading) {
    return <div className="text-center py-20 text-muted-foreground">Loading tickets…</div>;
  }

  if (selected) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelected(null)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to tickets
        </button>

        <div>
          <h1 className="font-heading font-bold text-xl">{selected.ticket_number}</h1>
          <p className="text-xs text-muted-foreground">Verify physical counts before completing.</p>
        </div>

        <Card className="p-4">
          <div className="divide-y">
            {selected.pick_items.map(item => {
              const qty = Number(verified[item.product_id] || 0);
              const short = qty < Number(item.requested_quantity);
              return (
                <div key={item.product_id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Requested: {item.requested_quantity} {item.unit_of_measure}
                    </p>
                    {qty > 0 && short && (
                      <p className="text-xs text-amber-600">
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
                      onChange={e => setVerified(v => ({ ...v, [item.product_id]: Number(e.target.value) }))}
                      className="w-20 text-right"
                    />
                    <span className="text-xs text-muted-foreground w-12">{item.unit_of_measure}</span>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-5 w-5" />
        <h2 className="font-heading font-bold text-xl">Fulfillment Queue</h2>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Check className="h-10 w-10 mx-auto mb-2 text-green-500" />
          No open pick tickets. All caught up!
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map(ticket => (
            <Card
              key={ticket.id}
              className="p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openTicket(ticket)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{ticket.ticket_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {ticket.pick_items?.length || 0} item(s) to verify
                  </p>
                </div>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-medium',
                  ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                )}>
                  {ticket.status === 'in_progress' ? 'In Progress' : 'Open'}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}