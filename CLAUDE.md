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
| `/` | `Index` | coach |
| `/send-programming` | `SendProgramming` | coach |
| `/history` | `History` | coach |
| `/profile` | `Profile` | any auth |
| `/login`, `/signup` | public | — |

### Data Layer

All Supabase access goes through `src/lib/supabase.ts` (typed client via `src/types/database.ts`) and the service modules in `src/services/`:

- `playersService.ts` — primary service; exports `PlayerWithStats` (player row + computed `avgVelocity`, `attendance`, `loadRec`, `avgROM`, `avgTempo`). Entry point is `getPlayersWithStatsByCoach(coachUserId)`.
- `statsService.ts` — dashboard-level aggregate stats (`DashboardStats`).
- `workoutPlansService.ts` — sending/reading workout plans per player.
- `sessionsService.ts`, `messagesService.ts` — session and messaging data.

**Data scoping**: All queries filter by `teams.coach_user_id = auth.uid()`. Because `coach_user_id` was added in a later migration, queries fall back to returning all teams if the column is missing (see `getCoachTeamIds` in `playersService.ts`).

**Attendance calculation** lives in `src/lib/workoutAttendance.ts` and is shared across services.

### State Management

- `AuthContext` — global auth state.
- `TemplatesContext` (`src/contexts/TemplatesContext.tsx`) — in-memory workout templates (not persisted to DB; state resets on page reload).
- TanStack Query is available but not yet used; data fetching is currently done in `useEffect` + local `useState`.

### UI

`src/components/ui/` contains shadcn/ui primitives — do not modify these directly. App-specific components are in `src/components/`. Path alias `@/` resolves to `src/`.

### Key Domain Concepts

- **Team / Group**: a `teams` row owned by a coach via `coach_user_id`. The UI uses "group" terminology.
- **Player / Athlete**: a `players` row with an optional `team_id`. The terms are interchangeable in the codebase.
- **Workout Plan**: a scheduled plan (`workout_plans` table) sent to a player for a specific date.
- **Session / Rep**: raw hardware data uploaded by the athlete (`sessions` and `reps` tables); `reps` contains `average_rep_speed`, `rom_mm`, `concentric_duration_s` used for VBT metrics.
- **Load Recommendation**: derived from `avgVelocity` — >0.85 m/s → increase load, <0.40 m/s → decrease load.
