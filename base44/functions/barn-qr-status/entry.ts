import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Who a Barn QR belongs to, and its activation.
// - The Member opens their Barn QR link and signs in with the email it was
//   sent to: that links it to their account (User.barn_qr_id) on the spot.
// - Anyone else signed in sees only that it belongs to another Member.
// - Staff (counter check before the customer leaves) see the owner's name
//   and email, so they can confirm it is the person in front of them.

export const normalizeEmail = (e: unknown) => String(e ?? '').trim().toLowerCase();

export function maskEmail(email: unknown) {
  const [user, domain] = String(email ?? '').split('@');
  if (!user || !domain) return '';
  return `${user[0]}${'•'.repeat(Math.min(Math.max(user.length - 1, 1), 4))}@${domain}`;
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const code = String(body?.code ?? '').trim().slice(0, 64);
    if (!code) return Response.json({ error: 'Missing code' }, { status: 400 });

    let me: any = null;
    try { me = await base44.auth.me(); } catch { /* no session */ }
    const isStaff = !!me && (me.role === 'admin' || me.role === 'staff');

    const issued = (await base44.asServiceRole.entities.StarsMember.filter({ code }))[0] || null;
    let owner = (await base44.asServiceRole.entities.User.filter({ barn_qr_id: code }, '-created_date', 1))[0] || null;
    let justActivated = false;

    // Activate: the signed-in account's verified email is the one the code was sent to.
    if (!owner && issued && me && normalizeEmail(me.email) === normalizeEmail(issued.email)) {
      await base44.asServiceRole.entities.User.update(me.id, { barn_qr_id: code });
      await base44.asServiceRole.entities.StarsMember.update(issued.id, {
        status: 'active',
        user_id: me.id,
        activated_at: new Date().toISOString(),
      });
      owner = { ...me, barn_qr_id: code };
      justActivated = true;
    }

    if (!owner && !issued) return Response.json({ code, status: 'unknown', signed_in: !!me });

    const status = owner ? 'active' : 'issued';
    const mine = !!(me && owner && me.id === owner.id);
    const out: Record<string, unknown> = {
      code,
      status,
      mine,
      just_activated: justActivated,
      signed_in: !!me,
      wrong_account: !!me && !mine,
    };
    if (status === 'issued') out.sent_to = maskEmail(issued.email);
    if (isStaff) {
      out.staff = {
        name: owner?.full_name || issued?.name || '',
        email: owner?.email || issued?.email || '',
        issued_at: issued?.issued_at || null,
        activated_at: issued?.activated_at || (justActivated ? new Date().toISOString() : null),
      };
    }
    return Response.json(out);
  } catch (error) {
    console.error('barn-qr-status error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
