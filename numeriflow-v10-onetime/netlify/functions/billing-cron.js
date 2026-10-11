/**
 * NumeriFlow — Daily billing job (billing-cron.js)
 *
 * Runs once a day (schedule in netlify.toml). For every paid account that has
 * a paid_until date it sends, once per payment cycle:
 *   pre   — 7 days or fewer before expiry: "your access ends on …"
 *   due   — on/after the expiry date: "expired, you have 3 days"
 *   down  — after the 3-day grace period: account moved to the free plan
 * then (for "down") sets plan = freemium. Children's data is never deleted.
 *
 * Every email is BCC'd to Saira. Accounts with no paid_until (legacy
 * accounts) and access-code accounts are never touched.
 *
 * Idempotent: profiles.last_reminder_key records "<expiry date>:<stage>" so
 * running twice, or catching up after a missed day, never double-sends.
 *
 * Manual test (production): GET /.netlify/functions/billing-cron?dry=1 with
 * header x-cron-secret: <CRON_SECRET env var>  → lists what WOULD be sent.
 */
const nodemailer = require('nodemailer');
const {
  SITE_URL, GRACE_DAYS, REMINDER_DAYS, COPY_TO, SUPABASE_URL,
  getAuthEmail, patchProfile,
} = require('../lib/billing');

const RANK = { pre: 1, due: 2, down: 3 };
const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' });

function stageFor(paidUntil, now) {
  const daysLeft = Math.ceil((new Date(paidUntil) - now) / 86400000);
  if (daysLeft > REMINDER_DAYS) return null;
  if (daysLeft > 0) return 'pre';
  const daysOver = Math.floor((now - new Date(paidUntil)) / 86400000);
  return daysOver >= GRACE_DAYS ? 'down' : 'due';
}

function alreadySent(key, cycle, stage) {
  if (!key) return false;
  const [c, s] = key.split(':');
  return c === cycle && (RANK[s] || 0) >= RANK[stage];
}

function buildEmail(stage, name, paidUntil) {
  const first = (name || 'there').split(' ')[0];
  const link = SITE_URL + '/login.html?next=' + encodeURIComponent('/dashboard.html?billing=1');
  const until = fmt(paidUntil);
  const copy = {
    pre:  { subject: `Your NumeriFlow Pro access ends on ${until}`,
            lead: `Your NumeriFlow Pro access runs until <strong>${until}</strong>.`,
            body: `To keep every game and unlimited questions going, you can renew for another month or year whenever suits you. It's a single payment — nothing renews automatically, and any card works, including virtual cards.` },
    due:  { subject: `Your NumeriFlow Pro access has ended — ${GRACE_DAYS} days to renew`,
            lead: `Your NumeriFlow Pro access ended on <strong>${until}</strong>.`,
            body: `Your account stays fully active for ${GRACE_DAYS} more days so there is no interruption. After that it moves to the free plan. Your children's progress is always kept safe.` },
    down: { subject: `Your NumeriFlow account is now on the free plan`,
            lead: `Your NumeriFlow Pro access ended on <strong>${until}</strong> and your account is now on the free plan.`,
            body: `All your children's progress is saved. You can restore Pro at any time with a single payment and everything will be exactly as you left it.` },
  }[stage];
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#F8F4EF;padding:32px 24px;border-radius:16px;">
    <div style="text-align:center;margin-bottom:24px;"><img src="${SITE_URL}/logo.png" alt="NumeriFlow" style="height:56px;"></div>
    <div style="background:#fff;border-radius:14px;padding:32px;">
      <h1 style="font-size:22px;color:#1B2D6B;margin:0 0 12px;">Hi ${first},</h1>
      <p style="color:#5F5E5A;font-size:15px;line-height:1.7;">${copy.lead}</p>
      <p style="color:#5F5E5A;font-size:15px;line-height:1.7;margin-bottom:24px;">${copy.body}</p>
      <div style="text-align:center;">
        <a href="${link}" style="display:inline-block;background:#FF6B6B;color:#fff;padding:14px 32px;border-radius:12px;font-size:16px;font-weight:700;text-decoration:none;">${stage === 'down' ? 'Restore Pro' : 'Renew now'} →</a>
      </div>
      <p style="color:#888780;font-size:12px;margin-top:20px;">The button signs you in and opens the Billing tab, where a fresh payment link is created every time — it never expires. £6 for 1 month or £35 for 1 year.</p>
      <p style="color:#888780;font-size:12px;">Questions? Reply to this email or write to <a href="mailto:info@numeriflow.uk" style="color:#1D9E75;">info@numeriflow.uk</a>.</p>
    </div>
    <p style="text-align:center;color:#aaa;font-size:11px;margin-top:16px;">Numeriflow Kids Learning Ltd · London, UK · <a href="${SITE_URL}" style="color:#aaa;">numeriflow.uk</a></p>
  </div>`;
  return { subject: copy.subject, html };
}

function makeTransport() {
  return nodemailer.createTransport({
    host: 'smtp.ionos.co.uk', port: 587, secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { rejectUnauthorized: false },
  });
}

async function listPaidProfiles() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  const res = await fetch(
    SUPABASE_URL + '/rest/v1/profiles?plan=in.(monthly,annual)&paid_until=not.is.null' +
    '&select=id,name,plan,paid_until,last_reminder_key&limit=1000',
    { headers: { apikey: key, Authorization: 'Bearer ' + key } }
  );
  if (!res.ok) throw new Error('Profile list failed: ' + res.status);
  return res.json();
}

// deps are injectable so the logic can be tested without network access
async function run({ dry = false, now = new Date(), deps = {} } = {}) {
  const list = deps.listPaidProfiles || listPaidProfiles;
  const emailOf = deps.getAuthEmail || getAuthEmail;
  const patch = deps.patchProfile || patchProfile;
  const transport = deps.transport || (dry ? null : makeTransport());

  const summary = { checked: 0, sent: [], downgraded: [], errors: [] };
  const profiles = await list();
  for (const p of profiles) {
    summary.checked++;
    const stage = stageFor(p.paid_until, now);
    if (!stage) continue;
    const cycle = new Date(p.paid_until).toISOString().slice(0, 10);
    if (alreadySent(p.last_reminder_key, cycle, stage)) continue;
    try {
      const to = await emailOf(p.id);
      if (!to) { summary.errors.push(`${p.id}: no email`); continue; }
      const { subject, html } = buildEmail(stage, p.name, p.paid_until);
      if (dry) { summary.sent.push({ to, stage, subject }); continue; }
      await transport.sendMail({
        from: `"NumeriFlow" <${process.env.SMTP_USER}>`,
        to, bcc: COPY_TO, subject, html,
      });
      const update = { last_reminder_key: `${cycle}:${stage}` };
      if (stage === 'down') { update.plan = 'freemium'; summary.downgraded.push(to); }
      await patch(p.id, update);
      summary.sent.push({ to, stage });
    } catch (e) {
      summary.errors.push(`${p.id}: ${e.message}`);
    }
  }
  return summary;
}

exports.run = run;
exports.stageFor = stageFor;
exports.handler = async (event) => {
  const qs = event?.queryStringParameters || {};
  const manual = event?.httpMethod; // scheduled invocations have no HTTP method
  if (manual) {
    const secret = process.env.CRON_SECRET;
    if (!secret || event.headers?.['x-cron-secret'] !== secret) return { statusCode: 403, body: 'Forbidden' };
  }
  try {
    const summary = await run({ dry: !!(manual && qs.dry) });
    console.log('[billing-cron]', JSON.stringify(summary));
    return { statusCode: 200, body: JSON.stringify(summary) };
  } catch (e) {
    console.error('[billing-cron] Failed:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
