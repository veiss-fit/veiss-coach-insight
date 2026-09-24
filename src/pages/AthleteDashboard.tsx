import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { format, differenceInCalendarWeeks, isAfter, subDays, startOfDay } from "date-fns";
import { Bell, Send, ChevronRight, Plus, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { Avatar } from "@/components/pulse/Avatar";
import { UnderlineTabs } from "@/components/pulse/Tabs";
import { WeeklyLoadChart, WeeklyLoadPoint } from "@/components/pulse/charts";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { getPlayerById, getCoachTeamIds, PlayerWithStats } from "@/services/playersService";
import { getPlayerSessions, SessionData } from "@/services/sessionsService";
import { getPlayerWorkoutPlans } from "@/services/workoutPlansService";
import { getPlayerCoachNotes, addCoachNote, CoachNote } from "@/services/coachFeedbackService";
import { findPrimaryExercise } from "@/lib/athleteSummaryUtils";
import { lastDaysFor } from "@/lib/rosterFlags";
import { findMatchingSessionForPlan } from "@/lib/workoutAttendance";
import { SESSIONS_TARGET } from "@/lib/vbtZones";
import { canonicalizeExerciseName } from "@/lib/targetEvaluation";
import { historyByExercise, sessionSets, sessionRom, sessionTiming, sessionMoment, byMoment } from "@/lib/metrics/sessionAdapters";
import { RangeOfMotionCards } from "@/components/pulse/RangeOfMotionCard";
import { RepTimingCards } from "@/components/pulse/RepTimingCard";
import { FadeSwap } from "@/components/pulse/FadeSwap";
import { PersonalRecordsCard } from "@/components/pulse/PersonalRecordsCard";
import { twoColumnGrid } from "@/components/pulse/twoColumnGrid";
import { SetVelocityBlocks } from "@/components/pulse/SetVelocityBars";
import type { HistorySession } from "@/lib/metrics/velocityVsBaseline";
import { LoadVelocityProfileCard } from "@/components/pulse/LoadVelocityProfileCard";
import { WorkoutPicker, type PickerPlan } from "@/components/pulse/WorkoutPicker";
import { BlobSelector, type BlobOption } from "@/components/pulse/BlobSelector";
import { WeeklyLoadVolumeBetaCard, type WeeklyLoadVolumePoint } from "@/components/pulse/WeeklyLoadVolumeBetaCard";
import { CompositeScoreBetaCard, type CompositeScoreWeekPoint } from "@/components/pulse/CompositeScoreBetaCard";
import { VelocityBetaCard, type VelocitySetPoint } from "@/components/pulse/VelocityBetaCard";
import { PowerBetaCard, type PowerSetPoint } from "@/components/pulse/PowerBetaCard";
import { RepTimingBetaCard, type RepTimingSetPoint } from "@/components/pulse/RepTimingBetaCard";
import { SetEffortBetaCard, type SetEffortPoint } from "@/components/pulse/SetEffortBetaCard";
import { SessionSummaryBetaCard, type SessionSummaryBetaStats } from "@/components/pulse/SessionSummaryBetaCard";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Derivation helpers ───────────────────────────────────────────────────────

const sessionTime = (s: SessionData) => new Date(s.startedAt ?? s.createdAt).getTime();

const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

interface PlanRow {
  id: string;
  date: string;
  title: string | null;
  exercises: unknown;
  is_completed: boolean | null;
  session_id?: string | null;
}

type PlanStatus = "completed" | "missed" | "queued";

function planStatus(plan: PlanRow, today: Date): PlanStatus {
  if (plan.is_completed) return "completed";
  return new Date(plan.date + "T23:59:59") < today ? "missed" : "queued";
}

// ─── Sessions tab ─────────────────────────────────────────────────────────────

const SESSION_VIEWS: BlobOption[] = [
  { id: "velocity", label: "Velocity" },
  { id: "distance", label: "Distance" },
  { id: "time", label: "Time" },
  { id: "beta", label: "Beta" },
];

/** Fixed stale mock data — never derived from the athlete's real sessions, on purpose (see BetaBadge on each card). */
const BETA_EXERCISE = "Back Squat";
const BETA_SESSION_DATE = "2026-01-12T10:00:00Z";
const BETA_VELOCITY_SETS: VelocitySetPoint[] = Array.from({ length: 4 }, (_, i) => {
  const f = i * 0.05;
  return {
    set: i + 1,
    values: {
      mean: +(0.85 - f).toFixed(2),
      peak: +(1.08 - f * 1.1).toFixed(2),
      eccMean: +(0.52 - f * 0.5).toFixed(2),
      propulsive: +(0.9 - f * 0.9).toFixed(2),
      at100ms: +(0.38 - f * 0.3).toFixed(2),
    },
  };
});
const BETA_POWER_SETS: PowerSetPoint[] = Array.from({ length: 4 }, (_, i) => ({
  set: i + 1,
  meanW: 620 - i * 18,
  peakW: 940 - i * 24,
}));
const BETA_REP_TIMING_SETS: RepTimingSetPoint[] = Array.from({ length: 4 }, (_, i) => ({
  set: i + 1,
  toPeakVelocityS: +(0.22 + i * 0.015).toFixed(2),
  toPeakPowerS: +(0.31 + i * 0.02).toFixed(2),
}));
const BETA_SET_EFFORT_SETS: SetEffortPoint[] = [
  { set: 1, rir: 4, rpe: 6 },
  { set: 2, rir: 3, rpe: 7 },
  { set: 3, rir: 2, rpe: 8 },
  { set: 4, rir: 1, rpe: 9 },
];
const BETA_SESSION_SUMMARY_STATS: SessionSummaryBetaStats = { caloriesKcal: 310 };

function BetaSessionCards() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 16 }}>
      <VelocityBetaCard exercise={BETA_EXERCISE} sessionDate={BETA_SESSION_DATE} sets={BETA_VELOCITY_SETS} />
      <PowerBetaCard exercise={BETA_EXERCISE} sessionDate={BETA_SESSION_DATE} sets={BETA_POWER_SETS} />
      <RepTimingBetaCard exercise={BETA_EXERCISE} sessionDate={BETA_SESSION_DATE} sets={BETA_REP_TIMING_SETS} />
      <SetEffortBetaCard exercise={BETA_EXERCISE} sessionDate={BETA_SESSION_DATE} sets={BETA_SET_EFFORT_SETS} />
      <SessionSummaryBetaCard sessionName="Training session" sessionDate={BETA_SESSION_DATE} stats={BETA_SESSION_SUMMARY_STATS} />
    </div>
  );
}

/** The session a plan produced: the linked session_id, else the same-day session with the plan's name. */
function sessionForPlan(plan: PlanRow, sessions: SessionData[]): SessionData | null {
  const like = sessions.map((s) => ({ id: s.id, date: s.date, name: s.notes, createdAt: s.createdAt, status: s.status }));
  const linked = plan.session_id ? sessions.find((s) => s.id === plan.session_id) : undefined;
  if (linked) return linked;
  const match = findMatchingSessionForPlan({ date: plan.date, title: plan.title }, like);
  return match ? sessions.find((s) => s.id === match.id) ?? null : null;
}

/**
 * Workout picker on top of the session list: only the session that came from the chosen
 * workout is listed. With no plans at all the picker has nothing to choose, so every
 * session shows. The view selector switches the graphs: Velocity (SP-01), Distance (SP-06),
 * Time (SP-07).
 */
/** Elements that count as an interaction for clearing the card glow. */
const INTERACTIVE_SELECTOR =
  "button, a[href], input, select, textarea, summary, [role='button'], [role='tab'], [role='option'], [role='menuitem'], [role='combobox'], [role='switch'], [role='checkbox']";

/** What the page needs from the note form to guard a switch: is there an unfinished note tied to a workout, and a way to drop it. */
interface NoteGuard {
  dirty: () => boolean;
  discard: () => void;
}

type CardGlow ={ exercise: string; sessionId: string | null } | null;

/** `glow` is the exercise card highlighted after a roster link. It lives on the page so it stays cleared when the tab is left and re-entered. */
function SessionsView({ sessions, plans, history, focus, glow, onGlowClear, onPlanChange, guardSwitch }: { sessions: SessionData[]; plans: PlanRow[]; history: Record<string, HistorySession[]>; focus: { sessionId: string | null; exercise: string | null; view: string | null }; glow: CardGlow; onGlowClear: () => void; onPlanChange: (planId: string | null) => void; guardSwitch: (proceed: () => void) => void }) {
  const [view, setView] = useState(() => SESSION_VIEWS.find((o) => o.id === focus.view)?.id ?? "velocity");
  // True only right after the blob was clicked; a workout change clears it, and a tab switch remounts this view.
  const [fadeViews, setFadeViews] = useState(false);
  // Computed once per plans/sessions change instead of re-matching per plan on every read below.
  const planSessionMap = useMemo(
    () => new Map(plans.map((p) => [p.id, sessionForPlan(p, sessions)])),
    [plans, sessions]
  );
  const pickerPlans = useMemo<PickerPlan[]>(
    () => plans.map((p) => ({
      id: p.id,
      date: p.date,
      title: p.title,
      exercises: Array.isArray(p.exercises) ? (p.exercises as PickerPlan["exercises"]) : [],
      is_completed: p.is_completed,
      hasData: planSessionMap.get(p.id) != null,
    })),
    [plans, planSessionMap]
  );

  // Open on the workout behind a roster link (?session=), else the latest past workout that has a session.
  const first = useMemo(() => {
    const todayKey = format(new Date(), "yyyy-MM-dd");
    const byDate = [...plans].sort((a, b) => b.date.localeCompare(a.date));
    if (focus.sessionId) {
      const hit = byDate.find((p) => planSessionMap.get(p.id)?.id === focus.sessionId);
      if (hit) return hit;
    }
    return byDate.find((p) => p.date <= todayKey && planSessionMap.get(p.id)) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [planId, setPlanId] = useState<string | null>(first?.id ?? null);
  const plan = plans.find((p) => p.id === planId) ?? null;
  // Tell the page which workout is selected (null when none, and when this view is left) so the note form knows.
  const activePlanId = plan?.id ?? null;
  useEffect(() => {
    onPlanChange(activePlanId);
    return () => onPlanChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlanId]);
  const matched = plan ? planSessionMap.get(plan.id) ?? null : null;
  const shown = plans.length === 0 ? sessions : matched ? [matched] : [];
  const emptyMessage = plans.length === 0
    ? "No sessions logged yet."
    : plan ? "No session logged for this workout." : "No workout on this date.";

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <WorkoutPicker plans={pickerPlans} initialPlanId={first?.id} beforeChange={guardSwitch} onSelect={(p) => { setPlanId(p?.id ?? null); setFadeViews(false); }} />
        <BlobSelector options={SESSION_VIEWS} value={view} onChange={(v) => { setView(v); setFadeViews(true); onGlowClear(); }} />
      </div>
      {view === "beta" ? (
        <BetaSessionCards />
      ) : (
        <SessionsTab key={plan?.id ?? "none"} sessions={shown} history={history} view={view} animate={fadeViews} glow={glow} onGlowClear={onGlowClear} emptyMessage={emptyMessage} />
      )}
    </>
  );
}

/**
 * One graph per exercise done in each session shown, chosen by `view`: velocity is the
 * set-velocity graph (SP-01 to SP-04), distance is vertical displacement (SP-06), time is rep
 * timing (SP-07). Switching views fades the old graphs out and the new ones in.
 * `history` is every session of the athlete per exercise, for the velocity baseline.
 */
function SessionsTab({ sessions, history, view, animate, glow, onGlowClear, emptyMessage = "No sessions logged yet." }: { sessions: SessionData[]; history: Record<string, HistorySession[]>; view: string; animate: boolean; glow: CardGlow; onGlowClear: () => void; emptyMessage?: string }) {
  const sorted = useMemo(() => [...sessions].sort((a, b) => sessionTime(b) - sessionTime(a)), [sessions]);

  if (sorted.length === 0) {
    return <div className="v-card padded v-meta" style={{ textAlign: "center", padding: "48px 16px" }}>{emptyMessage}</div>;
  }

  return (
    <FadeSwap id={view} animate={animate}>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {sorted.map((s) => {
          const glowExercise = glow && (!glow.sessionId || glow.sessionId === s.id) ? glow.exercise : null;
          return (
          <div key={s.id} id={`session-${s.id}`}>
            {sorted.length > 1 && (
              <div className="v-label" style={{ marginBottom: 10 }}>
                {format(new Date(s.date + "T12:00:00"), "EEE, MMM d")} · {s.notes || "Training session"}
              </div>
            )}
            {view === "distance" ? (
              <RangeOfMotionCards exercises={sessionRom(s)} glowExercise={glowExercise} onGlowClear={onGlowClear} />
            ) : view === "time" ? (
              <RepTimingCards exercises={sessionTiming(s)} glowExercise={glowExercise} onGlowClear={onGlowClear} />
            ) : (
              <SetVelocityBlocks exercises={sessionSets(s)} history={history} sessionDate={sessionMoment(s)} glowExercise={glowExercise} onGlowClear={onGlowClear} />
            )}
          </div>
          );
        })}
      </div>
    </FadeSwap>
  );
}

// ─── Programming tab ─────────────────────────────────────────────────────────

function ProgrammingTab({ plans }: { plans: PlanRow[] }) {
  const today = startOfDay(new Date());
  const now = new Date();

  const adherenceWeeks = useMemo(() => {
    const labels = ["This wk", "Last wk", "2 wks", "3 wks"];
    return labels.map((wk, i) => {
      const inWeek = plans.filter((p) => {
        const d = new Date(p.date + "T12:00:00");
        const diff = differenceInCalendarWeeks(now, d, { weekStartsOn: 1 });
        return diff === i && !isAfter(d, now);
      });
      return { wk, c: inWeek.filter((p) => p.is_completed).length, p: inWeek.length };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans]);

  const last30 = plans.filter((p) => new Date(p.date + "T12:00:00") >= subDays(now, 30) && !isAfter(new Date(p.date + "T12:00:00"), now));
  const adherencePct = last30.length ? Math.round((last30.filter((p) => p.is_completed).length / last30.length) * 100) : null;

  const listed = useMemo(() => {
    const upcoming = plans.filter((p) => planStatus(p, today) === "queued").sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
    const past = plans.filter((p) => planStatus(p, today) !== "queued").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    return [...upcoming, ...past];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div className="v-card padded">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="v-h2">Plan adherence · last 30 days</div>
            <div className="v-meta" style={{ marginTop: 2 }}>Completed / assigned, by week.</div>
          </div>
          {adherencePct != null && (
            <span className="v-chip" data-tone={adherencePct >= 80 ? "good" : adherencePct >= 60 ? "warn" : "bad"}>{adherencePct}% on plan</span>
          )}
        </div>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {adherenceWeeks.every((r) => r.p === 0) ? (
            <div className="v-meta">No plans assigned in the last 4 weeks.</div>
          ) : (
            adherenceWeeks.map((row) => (
              <div key={row.wk} className="row" style={{ gap: 12 }}>
                <div className="mono" style={{ width: 70, fontSize: 12, color: "var(--ink-2)" }}>{row.wk}</div>
                <div className="row" style={{ flex: 1, gap: 4 }}>
                  {row.p === 0 ? (
                    <div className="v-mute2" style={{ fontSize: 11 }}>—</div>
                  ) : (
                    Array.from({ length: row.p }).map((_, i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1, height: 18, borderRadius: 4, maxWidth: 42,
                          background: i < row.c ? "var(--brand)" : "var(--surface-sunk)",
                          border: "1px solid " + (i < row.c ? "transparent" : "var(--line-0)"),
                        }}
                      />
                    ))
                  )}
                </div>
                <div className="mono v-mute2" style={{ fontSize: 11, width: 36, textAlign: "right" }}>{row.c}/{row.p}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="v-card flush">
        <div className="row" style={{ padding: "14px 16px", borderBottom: "1px solid var(--line-0)", justifyContent: "space-between" }}>
          <div className="v-h2">Upcoming &amp; recent plans</div>
          <Link to="/send-programming" className="v-btn ghost" style={{ fontSize: 12 }}>+ Add plan</Link>
        </div>
        <div>
          {listed.length === 0 ? (
            <div className="v-meta" style={{ padding: "24px 16px", textAlign: "center" }}>No plans yet.</div>
          ) : (
            listed.map((p, i) => {
              const status = planStatus(p, today);
              const exCount = Array.isArray(p.exercises) ? p.exercises.length : 0;
              return (
                <div key={p.id} className="row" style={{ padding: "12px 16px", borderBottom: i < listed.length - 1 ? "1px solid var(--line-0)" : "none", gap: 12 }}>
                  <div style={{ width: 90, flexShrink: 0 }}>
                    <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-0)" }}>{format(new Date(p.date + "T12:00:00"), "EEE MMM d")}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ellipsis" style={{ fontSize: 13, color: "var(--ink-0)" }}>{p.title ?? "Workout"}</div>
                    <div className="v-meta mono" style={{ fontSize: 11 }}>{exCount} exercise{exCount !== 1 ? "s" : ""}</div>
                  </div>
                  <span className="v-chip" data-tone={status === "completed" ? "good" : status === "missed" ? "bad" : "neutral"}>
                    {status === "queued" ? "Queued" : status === "missed" ? "Missed" : "Completed"}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Insight rail ─────────────────────────────────────────────────────────────

/**
 * Athlete-vs-self only — the previous "vs group average" panel compared this
 * athlete against their teammates' averages. Removed entirely (not replaced
 * with a self-only trend, per the simplest of the two options this was
 * explicitly scoped to allow): the KPI strip and Performance tab already
 * carry this athlete's own trends, so nothing here duplicated that.
 */
function InsightRail({
  notes, onAddNote, canAttachToWorkout, guardRef,
}: {
  notes: CoachNote[];
  guardRef: React.MutableRefObject<NoteGuard | null>;
  /** True only on the Sessions tab with a workout selected. Otherwise a note can only be general. */
  canAttachToWorkout: boolean;
  /** Resolves true when the note was saved. On false the typed text is kept so it is not lost. */
  onAddNote: (text: string) => Promise<boolean>;
}) {
  const [adding, setAdding] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [attached, setAttached] = useState(false);
  // An unfinished note attached to a workout is lost when the workout or tab changes, so the page asks first.
  guardRef.current = {
    dirty: () => adding && attached && noteText.trim() !== "",
    discard: () => { setAdding(false); setNoteText(""); setAttached(false); },
  };
  // Leaving the Sessions tab or losing the workout drops the choice.
  useEffect(() => {
    if (!canAttachToWorkout) setAttached(false);
  }, [canAttachToWorkout]);

  const saveNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    const saved = await onAddNote(noteText.trim());
    setSaving(false);
    if (!saved) return;
    setNoteText("");
    setAttached(false);
    setAdding(false);
  };

  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Coach notes */}
      <div className="v-card padded">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="v-label">Coach notes</div>
          {!adding && (
            <button className="v-btn ghost" style={{ height: 22, fontSize: 11 }} onClick={() => setAdding(true)}>
              <Plus size={11} strokeWidth={1.5} /> Add
            </button>
          )}
        </div>
        {adding && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <textarea
              className="v-input"
              placeholder="e.g. Returning from calf strain — keep volume conservative."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              maxLength={500}
              autoFocus
              style={{ width: "100%", height: 68, padding: 8, resize: "vertical", lineHeight: 1.5, fontFamily: "var(--font-sans)", fontSize: 12 }}
            />
            <div className="row" style={{ justifyContent: "space-between", gap: 6 }}>
              {/* TODO(incomplete): toggle only. Later a note attached to a workout shows only while that workout is selected; a general note always shows. Not saved or used yet. */}
              {canAttachToWorkout && (
              <button
                type="button"
                className="v-btn"
                aria-pressed={attached}
                onClick={() => setAttached((v) => !v)}
                style={{
                  height: 32, fontSize: 11.5, gap: 5, whiteSpace: "nowrap", flexShrink: 0,
                  background: attached ? "var(--brand)" : "var(--surface-1)",
                  color: attached ? "var(--ink-0)" : "var(--ink-1)",
                  borderColor: attached ? "var(--brand)" : "var(--line-1)",
                }}
              >
                <Paperclip size={12} strokeWidth={1.5} /> Attach to workout
              </button>
              )}
              <div className="row" style={{ gap: 6, marginLeft: "auto" }}>
              <button className="v-btn ghost" style={{ height: 32, fontSize: 11.5 }} onClick={() => { setAdding(false); setNoteText(""); setAttached(false); }} disabled={saving}>Cancel</button>
              <button className="v-btn primary" style={{ height: 32, fontSize: 11.5 }} onClick={saveNote} disabled={saving || !noteText.trim()}>
                {saving ? "Saving…" : "Save"}
              </button>
              </div>
            </div>
          </div>
        )}
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
          {notes.length === 0 && !adding ? (
            <div className="v-mute2" style={{ fontSize: 11.5 }}>No notes yet.</div>
          ) : (
            notes.map((n) => (
              <div key={n.id} style={{ paddingLeft: 10, borderLeft: "2px solid var(--line-1)" }}>
                <div className="mono v-mute2" style={{ fontSize: 10.5 }}>{format(new Date(n.createdAt), "MMM d")}</div>
                <div style={{ fontSize: 12, color: "var(--ink-1)" }}>{n.message}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AthleteDashboard() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [athlete, setAthlete] = useState<PlayerWithStats | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [coachDbId, setCoachDbId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => {
    const t = searchParams.get("tab");
    return t === "sessions" || t === "programming" ? t : "performance";
  });
  const sessionFocus = useMemo(
    () => ({ sessionId: searchParams.get("session"), exercise: searchParams.get("exercise"), view: searchParams.get("view") }),
    [searchParams]
  );
  // Unfinished-note guard: a switch that would lose a note attached to the workout waits for the coach's answer.
  const noteGuard = useRef<NoteGuard | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<(() => void) | null>(null);
  const guardSwitch = useCallback((proceed: () => void) => {
    if (noteGuard.current?.dirty()) setPendingSwitch(() => proceed);
    else proceed();
  }, []);
  // Workout selected on the Sessions tab, null anywhere else. Decides whether a note can be attached to a workout.
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  // Exercise card highlighted after a roster link. Cleared by a click on it, a tab change or a blob change.
  const [glow, setGlow] = useState<CardGlow>(() => (sessionFocus.exercise ? { exercise: sessionFocus.exercise, sessionId: sessionFocus.sessionId } : null));
  // Any real interaction (a click on a button, link, field, tab, selector or menu item) also clears it; a click on empty page does not.
  useEffect(() => {
    if (!glow) return;
    const onClick = (ev: MouseEvent) => {
      const el = ev.target instanceof Element ? ev.target : null;
      if (el?.closest(INTERACTIVE_SELECTOR)) setGlow(null);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [glow]);

  const loadData =useCallback(async () => {
    if (!user?.id || !id) return;
    setLoading(true);
    try {
      const [found, teamIds] = await Promise.all([
        getPlayerById(id),
        getCoachTeamIds(user.id),
      ]);
      const inCoachRoster = found && found.team_id && teamIds.includes(found.team_id) ? found : null;
      setAthlete(inCoachRoster);
      if (!inCoachRoster) return;

      const [sessionData, planData, noteData] = await Promise.all([
        getPlayerSessions(inCoachRoster.id, inCoachRoster.user_id),
        getPlayerWorkoutPlans(inCoachRoster.id),
        getPlayerCoachNotes(inCoachRoster.id),
      ]);
      setSessions(sessionData);
      setPlans((planData ?? []) as unknown as PlanRow[]);
      setNotes(noteData);
      setCoachDbId(profile?.coach_id ?? null);
    } catch (error) {
      console.error("Error loading athlete:", error);
      toast.error("Failed to load athlete data");
    } finally {
      setLoading(false);
    }
  }, [user?.id, id, profile?.coach_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Derivations ────────────────────────────────────────────────────────────
  const sorted = useMemo(() => [...sessions].sort((a, b) => sessionTime(a) - sessionTime(b)), [sessions]);
  const lastSessionDate = useMemo(
    () => sorted.length ? sorted[sorted.length - 1].startedAt ?? sorted[sorted.length - 1].createdAt : null,
    [sorted]
  );
  const now = useMemo(() => new Date(), []);

  const weekIdx = useCallback(
    (d: Date, weeks: number) => weeks - 1 - differenceInCalendarWeeks(now, d, { weekStartsOn: 1 }),
    [now]
  );

  // Primary Lift Trend KPI — same selection rule the (now-fixed) Avg Velocity
  // anomaly indicator uses, so both surfaces name the same lift: most reps
  // logged in the last 30 days, ties broken by most recently trained.
  const primaryExercise = useMemo(() => findPrimaryExercise(sorted), [sorted]);

  const weekly8 = useMemo<WeeklyLoadPoint[]>(() => {
    const WEEKS = 8;
    const counts = Array.from({ length: WEEKS }, () => 0);
    for (const s of sorted) {
      const w = weekIdx(new Date(s.startedAt ?? s.createdAt), WEEKS);
      if (w >= 0 && w < WEEKS) counts[w]++;
    }
    return counts.map((v, i) => ({ label: i === WEEKS - 1 ? "now" : `W-${WEEKS - 1 - i}`, v }));
  }, [sorted, weekIdx]);

  const sessionsThisWeek = weekly8.length ? weekly8[weekly8.length - 1].v : 0;

// All-mock, matching WeeklyLoadVolumeBetaCard's own stories — see BetaBadge.
  const loadVolumeWeeks = useMemo<WeeklyLoadVolumePoint[]>(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const label = format(subDays(now, (7 - i) * 7), "MMM d");
      return {
        label,
        tonnageLbs: 3200 + i * 220,
        totalWorkKj: 4.2 + i * 0.3,
        distanceM: Math.round((0.18 + i * 0.02) * 1609.34),
      };
    });
  }, [now]);

  // All-mock, matching CompositeScoreBetaCard's own stories — see BetaBadge.
  const compositeScoreWeeks = useMemo<CompositeScoreWeekPoint[]>(() => {
    return Array.from({ length: 6 }, (_, i) => ({
      label: `Wk ${i + 1}`,
      strength: 62 + i * 3,
      speed: 70 - i * 1.5,
      total: 66 + i * 1,
    }));
  }, []);

  const allHistory = useMemo(() => historyByExercise(sessions), [sessions]);

  const compositeExerciseOptions = useMemo(() => Object.keys(allHistory).sort(), [allHistory]);
  const [compositeExercisePick, setCompositeExercisePick] = useState<string | null>(null);
  const compositeExercise =
    compositeExercisePick && compositeExerciseOptions.includes(compositeExercisePick)
      ? compositeExercisePick
      : primaryExercise?.name && compositeExerciseOptions.includes(primaryExercise.name)
        ? primaryExercise.name
        : compositeExerciseOptions[0] ?? "—";

  const handleAddNote = useCallback(
    async (text: string) => {
      if (!athlete) return false;
      try {
        const note = await addCoachNote(athlete.id, coachDbId, text);
        setNotes((prev) => [note, ...prev]);
        toast.success("Note saved");
        return true;
      } catch (error) {
        toast.error(`Failed to save note: ${error instanceof Error ? error.message : "unknown error"}`);
        return false;
      }
    },
    [athlete, coachDbId]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (!loading && !athlete) {
    return (
      <div className="v-app">
        <TopNav />
        <main style={{ padding: "48px 28px", maxWidth: 720, margin: "0 auto", width: "100%", textAlign: "center" }}>
          <div className="v-h2">Athlete not found</div>
          <p className="v-meta" style={{ marginTop: 8 }}>This athlete doesn't exist or isn't in your roster.</p>
          <Link to="/" className="v-btn" style={{ marginTop: 16, display: "inline-flex", height: 36, fontSize: 13, padding: "0 16px" }}>← Back to dashboard</Link>
        </main>
      </div>
    );
  }

  const lastDays = athlete ? lastDaysFor(athlete, { lastSessionDate }) : Infinity;

  return (
    <div className="v-app">
      <TopNav />
      <LoadingOverlay isLoading={loading} fullScreen message="Loading athlete..." />

      {athlete && (
        <main style={{ maxWidth: 1480, margin: "0 auto", width: "100%", padding: "0 28px 32px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, flexWrap: "wrap", padding: "20px 0" }}>
            <div className="row" style={{ gap: 14, minWidth: 0, flex: "1 1 480px" }}>
              <Avatar name={athlete.name} size="xl" />
              <div style={{ minWidth: 0 }}>
                <div className="v-meta mono" style={{ fontSize: 11 }}>
                  <Link to="/" style={{ color: "var(--ink-2)" }}>← Athletes</Link>
                  <span style={{ margin: "0 6px", color: "var(--ink-4)" }}>/</span>
                  <span style={{ color: "var(--ink-2)" }}>{athlete.group || "No group"}</span>
                </div>
                <h1 className="v-h1" style={{ fontSize: 26, marginTop: 4 }}>{athlete.name}</h1>
                <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {athlete.jersey_number != null && <span className="v-chip" data-tone="neutral">#{athlete.jersey_number}</span>}
                  <span className="v-chip" data-tone={lastDays <= 3 ? "good" : lastDays >= 7 ? "bad" : "warn"}>
                    <span className="dot" />
                    {lastDays <= 3 ? "Active" : !Number.isFinite(lastDays) ? "No sessions" : lastDays >= 7 ? `Inactive ${lastDays}d` : `Quiet ${lastDays}d`}
                  </span>
                </div>
              </div>
            </div>
            <div className="row" style={{ gap: 6, flexShrink: 0, marginTop: 4 }}>
              <Link to="/messages" className="v-btn ghost"><Bell size={12} strokeWidth={1.5} />Message</Link>
              <Link to="/send-programming" className="v-btn brand"><Send size={12} strokeWidth={1.5} />Send programming</Link>
            </div>
          </div>

          <div style={{ height: 20 }} />

          {/* Two rows: tabs on top of the left column, then content and the notes rail side by side,
              so the rail's top edge lines up with the first card. */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", columnGap: 24 }}>
            <div style={{ gridColumn: 1, gridRow: 1 }}>
              <UnderlineTabs
                tabs={[
                  { id: "performance", label: "Performance" },
                  { id: "sessions", label: "Sessions", count: sessions.length },
                  { id: "programming", label: "Programming" },
                ]}
                active={tab}
                onChange={(t) => {
                  const go = () => { setTab(t); setGlow(null); };
                  if (t !== tab && tab === "sessions") guardSwitch(go);
                  else go();
                }}
              />
            </div>

            <div style={{ gridColumn: 1, gridRow: 2, minWidth: 0 }}>
              <div style={{ paddingTop: 20 }}>
                {tab === "performance" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
                    <div style={twoColumnGrid()}>
                      <CompositeScoreBetaCard
                        exercise={compositeExercise}
                        exercises={compositeExerciseOptions}
                        onExerciseChange={setCompositeExercisePick}
                        weeks={compositeScoreWeeks}
                      />
                      <WeeklyLoadVolumeBetaCard athleteName={athlete?.name ?? "Athlete"} weeks={loadVolumeWeeks} coveragePct={22} />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <LoadVelocityProfileCard sessions={allHistory} />
                      <div className="v-card padded" style={{ display: "flex", flexDirection: "column", minWidth: 0, height: "100%", boxSizing: "border-box" }}>
                        <div style={{ marginBottom: 10 }}>
                          <div className="v-h2">Weekly sessions</div>
                          <div className="v-meta" style={{ marginTop: 2 }}>Sessions per week vs {SESSIONS_TARGET}/wk target.</div>
                        </div>
                        <div style={{ flex: 1, minHeight: 0 }}>
                          <WeeklyLoadChart data={weekly8} target={SESSIONS_TARGET} fill />
                        </div>
                        <div className="row" style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--line-0)" }}>
                          {(() => {
                            const avg = (weekly8.reduce((s, d) => s + d.v, 0) / (weekly8.length || 1)).toFixed(1);
                            const onTarget = weekly8.filter((d) => d.v >= SESSIONS_TARGET).length;
                            return [
                              { v: avg, l: "8-wk avg / wk" },
                              { v: `${sessionsThisWeek}/${SESSIONS_TARGET}`, l: "this week" },
                              { v: `${onTarget}/8`, l: "weeks on target" },
                            ].map((stat, i) => (
                              <div key={stat.l} style={{ flex: 1, borderLeft: i ? "1px solid var(--line-0)" : "none", paddingLeft: i ? 14 : 0 }}>
                                <div className="num" style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>{stat.v}</div>
                                <div className="v-meta" style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 1 }}>{stat.l}</div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>

                    <div style={twoColumnGrid()}>
                      {/* SP-05: all-time records, so no "latest session": every exercise gets its whole history. */}
                      <PersonalRecordsCard
                        exercises={Object.keys(allHistory).map((exercise) => ({ exercise, sets: [] }))}
                        history={allHistory}
                      />
                    </div>
                  </div>
                )}

                {/* key: the data arrives after the page mounts; restart the picker on its first workout when it does */}
                {tab === "sessions" && (
                  <SessionsView key={`${plans.length}-${sessions.length}`} sessions={sessions} plans={plans} history={allHistory} focus={sessionFocus} glow={glow} onGlowClear={() => setGlow(null)} onPlanChange={setActivePlanId} guardSwitch={guardSwitch} />
                )}
                {tab === "programming" && <ProgrammingTab plans={plans} />}
              </div>
            </div>

            <div style={{ gridColumn: 2, gridRow: 2, paddingTop: 20 }}>
              <InsightRail
                notes={notes}
                onAddNote={handleAddNote}
                canAttachToWorkout={tab === "sessions" && activePlanId != null}
                guardRef={noteGuard}
              />
              <AlertDialog open={pendingSwitch != null} onOpenChange={(o) => { if (!o) setPendingSwitch(null); }}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Unfinished note</AlertDialogTitle>
                    <AlertDialogDescription>
                      This note is attached to the current workout. Switching away will discard it.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Continue note</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        const go = pendingSwitch;
                        setPendingSwitch(null);
                        noteGuard.current?.discard();
                        go?.();
                      }}
                    >
                      Discard note
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
