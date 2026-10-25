# Academic Risk Radar: Frontend Implementation Plan (Week 9 Edition)

Track J · Next.js (App Router) · Tailwind + shadcn/ui · built with Antigravity IDE  
Status: **Week 5 is done. We are executing the Week 9 Functional Gate (30 marks), preparing for Week 13 (45 marks).**

---

## 0. How to use this file

1. Put **Section 3 (Rules for the AI)** and the tokens in **Section 2** into your Antigravity workspace rules so every agent run follows them.
2. Do **Step 0 (audit)** first. It tells you what already exists from Week 5 so you don't rebuild it.
3. Work through the **P0 steps** in order. Only move to P1 when P0 is merged and demoable. Do not ask the agent to "build everything" in one prompt.
4. Run the **review checklist (Section 8)** before merging each step.
5. Keep the **AI engineering log (Section 9)**. Honest logging helps you at viva and is graded in Week 13.

The aim is not to hide that AI was used. It is a product with a clear design point of view, code your team understands, and decisions you can defend.

---

## 1. What Week 9 is actually grading (30 marks)

Week 9 checks whether Week 5 commitments became real implementation. From the rubric, the frontend contributes to:

| Rubric area | What the frontend must show | Priority |
|---|---|---|
| **Backend/API/database implementation** | UI reads and writes **real DB data** through the API. No mock JSON left on any demoed screen | P0 |
| **Authentication / authorization** | Real login, role-based routes, 403 pages, a student **cannot** open another student's record | P0 |
| **Server Actions and CRUD** | At least one full create / read / update flow (intervention logging, alert acknowledgement) via Server Actions with validation | P0 |
| **Product functionality** | The primary journey works end to end: alert → mentor acknowledges → logs intervention → outcome recorded | P0 |
| **Performance / security** | Loading states, pagination, no secrets in client, validated inputs, no sensitive data in logs | P1 |
| **Code quality / viva** | Small components, typed code, every member can explain what they own | P0 (ongoing) |

### Non-Negotiable Product Constraints:
- Student view is **non-alarming**, with plain first-person copy and no comparisons with other students.
- Every risk shows **$\ge 3$ ranked contributing factors**.
- Risk bands are never shown as a grade or label that could follow a student around.
- Sys Admin must not see raw marks; students must not see anyone else's data. Enforce in the API, not only the UI.

---

## 2. Design system (unchanged from Week 5, keep it)

Calm, academic, warm. A well-kept library, not a hospital monitor.

| Token | Value | Use |
|---|---|---|
| `--paper` | `#FAF7F2` | Page background |
| `--surface` | `#FFFDF9` | Cards, panels |
| `--ink` | `#2B2623` | Primary text |
| `--ink-muted` | `#6F665E` | Secondary text |
| `--line` | `#E6DFD5` | Borders |
| `--accent` | `#3F5E5A` | Primary actions, links |
| `--accent-soft` | `#E4ECE9` | Accent backgrounds |
| `--steady` | `#6B8F71` | On track (sage) |
| `--watch` | `#C9963B` | Worth a look (ochre) |
| `--support` | `#B5654A` | Needs support (clay, not red) |

- **Fonts:** **Source Serif 4** (headings), **IBM Plex Sans** (body/UI), `tabular-nums` for table numbers. No Inter, Geist, Poppins.
- **Controls & Radius:** Radius 6px controls / 10px cards. Borders over shadows. No gradients, glass effects, glows.
- **Accessibility:** Never colour alone for a band: always icon + text label. AA contrast everywhere.
- **Band language:** Student sees **Steady / Worth a look / Let's talk**; Mentor sees **Steady / Watch / Needs support**.

*Note: If Week 5 already used different values, keep what shipped and update `docs/design-system.md` to match. Consistency beats the plan.*

---

## 3. Rules for the AI (paste into workspace rules)

```
PROJECT: Academic Risk Radar frontend (Next.js App Router, TypeScript, Tailwind, shadcn/ui).

STYLE
- Follow docs/design-system.md. Use CSS variables, never hard-coded hex in components.
- Fonts: Source Serif 4 (headings), IBM Plex Sans (body). No other fonts.
- No gradients, glassmorphism, glow effects, emoji as icons, decorative blobs.
- Icons: lucide-react only, 16 or 20px, stroke 1.5.
- Borders over shadows. Radius 6px controls / 10px cards.
- No hero sections, marketing feature grids, or "Welcome back!" banners.

COPY
- Plain, specific, human. Never: Unlock, Empower, Seamless, Leverage, Supercharge.
- No exclamation marks. No "Oops!".
- Errors say what happened and what to do next.
- Student-facing text never uses: "risk of failing", "danger", "alert", "warning".
- Empty states explain why they are empty and what the user can do.

CODE
- TypeScript strict. No `any`. Zod schemas in packages/shared-types, shared by client and server.
- Components under ~120 lines, one responsibility.
- Server components by default; "use client" only for state, effects, events.
- Reads: server components. Client lists: TanStack Query. Mutations: Server Actions.
- No business logic in components (scoring and band decisions live in packages/scoring-engine).
- Authorisation is enforced in the API / server action. UI hiding is never the only check.
- Every list/table/page handles loading, empty, and error states.
- Every interactive element is keyboard reachable with a visible focus ring.
- User-visible strings go through the i18n helper.
- Domain names: MenteeRow, FactorList, InterventionForm. Not Card1, DataComponent.
- Comments only where the reason is non-obvious.

PROCESS
- Do exactly the step asked. Do not add pages, libraries or features not requested.
- Do not touch files outside the step's scope. If something outside looks broken, say so instead of fixing it.
- If a requirement is unclear, ask before generating.
```

---

## 4. Why generated UIs look generated, and what we do instead

| Telltale | Our alternative |
|---|---|
| Purple/blue gradient hero | Flat warm paper, no hero |
| Inter everywhere | Source Serif 4 + IBM Plex Sans |
| Same rounded card repeated six times | Table for lists, split view for detail, timeline for history |
| Emoji bullets | lucide icons, used sparingly |
| Stat-card row on every page | A "needs attention today" list for mentors |
| Generic copy | Specific copy: "CA2 dropped for 4 mentees since CA1" |
| Placeholder data (John Doe, 85%) | Realistic seeded data (Section 7) |
| Toasts for everything | Inline confirmation next to the action |
| Everything symmetrical | One clear primary action per screen |

---

## 5. Project structure (frontend side)

```
apps/web/
├── app/
│   ├── (auth)/login/
│   ├── (student)/my-progress/
│   ├── (mentor)/
│   │   ├── today/
│   │   ├── mentees/[id]/
│   │   ├── inbox/
│   │   └── interventions/
│   ├── (instructor)/sections/[id]/
│   ├── (hod)/department/
│   ├── (dean)/institution/
│   ├── (admin)/{model-versions,thresholds,connectors,audit-log}/
│   ├── forbidden/                 # 403 page
│   ├── api/v1/...
│   └── layout.tsx
├── components/
│   ├── ui/        layout/        risk/        mentor/
│   ├── intervention/             charts/      states/
├── lib/
│   ├── auth/      i18n/          api/         format/
├── actions/                       # Server Actions, one file per domain
└── middleware.ts
```

*Anything already built in Week 5 stays where it is. Move files only if the audit shows a real problem.*

---

## 6. Build steps

### STEP 0: Audit what exists (do this today, 1–2 hours)

Have one person (tech lead) do this, not the AI alone.

**Prompt for Antigravity:**
> Read-only task. Do not change any files. Scan apps/web and produce docs/week9-audit.md with: (1) every route that exists and whether it fetches real data from the API or uses mock/hard-coded data, (2) every component over 150 lines, (3) places where role is hard-coded, (4) screens missing loading, empty or error states, (5) any `any` types, hard-coded hex colours, or inline user-facing strings. List findings only, no fixes.

**Then:** The team reads the audit together and decides the cut line below. Don't skip the human read.

---

### Priority Tiers

- **P0: must be demoable at the Week 9 gate.** Steps B1–B5.
- **P1: strengthens marks if P0 is done.** Steps B6–B8.
- **P2: defer to Week 13.** Everything in Phase C.

*If you have fewer than ~4 working days, **do B1, B2, B3 and B5 only** and keep the rest as documented backlog. A solid working slice scores better than five half-wired screens, and the rubric penalises mock data where real behaviour is expected.*

---

### PHASE B: Week 9 Work

#### B1 (P0). Real authentication and role protection
**Lead Owner:** Pawan (Tech Lead / Core Security) + Backend Team

**Prompt:**
> Replace the hard-coded role helper in lib/auth with real session handling against the login endpoint (JWT in httpOnly cookies, as defined by the backend). Build /login with Zod validation and specific inline errors ("That email and password don't match. Check both and try again."). Add middleware.ts that reads the session and redirects each role to its landing route (mentor → /mentor/today, student → /student/my-progress). Add a /forbidden page for role mismatches. Add a getSessionOrRedirect() helper for server components. Do not add registration or password reset.

**Done when:**
- [ ] Logging in as each seeded role lands on the right page
- [ ] Student opening a mentor URL gets /forbidden
- [ ] Logged-out user is sent to /login and returned to the original page after login
- [ ] Playwright test covers the student→mentor URL denial

**Viva question to prepare:** "Why isn't the middleware redirect enough on its own?" (Answer: the API must also check, because anyone can call it directly.)

---

#### B2 (P0). Wire every demoed screen to real data
**Lead Owner:** Nilesh (M1/M2 Data Lead) + Frontend

**Prompt:**
> Using docs/week9-audit.md, replace every remaining mock or hard-coded data source on the routes /mentor/today, /mentor/mentees, /mentor/mentees/[id] and /student/my-progress with real calls to the API. Use server components for the initial read and TanStack Query only for the sortable mentee table. Keep existing loading, empty and error states working. Add pagination (page size 25) to the mentee table using server-side params. Do not change layouts or styling.

**Done when:**
- [ ] `grep -r "mock" apps/web` finds nothing in demoed routes
- [ ] Stopping the API shows the error state, not a blank page
- [ ] A mentor with zero mentees shows the empty state

---

#### B3 (P0). Alert inbox with bulk acknowledgement (Server Actions)
**Lead Owner:** Vani (M4/M5 Alert Routing Lead) + Frontend

**Prompt:**
> Build /mentor/inbox: a table of alerts with row checkboxes, select-all, and a BulkActionBar that appears on selection ("Acknowledge 4"). Show SLA time remaining in plain words ("due in 6 hours", "overdue by 1 day"). Implement acknowledgement as a Server Action in actions/alerts.ts that validates input with a shared Zod schema, checks the session role and that each alert belongs to this mentor's mentees, then updates the DB. On the client, update optimistically and roll back with an inline message if the action fails. Space toggles a row; shift-click selects a range.

**Done when:**
- [ ] Acknowledging 20 alerts persists after refresh
- [ ] Acknowledging another mentor's alert is rejected by the server (write the test)
- [ ] Failure rolls back and shows what happened

---

#### B4 (P0). Intervention logging and outcome (full CRUD)
**Lead Owner:** Piyush Kumar Singh (M6/M7 Interventions Lead) + Backend

**Prompt:**
> Build InterventionForm in components/intervention using a Server Action in actions/interventions.ts. Fields: type (select), notes, agreed next step, follow-up date. Validate with the shared Zod schema; show field-level errors inline. Save to DB, then show the new entry at the top of the OutcomeTimeline on /mentor/mentees/[id]. Add edit (notes and next step only) and a close-the-loop form with outcome: improved / same / worse / not reached. No delete in this step; use an "withdrawn" status instead so history is kept. Server action must verify the mentor is assigned to this student.

**Done when:**
- [ ] Create, read, update all work against the DB.
- [ ] A mentor not assigned to the student is refused server-side.

---

#### B5 (P0). The full primary journey, end to end
**Lead Owner:** Whole team (Pawan drives)

Rehearse this exact path with real seeded data and no manual DB edits:

1. Mentor logs in → **Today** shows a mentee whose band changed
2. Opens **Inbox**, acknowledges the alert
3. Opens the mentee → sees **$\ge 3$ ranked factors** with source links
4. **Logs an intervention** with a follow-up date
5. Later records the **outcome**
6. Logs in as the student → **My progress** shows their own factors in calm wording
7. Student tries another student's URL → **denied with 403**

*Write this as one Playwright journey. If any step needs a workaround, that is the next thing to fix.*

---

#### B6 (P1). Factor attribution visual
**Lead Owner:** Piyush Kumar Singh (M7 Dashboard Lead) + Pawan (M3 Scoring alignment)

**Prompt:**
> Build FactorBar in components/risk: a horizontal bar per factor showing its relative weight, a plain-language sentence, and a link to the source record view (for example the attendance log). Include a screen-reader text alternative. Use in mentor mentee detail; keep the simpler FactorList on the student page. Minimum three factors always shown, ranked by weight.

**Done when:** Every factor link opens a real record, and the bar widths match the numbers the API returns.

---

#### B7 (P1). HoD and Dean aggregate views
**Lead Owner:** Piyush Kumar Singh (M7 Analytics Lead)

**Prompt (HoD):**
> Build /hod/department: band distribution by course (Recharts, tokenised colours), mentor response-time table, date-range filter. Data is aggregated and paginated server-side. Do not render student names unless the user drills into a course. Server component reads only the signed-in HoD's department; reject other department ids at the API.

*Dean:* Same pattern at institution level, read-only, with audit report links.  
*Instructor:* Own sections only, academic indicators, no mentoring notes.

---

#### B8 (P1). Admin screens (minimum)
**Lead Owner:** Pawan (M8 Admin Lead)

- **Model versions:** List with effective dates, weights, thresholds, and activation button.
- **Thresholds editor with simulation preview:** Before saving, call `POST /api/v1/admin/model-versions` with preview mode to show: *"This change moves 4 students between bands"*. Saving requires explicit confirmation (`commit: true`).
- **Audit log viewer:** Interactive table with `entityType`, date, actor filters and paginated reader.
- Sys Admin must **not** see raw marks anywhere on these pages.

---

#### B9 (P1). Performance and security pass
- Lazy-load charts; `next/image` for any images; check bundle with the analyzer
- Confirm no secrets or personal data in client bundles or console logs
- All inputs validated with Zod on the server, not just the client
- Rate-limit login attempts (backend) and show a clear message in the UI
- axe-core on every student page; fix critical issues
- Test at 360 / 768 / 1280 px

---

### PHASE C: Week 13 (Final Product, 45 Marks) — Plan now, build after Week 9 gate

| Step | Work |
|---|---|
| **C1** | Accessibility audit: axe in CI, keyboard-only walkthrough, screen reader pass on student pages, reduced motion |
| **C2** | i18n: every literal into lib/i18n; hi.json and pa.json reviewed by a native speaker; language switcher |
| **C3** | Edge cases: session expiry mid-form, slow/offline states, a missing data source ("attendance data isn't available yet"), long names, 0 mentees, 500 mentees (virtualised table) |
| **C4** | Test suite: component tests for shared components and forms; Playwright journeys for all acceptance criteria; visual check at three widths |
| **C5** | Deployment: Vercel for web, env vars documented, Sentry (no personal data), uptime check on /health, CI green |
| **C6** | Innovation: one genuinely original feature (for example a "what changed since last meeting" diff for mentors, or a printable one-page mentor briefing). Prepare a 5-minute walkthrough per member |

---

## 7. Seed data (so screens look real)

- 40–60 students across 3 programmes (B.Tech CSE, ECE, BCA), realistic regional name mix
- Attendance mostly 78–95%, a handful dipping from ~88% to ~70% across several weeks
- CA1/CA2/CA3 and MTE marks on actual scale, some with a sharp CA2 drop
- Realistic course codes (CSE326, INT252…) with real course names
- 4–5 students with missing LMS data to exercise partial-data states
- One mentor with 15–20 mentees, one with none, one HoD, one Dean, one admin, one instructor
- A few alerts already past SLA to show the escalation state

---

## 8. Review checklist (per step)

- **Look:** Tokens only · correct fonts · no gradients/glows/emoji icons · layout varies by purpose
- **Copy:** No banned words · no exclamation marks · student screens avoid risk/fail/danger/alert/warning · empty and error states helpful
- **Code:** Component < ~120 lines · no `any` · no business logic in components · loading/empty/error handled · strings via i18n
- **Security:** Server checks role and ownership · Zod on the server · nothing sensitive in the client
- **Access:** Keyboard works · focus visible · AA contrast · band never colour-only · responsive at 360px
- **Understanding:** Someone other than the author can explain it

---

## 9. AI engineering log (graded in Week 13)

Maintain in `docs/ai-engineering-log.md`, one entry per significant prompt session:

```
Date:
Step:
What I asked:
What it produced:
What I changed and why:
What it got wrong / what I learned:
```

*Include the failures. A log showing you rejecting and fixing output is stronger evidence of engineering judgment than one where everything was accepted without review.*

---

## 10. Week 9 viva preparation

Every member must be able to answer these without opening the code:

1. Where is authorisation enforced, and why is hiding a button not enough?
2. Walk through what happens when a mentor acknowledges an alert: client, server action, DB.
3. How do you stop mentor A acknowledging mentor B's alert?
4. Why Server Actions for writes and server components for reads?
5. How does a factor shown on screen trace back to a source record?
6. What changed between your Week 5 demo and now?
7. What did the AI get wrong in the component you own, and how did you fix it?
8. What happens if one data source is down?

---

## 11. Planned Team Work Division (Aligned with Master Blueprint)

| Team Member | Module Ownership | Week 9 Focus Areas |
|---|---|---|
| **Pawan** *(Tech Lead)* | **M3** (Risk Scoring Engine)<br>**M8** (Configuration & Audit) | • Step 0: Monorepo & UI audit<br>• B1: Session handling, middleware route protection (`/forbidden`)<br>• B8: Admin model version simulator & audit log viewer<br>• Negative-access RBAC integration tests & PR gating<br>• B5: Lead full primary journey rehearsal |
| **Vani** | **M4** (Trend & Anomaly Detection)<br>**M5** (Alert Routing & Mentor Inbox) | • B3: Alert Inbox table (`/mentor/inbox`) with bulk acknowledgement Server Actions<br>• SLA time-remaining badges & HoD escalation handling<br>• Multi-week seed data tuning for downward trend detection |
| **Nilesh** | **M1** (Ingestion & Normalisation)<br>**M2** (Student Academic Profile) | • B2: Wire mentee profile lists & academic history to live API<br>• Server-side table pagination (page size 25) for mentee directories<br>• Partial-data states handling (e.g. missing LMS or attendance) |
| **Piyush Kumar Singh** | **M6** (Interventions & Outcome Tracking)<br>**M7** (Dashboards & Reporting) | • B4: Intervention logging form (`/mentor/interventions`) & outcome recording CRUD<br>• B6: FactorBar visual component & non-alarming student view<br>• B7: HoD (`/hod/department`) & Dean (`/dean/institution`) analytics views<br>• B9: Accessibility audit (axe-core, keyboard accessibility, 360px mobile check) |

---

*Run a full dress rehearsal of the B5 journey at least one day before the Week 9 evaluation gate.*
