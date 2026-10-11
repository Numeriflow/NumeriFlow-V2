/**
 * NumeriFlow — Stripe Webhook Handler (one-off payment model)
 *
 * In Stripe Dashboard → Developers → Webhooks, enable these events:
 *   checkout.session.completed
 *   checkout.session.async_payment_succeeded
 *   invoice_payment.paid      (only matters for the one genuine auto-charging subscriber
 *                              and any old invoice someone pays late)
 * Everything else is ignored. In particular subscription events no longer
 * change anyone's plan: expiry is handled by the daily billing-cron job from
 * profiles.paid_until, so cancelling a Stripe subscription can never
 * downgrade an account by accident.
 *
 * Each payment is applied exactly once (profiles.last_payment_ref), so
 * Stripe re-delivering an event cannot add time twice.
 */
const crypto = require('crypto');
const { PLANS, getProfile, patchProfile, stripeGet, extendPaidUntil, addMonths } = require('../lib/billing');

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function verifyStripeSignature(body, header, secret, toleranceSec = 600) {
  if (!header) return false;
  const parts = {};
  for (const p of header.split(',')) { const i = p.indexOf('='); parts[p.slice(0, i)] = p.slice(i + 1); }
  if (!parts.t || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > toleranceSec) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${body}`).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Apply one payment to a profile, once.
async function applyPayment({ profile, plan, months, paidUntil, ref, customerId }) {
  if (!profile) { console.warn('[Webhook] No matching profile for payment', ref); return false; }
  if (profile.last_payment_ref === ref) {
    console.log('[Webhook] Payment already applied, skipping', ref);
    return true;
  }
  const until = paidUntil || extendPaidUntil(profile.paid_until, months);
  // Topping up with a monthly payment while an annual period is still running
  // keeps the account labelled annual.
  const keepAnnual = profile.plan === 'annual' && profile.paid_until && new Date(profile.paid_until) > new Date();
  const patch = {
    plan: keepAnnual ? 'annual' : plan,
    paid_until: until.toISOString(),
    last_payment_ref: ref,
    last_reminder_key: null,
  };
  if (customerId && !profile.stripe_customer_id) patch.stripe_customer_id = customerId;
  await patchProfile(profile.id, patch);
  console.log(`[Webhook] ${profile.id} → ${patch.plan} until ${patch.paid_until} (ref ${ref})`);
  return true;
}

async function handleCheckoutSession(session) {
  if (session.mode !== 'payment') return;               // we only sell one-off payments
  if (session.payment_status !== 'paid') return;        // wait for async_payment_succeeded
  const plan = session.metadata?.plan;
  if (!PLANS[plan]) { console.warn('[Webhook] Session without a valid plan', session.id); return; }
  const userId = session.client_reference_id || session.metadata?.supabase_user_id;
  const profile = userId
    ? await getProfile('id=eq.' + userId)
    : session.customer ? await getProfile('stripe_customer_id=eq.' + session.customer) : null;
  await applyPayment({
    profile, plan, months: PLANS[plan].months, ref: session.id, customerId: session.customer,
  });
}

// Genuine subscription invoices (e.g. the one auto-charging customer) and any
// old invoice paid late: grant access to the end of the period that was paid.
async function handleInvoicePaid(invoiceId) {
  const invoice = await stripeGet(`/invoices/${invoiceId}`);
  if (!invoice.customer) return;
  const line = invoice.lines?.data?.[0];
  const periodEnd = line?.period?.end ? new Date(line.period.end * 1000) : null;
  const interval = line?.price?.recurring?.interval || line?.plan?.interval;
  const plan = (invoice.subscription_details?.metadata?.plan || line?.metadata?.plan ||
               (interval === 'year' ? 'annual' : 'monthly'));
  const months = plan === 'annual' ? 12 : 1;
  const profile = await getProfile('stripe_customer_id=eq.' + invoice.customer);
  // Never shorten access: use the later of the paid period's end and a normal extension.
  let paidUntil = periodEnd && periodEnd > new Date() ? periodEnd : null;
  if (!paidUntil) paidUntil = addMonths(new Date(), months);
  if (profile?.paid_until && new Date(profile.paid_until) > paidUntil) paidUntil = new Date(profile.paid_until);
  await applyPayment({ profile, plan, months, paidUntil, ref: invoice.id, customerId: invoice.customer });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  if (WEBHOOK_SECRET) {
    let ok = false;
    try { ok = verifyStripeSignature(event.body, event.headers['stripe-signature'], WEBHOOK_SECRET); } catch { ok = false; }
    if (!ok) { console.error('[Webhook] Invalid Stripe signature'); return { statusCode: 401, body: 'Invalid signature' }; }
  } else {
    console.warn('[Webhook] STRIPE_WEBHOOK_SECRET not set — signature NOT verified');
  }

  let evt;
  try { evt = JSON.parse(event.body); } catch { return { statusCode: 400, body: 'Invalid JSON' }; }
  const { type, data } = evt;
  console.log('[Webhook] Received:', type);

  try {
    switch (type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await handleCheckoutSession(data.object);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(data.object.id);
        break;
      case 'invoice_payment.paid':
        if (data.object.invoice) await handleInvoicePaid(data.object.invoice);
        break;
      default:
        console.log('[Webhook] Ignored event type:', type);
    }
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (e) {
    console.error('[Webhook] Error processing event:', e.message);
    // 500 makes Stripe retry later; applyPayment is idempotent so retries are safe.
    return { statusCode: 500, body: JSON.stringify({ received: false, error: e.message }) };
  }
};
