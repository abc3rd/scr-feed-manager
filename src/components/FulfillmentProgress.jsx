import React from 'react';
import { Progress } from '@/components/ui/progress';

export default function FulfillmentProgress({ tickets }) {
  let totalRequested = 0;
  let totalVerified = 0;
  for (const ticket of tickets || []) {
    for (const item of ticket.pick_items || []) {
      totalRequested += Number(item.requested_quantity || 0);
      totalVerified += Number(item.verified_quantity || 0);
    }
  }
  const percent = totalRequested > 0 ? Math.round((totalVerified / totalRequested) * 100) : 0;
  const done = percent >= 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={done ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
          {done ? 'Fully picked' : `${totalVerified} of ${totalRequested} units picked`}
        </span>
        <span className="font-medium">{percent}%</span>
      </div>
      <Progress value={percent} className="h-2" />
    </div>
  );
}