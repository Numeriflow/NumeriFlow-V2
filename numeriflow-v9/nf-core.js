/**
 * NumeriFlow v9 — Core Module with Supabase Auth
 * Supabase handles: signup, login, session, profiles, children, assessments
 * localStorage used as fast local cache — Supabase is source of truth
 */

// ─── SUPABASE CONFIG ──────────────────────────────────────────────
const SUPABASE_URL  = 'https://agifyxyoktsivnjoemxu.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnaWZ5eHlva3RzaXZuam9lbXh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NzIzODUsImV4cCI6MjA5ODI0ODM4NX0.JuMLFPzbg5S8WBzye10roF40Pgpxp-ZZIZfx6m7tfeQ';

const NF = (() => {

  // ─── CONFIG ───────────────────────────────────────────────────────
  const FORMSPREE_ID = 'mykawpbe';

  const EMAILJS = {
    publicKey:        'i-kJKZR4nT68UCPag',
    serviceId:        'service_d3hf2m2',
    verifyTemplateId: 'template_yxp4ybq',
    welcomeTemplateId:'template_r2g7ov8',
  };

  const STRIPE = {
    monthly: 'https://buy.stripe.com/8x200k5lugEa35Sctu2go04',
    annual:  'https://buy.stripe.com/8x25kEdS01Jg0XK1OQ2go01',
  };

  const ACCESS_CODE    = 'NF2026';
  const EARLY_BIRD_END = new Date('2026-09-01');
  const EARLY_BIRD_ACTIVE = new Date() < EARLY_BIRD_END;

  const PRICES = EARLY_BIRD_ACTIVE
    ? { monthly:'£4.80', annual:'£28', monthlyFull:'£6', annualFull:'£35' }
    : { monthly:'£6',    annual:'£35', monthlyFull:null,  annualFull:null  };

  // ─── SUPABASE HELPERS ─────────────────────────────────────────────

  // Low-level fetch wrapper for Supabase REST API
  async function _sb(path, method='GET', body=null, token=null) {
    const session = _getSession();
    const authToken = token || session?.access_token;
    const headers = {
      'apikey':       SUPABASE_ANON,
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    };
    if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
    if (method !== 'GET') headers['Prefer'] = 'return=representation';

    const res = await fetch(SUPABASE_URL + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || err.error_description || res.statusText);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  // Auth API wrapper
  async function _sbAuth(path, body) {
    const url = SUPABASE_URL + '/auth/v1' + path;
    console.log('[NF Supabase] POST', url);
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'apikey':       SUPABASE_ANON,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch(networkErr) {
      console.error('[NF Supabase] Network error:', networkErr);
      throw new Error('Network error — check your connection: ' + networkErr.message);
    }
    const rawText = await res.text();
    console.log('[NF Supabase] Status:', res.status, 'Body:', rawText.substring(0,300));
    let data = {};
    try { data = JSON.parse(rawText); } catch(e) {
      if (!res.ok) throw new Error('Server error (HTTP ' + res.status + '): ' + rawText.substring(0,100));
    }
    if (!res.ok) {
      const msg = data.message || data.error_description || data.msg ||
                  (data.error && typeof data.error === 'string' ? data.error : '') ||
                  data.error?.message || rawText.substring(0,120) ||
                  ('HTTP ' + res.status);
      throw new Error(String(msg));
    }
    return data;
  }

  // ─── SESSION MANAGEMENT ───────────────────────────────────────────

  function _getSession() {
    try { return JSON.parse(localStorage.getItem('nf_sb_session') || 'null'); }
    catch { return null; }
  }

  function _setSession(session) {
    if (session) localStorage.setItem('nf_sb_session', JSON.stringify(session));
    else localStorage.removeItem('nf_sb_session');
  }

  function _isTokenExpired(session) {
    if (!session?.expires_at) return true;
    return Date.now() / 1000 > session.expires_at - 60; // 60s buffer
  }

  async function _refreshSession() {
    const session = _getSession();
    if (!session?.refresh_token) return null;
    try {
      const data = await _sbAuth('/token?grant_type=refresh_token', {
        refresh_token: session.refresh_token
      });
      _setSession(data);
      return data;
    } catch(e) {
      console.warn('Session refresh failed:', e.message);
      _setSession(null);
      return null;
    }
  }

  async function _getValidSession() {
    let session = _getSession();
    if (!session) {
      console.warn('[NF] _getValidSession: no session in localStorage');
      return null;
    }
    if (_isTokenExpired(session)) {
      console.log('[NF] Session expired, refreshing...');
      session = await _refreshSession();
    }
    return session;
  }

  // ─── AUTH ──────────────────────────────────────────────────────────

  function getUser() {
    const session = _getSession();
    if (!session?.user) return null;
    // Merge with cached profile
    const profile = JSON.parse(localStorage.getItem('nf_user') || 'null');
    return profile || {
      id:    session.user.id,
      email: session.user.email,
      name:  session.user.user_metadata?.name || '',
      role:  session.user.user_metadata?.role || 'parent',
      plan:  'freemium',
    };
  }

  function setUser(userData) {
    localStorage.setItem('nf_user', JSON.stringify(userData));
  }

  function isPro() {
    if (localStorage.getItem('nf_pro') === 'true') return true;
    const user = getUser();
    return user && ['monthly','annual','access_code'].includes(user.plan);
  }

  function isFreemium() {
    if (isPro()) return false;
    const user = getUser();
    if (!user) return false;
    // Default to freemium if plan is unset — new Supabase users
    return ['freemium','free',undefined,null,''].includes(user.plan);
  }

  function requireAuth(redirectTo) {
    // Must have a valid Supabase session — not just nf_user in localStorage
    // This prevents pre-Supabase localStorage users from accessing protected pages
    const session = _getSession();
    if (!session?.access_token || !session?.user?.id) {
      // Clear any stale localStorage data
      const allUsers = localStorage.getItem('nf_all_users');
      localStorage.clear();
      if (allUsers) localStorage.setItem('nf_all_users', allUsers);
      window.location.href = 'login.html?next=' + encodeURIComponent(redirectTo || window.location.pathname);
      return false;
    }
    return true;
  }

  // ─── SUPABASE SIGNUP ──────────────────────────────────────────────

  async function sbSignUp(name, email, password, role) {
    const data = await _sbAuth('/signup', {
      email,
      password,
      data: { name, role: role || 'parent' },
      options: { emailRedirectTo: 'https://numeriflow.uk/login.html' }
    });
    // Supabase REST API returns user at top level: {id, email, identities, ...}
    // Wrap in {user, session} shape for consistent access in callers
    const user = data.user || data; // handle both raw API and client library format
    if (data.session) {
      _setSession(data.session);
      const userData = {
        id:    user.id,
        email: user.email,
        name, role: role || 'parent',
        plan:  'freemium',
        emailVerified: false,
        signupDate: new Date().toISOString(),
      };
      setUser(userData);
    }
    // Always return {user, session} shape
    return { user, session: data.session || null };
  }

  // ─── SUPABASE LOGIN ───────────────────────────────────────────────

  async function sbLogin(email, password) {
    const data = await _sbAuth('/token?grant_type=password', { email, password });
    _setSession(data);

    // Fetch profile from Supabase
    let profile = null;
    try {
      const rows = await _sb(
        '/rest/v1/profiles?id=eq.' + data.user.id + '&select=*',
        'GET', null, data.access_token
      );
      profile = rows?.[0];
    } catch(e) { console.warn('Profile fetch failed:', e.message); }

    // email_confirmed_at in Supabase auth tells us if email is verified
    const emailVerified = !!data.user.email_confirmed_at;

    const userData = {
      id:    data.user.id,
      email: data.user.email,
      name:  profile?.name || data.user.user_metadata?.name || email.split('@')[0],
      role:  profile?.role || 'parent',
      plan:  profile?.plan || 'freemium',
      emailVerified,
      signupDate: profile?.created_at || new Date().toISOString(),
    };
    setUser(userData);

    // Sync email_verified back to profiles table if not already set
    if (emailVerified && !profile?.email_verified) {
      _sb('/rest/v1/profiles?id=eq.' + data.user.id, 'PATCH',
        { email_verified: true }, data.access_token
      ).catch(() => {});
    }

    // Restore pro status if plan is paid
    if (['monthly','annual','access_code'].includes(userData.plan)) {
      localStorage.setItem('nf_pro', 'true');
    } else {
      localStorage.removeItem('nf_pro');
    }

    // Load children from Supabase into localStorage cache
    await _syncChildrenFromSupabase(data.access_token);

    return { user: userData, session: data };
  }

  // ─── SUPABASE LOGOUT ──────────────────────────────────────────────

  async function sbLogout() {
    const session = _getSession();
    if (session?.access_token) {
      try {
        await fetch(SUPABASE_URL + '/auth/v1/logout', {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON,
            'Authorization': 'Bearer ' + session.access_token,
          }
        });
      } catch(e) {}
    }
    // Clear everything except nf_all_users (kept for legacy compat)
    const allUsers = localStorage.getItem('nf_all_users');
    localStorage.clear();
    if (allUsers) localStorage.setItem('nf_all_users', allUsers);
    _setSession(null);
  }

  // ─── CHILDREN SYNC ────────────────────────────────────────────────

  async function _syncChildrenFromSupabase(token) {
    try {
      const session = await _getValidSession();
      // Use passed token if provided (e.g. right after login before session is refreshed)
      const accessToken = token || session?.access_token;
      if (!accessToken) {
        console.warn('[NF] syncChildren: no access token');
        return;
      }
      // Get userId — always from the stored session which has the full user object
      const storedSession = _getSession();
      const userId = storedSession?.user?.id || session?.user?.id;
      if (!userId) {
        console.warn('[NF] syncChildren: no userId in session');
        return;
      }
      console.log('[NF] Syncing children for user:', userId);

      const rows = await _sb(
        '/rest/v1/children?user_id=eq.' + userId + '&order=sort_order.asc,created_at.asc&select=*',
        'GET', null, accessToken
      );

      console.log('[NF] Children from Supabase:', rows?.length || 0, 'rows');
      if (rows && rows.length > 0) {
        // Convert Supabase rows to legacy nf_children format
        const children = rows.map(r => ({
          id:        r.id,
          name:      r.name,
          age:       r.age,
          year:      r.year,
          notes:     r.notes || '',
          addedAt:   new Date(r.created_at).getTime(),
          _sbId:     r.id,
        }));
        localStorage.setItem('nf_children', JSON.stringify(children));

        // Also load assessments for each child
        for (let i = 0; i < rows.length; i++) {
          const asmRows = await _sb(
            '/rest/v1/assessments?child_id=eq.' + rows[i].id + '&select=data',
            'GET', null, session.access_token
          ).catch(() => null);
          if (asmRows?.[0]?.data) {
            localStorage.setItem('nf_assessment_' + i, JSON.stringify(asmRows[0].data));
            if (i === 0) localStorage.setItem('nf_assessment', JSON.stringify(asmRows[0].data));
          }
        }
      }
    } catch(e) {
      console.warn('Children sync from Supabase failed:', e.message);
    }
  }

  async function saveChildToSupabase(childData, childIdx) {
    try {
      const session = await _getValidSession();
      if (!session) {
        console.error('[NF] saveChildToSupabase: no valid session');
        return null;
      }
      // Always read user ID from session directly — most reliable source
      const userId = session.user?.id;
      if (!userId) {
        console.error('[NF] saveChildToSupabase: no user ID in session');
        return null;
      }

      // Check if child has a Supabase ID already
      const children = JSON.parse(localStorage.getItem('nf_children') || '[]');
      const existingId = children[childIdx]?._sbId;

      if (existingId) {
        // Update existing row
        await _sb(
          '/rest/v1/children?id=eq.' + existingId,
          'PATCH',
          { name: childData.name, age: childData.age, year: childData.year, notes: childData.notes || '' },
          session.access_token
        );
        console.log('[NF] Child updated in Supabase:', existingId);
        return existingId;
      } else {
        // Insert new row
        const rows = await _sb(
          '/rest/v1/children',
          'POST',
          {
            user_id:    userId,
            name:       childData.name,
            age:        childData.age,
            year:       childData.year || '',
            notes:      childData.notes || '',
            sort_order: childIdx,
          },
          session.access_token
        );
        const newId = Array.isArray(rows) ? rows[0]?.id : rows?.id;
        console.log('[NF] Child saved to Supabase, id:', newId);
        return newId || null;
      }
    } catch(e) {
      console.error('[NF] saveChildToSupabase error:', e.message);
      return null;
    }
  }

  async function deleteChildFromSupabase(sbId) {
    try {
      const session = await _getValidSession();
      if (!session || !sbId) return;
      await _sb(
        '/rest/v1/children?id=eq.' + sbId,
        'DELETE', null, session.access_token
      );
    } catch(e) {
      console.warn('deleteChildFromSupabase failed:', e.message);
    }
  }

  async function saveAssessmentToSupabase(childIdx, assessmentData) {
    try {
      const session = await _getValidSession();
      if (!session) return;
      const userId = session.user?.id;
      if (!userId) return;
      const children = JSON.parse(localStorage.getItem('nf_children') || '[]');
      const childSbId = children[childIdx]?._sbId;
      if (!childSbId) {
        console.warn('[NF] saveAssessmentToSupabase: child has no _sbId at index', childIdx);
        return;
      }

      // Upsert assessment
      await _sb(
        '/rest/v1/assessments?child_id=eq.' + childSbId,
        'GET', null, session.access_token
      ).then(async rows => {
        if (rows?.length > 0) {
          // Update
          await _sb(
            '/rest/v1/assessments?child_id=eq.' + childSbId,
            'PATCH',
            { data: assessmentData, updated_at: new Date().toISOString() },
            session.access_token
          );
        } else {
          // Insert
          await _sb(
            '/rest/v1/assessments',
            'POST',
            { child_id: childSbId, user_id: userId, data: assessmentData },
            session.access_token
          );
        }
      });
    } catch(e) {
      console.warn('saveAssessmentToSupabase failed:', e.message);
    }
  }

  async function updatePlanInSupabase(plan) {
    try {
      const session = await _getValidSession();
      if (!session) return;
      const user = getUser();
      if (!user?.id) return;
      await _sb(
        '/rest/v1/profiles?id=eq.' + user.id,
        'PATCH',
        { plan },
        session.access_token
      );
    } catch(e) {
      console.warn('updatePlanInSupabase failed:', e.message);
    }
  }

  // ─── EMAILJS VERIFICATION ─────────────────────────────────────────

  let _emailJSReady = false;
  function _initEmailJS() {
    if (window.emailjs) {
      if (!_emailJSReady) {
        emailjs.init(EMAILJS.publicKey);
        _emailJSReady = true;
      }
      return true;
    }
    return false;
  }

  function _generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  async function sendVerificationEmail(parentName, email) {
    if (!_initEmailJS()) return { ok: false, error: 'EmailJS not loaded' };
    const code = _generateCode();
    const expiry = Date.now() + 10 * 60 * 1000;
    localStorage.setItem('nf_verify_pending', JSON.stringify({ code, expiry, email, parentName }));
    try {
      await emailjs.send(EMAILJS.serviceId, EMAILJS.verifyTemplateId, {
        parent_name: parentName,
        code,
        to_email: email,
      });
      return { ok: true, code };
    } catch(err) {
      return { ok: false, error: err.text || String(err) };
    }
  }

  function verifyCode(enteredCode) {
    try {
      const pending = JSON.parse(localStorage.getItem('nf_verify_pending') || 'null');
      if (!pending) return { ok: false, reason: 'no_pending' };
      if (Date.now() > pending.expiry) return { ok: false, reason: 'expired' };
      if (enteredCode.trim() !== pending.code) return { ok: false, reason: 'wrong_code' };
      localStorage.removeItem('nf_verify_pending');
      return { ok: true, email: pending.email, parentName: pending.parentName };
    } catch { return { ok: false, reason: 'error' }; }
  }

  async function sendWelcomeEmail(parentName, email, type) {
    try {
      await fetch('/.netlify/functions/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_name: parentName,
          to_email: email,
          type: type || 'welcome'
        })
      });
    } catch(e) { console.warn('Welcome email failed (non-critical):', e); }
  }

  // ─── FORMSPREE WITH RETRY ─────────────────────────────────────────

  async function _postToFormspree(payload) {
    const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
  }

  function _savePending(payload) {
    try {
      const pending = JSON.parse(localStorage.getItem('nf_pending_submissions') || '[]');
      pending.push({ payload, timestamp: Date.now() });
      localStorage.setItem('nf_pending_submissions', JSON.stringify(pending));
    } catch(e) {}
  }

  async function retryPendingSubmissions() {
    try {
      const pending = JSON.parse(localStorage.getItem('nf_pending_submissions') || '[]');
      if (!pending.length) return;
      const remaining = [];
      for (const item of pending) {
        try { await _postToFormspree(item.payload); }
        catch { remaining.push(item); }
      }
      localStorage.setItem('nf_pending_submissions', JSON.stringify(remaining));
    } catch(e) {}
  }

  async function logSignup(userData) {
    const payload = {
      _subject:    `New NumeriFlow signup: ${userData.name}`,
      parent_name: userData.name,
      email:       userData.email,
      role:        userData.role || 'parent',
      plan:        userData.plan || 'freemium',
      paid:        'No — freemium',
      signup_date: new Date().toISOString(),
      source:      document.referrer || 'direct',
    };
    try { await _postToFormspree(payload); }
    catch { _savePending(payload); }
  }

  async function logUpgrade(email, plan) {
    const payload = {
      _subject:     `💳 NumeriFlow PAID: ${email} → ${plan}`,
      email, plan, paid: 'YES',
      event:        'upgrade',
      upgrade_date: new Date().toISOString(),
    };
    try { await _postToFormspree(payload); }
    catch { _savePending(payload); }
  }

  async function logBetaSignup(name, email, childAge, challenge) {
    const payload = {
      _subject:         `🌟 Beta parent signup: ${name}`,
      parent_name:      name, email,
      child_age:        childAge,
      maths_challenge:  challenge,
      type:             'beta_tester',
      signup_date:      new Date().toISOString(),
    };
    try { await _postToFormspree(payload); }
    catch { _savePending(payload); }
  }

  // ─── STRIPE ────────────────────────────────────────────────────────

  function goToCheckout(plan) {
    const user = getUser();
    const url = STRIPE[plan];
    if (!url) return;
    const email = user ? encodeURIComponent(user.email) : '';
    window.location.href = url + (email ? `?prefilled_email=${email}` : '');
  }

  // ─── ACCESS CODE ───────────────────────────────────────────────────

  function tryAccessCode(code) {
    if (code.trim().toUpperCase() === ACCESS_CODE) {
      localStorage.setItem('nf_pro', 'true');
      const user = getUser();
      if (user) {
        user.plan = 'access_code';
        setUser(user);
        updatePlanInSupabase('access_code').catch(() => {});
      }
      return true;
    }
    return false;
  }

  // ─── PAYMENT GATE ──────────────────────────────────────────────────

  function _priceLabel(plan) {
    if (plan === 'monthly') return EARLY_BIRD_ACTIVE
      ? `<span style="text-decoration:line-through;color:#ccc;font-size:16px">£6</span> £4.80`
      : '£6';
    return EARLY_BIRD_ACTIVE
      ? `<span style="text-decoration:line-through;color:rgba(255,255,255,0.5);font-size:16px">£35</span> £28`
      : '£35';
  }

  function showPaymentGate() {
    const existing = document.getElementById('nf-paygate');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'nf-paygate';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:24px;padding:36px 28px;max-width:420px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.2);">
        <div style="font-size:56px;margin-bottom:16px">🦊</div>
        <div style="font-family:'Nunito',sans-serif;font-weight:900;font-size:24px;color:#1B2D6B;margin-bottom:10px">Unlock All of Pip's Games</div>
        ${EARLY_BIRD_ACTIVE ? `<div style="background:#FFD166;color:#1B2D6B;font-size:12px;font-weight:700;padding:6px 16px;border-radius:20px;display:inline-block;margin-bottom:12px;">🎉 Launch offer — 20% off, ends 31 August 2026</div>` : ''}
        <p style="font-size:14px;color:#888780;line-height:1.7;margin-bottom:8px;">Upgrade for Comparison, Patterns, unlimited questions and no ads.</p>
        <p style="font-size:13px;color:#888780;margin-bottom:24px;">Have a code? <button onclick="NF.showCodeEntry()" style="background:none;border:none;color:#1D9E75;font-weight:700;cursor:pointer;font-size:13px;">Enter access code</button></p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <button onclick="NF.goToCheckout('monthly')" style="padding:16px 12px;border-radius:16px;border:2px solid #E1F5EE;background:#E1F5EE;cursor:pointer;">
            <div style="font-family:'Nunito',sans-serif;font-weight:900;font-size:22px;color:#1B2D6B;">${_priceLabel('monthly')}</div>
            <div style="font-size:11px;font-weight:700;color:#888780;text-transform:uppercase;margin-bottom:8px;">per month</div>
          </button>
          <button onclick="NF.goToCheckout('annual')" style="padding:16px 12px;border-radius:16px;border:2px solid #1D9E75;background:#1D9E75;cursor:pointer;position:relative;">
            <div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:#FFD166;color:#1B2D6B;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;white-space:nowrap;">BEST VALUE</div>
            <div style="font-family:'Nunito',sans-serif;font-weight:900;font-size:22px;color:#fff;">${_priceLabel('annual')}</div>
            <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.75);text-transform:uppercase;margin-bottom:8px;">per year</div>
          </button>
        </div>
        <button onclick="document.getElementById('nf-paygate').remove()" style="width:100%;padding:12px;border-radius:12px;background:#F0EEE9;border:none;cursor:pointer;font-weight:700;color:#888780;font-size:13px;">Go back</button>
      </div>`;
    document.body.appendChild(overlay);
  }

  function showCodeEntry() {
    const existing = document.getElementById('nf-code-entry');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = 'nf-code-entry';
    div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9100;display:flex;align-items:center;justify-content:center;padding:16px;';
    div.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:32px;max-width:360px;width:100%;text-align:center;">
        <div style="font-family:'Nunito',sans-serif;font-weight:900;font-size:20px;margin-bottom:16px;">Enter Access Code</div>
        <input id="nf-code-input" type="text" placeholder="e.g. NF2026"
          style="width:100%;padding:12px 16px;border-radius:12px;border:2px solid #D3D1C7;font-size:16px;font-family:'Nunito',sans-serif;font-weight:700;text-align:center;text-transform:uppercase;outline:none;margin-bottom:12px;box-sizing:border-box;"
          oninput="this.value=this.value.toUpperCase()"
        />
        <div id="nf-code-error" style="color:#D85A30;font-size:13px;font-weight:700;margin-bottom:12px;display:none;">Invalid code. Try again.</div>
        <div style="display:flex;gap:10px;">
          <button onclick="NF._checkCode()" style="flex:1;padding:12px;border-radius:12px;background:#1D9E75;color:#fff;border:none;cursor:pointer;font-weight:700;font-size:15px;">Unlock</button>
          <button onclick="document.getElementById('nf-code-entry').remove()" style="padding:12px 16px;border-radius:12px;background:#F0EEE9;border:none;cursor:pointer;font-weight:700;color:#888780;">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(div);
    setTimeout(() => document.getElementById('nf-code-input')?.focus(), 100);
  }

  function _checkCode() {
    const val = document.getElementById('nf-code-input')?.value || '';
    if (tryAccessCode(val)) {
      document.getElementById('nf-code-entry')?.remove();
      document.getElementById('nf-paygate')?.remove();
      window.location.reload();
    } else {
      const err = document.getElementById('nf-code-error');
      if (err) err.style.display = 'block';
    }
  }

  // ─── SPONSOR ADS ──────────────────────────────────────────────────

  const SPONSORS = [
    { name:'GigsGen',      logo:'gigsgen-logo.png',      tagline:'Learn to code with GigsGen',         url:'https://gigsgen.com',               color:'#1a7a3a' },
    { name:'ScribbleSense', logo:'scribblesense-logo.png', tagline:'Creative learning for curious kids',  url:'https://www.scribblesense.co.uk',   color:'#c41b6e' },
    { name:'NumeriFlow',   logo:null,                    tagline:'Enjoying NumeriFlow? Tell a friend 🦊', url:null, isShare:true,                color:'#1D9E75' },
  ];
  let _sponsorIdx = 0;

  function showSponsorAd(onDismiss) {
    if (isPro()) { if (onDismiss) onDismiss(); return; }
    const existing = document.getElementById('nf-sponsor-ad');
    if (existing) existing.remove();
    const sponsor = SPONSORS[_sponsorIdx % SPONSORS.length];
    _sponsorIdx++;
    const overlay = document.createElement('div');
    overlay.id = 'nf-sponsor-ad';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:8500;display:flex;align-items:center;justify-content:center;padding:24px;';
    const logoHtml = sponsor.logo
      ? `<img src="${sponsor.logo}" style="max-height:52px;max-width:160px;object-fit:contain;margin-bottom:4px;" alt="${sponsor.name}">`
      : `<div style="font-size:32px;margin-bottom:8px;">🦊</div>`;
    const ctaHtml = sponsor.isShare
      ? `<button onclick="navigator.share?navigator.share({title:'NumeriFlow',text:'Check out NumeriFlow!',url:'https://numeriflow.uk'}):(window.open('mailto:?subject=Check out NumeriFlow&body=https://numeriflow.uk'))" style="background:#1D9E75;color:#fff;border:none;padding:10px 20px;border-radius:10px;font-weight:700;cursor:pointer;font-size:14px;">Share NumeriFlow</button>`
      : `<a href="${sponsor.url}" target="_blank" rel="noopener" style="background:${sponsor.color};color:#fff;border:none;padding:10px 20px;border-radius:10px;font-weight:700;cursor:pointer;font-size:14px;text-decoration:none;">Visit ${sponsor.name} →</a>`;
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:28px;max-width:340px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.25);">
        <div style="font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">Sponsored</div>
        <div style="margin-bottom:12px;">${logoHtml}</div>
        <div style="font-family:'Nunito',sans-serif;font-weight:900;font-size:18px;color:#1B2D6B;margin-bottom:6px;">${sponsor.name}</div>
        <div style="font-size:14px;color:#888780;margin-bottom:20px;">${sponsor.tagline}</div>
        ${ctaHtml}
        <div id="nf-ad-countdown" style="font-size:11px;color:#ccc;margin-top:14px;cursor:pointer;" onclick="_nfDismissAd()">✕ closes in <span id="nf-ad-sec">5</span>...</div>
        <div style="font-size:11px;color:#aaa;margin-top:8px;">
          <a href="#" onclick="NF.showPaymentGate();document.getElementById('nf-sponsor-ad').remove();return false;" style="color:#1D9E75;font-weight:700;">Remove ads — upgrade →</a>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    let sec = 5;
    const secEl = document.getElementById('nf-ad-sec');
    const timer = setInterval(() => {
      sec--;
      if (secEl) secEl.textContent = sec;
      if (sec <= 0) { clearInterval(timer); _dismissSponsorAd(onDismiss); }
    }, 1000);
    overlay._adTimer = timer;
    window._nfDismissAd = () => { if (sec <= 0) { clearInterval(timer); _dismissSponsorAd(onDismiss); } };
  }

  function _dismissSponsorAd(onDismiss) {
    const el = document.getElementById('nf-sponsor-ad');
    if (el) { clearInterval(el._adTimer); el.remove(); }
    if (onDismiss) onDismiss();
  }

  // ─── STRIPE RETURN ────────────────────────────────────────────────

  function handleStripeReturn() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === '1') {
      const plan = params.get('plan') || 'monthly';
      const user = getUser();
      if (user) {
        user.plan = plan;
        setUser(user);
        logUpgrade(user.email, plan);
        updatePlanInSupabase(plan).catch(() => {});
      }
      localStorage.setItem('nf_pro', 'true');
      window.history.replaceState({}, '', window.location.pathname);
      return true;
    }
    return false;
  }

  // ─── EARLY BIRD ───────────────────────────────────────────────────

  function getPriceDisplay(plan) {
    if (plan === 'monthly') return EARLY_BIRD_ACTIVE
      ? { price:'£4.80', original:'£6', label:'per month' }
      : { price:'£6', original:null, label:'per month' };
    return EARLY_BIRD_ACTIVE
      ? { price:'£28', original:'£35', label:'per year' }
      : { price:'£35', original:null, label:'per year' };
  }

  // ─── NUMBER UTILS ─────────────────────────────────────────────────

  function displayNum(n) {
    if (n === null || n === undefined) return '';
    return parseFloat((Math.round(n * 1000) / 1000).toFixed(10)).toString();
  }
  function safeAdd(a, b) { return Math.round((a + b) * 1e10) / 1e10; }
  function safeMul(a, b) { return Math.round((a * b) * 1e10) / 1e10; }

  // ─── FEEDBACK SAVE TO SUPABASE ───────────────────────────────────────
  async function saveFeedbackToSupabase(feedbackData) {
    try {
      const session = await _getValidSession();
      if (!session) return;
      const userId = session.user?.id;
      if (!userId) return;
      await _sb(
        '/rest/v1/feedback',
        'POST',
        {
          user_id:    userId,
          data:       feedbackData,
          created_at: new Date().toISOString(),
        },
        session.access_token
      );
      console.log('[NF] Feedback saved to Supabase ✓');
    } catch(e) {
      console.warn('[NF] saveFeedbackToSupabase failed (non-critical):', e.message);
    }
  }

  // ─── PLAY SESSION SAVE ───────────────────────────────────────────────
  // Called from play.html after session completes to persist progress
  async function savePlaySession(childIdx, sessionData) {
    try {
      // Merge with existing assessment in localStorage
      const key = 'nf_assessment_' + childIdx;
      const existing = JSON.parse(localStorage.getItem(key) || 'null');
      if (!existing) return; // no assessment yet — nothing to merge into

      // Update session count and last played
      existing.lastPlayed = Date.now();
      existing.playSessions = (existing.playSessions || 0) + 1;

      // Merge skill scores — take weighted average favouring recent
      if (sessionData.skills) {
        Object.keys(sessionData.skills).forEach(skill => {
          if (existing.skills?.[skill] !== undefined) {
            // 70% recent, 30% historical
            existing.skills[skill] = Math.round(
              existing.skills[skill] * 0.3 + sessionData.skills[skill] * 0.7
            );
          }
        });
      }

      localStorage.setItem(key, JSON.stringify(existing));
      localStorage.setItem('nf_assessment', JSON.stringify(existing));

      // Sync to Supabase
      await saveAssessmentToSupabase(childIdx, existing);
    } catch(e) {
      console.warn('savePlaySession failed (non-critical):', e);
    }
  }

  // ─── PUBLIC API ────────────────────────────────────────────────────
  return {
    // Auth
    getUser, setUser, isPro, isFreemium, requireAuth,
    // Supabase auth
    sbSignUp, sbLogin, sbLogout,
    // Supabase data
    saveChildToSupabase, deleteChildFromSupabase,
    saveAssessmentToSupabase, updatePlanInSupabase,
    syncChildren: _syncChildrenFromSupabase,
    // Email
    sendVerificationEmail, verifyCode, sendWelcomeEmail,
    // Logging
    logSignup, logUpgrade, logBetaSignup, retryPendingSubmissions,
    // Stripe
    goToCheckout, STRIPE,
    // Access code
    tryAccessCode, showCodeEntry, _checkCode,
    // Gates & ads
    showPaymentGate, showSponsorAd,
    // Return handler
    handleStripeReturn,
    // Early bird
    EARLY_BIRD_ACTIVE, getPriceDisplay, PRICES,
    // Utils
    displayNum, safeAdd, safeMul,
    // Session
    _getValidSession,
    // Play session persistence
    savePlaySession,
    // Feedback
    saveFeedbackToSupabase,
  };

})();

window.NF = NF;
document.addEventListener('DOMContentLoaded', () => NF.retryPendingSubmissions());
