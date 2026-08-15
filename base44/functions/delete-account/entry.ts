import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = base44.asServiceRole;

    // Clean up the user's orders and associated pick tickets
    await admin.entities.PickTicket.deleteMany({ user_id: user.id });
    await admin.entities.Order.deleteMany({ user_id: user.id });

    // Best-effort removal of the user record itself (may be restricted)
    try {
      await admin.entities.User.delete(user.id);
    } catch (e) {
      // User record deletion may be restricted by the platform; data cleanup already completed.
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('delete-account failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}