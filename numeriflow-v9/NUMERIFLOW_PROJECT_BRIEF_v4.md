# NumeriFlow — Project Brief v4
*Last updated: July 2026 — paste or upload to any new Claude chat*

---

## Situation Summary

UK EdTech platform for children aged 5–13 with **dyscalculia and numeracy difficulties**.
Founder: **Saira Mohsin** (Teacher's Assistant, Jumeirah Primary School Dubai, dyscalculia specialist, MBA IBA Karachi).
Technical lead: **Taimur** (Saira's husband).
Deadline: **August 2026 — Innovator Founder visa investor body meeting.**
Company: **Numeriflow Kids Learning Ltd**, London.
Contractor: **Ramzan** — retained for GDPR/ICO registration, trademark filing, Companies House filings, visa checkpoint documentation. Not involved in technical build.
Sponsors confirmed: **GigsGen** (gigsgen.com) and **ScribbleSense** (scribblesense.co.uk).

---

## Live Platform

| Item | Value |
|---|---|
| Live URL | https://numeriflow.uk |
| Version | V9 (current) |
| Stack | Pure HTML/CSS/JS — no frameworks, no build step |
| Hosting | Netlify (drag-and-drop zip deployment) |
| Repo | github.com/Numeriflow/NumeriFlow-V2 (public) |
| Deployment | Drag zip to netlify.com/drop |

---

## All Portals and Services

| Portal | Purpose | Account |
|---|---|---|
| Claude (claude.ai) | Platform development | — |
| Netlify | Hosting + Netlify Functions | Taimur's account |
| IONOS (ionos.co.uk) | Domain registrar + email mailbox | sairamohsin8181@gmail.com |
| Supabase | Database + authentication | info@numeriflow.uk |
| Stripe | Payments (live mode) | info@numeriflow.uk |
| Resend (resend.com) | Transactional email via SMTP | — |
| Formspree | Signup notifications to Saira | sairamohsin8181@gmail.com |
| GitHub | Code repository | Numeriflow org |
| ICO | UK data protection registration | Ramzan |

---

## Tech Stack

- **Frontend:** Pure HTML/CSS/JS — no React, no build step
- **Backend/Auth:** Supabase (project ID: `agifyxyoktsivnjoemxu`, region: eu-central-2)
- **Hosting:** Netlify (free tier, custom domain numeriflow.uk, SSL via Let's Encrypt)
- **Payments:** Stripe (live mode)
- **Email:** Resend → Supabase custom SMTP (confirmation emails from info@numeriflow.uk)
- **Notifications:** Formspree (form ID: `mykawpbe`) — alerts Saira on new signups
- **Domain:** IONOS — numeriflow.uk, registered April 2026, expires April 2028
- **Email mailbox:** info@numeriflow.uk (IONOS hosted)

---

## Credentials and Config

### Supabase
- **URL:** `https://agifyxyoktsivnjoemxu.supabase.co`
- **Anon key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnaWZ5eHlva3RzaXZuam9lbXh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NzIzODUsImV4cCI6MjA5ODI0ODM4NX0.JuMLFPzbg5S8WBzye10roF40Pgpxp-ZZIZfx6m7tfeQ`
- **Project ID:** `agifyxyoktsivnjoemxu`
- **Region:** eu-central-2
- **Service role key:** stored in Netlify env vars only — never in frontend code

### Stripe
- **Monthly recurring (£4.80 early bird):** `https://buy.stripe.com/9B66oI9BK5Zw35S5122go02`
- **Monthly one-time test (£4.80):** `https://buy.stripe.com/8x200k5lugEa35Sctu2go04` ← currently active for testing
- **Annual (£28 early bird):** `https://buy.stripe.com/8x25kEdS01Jg0XK1OQ2go01`
- **Webhook secret:** `whsec_EtcCD3QDDJIrtfah5Wm3itY0jYeDkvWz` ← stored in Netlify env var
- **Early bird ends:** 31 August 2026

### Netlify Environment Variables
| Key | Value |
|---|---|
| `STRIPE_WEBHOOK_SECRET` | `whsec_EtcCD3QDDJIrtfah5Wm3itY0jYeDkvWz` |
| `SUPABASE_SERVICE_KEY` | Supabase service_role key (get from Supabase → Settings → API) |
| `SMTP_USER` | `info@numeriflow.uk` |
| `SMTP_PASS` | IONOS mailbox password for info@numeriflow.uk |

### Resend
- **API key:** `re_UjSH3xiE_Fn5mkJQRpiAp7sr8vzrakRNs` ⚠️ ROTATE THIS — was shared in chat
- **Used as:** Supabase custom SMTP password
- **Domain:** numeriflow.uk (verified)

### Access Codes
- **User access code:** `NF2026` (grants Pro access on dashboard)
- **Admin password:** `NF-Admin-2026` (for /admin page)

### EmailJS (legacy — subscription limit reached, no longer used for new features)
- **Public key:** `i-kJKZR4nT68UCPag`
- **Service ID:** `service_d3hf2m2`
- **Verify template:** `template_yxp4ybq`
- **Welcome template:** `template_r2g7ov8`

---

## Supabase Database Schema

```sql
-- profiles (auto-created on signup via trigger)
profiles: id (uuid → auth.users), name, role, plan, email_verified, created_at

-- children
children: id, user_id (→ profiles cascade), name, age, year, notes, sort_order, created_at

-- assessments
assessments: id, child_id (→ children cascade), user_id (→ profiles cascade), data (jsonb), updated_at

-- feedback
feedback: id, user_id (→ profiles cascade), data (jsonb), created_at

-- views
user_overview: email, name, plan, joined, child_name, age, year, assessment_done
profiles_with_email: email, name, plan, joined, email_verified
```

All tables have Row Level Security (own rows only). Trigger `handle_new_user()` auto-creates profile on signup with `set search_path = public`.

### Useful SQL queries
```sql
-- All users with children and assessment counts
select u.email, p.name, p.plan, p.created_at as joined,
  count(c.id) as children, count(a.id) as assessments
from auth.users u join profiles p on p.id = u.id
left join children c on c.user_id = p.id
left join assessments a on a.child_id = c.id
group by u.email, p.name, p.plan, p.created_at order by p.created_at desc;

-- Manually upgrade user to paid
update profiles set plan = 'monthly'
where id = (select id from auth.users where email = 'user@email.com');

-- Fix email_verified for existing users
update profiles p set email_verified = true
from auth.users u where p.id = u.id and u.email_confirmed_at is not null;

-- Clean ghost/unconfirmed users (run SELECT first to preview)
delete from auth.users
where email_confirmed_at is null
   or deleted_at is not null;
```

---

## File Structure (V9)

```
14 HTML pages + assets:
index.html          Landing page
login.html          Sign in
signup.html         Sign up (with GDPR consent checkbox)
dashboard.html      Parent dashboard (child profiles, assessment launcher)
assessment.html     8-minute game-based assessment
join.html           Child joins play session via 6-digit code
play.html           Active game session (Pip the fox)
learning-program.html  Learning programme overview
progress.html       Printable progress report per child
admin.html          Internal admin dashboard (password: NF-Admin-2026)
privacy.html        GDPR Privacy Policy
terms.html          Terms of Service

style.css           Design system (CSS variables, components)
nf-core.js          Central JS module (auth, Stripe, Supabase, access codes)
_redirects          Netlify URL rewrites (/dashboard → /dashboard.html etc)
netlify.toml        Netlify config (publish dir, functions dir, esbuild)
package.json        Root package.json (nodemailer dependency for functions)

netlify/functions/
  stripe-webhook.js   Handles Stripe cancellation → downgrades Supabase plan
  send-email.js       Sends welcome/beta emails via IONOS SMTP
  package.json        Functions package (no deps — moved to root)

Images:
logo.png, og-image.jpg, saira.jpg
img-hero.jpg, img-hero2.jpg, img-assessment.jpg, img-profile.jpg, img-music.jpg
gigsgen-logo.png, scribblesense-logo.png
```

---

## Design System

| Token | Value |
|---|---|
| `--green` | `#1D9E75` (primary brand) |
| `--purple` | `#7F77DD` (music therapy) |
| `--amber` | `#EF9F27` (warnings) |
| `--coral` | `#D85A30` (errors) |
| `--navy` | `#1B2D6B` |
| Headings | Nunito 900 |
| Body | Quicksand 500/700 |

---

## Key localStorage Keys

| Key | Purpose |
|---|---|
| `nf_sb_session` | Supabase session (access_token, refresh_token, user) |
| `nf_user` | Cached user profile (name, email, role, plan) |
| `nf_children` | Array of child profiles (with `_sbId` for Supabase FK) |
| `nf_active_child` | Active child index (integer) |
| `nf_assessment_N` | Per-child assessment data (N = index) |
| `nf_assessment` | Legacy mirror of active child assessment |
| `nf_pro` | `"true"` when Pro access active |
| `nf_all_users` | Legacy registry — survives localStorage.clear() |
| `_nf_seen_ids` | sessionStorage — signup duplicate detection circuit breaker |

---

## Auth Flow (V9 — Supabase)

1. **Signup:** Form → GDPR consent checkbox → `sbSignUp()` → Supabase creates user → duplicate check via `identities[]` + profile age + session ID → confirmation email via Resend → "Check your email" screen
2. **Email confirmation:** User clicks link → redirected to `login.html` → `handleConfirmationRedirect()` exchanges token → session stored → dashboard
3. **Login:** `sbLogin()` → Supabase auth → profile fetched → children synced from Supabase → dashboard
4. **Auth gate:** All protected pages (`dashboard`, `assessment`, `join`, `play`) verify session against `GET /auth/v1/user` on load — deleted users and stale sessions redirected to login
5. **Logout:** `sbLogout()` → Supabase session revoked → localStorage cleared → login page
6. **Delete account:** Dashboard → Settings → Delete account → types DELETE → cascades in Supabase

---

## Stripe Flow

1. User clicks upgrade → `goToCheckout('monthly')` → Stripe payment link
2. Payment succeeds → Stripe redirects to `dashboard.html?success=1&plan=monthly`
3. `handleStripeReturn()` → updates `nf_user.plan` → `updatePlanInSupabase('monthly')` → `nf_pro: true`
4. Cancellation → Stripe fires webhook → `stripe-webhook.js` → `updateUserPlan(email, 'freemium')` in Supabase

**To switch back to recurring after testing:**
Change monthly link in `nf-core.js` from `8x200k5lugEa35Sctu2go04` back to `9B66oI9BK5Zw35S5122go02`

---

## Duplicate Signup Detection (3 signals)

When `sbSignUp()` is called for an existing email, Supabase returns HTTP 200 (email enumeration protection). Detection uses 3 independent signals — any one firing = duplicate:

1. **identities array** — `result.user.identities.length === 0` (primary Supabase signal)
2. **Session ID circuit breaker** — `sessionStorage._nf_seen_ids` tracks returned user IDs; same ID twice = ghost account
3. **Profile age** — queries `profiles` table for returned user ID; exists + created > 30s ago = pre-existing account

---

## Netlify Functions

| Function | Trigger | Does |
|---|---|---|
| `stripe-webhook` | POST from Stripe | Verifies signature, handles `customer.subscription.deleted` and `customer.subscription.updated` → downgrades plan in Supabase via service key |
| `send-email` | POST from frontend | Sends welcome/beta emails via IONOS SMTP using nodemailer |

---

## Pages and URLs

| Page | URL | Access |
|---|---|---|
| Landing | numeriflow.uk | Public |
| Sign up | numeriflow.uk/signup | Public |
| Sign in | numeriflow.uk/login | Public |
| Dashboard | numeriflow.uk/dashboard | Supabase auth required |
| Assessment | numeriflow.uk/assessment | Supabase auth required |
| Join game | numeriflow.uk/join | Supabase auth required |
| Play | numeriflow.uk/play | Supabase auth + Pro |
| Progress report | numeriflow.uk/progress | Supabase auth required |
| Learning programme | numeriflow.uk/learning-program | Public |
| Admin | numeriflow.uk/admin | Password: NF-Admin-2026 |
| Privacy Policy | numeriflow.uk/privacy | Public |
| Terms of Service | numeriflow.uk/terms | Public |

---

## GDPR Compliance Status

| Item | Status |
|---|---|
| ICO registration | ✅ Done (Ramzan) — Education and Childcare |
| Privacy Policy page | ✅ Live at /privacy |
| Terms of Service page | ✅ Live at /terms |
| GDPR consent checkbox on signup | ✅ Live |
| Delete account (right to erasure) | ✅ Live in dashboard settings |
| Row Level Security on all tables | ✅ Active |
| Supabase DPA | ⚠️ Pending — download from Supabase → Settings → Legal |
| DPIA document | ⚠️ Pending — Ramzan to complete using ICO template |
| Cookie consent banner | ⚠️ Post-August |

---

## Key Technical Rules (hard-won learnings)

1. **Zip structure for Netlify:** Build from inside the folder — no wrapper directory. Files must be at root of zip.
2. **Supabase duplicate email:** Returns HTTP 200 with `identities:[]` when confirm email is ON. Check `result.user.identities` not `result.identities` — sbSignUp wraps raw API response in `{user, session}`.
3. **saveChild() must be async:** Navigation cancels in-flight fetch — always `await` Supabase saves before `window.location.href`.
4. **_syncChildrenFromSupabase userId:** Use `session.user?.id` from `_getSession()` — never from `getUser()` which may have stale pre-Supabase format.
5. **netlify.toml:** Only set `publish = "."` and `functions = "netlify/functions"` — no catch-all redirects (breaks _redirects file).
6. **Supabase trigger:** Must include `set search_path = public` to find profiles table.
7. **Ghost users:** Deleted Supabase users leave ghost records — hard delete with `delete from auth.users where email = 'x'`.
8. **Auth gate:** Verify session server-side with `GET /auth/v1/user` on every protected page load — localStorage session can be stale for deleted users.
9. **getUser() fallback:** Returns `null` if no `nf_sb_session` — prevents pre-Supabase localStorage accounts from accessing protected pages.
10. **isFreemium() default:** Treats `undefined`/`null` plan as freemium — new Supabase users get correct access immediately.

---

## Working Pattern with Claude

- Incremental task description during session — Claude holds context
- Claude reads GitHub raw files at session start before beginning work
- Claude produces complete deployable zip at session end
- Deployment: drag-and-drop zip to netlify.com/drop
- Session transcript stored in `/mnt/transcripts/`

### New Chat Starter Template

```
NumeriFlow EdTech — dyscalculia platform, August 2026 visa deadline.
Version: V9, live at numeriflow.uk
Repo: github.com/Numeriflow/NumeriFlow-V2 (public)
Brief: [upload NUMERIFLOW_PROJECT_BRIEF_v4.md]

Please read these files before responding:
https://raw.githubusercontent.com/Numeriflow/NumeriFlow-V2/main/numeriflow-v9/nf-core.js
https://raw.githubusercontent.com/Numeriflow/NumeriFlow-V2/main/numeriflow-v9/dashboard.html
https://raw.githubusercontent.com/Numeriflow/NumeriFlow-V2/main/numeriflow-v9/signup.html
https://raw.githubusercontent.com/Numeriflow/NumeriFlow-V2/main/numeriflow-v9/login.html

Task for this session: [DESCRIBE WHAT YOU WANT]

At the end provide a complete zip with ALL files ready to deploy to Netlify.
```

---

## Pending Before August

| Task | Priority | Owner |
|---|---|---|
| Rotate Resend API key (was shared in chat) | 🔴 Urgent | Taimur |
| Switch Stripe back to recurring link after testing | 🔴 Urgent | Taimur |
| Push V9 to GitHub | 🟡 High | Taimur |
| Supabase DPA download and sign | 🟡 High | Ramzan |
| DPIA document completion | 🟡 High | Ramzan |
| Trademark filing confirmation | 🟡 High | Ramzan |
| 90-second investor demo video (Saira narrates) | 🟡 High | Saira + Taimur |
| Stripe business verification for Numeriflow Kids Learning Ltd | 🟡 High | Saira |

## Post-August

| Task | Notes |
|---|---|
| Switch Stripe back to recurring link | `9B66oI9BK5Zw35S5122go02` |
| Resend domain verification DNS in IONOS | For better email deliverability |
| React Native mobile app | 6–8 weeks |
| Teacher/school/therapist dashboards | Phase 2 |
| Supabase Realtime cross-device sync | Post-August |
| PWA home screen install | Post-August |
| Google Auth | Post-August |
| Cookie consent banner | Post-August |
| `invoice.payment_succeeded` webhook (re-upgrade after card fix) | Post-August |

---

## Pricing

| Tier | Price | Status |
|---|---|---|
| Free (Freemium) | £0 | Live |
| Monthly | £6/mo (£4.80 early bird until 31 Aug 2026) | Live — currently using one-time test link |
| Annual | £35/yr (£28 early bird until 31 Aug 2026) | Live |
| Professional (therapist) | £70 | Phase 2 — greyed out |
| School | Contact pricing | Phase 2 — greyed out |

---

## Key People

| Person | Role |
|---|---|
| Saira Mohsin | Founder — dyscalculia specialist, TA background, MBA |
| Taimur | Technical lead — managing all development |
| Ramzan | Contractor — GDPR, ICO, trademark, visa docs, Companies House |
