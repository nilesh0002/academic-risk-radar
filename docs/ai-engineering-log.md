# AI Engineering Log (Academic Risk Radar)

This document tracks the prompts, technical decisions, and code changes made during the AI-assisted development of the platform, specifically tailored for the final defense viva.

---

# Team Member 2 (Vani Bhardwaj — Module M4 & M5)

## Stage 1: Foundation (Week 5)

**Goal:** Establish schemas, pure baseline math helper, and synthetic seed data generator.
- **Prompts Used:**
  - *"Implement the Alert and MentorAssignment schemas in schemas.ts according to the api-contract."*
  - *"Build a pure mathematical rolling baseline computation helper calculateRollingBaseline."*
  - *"Create a deterministic multi-week synthetic seed generator engineering 15-20% of students with academic downward deterioration."*
- **Technical Decisions:**
  - Designed `calculateRollingBaseline` and `computeTrendDeteriorationSignal` as pure functions with zero framework or database imports, allowing byte-level reproducibility and rapid unit testing.
  - Engineered the synthetic seed generator with deterministic pseudo-random number generation (PRNG), ensuring reproducible datasets where 18% of students exhibit measurable drop in attendance (90% -> 30%) and assessments.

## Stage 2: Functional System (Week 9)

**Goal:** Build full trend analysis service, alert routing with deduplication, mentor inbox API, BullMQ SLA escalation worker, and mentor inbox UI.
- **Prompts Used:**
  - *"Implement `trends.service.ts` to partition raw student records into chronological weekly windows and compute trend deterioration signals."*
  - *"Build alert generation and deduplication logic: high/critical risk snapshots generate alerts, and existing open alerts are updated without duplicate creation."*
  - *"Implement mentor inbox API with strict RBAC ensuring mentors can only query their own alerts, and add rate limiting."*
  - *"Build BullMQ SLA escalation worker checking for overdue open alerts and escalating to HoD with immutable audit logs."*
  - *"Build responsive dark-themed Mentor Alert Inbox UI with real API connection, SLA badges, and one-click acknowledgement."*
- **Technical Decisions:**
  - **Deduplication Rule:** Enforced a strict database query checking for existing open alerts before creating a new alert. When a student already has an active open alert, the newest `riskSnapshotId` is linked in place, preventing alert fatigue and inbox flooding.
  - **NoSQL Injection Defense:** Applied strict `sanitizeId` and `sanitizeStudentId` regex allowlists across all route parameters and query arguments in M4 and M5 routers.
  - **SLA Breach Escalation:** Automated background SLA tracking via BullMQ `alert-escalation-queue`. Overdue alerts transition to `status: "escalated"` and generate an append-only `AuditEntry` record alongside real-time console notifications for the Head of Department (HoD).
  - **Frontend Integration:** Crafted a modern, accessible Next.js Mentor Inbox (`/inbox`) matching the dark navy aesthetic, featuring live countdown badges, search filtering, and one-click acknowledgement.

---

# Team Member 4 (Piyush Kumar Singh - Module M6 & M7)

## Stage 1: Foundation (Week 5)

**Goal:** Establish schemas and role page scaffolds.
- **Prompts Used:** 
  - *"Implement the Intervention schema in schemas.ts according to the api-contract."*
  - *"Create Next.js page scaffolds for Instructor, Mentor, HoD, and Dean roles returning 501 Not Implemented."*
- **Technical Decisions:** 
  - Designed the `Intervention` schema as appendable, tracking both the initial action and a follow-up outcome securely.
  - Implemented the `/student/risk` UI with supportive, non-alarming language and a calm color palette as mandated by the requirements (avoiding red/panic styling).

## Stage 2: Functional System (Week 9)

**Goal:** Build the API endpoints and Mentor Intervention UI with DB persistence and RBAC.
- **Prompts Used:**
  - *"Implement `createIntervention` and `updateInterventionOutcome` controllers with strict RBAC ensuring only mentors can modify their own assigned interventions."*
  - *"Fix the CodeQL high-severity NoSQL injection and regex injection vulnerabilities in the analytics and interventions controllers."*
  - *"Install express-rate-limit and apply it to M6/M7 routes to resolve DoS vulnerability flags."*
- **Technical Decisions:**
  - Used MongoDB Aggregation Pipelines in `analytics.controller.ts` to efficiently compute band distributions and time-series trends in a single database pass, rather than pulling all snapshots into application memory.
  - Hardened endpoints against injection attacks using a dedicated `sanitizeId` allowlist for `alertId` and `mentorId`, and escaped user-controlled regex parameters.
  - Covered all endpoints with exhaustive integration tests (`supertest`) asserting 403 Forbidden for unauthorized role access.

## Stage 3: Product Readiness (Week 13)

**Goal:** Build the visualization dashboards and closed-loop outcome tracking.
- **Prompts Used:**
  - *"Install `recharts` and build the Instructor Dashboard displaying a risk breakdown pie chart and attendance deficit bar chart."*
  - *"Build the HoD and Dean dashboards with stacked bar charts and SLA escalation trend lines."*
  - *"Add a visual 'Closed-Loop Outcome Tracking' indicator to the Mentor Interventions UI that shows the before/after risk band shift."*
- **Technical Decisions:**
  - **Visualization Library:** Selected `recharts` for React as it provides responsive, accessible SVG charts that integrate cleanly with our predefined `BAND_COLORS`.
  - **API Contract Extension:** Added a new `GET /api/v1/analytics/section/:id` endpoint since the original Stage 1 contract lacked a granular section-level aggregation endpoint required for the Instructor Dashboard.
  - **Closed-Loop Tracking:** Implemented a visual shift indicator (e.g., `High → Moderate`) in the UI when a mentor records a successful outcome, demonstrating the measurable impact of the intervention pipeline.

---
*Maintained for Academic Risk Radar final evaluation.*
