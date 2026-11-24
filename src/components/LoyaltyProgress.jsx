import React from 'react';
import { membershipLabel } from '@/lib/loyalty';

// Stars Club summary: Stars earned and what the membership gives.
// Stars are never a discount (ADR 0001, syncloudconnect-main).
export default function LoyaltyProgress({ user }) {
  const paid = user?.membership === 'paid';
  return (
    <div className="rounded-lg border bg-card p-4 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{membershipLabel(user)}</span>
        <span className="text-sm text-muted-foreground">{Math.round(user?.lifetime_points || 0)} Stars earned</span>
      </div>
      <p className="text-sm text-muted-foreground">
        {paid
          ? 'Your membership includes priority delivery. Keep earning Stars on every order.'
          : 'Earn a Star for every dollar. Paid Members also get priority delivery.'}
      </p>
    </div>
  );
}
