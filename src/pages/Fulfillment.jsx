import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { ClipboardCheck, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import PullToRefresh from '@/components/PullToRefresh';

export default function Fulfillment() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const isStaff = user && (user.role === 'admin' || user.role === 'staff');

  const ticketsQuery = useQuery({
    queryKey: ['pick-tickets', 'open'],
    queryFn: async () => {
      const all = await base44.entities.PickTicket.filter({}, '-created_date', 100);
      return all.filter(t => t.status === 'open' || t.status === 'in_progress');
    },
    enabled: !!isStaff,
  });

  const tickets = ticketsQuery.data || [];
  const loading = ticketsQuery.isLoading;

  if (!isAuthenticated) {
    return <div className="text-center py-20 text-muted-foreground">Sign in to access the fulfillment dashboard.</div>;
  }
  if (!isStaff) {
    return <div className="text-center py-20 text-muted-foreground">Staff access required.</div>;
  }
  if (loading) {
    return <div className="text-center py-20 text-muted-foreground">Loading tickets…</div>;
  }

  return (
    <PullToRefresh onRefresh={() => ticketsQuery.refetch()}>
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
                onClick={() => navigate(`/fulfillment/${ticket.id}`)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{ticket.ticket_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {ticket.pick_items?.length || 0} item(s) to verify
                    </p>
                  </div>
                  <span className={cn(
                    'text-sm px-2 py-0.5 rounded-full font-medium',
                    ticket.status === 'in_progress'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                  )}>
                    {ticket.status === 'in_progress' ? 'In Progress' : 'Open'}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}