import { useState, useMemo, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { Send, Plus, Megaphone, Filter, Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TopNav } from "@/components/TopNav";
import { PageHeader } from "@/components/pulse/PageHeader";
import { KpiTile } from "@/components/pulse/KpiTile";
import { Donut } from "@/components/pulse/Donut";
import { FilterBar, FilterGroup } from "@/components/pulse/FilterBar";
import { AthleteCard, NextPlanInfo } from "@/components/pulse/AthleteCard";
import { PulseAthleteTable } from "@/components/pulse/AthleteTable";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { getPlayersWithStatsByCoach, getCoachTeamIds, PlayerWithStats } from "@/services/playersService";
import { getCoachDashboardStats, DashboardStats } from "@/services/statsService";
import { getRosterMetrics, RosterMetricsResult } from "@/services/rosterMetricsService";
import { getUpcomingWorkoutPlans } from "@/services/workoutPlansService";
import { deliverScheduledMessages } from "@/services/messagesService";
import { flagsFor, priorityScore, isFlagged } from "@/lib/rosterFlags";

const EMPTY_STATS: DashboardStats = {
  totalSessions: 0,
  activeAthletes: 0,
  avgAttendance: 0,
  totalTeams: 0,
  avgTeamLoad: 0,
  topPerformer: "N/A",
  lowestAttendance: 0,
};

type SortMode = "priority" | "name" | "velocity";
const SORT_LABELS: Record<SortMode, string> = { priority: "Priority", name: "Name", velocity: "Velocity" };

interface RosterFilters {
  flaggedOnly: boolean;
  engagement: string[];
  load: string[];
}

const EMPTY_FILTERS: RosterFilters = { flaggedOnly: false, engagement: [], load: [] };

/** Checkbox-style row for the filter/columns dropdowns. */
function CheckRow({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <div className="v-menuitem row" style={{ gap: 9, padding: "7px 8px" }} onClick={onClick}>
      <span
        style={{
          width: 16, height: 16, borderRadius: 5, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1.5px solid " + (on ? "var(--brand)" : "var(--line-2)"),
          background: on ? "var(--brand)" : "var(--surface-1)",
          color: "var(--brand-ink)",
        }}
      >
        {on && <Check size={12} strokeWidth={2} />}
      </span>
      <span style={{ fontSize: 12.5 }}>{label}</span>
    </div>
  );
}

const Index = () => {
  const { profile, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const openAthlete = useCallback(
    (athlete: PlayerWithStats) => navigate(`/athlete/${athlete.id}`),
    [navigate]
  );

  const [athletes, setAthletes] = useState<PlayerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [roster, setRoster] = useState<RosterMetricsResult | null>(null);
  const [nextPlans, setNextPlans] = useState<Map<string, NextPlanInfo>>(new Map());

  const [groupFilter, setGroupFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [filters, setFilters] = useState<RosterFilters>(EMPTY_FILTERS);
  const [showAllFocus, setShowAllFocus] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
      const teamIds = coachUserId ? await getCoachTeamIds(coachUserId) : [];
      const [players, dashboardStats] = await Promise.all([
        getPlayersWithStatsByCoach(coachUserId),
        getCoachDashboardStats(teamIds),
      ]);
      setAthletes(players);
      setStats(dashboardStats);

      // Batched roster series + upcoming plans (fixed query count, not per-player).
      // Non-fatal: the core roster is already rendered if these fail.
      try {
        const [metrics, upcoming] = await Promise.all([
          getRosterMetrics(players.map((p) => ({ id: p.id, user_id: p.user_id }))),
          players.length ? getUpcomingWorkoutPlans(players.map((p) => p.id), 7) : Promise.resolve([]),
        ]);
        setRoster(metrics);

        const planMap = new Map<string, NextPlanInfo>();
        for (const plan of upcoming ?? []) {
          if (plan.player_id && !planMap.has(plan.player_id)) {
            planMap.set(plan.player_id, {
              day: format(new Date(plan.date + "T12:00:00"), "EEE"),
              label: plan.title ?? "Workout",
            });
          }
        }
        setNextPlans(planMap);
      } catch (seriesError) {
        console.error("Roster series/upcoming plans failed:", seriesError);
        setRoster(null);
        setNextPlans(new Map());
      }

      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("Error loading data:", error);
      toast.error(`Failed to load dashboard data: ${error instanceof Error ? error.message : "Unknown error"}`);
      setAthletes([]);
      setStats(EMPTY_STATS);
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

  const metricsByPlayer = useMemo(() => roster?.perPlayer ?? new Map(), [roster]);
  const team = roster?.team ?? null;

  // ── Derived: groups, filters, sort ─────────────────────────────────────────
  const groups = useMemo<FilterGroup[]>(() => {
    const map = new Map<string, FilterGroup>();
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
  }, [athletes]);

  const activeFilterCount =
    (filters.flaggedOnly ? 1 : 0) + filters.engagement.length + filters.load.length;

  const toggleFilter = (key: "engagement" | "load", val: string) =>
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val],
    }));

  const filteredAthletes = useMemo(() => {
    const list = athletes.filter((a) => {
      if (groupFilter === "unassigned") {
        if (a.team_id !== null) return false;
      } else if (groupFilter !== "all" && a.team_id !== groupFilter) {
        return false;
      }
      if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filters.flaggedOnly && !isFlagged(a, metricsByPlayer.get(a.id))) return false;
      if (filters.engagement.length && !filters.engagement.includes(a.engagement)) return false;
      if (filters.load.length && !filters.load.includes(a.loadRec)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name);
      if (sortMode === "velocity") {
        const va = metricsByPlayer.get(a.id)?.recentVel ?? a.avgVelocity;
        const vb = metricsByPlayer.get(b.id)?.recentVel ?? b.avgVelocity;
        return vb - va;
      }
      return priorityScore(b, metricsByPlayer.get(b.id)) - priorityScore(a, metricsByPlayer.get(a.id));
    });
  }, [athletes, groupFilter, search, filters, sortMode, metricsByPlayer]);

  const focusAthletes = useMemo(
    () =>
      [...athletes]
        .sort((a, b) => priorityScore(b, metricsByPlayer.get(b.id)) - priorityScore(a, metricsByPlayer.get(a.id)))
        .slice(0, showAllFocus ? 6 : 3),
    [athletes, metricsByPlayer, showAllFocus]
  );

  // ── Derived: KPI values ────────────────────────────────────────────────────
  const teamVelNow = team && team.velSeries.length ? team.velSeries[team.velSeries.length - 1] : null;
  const teamVelPrev = team && team.velSeries.length > 1 ? team.velSeries[team.velSeries.length - 2] : null;
  const attNow = team && team.attSeries.length ? team.attSeries[team.attSeries.length - 1] : null;
  const attPrev = team && team.attSeries.length > 1 ? team.attSeries[team.attSeries.length - 2] : null;

  const loadMix = useMemo(() => {
    const mix = { Increase: 0, Maintain: 0, Decrease: 0 };
    for (const a of athletes) {
      if (a.loadRec === "Increase") mix.Increase++;
      else if (a.loadRec === "Decrease") mix.Decrease++;
      else mix.Maintain++;
    }
    return mix;
  }, [athletes]);

  const flaggedCount = useMemo(
    () => athletes.filter((a) => isFlagged(a, metricsByPlayer.get(a.id))).length,
    [athletes, metricsByPlayer]
  );

  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="v-app">
      <TopNav />
      <LoadingOverlay isLoading={loading} fullScreen message="Loading dashboard..." />

      <main style={{ padding: "20px 28px 28px", maxWidth: 1480, margin: "0 auto", width: "100%", flex: 1 }}>
        <PageHeader
          eyebrow="Coach dashboard"
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

        {/* Team overview strip */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          <KpiTile
            label="Avg attendance"
            value={stats.avgAttendance}
            unit="%"
            delta={attNow != null && attPrev != null ? attNow - attPrev : null}
            deltaSuffix="pt"
            footnote="plan completion, wk over wk"
            sparkData={team && team.attSeries.length > 1 ? team.attSeries : undefined}
            sparkTarget={85}
            accent="var(--brand)"
          />
          <KpiTile
            label="Team avg velocity"
            value={teamVelNow != null ? teamVelNow.toFixed(2) : "—"}
            unit="m/s"
            delta={teamVelNow != null && teamVelPrev != null ? +(teamVelNow - teamVelPrev).toFixed(2) : null}
            footnote="roster average · weekly"
            sparkData={team && team.velSeries.length > 1 ? team.velSeries : undefined}
            accent="var(--brand)"
          />
          <KpiTile
            label="Sessions this wk"
            value={team?.sessionsThisWeek ?? 0}
            delta={team ? team.sessionsThisWeek - team.sessionsLastWeek : null}
            footnote="vs last week"
            sparkData={team ? team.sessionsByDay : undefined}
            accent="var(--brand)"
          />

          {/* Load recommendation mix */}
          <div className="v-card padded" style={{ display: "flex", flexDirection: "column" }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <div className="v-label">Load recommendation mix</div>
              <span className="v-meta mono" style={{ fontSize: 11 }}>{athletes.length} athletes</span>
            </div>
            <div className="row" style={{ gap: 14, flex: 1 }}>
              <Donut
                size={80}
                thickness={11}
                segments={[
                  { value: loadMix.Increase, color: "var(--good)" },
                  { value: loadMix.Maintain, color: "var(--ink-3)" },
                  { value: loadMix.Decrease, color: "var(--warn)" },
                ]}
                centerValue={loadMix.Maintain}
                centerLabel="on plan"
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11.5 }}>
                {[
                  { c: "var(--good)", l: "Increase", v: loadMix.Increase },
                  { c: "var(--ink-3)", l: "Maintain", v: loadMix.Maintain },
                  { c: "var(--warn)", l: "Reduce", v: loadMix.Decrease },
                ].map((s) => (
                  <div key={s.l} className="row" style={{ gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: s.c }} />
                    <span style={{ color: "var(--ink-1)" }}>{s.l}</span>
                    <span className="mono" style={{ marginLeft: "auto", color: "var(--ink-2)" }}>{s.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Filter bar */}
        <FilterBar
          groups={groups}
          value={groupFilter}
          onChange={setGroupFilter}
          search={search}
          onSearch={setSearch}
          right={
            <Popover>
              <PopoverTrigger asChild>
                <button className="v-btn ghost">
                  <Filter size={12} strokeWidth={1.5} />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="v-chip" data-tone="brand" style={{ height: 16, padding: "0 5px", marginLeft: 2 }}>{activeFilterCount}</span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="v-pop" style={{ width: 236, padding: 5 }}>
                <div className="row" style={{ justifyContent: "space-between", padding: "4px 8px 6px" }}>
                  <span className="v-label">Filters</span>
                  <button className="v-btn ghost" style={{ height: 22, fontSize: 11 }} onClick={() => setFilters(EMPTY_FILTERS)}>Clear</button>
                </div>
                <CheckRow label="Flagged only" on={filters.flaggedOnly} onClick={() => setFilters((f) => ({ ...f, flaggedOnly: !f.flaggedOnly }))} />
                <div className="v-label" style={{ padding: "8px 8px 2px", fontSize: 9.5 }}>Engagement</div>
                {["High", "Moderate", "Low"].map((e) => (
                  <CheckRow key={e} label={e} on={filters.engagement.includes(e)} onClick={() => toggleFilter("engagement", e)} />
                ))}
                <div className="v-label" style={{ padding: "8px 8px 2px", fontSize: 9.5 }}>Load recommendation</div>
                {([["Increase", "Increase"], ["Maintain", "Maintain"], ["Decrease", "Reduce"]] as const).map(([v, l]) => (
                  <CheckRow key={v} label={l} on={filters.load.includes(v)} onClick={() => toggleFilter("load", v)} />
                ))}
              </PopoverContent>
            </Popover>
          }
        />

        {/* Focus cards */}
        {athletes.length > 0 && (
          <section style={{ marginTop: 20 }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <div className="v-h2">Worth a look</div>
                <div className="v-meta" style={{ marginTop: 2 }}>
                  Athletes whose recent data has drifted most from baseline{flaggedCount > 0 ? ` · ${flaggedCount} flagged` : ""}.
                </div>
              </div>
              {athletes.length > 3 && (
                <button className="v-btn ghost" onClick={() => setShowAllFocus((s) => !s)}>
                  {showAllFocus ? "Show fewer" : "See all"}
                  <ChevronDown size={12} strokeWidth={1.5} style={{ transform: showAllFocus ? "rotate(180deg)" : "none" }} />
                </button>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {focusAthletes.map((a) => (
                <AthleteCard
                  key={a.id}
                  athlete={a}
                  metrics={metricsByPlayer.get(a.id)}
                  nextPlan={nextPlans.get(a.id)}
                  onSelect={openAthlete}
                />
              ))}
            </div>
          </section>
        )}

        {/* Roster table */}
        <section style={{ marginTop: 28 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div className="v-h2">Roster · {filteredAthletes.length}</div>
              <div className="v-meta" style={{ marginTop: 2 }}>Click any row to open the athlete detail.</div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="v-btn ghost" style={{ fontSize: 12 }}>
                    Sort: {SORT_LABELS[sortMode]}
                    <ChevronDown size={12} strokeWidth={1.5} />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="v-pop" style={{ width: 170, padding: 5 }}>
                  {(Object.entries(SORT_LABELS) as Array<[SortMode, string]>).map(([k, l]) => (
                    <div key={k} className="v-menuitem row" style={{ gap: 8, padding: 8, justifyContent: "space-between" }} onClick={() => setSortMode(k)}>
                      <span style={{ fontSize: 12.5 }}>{l}</span>
                      {sortMode === k && <Check size={12} strokeWidth={1.5} style={{ color: "var(--brand)" }} />}
                    </div>
                  ))}
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="v-btn ghost" style={{ fontSize: 12 }}>Columns</button>
                </PopoverTrigger>
                <PopoverContent align="end" className="v-pop" style={{ width: 216, padding: 5 }}>
                  <div className="v-label" style={{ padding: "4px 8px 6px" }}>Toggle columns</div>
                  <CheckRow label="Advanced (ROM · Tempo)" on={showAdvanced} onClick={() => setShowAdvanced((v) => !v)} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="v-card flush v-scroll" style={{ overflow: "auto" }}>
            <PulseAthleteTable
              athletes={filteredAthletes}
              metricsByPlayer={metricsByPlayer}
              showAdvanced={showAdvanced}
              onSelect={openAthlete}
            />
          </div>
        </section>
      </main>

      <footer style={{ padding: "16px 28px", textAlign: "center" }} className="v-meta">
        © {new Date().getFullYear()} Veiss. All rights reserved.
      </footer>
    </div>
  );
};

export default Index;
