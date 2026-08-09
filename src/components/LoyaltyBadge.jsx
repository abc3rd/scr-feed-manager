import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIER_STYLES = {
  bronze: 'text-amber-700 bg-amber-50 border-amber-200',
  silver: 'text-slate-600 bg-slate-50 border-slate-200',
  gold: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  platinum: 'text-indigo-700 bg-indigo-50 border-indigo-200',
};

export default function LoyaltyBadge({ tier, points }) {
  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
      TIER_STYLES[tier] || TIER_STYLES.bronze
    )}>
      <Star className="h-3 w-3 fill-current" />
      <span className="capitalize">{tier}</span>
      <span className="opacity-50">·</span>
      <span>{Number(points || 0)} pts</span>
    </div>
  );
}