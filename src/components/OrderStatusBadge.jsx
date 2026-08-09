import React from 'react';
import { cn } from '@/lib/utils';

const STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  ticket_generated: 'bg-blue-100 text-blue-800',
  picking: 'bg-blue-100 text-blue-800',
  partially_fulfilled: 'bg-violet-100 text-violet-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  paid: 'bg-green-100 text-green-800',
  unpaid: 'bg-gray-100 text-gray-700',
};

const LABELS = {
  pending: 'Pending',
  ticket_generated: 'Ticket Created',
  picking: 'Picking',
  partially_fulfilled: 'Partially Fulfilled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  paid: 'Paid',
  unpaid: 'Unpaid',
};

export default function OrderStatusBadge({ status }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
      STYLES[status] || STYLES.unpaid
    )}>
      {LABELS[status] || status}
    </span>
  );
}