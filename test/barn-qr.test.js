import { describe, it, expect, beforeEach } from 'vitest';
import { useFakeBase44 } from './fakes/base44-sdk.js';
import issue, { newBarnQrCode, barnUrl } from '../base44/functions/issue-barn-qr/entry.ts';
import status, { maskEmail } from '../base44/functions/barn-qr-status/entry.ts';

const post = (body, headers = {}) => new Request('http://x/fn', { method: 'POST', headers, body: JSON.stringify(body) });
const KEY = { 'x-stars-key': 'k' };

beforeEach(() => {
  globalThis.Deno = { env: { get: (n) => ({ STARS_ISSUE_KEY: 'k' }[n]) } };
});

describe('Barn QR codes', () => {
  it('are SCR- plus six easy-to-read characters', () => {
    expect(newBarnQrCode()).toMatch(/^SCR-[2-9A-HJKMNP-Z]{6}$/);
    expect(barnUrl('SCR-ABC234')).toBe('https://app.scrfeed.com/barn/SCR-ABC234');
  });
  it('masks the email they were sent to', () => {
    expect(maskEmail('jane.doe@gmail.com')).toBe('j••••@gmail.com');
    expect(maskEmail('al@x.com')).toBe('a•@x.com');
  });
});

describe('issue-barn-qr', () => {
  it('turns away callers without the key', async () => {
    useFakeBase44();
    const res = await issue(post({ name: 'Jane', email: 'jane@x.com' }));
    expect(res.status).toBe(403);
  });

  it('issues one Barn QR per email, even when they join twice', async () => {
    const db = useFakeBase44();
    const a = await (await issue(post({ name: 'Jane', email: 'Jane@X.com ' }, KEY))).json();
    const b = await (await issue(post({ name: 'Jane D', email: 'jane@x.com' }, KEY))).json();
    expect(a.code).toMatch(/^SCR-/);
    expect(b.code).toBe(a.code);
    expect(b.already_member).toBe(true);
    expect(db.rows('StarsMember')).toHaveLength(1);
    expect(db.rows('StarsMember')[0]).toMatchObject({ email: 'jane@x.com', status: 'issued' });
  });
});

describe('barn-qr-status', () => {
  const jane = { id: 'u1', role: 'customer', email: 'jane@x.com', full_name: 'Jane Doe' };
  const bob = { id: 'u2', role: 'customer', email: 'bob@x.com', full_name: 'Bob' };
  const staff = { id: 's1', role: 'staff', email: 'yard@scr.test' };

  async function issued(db) {
    return (await (await issue(post({ name: 'Jane Doe', email: 'jane@x.com' }, KEY))).json()).code;
  }

  it('asks a signed-out visitor to sign in with the email it was sent to', async () => {
    const db = useFakeBase44();
    const code = await issued(db);
    const out = await (await status(post({ code }))).json();
    expect(out).toMatchObject({ status: 'issued', signed_in: false, sent_to: 'j•••@x.com' });
    expect(out.staff).toBeUndefined();
  });

  it('links the Barn QR to the member who signs in with that email', async () => {
    const db = useFakeBase44({ users: [jane] });
    const code = await issued(db);
    db.signIn(jane);
    const out = await (await status(post({ code }))).json();
    expect(out).toMatchObject({ status: 'active', mine: true, just_activated: true });
    expect(db.user('u1').barn_qr_id).toBe(code);
    expect(db.rows('StarsMember')[0]).toMatchObject({ status: 'active', user_id: 'u1' });
  });

  it('never links it to a different account', async () => {
    const db = useFakeBase44({ users: [jane, bob] });
    const code = await issued(db);
    db.signIn(bob);
    const out = await (await status(post({ code }))).json();
    expect(out).toMatchObject({ status: 'issued', mine: false, wrong_account: true });
    expect(db.user('u2').barn_qr_id).toBeUndefined();
  });

  it('shows staff who the Barn QR belongs to', async () => {
    const db = useFakeBase44({ users: [jane] });
    const code = await issued(db);
    db.signIn(staff);
    const out = await (await status(post({ code }))).json();
    expect(out.staff).toMatchObject({ name: 'Jane Doe', email: 'jane@x.com' });
    expect(out.status).toBe('issued');
  });

  it('says so when a code is unknown', async () => {
    useFakeBase44();
    const out = await (await status(post({ code: 'SCR-NOPE22' }))).json();
    expect(out.status).toBe('unknown');
  });
});
