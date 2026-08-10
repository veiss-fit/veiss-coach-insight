# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server (Vite, hot-reload)
npm run build      # production build
npm run build:dev  # development build (for debugging)
npm run lint       # ESLint
npm run preview    # preview production build locally
```

There is no test suite configured.

## Environment

Requires a `.env.local` file with:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Architecture

**Veiss Coach Insight** is a coach-only dashboard for managing athletes, tracking velocity-based training metrics, and sending workout programming. It is a Vite + React 18 + TypeScript SPA backed by Supabase.

### Auth & Access Control

`AuthContext` (`src/contexts/AuthContext.tsx`) wraps the entire app. It reads `profiles` → optionally joins `coaches` → sets the `profile` state. Only users with `role === 'coach'` can access the app; non-coaches are signed out immediately. `ProtectedRoute` (`src/components/ProtectedRoute.tsx`) enforces auth and optional role checks for each route.

### Routing

| Path | Component | Guard |
|------|-----------|-------|
| `/` | `Index` (Team pulse dashboard) | coach |
| `/athlete/:id` | `AthleteDashboard` | coach |
| `/send-programming` | `SendProgramming` (Build + Templates tabs, `?tab=templates`) | coach |
| `/messages` | `Messages` | coach |
| `/history` | `History` | coach |
| `/profile` | `Profile` | any auth |
| `/login`, `/signup` | public | — |

### Data Layer

All Supabase access goes through `src/lib/supabase.ts` (typed client via `src/types/database.ts`) and the service modules in `src/services/`:

- `playersService.ts` — primary service; exports `PlayerWithStats` (player row + computed `avgVelocity`, `attendance`, `loadRec`, `avgROM`, `avgTempo`). Entry point is `getPlayersWithStatsByCoach(coachUserId)`.
- `statsService.ts` — dashboard-level aggregate stats (`DashboardStats`).
- `rosterMetricsService.ts` — 8-week per-athlete + team series (weekly velocity, sessions, plan-completion %, drop-off) via a fixed number of batched queries; feeds the dashboard KPIs, focus cards, and roster deltas. Never fetch these per-player.
- `workoutPlansService.ts` — sending/reading workout plans per player. Templates are `workout_plans` rows with `is_template = true`.
- `sessionsService.ts`, `messagesService.ts` — session and messaging data. `messages.priority` (`normal`/`urgent`) is persisted (migration 004).
- `coachFeedbackService.ts` — coach notes (`coach_feedback` rows with `feedback_type = 'note'`), shown on the athlete page.

**Data scoping**: `groups` has exactly 5 columns — `id, name, created_at, invite_code, coach_id` (confirmed live via `RETURNING *`; no `sport`, no `coach_user_id` — those appeared in the hand-written `database.ts` types but never existed in the DB and have been removed). All queries resolve `auth.uid() → coaches.id → groups.coach_id` (see `getCoachId`/`getCoachTeamIds` in `playersService.ts`); a coach with no `coaches` row scopes to zero groups, never "all groups."

**Attendance calculation** lives in `src/lib/workoutAttendance.ts` and is shared across services.

### State Management

- `AuthContext` — global auth state.
- `TemplatesContext` (`src/contexts/TemplatesContext.tsx`) — workout templates, persisted as `workout_plans` rows with `is_template = true`.
- TanStack Query is available but not yet used; data fetching is currently done in `useEffect` + local `useState`.

### UI / Design System ("Pulse")

- Design tokens live in `src/index.css`: shadcn HSL triplets (consumed by `tailwind.config.ts`) plus literal Pulse tokens (`--surface-*`, `--ink-*`, `--line-*`, status colors, `--d-*` density vars). The brand accent family is `--brand`/`--brand-soft`/`--brand-ink` (gold `#FFC300`) — the names `--accent`/`--gold` are reserved for the shadcn HSL triplets; don't mix them up.
- `v-*` CSS primitives (`v-card`, `v-chip[data-tone]`, `v-btn`, `v-table`, `v-topnav`, `v-label`, …) are defined in `index.css` under `@layer components` and used by all redesigned pages.
- `src/components/pulse/` holds the design-system React components (KpiTile, Sparkline, Delta, Donut, chips, Avatar, AttBar, PageHeader, FilterBar, UnderlineTabs, DragCalendar, VelocityZoneSlider, AthleteCard, PulseAthleteTable, and the SVG charts in `charts.tsx`). Charts are hand-rolled SVG on purpose — do not swap them for a chart library. Recharts remains a dependency only via `src/components/ui/chart.tsx`.
- `src/components/ui/` contains shadcn/ui primitives — do not modify these directly. Path alias `@/` resolves to `src/`.
- Analytics/heuristics live in `src/lib/`: `athleteSummaryUtils.ts` (per-session metrics + z-score deviation indicators), `rosterFlags.ts` (attention flags + priority score), `vbtZones.ts` (VBT zone model + `SESSIONS_TARGET`), `workoutAttendance.ts`.
- Dark mode is out of scope; the `.dark` token block exists but is unused.

### Key Domain Concepts

- **Team / Group**: a `groups` row owned by a coach via `coach_id` (FK → `coaches.id`). The UI uses "group" terminology; there is no separate `teams` table.
- **Player / Athlete**: a `players` row with an optional `team_id`. The terms are interchangeable in the codebase.
- **Workout Plan**: a scheduled plan (`workout_plans` table) sent to a player for a specific date.
- **Session / Rep**: raw hardware data uploaded by the athlete (`sessions` and `reps` tables); `reps` contains `average_rep_speed`, `rom_mm`, `concentric_duration_s` used for VBT metrics.
- **Load Recommendation**: derived from `avgVelocity` — >0.85 m/s → increase load, <0.40 m/s → decrease load.
