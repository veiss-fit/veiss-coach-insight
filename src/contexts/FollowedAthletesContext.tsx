import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { getPlayersWithStatsByCoach, type PlayerWithStats } from "@/services/playersService";
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
  athletes: PlayerWithStats[];
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
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [athletes, setAthletes] = useState<PlayerWithStats[]>([]);
  const [roster, setRoster] = useState<RosterMetricsResult | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [storedFollowed, setStoredFollowed] = useState<string[] | null>(readFollowed);
  const [draft, setDraftState] = useState<ThresholdDraft>(readDraft);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    (async () => {
      try {
        const players = await getPlayersWithStatsByCoach(user?.id ?? "");
        if (cancelled) return;
        setAthletes(players);
        try {
          const result = await getRosterMetrics(players.map((p) => ({ id: p.id, user_id: p.user_id })));
          if (!cancelled) setRoster(result);
        } catch (seriesError) {
          console.error("Followed athletes panel: roster signals failed:", seriesError);
          if (!cancelled) setRoster(null);
        }
      } catch (error) {
        console.error("Followed athletes panel: failed to load athletes:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, user?.id]);

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
      athletes, followedAthletes, followedIds, setFollowedIds, signalsByPlayer, panelOpen, setPanelOpen, openAthlete,
      draft, setDraft, thresholds,
    }),
    [athletes, followedAthletes, followedIds, setFollowedIds, signalsByPlayer, panelOpen, openAthlete, draft, setDraft, thresholds]
  );

  return <FollowedAthletesContext.Provider value={value}>{children}</FollowedAthletesContext.Provider>;
}

export function useFollowedAthletes() {
  const ctx = useContext(FollowedAthletesContext);
  if (!ctx) throw new Error("useFollowedAthletes must be used within a FollowedAthletesProvider");
  return ctx;
}
