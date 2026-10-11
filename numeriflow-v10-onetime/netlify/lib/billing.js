/**
 * NumeriFlow — shared billing helpers (used by create-checkout, stripe-webhook,
 * billing-status and billing-cron).
 *
 * Payment model: ONE-OFF payments only. No Stripe subscriptions, no saved cards.
 * Each payment buys a fixed period (1 month / 1 year). profiles.paid_until holds
 * the date access runs to. A daily job reminds people and, after a short grace
 * period, moves lapsed accounts back to freemium (data is never deleted).
 */

const SUPABASE_URL  = 'https://agifyxyoktsivnjoemxu.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnaWZ5eHlva3RzaXZuam9lbXh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NzIzODUsImV4cCI6MjA5ODI0ODM4NX0.JuMLFPzbg5S8WBzye10roF40Pgpxp-ZZIZfx6m7tfeQ';

const SITE_URL = 'https://numeriflow.uk';
const GRACE_DAYS = 3;
const REMINDER_DAYS = 7;
const COPY_TO = 'saira.mohsin@numeriflow.uk';

// Pence. Early-bird pricing ended 31 Aug 2026.
const PLANS = {
  monthly: { name: 'NumeriFlow Pro — 1 month', amount: 600,  months: 1  },
  annual:  { name: 'NumeriFlow Pro — 1 year',  amount: 3500, months: 12 },
};

const env = () => ({
  SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  STRIPE_KEY:  process.env.STRIPE_SECRET_KEY,
});

// ── Dates ──────────────────────────────────────────────────────────
function addMonths(date, n) {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

// New paid_until after a payment: extends from the current expiry if still in
// the future (paying early never loses time), otherwise from now.
function extendPaidUntil(currentIso, months, now = new Date()) {
  const cur = currentIso ? new Date(currentIso) : null;
  const base = cur && cur > now ? cur : now;
  return addMonths(base, months);
}

// ── Supabase (service role) ────────────────────────────────────────
function sbHeaders(extra) {
  const { SERVICE_KEY } = env();
  return Object.assign({ apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY }, extra || {});
}

async function getSupabaseUser(accessToken) {
  const res = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + accessToken },
  });
  if (!res.ok) return null;
  return res.json();
}

async function getProfile(filter) {
  const res = await fetch(
    SUPABASE_URL + '/rest/v1/profiles?' + filter +
    '&select=id,name,plan,stripe_customer_id,paid_until,last_payment_ref,last_reminder_key',
    { headers: sbHeaders() }
  );
  if (!res.ok) throw new Error('Profile lookup failed: ' + res.status);
  const rows = await res.json();
  return rows?.[0] || null;
}

async function patchProfile(id, patch) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/profiles?id=eq.' + id, {
    method: 'PATCH',
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Profile update failed: ' + res.status + ' ' + (await res.text()));
}

async function getAuthEmail(userId) {
  const res = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + userId, { headers: sbHeaders() });
  if (!res.ok) return null;
  const u = await res.json();
  return u?.email || null;
}

// ── Stripe ─────────────────────────────────────────────────────────
function flatten(obj, prefix, body) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item && typeof item === 'object') flatten(item, `${key}[${i}]`, body);
        else body.append(`${key}[${i}]`, item);
      });
    } else if (v && typeof v === 'object') {
      flatten(v, key, body);
    } else if (v !== undefined && v !== null) {
      body.append(key, v);
    }
  }
}

async function stripeGet(path) {
  const res = await fetch('https://api.stripe.com/v1' + path, {
    headers: { Authorization: 'Bearer ' + env().STRIPE_KEY },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Stripe error ${res.status}`);
  return data;
}

async function stripePost(path, params) {
  const body = new URLSearchParams();
  flatten(params, '', body);
  const res = await fetch('https://api.stripe.com/v1' + path, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + env().STRIPE_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Stripe error ${res.status}`);
  return data;
}

module.exports = {
  SITE_URL, GRACE_DAYS, REMINDER_DAYS, COPY_TO, PLANS,
  SUPABASE_URL, SUPABASE_ANON,
  addMonths, extendPaidUntil,
  getSupabaseUser, getProfile, patchProfile, getAuthEmail,
  stripeGet, stripePost,
};
