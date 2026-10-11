/**
 * NumeriFlow — Start a payment (create-checkout.js)
 *
 * Creates a ONE-OFF Stripe Checkout Session (mode: payment) for 1 month or
 * 1 year of Pro. No subscription is created and no card is saved, so virtual /
 * disposable cards work exactly like any other one-off purchase.
 *
 * Returns { url } — the frontend redirects to it. A brand-new session is made
 * on every call, so there is never an expired link: the Billing tab simply
 * calls this again.
 *
 * Access is granted by stripe-webhook.js when the payment is confirmed.
 */
const { SITE_URL, PLANS, getSupabaseUser, getProfile, patchProfile, stripePost } = require('../lib/billing');

const json = (statusCode, obj) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!process.env.STRIPE_SECRET_KEY || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('[create-checkout] Missing required env vars');
    return json(500, { error: 'Server misconfigured — required env vars missing' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON body' }); }

  const { plan, accessToken } = body;
  if (!PLANS[plan]) return json(400, { error: 'plan must be "monthly" or "annual"' });
  if (!accessToken) return json(401, { error: 'Missing accessToken' });

  const user = await getSupabaseUser(accessToken);
  if (!user?.id) return json(401, { error: 'Invalid or expired session' });

  try {
    // Reuse the Stripe customer if there is one (keeps a person's payments together).
    const profile = await getProfile('id=eq.' + user.id);
    let customerId = profile?.stripe_customer_id || null;
    if (!customerId) {
      const customer = await stripePost('/customers', {
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await patchProfile(user.id, { stripe_customer_id: customerId });
    }

    const p = PLANS[plan];
    const session = await stripePost('/checkout/sessions', {
      mode: 'payment',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{
        quantity: 1,
        price_data: { currency: 'gbp', unit_amount: p.amount, product_data: { name: p.name } },
      }],
      metadata: { plan, supabase_user_id: user.id },
      payment_intent_data: { metadata: { plan, supabase_user_id: user.id } },
      success_url: SITE_URL + '/dashboard.html?paid=1',
      cancel_url:  SITE_URL + '/dashboard.html?billing=1',
    });

    if (!session.url) throw new Error('Stripe did not return a checkout link');
    return json(200, { url: session.url });
  } catch (e) {
    console.error('[create-checkout] Error:', e.message);
    return json(500, { error: e.message });
  }
};
