import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIER_STYLES = {
  bronze: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-800',
  silver: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-200 dark:bg-slate-800/60 dark:border-slate-600',
  gold: 'text-yellow-700 bg-yellow-50 border-yellow-200 dark:text-yellow-300 dark:bg-yellow-950/40 dark:border-yellow-700',
  platinum: 'text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/40 dark:border-indigo-700',
};

export default function LoyaltyBadge({ tier, points }) {
  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-medium',
      TIER_STYLES[tier] || TIER_STYLES.bronze
    )}>
      <Star className="h-3 w-3 fill-current" />
      <span className="capitalize">{tier}</span>
      <span className="opacity-50">·</span>
      <span>{Number(points || 0)} pts</span>
    </div>
  );
}