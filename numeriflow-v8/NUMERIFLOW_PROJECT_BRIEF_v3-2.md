# NumeriFlow — Project Brief
*Last updated: June 2026 — paste or upload to any new chat*

---

## Situation Summary

UK EdTech platform for children with **dyscalculia**.  
Founder: **Saira Mohsin** (Teacher's Assistant, Jumeirah Primary School Dubai, dyscalculia specialist, MBA IBA Karachi).  
Managed by: **Taimur** (Saira's husband).  
Deadline: **August 2026 — Innovator Founder visa investor body meeting.**

**Ramzan** (contractor) charged £6,750 for company admin + portfolio site + visa support docs. The £22,000 figure was a separate document prepared to show as part of £50k investment evidence for the visa. Call went well — he has agreed to hand over website rights and domain. He stays on for: GDPR/ICO registration, trademark filing, checkpoint reports, Companies House filings, visa guidance. Technical build is now fully ours.

---

## Two Versions

| Version | URL | Stack | Status |
|---|---|---|---|
| Ramzan's | numeriflow.uk | Base44 + IONOS hosting | Handed over |
| Ours | numeriflow.uk (live) | Pure HTML/CSS/JS | **V8 deployed** |

---

## Domain & Hosting

**Registrar:** IONOS SE — account: sairamohsin8181@gmail.com (Saira's name — full ownership)
**Domain:** numeriflow.uk — registered 11 April 2026, expires April 2028
**Hosting:** Netlify — numeriflow.netlify.app → numeriflow.uk (primary domain)
**DNS:** A record → 75.2.60.5 (Netlify), CNAME www → numeriflow.netlify.app
**Email:** info@numeriflow.uk (IONOS mail — MX/SPF/DKIM/DMARC all intact, do not touch)
**SSL:** Active via Let's Encrypt on Netlify

---

## Tech Stack

- **Pure HTML/CSS/JS** — no frameworks, no build step, no server
- **14 files:** index.html, login.html, signup.html, dashboard.html, assessment.html, join.html, play.html, learning-program.html, style.css, nf-core.js, logo.png, og-image.jpg, _redirects, netlify.toml
- **Storage:** localStorage — cross-device Supabase sync is post-August
- **Audio:** Web Audio API — no files needed
- **Deployment:** drag zip to netlify.com/drop — latest is numeriflow-v8.zip

---

## Design System (style.css)

| Token | Value |
|---|---|
| `--green` | `#1D9E75` (primary) |
| `--purple` | `#7F77DD` (music therapy) |
| `--amber` | `#EF9F27` (warnings/priority) |
| `--coral` | `#D85A30` (errors) |
| `--gray-900` | `#2C2C2A` |
| Headings | Nunito 900 |
| Body | Quicksand 500/700 |

**Logo:** logo.png — transparent PNG (background removed). Embedded as `<img src="logo.png">` in all pages. Badge/crest style — dark navy, teal ring, blue ribbon, "NUMERIFLOW" white bold, "KIDS LEARNING" below.

---

## localStorage Keys

| Key | Purpose |
|---|---|
| `nf_children` | Array of child profiles |
| `nf_active_child` | Active child index (integer) |
| `nf_child` | Legacy — mirrors active child |
| `nf_assessment_N` | Per-child assessment (N = index) |
| `nf_assessment` | Legacy — mirrors active child |
| `nf_code_N` | Per-child 6-digit play code |
| `nf_user` | Logged-in parent details |
| `nf_pro` | `"true"` when access code unlocked |
| `nf_all_users` | Registry of all signed-up emails (survives localStorage.clear) |

**Critical:** `localStorage.clear()` runs on every new signup AND every login — preserving only `nf_all_users`. This prevents child data bleeding between accounts on the same device.

---

## nf-core.js — Central Module (v8)

Key functions available on `window.NF`:

| Function | Purpose |
|---|---|
| `NF.getUser()` | Returns current logged-in user object |
| `NF.setUser(obj)` | Saves user to localStorage |
| `NF.isPro()` | Returns true if nf_pro=true or plan=monthly/annual |
| `NF.requireAuth(redirect)` | Redirects to login if not logged in |
| `NF.goToCheckout(plan)` | Opens Stripe link for 'monthly' or 'annual' |
| `NF.showPaymentGate()` | Shows upgrade modal for free users |
| `NF.showCodeEntry()` | Shows access code entry modal |
| `NF.tryAccessCode(code)` | Validates and unlocks pro access |
| `NF.handleStripeReturn()` | Handles ?success=1 after Stripe payment |
| `NF.logSignup(userData)` | Posts signup to Formspree |
| `NF.displayNum(n)` | Safe number display (fixes float bug) |
| `NF.safeAdd(a,b)` | Float-safe addition |

**Stripe links (test mode — switch to live before August):**
- Monthly £6: `https://buy.stripe.com/test_6oU14oeW473A49W5122go00`
- Annual £35: `https://buy.stripe.com/test_8x25kEdS01Jg0XK1OQ2go01`

**Formspree ID:** `mykawpbe`
**Formspree account:** sairamohsin8181@gmail.com

---

## Assessment (assessment.html)

- Parent selects year group (Y1–Y6), Key Stage auto-detected from age
- 5 game types: counting, comparison, patterns, arithmetic, music
- 15–18 questions per session, randomised
- 3 music question types: rhythm tap, melody repeat, beat counting
- Scores from accuracy + response time → skill bars
- Writes both `nf_assessment_N` and `nf_assessment` on completion
- UK curriculum objectives mapped per year group in CURRICULUM_CONFIG

---

## Play (play.html)

- Entry via join.html → 6-digit code → Pip greets → tile selection
- URL: `play.html?game=TYPE`
- Adaptive difficulty — reads assessed level, adjusts in real time
- 24 questions per session, stars every 3 correct, level-up every 8 streak
- Pip the Fox reacts to every answer (SVG animated, pure code)
- Music rotates: rhythm → melody → beat count
- **Gated:** free users see payment modal, pro users play freely

---

## Auth Flow (v8)

- **Signup:** name + email + password → `localStorage.clear()` → save user → log to Formspree → redirect dashboard
- **Login:** email must exist in `nf_all_users` — blocked if not registered → `localStorage.clear()` → restore session
- **Email verification:** NOT YET ACTIVE — waiting for EmailJS setup (Service ID, Template ID, Public Key needed)
- **Access code:** `NUMERIFLOW2026` → sets `nf_pro:true` → full access

---

## Payment Gate

- `play.html` — auth check + payment gate if not pro
- `join.html` — auth check only
- `assessment.html` — auth check only (assessment is free)
- `learning-program.html` — auth check only
- Dashboard shows upgrade buttons (£6/mo + £35/yr) for free users
- After Stripe payment, `?success=1&plan=X` returns to dashboard → upgrades account automatically

---

## Features Added in V8

| Feature | Detail |
|---|---|
| nf-core.js | Central JS module — auth, Stripe, Formspree, access code, float fix |
| Stripe payment links | Test mode — monthly £6, annual £35, upgrade modal, success handler |
| Formspree logging | Every signup captured — parent name, email, role, paid status, children |
| Payment gate | play.html locked for free users — upgrade modal with Stripe buttons |
| Sponsors section | Partners strip on landing page — placeholders ready for real logos |
| Strict login | Only registered emails can log in — unregistered blocked |
| localStorage isolation | Clear on signup + login prevents data bleed between users |
| Haptic feedback | vibrate() on correct/wrong/levelup/pad tap/melody/beat/star |
| Access code | NUMERIFLOW2026 → PRO badge + full access |
| Transparent logo | PNG embedded via logo.png file (not base64 inline) |
| og-image.jpg | 1200×630 social preview image |
| Meta/OG tags | All pages — correct descriptions, robots, canonical |
| Phase 2 greyed | Therapist + School disabled on signup + pricing with "Soon" badges |

---

## Bugs Fixed in V8

| Bug | Fix |
|---|---|
| Beat count not accepting answer | Fixed class selector `.answer-btn` in assessment.html |
| Decimal float display (e.g. 1.40000000001) | safeAdd/displayNum in nf-core.js + toFixed in patterns |
| Dashboard shows old child data on new login | localStorage.clear() on login and signup |
| Play code visible before payment | renderPlayCode() now checks isPro() |
| Join link returning 404 after payment | Fixed to use `/join` path not `join.html` |
| netlify.toml catch-all blank screens | Removed — toml is now just `publish = "."` |
| Child name pre-filled in add modal | readonly trick prevents browser autocomplete |

---

## Pricing Tiers

| Tier | Price | Status |
|---|---|---|
| Free | £0 | Phase 1 — live |
| Monthly | £6/month | Phase 1 — Stripe test mode |
| Annual | £35/year | Phase 1 — Stripe test mode |
| Professional (therapist) | £70 | Phase 2 — greyed out |
| School | Contact pricing | Phase 2 — greyed out |

---

## Revenue Streams (from business plan)

| Stream | Status |
|---|---|
| Direct app sales £35/yr | UI + Stripe test — switch to live |
| Monthly subscription £6/mo | UI + Stripe test — switch to live |
| Sponsored content £500/campaign | Section on landing page — awaiting partners |
| Professional edition £70 | Phase 2 |
| In-app ads CPM £2 | Not built — needs user scale |
| Data insights £1,000+/dataset | Post-August — needs Supabase + privacy policy |
| School institutional licences | Phase 2 |

---

## Third Party Services

| Service | Account | Purpose |
|---|---|---|
| Netlify | (Taimur's account) | Hosting + deploy |
| IONOS | sairamohsin8181@gmail.com | Domain registrar |
| Stripe | info@numeriflow.uk | Payments (test mode) |
| Formspree | sairamohsin8181@gmail.com | Signup logging |
| GitHub | github.com/Numeriflow/NumeriFlow-V2 | Code repo (public) |

---

## Website Issues to Fix Before August

1. Replace fake avatar social proof in hero ("SR, JM, PK, AL")
2. Add Saira's credentials visibly — dyscalculia specialist, TA background
3. Fix free tier features — music therapy ✕ is inaccurate (it's in assessment)
4. Remove or replace placeholder partner logos before investor review
5. Progress reports listed as paid feature but page is placeholder — fix or remove
6. Add short demo video (Loom — 90 seconds of assessment flow)
7. Switch Stripe from test mode to live mode
8. EmailJS setup for email verification (need: Service ID, Template ID, Public Key)

---

## Pending Technical Work

| Task | Effort | Priority |
|---|---|---|
| Switch Stripe to live mode | 30 min | Before August |
| EmailJS email verification | 1 hour | High |
| Progress reports page (basic) | 2 hours | High |
| Supabase cross-device sync | 1–2 days | Post-August |
| Google Auth | 1 day | Post-August |
| PWA home screen install | 1 day | Post-August |
| Teacher/school dashboard | TBD | Phase 2 |
| Therapist dashboard | TBD | Phase 2 |
| React Native mobile app | 6–8 weeks | Post-August |

---

## Access Code

**`NUMERIFLOW2026`** — unlocks all features. Share with evaluators and trusted testers only.

---

## Key People

| Person | Role |
|---|---|
| Saira Mohsin | Founder — dyscalculia specialist, Teacher's Assistant background |
| Taimur | Managing tech build |
| Ramzan | Retained for: GDPR/ICO, trademark, visa checkpoint docs, Companies House |

---

## New Chat Starter Template

Copy this into any new Claude chat to resume work:

```
NumeriFlow EdTech project — dyscalculia platform, August 2026 visa deadline.
Current version: v8, live at numeriflow.uk
Code repo: github.com/Numeriflow/NumeriFlow-V2 (public)

Please read ALL these files before responding:
https://raw.githubusercontent.com/Numeriflow/NumeriFlow-V2/main/numeriflow-v8/NUMERIFLOW_PROJECT_BRIEF_v3.md
https://raw.githubusercontent.com/Numeriflow/NumeriFlow-V2/main/numeriflow-v8/index.html
https://raw.githubusercontent.com/Numeriflow/NumeriFlow-V2/main/numeriflow-v8/dashboard.html
https://raw.githubusercontent.com/Numeriflow/NumeriFlow-V2/main/numeriflow-v8/assessment.html
https://raw.githubusercontent.com/Numeriflow/NumeriFlow-V2/main/numeriflow-v8/play.html
https://raw.githubusercontent.com/Numeriflow/NumeriFlow-V2/main/numeriflow-v8/join.html
https://raw.githubusercontent.com/Numeriflow/NumeriFlow-V2/main/numeriflow-v8/learning-program.html
https://raw.githubusercontent.com/Numeriflow/NumeriFlow-V2/main/numeriflow-v8/login.html
https://raw.githubusercontent.com/Numeriflow/NumeriFlow-V2/main/numeriflow-v8/signup.html
https://raw.githubusercontent.com/Numeriflow/NumeriFlow-V2/main/numeriflow-v8/style.css
https://raw.githubusercontent.com/Numeriflow/NumeriFlow-V2/main/numeriflow-v8/nf-core.js
https://raw.githubusercontent.com/Numeriflow/NumeriFlow-V2/main/numeriflow-v8/_redirects
https://raw.githubusercontent.com/Numeriflow/NumeriFlow-V2/main/numeriflow-v8/netlify.toml

Note: logo.png and og-image.jpg are binary files — do NOT attempt to fetch them.
Copy them unchanged from v8 into any new zip you produce.

Task for this session: [DESCRIBE WHAT YOU WANT]

At the end provide a complete zip with ALL 15 files ready to deploy to Netlify.
The zip must include: all 13 files above + logo.png + og-image.jpg copied from v8.
```

## Efficient New Chat Tips

- **Bug fix / single file change:** include brief + only the relevant file(s) — not all 13
- **Full new version zip:** include all 13 URLs above
- **Strategy / copy questions:** brief only — no code files needed
- **Start message with:** "don't read full conversation" if returning to a long chat
