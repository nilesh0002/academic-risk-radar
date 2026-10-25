# Academic Risk Radar: Week 9 Frontend Audit Report

> **Generated as part of Step 0 of the Frontend Implementation Plan.**  
> *Scope: Read-only audit of `apps/web/` checking data wiring, component size, role hardcoding, UX states, types, and styling. Findings only, no fixes.*

---

## 1. Route Inventory & Data Source Verification

| Route | File Path | Data Source | Details / Findings |
|---|---|---|---|
| `/` | `apps/web/app/page.tsx` | Static / Local | Landing navigation links to `/risk`, `/model-versions`, and `/audit`. |
| `/risk` | `apps/web/app/(student)/risk/page.tsx` | **Hardcoded / Seeded** | Uses inline mock objects `STUDENT` and `METRICS` (Rahul Sharma) with an inline pure calculation helper. Needs wiring to `GET /api/v1/students/:id/risk`. |
| `/inbox` | `apps/web/app/(mentor)/inbox/page.tsx` | **Scaffold Only** | 10-line placeholder screen. No real data or API calls yet. |
| `/interventions` | `apps/web/app/(mentor)/interventions/page.tsx` | **Real API** | Fetches `GET /api/v1/interventions`, creates interventions (`POST`), updates outcomes (`PATCH`). Hardcodes `"x-user-role": "mentor"`. |
| `/sections` | `apps/web/app/(instructor)/sections/page.tsx` | **Real API** | Fetches `GET /api/v1/analytics/section/:id`. Hardcodes `"x-user-role": "instructor"`. |
| `/hod-dashboard` | `apps/web/app/(hod)/hod-dashboard/page.tsx` | **Real API** | Fetches `GET /api/v1/analytics/department/:id`. Hardcodes `"x-user-role": "hod"`. |
| `/dean-dashboard` | `apps/web/app/(dean)/dean-dashboard/page.tsx` | **Real API** | Fetches `GET /api/v1/analytics/institution`. Hardcodes `"x-user-role": "dean"`. |
| `/model-versions` | `apps/web/app/(admin)/model-versions/page.tsx` | **Scaffold Only** | 12-line placeholder screen. Backend API `GET/POST /api/v1/admin/model-versions` exists but UI is not connected yet. |
| `/audit` | `apps/web/app/(admin)/audit/page.tsx` | **Scaffold Only** | 12-line placeholder screen. Backend API `GET /api/v1/admin/audit` exists but UI is not connected yet. |

---

## 2. Components Over 150 Lines

The frontend implementation rule sets a target of components under ~120–150 lines. The following files currently exceed this threshold:

| File Path | Total Lines | Primary Responsibility |
|---|---|---|
| `apps/web/app/(mentor)/interventions/page.tsx` | **618 lines** | Combined intervention list, logging form, outcome recording modal, and status filters. |
| `apps/web/app/(student)/risk/page.tsx` | **559 lines** | Combined student profile header, risk banner, SVG gauges, factor contribution list, and detail drawers. |
| `apps/web/app/(hod)/hod-dashboard/page.tsx` | **189 lines** | Department analytics, metric summary cards, Recharts pie and bar graphs. |
| `apps/web/app/(dean)/dean-dashboard/page.tsx` | **185 lines** | Institution analytics, cross-department comparison table, and trend graphs. |
| `apps/web/app/(instructor)/sections/page.tsx` | **182 lines** | Section risk breakdown and attendance deficit distribution charts. |

---

## 3. Places Where Role is Hard-Coded

Currently, authenticated user role headers are hardcoded directly inside client components instead of using a unified session management or cookie system:

1. **`apps/web/app/(dean)/dean-dashboard/page.tsx:48`**  
   Header: `"x-user-role": "dean"`
2. **`apps/web/app/(instructor)/sections/page.tsx:48`**  
   Header: `"x-user-role": "instructor"`
3. **`apps/web/app/(hod)/hod-dashboard/page.tsx:49`**  
   Header: `"x-user-role": "hod"`
4. **`apps/web/app/(mentor)/interventions/page.tsx:67, 96, 136`**  
   Header: `"x-user-role": "mentor"`
5. **`apps/web/middleware.ts`**: **Missing.** Route-level role enforcement currently does not exist on the client side (only present in the Express API).

---

## 4. Screens Missing Loading, Empty, or Error States

| Screen | Loading State | Empty State | Error State |
|---|---|---|---|
| `/risk` | ❌ None (Synchronous static render) | ❌ None | ❌ None |
| `/inbox` | ❌ None (Static placeholder) | ❌ None | ❌ None |
| `/interventions` | ✅ Spinner / Loading text | ✅ "No interventions logged yet" | ✅ Error banner with retry |
| `/sections` | ✅ Loading container | ⚠️ Partial (Renders "0" if empty) | ✅ Error banner |
| `/hod-dashboard` | ✅ Loading container | ⚠️ Partial | ✅ Error banner |
| `/dean-dashboard` | ✅ Loading container | ⚠️ Partial | ✅ Error banner |
| `/model-versions` | ❌ None (Static placeholder) | ❌ None | ❌ None |
| `/audit` | ❌ None (Static placeholder) | ❌ None | ❌ None |

---

## 5. Type Safety, Hardcoded Hex Colors & Localization

### A. Usage of `any` Types
Strict TypeScript guidelines require zero `any`. The following occurrences were detected:
- `apps/web/app/(instructor)/sections/page.tsx:54` (`err: any`)
- `apps/web/app/(mentor)/interventions/page.tsx:73, 118, 150` (`err: any`)
- `apps/web/app/(dean)/dean-dashboard/page.tsx:31` (`bandCounts: any`)
- `apps/web/app/(dean)/dean-dashboard/page.tsx:33` (`bandCounts: any`)
- `apps/web/app/(dean)/dean-dashboard/page.tsx:54` (`err: any`)
- `apps/web/app/(hod)/hod-dashboard/page.tsx:32` (`bandCounts: any`)
- `apps/web/app/(hod)/hod-dashboard/page.tsx:55` (`err: any`)

### B. Hardcoded Hex Colors
Design system tokens (`--paper`, `--surface`, `--ink`, `--line`, etc.) are not yet centralized in CSS variables. Inline hardcoded hex colors are used extensively across all screens:
- `apps/web/app/layout.tsx`: `#090e1a` (navy dark background), `#0b1222`, `#1e293b`, `#f97316`
- `apps/web/app/page.tsx`: `#ffffff`, `#e2e8f0`, `#1e293b`, `#64748b`
- `apps/web/app/(instructor)/sections/page.tsx`: `#059669`, `#d97706`, `#dc2626`, `#7f1d1d`, `#eff6ff`, `#3b82f6`
- `apps/web/app/(admin)/model-versions/page.tsx` & `/audit/page.tsx`: `#ffffff`, `#64748b`
- `apps/web/app/(student)/risk/page.tsx`: `#090e1a`, `#1e293b`, `#10b981`, `#f59e0b`, `#ef4444`, etc.

### C. Inline User-Facing Strings & i18n
All UI strings across buttons, labels, and error messages are currently hard-coded in English JSX literals. No i18n dictionary or abstraction is implemented yet.
