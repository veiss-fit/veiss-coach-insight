-- Seed script: Test 108 realistic VBT data
-- Player: Test 108 (id = 297f16f4-6965-4d99-83fb-efa00ec9516b)
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Idempotent: any existing sessions tagged [seed-v1] are deleted and re-created.
-- Does NOT touch any other athlete's data.
--
-- After running, open the Test 108 athlete panel. All three RAG signals
-- (Avg Velocity, Within-Set Fatigue, Session Fatigue) should turn RED
-- because the last 3 sessions introduce a deliberate ~20 % velocity drop
-- and doubled fatigue-decay rates.

DO $$
DECLARE
  -- ── Identity ──────────────────────────────────────────────────────────────
  v_player_id  UUID   := '297f16f4-6965-4d99-83fb-efa00ec9516b';
  v_marker     TEXT   := '[seed-v1]';

  -- ── Session dates (12 sessions over 10 weeks ending 3 days ago) ───────────
  v_dates TIMESTAMPTZ[] := ARRAY[
    '2026-03-06 10:00:00+00'::TIMESTAMPTZ,   -- 1  normal
    '2026-03-11 10:00:00+00'::TIMESTAMPTZ,   -- 2  normal
    '2026-03-17 10:00:00+00'::TIMESTAMPTZ,   -- 3  normal
    '2026-03-23 10:00:00+00'::TIMESTAMPTZ,   -- 4  normal
    '2026-03-30 10:00:00+00'::TIMESTAMPTZ,   -- 5  normal
    '2026-04-06 10:00:00+00'::TIMESTAMPTZ,   -- 6  normal
    '2026-04-12 10:00:00+00'::TIMESTAMPTZ,   -- 7  normal
    '2026-04-18 10:00:00+00'::TIMESTAMPTZ,   -- 8  normal
    '2026-04-25 10:00:00+00'::TIMESTAMPTZ,   -- 9  normal  ← end of baseline pool
    '2026-05-01 10:00:00+00'::TIMESTAMPTZ,   -- 10 FATIGUED
    '2026-05-07 10:00:00+00'::TIMESTAMPTZ,   -- 11 FATIGUED
    '2026-05-12 10:00:00+00'::TIMESTAMPTZ    -- 12 FATIGUED
  ];

  -- ── Exercises (1=Bench Press, 2=Squat, 3=Shoulder Press, 4=RDL) ──────────
  v_exercises TEXT[] := ARRAY[
    'Bench Press',
    'Squat',
    'Shoulder Press',
    'Romanian Deadlift'
  ];

  -- ── Velocity midpoints and ranges per exercise (m/s) ─────────────────────
  -- Index matches v_exercises above.
  v_vel_mid  FLOAT[] := ARRAY[0.47, 0.52, 0.52, 0.42];
  v_vel_min  FLOAT[] := ARRAY[0.30, 0.35, 0.35, 0.25];
  v_vel_max  FLOAT[] := ARRAY[0.60, 0.65, 0.65, 0.55];

  -- ── Weight ranges per exercise (kg) ──────────────────────────────────────
  v_w_base   FLOAT[] := ARRAY[40.0, 60.0, 25.0, 50.0];  -- starting weight
  v_w_step   FLOAT[] := ARRAY[ 2.5,  3.0,  1.5,  2.5];  -- kg added per session

  -- ── Loop variables ────────────────────────────────────────────────────────
  v_session_id   UUID;
  v_session_date TIMESTAMPTZ;
  v_session_idx  INT;
  v_ex_idx       INT;
  v_set_num      INT;
  v_rep_num      INT;
  v_num_sets     INT;
  v_num_reps     INT;

  -- Metric variables
  v_fatigue_mult   FLOAT;
  v_within_decay   FLOAT;
  v_across_decay   FLOAT;
  v_tempo_mult     FLOAT;
  v_base_vel       FLOAT;
  v_set_vel        FLOAT;
  v_rep_vel        FLOAT;
  v_tempo          FLOAT;
  v_weight         FLOAT;
  v_rom            FLOAT;
BEGIN
  -- ── Idempotency: wipe previously seeded data ──────────────────────────────
  DELETE FROM reps
  WHERE session_id IN (
    SELECT id FROM sessions
    WHERE user_id = v_player_id
      AND name LIKE '%' || v_marker || '%'
  );

  DELETE FROM sessions
  WHERE user_id = v_player_id
    AND name LIKE '%' || v_marker || '%';

  RAISE NOTICE 'Previous seed data cleared.';

  -- ── Insert sessions ───────────────────────────────────────────────────────
  FOR v_session_idx IN 1..12 LOOP
    v_session_date := v_dates[v_session_idx];

    -- Fatigue only in sessions 10-12
    v_fatigue_mult := CASE WHEN v_session_idx >= 10 THEN 0.80 ELSE 1.00 END;
    v_within_decay := CASE WHEN v_session_idx >= 10 THEN 0.026 ELSE 0.013 END;
    v_across_decay := CASE WHEN v_session_idx >= 10 THEN 0.032 ELSE 0.016 END;
    v_tempo_mult   := CASE WHEN v_session_idx >= 10 THEN 1.10  ELSE 1.00  END;

    -- 3–5 sets per exercise (varies by session+exercise)
    v_num_sets := 3 + ((v_session_idx - 1) % 3);

    INSERT INTO sessions (
      user_id, name,
      started_at, ended_at,
      created_at,
      status, metrics
    ) VALUES (
      v_player_id,
      'Training Session ' || v_session_idx || ' ' || v_marker,
      v_session_date,
      v_session_date + INTERVAL '75 minutes',
      v_session_date,
      'completed',
      '{}'::jsonb
    )
    RETURNING id INTO v_session_id;

    -- ── Insert exercises (skip one per session for variety) ─────────────────
    FOR v_ex_idx IN 1..4 LOOP
      -- Rotate which exercise is skipped: session 1 skips ex 1, session 2 skips ex 2, etc.
      IF v_ex_idx = ((v_session_idx - 1) % 4) + 1 THEN
        CONTINUE;
      END IF;

      -- Base velocity: mid-range target × fatigue × small noise
      v_base_vel := v_vel_mid[v_ex_idx]
                    * v_fatigue_mult
                    * (0.95 + random() * 0.10);
      v_base_vel := GREATEST(v_vel_min[v_ex_idx], LEAST(v_vel_max[v_ex_idx], v_base_vel));

      -- Progressive weight (clamp to range)
      v_weight := v_w_base[v_ex_idx] + v_w_step[v_ex_idx] * v_session_idx;
      v_weight := LEAST(v_weight, v_w_base[v_ex_idx] + v_w_step[v_ex_idx] * 12);

      -- 5–8 reps per set (varies by session+exercise pair)
      v_num_reps := 5 + ((v_session_idx * 3 + v_ex_idx * 2) % 4);

      FOR v_set_num IN 1..v_num_sets LOOP
        -- Across-set decay: set 1 is fastest
        v_set_vel := v_base_vel * (1.0 - v_across_decay * (v_set_num - 1));

        FOR v_rep_num IN 1..v_num_reps LOOP
          -- Within-set decay: rep 1 is fastest, each subsequent rep slightly slower
          v_rep_vel := v_set_vel
                       * (1.0 - v_within_decay * (v_rep_num - 1))
                       * (0.94 + random() * 0.12);   -- ±6 % noise
          v_rep_vel := GREATEST(v_vel_min[v_ex_idx], LEAST(v_vel_max[v_ex_idx], v_rep_vel));

          -- Concentric tempo: inversely correlated with velocity, slows under fatigue
          v_tempo := (0.44 / GREATEST(v_rep_vel, 0.10))
                     * v_tempo_mult
                     * (0.88 + random() * 0.24);     -- ±12 % noise
          v_tempo := GREATEST(0.80, LEAST(2.00, v_tempo));

          -- Range of motion (mm) — mild noise, not used in signal calculations
          v_rom := 280.0 + random() * 160.0;

          INSERT INTO reps (
            session_id, player_id, exercise_name,
            set_number, rep_number,
            weight, average_rep_speed,
            concentric_duration_s, rom_mm,
            created_at
          ) VALUES (
            v_session_id, v_player_id, v_exercises[v_ex_idx],
            v_set_num, v_rep_num,
            v_weight, ROUND(v_rep_vel::NUMERIC, 3),
            ROUND(v_tempo::NUMERIC, 2),   ROUND(v_rom::NUMERIC, 0),
            v_session_date + ((v_set_num * 10 + v_rep_num) * INTERVAL '30 seconds')
          );
        END LOOP; -- rep
      END LOOP; -- set
    END LOOP; -- exercise
  END LOOP; -- session

  RAISE NOTICE 'Done. Seeded 12 sessions for Test 108 (player %).', v_player_id;
END $$;
