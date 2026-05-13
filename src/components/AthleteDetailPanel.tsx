import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Athlete } from "@/data/mockData";
import {
  ChevronRight, CheckCircle2, AlertCircle, Clock, Dumbbell, Activity,
  TrendingUp, TrendingDown, Minus
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getPlayerWorkoutPlans } from "@/services/workoutPlansService";
import { getPlayerSessions, SessionData } from "@/services/sessionsService";
import { SessionDetailPanel } from "./SessionDetailPanel";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { findMatchingSessionForPlan, getAttendanceSummary, WorkoutSessionLike } from "@/lib/workoutAttendance";
import {
  format, isPast, isToday, parseISO, isSameDay,
  subWeeks, startOfWeek, addDays
} from "date-fns";

interface AthleteDetailPanelProps {
  athlete: Athlete | null;
  open: boolean;
  onClose: () => void;
}

// ── Velocity trend SVG (8-week) ────────────────────────────────────────────
function VelocityTrendChart({ sessions }: { sessions: SessionData[] }) {
  const now = new Date();
  const W = 620, H = 70;
  const PL = 2, PR = 2, PT = 6, PB = 6;
  const cW = W - PL - PR;
  const cH = H - PT - PB;

  const weeklyData = useMemo(() => (
    Array.from({ length: 8 }, (_, i) => {
      const wStart = startOfWeek(subWeeks(now, 7 - i), { weekStartsOn: 1 });
      const wEnd = addDays(wStart, 6);
      const vels = sessions
        .filter(s => { const d = parseISO(s.date); return d >= wStart && d <= wEnd; })
        .flatMap(s => s.exercises.map(e => e.avgVelocity).filter(v => v > 0));
      return vels.length > 0 ? vels.reduce((a, b) => a + b, 0) / vels.length : null;
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [sessions]);

  const valid = weeklyData.filter((v): v is number => v !== null);

  if (valid.length < 2) {
    return (
      <div className="w-full h-[70px] flex items-center justify-center">
        <span className="text-xs text-muted-foreground">Not enough data to display trend</span>
      </div>
    );
  }

  const minV = Math.min(...valid) - 0.05;
  const maxV = Math.max(...valid) + 0.05;
  const vRange = maxV - minV || 0.1;
  const medV = valid.reduce((a, b) => a + b, 0) / valid.length;

  const toX = (i: number) => PL + (i / 7) * cW;
  const toY = (v: number) => PT + cH - ((v - minV) / vRange) * cH;

  const bandY1 = toY(medV + 0.08);
  const bandY2 = toY(medV - 0.08);
  const bandTop = Math.min(bandY1, bandY2);
  const bandH = Math.abs(bandY2 - bandY1);

  // Collect polyline segments (skip nulls)
  const segments: string[][] = [];
  let cur: string[] = [];
  weeklyData.forEach((v, i) => {
    if (v !== null) {
      cur.push(`${toX(i)},${toY(v)}`);
    } else {
      if (cur.length) { segments.push(cur); cur = []; }
    }
  });
  if (cur.length) segments.push(cur);

  const lastIdx = weeklyData.reduce((l, v, i) => (v !== null ? i : l), -1);
  const lastX = lastIdx >= 0 ? toX(lastIdx) : null;
  const lastY = lastIdx >= 0 ? toY(weeklyData[lastIdx] as number) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* target zone band */}
      <rect x={PL} y={bandTop} width={cW} height={bandH}
        fill="hsl(var(--primary))" fillOpacity={0.15} />
      {/* dashed bounds */}
      <line x1={PL} y1={bandTop} x2={PL + cW} y2={bandTop}
        stroke="hsl(var(--primary))" strokeWidth={0.8} strokeDasharray="4,3" opacity={0.5} />
      <line x1={PL} y1={bandTop + bandH} x2={PL + cW} y2={bandTop + bandH}
        stroke="hsl(var(--primary))" strokeWidth={0.8} strokeDasharray="4,3" opacity={0.5} />
      {/* trend lines */}
      {segments.map((pts, idx) => (
        <polyline key={idx} points={pts.join(' ')} fill="none"
          stroke="hsl(var(--primary))" strokeWidth={2.5}
          strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {/* endpoint dot */}
      {lastX !== null && lastY !== null && (
        <>
          <circle cx={lastX} cy={lastY} r={5} fill="hsl(var(--primary))" />
          <circle cx={lastX} cy={lastY} r={9} fill="hsl(var(--primary))" fillOpacity={0.2} />
        </>
      )}
      {/* x-axis */}
      <line x1={PL} y1={PT + cH} x2={PL + cW} y2={PT + cH}
        stroke="hsl(var(--border))" strokeWidth={0.5} />
    </svg>
  );
}

// ── Session load heatmap (4 weeks × 7 days) ────────────────────────────────
function SessionHeatmap({ sessions }: { sessions: SessionData[] }) {
  const now = new Date();
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const weeks = Array.from({ length: 4 }, (_, wi) => {
    const wStart = startOfWeek(subWeeks(now, 3 - wi), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, di) => {
      const day = addDays(wStart, di);
      const count = sessions.filter(s => isSameDay(parseISO(s.date), day)).length;
      return { date: day, count, isFuture: day > now };
    });
  });

  const cellCls = (count: number, isFuture: boolean) => {
    if (isFuture) return 'bg-muted/20';
    if (count === 0) return 'bg-muted/50';
    if (count === 1) return 'bg-primary/35';
    if (count === 2) return 'bg-primary/65';
    return 'bg-primary';
  };

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {dayLabels.map((d, i) => (
          <div key={i} className="text-center text-[9px] font-semibold text-muted-foreground">{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
          {week.map(({ date, count, isFuture }, di) => (
            <div
              key={di}
              className={cn("aspect-square rounded-[3px]", cellCls(count, isFuture))}
              title={`${format(date, 'MMM d')}: ${count} session${count !== 1 ? 's' : ''}`}
            />
          ))}
        </div>
      ))}
      <div className="flex items-center gap-1.5 mt-2 justify-end">
        <span className="text-[9px] text-muted-foreground">Less</span>
        {[0, 1, 2, 3].map(v => (
          <div key={v} className={cn("w-2.5 h-2.5 rounded-[3px]", cellCls(v, false))} />
        ))}
        <span className="text-[9px] text-muted-foreground">More</span>
      </div>
    </div>
  );
}

// ── KPI card ───────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  delta?: number | null;
  deltaLabel?: string;
}

function KpiCard({ label, value, unit, delta, deltaLabel }: KpiCardProps) {
  const DeltaIcon = delta === null || delta === undefined ? Minus
    : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const deltaColor = delta === null || delta === undefined ? 'text-muted-foreground'
    : delta > 0 ? 'text-green-500' : delta < 0 ? 'text-destructive' : 'text-muted-foreground';

  return (
    <div className="rounded-xl border bg-card px-4 py-3 space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground leading-none">
        {value}
        {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
      </p>
      {(delta !== undefined) && (
        <div className={cn("flex items-center gap-0.5 text-[10px]", deltaColor)}>
          <DeltaIcon className="h-3 w-3" />
          <span>{deltaLabel ?? (delta !== null ? `${delta > 0 ? '+' : ''}${delta}` : '—')}</span>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export const AthleteDetailPanel = ({ athlete, open, onClose }: AthleteDetailPanelProps) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'readiness'>('overview');
  const [showHistory, setShowHistory] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);

  useEffect(() => {
    if (athlete && open) {
      setActiveTab('overview');
      setShowHistory(false);
      loadData();
    }
  }, [athlete?.id, open]);

  const loadData = async () => {
    if (!athlete) return;
    try {
      setLoading(true);
      const [plansData, sessionsData] = await Promise.all([
        getPlayerWorkoutPlans(athlete.id),
        getPlayerSessions(athlete.id, (athlete as any).user_id),
      ]);
      setPlans(plansData);
      setSessions(sessionsData);

      const attendanceSummary = getAttendanceSummary(
        plansData.map((p: any) => ({ date: p.date, title: p.title, is_completed: p.is_completed })),
        sessionsData.map((s: SessionData) => ({ id: s.id, date: s.date, name: s.notes, createdAt: s.createdAt }))
      );

      const planItems = plansData.map((p: any) => ({ ...p, _timelineType: 'plan', _timelineDate: p.date }));
      const sessionItems = sessionsData
        .filter(s => !attendanceSummary.matchedSessionIds.has(s.id))
        .map((s: any) => ({ ...s, _timelineType: 'session', _timelineDate: s.date }));
      setTimeline(
        [...planItems, ...sessionItems].sort(
          (a, b) => parseISO(b._timelineDate).getTime() - parseISO(a._timelineDate).getTime()
        )
      );
    } catch {
      toast.error('Failed to load athlete history');
    } finally {
      setLoading(false);
    }
  };

  // ── KPI computations ────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const now = new Date();

    // Avg rep velocity (all-time)
    const allVels = sessions.flatMap(s => s.exercises.map(e => e.avgVelocity).filter(v => v > 0));
    const avgRepVelocity = allVels.length > 0
      ? parseFloat((allVels.reduce((a, b) => a + b, 0) / allVels.length).toFixed(2))
      : null;

    // Velocity delta: last 4 weeks vs prior 4 weeks
    const fourWksAgo = subWeeks(now, 4);
    const eightWksAgo = subWeeks(now, 8);
    const recentVels = sessions.filter(s => parseISO(s.date) >= fourWksAgo)
      .flatMap(s => s.exercises.map(e => e.avgVelocity).filter(v => v > 0));
    const priorVels = sessions.filter(s => { const d = parseISO(s.date); return d >= eightWksAgo && d < fourWksAgo; })
      .flatMap(s => s.exercises.map(e => e.avgVelocity).filter(v => v > 0));
    const recentAvg = recentVels.length > 0 ? recentVels.reduce((a, b) => a + b) / recentVels.length : null;
    const priorAvg = priorVels.length > 0 ? priorVels.reduce((a, b) => a + b) / priorVels.length : null;
    const velocityDelta = recentAvg !== null && priorAvg !== null
      ? parseFloat((recentAvg - priorAvg).toFixed(2)) : null;

    // Sessions this week vs last week
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    const thisWeekCount = sessions.filter(s => parseISO(s.date) >= thisWeekStart).length;
    const lastWeekCount = sessions.filter(s => {
      const d = parseISO(s.date);
      return d >= lastWeekStart && d < thisWeekStart;
    }).length;
    const sessionsDelta = thisWeekCount - lastWeekCount;

    // Velocity drop-off from most recent session
    let velocityDropOff: number | null = null;
    if (sessions.length > 0) {
      const recent = sessions[0];
      const repVels = recent.exercises.flatMap(e => e.repData.map(r => r.velocity)).filter(v => v > 0);
      if (repVels.length >= 2) {
        const first = repVels[0], last = repVels[repVels.length - 1];
        velocityDropOff = first > 0 ? parseFloat((((first - last) / first) * 100).toFixed(1)) : null;
      }
    }

    // Load vs target
    const totalPlans = plans.length;
    const completedPlans = plans.filter((p: any) => p.is_completed).length;
    const loadVsTarget = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : null;

    // Last session date
    const lastSession = sessions[0];
    const lastSessionDate = lastSession ? format(parseISO(lastSession.date), 'MMM d') : null;

    return {
      avgRepVelocity, velocityDelta,
      sessionsCompleted: sessions.length, sessionsDelta, thisWeekCount,
      velocityDropOff, loadVsTarget, lastSessionDate,
    };
  }, [sessions, plans]);

  // ── Attendance helpers ──────────────────────────────────────────────────
  if (!athlete) return null;

  const attendanceSessions: WorkoutSessionLike[] = sessions.map(s => ({
    id: s.id, date: s.date, name: s.notes, createdAt: s.createdAt,
  }));
  const attendanceSummary = getAttendanceSummary(
    plans.map((p: any) => ({ date: p.date, title: p.title, is_completed: p.is_completed })),
    attendanceSessions
  );

  const normalize = (v?: string) => (v || '').trim().toLowerCase();

  const applyPlanTargets = (session: SessionData, plan: any): SessionData => ({
    ...session,
    exercises: session.exercises.map(ex => {
      const match = (Array.isArray(plan?.exercises) ? plan.exercises : [])
        .find((pe: any) => normalize(pe?.name) === normalize(ex.name));
      return match
        ? { ...ex, targetVelocityMin: Number(match.targetVelocityMin) || 0, targetVelocityMax: Number(match.targetVelocityMax) || 0 }
        : ex;
    }),
  });

  const getPlanStatus = (plan: any) => {
    const matched = findMatchingSessionForPlan({ date: plan.date, title: plan.title }, attendanceSessions);
    if (plan.is_completed || matched) return 'completed';
    const planDate = parseISO(plan.date);
    if (isPast(planDate) && !isToday(planDate)) return 'missed';
    return 'pending';
  };

  const getMatchingSession = (plan: any) => {
    const matched = findMatchingSessionForPlan({ date: plan.date, title: plan.title }, attendanceSessions);
    return matched ? sessions.find(s => s.id === matched.id) || null : null;
  };

  const handleTimelineItemClick = (item: any) => {
    if (item._timelineType === 'plan') {
      const status = getPlanStatus(item);
      if (status === 'completed') {
        const match = getMatchingSession(item);
        match ? setSelectedSession(applyPlanTargets(match, item)) : setSelectedPlan(item);
      } else {
        setSelectedPlan(item);
      }
    } else {
      setSelectedSession(item);
    }
  };

  const isActive = sessions.some(s => {
    try { return parseISO(s.date) >= subWeeks(new Date(), 4); } catch { return false; }
  });
  const subtitle = `${(athlete as any).sport || (athlete as any).level || 'Strength Training'} · Last session ${kpi.lastSessionDate ?? '—'}`;
  const tabs: Array<{ id: 'overview' | 'trends' | 'readiness'; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'trends', label: 'Trends' },
    { id: 'readiness', label: 'Readiness' },
  ];

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col bg-background p-0">
          <LoadingOverlay isLoading={loading} fullScreen message="Loading history..." />

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">

              {/* ── Header bar ── */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-[18px] font-medium text-foreground leading-tight truncate">
                    {athlete.name}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium border-0",
                      isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
                    onClick={() => setShowHistory(v => !v)}
                  >
                    Full history
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* ── Pill tab nav ── */}
              <div className="flex gap-1 bg-muted/50 p-1 rounded-lg w-fit">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                      activeTab === tab.id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ── Overview tab ── */}
              {activeTab === 'overview' && (
                <div className="space-y-5">
                  {/* Section label */}
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    This week at a glance
                  </p>

                  {/* KPI strip */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <KpiCard
                      label="Avg rep velocity"
                      value={kpi.avgRepVelocity !== null ? String(kpi.avgRepVelocity) : '—'}
                      unit={kpi.avgRepVelocity !== null ? 'm/s' : undefined}
                      delta={kpi.velocityDelta}
                      deltaLabel={kpi.velocityDelta !== null
                        ? `${kpi.velocityDelta > 0 ? '+' : ''}${kpi.velocityDelta} vs prev 4 wks`
                        : 'No comparison data'}
                    />
                    <KpiCard
                      label="Sessions completed"
                      value={String(kpi.thisWeekCount)}
                      unit="this wk"
                      delta={kpi.sessionsDelta}
                      deltaLabel={`${kpi.sessionsDelta >= 0 ? '+' : ''}${kpi.sessionsDelta} vs last wk`}
                    />
                    <KpiCard
                      label="Velocity drop-off"
                      value={kpi.velocityDropOff !== null ? `${kpi.velocityDropOff}%` : '—'}
                      delta={kpi.velocityDropOff !== null ? -kpi.velocityDropOff : null}
                      deltaLabel={kpi.velocityDropOff !== null ? 'last session' : 'No session data'}
                    />
                    <KpiCard
                      label="Load vs target"
                      value={kpi.loadVsTarget !== null ? `${kpi.loadVsTarget}%` : '—'}
                      delta={kpi.loadVsTarget !== null ? kpi.loadVsTarget - 100 : null}
                      deltaLabel={kpi.loadVsTarget !== null
                        ? `${plans.filter((p: any) => p.is_completed).length}/${plans.length} plans`
                        : 'No plans assigned'}
                    />
                  </div>

                  {/* Two-column cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Velocity trend */}
                    <Card>
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-sm font-semibold">8-Week Velocity Trend</CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4">
                        <VelocityTrendChart sessions={sessions} />
                        <div className="flex justify-between mt-2 px-0.5">
                          {Array.from({ length: 8 }, (_, i) => (
                            <span key={i} className="text-[9px] text-muted-foreground">
                              W{i + 1}
                            </span>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Session load heatmap */}
                    <Card>
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-sm font-semibold">Session Load (4 weeks)</CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4">
                        <SessionHeatmap sessions={sessions} />
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* ── Trends tab (placeholder) ── */}
              {activeTab === 'trends' && (
                <div className="flex items-center justify-center h-40 text-sm text-muted-foreground border-2 border-dashed rounded-xl">
                  Trends coming soon
                </div>
              )}

              {/* ── Readiness tab (placeholder) ── */}
              {activeTab === 'readiness' && (
                <div className="flex items-center justify-center h-40 text-sm text-muted-foreground border-2 border-dashed rounded-xl">
                  Readiness coming soon
                </div>
              )}

              {/* ── Full history (toggled) ── */}
              {showHistory && (
                <div className="space-y-3 pt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Workout timeline
                  </p>

                  {loading ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>
                  ) : timeline.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                      <p className="text-muted-foreground text-sm">No workouts found.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {timeline.map(item => {
                        const isPlan = item._timelineType === 'plan';
                        const isSession = item._timelineType === 'session';
                        const dateObj = parseISO(item._timelineDate);
                        const status = isPlan ? getPlanStatus(item) : null;
                        return (
                          <div
                            key={item._timelineType + '-' + item.id}
                            className="group flex items-center justify-between p-3.5 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => handleTimelineItemClick(item)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                {isPlan && status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                {isPlan && status === 'missed' && <AlertCircle className="h-4 w-4 text-destructive" />}
                                {isPlan && status === 'pending' && <Clock className="h-4 w-4 text-blue-500" />}
                                {isSession && <Activity className="h-4 w-4 text-primary" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-sm">
                                    {isPlan ? item.title : (item.notes || 'Self-Logged Session')}
                                  </h4>
                                  <Badge variant={isPlan ? 'secondary' : 'default'} className="text-[10px] px-1 h-4">
                                    {isPlan ? 'Plan' : 'Self-Logged'}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">{format(dateObj, 'EEE, MMM d')}</p>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Plan detail dialog (Pending / Missed) */}
      <Dialog open={!!selectedPlan} onOpenChange={() => setSelectedPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPlan?.title}</DialogTitle>
            <DialogDescription>
              {selectedPlan && format(parseISO(selectedPlan.date), 'PPPP')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Badge variant={selectedPlan?.is_completed ? 'default' : 'secondary'}>
              {selectedPlan?.is_completed ? 'Completed' : 'Not Completed'}
            </Badge>
            {selectedPlan?.description && (
              <div className="bg-muted/30 p-3 rounded-md text-sm">
                <span className="font-semibold block mb-1">Notes:</span>
                {selectedPlan.description}
              </div>
            )}
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2 text-sm">
                <Dumbbell className="h-4 w-4" /> Assigned Exercises
              </h4>
              <ScrollArea className="h-[280px] border rounded-md p-4">
                <div className="space-y-3">
                  {selectedPlan?.exercises?.map((ex: any, i: number) => (
                    <div key={i} className="flex justify-between items-center border-b pb-2 last:border-0">
                      <span className="font-medium text-sm">{ex.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {ex.sets} × {ex.reps} @ {ex.weight}{ex.weightUnit}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rich session view (Completed) */}
      <SessionDetailPanel
        session={selectedSession}
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        isSelfLoggedSession={selectedSession ? !attendanceSummary.matchedSessionIds.has(selectedSession.id) : false}
      />
    </>
  );
};
