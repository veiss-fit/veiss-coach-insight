// Temporary execution script — safe to delete after running.
// Mirrors the logic in seed-test108.sql exactly.
// Run with:  node supabase/run-seed.cjs

const { createClient } = require('../node_modules/@supabase/supabase-js/dist/index.cjs');

const SUPABASE_URL = 'https://xjyugqxdfrbluprtgftj.supabase.co';
const ANON_KEY     = 'sb_publishable_smdgoXHi_zin3b50mOTu1w_q8L5DI6d';
const PLAYER_ID    = '297f16f4-6965-4d99-83fb-efa00ec9516b';
const MARKER       = '[seed-v1]';

const sb = createClient(SUPABASE_URL, ANON_KEY);

// ── Config ────────────────────────────────────────────────────────────────────

const SESSION_DATES = [
  '2026-03-06T10:00:00Z', '2026-03-11T10:00:00Z',
  '2026-03-17T10:00:00Z', '2026-03-23T10:00:00Z',
  '2026-03-30T10:00:00Z', '2026-04-06T10:00:00Z',
  '2026-04-12T10:00:00Z', '2026-04-18T10:00:00Z',
  '2026-04-25T10:00:00Z',   // last normal
  '2026-05-01T10:00:00Z',   // FATIGUED
  '2026-05-07T10:00:00Z',   // FATIGUED
  '2026-05-12T10:00:00Z',   // FATIGUED
];

const EXERCISES = ['Bench Press', 'Squat', 'Shoulder Press', 'Romanian Deadlift'];

// Per-exercise: [vel_mid, vel_min, vel_max, w_base (kg), w_step (kg/session)]
const EX_CFG = [
  { mid: 0.47, min: 0.30, max: 0.60, wBase: 40, wStep: 2.5 }, // Bench Press
  { mid: 0.52, min: 0.35, max: 0.65, wBase: 60, wStep: 3.0 }, // Squat
  { mid: 0.52, min: 0.35, max: 0.65, wBase: 25, wStep: 1.5 }, // Shoulder Press
  { mid: 0.42, min: 0.25, max: 0.55, wBase: 50, wStep: 2.5 }, // RDL
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function rand() { return Math.random(); }

function addMinutes(iso, mins) {
  return new Date(new Date(iso).getTime() + mins * 60000).toISOString();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  // ── 1. Idempotency: find existing seeded sessions ─────────────────────────
  const { data: existing, error: fetchErr } = await sb
    .from('sessions')
    .select('id')
    .eq('user_id', PLAYER_ID)
    .like('name', `%${MARKER}%`);

  if (fetchErr) {
    console.error('Could not query existing sessions:', fetchErr.message);
    if (fetchErr.code === '42501' || fetchErr.message.includes('permission')) {
      console.error('\nRLS is blocking read access. Run the .sql file in the Supabase SQL Editor instead.');
    }
    process.exit(1);
  }

  if (existing.length > 0) {
    const ids = existing.map(r => r.id);
    console.log(`Found ${ids.length} previously seeded session(s) — deleting reps then sessions…`);

    // Delete reps first (FK constraint)
    for (const sid of ids) {
      const { error: repDelErr } = await sb.from('reps').delete().eq('session_id', sid);
      if (repDelErr) { console.error('  reps delete error:', repDelErr.message); process.exit(1); }
    }

    const { error: sesDelErr } = await sb.from('sessions').delete().in('id', ids);
    if (sesDelErr) { console.error('  sessions delete error:', sesDelErr.message); process.exit(1); }
    console.log('  Previous seed cleared.\n');
  } else {
    console.log('No previous seed found — fresh insert.\n');
  }

  // ── 2. Insert 12 sessions ─────────────────────────────────────────────────
  let totalSessions = 0;
  let totalReps = 0;

  for (let si = 0; si < 12; si++) {
    const sessionDate  = SESSION_DATES[si];
    const isFatigued   = si >= 9;                     // sessions 10-12 (0-indexed 9-11)
    const fatigueMult  = isFatigued ? 0.80 : 1.00;
    const withinDecay  = isFatigued ? 0.026 : 0.013;
    const acrossDecay  = isFatigued ? 0.032 : 0.016;
    const tempoMult    = isFatigued ? 1.10  : 1.00;
    const numSets      = 3 + (si % 3);               // 3, 4, or 5

    const { data: session, error: sesErr } = await sb
      .from('sessions')
      .insert({
        user_id:    PLAYER_ID,
        name:       `Training Session ${si + 1} ${MARKER}`,
        started_at: sessionDate,
        ended_at:   addMinutes(sessionDate, 75),
        created_at: sessionDate,
        status:     'completed',
        metrics:    {},
      })
      .select('id')
      .single();

    if (sesErr) {
      console.error(`Session ${si + 1} insert failed:`, sesErr.message);
      if (sesErr.code === '42501') {
        console.error('\nRLS is blocking inserts. Run supabase/seed-test108.sql in the Supabase SQL Editor instead.');
      }
      process.exit(1);
    }

    const sessionId = session.id;
    totalSessions++;

    // ── 3. Insert exercises (skip one per session) ────────────────────────
    for (let ei = 0; ei < 4; ei++) {
      if (ei === si % 4) continue;  // rotate which exercise is skipped

      const cfg      = EX_CFG[ei];
      const weight   = clamp(cfg.wBase + cfg.wStep * (si + 1), cfg.wBase, cfg.wBase + cfg.wStep * 12);
      const numReps  = 5 + ((si * 3 + ei * 2) % 4);  // 5-8

      // Base velocity for set 1 rep 1
      let baseVel = cfg.mid * fatigueMult * (0.95 + rand() * 0.10);
      baseVel = clamp(baseVel, cfg.min, cfg.max);

      const repRows = [];

      for (let setNum = 1; setNum <= numSets; setNum++) {
        // Across-set decay
        const setVel = baseVel * (1.0 - acrossDecay * (setNum - 1));

        for (let repNum = 1; repNum <= numReps; repNum++) {
          // Within-set decay + noise
          let repVel = setVel * (1.0 - withinDecay * (repNum - 1)) * (0.94 + rand() * 0.12);
          repVel = clamp(repVel, cfg.min, cfg.max);

          // Concentric tempo: inversely correlated with velocity, slows under fatigue
          let tempo = (0.44 / Math.max(repVel, 0.10)) * tempoMult * (0.88 + rand() * 0.24);
          tempo = clamp(tempo, 0.80, 2.00);

          const rom = 280 + rand() * 160;

          // Offset created_at within the session so reps appear sequential
          const repTime = addMinutes(sessionDate, (setNum * 10 + repNum) * 0.5);

          repRows.push({
            session_id:           sessionId,
            player_id:            PLAYER_ID,
            exercise_name:        EXERCISES[ei],
            set_number:           setNum,
            rep_number:           repNum,
            weight:               Math.round(weight * 10) / 10,
            average_rep_speed:    Math.round(repVel * 1000) / 1000,
            concentric_duration_s: Math.round(tempo * 100) / 100,
            rom_mm:               Math.round(rom),
            created_at:           repTime,
          });
        }
      }

      // Batch-insert all reps for this exercise
      const { error: repErr } = await sb.from('reps').insert(repRows);
      if (repErr) {
        console.error(`  Reps insert failed (session ${si+1}, ${EXERCISES[ei]}):`, repErr.message);
        process.exit(1);
      }
      totalReps += repRows.length;
    }

    const tag = isFatigued ? ' [FATIGUED]' : '';
    console.log(`  Session ${String(si+1).padStart(2)} (${sessionDate.slice(0,10)})${tag}  — inserted`);
  }

  console.log(`\nDone. ${totalSessions} sessions, ${totalReps} reps inserted for Test 108.`);
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
