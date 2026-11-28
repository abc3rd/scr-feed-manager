import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import QRCode from 'npm:qrcode@1.5.4';

// Stars Club Join (n8n) -> issue the new Member's Barn QR, so the welcome
// email can carry it. One Barn QR per email: joining again returns the same one.
//
// A Barn QR only opens the Member's quick-order page. Ordering from it still
// needs the Member signed in with the email it was sent to (see
// barn-qr-status and create-checkout-session), so a mistyped or photographed
// code can never place an order under someone else's name.

export const APP_URL = 'https://app.scrfeed.com';
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O, 1/I/L: easy to read out at the counter

export const normalizeEmail = (e: unknown) => String(e ?? '').trim().toLowerCase();
export const barnUrl = (code: string) => `${APP_URL}/barn/${encodeURIComponent(code)}`;

export function newBarnQrCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  let s = '';
  for (const b of random(6)) s += ALPHABET[b % ALPHABET.length];
  return `SCR-${s}`;
}

async function qrImageUrl(base44: any, code: string) {
  try {
    const png = await QRCode.toBuffer(barnUrl(code), { type: 'png', width: 400, margin: 2, errorCorrectionLevel: 'M' });
    const file = new File([png], `barn-qr-${code}.png`, { type: 'image/png' });
    const up = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    return up?.file_url || '';
  } catch (err) {
    console.error('issue-barn-qr: QR image failed', err);
    return '';
  }
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const key = Deno.env.get('STARS_ISSUE_KEY');
    if (!key || req.headers.get('x-stars-key') !== key) {
      return Response.json({ error: 'Not allowed' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email).slice(0, 200);
    const name = String(body?.name ?? '').trim().slice(0, 120);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'A valid email is required' }, { status: 400 });
    }

    const Members = base44.asServiceRole.entities.StarsMember;
    const existing = (await Members.filter({ email }))[0];
    if (existing) {
      let url = existing.qr_image_url;
      if (!url) {
        url = await qrImageUrl(base44, existing.code);
        if (url) await Members.update(existing.id, { qr_image_url: url });
      }
      return Response.json({ code: existing.code, barn_url: barnUrl(existing.code), qr_image_url: url, status: existing.status, already_member: true });
    }

    let code = '';
    for (let i = 0; i < 6 && !code; i++) {
      const c = newBarnQrCode();
      const taken = (await Members.filter({ code: c })).length || (await base44.asServiceRole.entities.User.filter({ barn_qr_id: c })).length;
      if (!taken) code = c;
    }
    if (!code) return Response.json({ error: 'Could not pick a free code, try again' }, { status: 500 });

    const url = await qrImageUrl(base44, code);
    await Members.create({
      code,
      email,
      name,
      status: 'issued',
      qr_image_url: url,
      issued_at: new Date().toISOString(),
      activated_at: null,
      user_id: null,
      source: String(body?.source ?? 'stars.scrfeed.com').slice(0, 80),
    });
    return Response.json({ code, barn_url: barnUrl(code), qr_image_url: url, status: 'issued', already_member: false });
  } catch (error) {
    console.error('issue-barn-qr error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
