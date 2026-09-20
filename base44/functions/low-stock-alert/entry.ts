import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Block direct invocation by non-staff users. Scheduled workflow runs have
    // no authenticated user and are allowed to proceed.
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin' && user.role !== 'staff') {
        return Response.json({ error: 'Only staff can trigger stock alerts' }, { status: 403 });
      }
    } catch {
      // No authenticated user (scheduled run) — continue.
    }

    // Find products at or below their reorder threshold (available = stock - reserved).
    const products = await base44.asServiceRole.entities.Product.list('-created_date', 500);
    const lowStock = products.filter(p => {
      const threshold = Number(p.reorder_threshold || 0);
      if (threshold <= 0) return false;
      const available = Number(p.stock_quantity || 0) - Number(p.reserved_quantity || 0);
      return available <= threshold;
    });

    if (lowStock.length === 0) {
      return Response.json({ success: true, alert_count: 0, message: 'No products below reorder threshold.' });
    }

    // Notify all admin users.
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' }, '-created_date', 50);
    const recipients = admins.map(a => a.email).filter(Boolean);

    const lines = lowStock.map(p => {
      const available = Number(p.stock_quantity || 0) - Number(p.reserved_quantity || 0);
      return `• ${p.name} — ${available} available (reorder at ${p.reorder_threshold})`;
    }).join('\n');

    const subject = `Low stock alert: ${lowStock.length} product(s) need restocking`;
    const body = `The following products have fallen to or below their reorder threshold and should be restocked:\n\n${lines}\n\n— SCR Feed Manager`;

    for (const to of recipients) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body });
      } catch (e) {
        console.error(`Failed to email ${to}:`, e.message);
      }
    }

    return Response.json({
      success: true,
      alert_count: lowStock.length,
      notified: recipients.length,
      products: lowStock.map(p => p.name)
    });
  } catch (error) {
    console.error('low-stock-alert error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}