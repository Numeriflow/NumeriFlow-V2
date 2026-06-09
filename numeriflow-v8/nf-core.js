/**
 * NumeriFlow v8 — Core Module
 * Handles: auth state, payment gate, user signup logging, Stripe links
 *
 * USER DATABASE: Uses Formspree (free) — every signup/login posts to
 * https://formspree.io/f/YOUR_FORM_ID → you get an email + web dashboard
 * of every user. No backend, no Supabase needed.
 *
 * TO SET UP (5 minutes):
 * 1. Go to https://formspree.io → create free account
 * 2. Create a new form → copy the form ID (looks like: xpwzabcd)
 * 3. Replace FORMSPREE_ID below with your form ID
 * 4. All signups appear in your Formspree dashboard + email alerts
 */

const NF = (() => {

  // ─── CONFIG — UPDATE THESE ────────────────────────────────────────────
  const FORMSPREE_ID = 'mykawpbe'; // e.g. 'xpwzabcd'

  // Stripe Payment Links — create at dashboard.stripe.com → Payment Links
  const STRIPE = {
    monthly:  'https://buy.stripe.com/test_6oU14oeW473A49W5122go00',   // £6/month
    annual:   'https://buy.stripe.com/test_8x25kEdS01Jg0XK1OQ2go01',  // £35 one-time
  };

  // Access code for testers / evaluators / you
  const ACCESS_CODE = 'NUMERIFLOW2026';

  // ─── AUTH ──────────────────────────────────────────────────────────────

  function getUser() {
    try { return JSON.parse(localStorage.getItem('nf_user')) || null; }
    catch { return null; }
  }

  function setUser(userData) {
    localStorage.setItem('nf_user', JSON.stringify(userData));
  }

  function isPro() {
    if (localStorage.getItem('nf_pro') === 'true') return true;
    const user = getUser();
    return user && (user.plan === 'monthly' || user.plan === 'annual');
  }

  function requireAuth(redirectTo) {
    if (!getUser()) {
      window.location.href = 'login.html?next=' + encodeURIComponent(redirectTo || window.location.pathname);
      return false;
    }
    return true;
  }

  // ─── SIGNUP LOGGING — posts to Formspree so you see every signup ───────

  async function logSignup(userData) {
    if (!FORMSPREE_ID || FORMSPREE_ID === 'YOUR_FORM_ID') return;
    try {
      // Pull child data from localStorage to enrich the record
      let childInfo = 'None added yet';
      try {
        const children = JSON.parse(localStorage.getItem('nf_children') || '[]');
        if (children.length > 0) {
          childInfo = children.map(c => `${c.name} (Age ${c.age})`).join(', ');
        }
      } catch(e) {}

      await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          _subject: `New NumeriFlow signup: ${userData.name} [${userData.role || 'parent'}]`,
          // ── User details ──
          parent_name: userData.name,
          email: userData.email,
          role: userData.role || 'parent',
          // ── Subscription ──
          plan: userData.plan || 'free',
          paid: (userData.plan === 'monthly' || userData.plan === 'annual') ? 'YES' : 'No — free tier',
          // ── Child info ──
          children: childInfo,
          // ── Meta ──
          signup_date: new Date().toISOString(),
          source: document.referrer || 'direct',
          device: /Mobi|Android/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
        })
      });
    } catch (e) {
      console.warn('Formspree log failed (non-critical):', e);
    }
  }

  async function logUpgrade(email, plan) {
    if (!FORMSPREE_ID || FORMSPREE_ID === 'YOUR_FORM_ID') return;
    try {
      let childInfo = '—';
      try {
        const children = JSON.parse(localStorage.getItem('nf_children') || '[]');
        if (children.length > 0) childInfo = children.map(c => `${c.name} (Age ${c.age})`).join(', ');
      } catch(e) {}
      await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          _subject: `💳 NumeriFlow PAID: ${email} → ${plan}`,
          email,
          plan,
          paid: 'YES',
          children: childInfo,
          event: 'upgrade',
          upgrade_date: new Date().toISOString(),
        })
      });
    } catch (e) {}
  }

  // ─── STRIPE ────────────────────────────────────────────────────────────

  function goToCheckout(plan) {
    const user = getUser();
    const url = STRIPE[plan];
    if (!url || url.includes('YOUR_')) {
      // Stripe not configured yet — show info modal
      showStripeNotConfigured(plan);
      return;
    }
    // Pre-fill email in Stripe if possible
    const email = user ? encodeURIComponent(user.email) : '';
    window.location.href = url + (email ? `?prefilled_email=${email}` : '');
  }

  function showStripeNotConfigured(plan) {
    const prices = { monthly: '£6/month', annual: '£35/year' };
    const existing = document.getElementById('nf-stripe-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'nf-stripe-modal';
    modal.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;
      display:flex;align-items:center;justify-content:center;padding:24px;
    `;
    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:36px;max-width:400px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.2)">
        <div style="font-size:48px;margin-bottom:16px">💳</div>
        <div style="font-family:'Nunito',sans-serif;font-weight:900;font-size:22px;color:#2C2C2A;margin-bottom:10px">
          ${plan === 'monthly' ? 'Monthly Plan — ' + prices.monthly : 'Annual Plan — ' + prices.annual}
        </div>
        <p style="font-size:14px;color:#888780;line-height:1.7;margin-bottom:20px">
          Payment processing is being set up. To get access now, email us at
          <a href="mailto:info@numeriflow.uk" style="color:#1D9E75;font-weight:700">info@numeriflow.uk</a>
          and we'll activate your account manually.
        </p>
        <div style="display:flex;gap:10px;justify-content:center;">
          <a href="mailto:info@numeriflow.uk?subject=NumeriFlow ${plan} plan" 
             style="background:#1D9E75;color:#fff;padding:12px 24px;border-radius:12px;font-weight:700;font-size:14px;text-decoration:none">
            Email us
          </a>
          <button onclick="document.getElementById('nf-stripe-modal').remove()"
            style="background:#F0EEE9;color:#2C2C2A;padding:12px 24px;border-radius:12px;font-weight:700;font-size:14px;border:none;cursor:pointer">
            Close
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  // ─── ACCESS CODE UNLOCK ────────────────────────────────────────────────

  function tryAccessCode(code) {
    if (code.trim().toUpperCase() === ACCESS_CODE) {
      localStorage.setItem('nf_pro', 'true');
      const user = getUser();
      if (user) { user.plan = 'access_code'; setUser(user); }
      return true;
    }
    return false;
  }

  // ─── PAYMENT GATE ─────────────────────────────────────────────────────
  // Call this at top of play.html / join.html to gate non-pro users

  function showPaymentGate(onClose) {
    const existing = document.getElementById('nf-paygate');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'nf-paygate';
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9000;
      display:flex;align-items:center;justify-content:center;padding:16px;
    `;
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:24px;padding:36px 28px;max-width:420px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.2);">
        <div style="font-size:56px;margin-bottom:16px">🦊</div>
        <div style="font-family:'Nunito',sans-serif;font-weight:900;font-size:24px;color:#2C2C2A;margin-bottom:10px">
          Unlock Pip's Games
        </div>
        <p style="font-size:14px;color:#888780;line-height:1.7;margin-bottom:8px;">
          The assessment is free — but the daily practice games with Pip the Fox require a subscription.
        </p>
        <p style="font-size:13px;color:#888780;margin-bottom:24px;">
          Already have a code? <button onclick="NF.showCodeEntry()" style="background:none;border:none;color:#1D9E75;font-weight:700;cursor:pointer;font-size:13px;">Enter access code</button>
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <button onclick="NF.goToCheckout('monthly')" style="
            padding:16px 12px;border-radius:16px;border:2px solid #E1F5EE;
            background:#E1F5EE;cursor:pointer;transition:all .2s;
          ">
            <div style="font-family:'Nunito',sans-serif;font-weight:900;font-size:22px;color:#2C2C2A;">£6</div>
            <div style="font-size:11px;font-weight:700;color:#888780;text-transform:uppercase;margin-bottom:8px;">per month</div>
            <div style="font-size:12px;color:#0F6E56;font-weight:600;">Cancel anytime</div>
          </button>
          <button onclick="NF.goToCheckout('annual')" style="
            padding:16px 12px;border-radius:16px;border:2px solid #1D9E75;
            background:#1D9E75;cursor:pointer;transition:all .2s;position:relative;
          ">
            <div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:#EF9F27;color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;white-space:nowrap;">BEST VALUE</div>
            <div style="font-family:'Nunito',sans-serif;font-weight:900;font-size:22px;color:#fff;">£35</div>
            <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.75);text-transform:uppercase;margin-bottom:8px;">per year</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.85);font-weight:600;">Save vs monthly</div>
          </button>
        </div>
        <button onclick="document.getElementById('nf-paygate').remove();${onClose ? 'NF._gateCallback()' : ''}"
          style="width:100%;padding:12px;border-radius:12px;background:#F0EEE9;border:none;cursor:pointer;font-weight:700;color:#888780;font-size:13px;">
          Go back
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  let _gateCallback = null;
  function _setGateCallback(fn) { _gateCallback = fn; }

  function showCodeEntry() {
    const existing = document.getElementById('nf-code-entry');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = 'nf-code-entry';
    div.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9100;
      display:flex;align-items:center;justify-content:center;padding:16px;
    `;
    div.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:32px;max-width:360px;width:100%;text-align:center;">
        <div style="font-family:'Nunito',sans-serif;font-weight:900;font-size:20px;margin-bottom:16px;">Enter Access Code</div>
        <input id="nf-code-input" type="text" placeholder="e.g. NUMERIFLOW2026"
          style="width:100%;padding:12px 16px;border-radius:12px;border:2px solid #D3D1C7;
          font-size:16px;font-family:'Nunito',sans-serif;font-weight:700;text-align:center;
          text-transform:uppercase;outline:none;margin-bottom:12px;"
          oninput="this.value=this.value.toUpperCase()"
        />
        <div id="nf-code-error" style="color:#D85A30;font-size:13px;font-weight:700;margin-bottom:12px;display:none;">Invalid code. Try again.</div>
        <div style="display:flex;gap:10px;">
          <button onclick="NF._checkCode()" style="flex:1;padding:12px;border-radius:12px;background:#1D9E75;color:#fff;border:none;cursor:pointer;font-weight:700;font-size:15px;">
            Unlock
          </button>
          <button onclick="document.getElementById('nf-code-entry').remove()" style="padding:12px 16px;border-radius:12px;background:#F0EEE9;border:none;cursor:pointer;font-weight:700;color:#888780;">
            Cancel
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(div);
    setTimeout(() => document.getElementById('nf-code-input')?.focus(), 100);
  }

  function _checkCode() {
    const val = document.getElementById('nf-code-input')?.value || '';
    if (tryAccessCode(val)) {
      document.getElementById('nf-code-entry')?.remove();
      document.getElementById('nf-paygate')?.remove();
      // Reload to continue where they left off
      window.location.reload();
    } else {
      const err = document.getElementById('nf-code-error');
      if (err) err.style.display = 'block';
    }
  }

  // ─── PAYMENT RETURN HANDLER ────────────────────────────────────────────
  // Call on dashboard load — if Stripe redirected back with ?success=1

  function handleStripeReturn() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === '1') {
      const plan = params.get('plan') || 'monthly'; // monthly or annual
      const user = getUser();
      if (user) {
        user.plan = plan;
        setUser(user);
        logUpgrade(user.email, plan);
      }
      localStorage.setItem('nf_pro', 'true');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      return true;
    }
    return false;
  }

  // ─── NUMBER FORMATTING (fixes float display bug) ───────────────────────

  function displayNum(n) {
    if (n === null || n === undefined) return '';
    const rounded = Math.round(n * 1000) / 1000;
    return parseFloat(rounded.toFixed(10)).toString();
  }

  function safeAdd(a, b) { return Math.round((a + b) * 1e10) / 1e10; }
  function safeMul(a, b) { return Math.round((a * b) * 1e10) / 1e10; }

  // ─── PUBLIC API ────────────────────────────────────────────────────────
  return {
    getUser, setUser, isPro, requireAuth,
    logSignup, logUpgrade,
    goToCheckout, tryAccessCode, showCodeEntry, _checkCode,
    showPaymentGate, _gateCallback, _setGateCallback,
    handleStripeReturn,
    displayNum, safeAdd, safeMul,
    STRIPE,
  };

})();

// Make NF global
window.NF = NF;
