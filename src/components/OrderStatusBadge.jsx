import React from 'react';
import { cn } from '@/lib/utils';

const STYLES = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  ticket_generated: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  picking: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  partially_fulfilled: 'bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
  paid: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300',
  unpaid: 'bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300',
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
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium',
      STYLES[status] || STYLES.unpaid
    )}>
      {LABELS[status] || status}
    </span>
  );
}