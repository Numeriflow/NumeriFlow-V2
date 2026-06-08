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
| Ramzan's | numeriflow.uk | Base44 + IONOS hosting | Handing over |
| Ours | numeriflow.netlify.app | Pure HTML/CSS/JS | Working — v7 |

**Our version is the active build. Target: deploy ours to numeriflow.uk.**

---

## Domain & Hosting — IONOS Details

**Registrar:** IONOS SE (1&1)  
**Account:** sairamohsin8181@gmail.com (domain registered in Saira's name directly — full ownership)  
**Domain:** numeriflow.uk — registered 11 April 2026, expires April 2028  
**Email:** info@numeriflow.uk (active on IONOS mail)

**Current DNS records (updated — pointing to Netlify):**
- `A @ → 75.2.60.5` (Netlify load balancer — changed from 216.24.57.1)
- `CNAME www → numeriflow.netlify.app` (changed from base44.onrender.com)
- All MX, SPF, DKIM, DMARC records untouched — info@numeriflow.uk preserved

**Netlify status:**
- numeriflow.uk — Primary domain ✅
- www.numeriflow.uk — Redirects to primary ✅
- DNS verification — Successful ✅
- SSL certificate — Provisioning (Let's Encrypt, automatic, imminent)

**Keep these DNS records untouched always:**
- All MX records (mx00/mx01.ionos.co.uk)
- SPF TXT record
- DMARC CNAME
- DKIM CNAMEs (s1-ionos, s2-ionos, s1, s2 _domainkey)
- Sendgrid/Resend records

---

## Our Tech Stack

- **Pure HTML/CSS/JS** — no frameworks, no build step, no server required
- **13 files:** index.html, login.html, signup.html, dashboard.html, assessment.html, join.html, play.html, learning-program.html, style.css, _redirects, netlify.toml, og-image.jpg, NUMERIFLOW_PROJECT_BRIEF.md
- **Storage:** localStorage — cross-device Supabase sync is post-August work
- **Audio:** Web Audio API — no files needed
- **Deployment:** drag zip to netlify.com/drop — latest is numeriflow-v7.zip

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

**Logo:** Ramzan's badge/crest — transparent PNG (background removed via remove.bg + Python). Embedded as base64 data URI in all HTML files. Works on any background colour. Height: 38–52px depending on context.

---

## localStorage Keys

| Key | Purpose |
|---|---|
| `nf_children` | Array of child profiles |
| `nf_active_child` | Active child index (integer) |
| `nf_child` | Legacy — mirrors active child |
| `nf_assessment_N` | Per-child assessment (N = index) |
| `nf_assessment` | Legacy — mirrors active child's assessment |
| `nf_code_N` | Per-child 6-digit play code |
| `nf_user` | Logged-in parent details |
| `nf_pro` | `"true"` when access code unlocked |

**Critical:** Always clear `nf_assessment` before syncing on child switch. Fixed in v3.

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

---

## Bugs Fixed

| Bug | Version fixed |
|---|---|
| Child data bleeding between children | v3 |
| Assessment report not visible afterwards | v3 (new learning-program.html) |
| Music input no back/delete button | v3 |
| Netlify 404 on /join /play etc | v6 (_redirects + netlify.toml) |
| Child switcher no Add Another with 1 child | v3 |
| netlify.toml plugins syntax error | v6 fixed |

---

## Features Added

| Feature | Detail |
|---|---|
| Beat counting music question | Drum beats via Web Audio, MCQ answer, visual dots |
| Haptic feedback | vibrate() on correct/wrong/levelup/pad tap/melody/beat/star |
| Access code unlock | NUMERIFLOW2026 → nf_pro:true, PRO badge in sidebar |
| Learning program page | learning-program.html — full profile, skills, curriculum, program grid |
| Meta/OG tags | All pages — descriptions, og:image, twitter card, canonical, robots |
| Phase 2 greyed out | Therapist + School roles disabled on signup + index with "Soon" badges |
| Transparent logo | PNG with background removed, embedded base64 in all pages |
| og-image.jpg | 1200×630 social preview image — navy bg, logo, tagline |

---

## Pricing Tiers

| Tier | Price | Phase |
|---|---|---|
| Free | £0 | 1 — live |
| Monthly | £6/month | 1 — live |
| Lifetime | £35 one-time | 1 — live |
| Professional (therapist) | £70 | 2 — greyed out |
| School | Contact pricing | 2 — greyed out |

**Stripe:** not yet integrated. For demo: use Stripe Payment Links (1 hour, no code). Full integration needs Supabase first (post-August, ~1 week).

---

## Revenue Streams (from business plan — to build toward)

| Stream | Status | Notes |
|---|---|---|
| Direct app sales £35 lifetime | UI exists, no payment | Stripe Payment Link fastest |
| Monthly subscription £6/mo | UI exists, no payment | Stripe needed |
| Professional edition £70 | Greyed out Phase 2 | — |
| In-app purchases £3/module | Not built | Post-August |
| In-app ads (free tier) CPM £2 | Not built | Needs user scale first |
| Sponsored content £500/campaign | Not built | Relevant ed companies |
| Aggregated data insights £1,000+/dataset | Not built | GDPR-compliant, anonymised only |
| School institutional licences | Not built | Phase 2 |

**Website readiness for revenue:** For August demo, at minimum Stripe Payment Links on the two active tiers. Sponsored content section on landing page (tasteful "partners" strip) could show commercial intent to investor. Data insights requires Supabase + privacy policy update — post-August.

---

## Pending Work — Priority Order

| Task | Effort | Priority |
|---|---|---|
| Confirm numeriflow.uk SSL completes and site is live | 15 min wait | **NOW** |
| Stripe Payment Links on Free→Monthly upgrade | 1 hour | High |
| og:image — improve quality (PIL default font is small) | 1 hour | Medium |
| Fix decimal float display bug in patterns questions | 1 hour | Medium |
| Sponsored content / partners strip on landing page | 2 hours | Medium |
| Expand play.html to 30 questions (currently 24) | 30 min | Low |
| Supabase cross-device persistence | 1–2 days | Post-August |
| Google Auth (currently simulated) | 1 day | Post-August |
| Full Stripe integration | 1 week | Post-August |
| PWA home screen install | 1 day | Post-August |
| Teacher/school dashboard | TBD | Phase 2 |
| Therapist dashboard | TBD | Phase 2 |
| Progress reports page | TBD | Phase 2 |
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

## August Evaluator Checklist

- [ ] numeriflow.uk SSL live and HTTPS working
- [ ] Stripe Payment Link on upgrade buttons
- [ ] Full flow test: signup → child → assessment → dashboard → join → play
- [ ] Access code demo: NUMERIFLOW2026
- [ ] Haptic test on mobile (iOS Safari / Android Chrome)
- [ ] Child switch — confirm no data bleed between children
- [ ] All 3 music question types visible in assessment and play
- [ ] info@numeriflow.uk email working
- [ ] WhatsApp preview of numeriflow.uk shows correct og:image and description
- [ ] Sponsored content / partners section on landing page
