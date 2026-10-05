import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";
import { useArrivalRefresh } from "@/hooks/useArrivalRefresh";
import { stabilize } from "@/lib/stableData";
import {
  getPlayersWithStatsByCoach, getCoachGroups, getCoachPlayerRefs,
  type CoachGroup, type PlayerWithStats,
} from "@/services/playersService";
import { getRosterMetrics, type RosterMetricsResult } from "@/services/rosterMetricsService";
import { INITIAL_DRAFT, thresholdsFromDraft, type AttentionThresholds, type ThresholdDraft } from "@/lib/metrics/attentionFlags";

/** Strip slots: how many athletes the panel can follow at once. */
export const MAX_FOLLOWED = 4;
const FOLLOWED_KEY = "veiss.followedAthletes";
const THRESHOLDS_KEY = "veiss.attentionThresholds";

const readFollowed = (): string[] | null => {
  try {
    const raw = localStorage.getItem(FOLLOWED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
};

const readDraft = (): ThresholdDraft => {
  try {
    const raw = localStorage.getItem(THRESHOLDS_KEY);
    return raw ? { ...INITIAL_DRAFT, ...(JSON.parse(raw) as ThresholdDraft) } : INITIAL_DRAFT;
  } catch {
    return INITIAL_DRAFT;
  }
};

interface FollowedAthletesContextValue {
  /** The coach's roster with stats, shared by Home and the followed-athletes panel (fetched once). */
  athletes: PlayerWithStats[];
  coachGroups: CoachGroup[];
  /** 8-week roster series (KPIs, leaderboard, PRs, signals); null until loaded or when it failed. */
  roster: RosterMetricsResult | null;
  /** True only until the first load finishes; background refreshes never set it. */
  rosterLoading: boolean;
  /** Explicit reload with the loader, for after the coach edits groups or players. */
  reloadRoster: () => Promise<void>;
  followedAthletes: PlayerWithStats[];
  followedIds: string[];
  setFollowedIds: (ids: string[]) => void;
  signalsByPlayer: RosterMetricsResult["signalsByPlayer"];
  panelOpen: boolean;
  setPanelOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  openAthlete: (athlete: PlayerWithStats) => void;
  /** Coach's flag cut-offs, shared by the roster table, the followed-athletes panel and card,
   *  and the Needs Attention KPI tile, so they never disagree. Persisted across reloads. */
  draft: ThresholdDraft;
  setDraft: (d: ThresholdDraft) => void;
  thresholds: AttentionThresholds;
}

const FollowedAthletesContext = createContext<FollowedAthletesContextValue | null>(null);

/**
 * Owns the "Followed athletes" panel's data and open/closed state at the app root, so the panel
 * itself (rendered once, outside <Routes>) survives page navigation instead of resetting to
 * closed and refetching every time the coach switches pages — it fetches independently of
 * whichever page happens to be mounted, since Index.tsx no longer owns this state.
 */
export function FollowedAthletesProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { profile, user, loading: authLoading } = useAuth();
  const [athletes, setAthletes] = useState<PlayerWithStats[]>([]);
  const [coachGroups, setCoachGroups] = useState<CoachGroup[]>([]);
  const [roster, setRoster] = useState<RosterMetricsResult | null>(null);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [storedFollowed, setStoredFollowed] = useState<string[] | null>(readFollowed);
  const [draft, setDraftState] = useState<ThresholdDraft>(readDraft);
  /** Ignores a load that finishes after a newer one started or after logout. */
  const requestRef = useRef(0);

  /**
   * One fetch for everything the roster views show. `silent` is a background refresh: no loader, no
   * timeout toast, and a failure keeps what is on screen. Results go through `stabilize`, so anything that
   * did not change keeps its identity and does not re-render.
   */
  const loadRoster = useCallback(async (silent = false) => {
    if (!profile) return;
    const request = ++requestRef.current;
    const timeoutId = silent
      ? undefined
      : setTimeout(() => {
          setRosterLoading(false);
          toast.error("Loading is taking longer than expected. Please refresh the page.");
        }, 30000);
    try {
      if (!silent) setRosterLoading(true);
      const coachUserId = user?.id ?? "";
      // A cheap {id, user_id} pass lets the roster-series fetch start alongside the heavier
      // per-player stats fetch instead of waiting on it.
      const refs = coachUserId ? await getCoachPlayerRefs(coachUserId) : [];
      const rosterPromise = refs.length
        ? getRosterMetrics(refs).catch((seriesError) => {
            console.error("Roster series failed:", seriesError);
            return null;
          })
        : Promise.resolve(null);

      const [players, groups, rosterResult] = await Promise.all([
        getPlayersWithStatsByCoach(coachUserId),
        coachUserId ? getCoachGroups(coachUserId) : Promise.resolve([]),
        rosterPromise,
      ]);
      if (request !== requestRef.current) return;
      setAthletes((prev) => stabilize(prev, players));
      setCoachGroups((prev) => stabilize(prev, groups));
      setRoster((prev) => stabilize(prev, rosterResult));
    } catch (error) {
      console.error("Error loading roster data:", error);
      if (silent || request !== requestRef.current) return;
      toast.error(`Failed to load dashboard data: ${error instanceof Error ? error.message : "Unknown error"}`);
      setAthletes([]);
      setRoster(null);
    } finally {
      clearTimeout(timeoutId);
      if (!silent && request === requestRef.current) setRosterLoading(false);
    }
  }, [profile, user?.id]);

  useEffect(() => {
    if (authLoading) {
      setRosterLoading(true);
      return;
    }
    if (profile) {
      void loadRoster();
      return;
    }
    // Signed out: drop the previous coach's data so it can never show for the next one.
    requestRef.current++;
    setAthletes([]);
    setCoachGroups([]);
    setRoster(null);
    setRosterLoading(false);
  }, [profile, authLoading, loadRoster]);

  const reloadRoster = useCallback(() => loadRoster(false), [loadRoster]);

  // New workouts reach the roster views without a reload. Watched on Home and while the panel is open;
  // the other pages do not show arrival-driven data.
  useArrivalRefresh({
    playerIds: athletes.map((a) => a.id),
    enabled: !!profile && (pathname === "/" || panelOpen),
    onRefresh: () => loadRoster(true),
  });

  // Nothing stored yet: start by following the first athlete so the strip shows a card.
  const followedIds = useMemo(() => {
    const ids = storedFollowed ?? athletes.slice(0, 1).map((a) => a.id);
    return ids.filter((id) => athletes.some((a) => a.id === id)).slice(0, MAX_FOLLOWED);
  }, [storedFollowed, athletes]);

  const followedAthletes = useMemo(
    () => followedIds.map((id) => athletes.find((a) => a.id === id)).filter((a): a is PlayerWithStats => !!a),
    [followedIds, athletes]
  );

  const setFollowedIds = useCallback((ids: string[]) => {
    setStoredFollowed(ids);
    try {
      localStorage.setItem(FOLLOWED_KEY, JSON.stringify(ids));
    } catch {
      /* storage unavailable: follows last for this visit only */
    }
  }, []);

  const signalsByPlayer = useMemo(() => roster?.signalsByPlayer ?? new Map(), [roster]);

  const openAthlete = useCallback((athlete: PlayerWithStats) => navigate(`/athlete/${athlete.id}`), [navigate]);

  const setDraft = useCallback((d: ThresholdDraft) => {
    setDraftState(d);
    try {
      localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(d));
    } catch {
      /* storage unavailable: cut-offs last for this visit only */
    }
  }, []);

  const thresholds = useMemo(() => thresholdsFromDraft(draft), [draft]);

  const value = useMemo(
    () => ({
      athletes, coachGroups, roster, rosterLoading, reloadRoster, followedAthletes, followedIds, setFollowedIds,
      signalsByPlayer, panelOpen, setPanelOpen, openAthlete, draft, setDraft, thresholds,
    }),
    [
      athletes, coachGroups, roster, rosterLoading, reloadRoster, followedAthletes, followedIds, setFollowedIds,
      signalsByPlayer, panelOpen, openAthlete, draft, setDraft, thresholds,
    ]
  );

  return <FollowedAthletesContext.Provider value={value}>{children}</FollowedAthletesContext.Provider>;
}

export function useFollowedAthletes() {
  const ctx = useContext(FollowedAthletesContext);
  if (!ctx) throw new Error("useFollowedAthletes must be used within a FollowedAthletesProvider");
  return ctx;
}
