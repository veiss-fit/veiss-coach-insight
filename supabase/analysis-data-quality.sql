-- Read-only data-quality queries for the load-velocity profile investigation.
-- Run each block separately in the Supabase SQL Editor (Dashboard → SQL Editor).
-- Nothing here writes or modifies data.

-- ═══════════════════════════════════════════════════════════════════════════
-- ITEM 1a — Overall fill rate: what fraction of reps in the last 90 days have
-- BOTH weight and average_rep_speed populated (non-null, non-zero)?
-- ═══════════════════════════════════════════════════════════════════════════
select
  count(*) as total_reps_90d,
  count(*) filter (where weight is not null and weight > 0) as reps_with_weight,
  count(*) filter (where average_rep_speed is not null and average_rep_speed > 0) as reps_with_velocity,
  count(*) filter (
    where weight is not null and weight > 0
      and average_rep_speed is not null and average_rep_speed > 0
  ) as reps_with_both,
  round(
    100.0 * count(*) filter (
      where weight is not null and weight > 0
        and average_rep_speed is not null and average_rep_speed > 0
    ) / nullif(count(*), 0),
    1
  ) as pct_with_both
from reps
where created_at >= now() - interval '90 days';


-- ═══════════════════════════════════════════════════════════════════════════
-- ITEM 1b — Per (player, exercise) regression readiness in the last 90 days.
-- "Distinct load points" = distinct weight values used for that exercise.
-- "Load range" = max(weight) - min(weight), a rough proxy for whether the
-- points actually span a useful range (3 points all at the same weight are
-- useless for a regression even though they'd pass a naive count check).
-- Adjust the WHERE/HAVING thresholds if you want a stricter or looser bar.
-- ═══════════════════════════════════════════════════════════════════════════
with valid_reps as (
  select player_id, exercise_name, weight, average_rep_speed
  from reps
  where created_at >= now() - interval '90 days'
    and weight is not null and weight > 0
    and average_rep_speed is not null and average_rep_speed > 0
),
per_combo as (
  select
    player_id,
    exercise_name,
    count(*) as rep_count,
    count(distinct weight) as distinct_load_points,
    max(weight) - min(weight) as load_range,
    min(weight) as min_weight,
    max(weight) as max_weight
  from valid_reps
  group by player_id, exercise_name
)
select
  player_id,
  exercise_name,
  rep_count,
  distinct_load_points,
  min_weight,
  max_weight,
  load_range,
  case
    when distinct_load_points >= 3 and load_range > 0 then 'PASS (>=3 loads, real range)'
    when distinct_load_points >= 3 and load_range = 0 then 'FAIL (3+ points but all same weight)'
    else 'FAIL (<3 distinct loads)'
  end as regression_readiness
from per_combo
order by regression_readiness, distinct_load_points desc, rep_count desc;

-- Summary rollup of the above — how many combos pass vs fail:
with valid_reps as (
  select player_id, exercise_name, weight, average_rep_speed
  from reps
  where created_at >= now() - interval '90 days'
    and weight is not null and weight > 0
    and average_rep_speed is not null and average_rep_speed > 0
),
per_combo as (
  select
    player_id,
    exercise_name,
    count(distinct weight) as distinct_load_points,
    max(weight) - min(weight) as load_range
  from valid_reps
  group by player_id, exercise_name
)
select
  count(*) as total_player_exercise_combos,
  count(*) filter (where distinct_load_points >= 3 and load_range > 0) as pass_regression_bar,
  count(*) filter (where distinct_load_points < 3) as fail_too_few_loads,
  count(*) filter (where distinct_load_points >= 3 and load_range = 0) as fail_no_range
from per_combo;


-- ═══════════════════════════════════════════════════════════════════════════
-- ITEM 2a — Every distinct exercise_name in use, with rep counts and how many
-- distinct players/sessions have logged it. Eyeball this list for casing/
-- whitespace/naming variants (e.g. "Back Squat" vs "back squat " vs "Squat").
-- ═══════════════════════════════════════════════════════════════════════════
select
  exercise_name,
  length(exercise_name) as raw_length,
  count(*) as rep_count,
  count(distinct player_id) as distinct_players,
  count(distinct session_id) as distinct_sessions
from reps
group by exercise_name
order by exercise_name;


-- ═══════════════════════════════════════════════════════════════════════════
-- ITEM 2b — Same data, grouped by a NORMALIZED name (trimmed + lowercased) so
-- you can see which raw variants would collapse into the same lift once
-- matched case-insensitively (this is exactly the matching rule targetEvaluation.ts
-- already uses) — and which normalized groups still contain MULTIPLE distinct
-- raw spellings, i.e. genuine variants beyond casing/whitespace that the
-- matcher would NOT catch (e.g. "Squat" vs "Back Squat").
-- ═══════════════════════════════════════════════════════════════════════════
select
  lower(trim(exercise_name)) as normalized_name,
  count(distinct exercise_name) as distinct_raw_variants,
  array_agg(distinct exercise_name) as raw_variants,
  sum(rep_count) as total_reps
from (
  select exercise_name, count(*) as rep_count
  from reps
  group by exercise_name
) t
group by lower(trim(exercise_name))
order by distinct_raw_variants desc, total_reps desc;
