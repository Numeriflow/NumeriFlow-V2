/**
 * NumeriFlow — Billing Status (billing-status.js)
 * Powers the dashboard Billing tab. Reads the logged-in user's plan and
 * paid_until date from Supabase. No Stripe call is needed: a fresh payment
 * link is created on demand via create-checkout.js when the user clicks Pay,
 * so there is nothing that can expire.
 */
const { getSupabaseUser, getProfile } = require('../lib/billing');

const json = (statusCode, obj) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!process.env.SUPABASE_SERVICE_KEY) return json(500, { error: 'Server misconfigured' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON body' }); }
  if (!body.accessToken) return json(401, { error: 'Missing accessToken' });

  const user = await getSupabaseUser(body.accessToken);
  if (!user?.id) return json(401, { error: 'Invalid or expired session' });

  try {
    const profile = await getProfile('id=eq.' + user.id);
    if (!profile) return json(404, { error: 'Profile not found' });

    const plan = profile.plan || 'freemium';
    const paidUntil = profile.paid_until || null;
    const paidPlan = ['monthly', 'annual'].includes(plan);
    const daysLeft = paidUntil ? Math.ceil((new Date(paidUntil) - new Date()) / 86400000) : null;

    return json(200, {
      plan,
      paidUntil,
      daysLeft,
      // paid plan with no expiry date = legacy account, not yet on dated billing
      legacy: paidPlan && !paidUntil,
      // paid plan whose date has passed but is still inside the grace window
      inGrace: paidPlan && daysLeft !== null && daysLeft <= 0,
    });
  } catch (e) {
    console.error('[billing-status] Error:', e.message);
    return json(500, { error: e.message });
  }
};
