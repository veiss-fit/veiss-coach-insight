import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { format, differenceInCalendarWeeks, isAfter, subDays, startOfDay } from "date-fns";
import { Bell, Send, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { Avatar } from "@/components/pulse/Avatar";
import { KpiTile } from "@/components/pulse/KpiTile";
import { Delta } from "@/components/pulse/Delta";
import { Sparkline } from "@/components/pulse/Sparkline";
import { UnderlineTabs } from "@/components/pulse/Tabs";
import {
  VelocityTrendChart, ForceVelocityChart, RepTraceChart, WeeklyLoadChart, ExerciseRangeChart,
  VelTrendPoint, FVPoint, WeeklyLoadPoint, ExerciseRangeRow,
} from "@/components/pulse/charts";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { getPlayersWithStatsByCoach, PlayerWithStats } from "@/services/playersService";
import { getPlayerSessions, SessionData, ExerciseData } from "@/services/sessionsService";
import { getPlayerWorkoutPlans } from "@/services/workoutPlansService";
import { getRosterMetrics, RosterMetricsResult } from "@/services/rosterMetricsService";
import { getPlayerCoachNotes, addCoachNote, CoachNote } from "@/services/coachFeedbackService";
import {
  computeAnomalyIndicators, computeSparkline, DeviationIndicator, RAGStatus,
  sessionAvgVelocity, sessionVelocityDropoff, sessionRomConsistency,
  sessionEccentricConcentricRatio, sessionTUT,
} from "@/lib/athleteSummaryUtils";
import { flagsFor, lastDaysFor } from "@/lib/rosterFlags";
import { SESSIONS_TARGET } from "@/lib/vbtZones";

// ─── Derivation helpers ───────────────────────────────────────────────────────

const sessionTime = (s: SessionData) => new Date(s.startedAt ?? s.createdAt).getTime();

const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function sessionAvgROM(s: SessionData): number | null {
  const roms = s.exercises.map((e) => e.avgROM).filter((v) => v > 0);
  return mean(roms);
}

interface PlanRow {
  id: string;
  date: string;
  title: string | null;
  exercises: unknown;
  is_completed: boolean | null;
}

type PlanStatus = "completed" | "missed" | "queued";

function planStatus(plan: PlanRow, today: Date): PlanStatus {
  if (plan.is_completed) return "completed";
  return new Date(plan.date + "T23:59:59") < today ? "missed" : "queued";
}

const RAG_COLOR: Record<RAGStatus, string> = {
  green: "var(--good)",
  amber: "var(--warn)",
  red: "var(--bad)",
  insufficient: "var(--ink-3)",
};

const METRIC_FN: Record<string, (s: SessionData) => number | null> = {
  velocity: sessionAvgVelocity,
  romConsistency: sessionRomConsistency,
  eccentricConcentric: sessionEccentricConcentricRatio,
  tut: sessionTUT,
};

// ─── Sessions tab ─────────────────────────────────────────────────────────────

function SessionExerciseTrace({ exercise }: { exercise: ExerciseData }) {
  const reps = [...exercise.repData]
    .filter((r) => r.velocity > 0)
    .sort((a, b) => a.setNumber - b.setNumber || a.repNumber - b.repNumber)
    .map((r) => ({ set: r.setNumber, rep: r.repNumber, vel: r.velocity }));

  const vels = reps.map((r) => r.vel);
  const sets = new Set(reps.map((r) => r.set)).size;
  const target = exercise.targetVelocityMin > 0 ? exercise.targetVelocityMin : null;

  if (reps.length === 0) return <div className="v-meta" style={{ padding: "12px 0" }}>No rep data recorded for this exercise.</div>;

  return (
    <>
      <RepTraceChart reps={reps} target={target} />
      <div className="row" style={{ marginTop: 10, gap: 24, fontSize: 11.5, color: "var(--ink-2)", flexWrap: "wrap" }}>
        <span className="mono">{reps.length} reps · {sets} set{sets !== 1 ? "s" : ""}</span>
        <span className="mono">peak {Math.max(...vels).toFixed(2)} m/s</span>
        <span className="mono">low {Math.min(...vels).toFixed(2)} m/s</span>
        {exercise.weight > 0 && <span className="mono">{exercise.weight} {exercise.weightUnit}</span>}
      </div>
    </>
  );
}

function SessionsTab({ sessions }: { sessions: SessionData[] }) {
  const [openId, setOpenId] = useState<string | null>(sessions[0]?.id ?? null);
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const sorted = useMemo(() => [...sessions].sort((a, b) => sessionTime(b) - sessionTime(a)), [sessions]);

  if (sorted.length === 0) {
    return <div className="v-card padded v-meta" style={{ textAlign: "center", padding: "48px 16px" }}>No sessions logged yet.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="v-label">Recent sessions · {sorted.length}</div>
      </div>
      <div className="v-card flush">
        {sorted.map((s, i) => {
          const isOpen = openId === s.id;
          const avgVel = sessionAvgVelocity(s);
          const drop = sessionVelocityDropoff(s);
          const totalReps = s.exercises.reduce((n, e) => n + e.repData.length, 0);
          const date = new Date(s.date + "T12:00:00");
          const exercise = isOpen ? s.exercises[Math.min(exerciseIdx, s.exercises.length - 1)] : null;
          return (
            <div key={s.id} style={{ borderBottom: i < sorted.length - 1 ? "1px solid var(--line-0)" : "none" }}>
              <button
                onClick={() => { setOpenId(isOpen ? null : s.id); setExerciseIdx(0); }}
                style={{
                  width: "100%", display: "grid", alignItems: "center", gap: 12,
                  gridTemplateColumns: "90px 1fr 110px 100px 28px",
                  border: "none", background: isOpen ? "var(--surface-2)" : "transparent",
                  padding: "14px 18px", textAlign: "left", cursor: "pointer", font: "inherit",
                }}
              >
                <div>
                  <div className="mono" style={{ fontSize: 12, color: "var(--ink-0)" }}>{format(date, "MMM d")}</div>
                  <div className="mono v-mute2" style={{ fontSize: 10.5 }}>{format(date, "EEE")}</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-0)" }}>{s.notes || "Training session"}</div>
                  <div className="v-meta mono" style={{ fontSize: 11 }}>{s.exercises.length} exercise{s.exercises.length !== 1 ? "s" : ""} · {totalReps} reps</div>
                </div>
                <div>
                  <div className="v-label" style={{ fontSize: 9.5 }}>Avg velocity</div>
                  <div className="mono" style={{ fontSize: 13, color: "var(--ink-0)" }}>{avgVel != null ? `${avgVel.toFixed(2)} m/s` : "—"}</div>
                </div>
                <div>
                  <div className="v-label" style={{ fontSize: 9.5 }}>Drop-off</div>
                  <div className="mono" style={{ fontSize: 13, color: drop != null && drop >= 15 ? "var(--warn)" : "var(--ink-0)" }}>
                    {drop != null ? `${Math.round(drop)}%` : "—"}
                  </div>
                </div>
                <div style={{ color: "var(--ink-3)", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .12s" }}>
                  <ChevronRight size={12} strokeWidth={1.5} />
                </div>
              </button>

              {isOpen && exercise && (
                <div style={{ padding: "12px 18px 20px", background: "var(--surface-2)", borderTop: "1px solid var(--line-0)" }}>
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                    <div className="v-label">Rep-by-rep velocity · {exercise.name}</div>
                    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                      {s.exercises.map((e, idx) => (
                        <button
                          key={e.id}
                          className="v-btn"
                          onClick={() => setExerciseIdx(idx)}
                          style={{
                            height: 24, fontSize: 11,
                            background: idx === exerciseIdx ? "var(--ink-0)" : "transparent",
                            color: idx === exerciseIdx ? "#fff" : "var(--ink-1)",
                            borderColor: idx === exerciseIdx ? "var(--ink-0)" : "transparent",
                          }}
                        >
                          {e.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <SessionExerciseTrace exercise={exercise} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Readiness tab ────────────────────────────────────────────────────────────

function ReadinessTab({ athlete, sessions, indicators }: { athlete: PlayerWithStats; sessions: SessionData[]; indicators: DeviationIndicator[] }) {
  // getPlayerSessions orders newest-first, so picking "the last drop-off value"
  // without re-sorting grabbed the OLDEST session's number, not the most recent
  // one — this is almost certainly what produced a visibly-wrong readiness score
  // during the walkthrough (D44). Sort chronologically first, same convention
  // athleteSummaryUtils.ts uses everywhere else, so "last" really means latest.
  const chronological = [...sessions].sort(
    (a, b) => new Date(a.startedAt ?? a.createdAt).getTime() - new Date(b.startedAt ?? b.createdAt).getTime()
  );
  const drops = chronological
    .map((s) => sessionVelocityDropoff(s))
    .filter((v): v is number => v != null);
  const drop = drops.length ? Math.round(drops[drops.length - 1]) : 0;
  const lastDays = lastDaysFor(athlete);
  const lastDaysCapped = Number.isFinite(lastDays) ? Math.min(lastDays, 30) : 30;
  const score = Math.max(20, Math.min(100, 100 - drop * 1.4 - lastDaysCapped * 2));
  const tone = score >= 80 ? "good" : score >= 60 ? "warn" : "bad";

  const velInd = indicators.find((ind) => ind.metric === "velocity");
  const velDeltaPct = velInd?.deltaPercent ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16 }}>
        {/* Readiness score */}
        <div className="v-card padded">
          <div className="v-h2">Readiness score</div>
          <div className="v-meta" style={{ marginTop: 2 }}>Heuristic: velocity drop-off, recency, and attendance.</div>
          <div className="row" style={{ marginTop: 18, gap: 16, alignItems: "center" }}>
            <div style={{ width: 110, height: 110, position: "relative", flexShrink: 0 }}>
              <svg viewBox="0 0 110 110" width="110" height="110">
                <circle cx="55" cy="55" r="46" stroke="var(--surface-sunk)" strokeWidth="10" fill="none" />
                <circle
                  cx="55" cy="55" r="46"
                  stroke={`var(--${tone})`} strokeWidth="10" fill="none"
                  strokeDasharray={`${(score / 100) * 289} 289`}
                  strokeLinecap="round"
                  transform="rotate(-90 55 55)"
                />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span className="num" style={{ fontSize: 30, fontWeight: 600 }}>{Math.round(score)}</span>
                <span className="v-mute2" style={{ fontSize: 10 }}>of 100</span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              {[
                { l: "Velocity drop-off", v: `${drop}%`, t: drop >= 15 ? "warn" : "good" },
                { l: "Recency", v: Number.isFinite(lastDays) ? `${lastDays} days ago` : "no sessions", t: lastDays >= 7 ? "bad" : lastDays >= 4 ? "warn" : "good" },
                { l: "Attendance", v: `${athlete.attendance}%`, t: athlete.attendance >= 85 ? "good" : athlete.attendance >= 70 ? "warn" : "bad" },
                { l: "Velocity vs base", v: velDeltaPct != null ? `${velDeltaPct > 0 ? "+" : ""}${velDeltaPct.toFixed(1)}%` : "—", t: velDeltaPct == null ? "neutral" : velDeltaPct >= 0 ? "good" : "warn" },
              ].map((row) => (
                <div key={row.l} className="row" style={{ justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--line-0)" }}>
                  <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{row.l}</span>
                  <span className="v-chip" data-tone={row.t}>{row.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Deviation indicators (z-score baseline model) */}
        <div className="v-card padded">
          <div className="v-h2">Deviation from baseline</div>
          <div className="v-meta" style={{ marginTop: 2 }}>
            Last 4 sessions vs historical baseline · green ≤1σ, amber ≤2σ, red &gt;2σ.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
            {indicators.map((ind) => {
              const spark = computeSparkline(sessions, METRIC_FN[ind.metric] ?? sessionAvgVelocity);
              return (
                <div key={ind.metric} style={{ border: "1px solid var(--line-0)", borderRadius: 8, padding: "10px 12px" }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="v-label" style={{ fontSize: 9.5 }}>{ind.label}</span>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: RAG_COLOR[ind.ragStatus], flexShrink: 0 }} title={ind.ragStatus} />
                  </div>
                  <div className="row" style={{ alignItems: "baseline", gap: 6, marginTop: 4 }}>
                    <span className="num" style={{ fontSize: 17, fontWeight: 600 }}>
                      {ind.value != null ? ind.formatFn(ind.value) : "—"}
                    </span>
                    {ind.deltaPercent != null && (
                      <span className="mono" style={{ fontSize: 10.5, color: ind.deltaPercent >= 0 ? "var(--good)" : "var(--bad)" }}>
                        {ind.deltaPercent > 0 ? "+" : ""}{ind.deltaPercent.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  {ind.ragStatus === "insufficient" ? (
                    <div className="v-mute2" style={{ fontSize: 10.5, marginTop: 6 }}>Needs ≥7 sessions</div>
                  ) : (
                    !spark.insufficient && (
                      <Sparkline data={spark.points.map((p) => p.value)} stroke={RAG_COLOR[ind.ragStatus]} fill="transparent" height={20} />
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
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

interface GroupComparison {
  attendance: number | null;
  avgVelocity: number | null;
  sessionsPerWeek: number | null;
}

function InsightRail({
  athlete, recentVel, sessionsThisWeek, group, notes, onAddNote,
}: {
  athlete: PlayerWithStats;
  recentVel: number | null;
  sessionsThisWeek: number;
  group: GroupComparison;
  notes: CoachNote[];
  onAddNote: (text: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  const saveNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    await onAddNote(noteText.trim());
    setSaving(false);
    setNoteText("");
    setAdding(false);
  };

  const compareRows = [
    { l: "Attendance", a: athlete.attendance, t: group.attendance, unit: "%" },
    { l: "Avg velocity", a: recentVel ?? athlete.avgVelocity, t: group.avgVelocity, unit: "m/s" },
    { l: "Sessions / wk", a: sessionsThisWeek, t: group.sessionsPerWeek, unit: "" },
  ];

  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* vs group average */}
      <div className="v-card padded">
        <div className="v-label">vs group average</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
          {compareRows.map((row) => {
            if (row.t == null || row.t === 0) {
              return (
                <div key={row.l} className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "var(--ink-2)" }}>{row.l}</span>
                  <span className="v-mute2 mono">no group data</span>
                </div>
              );
            }
            const delta = row.a - row.t;
            const positive = delta > 0;
            const fmt = (v: number) => (row.unit === "m/s" ? v.toFixed(2) : Math.round(v * 10) / 10);
            return (
              <div key={row.l}>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "var(--ink-2)" }}>{row.l}</span>
                  <span className="mono" style={{ color: "var(--ink-0)" }}>{fmt(row.a)}{row.unit}</span>
                </div>
                <div style={{ position: "relative", height: 6, background: "var(--surface-sunk)", borderRadius: 999, marginTop: 4 }}>
                  <div style={{ position: "absolute", left: "50%", top: -2, bottom: -2, width: 1, background: "var(--ink-3)" }} />
                  <div
                    style={{
                      position: "absolute", top: 0, bottom: 0,
                      left: positive ? "50%" : "auto",
                      right: positive ? "auto" : "50%",
                      width: Math.min(50, Math.abs(delta / row.t) * 50) + "%",
                      background: positive ? "var(--good)" : "var(--warn)",
                      borderRadius: 999,
                    }}
                  />
                </div>
                <div className="row" style={{ justifyContent: "space-between", marginTop: 2 }}>
                  <span className="v-mute2 mono" style={{ fontSize: 10 }}>group {fmt(row.t)}{row.unit}</span>
                  <Delta value={delta} suffix={row.unit ? " " + row.unit : ""} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
            <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
              <button className="v-btn ghost" style={{ height: 26, fontSize: 11.5 }} onClick={() => { setAdding(false); setNoteText(""); }} disabled={saving}>Cancel</button>
              <button className="v-btn primary" style={{ height: 26, fontSize: 11.5 }} onClick={saveNote} disabled={saving || !noteText.trim()}>
                {saving ? "Saving…" : "Save note"}
              </button>
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
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [athlete, setAthlete] = useState<PlayerWithStats | null>(null);
  const [groupPeers, setGroupPeers] = useState<PlayerWithStats[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [groupMetrics, setGroupMetrics] = useState<RosterMetricsResult | null>(null);
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [coachDbId, setCoachDbId] = useState<string | null>(null);
  const [tab, setTab] = useState("readiness");

  const loadData = useCallback(async () => {
    if (!user?.id || !id) return;
    setLoading(true);
    try {
      const roster = await getPlayersWithStatsByCoach(user.id);
      const found = roster.find((p) => p.id === id) ?? null;
      setAthlete(found);
      if (!found) return;

      const peers = roster.filter((p) => p.team_id && p.team_id === found.team_id);
      setGroupPeers(peers);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const coachQuery = (supabase as any)
        .from("coaches").select("id").eq("user_id", user.id).maybeSingle() as Promise<{ data: { id: string } | null }>;

      const [sessionData, planData, metrics, noteData, coachRow] = await Promise.all([
        getPlayerSessions(found.id, found.user_id),
        getPlayerWorkoutPlans(found.id),
        getRosterMetrics((peers.length ? peers : [found]).map((p) => ({ id: p.id, user_id: p.user_id }))),
        getPlayerCoachNotes(found.id),
        coachQuery,
      ]);
      setSessions(sessionData);
      setPlans((planData ?? []) as unknown as PlanRow[]);
      setGroupMetrics(metrics);
      setNotes(noteData);
      setCoachDbId(coachRow?.data?.id ?? null);
    } catch (error) {
      console.error("Error loading athlete:", error);
      toast.error("Failed to load athlete data");
    } finally {
      setLoading(false);
    }
  }, [user?.id, id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Derivations ────────────────────────────────────────────────────────────
  const sorted = useMemo(() => [...sessions].sort((a, b) => sessionTime(a) - sessionTime(b)), [sessions]);
  const now = useMemo(() => new Date(), []);

  const indicators = useMemo(() => computeAnomalyIndicators(sessions), [sessions]);

  const sessionVels = useMemo(
    () => sorted.map((s) => sessionAvgVelocity(s)).filter((v): v is number => v != null),
    [sorted]
  );
  const recentVel = useMemo(() => {
    const m = mean(sessionVels.slice(-3));
    return m != null ? +m.toFixed(2) : null;
  }, [sessionVels]);
  const velDelta = useMemo(() => {
    if (sessionVels.length < 5) return null;
    const prior = mean(sessionVels.slice(0, -3));
    return recentVel != null && prior != null ? +(recentVel - prior).toFixed(2) : null;
  }, [sessionVels, recentVel]);

  const dropSeries = useMemo(
    () => sorted.map((s) => sessionVelocityDropoff(s)).filter((v): v is number => v != null),
    [sorted]
  );
  const latestDrop = dropSeries.length ? Math.round(dropSeries[dropSeries.length - 1]) : null;

  const romSeries = useMemo(
    () => sorted.map((s) => sessionAvgROM(s)).filter((v): v is number => v != null),
    [sorted]
  );

  const weekIdx = useCallback(
    (d: Date, weeks: number) => weeks - 1 - differenceInCalendarWeeks(now, d, { weekStartsOn: 1 }),
    [now]
  );

  const velTrend12 = useMemo<VelTrendPoint[]>(() => {
    const WEEKS = 12;
    const buckets: Array<{ vals: number[]; n: number }> = Array.from({ length: WEEKS }, () => ({ vals: [], n: 0 }));
    for (const s of sorted) {
      const w = weekIdx(new Date(s.startedAt ?? s.createdAt), WEEKS);
      if (w < 0 || w >= WEEKS) continue;
      const v = sessionAvgVelocity(s);
      buckets[w].n++;
      if (v != null) buckets[w].vals.push(v);
    }
    const points: VelTrendPoint[] = [];
    let prev: number | null = null;
    buckets.forEach((b, i) => {
      const v = mean(b.vals) ?? prev;
      if (v == null) return; // skip leading empty weeks
      prev = v;
      points.push({ label: i === WEEKS - 1 ? "now" : `W-${WEEKS - 1 - i}`, v: +v.toFixed(2), n: b.n });
    });
    return points;
  }, [sorted, weekIdx]);

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

  const { fvPoints, fvUnit } = useMemo(() => {
    const points: FVPoint[] = [];
    let unit = "lbs";
    const cutoff = subDays(now, 56);
    const recentCutoff = subDays(now, 14);
    for (const s of sorted) {
      const when = new Date(s.startedAt ?? s.createdAt);
      if (when < cutoff) continue;
      for (const ex of s.exercises) {
        if (!(ex.weight > 0)) continue;
        unit = ex.weightUnit || unit;
        const bySet = new Map<number, number[]>();
        for (const r of ex.repData) {
          if (r.velocity > 0) {
            const list = bySet.get(r.setNumber);
            if (list) list.push(r.velocity);
            else bySet.set(r.setNumber, [r.velocity]);
          }
        }
        for (const vels of bySet.values()) {
          const v = mean(vels);
          if (v != null) points.push({ exercise: ex.name, load: ex.weight, vel: +v.toFixed(2), recent: when >= recentCutoff });
        }
      }
    }
    return { fvPoints: points.slice(-120), fvUnit: unit };
  }, [sorted, now]);

  const exRange = useMemo<ExerciseRangeRow[]>(() => {
    const cutoff = subDays(now, 28);
    const windowed = sorted.filter((s) => new Date(s.startedAt ?? s.createdAt) >= cutoff);
    const source = windowed.length ? windowed : sorted;
    const byName = new Map<string, number[]>();
    for (const s of source) {
      for (const ex of s.exercises) {
        if (!(ex.avgVelocity > 0)) continue;
        const list = byName.get(ex.name);
        if (list) list.push(ex.avgVelocity);
        else byName.set(ex.name, [ex.avgVelocity]);
      }
    }
    return [...byName.entries()]
      .map(([name, vals]) => ({
        name,
        min: Math.min(...vals),
        max: Math.max(...vals),
        avg: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2),
        sessions: vals.length,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 8);
  }, [sorted, now]);

  const groupComparison = useMemo<GroupComparison>(() => {
    const peers = groupPeers.length ? groupPeers : [];
    if (!peers.length) return { attendance: null, avgVelocity: null, sessionsPerWeek: null };
    const att = mean(peers.map((p) => p.attendance));
    const vel = mean(peers.map((p) => p.avgVelocity).filter((v) => v > 0));
    const perPlayer = groupMetrics?.perPlayer;
    const sess = perPlayer ? mean(peers.map((p) => perPlayer.get(p.id)?.sessionsThisWeek ?? 0)) : null;
    return { attendance: att, avgVelocity: vel, sessionsPerWeek: sess };
  }, [groupPeers, groupMetrics]);

  const handleAddNote = useCallback(
    async (text: string) => {
      if (!athlete) return;
      const note = await addCoachNote(athlete.id, coachDbId, text);
      if (note) {
        setNotes((prev) => [note, ...prev]);
        toast.success("Note saved");
      } else {
        toast.error("Failed to save note");
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

  const flags = athlete ? flagsFor(athlete, groupMetrics?.perPlayer.get(athlete.id)) : [];
  const extraFlags = flags.filter((f) => f.kind !== "inactive" && f.tone !== "neutral").slice(0, 2);
  const lastDays = athlete ? lastDaysFor(athlete, groupMetrics?.perPlayer.get(athlete.id)) : Infinity;

  return (
    <div className="v-app">
      <TopNav />
      <LoadingOverlay isLoading={loading} fullScreen message="Loading athlete..." />

      {athlete && (
        <main style={{ maxWidth: 1480, margin: "0 auto", width: "100%", padding: "0 28px 32px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, flexWrap: "wrap", padding: "20px 0", borderBottom: "1px solid var(--line-0)" }}>
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
                  {extraFlags.map((f, i) => (
                    <span key={i} className="v-chip" data-tone={f.tone}>{f.label}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="row" style={{ gap: 6, flexShrink: 0, marginTop: 4 }}>
              <Link to="/messages" className="v-btn ghost"><Bell size={12} strokeWidth={1.5} />Message</Link>
              <Link to="/send-programming" className="v-btn brand"><Send size={12} strokeWidth={1.5} />Send programming</Link>
            </div>
          </div>

          {/* KPI strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, padding: "20px 0" }}>
            <KpiTile
              label="Avg velocity"
              value={recentVel != null ? recentVel.toFixed(2) : athlete.avgVelocity > 0 ? athlete.avgVelocity.toFixed(2) : "—"}
              unit="m/s"
              delta={velDelta}
              footnote="last 3 sessions vs prior"
              sparkData={sessionVels.length > 1 ? sessionVels.slice(-8) : undefined}
              sparkTarget={0.75}
              accent="var(--brand)"
            />
            <KpiTile
              label="Attendance"
              value={`${athlete.attendance}%`}
              footnote={Number.isFinite(lastDays) ? `last session ${lastDays}d ago` : "no sessions yet"}
            />
            <KpiTile
              label="Velocity drop-off"
              value={latestDrop != null ? `${latestDrop}%` : "—"}
              delta={dropSeries.length >= 2 ? +(dropSeries[dropSeries.length - 1] - dropSeries[dropSeries.length - 2]).toFixed(1) : null}
              deltaInvert
              footnote="within-session, latest"
              sparkData={dropSeries.length > 1 ? dropSeries.slice(-8) : undefined}
              accent="var(--brand)"
            />
            <KpiTile
              label="Sessions this week"
              value={sessionsThisWeek}
              unit={`/ ${SESSIONS_TARGET}`}
              footnote={`target ${SESSIONS_TARGET}/wk`}
              sparkData={weekly8.map((wp) => wp.v)}
              accent="var(--brand)"
            />
            <KpiTile
              label="Avg ROM"
              value={athlete.avgROM > 0 ? athlete.avgROM : "—"}
              unit="mm"
              footnote={athlete.avgTempo > 0 ? `${athlete.avgTempo.toFixed(2)}s avg tempo` : undefined}
              sparkData={romSeries.length > 1 ? romSeries.slice(-8).map((v) => Math.round(v)) : undefined}
              accent="var(--brand)"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
            <div style={{ minWidth: 0 }}>
              <UnderlineTabs
                tabs={[
                  { id: "readiness", label: "Readiness" },
                  { id: "performance", label: "Performance" },
                  { id: "sessions", label: "Sessions", count: sessions.length },
                  { id: "programming", label: "Programming", count: plans.length },
                ]}
                active={tab}
                onChange={setTab}
              />

              <div style={{ paddingTop: 20 }}>
                {tab === "performance" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
                    <div className="v-card padded" style={{ minWidth: 0 }}>
                      <div style={{ marginBottom: 12 }}>
                        <div className="v-h2">12-week velocity trend</div>
                        <div className="v-meta" style={{ marginTop: 2 }}>Weekly average across all logged sets. Band shows the prescribed working range.</div>
                      </div>
                      <VelocityTrendChart data={velTrend12} target={[0.55, 0.85]} />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
                      <div className="v-card padded" style={{ minWidth: 0 }}>
                        <div style={{ marginBottom: 12 }}>
                          <div className="v-h2">Load–velocity profile</div>
                          <div className="v-meta" style={{ marginTop: 2 }}>Each dot is one set, last 8 weeks. Recent sets darker.</div>
                        </div>
                        <ForceVelocityChart data={fvPoints} unitLabel={fvUnit} />
                      </div>
                      <div className="v-card padded" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <div style={{ marginBottom: 10 }}>
                          <div className="v-h2">Weekly volume</div>
                          <div className="v-meta" style={{ marginTop: 2 }}>Sessions per week vs {SESSIONS_TARGET}/wk target.</div>
                        </div>
                        <WeeklyLoadChart data={weekly8} target={SESSIONS_TARGET} height={172} />
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

                    <div className="v-card padded" style={{ minWidth: 0 }}>
                      <div style={{ marginBottom: 14 }}>
                        <div className="v-h2">Per-exercise velocity range</div>
                        <div className="v-meta" style={{ marginTop: 2 }}>Min/max range with average · last 4 weeks (falls back to all time).</div>
                      </div>
                      <ExerciseRangeChart data={exRange} />
                    </div>
                  </div>
                )}

                {tab === "sessions" && <SessionsTab sessions={sessions} />}
                {tab === "readiness" && <ReadinessTab athlete={athlete} sessions={sessions} indicators={indicators} />}
                {tab === "programming" && <ProgrammingTab plans={plans} />}
              </div>
            </div>

            <InsightRail
              athlete={athlete}
              recentVel={recentVel}
              sessionsThisWeek={sessionsThisWeek}
              group={groupComparison}
              notes={notes}
              onAddNote={handleAddNote}
            />
          </div>
        </main>
      )}
    </div>
  );
}
