import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { membershipLabel } from '@/lib/loyalty';

export default function LoyaltyBadge({ user }) {
  const paid = user?.membership === 'paid';
  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-medium',
      paid
        ? 'text-yellow-700 bg-yellow-50 border-yellow-200 dark:text-yellow-300 dark:bg-yellow-950/40 dark:border-yellow-700'
        : 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-200 dark:bg-slate-800/60 dark:border-slate-600'
    )}>
      <Star className="h-3 w-3 fill-current" />
      <span>{membershipLabel(user)}</span>
      <span className="opacity-50">·</span>
      <span>{Number(user?.loyalty_points || 0)} Stars</span>
    </div>
  );
}
