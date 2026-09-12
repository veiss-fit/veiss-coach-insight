# Database Guide — Veiss Coach Insight

**Artifact:** https://claude.ai/code/artifact/8cb410c5-a18b-401a-8aa0-c411b71cd8bf

A plain-language walkthrough of the Supabase schema: how the data model works today, the
current security state, and the exact changes Live Mode needs.

Private to the `teamveiss@gmail.com` account unless shared from the page's share menu.
All your artifacts are listed at https://claude.ai/code/artifacts

---

## What it covers

| Section | Contents |
|---|---|
| 01 | The five core tables and how they relate |
| 02 | Entity-relationship diagram of the live schema |
| 03 | The data lifecycle — why Supabase only ever sees *finished* workouts |
| 04 | The RLS exposure and how to fix it safely |
| 05 | What's already done vs. what still needs building |
| 06 | Recommended order of work |

## Verified state

Read from project `xjyugqxdfrbluprtgftj` over a **read-only** connection on **2026-07-25**.
Nothing was modified. Snapshot at time of writing: 13 tables, 3 coaches, 2 groups,
3 players, 60 sessions, 2,691 reps, 30 workout plans.

Every fact in the guide came from live catalog queries, not from migration files. Where it
disagrees with `LIVE_MODE_PLAN.md` or `CLAUDE.md`, the guide is correct — see
`LIVE_MODE_PLAN.md` §3.4 for the corrections written back into the plan.

## Headline findings

1. **Seven tables have RLS policies written but not enabled**, so the policies are inert.
   An unauthenticated request with the publishable key returns all 2,691 reps. Fix this
   before any Live Mode work — and note that one of three coaches has a null
   `coaches.team_id`, so they will lose all visibility the moment RLS is switched on.
2. **`reps_unique_set_rep` already exists** — the unique constraint `LIVE_MODE_PLAN.md` §4.3
   lists as work to do is already in the database. The phone can move to batched upserts
   with no migration.
3. **Realtime is already publishing** `sessions`, `reps`, `players`, `workout_plans` and
   `workouts` — combined with finding 1, those change feeds are currently unauthorised.
4. **There is no `teams` table.** It is `groups`, keyed by `coach_id`. The application code
   is correct; `CLAUDE.md` and `src/types/database.ts` are stale.

---

## Regenerating or editing

The guide's source HTML was written to a temporary scratchpad and is not in this repo. To
update the published page at the same URL, ask Claude Code to update the artifact and pass
that URL — a session that did not publish it will otherwise mint a new link.
