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
import { FilterGroup } from "@/components/pulse/FilterBar";
import { RosterViewSwitcher, VIEW_OPTIONS, type RosterView } from "@/components/pulse/RosterViewSwitcher";
import { BlobSelector } from "@/components/pulse/BlobSelector";
import type { LeaderboardMetric, LeaderboardRow } from "@/components/pulse/LeaderboardPanel";
import type { TrainingGridRow } from "@/components/pulse/TrainingGridPanel";
import type { TeamPrRow } from "@/components/pulse/TeamPrsPanel";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { useFollowedAthletes } from "@/contexts/FollowedAthletesContext";
import { getPlayersWithStatsByCoach, getCoachGroups, getCoachPlayerRefs, CoachGroup, PlayerWithStats } from "@/services/playersService";
import { getRosterMetrics, RosterMetricsResult } from "@/services/rosterMetricsService";
import { deliverScheduledMessages } from "@/services/messagesService";
import { athleteFacts } from "@/lib/metrics/athleteFacts";
import { attentionFlags, type AttentionSignal } from "@/lib/metrics/attentionFlags";

const Index = () => {
  const { profile, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { draft, setDraft, thresholds } = useFollowedAthletes();
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
  const [selectedExercise, setSelectedExercise] = useState("");
  const [rosterView, setRosterView] = useState<RosterView>("roster");
  const [leaderboardMetric, setLeaderboardMetric] = useState<LeaderboardMetric>("velocity");
  const [leaderboardExercise, setLeaderboardExercise] = useState("");

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
      // A cheap {id, user_id} pass lets the roster-series fetch (getRosterMetrics)
      // start alongside the heavier per-player stats fetch instead of waiting on it.
      const refs = coachUserId ? await getCoachPlayerRefs(coachUserId) : [];
      const rosterMetricsPromise = refs.length
        ? getRosterMetrics(refs).catch((seriesError) => {
            console.error("Roster series failed:", seriesError);
            return null;
          })
        : Promise.resolve(null);

      const [players, groups, rosterMetrics] = await Promise.all([
        getPlayersWithStatsByCoach(coachUserId),
        coachUserId ? getCoachGroups(coachUserId) : Promise.resolve([]),
        rosterMetricsPromise,
      ]);
      setAthletes(players);
      setCoachGroups(groups);
      setRoster(rosterMetrics);

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

  const byId = useMemo(() => new Map(athletes.map((a) => [a.id, a])), [athletes]);

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
      .map((r) => ({ playerId: r.playerId, name: byId.get(r.playerId)?.name ?? "Unknown", change: r.change, sessionId: r.sessionId }))
      .sort((a, b) => a.change - b.change);
  }, [exerciseBaseline, selectedExercise, byId]);

  // Leaderboard shares the same exercise list as Slower than baseline (same 8-week window).
  useEffect(() => {
    if (!exerciseBaseline) return;
    if (leaderboardExercise && exerciseBaseline.exercises.includes(leaderboardExercise)) return;
    setLeaderboardExercise(exerciseBaseline.defaultExercise);
  }, [exerciseBaseline, leaderboardExercise]);

  const leaderboardRows = useMemo<LeaderboardRow[]>(() => {
    if (!roster) return [];
    const nameOf = (id: string) => byId.get(id)?.name ?? "Unknown";
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
  }, [roster, byId, leaderboardMetric, leaderboardExercise]);

  const trainingGridRows = useMemo<TrainingGridRow[]>(() => {
    if (!roster) return [];
    return athletes
      .map((a) => ({ playerId: a.id, name: a.name, countsByDay: roster.trainingGrid.countsByDayByPlayer.get(a.id) ?? [0, 0, 0, 0, 0, 0, 0] }))
      .filter((r) => r.countsByDay.some((c) => c > 0));
  }, [roster, athletes]);

  const teamPrRows = useMemo<TeamPrRow[]>(() => {
    if (!roster) return [];
    const nameOf = (id: string) => byId.get(id)?.name ?? "Unknown";
    return [...roster.teamPrs]
      .map((r) => ({ ...r, name: nameOf(r.playerId) }))
      .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [roster, byId]);

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

  // Weekly volume: tonnageLbs is real (team.volumeSeries, SP-08). totalWorkKj/distanceM aren't
  // computed yet (see WeeklyLoadVolumeBetaCard's doc comment), so they're mock, scaled off the
  // real tonnage only to keep the bars roughly proportionate — never treat these two as real.
  const volumeData = useMemo(
    () =>
      (team?.volumeSeries ?? []).map((d) => ({
        label: d.label,
        tonnageLbs: d.totalLbs,
        totalWorkKj: +(d.totalLbs * 0.013).toFixed(1),
        distanceM: Math.round(d.totalLbs * 0.0966),
      })),
    [team]
  );

  // Needs-attention counts, same facts/thresholds pipeline as RosterSignalsTable,
  // computed against the coach's saved cut-offs (shared via FollowedAthletesContext
  // with the roster table, the followed panel, and the followed-athlete cards).
  const attentionCounts = useMemo(() => {
    const now = Date.now();
    const reasonCounts: Record<AttentionSignal, number> = { days: 0, drop: 0, tempo: 0, attendance: 0 };
    let flaggedCount = 0;
    for (const a of athletes) {
      const facts = athleteFacts(a, signalsByPlayer.get(a.id), now);
      const flags = attentionFlags(facts, thresholds);
      if (flags.flagged) flaggedCount++;
      (Object.keys(reasonCounts) as AttentionSignal[]).forEach((k) => {
        if (flags[k]) reasonCounts[k]++;
      });
    }
    return { flaggedCount, totalCount: athletes.length, reasonCounts };
  }, [athletes, signalsByPlayer, thresholds]);

  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="v-app">
      <TopNav />
      <LoadingOverlay isLoading={loading} fullScreen message="Loading dashboard..." />

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
              footnote="8 weeks"
              barData={team && team.attSeries.length > 1 ? team.attSeries : undefined}
              accent="var(--brand)"
            />
            <SlowerThanBaselineTile
              exercises={exerciseBaseline?.exercises ?? []}
              selectedExercise={selectedExercise}
              onExerciseChange={setSelectedExercise}
              athletes={slowerAthletes}
              onOpenAthlete={(a, exercise) => {
                const athlete = byId.get(a.playerId);
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
              onRowClick: (id) => openAthlete(byId.get(id)!),
            }}
            grid={{
              dayLabels: roster?.trainingGrid.dayLabels ?? [],
              rows: trainingGridRows,
              onRowClick: (id) => openAthlete(byId.get(id)!),
            }}
            teamPrs={{
              rows: teamPrRows,
              onRowClick: (id) => openAthlete(byId.get(id)!),
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
