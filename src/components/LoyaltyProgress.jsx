import React from 'react';
import { getTierProgress } from '@/lib/loyalty';
import { cn } from '@/lib/utils';

const TIER_DOT = {
  bronze: 'bg-amber-400',
  silver: 'bg-slate-300',
  gold: 'bg-yellow-400',
  platinum: 'bg-indigo-400',
};

export default function LoyaltyProgress({ lifetimePoints = 0, tier = 'bronze' }) {
  const info = getTierProgress(lifetimePoints);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', TIER_DOT[info.tier] || TIER_DOT.bronze)} />
          <span className="text-sm font-medium capitalize">{info.tier} tier</span>
        </div>
        <span className="text-sm text-muted-foreground">{Math.round(lifetimePoints)} pts</span>
      </div>

      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${info.progress}%` }}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        {info.atTop
          ? `You've reached the top tier — enjoy your ${Math.round((info.current.discount || 0) * 100)}% discount.`
          : `${info.pointsRemaining} lifetime points to ${info.next.tier} (${Math.round((info.next.discount || 0) * 100)}% off).`}
      </p>
    </div>
  );
}