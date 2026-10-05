import { supabase } from '@/lib/supabase';
import { canonicalizeExerciseName } from '@/lib/targetEvaluation';
import { isValidExerciseName } from '@/lib/athleteSummaryUtils';
import { summarizeSession, type ExerciseSets, type RepInput } from '@/lib/metrics/setVelocitySummary';
import { chunk } from '@/lib/utils';
import { Database } from '@/types/database';

const PAGE_SIZE = 1000;
const MAX_PAGES = 20;
/** Max ids per `.in(...)` call — a long UUID list risks blowing the URL length limit. */
const ID_CHUNK_SIZE = 200;

type SessionRow = Database['public']['Tables']['sessions']['Row'];

// Extract YYYY-MM-DD in the coach's local timezone, not UTC.
// Without this, a session at 11 PM local time (e.g. EST) is stored as
// the next day in UTC and would display the wrong date on the dashboard.
const toLocalDateString = (iso: string): string => {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
type Rep = Database['public']['Tables']['reps']['Row'];

export interface RepData {
  repNumber: number;
  setNumber: number;
  velocity: number;
  rom: number;       // rom_mm
  tempo: number;     // concentric_duration_s
  eccentric: number; // eccentric_duration_s
  /** This rep's own logged load — weight can legitimately change set to set
   *  (ramping/pyramid sets), so it's carried per-rep rather than once per
   *  exercise. See CALCULATIONS.md re: weightUnit being an unverified 'lbs'
   *  assumption (the reps table has no unit column to check it against). */
  weight: number;
}

export interface ExerciseData {
  id: string;
  name: string;
  /** Exercise-level — the reps table has no unit column, so this is an
   *  app-wide assumption, not something read from data. See CALCULATIONS.md. */
  weightUnit: 'lbs' | 'kg';
  avgVelocity: number;
  avgROM: number;    // NEW
  avgTempo: number;  // NEW
  repData: RepData[];
}

export interface SessionData {
  id: string;
  date: string;
  createdAt: string;
  startedAt: string | null;
  status: string | null;
  /** Empty until the session's reps are loaded (see `getSessionsExercises`); `repCount` says whether any exist. */
  exercises: ExerciseData[];
  notes?: string;
  /** Rows in `reps` for this session. 0 means a workout finished with no sensor data. */
  repCount?: number;
}

/**
 * The instant a session is dated by: `started_at` (when the athlete trained), unless it is missing or
 * later than `created_at` (when the row reached the database, which cannot be earlier than the
 * workout), in which case `created_at`. One rule for every page.
 */
export const sessionPlacementIso = (startedAt: string | null, createdAt: string): string => {
  if (!startedAt) return createdAt;
  return new Date(startedAt).getTime() > new Date(createdAt).getTime() ? createdAt : startedAt;
};

/**
 * PostgREST `or` filter that keeps every session except `cancelled` and `in_progress` ones. Those are
 * leftovers from the tablet app (workouts started and abandoned), not workouts the athlete did, so no
 * count, attendance figure, picker entry or arrival check should see them. Rows with no status stay.
 */
export const VISIBLE_SESSION_FILTER = 'status.is.null,status.not.in.(cancelled,in_progress)';

type SessionIndexRow = {
  id: string;
  name: string | null;
  status: string | null;
  started_at: string | null;
  created_at: string;
  reps: Array<{ count: number }> | null;
};

/**
 * Every session of a player, light: no reps. `repCount` comes from an embedded count so the page can tell
 * "finished with no sensor data" from "reps not loaded yet" without downloading them. `startedAt` is only
 * kept when it passes the placement rule, so every `startedAt ?? createdAt` reader follows it.
 */
export const getPlayerSessionIndex = async (
  playerId: string,
  linkedUserId?: string | null
): Promise<SessionData[]> => {
  const ownerIds = Array.from(new Set([playerId, linkedUserId].filter(Boolean) as string[]));
  // Untyped client: the hand-written Database types do not describe the reps(count) embed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('sessions')
    .select('id, name, status, started_at, created_at, reps(count)')
    .in('user_id', ownerIds)
    .or(VISIBLE_SESSION_FILTER)
    .order('started_at', { ascending: false });
  if (error) {
    console.error('Error fetching session index:', error);
    throw error;
  }
  return ((data ?? []) as SessionIndexRow[]).map((session) => {
    const placed = sessionPlacementIso(session.started_at, session.created_at);
    return {
      id: session.id,
      date: toLocalDateString(placed),
      createdAt: session.created_at,
      startedAt: placed === session.started_at ? session.started_at : null,
      status: session.status ?? null,
      exercises: [],
      notes: session.name || undefined,
      repCount: session.reps?.[0]?.count ?? 0,
    };
  });
};

/** Pages through `reps` for a list of session ids (chunked so the id list stays URL-safe). */
const fetchRepsForSessions = async <Row>(
  sessionIds: string[],
  columns: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra?: (query: any) => any
): Promise<Row[]> => {
  const fetchChunk = async (ids: string[]): Promise<Row[]> => {
    const collected: Row[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any).from('reps').select(columns).in('session_id', ids);
      if (extra) query = extra(query);
      const { data, error } = await query
        .order('id', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) {
        console.error('Error fetching reps:', error);
        throw error;
      }
      const rows = (data ?? []) as Row[];
      collected.push(...rows);
      if (rows.length < PAGE_SIZE) break;
    }
    return collected;
  };
  return (await Promise.all(chunk(sessionIds, ID_CHUNK_SIZE).map(fetchChunk))).flat();
};

/**
 * Exercises (with rep detail) for the given sessions only, one batched reps query. A session with no reps
 * falls back to exercise names from `workouts` (names only), as before.
 */
export const getSessionsExercises = async (sessionIds: string[]): Promise<Map<string, ExerciseData[]>> => {
  const result = new Map<string, ExerciseData[]>();
  if (sessionIds.length === 0) return result;

  const reps = await fetchRepsForSessions<Rep>(sessionIds, '*');
  const repsBySession = new Map<string, Rep[]>();
  for (const rep of reps) {
    const list = repsBySession.get(rep.session_id);
    if (list) list.push(rep);
    else repsBySession.set(rep.session_id, [rep]);
  }

  const withoutReps = sessionIds.filter((id) => !repsBySession.get(id)?.length);
  const workoutsBySession = new Map<string, ExerciseData[]>();
  if (withoutReps.length > 0) {
    const { data: workoutsRaw } = await supabase
      .from('workouts')
      .select('session_id, exercise_name, metrics')
      .in('session_id', withoutReps);
    type WorkoutRow = { session_id: string; exercise_name: string; metrics: Record<string, unknown> };
    ((workoutsRaw ?? []) as WorkoutRow[])
      .filter((w) => w.exercise_name && w.exercise_name.trim().length >= 2)
      .forEach((w) => {
        const list = workoutsBySession.get(w.session_id) ?? [];
        list.push({
          id: `${w.session_id}-${w.exercise_name}`,
          name: canonicalizeExerciseName(w.exercise_name),
          weightUnit: 'lbs' as const,
          avgVelocity: 0,
          avgROM: 0,
          avgTempo: 0,
          repData: [],
        });
        workoutsBySession.set(w.session_id, list);
      });
  }

  for (const id of sessionIds) {
    const fromReps = buildExercises(id, repsBySession.get(id) ?? []);
    result.set(id, fromReps.length > 0 ? fromReps : (workoutsBySession.get(id) ?? []));
  }
  return result;
};

type RecordRepRow = Pick<
  Rep,
  'session_id' | 'exercise_name' | 'set_number' | 'rep_number' | 'average_rep_speed' | 'weight'
>;

/**
 * Per-set velocity summaries for the given sessions, from slim rep rows (valid velocity only, six columns).
 * Feeds the all-time personal records without loading full rep detail for old sessions. Same exercise
 * filtering and canonical names as the session views, so the numbers match.
 */
export const getRecordSets = async (sessionIds: string[]): Promise<Map<string, ExerciseSets[]>> => {
  const result = new Map<string, ExerciseSets[]>();
  if (sessionIds.length === 0) return result;

  const rows = await fetchRepsForSessions<RecordRepRow>(
    sessionIds,
    'session_id, exercise_name, set_number, rep_number, average_rep_speed, weight',
    (query) => query.gt('average_rep_speed', 0)
  );
  const inputsBySession = new Map<string, RepInput[]>();
  for (const r of rows) {
    if (!isValidExerciseName(r.exercise_name)) continue;
    const list = inputsBySession.get(r.session_id) ?? [];
    list.push({
      exercise_name: canonicalizeExerciseName(r.exercise_name),
      set_number: r.set_number,
      rep_number: r.rep_number,
      average_rep_speed: r.average_rep_speed,
      weight: r.weight != null && Number(r.weight) > 0 ? Number(r.weight) : null,
    });
    inputsBySession.set(r.session_id, list);
  }
  for (const id of sessionIds) result.set(id, summarizeSession(inputsBySession.get(id) ?? []));
  return result;
};

/**
 * Group reps for one session into per-exercise averages + rep-level detail.
 * Pure — no fetching. Shared by `getPlayerSessions` (pre-fetched, batched
 * reps) and `getSessionExercises` (single-session fetch).
 */
const buildExercises = (sessionId: string, reps: Rep[]): ExerciseData[] => {
  // Group reps by exercise — skip artifact names (null, < 2 letters, or known generic labels)
  // Grouped by CANONICAL name (see canonicalizeExerciseName's alias map) so
  // e.g. "Squat" and "Squats" reps merge into one "Back Squat" exercise
  // instead of fragmenting into unrelated entries — confirmed live
  // collision, not a hypothetical one. Artifact-name filtering still
  // checks the raw logged name first.
  const exerciseMap = new Map<string, Rep[]>();
  reps.forEach((rep) => {
    const raw = rep.exercise_name;
    if (!isValidExerciseName(raw)) return;
    const key = canonicalizeExerciseName(raw);
    if (!exerciseMap.has(key)) exerciseMap.set(key, []);
    exerciseMap.get(key)!.push(rep);
  });

  const exercises: ExerciseData[] = [];

  exerciseMap.forEach((exerciseReps, exerciseName) => {
    // Extract Bare Metrics for calculation
    const velocities = exerciseReps.map(r => Number(r.average_rep_speed)).filter(v => v > 0);
    const roms = exerciseReps.map(r => Number(r.rom_mm)).filter(v => v > 0);
    const tempos = exerciseReps.map(r => Number(r.concentric_duration_s)).filter(v => v > 0);

    // Averages
    const avgVelocity = velocities.length > 0
      ? parseFloat((velocities.reduce((a, b) => a + b, 0) / velocities.length).toFixed(2))
      : 0;

    const avgROM = roms.length > 0
      ? Math.round(roms.reduce((a, b) => a + b, 0) / roms.length)
      : 0;

    const avgTempo = tempos.length > 0
      ? parseFloat((tempos.reduce((a, b) => a + b, 0) / tempos.length).toFixed(2))
      : 0;

    // Map the repData (The Bare Metrics) — weight travels per-rep so sets
    // with different loads (ramping/pyramid) each show their own true value.
    const repData: RepData[] = exerciseReps.map((rep) => ({
      repNumber: rep.rep_number,
      setNumber: rep.set_number, // We keep the set number separate now for better graphing
      velocity: Number(rep.average_rep_speed) || 0,
      rom: Number(rep.rom_mm) || 0,
      tempo: Number(rep.concentric_duration_s) || 0,
      eccentric: Number(rep.eccentric_duration_s) || 0,
      weight: Number(rep.weight) || 0,
    }));

    exercises.push({
      id: `${sessionId}-${exerciseName}`,
      name: exerciseName,
      weightUnit: 'lbs',
      avgVelocity,
      avgROM,   // NEW: Used in UI summary
      avgTempo, // NEW: Used in UI summary
      repData,
    });
  });

  return exercises;
};

/**
 * Get all exercises for a specific session
 */
export const getSessionExercises = async (sessionId: string): Promise<ExerciseData[]> => {
  try {
    // 1. Fetch reps with the NEW Phase 22 columns
    const { data: repsRaw, error: repsError } = await supabase
      .from('reps')
      .select('*')
      .eq('session_id', sessionId)
      .order('exercise_name', { ascending: true })
      .order('set_number', { ascending: true })
      .order('rep_number', { ascending: true });
    const reps = repsRaw as Rep[] | null;

    if (repsError) {
      console.error('Error fetching reps:', repsError);
      throw repsError;
    }

    if (!reps || reps.length === 0) {
      // No rep data — fall back to workouts table for exercise names only
      const { data: workoutsRaw } = await supabase
        .from('workouts')
        .select('exercise_name, metrics')
        .eq('session_id', sessionId);
      type WorkoutRow = { exercise_name: string; metrics: Record<string, unknown> };
      const workouts = workoutsRaw as WorkoutRow[] | null;
      if (!workouts || workouts.length === 0) return [];
      return workouts
        .filter((w) => w.exercise_name && w.exercise_name.trim().length >= 2)
        .map((w) => ({
          id: `${sessionId}-${w.exercise_name}`,
          name: canonicalizeExerciseName(w.exercise_name),
          weightUnit: 'lbs' as const,
          avgVelocity: 0,
          avgROM: 0,
          avgTempo: 0,
          repData: [],
        }));
    }

    return buildExercises(sessionId, reps);
  } catch (error) {
    console.error('Error in getSessionExercises:', error);
    throw error;
  }
};

