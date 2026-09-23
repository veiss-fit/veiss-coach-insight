import { useState, useMemo, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { Send, Plus, Megaphone, Users } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { TeamSportManager } from "@/components/TeamSportManager";
import { PageHeader } from "@/components/pulse/PageHeader";
import { KpiTile } from "@/components/pulse/KpiTile";
import { SlowerThanBaselineTile, type SlowerAthlete } from "@/components/pulse/SlowerThanBaselineTile";
import { SessionsTile } from "@/components/pulse/SessionsTile";
import { NeedsAttentionTile } from "@/components/pulse/NeedsAttentionTile";
import { WeeklyVolumePanel } from "@/components/pulse/WeeklyVolumePanel";
import { FollowedAthleteCard, AddFollowCard } from "@/components/pulse/FollowedAthleteCard";
import { FilterGroup } from "@/components/pulse/FilterBar";
import { RosterViewSwitcher, VIEW_OPTIONS, type RosterView } from "@/components/pulse/RosterViewSwitcher";
import { BlobSelector } from "@/components/pulse/BlobSelector";
import { INITIAL_DRAFT, thresholdsFromDraft, type ThresholdDraft } from "@/components/pulse/RosterSignalsTable";
import type { LeaderboardMetric, LeaderboardRow } from "@/components/pulse/LeaderboardPanel";
import type { TrainingGridRow } from "@/components/pulse/TrainingGridPanel";
import type { TeamPrRow } from "@/components/pulse/TeamPrsPanel";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { getPlayersWithStatsByCoach, getCoachGroups, CoachGroup, PlayerWithStats } from "@/services/playersService";
import { getRosterMetrics, RosterMetricsResult } from "@/services/rosterMetricsService";
import { deliverScheduledMessages } from "@/services/messagesService";
import { athleteFacts } from "@/lib/metrics/athleteFacts";
import { attentionFlags, DEFAULT_THRESHOLDS, type AttentionSignal } from "@/lib/metrics/attentionFlags";

/** Strip slots: Avg attendance takes one, followed athletes (plus the add card) fill the rest. */
const MAX_FOLLOWED = 4;
const FOLLOWED_KEY = "veiss.followedAthletes";

const readFollowed = (): string[] | null => {
  try {
    const raw = localStorage.getItem(FOLLOWED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
};

const Index = () => {
  const { profile, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const openAthlete = useCallback(
    (athlete: PlayerWithStats) => navigate(`/athlete/${athlete.id}`),
    [navigate]
  );

  const [athletes, setAthletes] = useState<PlayerWithStats[]>([]);
  const [coachGroups, setCoachGroups] = useState<CoachGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState<RosterMetricsResult | null>(null);

  const [groupFilter, setGroupFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);
  const [followedPanelOpen, setFollowedPanelOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState("");
  const [rosterView, setRosterView] = useState<RosterView>("roster");
  const [leaderboardMetric, setLeaderboardMetric] = useState<LeaderboardMetric>("velocity");
  const [leaderboardExercise, setLeaderboardExercise] = useState("");
  const [draft, setDraft] = useState<ThresholdDraft>(INITIAL_DRAFT);
  // TODO(page integration): stored in this browser only. Persist per coach (profile settings) later.
  const [storedFollowed, setStoredFollowed] = useState<string[] | null>(readFollowed);

  const loadData = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    const timeoutId = setTimeout(() => {
      setLoading(false);
      toast.error("Loading is taking longer than expected. Please refresh the page.");
    }, 30000);

    try {
      setLoading(true);
      const coachUserId = user?.id ?? "";
      // teamIds is resolved as part of scoping the roster query itself
      // (getPlayersWithStatsByCoach → getCoachTeamIds internally); no separate
      // dashboard-stats fetch is needed anymore — attendance now comes from
      // the same rosterMetrics pipeline as its own trend (see below).
      const [players, groups] = await Promise.all([
        getPlayersWithStatsByCoach(coachUserId),
        coachUserId ? getCoachGroups(coachUserId) : Promise.resolve([]),
      ]);
      setAthletes(players);
      setCoachGroups(groups);

      // Batched roster series and signals (fixed query count, not per-player).
      // Non-fatal: the core roster is already rendered if this fails.
      try {
        setRoster(await getRosterMetrics(players.map((p) => ({ id: p.id, user_id: p.user_id }))));
      } catch (seriesError) {
        console.error("Roster series failed:", seriesError);
        setRoster(null);
      }

      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("Error loading data:", error);
      toast.error(`Failed to load dashboard data: ${error instanceof Error ? error.message : "Unknown error"}`);
      setAthletes([]);
      setRoster(null);
    } finally {
      setLoading(false);
    }
  }, [profile, user?.id]);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }
    if (profile) loadData();
    else setLoading(false);
  }, [profile, authLoading, loadData]);

  // Deliver any scheduled messages whose time has passed, checked every 60 seconds.
  useEffect(() => {
    if (!user?.id) return;
    deliverScheduledMessages(user.id);
    const interval = setInterval(() => deliverScheduledMessages(user.id!), 60_000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Signal-cell links: a drop opens the velocity graphs, a tempo shift the rep-timing (time) graphs.
  const openExercise = useCallback(
    (athlete: PlayerWithStats, exercise: string, sessionId: string | null, kind: "drop" | "tempo") => {
      const params = new URLSearchParams({ tab: "sessions", exercise, view: kind === "tempo" ? "time" : "velocity" });
      if (sessionId) params.set("session", sessionId);
      navigate(`/athlete/${athlete.id}?${params}`);
    },
    [navigate]
  );

  const thresholds = useMemo(() => thresholdsFromDraft(draft), [draft]);

  // Nothing stored yet: start by following the first athlete so the strip shows a card.
  const followedIds = useMemo(() => {
    const ids = storedFollowed ?? athletes.slice(0, 1).map((a) => a.id);
    return ids.filter((id) => athletes.some((a) => a.id === id)).slice(0, MAX_FOLLOWED);
  }, [storedFollowed, athletes]);
  const followedAthletes = useMemo(
    () => followedIds.map((id) => athletes.find((a) => a.id === id)).filter((a): a is PlayerWithStats => !!a),
    [followedIds, athletes]
  );
  const setFollowedIds = (ids: string[]) => {
    setStoredFollowed(ids);
    try {
      localStorage.setItem(FOLLOWED_KEY, JSON.stringify(ids));
    } catch {
      /* storage unavailable: follows last for this visit only */
    }
  };

  const signalsByPlayer = useMemo(() => roster?.signalsByPlayer ?? new Map(), [roster]);
  const team = roster?.team ?? null;
  const exerciseBaseline = roster?.exerciseBaseline ?? null;

  // Default the exercise picker once real data lands, and if the coach's pick
  // ever stops being trained (roster refresh, exercise renamed), fall back too.
  useEffect(() => {
    if (!exerciseBaseline) return;
    if (selectedExercise && exerciseBaseline.exercises.includes(selectedExercise)) return;
    setSelectedExercise(exerciseBaseline.defaultExercise);
  }, [exerciseBaseline, selectedExercise]);

  const slowerAthletes = useMemo<SlowerAthlete[]>(() => {
    if (!exerciseBaseline) return [];
    const rows = exerciseBaseline.byExercise.get(selectedExercise) ?? [];
    return rows
      .map((r) => ({ playerId: r.playerId, name: athletes.find((a) => a.id === r.playerId)?.name ?? "Unknown", change: r.change, sessionId: r.sessionId }))
      .sort((a, b) => a.change - b.change);
  }, [exerciseBaseline, selectedExercise, athletes]);

  // Leaderboard shares the same exercise list as Slower than baseline (same 8-week window).
  useEffect(() => {
    if (!exerciseBaseline) return;
    if (leaderboardExercise && exerciseBaseline.exercises.includes(leaderboardExercise)) return;
    setLeaderboardExercise(exerciseBaseline.defaultExercise);
  }, [exerciseBaseline, leaderboardExercise]);

  const leaderboardRows = useMemo<LeaderboardRow[]>(() => {
    if (!roster) return [];
    const nameOf = (id: string) => athletes.find((a) => a.id === id)?.name ?? "Unknown";
    let entries: { playerId: string; value: number }[];
    if (leaderboardMetric === "velocity") {
      entries = roster.leaderboard.velocityByExercise.get(leaderboardExercise) ?? [];
    } else if (leaderboardMetric === "baseline") {
      entries = (roster.exerciseBaseline.byExercise.get(leaderboardExercise) ?? []).map((r) => ({ playerId: r.playerId, value: r.change }));
    } else if (leaderboardMetric === "sessions") {
      entries = [...roster.leaderboard.sessionsByPlayer.entries()].map(([playerId, value]) => ({ playerId, value }));
    } else {
      entries = [...roster.leaderboard.completionByPlayer.entries()].map(([playerId, value]) => ({ playerId, value }));
    }
    return [...entries]
      .sort((a, b) => b.value - a.value)
      .map((e) => ({ playerId: e.playerId, name: nameOf(e.playerId), value: e.value, firstPlaceCount: roster.leaderboard.firstPlaceCounts.get(e.playerId) }));
  }, [roster, athletes, leaderboardMetric, leaderboardExercise]);

  const trainingGridRows = useMemo<TrainingGridRow[]>(() => {
    if (!roster) return [];
    return athletes
      .map((a) => ({ playerId: a.id, name: a.name, countsByDay: roster.trainingGrid.countsByDayByPlayer.get(a.id) ?? [0, 0, 0, 0, 0, 0, 0] }))
      .filter((r) => r.countsByDay.some((c) => c > 0));
  }, [roster, athletes]);

  const teamPrRows = useMemo<TeamPrRow[]>(() => {
    if (!roster) return [];
    const nameOf = (id: string) => athletes.find((a) => a.id === id)?.name ?? "Unknown";
    return [...roster.teamPrs]
      .map((r) => ({ ...r, name: nameOf(r.playerId) }))
      .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [roster, athletes]);

  // ── Derived: groups, filters, sort ─────────────────────────────────────────
  const groups = useMemo<FilterGroup[]>(() => {
    const map = new Map<string, FilterGroup>();
    // Seed every group the coach owns at size 0 first, so ones with no players
    // assigned yet still show up in the filter bar instead of being invisible.
    for (const g of coachGroups) {
      map.set(g.id, { id: g.id, name: g.name || "Unnamed group", size: 0 });
    }
    for (const a of athletes) {
      if (!a.team_id) continue;
      const existing = map.get(a.team_id);
      if (existing) existing.size = (existing.size ?? 0) + 1;
      else map.set(a.team_id, { id: a.team_id, name: a.group || "Unnamed group", size: 1 });
    }
    const list = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    const unassigned = athletes.filter((a) => !a.team_id).length;
    if (unassigned > 0) list.push({ id: "unassigned", name: "Unassigned", size: unassigned });
    return list;
  }, [athletes, coachGroups]);

  const filteredAthletes = useMemo(() => {
    return athletes.filter((a) => {
      if (groupFilter === "unassigned") {
        if (a.team_id !== null) return false;
      } else if (groupFilter !== "all" && a.team_id !== groupFilter) {
        return false;
      }
      if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [athletes, groupFilter, search]);

  // ── Derived: KPI values ────────────────────────────────────────────────────
  const attNow = team && team.attSeries.length ? team.attSeries[team.attSeries.length - 1] : null;
  const attPrev = team && team.attSeries.length > 1 ? team.attSeries[team.attSeries.length - 2] : null;

  // Weekly volume: tonnageLbs is real (team.volumeSeries, SP-08). totalWorkKj/distanceMi aren't
  // computed yet (see WeeklyLoadVolumeBetaCard's doc comment), so they're mock, scaled off the
  // real tonnage only to keep the bars roughly proportionate — never treat these two as real.
  const volumeData = useMemo(
    () =>
      (team?.volumeSeries ?? []).map((d) => ({
        label: d.label,
        tonnageLbs: d.totalLbs,
        totalWorkKj: +(d.totalLbs * 0.013).toFixed(1),
        distanceMi: +(d.totalLbs * 0.00006).toFixed(2),
      })),
    [team]
  );

  // Needs-attention counts, same facts/thresholds pipeline as RosterSignalsTable,
  // computed against the coach's saved cut-offs (not the table's in-progress draft).
  const attentionCounts = useMemo(() => {
    const now = Date.now();
    const reasonCounts: Record<AttentionSignal, number> = { days: 0, drop: 0, tempo: 0, attendance: 0 };
    let flaggedCount = 0;
    for (const a of athletes) {
      const facts = athleteFacts(a, signalsByPlayer.get(a.id), now);
      const flags = attentionFlags(facts, DEFAULT_THRESHOLDS);
      if (flags.flagged) flaggedCount++;
      (Object.keys(reasonCounts) as AttentionSignal[]).forEach((k) => {
        if (flags[k]) reasonCounts[k]++;
      });
    }
    return { flaggedCount, totalCount: athletes.length, reasonCounts };
  }, [athletes, signalsByPlayer]);

  // Per-slot flagged state for the followed-athletes status disks, same thresholds the cards use.
  const followedFlagged = useMemo(() => {
    const now = Date.now();
    return followedAthletes.map((a) => attentionFlags(athleteFacts(a, signalsByPlayer.get(a.id), now), thresholds).flagged);
  }, [followedAthletes, signalsByPlayer, thresholds]);

  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="v-app">
      <TopNav />
      <LoadingOverlay isLoading={loading} fullScreen message="Loading dashboard..." />

      <div
        style={{
          position: "fixed",
          top: "50%",
          left: followedPanelOpen ? 280 : 0,
          transform: "translateY(-50%)",
          zIndex: 41,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transition: "left 0.18s ease",
        }}
      >
        <button
          type="button"
          onClick={() => setFollowedPanelOpen((v) => !v)}
          aria-label={followedPanelOpen ? "Close followed athletes" : "Open followed athletes"}
          aria-expanded={followedPanelOpen}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            padding: "12px 6px",
            border: "1px solid var(--line-2)",
            borderLeft: followedPanelOpen ? "1px solid var(--line-2)" : "none",
            borderRadius: "0 8px 8px 0",
            background: "var(--surface-1)",
            color: "var(--ink-1)",
            cursor: "pointer",
          }}
        >
          <Users size={14} strokeWidth={1.5} />
          <span
            className="v-meta"
            style={{ writingMode: "vertical-rl", fontSize: 10.5, letterSpacing: 0.3 }}
          >
            Followed
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {Array.from({ length: MAX_FOLLOWED }, (_, i) => followedAthletes[i]).map((a, i) => (
              <span
                key={a?.id ?? `empty-${i}`}
                title={a ? `${a.name}${followedFlagged[i] ? " · flagged" : ""}` : "Empty slot"}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: !a ? "var(--line-2)" : followedFlagged[i] ? "var(--bad)" : "var(--good)",
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        </button>
      </div>

      {followedPanelOpen && (
        <div
          onClick={() => setFollowedPanelOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 39 }}
        />
      )}

      <div
        style={{
          position: "fixed",
          top: 0,
          bottom: 0,
          left: followedPanelOpen ? 0 : -281,
          width: 280,
          zIndex: 40,
          background: "var(--surface-1)",
          borderRight: "1px solid var(--line-2)",
          boxShadow: followedPanelOpen ? "2px 0 16px rgba(0,0,0,0.15)" : "none",
          transition: "left 0.18s ease",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: 16,
          overflowY: "auto",
        }}
      >
        <div className="v-label">Followed athletes</div>
        {followedAthletes.map((a) => (
          <FollowedAthleteCard
            key={a.id}
            athlete={a}
            signals={signalsByPlayer.get(a.id)}
            thresholds={thresholds}
            onOpen={openAthlete}
            onUnfollow={(x) => setFollowedIds(followedIds.filter((id) => id !== x.id))}
          />
        ))}
        {followedAthletes.length < MAX_FOLLOWED && (
          <AddFollowCard
            choices={athletes.filter((a) => !followedIds.includes(a.id))}
            onAdd={(a) => setFollowedIds([...followedIds, a.id])}
          />
        )}
      </div>

      <main style={{ padding: "20px 28px 28px", maxWidth: 1480, margin: "0 auto", width: "100%", flex: 1 }}>
        <PageHeader
          title="Team Pulse"
          subtitle={`${athletes.length} athlete${athletes.length !== 1 ? "s" : ""} · ${groups.filter((g) => g.id !== "unassigned").length} group${groups.filter((g) => g.id !== "unassigned").length !== 1 ? "s" : ""} · week of ${format(new Date(), "MMM d")}`}
          actions={
            <>
              <Link className="v-btn ghost" to="/messages"><Megaphone size={12} strokeWidth={1.5} />Announce</Link>
              <Link className="v-btn" to="/send-programming?tab=templates"><Plus size={12} strokeWidth={1.5} />Template</Link>
              <Link className="v-btn brand" to="/send-programming"><Send size={12} strokeWidth={1.5} />Send programming</Link>
            </>
          }
        />

        {/* Team overview: 2x2 KPI grid + weekly volume, side by side */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gridTemplateRows: "repeat(2, 1fr)", gap: 12 }}>
            <KpiTile
              label="Avg attendance"
              value={team?.avgAttendance ?? 0}
              unit="%"
              delta={attNow != null && attPrev != null ? attNow - attPrev : null}
              deltaSuffix="pt"
              footnote="this week"
              barData={team && team.attSeries.length > 1 ? team.attSeries : undefined}
              accent="var(--brand)"
            />
            <SlowerThanBaselineTile
              exercises={exerciseBaseline?.exercises ?? []}
              selectedExercise={selectedExercise}
              onExerciseChange={setSelectedExercise}
              athletes={slowerAthletes}
              onOpenAthlete={(a, exercise) => {
                const athlete = athletes.find((x) => x.id === a.playerId);
                if (athlete) openExercise(athlete, exercise, a.sessionId, "drop");
              }}
            />
            <SessionsTile
              sessionsThisWeek={team?.sessionsThisWeek ?? 0}
              sessionsLastWeek={team?.sessionsLastWeek ?? 0}
              sessionsByDay={team?.sessionsByDay ?? [0, 0, 0, 0, 0, 0, 0]}
            />
            <NeedsAttentionTile
              flaggedCount={attentionCounts.flaggedCount}
              totalCount={attentionCounts.totalCount}
              reasonCounts={attentionCounts.reasonCounts}
            />
          </div>
          <WeeklyVolumePanel data={volumeData} coveragePct={team?.volumeCoveragePct ?? 0} />
        </section>

        {/* Roster table */}
        <section style={{ marginTop: 28 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div className="v-h2">Roster · {filteredAthletes.length}</div>
              <div className="v-meta" style={{ marginTop: 2 }}>Click any row to open the athlete detail.</div>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <BlobSelector options={VIEW_OPTIONS} value={rosterView} onChange={setRosterView} />
              <button className="v-btn ghost" style={{ fontSize: 12 }} onClick={() => setGroupManagerOpen(true)}>
                <Users size={12} strokeWidth={1.5} />
                Manage groups
              </button>
            </div>
          </div>
          <RosterViewSwitcher
            view={rosterView}
            onViewChange={setRosterView}
            hideSelector
            roster={{
              athletes: filteredAthletes,
              signalsByPlayer,
              onSelect: openAthlete,
              onOpenExercise: openExercise,
              draft,
              onDraftChange: setDraft,
              groups,
              groupFilter,
              onGroupFilterChange: setGroupFilter,
              search,
              onSearchChange: setSearch,
            }}
            leaderboard={{
              exercises: exerciseBaseline?.exercises ?? [],
              selectedExercise: leaderboardExercise,
              onExerciseChange: setLeaderboardExercise,
              metric: leaderboardMetric,
              onMetricChange: setLeaderboardMetric,
              rows: leaderboardRows,
              onRowClick: (id) => openAthlete(athletes.find((a) => a.id === id)!),
            }}
            grid={{
              dayLabels: roster?.trainingGrid.dayLabels ?? [],
              rows: trainingGridRows,
              onRowClick: (id) => openAthlete(athletes.find((a) => a.id === id)!),
            }}
            teamPrs={{
              rows: teamPrRows,
              onRowClick: (id) => openAthlete(athletes.find((a) => a.id === id)!),
            }}
          />
        </section>
      </main>

      <footer style={{ padding: "16px 28px", textAlign: "center" }} className="v-meta">
        © {new Date().getFullYear()} Veiss. All rights reserved.
      </footer>

      <TeamSportManager
        open={groupManagerOpen}
        onClose={() => setGroupManagerOpen(false)}
        onPlayersChanged={loadData}
      />
    </div>
  );
};

export default Index;
