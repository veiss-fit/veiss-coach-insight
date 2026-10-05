import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useArrivalRefresh } from "@/hooks/useArrivalRefresh";
import { stabilize } from "@/lib/stableData";
import { getPlayerById, getCoachTeamIds, type PlayerWithStats } from "@/services/playersService";
import {
  getPlayerSessionIndex, getSessionsExercises, getRecordSets, type ExerciseData, type SessionData,
} from "@/services/sessionsService";
import { getPlayerWorkoutPlans } from "@/services/workoutPlansService";
import { getPlayerCoachNotes, type CoachNote } from "@/services/coachFeedbackService";
import type { ExerciseSets } from "@/lib/metrics/setVelocitySummary";
import type { HistorySession } from "@/lib/metrics/velocityVsBaseline";

type WorkoutPlan = Awaited<ReturnType<typeof getPlayerWorkoutPlans>>[number];

/** Sessions this recent get their rep detail loaded up front: the Performance tab's cards read them. */
const RECENT_DAYS = 56;

const momentOf = (s: SessionData) => new Date(s.startedAt ?? s.createdAt).getTime();

interface DetailEntry {
  repCount: number;
  exercises: ExerciseData[];
}
interface RecordEntry {
  repCount: number;
  sets: ExerciseSets[];
}

/**
 * Everything the athlete page shows, loaded in layers so nothing is fetched before it is needed:
 *  - the light session list (no reps), the plans and the notes, always;
 *  - rep detail only for the last 8 weeks of sessions, plus whatever the Sessions tab asks for
 *    (`requestDetail`: the selected workout and the weeks before it that its velocity baseline reads);
 *  - slim per-set summaries of every session, in the background, for the all-time personal records.
 * A refresh (`silent`) re-fetches the light data and only the rep detail that is new or changed, keeps the
 * previous objects for everything unchanged (so the page does not re-render), and shows no loader.
 * It runs when the arrival check sees a new workout for this athlete.
 */
export function useAthleteData(athleteId: string | undefined) {
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [athlete, setAthlete] = useState<PlayerWithStats | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [coachDbId, setCoachDbId] = useState<string | null>(null);
  const [recordHistory, setRecordHistory] = useState<Record<string, HistorySession[]>>({});
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [detailLoadingIds, setDetailLoadingIds] = useState<string[]>([]);
  /** Bumped by every completed load, so "now"-based derivations (weekly windows) move on even when no data changed. */
  const [refreshedAt, setRefreshedAt] = useState(() => Date.now());

  const tokenRef = useRef(0);
  const athleteRef = useRef<PlayerWithStats | null>(null);
  const indexRef = useRef<SessionData[]>([]);
  const detailRef = useRef(new Map<string, DetailEntry>());
  const wantedRef = useRef(new Set<string>());
  const recordRef = useRef(new Map<string, RecordEntry>());

  /** Merge the light list with whatever rep detail is cached; unchanged sessions keep their identity. */
  const rebuildSessions = useCallback(() => {
    const merged = indexRef.current.map((s) => ({ ...s, exercises: detailRef.current.get(s.id)?.exercises ?? [] }));
    setSessions((prev) => stabilize(prev, merged));
  }, []);

  /** Fetch rep detail for the ids that are missing or whose rep count changed. True when anything was fetched. */
  const ensureDetail = useCallback(async (ids: string[]) => {
    const byId = new Map(indexRef.current.map((s) => [s.id, s]));
    const need = [...new Set(ids)].filter((id) => {
      const session = byId.get(id);
      if (!session) return false;
      const cached = detailRef.current.get(id);
      return !cached || cached.repCount !== (session.repCount ?? 0);
    });
    if (need.length === 0) return false;
    const token = tokenRef.current;
    setDetailLoadingIds((prev) => [...new Set([...prev, ...need])]);
    try {
      const fetched = await getSessionsExercises(need);
      if (token !== tokenRef.current) return false;
      for (const id of need) {
        detailRef.current.set(id, { repCount: byId.get(id)?.repCount ?? 0, exercises: fetched.get(id) ?? [] });
      }
      return true;
    } finally {
      setDetailLoadingIds((prev) => prev.filter((id) => !need.includes(id)));
    }
  }, []);

  /** Slim all-time summaries: fetch only sessions not seen before (or whose reps changed), drop deleted ones. */
  const refreshRecords = useCallback(async (token: number) => {
    const withReps = indexRef.current.filter((s) => (s.repCount ?? 0) > 0);
    const liveIds = new Set(withReps.map((s) => s.id));
    for (const id of [...recordRef.current.keys()]) if (!liveIds.has(id)) recordRef.current.delete(id);
    const need = withReps.filter((s) => recordRef.current.get(s.id)?.repCount !== s.repCount);
    try {
      if (need.length > 0) {
        const fetched = await getRecordSets(need.map((s) => s.id));
        if (token !== tokenRef.current) return;
        for (const s of need) recordRef.current.set(s.id, { repCount: s.repCount ?? 0, sets: fetched.get(s.id) ?? [] });
      }
      const byExercise = new Map<string, HistorySession[]>();
      for (const s of withReps) {
        const entry = recordRef.current.get(s.id);
        if (!entry) continue;
        const date = s.startedAt ?? s.createdAt;
        for (const e of entry.sets) {
          const list = byExercise.get(e.exercise) ?? [];
          list.push({ date, sets: e.sets });
          byExercise.set(e.exercise, list);
        }
      }
      const next = Object.fromEntries([...byExercise.entries()].sort((a, b) => b[1].length - a[1].length));
      setRecordHistory((prev) => stabilize(prev, next));
    } catch (error) {
      console.error("Error loading personal records:", error);
    } finally {
      if (token === tokenRef.current) setRecordsLoading(false);
    }
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (!user?.id || !athleteId) return;
      const token = ++tokenRef.current;
      try {
        if (!silent) {
          setLoading(true);
          setLoadError(null);
        }
        let current = athleteRef.current;
        if (!silent || !current || current.id !== athleteId) {
          const [found, teamIds] = await Promise.all([getPlayerById(athleteId), getCoachTeamIds(user.id)]);
          if (token !== tokenRef.current) return;
          current = found && found.team_id && teamIds.includes(found.team_id) ? found : null;
          athleteRef.current = current;
          setAthlete((prev) => stabilize(prev, current));
          if (!current) {
            indexRef.current = [];
            rebuildSessions();
            return;
          }
        }
        if (!current) return;

        const [index, planData, noteData] = await Promise.all([
          getPlayerSessionIndex(current.id, current.user_id),
          getPlayerWorkoutPlans(current.id),
          silent ? Promise.resolve(null) : getPlayerCoachNotes(current.id),
        ]);
        if (token !== tokenRef.current) return;

        indexRef.current = index;
        for (const id of [...detailRef.current.keys()]) {
          if (!index.some((s) => s.id === id)) detailRef.current.delete(id);
        }
        setPlans((prev) => stabilize(prev, planData ?? []));
        if (noteData) setNotes((prev) => stabilize(prev, noteData));
        setCoachDbId(profile?.coach_id ?? null);

        const since = Date.now() - RECENT_DAYS * 86_400_000;
        const recentIds = index.filter((s) => (s.repCount ?? 0) > 0 && momentOf(s) >= since).map((s) => s.id);
        await ensureDetail([...recentIds, ...wantedRef.current]);
        if (token !== tokenRef.current) return;
        rebuildSessions();
        setRefreshedAt(Date.now());
        void refreshRecords(token);
      } catch (error) {
        if (token !== tokenRef.current) return;
        console.error("Error loading athlete:", error);
        // A background refresh keeps what is on screen and tries again at the next check.
        if (silent) return;
        // Previously toast-only: a failed load still fell through to "Athlete not found" below
        // (athlete stayed null), telling the coach the athlete doesn't exist when the real cause
        // was a network/query failure.
        toast.error("Failed to load athlete data");
        setLoadError(error instanceof Error ? error.message : null);
      } finally {
        if (!silent && token === tokenRef.current) setLoading(false);
      }
    },
    [user?.id, athleteId, profile?.coach_id, ensureDetail, rebuildSessions, refreshRecords]
  );

  // A different athlete starts from scratch: nothing cached for one athlete may show for another.
  useEffect(() => {
    tokenRef.current++;
    athleteRef.current = null;
    indexRef.current = [];
    detailRef.current.clear();
    wantedRef.current.clear();
    recordRef.current.clear();
    setAthlete(null);
    setSessions([]);
    setPlans([]);
    setNotes([]);
    setRecordHistory({});
    setRecordsLoading(true);
    setDetailLoadingIds([]);
  }, [athleteId]);

  useEffect(() => {
    void load(false);
  }, [load]);

  /** The Sessions tab asks for the rep detail of the workout on screen and the sessions its baseline reads. */
  const requestDetail = useCallback(
    (ids: string[]) => {
      ids.forEach((id) => wantedRef.current.add(id));
      const token = tokenRef.current;
      void ensureDetail(ids)
        .then((fetched) => {
          if (fetched && token === tokenRef.current) rebuildSessions();
        })
        .catch((error) => console.error("Error loading workout detail:", error));
    },
    [ensureDetail, rebuildSessions]
  );

  useArrivalRefresh({
    playerIds: athlete ? [athlete.id] : [],
    enabled: !!athlete,
    onRefresh: () => load(true),
  });

  const detailLoading = useMemo<ReadonlySet<string>>(() => new Set(detailLoadingIds), [detailLoadingIds]);

  return {
    loading, loadError, athlete, sessions, plans, notes, setNotes, coachDbId,
    recordHistory, recordsLoading, detailLoading, requestDetail, refreshedAt,
    reload: () => load(false),
    /** Quiet re-fetch, no loader: for after the page itself changed something (a cancelled workout). */
    refresh: () => load(true),
  };
}
