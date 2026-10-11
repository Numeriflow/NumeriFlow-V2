/**
 * NumeriFlow — Admin Query Proxy (admin-query.js)
 *
 * The admin dashboard (admin.html) needs to read data across ALL users —
 * profiles, children, assessments, feedback — but the anon key is blocked
 * by Row Level Security from seeing anyone else's rows. That's correct
 * behaviour for RLS and the actual reason the old dashboard silently
 * showed zero data: it was reading with the anon key directly.
 *
 * This function is the fix: it runs server-side only, uses the Supabase
 * SERVICE ROLE key (set in Netlify env vars, never shipped to the browser)
 * to bypass RLS, and returns just the requested resource.
 *
 * Two safeguards, since this endpoint effectively grants service-role reads:
 * 1. A shared admin password, checked server-side (matches admin.html's
 *    client-side gate — override via the ADMIN_PASSWORD env var for
 *    anything beyond casual internal use).
 * 2. A fixed resource allowlist — callers request a name ('profiles',
 *    'children', ...), never a raw REST path, so there's no way to widen
 *    the query beyond what's defined here.
 */

const SUPABASE_URL   = 'https://agifyxyoktsivnjoemxu.supabase.co';
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'NF-Admin-2026';

// Fixed allowlist — the only queries this function will ever run.
const RESOURCES = {
  profiles:    '/rest/v1/profiles?select=id,name,plan,created_at&order=created_at.desc',
  children:    '/rest/v1/children?select=id,user_id,name,age,year,created_at&order=created_at.desc',
  assessments: '/rest/v1/assessments?select=id,child_id,updated_at',
  feedback:    '/rest/v1/feedback?select=id,user_id,data,created_at&order=created_at.desc&limit=50',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  if (!SERVICE_KEY) {
    console.error('[admin-query] SUPABASE_SERVICE_KEY is not set in Netlify env vars');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server misconfigured — SUPABASE_SERVICE_KEY missing' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { password, resource } = body;

  if (password !== ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const path = RESOURCES[resource];
  if (!path) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Unknown resource: ' + resource, allowed: Object.keys(RESOURCES) }),
    };
  }

  try {
    const res = await fetch(SUPABASE_URL + path, {
      headers: {
        'apikey':        SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
      },
    });

    const text = await res.text();
    if (!res.ok) {
      console.error('[admin-query] Supabase error for resource "' + resource + '":', res.status, text);
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: 'Supabase query failed', detail: text }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: text,
    };
  } catch (e) {
    console.error('[admin-query] Unexpected error:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
