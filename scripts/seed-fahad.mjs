/**
 * Seed script: populate Fahad Ismail's profile with realistic VBT demo data.
 *
 * Usage:
 *   node scripts/seed-fahad.mjs <SERVICE_ROLE_KEY>
 *
 * The service role key is found in:
 *   Supabase Dashboard → Project Settings → API → service_role (secret)
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// ─── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://xjyugqxdfrbluprtgftj.supabase.co";
const SERVICE_ROLE_KEY = process.argv[2];

if (!SERVICE_ROLE_KEY) {
  console.error("Usage: node scripts/seed-fahad.mjs <SERVICE_ROLE_KEY>");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function rnd(min, max) {
  return Math.random() * (max - min) + min;
}
function rndRound(min, max, decimals = 2) {
  return parseFloat(rnd(min, max).toFixed(decimals));
}
function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

/** Return an ISO date string N days before today */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(Math.floor(rnd(7, 20)), Math.floor(rnd(0, 59)), 0, 0);
  return d.toISOString();
}

// ─── Session schedule (spread across last 8 weeks) ───────────────────────────
// ~3 sessions/week = 24 sessions; we'll do 22 so they match the existing count
// but these will be fresh insertions (existing empty sessions will be replaced
// logically — actually we insert new ones; old ones remain but the UI shows latest first)
const SESSION_DAYS_AGO = [
  2, 4, 6,        // week 1 (this week)
  9, 11, 13,      // week 2
  16, 18, 20,     // week 3
  23, 25, 28,     // week 4
  31, 33, 35,     // week 5
  38, 40, 42,     // week 6
  45, 47, 49,     // week 7
  52, 54,         // week 8
];

// ─── Exercise definitions ─────────────────────────────────────────────────────
// base_vel: mean concentric velocity (m/s) for fresh rep at target weight
// rom_mean: mean ROM in mm
// tempo_mean: mean concentric duration in seconds
const EXERCISES = [
  { name: "Back Squat",           base_vel: 0.72, vel_sd: 0.08, rom_mean: 620, rom_sd: 45, tempo_mean: 0.55, tempo_sd: 0.07 },
  { name: "Bench Press",          base_vel: 0.58, vel_sd: 0.07, rom_mean: 380, rom_sd: 30, tempo_mean: 0.48, tempo_sd: 0.06 },
  { name: "Romanian Deadlift",    base_vel: 0.65, vel_sd: 0.08, rom_mean: 710, rom_sd: 55, tempo_mean: 0.62, tempo_sd: 0.08 },
];

// ─── Generate rep-level metrics for one set ───────────────────────────────────
function generateSet(ex, setNum, numReps, sessionProgress /* 0‥1 improving */) {
  const reps = [];
  // Slight improvement over time (progress), slight within-session fatigue
  const sessionBoost = sessionProgress * 0.12; // up to +12% over the programme
  const setFatigue   = (setNum - 1) * 0.025;   // ~2.5% drop per set

  for (let rep = 1; rep <= numReps; rep++) {
    const repFatigue = (rep - 1) * 0.012; // ~1.2% drop per rep

    const vel = clamp(
      rndRound(
        ex.base_vel + sessionBoost - setFatigue - repFatigue - ex.vel_sd,
        ex.base_vel + sessionBoost - setFatigue - repFatigue + ex.vel_sd,
      ),
      0.18, 1.50,
    );

    const rom = clamp(
      Math.round(rnd(ex.rom_mean - ex.rom_sd, ex.rom_mean + ex.rom_sd)),
      100, 1200,
    );

    const tempo = clamp(
      rndRound(ex.tempo_mean - ex.tempo_sd, ex.tempo_mean + ex.tempo_sd),
      0.15, 2.0,
    );

    reps.push({ rep, vel, rom, tempo });
  }
  return reps;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Find Fahad Ismail (exact match to avoid picking up the 'fahad' test record)
  const { data: players, error: pErr } = await supabase
    .from("players")
    .select("id, full_name, user_id")
    .ilike("full_name", "fahad ismail");

  if (pErr) { console.error("Failed to query players:", pErr); process.exit(1); }
  if (!players || players.length === 0) {
    console.error("Could not find 'Fahad Ismail' in the players table.");
    process.exit(1);
  }

  const player = players[0];
  console.log(`Found player: ${player.full_name} (id=${player.id}, user_id=${player.user_id})`);

  // Fahad has no auth account; existing sessions use player.id for both user_id and player_id
  const ownerId = player.id;

  // 2. Build + insert sessions
  const totalSessions = SESSION_DAYS_AGO.length;
  let inserted = 0;

  for (let si = 0; si < totalSessions; si++) {
    const dAgo = SESSION_DAYS_AGO[si];
    const progress = 1 - si / (totalSessions - 1); // newest session = 1.0 (most improved)
    const createdAt = daysAgo(dAgo);

    // Pick 2-3 exercises per session
    const numEx  = si % 3 === 0 ? 2 : 3;
    const exList = EXERCISES.slice(0, numEx);

    // Insert session
    const sessionId = randomUUID();
    const { error: sErr } = await supabase.from("sessions").insert({
      id: sessionId,
      user_id: ownerId,
      player_id: ownerId,
      name: `Training Session`,
      started_at: createdAt,
      ended_at: new Date(new Date(createdAt).getTime() + 60 * 60 * 1000).toISOString(),
      created_at: createdAt,
      status: "completed",
      metrics: {},
    });

    if (sErr) {
      console.error(`  Session ${si + 1}: INSERT failed —`, sErr.message);
      continue;
    }

    // Insert workouts + reps
    const repRows = [];

    for (const ex of exList) {
      const numSets = si % 4 === 0 ? 3 : 4;
      const numReps = si % 5 === 0 ? 4 : 5;
      const weight  = ex.name === "Back Squat"        ? 185
                    : ex.name === "Bench Press"        ? 145
                    : /* Romanian Deadlift */            165;

      // workouts row (aggregate)
      await supabase.from("workouts").insert({
        session_id: sessionId,
        player_id: player.id,
        exercise_name: ex.name,
        metrics: {
          totalSets: numSets,
          totalReps: numSets * numReps,
          averageWeight: weight,
        },
        created_at: createdAt,
      });

      for (let setNum = 1; setNum <= numSets; setNum++) {
        const setReps = generateSet(ex, setNum, numReps, progress);
        for (const r of setReps) {
          repRows.push({
            session_id: sessionId,
            player_id: player.id,
            exercise_name: ex.name,
            set_number: setNum,
            rep_number: r.rep,
            weight,
            average_rep_speed: r.vel,
            rom_mm: r.rom,
            concentric_duration_s: r.tempo,
            created_at: createdAt,
          });
        }
      }
    }

    // Batch-insert reps
    if (repRows.length > 0) {
      const { error: rErr } = await supabase.from("reps").insert(repRows);
      if (rErr) {
        console.error(`  Session ${si + 1}: reps INSERT failed —`, rErr.message);
      }
    }

    inserted++;
    console.log(
      `  [${inserted}/${totalSessions}] ${createdAt.slice(0, 10)} — ${exList.map((e) => e.name).join(", ")} — ${repRows.length} reps`,
    );
  }

  console.log(`\nDone. Inserted ${inserted} sessions for ${player.full_name}.`);
  console.log("Refresh the coach dashboard to see the updated profile.");
}

main().catch((e) => { console.error(e); process.exit(1); });
