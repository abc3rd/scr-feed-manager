import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

// GoHighLevel is not a built-in connector, so we call its REST API directly
// with a Private Integration API key. Each new order is pushed as a contact
// (for membership/lead tracking) and an opportunity (for pipeline lead tracking).
//
// Called by the "GHL Order Sync" workflow on every Order create. Because the
// endpoint is public, it requires an admin session (the workflow runs as one).

const GHL_BASE = 'https://rest.gohighlevel.com/v1';
const GHL_VERSION = '2021-07-28';

function splitName(full: string | null | undefined) {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '' };
}

function ghlHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Version: GHL_VERSION,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);

    // Admin gate — only the workflow (running as an app admin) should call this.
    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { order_id } = await req.json().catch(() => ({}));
    if (!order_id) return Response.json({ error: 'order_id is required' }, { status: 400 });

    const apiKey = secrets.get('GHL_API_KEY');
    const locationId = secrets.get('GHL_LOCATION_ID');
    if (!apiKey || !locationId) {
      return Response.json({ error: 'GoHighLevel credentials are not configured. Set GHL_API_KEY and GHL_LOCATION_ID in Secrets.' }, { status: 500 });
    }

    // Load the order and, when it belongs to a member, the member's contact info.
    const order: any = await base44.asServiceRole.entities.Order.get(order_id)
      .catch((e: any) => (e.status === 404 ? null : Promise.reject(e)));
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    let member: any = null;
    if (order.user_id) {
      member = await base44.asServiceRole.entities.User.get(order.user_id).catch(() => null);
    }
    const email = member?.email || null;
    if (!email) {
      // GHL needs an email to upsert a contact; guest orders without one can't be tracked here.
      return Response.json({ skipped: true, reason: 'No member email on this order', order_id });
    }
    const { firstName, lastName } = splitName(member?.full_name);

    // 1. Upsert the contact (creates or updates by email under this location).
    const contactRes = await fetch(`${GHL_BASE}/contacts/upsert`, {
      method: 'POST',
      headers: ghlHeaders(apiKey),
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        locationId,
        contact: {
          firstName,
          lastName,
          name: member?.full_name || `${firstName} ${lastName}`.trim(),
          email,
          source: 'SCR Feed App',
          tags: ['SCR Customer', 'Online Order'],
        },
      }),
    });
    if (!contactRes.ok) {
      const detail = await contactRes.text();
      return Response.json({ error: 'GoHighLevel contact upsert failed', status: contactRes.status, detail }, { status: 502 });
    }
    const contactData = await contactRes.json();
    const contactId: string | null = contactData?.contact?.id || contactData?.contactId || null;

    // 2. Create an opportunity for lead tracking (best-effort — pipeline config varies per account).
    let opportunity: any = null;
    if (contactId) {
      try {
        const title = `SCR ${order.order_number || order_id.slice(-8).toUpperCase()} — $${Number(order.total || 0).toFixed(2)}`;
        const oppRes = await fetch(`${GHL_BASE}/opportunities/`, {
          method: 'POST',
          headers: ghlHeaders(apiKey),
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            title,
            status: 'open',
            contactId,
            locationId,
            monetaryValue: Number(order.total || 0),
          }),
        });
        if (oppRes.ok) opportunity = await oppRes.json();
      } catch (oppError) {
        // A contact was still upserted; opportunity failure is non-fatal.
        opportunity = { error: (oppError as Error).message };
      }
    }

    return Response.json({
      ok: true,
      order_id,
      contact_id: contactId,
      opportunity_created: !!opportunity && !opportunity.error,
    });
  } catch (error) {
    console.error('sync-order-to-ghl error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}