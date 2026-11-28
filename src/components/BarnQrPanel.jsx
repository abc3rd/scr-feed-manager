import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BadgeCheck, ShieldAlert, ShieldCheck, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// What a Barn QR's status (barn-qr-status) means for whoever is looking:
// the Member, someone signed in to a different account, or staff at the counter.

const signInPath = (token) => `/login?returnTo=${encodeURIComponent(`/barn/${token}`)}`;
const registerPath = (token) => `/register?returnTo=${encodeURIComponent(`/barn/${token}`)}`;

export function StaffCheck({ status }) {
  if (!status?.staff) return null;
  const active = status.status === 'active';
  return (
    <Card className={active ? 'p-3 border-green-600/40 bg-green-50 dark:bg-green-950/30' : 'p-3 border-amber-500/40 bg-amber-50 dark:bg-amber-950/30'}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Staff check</p>
      <p className="font-medium mt-0.5">{status.staff.name || 'No name given'}</p>
      <p className="text-sm text-muted-foreground">{status.staff.email}</p>
      <p className="text-sm mt-1 flex items-center gap-1">
        {active ? <ShieldCheck className="h-4 w-4 text-green-700" /> : <Clock className="h-4 w-4 text-amber-700" />}
        {active ? 'Linked to their account. Good to go.' : 'Not activated yet. Have them sign in with this email on their phone.'}
      </p>
    </Card>
  );
}

// Shown on the Barn Profile above the quick-order list.
export function BarnQrBadge({ status }) {
  if (!status) return null;
  if (status.mine) {
    return (
      <Card className="p-3 flex items-center gap-3 border-green-600/40 bg-green-50 dark:bg-green-950/30">
        <BadgeCheck className="h-5 w-5 text-green-700 shrink-0" />
        <div>
          <p className="text-sm font-medium">{status.just_activated ? 'Your barn QR is activated' : 'This is your barn QR'}</p>
          <p className="text-sm text-muted-foreground">{status.code} · linked to your account</p>
        </div>
      </Card>
    );
  }
  if (status.wrong_account && status.status === 'active') {
    return (
      <Card className="p-3 flex gap-3 border-destructive/40 bg-destructive/5">
        <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">This barn QR belongs to another Stars Club member</p>
          <p className="text-sm text-muted-foreground">Orders here won't go through on your account. Scan your own barn QR, or ask at the counter.</p>
        </div>
      </Card>
    );
  }
  return null;
}

// Shown instead of the Barn Profile when the Barn QR was emailed but is not linked yet.
export function ActivateBarnQr({ token, status, navigate }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center max-w-md mx-auto">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">SCR Stars Club · Barn QR</p>
      <h1 className="font-heading font-bold text-xl">{status.wrong_account ? 'Signed in with a different email' : 'Activate your barn QR'}</h1>
      <p className="text-sm text-muted-foreground">
        {status.wrong_account
          ? `Barn QR ${status.code} was sent to ${status.sent_to}. Sign out, then sign in with that email to link it to you.`
          : `Barn QR ${status.code} was sent to ${status.sent_to}. Sign in or create your account with that same email to link it to you. It takes a minute.`}
      </p>
      {status.wrong_account ? (
        <Button className="h-11 w-full" onClick={() => base44.auth.logout(`/barn/${token}`)}>Sign out</Button>
      ) : (
        <div className="grid grid-cols-2 gap-2 w-full">
          <Button variant="outline" className="h-11" onClick={() => navigate(signInPath(token))}>Sign in</Button>
          <Button className="h-11" onClick={() => navigate(registerPath(token))}>Create account</Button>
        </div>
      )}
      <StaffCheck status={status} />
      <p className="text-xs text-muted-foreground">Only you can order from your barn QR, and only while you're signed in.</p>
    </div>
  );
}
