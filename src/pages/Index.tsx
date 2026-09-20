import { useState, useMemo, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { Send, Plus, Megaphone, Users } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { TeamSportManager } from "@/components/TeamSportManager";
import { PageHeader } from "@/components/pulse/PageHeader";
import { KpiTile } from "@/components/pulse/KpiTile";
import { FollowedAthleteCard, AddFollowCard } from "@/components/pulse/FollowedAthleteCard";
import { FilterBar, FilterGroup } from "@/components/pulse/FilterBar";
import { RosterSignalsTable, INITIAL_DRAFT, thresholdsFromDraft, type ThresholdDraft } from "@/components/pulse/RosterSignalsTable";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { getPlayersWithStatsByCoach, getCoachGroups, CoachGroup, PlayerWithStats } from "@/services/playersService";
import { getRosterMetrics, RosterMetricsResult } from "@/services/rosterMetricsService";
import { deliverScheduledMessages } from "@/services/messagesService";

/** Strip slots: Avg attendance takes one, followed athletes (plus the add card) fill the rest. */
const MAX_FOLLOWED = 3;
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

        {/* Team overview strip */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          <KpiTile
            label="Avg attendance"
            value={team?.avgAttendance ?? 0}
            unit="%"
            delta={attNow != null && attPrev != null ? attNow - attPrev : null}
            deltaSuffix="pt"
            footnote="plan completion, wk over wk"
            sparkData={team && team.attSeries.length > 1 ? team.attSeries : undefined}
            sparkTarget={85}
            sparkAxisLabels={["8 wks ago", "this wk"]}
            accent="var(--brand)"
          />
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
        </section>

        {/* Filter bar */}
        <FilterBar
          groups={groups}
          value={groupFilter}
          onChange={setGroupFilter}
          search={search}
          onSearch={setSearch}
        />

        {/* Roster table */}
        <section style={{ marginTop: 28 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div className="v-h2">Roster · {filteredAthletes.length}</div>
              <div className="v-meta" style={{ marginTop: 2 }}>Click any row to open the athlete detail.</div>
            </div>
            <button className="v-btn ghost" style={{ fontSize: 12 }} onClick={() => setGroupManagerOpen(true)}>
              <Users size={12} strokeWidth={1.5} />
              Manage groups
            </button>
          </div>
          <div className="v-card flush v-scroll" style={{ overflow: "auto" }}>
            <RosterSignalsTable
              athletes={filteredAthletes}
              signalsByPlayer={signalsByPlayer}
              onSelect={openAthlete}
              onOpenExercise={openExercise}
              draft={draft}
              onDraftChange={setDraft}
            />
          </div>
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
