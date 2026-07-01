import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PlayerWithStats } from "@/services/playersService";
import {
  ChevronLeft, TrendingUp, TrendingDown, Minus, Dumbbell,
  CheckCircle2, AlertCircle, Clock, Activity, Maximize2,
  ChevronRight as ArrowRight, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getPlayerWorkoutPlans } from "@/services/workoutPlansService";
import { getPlayerSessions, getSessionById, SessionData, ExerciseData, RepData } from "@/services/sessionsService";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { findMatchingSessionForPlan, getAttendanceSummary, WorkoutSessionLike } from "@/lib/workoutAttendance";
import { format, isPast, isToday, parseISO, subWeeks, subDays } from "date-fns";
import { Database } from "@/types/database";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useNavigate } from "react-router-dom";
import {
  Tooltip as UITooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  computeAnomalyIndicators,
  computeSparkline,
  computeRecentSessions,
  computeTrendLabel,
  HIGHER_IS_BETTER,
  sessionAvgVelocity,
  sessionWithinSetDropoff,
  sessionVelocityDropoff,
  sessionAvgTempo,
  sessionVolume,
  DeviationIndicator,
  SparklineData,
  IndicatorTooltip,
} from "@/lib/athleteSummaryUtils";

interface AthleteDetailPanelProps {
  athlete: PlayerWithStats | null;
  open: boolean;
  onClose: () => void;
}

type ModalView = "summary" | "session-detail" | "metric-detail";
type TimeWindow = "1W" | "4W" | "8W";
type RagFlag = "ok" | "warn" | "alert" | "neutral";
type ReadinessStatus = "ready" | "monitor" | "flag";

interface ReadinessData {
  status: ReadinessStatus;
  reason: string;
  signals: { label: string; value: string; flag: RagFlag }[];
}

// ── PRESERVED (unmounted — reuse in Exercise Detail View next sprint) ────────

function ReadinessBanner({ readiness }: { readiness: ReadinessData }) {
  const cfg = {
    ready:   { bg: "bg-green-50", border: "border-green-200", titleCls: "text-green-800", subCls: "text-green-700", badge: "bg-green-600 text-white", label: "Ready to Train" },
    monitor: { bg: "bg-amber-50", border: "border-amber-200", titleCls: "text-amber-900", subCls: "text-amber-700",  badge: "bg-amber-500 text-white",  label: "Monitor"        },
    flag:    { bg: "bg-red-50",   border: "border-red-200",   titleCls: "text-red-900",   subCls: "text-red-700",   badge: "bg-red-600 text-white",    label: "Flag"           },
  }[readiness.status];

  const dotCls: Record<RagFlag, string> = {
    ok:      "bg-green-500",
    warn:    "bg-amber-500",
    alert:   "bg-red-500",
    neutral: "bg-muted-foreground/30",
  };

  return (
    <div className={cn("rounded-lg border px-4 py-3 flex items-start gap-4 flex-wrap", cfg.bg, cfg.border)}>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0", cfg.badge)}>
          {cfg.label}
        </span>
        <p className={cn("text-sm", cfg.titleCls)}>{readiness.reason}</p>
      </div>
      <div className="flex items-center gap-4 ml-auto shrink-0 flex-wrap">
        {readiness.signals.map((sig, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className={cn("w-2 h-2 rounded-full shrink-0", dotCls[sig.flag])} />
            <span className={cn("text-xs", cfg.subCls)}>
              {sig.label}:{" "}
              <span className="font-semibold">{sig.value}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  delta?: number | null;
  deltaLabel?: string;
  ragStatus?: RagFlag;
}

function ModalStatCard({ label, value, unit, delta, deltaLabel, ragStatus = "neutral" }: StatCardProps) {
  const DeltaIcon = delta == null ? Minus : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const deltaColor =
    delta == null ? "text-muted-foreground"
    : delta > 0   ? "text-green-600"
    : delta < 0   ? "text-red-500"
    : "text-muted-foreground";

  const dotCls: Record<RagFlag, string> = {
    ok:      "bg-green-500",
    warn:    "bg-amber-500",
    alert:   "bg-red-500",
    neutral: "bg-muted-foreground/25",
  };

  return (
    <div className="rounded-xl border bg-white px-4 py-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
        <div className={cn("w-2 h-2 rounded-full", dotCls[ragStatus])} />
      </div>
      <p className="text-2xl font-bold text-foreground leading-none">
        {value}
        {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
      </p>
      {delta !== undefined && (
        <div className={cn("flex items-center gap-0.5 text-[10px]", deltaColor)}>
          <DeltaIcon className="h-3 w-3 shrink-0" />
          <span>{deltaLabel ?? (delta !== null ? `${delta > 0 ? "+" : ""}${delta}` : "—")}</span>
        </div>
      )}
    </div>
  );
}

function TimeWindowToggle({ active, onChange }: { active: TimeWindow; onChange: (w: TimeWindow) => void }) {
  const options: TimeWindow[] = ["1W", "4W", "8W"];
  return (
    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg w-fit">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            "px-3 py-1 rounded-md text-xs font-semibold transition-colors",
            active === opt ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt}
        </button>
      ))}
      <button
        disabled
        title="Custom date range — coming soon"
        className="px-3 py-1 rounded-md text-xs font-semibold text-muted-foreground opacity-40 cursor-not-allowed"
      >
        Custom
      </button>
    </div>
  );
}

// ── Summary page components ──────────────────────────────────────────────────

function InfoTooltip({ tooltip }: { tooltip: IndicatorTooltip }) {
  const [open, setOpen] = useState(false);
  return (
    <UITooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[9px] font-bold bg-muted text-muted-foreground hover:bg-muted/70 transition-colors shrink-0 ml-1"
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        >
          i
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] p-3 space-y-2 text-left">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">What</p>
          <p className="text-xs leading-snug">{tooltip.what}</p>
        </div>
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">How</p>
          <p className="text-xs leading-snug">{tooltip.how}</p>
        </div>
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Highlights</p>
          <p className="text-xs leading-snug">{tooltip.highlights}</p>
        </div>
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Min data</p>
          <p className="text-xs leading-snug">{tooltip.minimum}</p>
        </div>
      </TooltipContent>
    </UITooltip>
  );
}

const ARTIFACT_NAMES = new Set(["Workout", "Exercise", "Movement", "Training", "Session"]);

function isValidExName(n: string | null | undefined): n is string {
  if (!n) return false;
  if ((n.match(/[a-zA-Z]/g) ?? []).length < 2) return false;
  return !ARTIFACT_NAMES.has(n);
}

function LastSessionCard({ session }: { session: SessionData }) {
  const avgVel = sessionAvgVelocity(session);
  const fatigueDropoff = sessionVelocityDropoff(session);
  const exerciseNames = session.exercises.map((e) => e.name).filter(isValidExName);
  const totalSets = session.exercises.filter((e) => isValidExName(e.name)).reduce((s, e) => s + e.sets, 0);
  const totalReps = session.exercises.filter((e) => isValidExName(e.name)).reduce((s, e) => s + e.repData.length, 0);
  const crossExercise = exerciseNames.length > 1;

  return (
    <div className="rounded-xl px-5 py-4" style={{ backgroundColor: '#eef1f6', border: '1px solid rgba(7,16,31,0.06)', borderLeft: '4px solid #f5b400' }}>
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: '#205783' }}>Last Session</p>
        <p className="text-xs text-muted-foreground">{format(parseISO(session.date), "MMM d, yyyy")}</p>
      </div>
      <p className="text-sm font-medium text-foreground leading-snug mb-3">
        {exerciseNames.length > 0 ? exerciseNames.join(" · ") : "No exercises recorded"}
      </p>
      <div className="flex items-center gap-5 flex-wrap">
        <span className="text-xs text-muted-foreground">{totalSets}s · {totalReps}r</span>
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold" style={{ color: '#c48a00' }}>
            {avgVel !== null ? `${avgVel.toFixed(2)} m/s` : "—"}
          </span>
          {crossExercise && avgVel !== null && (
            <span
              className="text-[10px] text-amber-600"
              title="Cross-exercise average — reliable only if exercise selection is consistent across sessions"
            >⚠</span>
          )}
          <span className="text-xs text-muted-foreground">avg vel</span>
        </div>
        {fatigueDropoff !== null && (
          <div className="flex items-center gap-1">
            <span className={cn(
              "text-sm font-semibold",
              fatigueDropoff < 10 ? "text-green-600" : fatigueDropoff < 20 ? "text-amber-600" : "text-red-500",
            )}>
              ↓{fatigueDropoff.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">session fatigue</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DeviationSparklines({
  indicators,
  sparklines,
  onCardClick,
}: {
  indicators: DeviationIndicator[];
  sparklines: Record<string, SparklineData>;
  onCardClick: (ind: DeviationIndicator, sparkline: SparklineData) => void;
}) {
  return (
    <div>
      <p className="text-sm font-semibold mb-3" style={{ color: '#071c32' }}>Deviation Trends (last 8 sessions)</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {indicators.map((ind) => {
          const sparkline = sparklines[ind.metric];
          const trendLabel = sparkline && !sparkline.insufficient
            ? computeTrendLabel(sparkline.points, HIGHER_IS_BETTER[ind.metric] ?? true)
            : null;
          return (
            <div
              key={ind.metric}
              className="rounded-xl p-3 cursor-pointer transition-all hover:shadow-md"
              style={{ backgroundColor: '#f8f9fb', border: '1px solid rgba(7,16,31,0.06)' }}
              onClick={() => onCardClick(ind, sparkline)}
            >
              {/* Header row */}
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center min-w-0 gap-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.06em] truncate" style={{ color: '#205783' }}>
                    {ind.label}
                  </p>
                  {ind.tooltip && <InfoTooltip tooltip={ind.tooltip} />}
                </div>
                {ind.ragStatus !== 'insufficient' && (
                  <div className={cn(
                    'w-2 h-2 rounded-full shrink-0 mt-0.5 ml-1.5',
                    ind.ragStatus === 'red' ? 'bg-red-500'
                    : ind.ragStatus === 'amber' ? 'bg-amber-500'
                    : 'bg-green-500',
                  )} />
                )}
              </div>
              {/* Current value */}
              <p className="text-lg font-bold mb-0.5" style={{ color: '#071c32' }}>
                {ind.latestValue !== null ? ind.formatFn(ind.latestValue) : '—'}
              </p>
              {/* Delta */}
              {ind.deltaPercent !== null && (
                <p className="text-[10px] font-semibold mb-2" style={{
                  color: ind.ragStatus === 'red' ? '#c2410c'
                    : ind.ragStatus === 'amber' ? '#d97706'
                    : '#1f8a5b',
                }}>
                  {ind.deltaPercent > 0 ? '+' : ''}{ind.deltaPercent.toFixed(1)}% vs baseline
                </p>
              )}
              {/* Sparkline */}
              {sparkline && !sparkline.insufficient ? (
                <ResponsiveContainer width="100%" height={48}>
                  <LineChart data={sparkline.points} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={['auto', 'auto']} />
                    {sparkline.mean !== null && (
                      <ReferenceLine
                        y={sparkline.mean}
                        stroke="hsl(var(--muted-foreground))"
                        strokeDasharray="4 2"
                        strokeWidth={1}
                        opacity={0.55}
                      />
                    )}
                    <Tooltip
                      contentStyle={{ fontSize: 10, borderRadius: 4, border: '1px solid rgba(7,16,31,0.06)', padding: '2px 6px' }}
                      formatter={(v: number) => [ind.formatFn(v), ind.label]}
                      labelFormatter={(l: string) => l}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-12 flex items-center justify-center">
                  <p className="text-[10px] text-muted-foreground italic">Not enough data</p>
                </div>
              )}
              {/* Trend label */}
              {trendLabel && trendLabel.direction !== 'stable' && (
                <p className="text-[10px] font-medium mt-1" style={{
                  color: trendLabel.direction === 'improving' ? '#1f8a5b' : '#c2410c',
                }}>
                  {trendLabel.label}
                </p>
              )}
              {/* Click hint */}
              {sparkline && !sparkline.insufficient && (
                <p className="text-[9px] mt-1" style={{ color: '#8d95a4' }}>Tap to expand →</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Inline session detail ────────────────────────────────────────────────────

function groupRepsBySet(repData: RepData[]): Map<number, RepData[]> {
  const m = new Map<number, RepData[]>();
  for (const r of repData) {
    const arr = m.get(r.setNumber) ?? [];
    arr.push(r);
    m.set(r.setNumber, arr);
  }
  return m;
}

function buildYAxisTicks(maxValue: number, decimals: number): number[] {
  if (maxValue <= 0) return [0];
  const step = maxValue / 4;
  return [0, step, step * 2, step * 3].map((t) => Number(t.toFixed(decimals)));
}

// One stateful section per exercise — tracks which set tab is active.
// Parent passes key={exercise.id} so state resets between sessions.
function ExerciseSection({ exercise }: { exercise: ExerciseData }) {
  const bySet      = groupRepsBySet(exercise.repData);
  const allSetNums = Array.from(bySet.keys()).sort((a, b) => a - b);
  const [selectedSet, setSelectedSet] = useState<number>(allSetNums[0] ?? 1);

  if (exercise.repData.length === 0) {
    return (
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b">
          <Dumbbell className="h-3.5 w-3.5 text-primary shrink-0" />
          <p className="text-sm font-semibold flex-1 min-w-0 truncate">{exercise.name}</p>
          {exercise.sets > 0 && (
            <span className="text-xs text-muted-foreground shrink-0">
              {exercise.sets} sets · {exercise.reps} reps
            </span>
          )}
        </div>
        <div className="px-4 py-5 text-center">
          <p className="text-xs text-muted-foreground">No velocity data — completed without VBT device</p>
        </div>
      </div>
    );
  }

  // Session-average velocity for this exercise — reference line on the chart.
  const allValidVels = exercise.repData.filter((r) => r.velocity > 0).map((r) => r.velocity);
  const avgVelAllSets = allValidVels.length > 0
    ? allValidVels.reduce((a, b) => a + b, 0) / allValidVels.length
    : null;
  const refLineVal = avgVelAllSets !== null ? Number(avgVelAllSets.toFixed(2)) : null;

  // Chart data filtered to the selected set, sorted by rep number.
  const setReps = [...(bySet.get(selectedSet) ?? [])].sort((a, b) => a.repNumber - b.repNumber);
  const chartData = setReps.map((r) => ({
    label: `R${r.repNumber}`,
    velocity: r.velocity > 0 ? Number(r.velocity.toFixed(2)) : null,
    rom:      r.rom > 0     ? Math.round(r.rom)             : null,
  }));

  const velocityValues = chartData.map((d) => d.velocity).filter((v): v is number => v !== null);
  const romValues      = chartData.map((d) => d.rom).filter((v): v is number => v !== null);
  const velocityMax    = velocityValues.length > 0 ? Math.max(...velocityValues) + 0.05 : 1;
  const romMax         = romValues.length > 0      ? Math.max(...romValues) + 50         : 0;
  // Only show ROM chart when the selected set actually has ROM readings.
  const hasRomData     = romValues.length > 0;

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      {/* Exercise header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b">
        <Dumbbell className="h-3.5 w-3.5 text-primary shrink-0" />
        <p className="text-sm font-semibold flex-1 min-w-0 truncate">{exercise.name}</p>
        <span className="text-xs text-muted-foreground shrink-0">
          {allSetNums.length} sets · {exercise.repData.length} reps
        </span>
      </div>

      <div className="px-4 pt-4 pb-5 space-y-5">

        {/* Set tab pills */}
        <div className="flex gap-1.5 flex-wrap">
          {allSetNums.map((setNum) => (
            <button
              key={setNum}
              onClick={() => setSelectedSet(setNum)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold transition-colors",
                selectedSet === setNum
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              Set {setNum}
            </button>
          ))}
        </div>

        {/* Velocity chart — selected set, rep-by-rep */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Activity className="h-3 w-3" /> Rep Velocity (m/s)
          </span>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={chartData} margin={{ top: 6, right: 6, left: 0, bottom: 2 }}>
              <XAxis
                dataKey="label"
                fontSize={9}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                fontSize={9}
                width={30}
                domain={[0, velocityMax]}
                ticks={buildYAxisTicks(velocityMax, 2)}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "8px", fontSize: 11, border: "1px solid hsl(var(--border))" }}
                formatter={(v: number) => [`${Number(v).toFixed(2)} m/s`, "Velocity"]}
              />
              {refLineVal !== null && (
                <ReferenceLine
                  y={refLineVal}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 3"
                  strokeWidth={1}
                  opacity={0.55}
                  label={{ value: `avg ${refLineVal.toFixed(2)}`, position: "insideTopRight", fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                />
              )}
              <Line
                type="monotone"
                dataKey="velocity"
                stroke="hsl(142, 76%, 45%)"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(142, 76%, 45%)" }}
                activeDot={{ r: 4.5 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ROM chart — selected set, only shown when this set has ROM readings */}
        {hasRomData && (
          <div className="space-y-1 pt-4 border-t border-border/50">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Maximize2 className="h-3 w-3" /> Vertical Displacement (mm)
            </span>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={chartData} margin={{ top: 6, right: 6, left: 0, bottom: 2 }}>
                <XAxis
                  dataKey="label"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  fontSize={9}
                  width={30}
                  domain={[0, romMax]}
                  ticks={buildYAxisTicks(romMax, 0)}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderRadius: "8px", fontSize: 11, border: "1px solid hsl(var(--border))" }}
                  formatter={(v: number) => [`${Math.round(Number(v))} mm`, "Depth"]}
                />
                <Line
                  type="monotone"
                  dataKey="rom"
                  stroke="hsl(42, 95%, 50%)"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: "hsl(42, 95%, 50%)" }}
                  activeDot={{ r: 4 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Peak velocity + Avg Vertical Displacement stat row */}
        <div className="flex items-center gap-6 pt-3 border-t border-border">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1 mb-0.5">
              <Activity className="h-3 w-3" /> Peak Velocity
            </p>
            <p className="text-base font-bold">
              {exercise.peakVelocity}{" "}
              <span className="text-xs font-normal text-muted-foreground">m/s</span>
            </p>
          </div>
          {exercise.avgROM > 0 && (
            <div>
              <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1 mb-0.5">
                <Maximize2 className="h-3 w-3" /> Avg Displacement
              </p>
              <p className="text-base font-bold">
                {exercise.avgROM}{" "}
                <span className="text-xs font-normal text-muted-foreground">mm</span>
              </p>
            </div>
          )}
        </div>

        {/* Per-set summary table — all sets always visible.
            Selected row is highlighted and clickable to switch the chart. */}
        <div className="rounded-lg border overflow-hidden">
          <div className="grid grid-cols-5 px-3 py-1.5 bg-muted/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Set</span>
            <span>Reps</span>
            <span>Avg Vel</span>
            <span>Weight</span>
            <span>Tempo</span>
          </div>
          {allSetNums.map((setNum) => {
            const reps        = bySet.get(setNum)!;
            const validVels   = reps.filter((r) => r.velocity > 0);
            const avgVel      = validVels.length > 0
              ? validVels.reduce((a, r) => a + r.velocity, 0) / validVels.length
              : null;
            const validTempos = reps.filter((r) => r.tempo > 0);
            const avgTempo    = validTempos.length > 0
              ? validTempos.reduce((a, r) => a + r.tempo, 0) / validTempos.length
              : null;
            const weight      = exercise.weight > 0 ? `${exercise.weight} ${exercise.weightUnit}` : "—";
            const isSelected  = setNum === selectedSet;
            return (
              <div
                key={setNum}
                className={cn(
                  "grid grid-cols-5 px-3 py-2 text-xs border-t items-center cursor-pointer transition-colors",
                  isSelected ? "bg-primary/10" : "hover:bg-muted/30",
                )}
                onClick={() => setSelectedSet(setNum)}
              >
                <span className={cn("font-semibold", isSelected ? "text-primary" : "")}>
                  Set {setNum}
                </span>
                <span className={isSelected ? "" : "text-muted-foreground"}>{reps.length}</span>
                <span className={cn(
                  "font-medium",
                  avgVel === null  ? "text-muted-foreground"
                  : avgVel >= 0.85 ? "text-green-600"
                  : avgVel >= 0.5  ? "text-foreground"
                  : "text-amber-600",
                )}>
                  {avgVel !== null ? `${avgVel.toFixed(2)} m/s` : "—"}
                </span>
                <span className={isSelected ? "" : "text-muted-foreground"}>{weight}</span>
                <span className={isSelected ? "" : "text-muted-foreground"}>
                  {avgTempo !== null ? `${avgTempo.toFixed(2)}s` : "—"}
                </span>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

// key={session.id} is set by the parent to remount between sessions.
function InlineSessionDetail({ session }: { session: SessionData }) {
  if (session.exercises.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">No exercise data for this session</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {session.exercises.map((exercise) => (
        <ExerciseSection key={exercise.id} exercise={exercise} />
      ))}
    </div>
  );
}


// ── Main component ───────────────────────────────────────────────────────────
export const AthleteDetailPanel = ({ athlete, open, onClose }: AthleteDetailPanelProps) => {
  type WorkoutPlan = Database["public"]["Tables"]["workout_plans"]["Row"];
  type TimelineItem = (WorkoutPlan & { _timelineType: "plan"; _timelineDate: string; _sortKey: string; _displayTime: string | null })
    | (SessionData & { _timelineType: "session"; _timelineDate: string; _sortKey: string; _displayTime: string | null });

  const navigate = useNavigate();

  const [sessions, setSessions]               = useState<SessionData[]>([]);
  const [plans, setPlans]                     = useState<WorkoutPlan[]>([]);
  const [timeline, setTimeline]               = useState<TimelineItem[]>([]);
  const [loading, setLoading]                 = useState(false);
  const [sessionDetailLoading, setSessionDetailLoading] = useState(false);
  const [timeWindow, setTimeWindow]           = useState<TimeWindow>("4W");
  const [selectedPlan, setSelectedPlan]       = useState<WorkoutPlan | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  const [selectedMetric, setSelectedMetric]   = useState<{
    indicator: DeviationIndicator;
    sparkline: SparklineData;
    trendLabel: ReturnType<typeof computeTrendLabel>;
  } | null>(null);
  const [modalView, setModalView]             = useState<ModalView>("summary");
  const dialogScrollRef                       = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (athlete && open) {
      setTimeWindow("4W");
      setModalView("summary");
      setSelectedSession(null);
      setSelectedMetric(null);
      loadData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athlete?.id, open]);

  useEffect(() => {
    if (dialogScrollRef.current) dialogScrollRef.current.scrollTop = 0;
  }, [modalView]);

  const loadData = async () => {
    if (!athlete) return;
    try {
      setLoading(true);
      const [plansData, sessionsData] = await Promise.all([
        getPlayerWorkoutPlans(athlete.id),
        getPlayerSessions(athlete.id, athlete.user_id),
      ]);
      setPlans(plansData);
      setSessions(sessionsData);

      const attSummary = getAttendanceSummary(
        plansData.map((p) => ({ date: p.date ?? "", title: p.title ?? "", is_completed: p.is_completed ?? false, session_id: p.session_id ?? null })),
        sessionsData.map((s) => ({ id: s.id, date: s.date, name: s.notes, createdAt: s.createdAt, status: s.status })),
      );
      const planItems = plansData
        .filter((p) => (Array.isArray(p.exercises) && (p.exercises as any[]).length > 0) || p.session_id != null)
        .map((p) => {
          const linked = p.session_id ? sessionsData.find(s => s.id === p.session_id) : null;
          return { ...p, _timelineType: "plan" as const, _timelineDate: p.date ?? "", _sortKey: p.date ?? "", _displayTime: linked?.startedAt ?? null };
        });
      const sessionItems = sessionsData
        .filter((s) => !attSummary.matchedSessionIds.has(s.id))
        .map((s) => ({ ...s, _timelineType: "session" as const, _timelineDate: s.date, _sortKey: s.startedAt ?? s.createdAt, _displayTime: s.startedAt ?? s.createdAt }));
      console.log('[Timeline]', {
        totalPlans: plansData.length,
        totalSessions: sessionsData.length,
        matchedSessionIds: Array.from(attSummary.matchedSessionIds),
        standaloneSessionItems: sessionItems.length,
        sessionNames: sessionsData.map(s => ({ id: s.id, date: s.date, name: s.notes })),
      });
      setTimeline(
        [...planItems, ...sessionItems].sort(
          (a, b) => new Date(b._sortKey).getTime() - new Date(a._sortKey).getTime(),
        ) as TimelineItem[],
      );
    } catch {
      toast.error("Failed to load athlete data");
    } finally {
      setLoading(false);
    }
  };

  // ── Preserved: derived data for Exercise Detail View ─────────────────────
  const derived = useMemo(() => {
    const now = new Date();
    const windowDays = timeWindow === "1W" ? 7 : timeWindow === "4W" ? 28 : 56;
    const windowStart   = subDays(now, windowDays);
    const baselineStart = subDays(now, windowDays * 2);

    const filtered        = sessions.filter((s) => parseISO(s.date) >= windowStart);
    const baselineSessions = sessions.filter((s) => {
      const d = parseISO(s.date);
      return d >= baselineStart && d < windowStart;
    });

    const avgOfVels = (ss: SessionData[]) => {
      const v = ss.flatMap((s) => s.exercises.map((e) => e.avgVelocity).filter((x) => x > 0));
      return v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };

    const recentAvg = avgOfVels(filtered);
    const baseline  = avgOfVels(baselineSessions);

    let velocityDropOff: number | null = null;
    if (sessions.length > 0) {
      const repVels = sessions[0].exercises
        .flatMap((e) => e.repData.map((r) => r.velocity))
        .filter((v) => v > 0);
      if (repVels.length >= 2) {
        const first = repVels[0], last = repVels[repVels.length - 1];
        velocityDropOff = first > 0 ? parseFloat((((first - last) / first) * 100).toFixed(1)) : null;
      }
    }

    const weekStart = subDays(now, 7);
    const weekVels  = sessions
      .filter((s) => parseISO(s.date) >= weekStart)
      .flatMap((s) => s.exercises.flatMap((e) => e.repData.map((r) => r.velocity)))
      .filter((v) => v > 0);
    const peakVelocityThisWeek = weekVels.length > 0 ? parseFloat(Math.max(...weekVels).toFixed(2)) : null;

    const avgVelocityDelta =
      recentAvg !== null && baseline !== null ? parseFloat((recentAvg - baseline).toFixed(2)) : null;
    const sessionsDelta  = filtered.length - baselineSessions.length;
    const lastSessionDate = sessions[0] ? format(parseISO(sessions[0].date), "MMM d") : null;

    const signals: ReadinessData["signals"] = [];
    let readinessStatus: ReadinessStatus = "ready";
    let readinessReason = "No session data available";
    const hasData = recentAvg !== null;

    if (hasData) {
      if (baseline !== null) {
        const pct = ((recentAvg! - baseline) / baseline) * 100;
        signals.push({
          label: "Velocity vs baseline",
          value: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`,
          flag: pct >= -3 ? "ok" : pct >= -8 ? "warn" : "alert",
        });
        if (pct >= -3)      { readinessStatus = "ready";   readinessReason = `Velocity within 3% of ${windowDays / 7}-week baseline`; }
        else if (pct >= -8) { readinessStatus = "monitor"; readinessReason = `Velocity ${Math.abs(pct).toFixed(1)}% below ${windowDays / 7}-week baseline`; }
        else                { readinessStatus = "flag";    readinessReason = `Velocity ${Math.abs(pct).toFixed(1)}% below ${windowDays / 7}-week baseline`; }
      } else {
        readinessReason = "Insufficient prior data to calculate baseline";
        signals.push({ label: "Velocity vs baseline", value: "No prior data", flag: "neutral" });
      }

      const recentTempos   = filtered.flatMap((s) => s.exercises.map((e) => e.avgTempo).filter((t) => t > 0));
      const baselineTempos = baselineSessions.flatMap((s) => s.exercises.map((e) => e.avgTempo).filter((t) => t > 0));
      if (recentTempos.length > 0 && baselineTempos.length > 0) {
        const rT = recentTempos.reduce((a, b) => a + b, 0) / recentTempos.length;
        const bT = baselineTempos.reduce((a, b) => a + b, 0) / baselineTempos.length;
        const tPct = ((rT - bT) / bT) * 100;
        signals.push({ label: "Concentric tempo", value: `${tPct >= 0 ? "+" : ""}${tPct.toFixed(1)}%`, flag: tPct <= 10 ? "ok" : tPct <= 20 ? "warn" : "alert" });
        if (tPct > 20 && readinessStatus === "ready") { readinessStatus = "monitor"; readinessReason = `Concentric tempo elevated ${tPct.toFixed(1)}% above baseline`; }
        else if (tPct > 30 && readinessStatus !== "flag") { readinessStatus = "flag"; readinessReason = `Concentric tempo severely elevated (${tPct.toFixed(1)}% above baseline)`; }
      }
    }

    const readiness: ReadinessData | null = hasData ? { status: readinessStatus, reason: readinessReason, signals } : null;

    const velocityChartData = [...filtered].reverse().map((s) => {
      const v = s.exercises.map((e) => e.avgVelocity).filter((x) => x > 0);
      const avg = v.length > 0 ? parseFloat((v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)) : null;
      return { date: format(parseISO(s.date), "MMM d"), velocity: avg };
    }).filter((d): d is { date: string; velocity: number } => d.velocity !== null);

    const tempoChartData = [...filtered].reverse().map((s) => {
      const t = s.exercises.map((e) => e.avgTempo).filter((x) => x > 0);
      const avg = t.length > 0 ? parseFloat((t.reduce((a, b) => a + b, 0) / t.length).toFixed(2)) : null;
      return { date: format(parseISO(s.date), "MMM d"), concentric: avg };
    }).filter((d): d is { date: string; concentric: number } => d.concentric !== null);

    return {
      filteredSessions: filtered,
      baseline: baseline ? parseFloat(baseline.toFixed(2)) : null,
      readiness,
      kpi: { avgVelocity: recentAvg ? parseFloat(recentAvg.toFixed(2)) : null, avgVelocityDelta, velocityDropOff, peakVelocityThisWeek, sessionsCompleted: filtered.length, sessionsDelta, lastSessionDate },
      velocityChartData,
      tempoChartData,
    };
  }, [sessions, timeWindow]);

  // ── Anomaly + sparkline data ──────────────────────────────────────────────

  const anomalyIndicators = useMemo(() => computeAnomalyIndicators(sessions), [sessions]);

  const sparklineMap = useMemo<Record<string, SparklineData>>(() => ({
    velocity:         computeSparkline(sessions, sessionAvgVelocity),
    withinSetDropoff: computeSparkline(sessions, sessionWithinSetDropoff),
    sessionFatigue:   computeSparkline(sessions, sessionVelocityDropoff),
    tempo:            computeSparkline(sessions, sessionAvgTempo),
    volume:           computeSparkline(sessions, sessionVolume),
  }), [sessions]);

  const recentSessionRows = useMemo(() => computeRecentSessions(sessions), [sessions]);

  // ── Session metadata ──────────────────────────────────────────────────────
  const sessionMetadata = useMemo(() => {
    if (sessions.length === 0) return null;
    const activeWeeks = new Set(
      sessions.map((s) => {
        const d      = parseISO(s.date);
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return monday.toISOString().slice(0, 10);
      })
    ).size;
    const firstDate = sessions[sessions.length - 1].date;
    return { count: sessions.length, activeWeeks, firstDate };
  }, [sessions]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleExerciseNavigate = useCallback((path: string) => {
    onClose();
    navigate(path);
  }, [onClose, navigate]);

  const handleBackToSummary = useCallback(() => {
    setModalView("summary");
    setSelectedSession(null);
    setSelectedMetric(null);
  }, []);

  const handleMetricCardClick = useCallback((ind: DeviationIndicator, sparkline: SparklineData) => {
    if (!sparkline || sparkline.insufficient) return;
    const trendLabel = computeTrendLabel(sparkline.points, HIGHER_IS_BETTER[ind.metric] ?? true);
    setSelectedMetric({ indicator: ind, sparkline, trendLabel });
    setModalView("metric-detail");
  }, []);

  const isActive = sessions.some((s) => {
    try { return parseISO(s.date) >= subWeeks(new Date(), 4); } catch { return false; }
  });

  const attendanceSessions: WorkoutSessionLike[] = sessions.map((s) => ({
    id: s.id, date: s.date, name: s.notes, createdAt: s.createdAt, status: s.status,
  }));

  if (!athlete) return null;

  const { kpi } = derived;

  // ── Preserved: timeline helpers ───────────────────────────────────────────
  const normalize = (v?: string) => (v ?? "").trim().toLowerCase();

  const applyPlanTargets = (session: SessionData, plan: WorkoutPlan): SessionData => {
    type PlanEx = { name?: string; sets?: number; reps?: number; weight?: number; weightUnit?: string; targetVelocity?: number; targetVelocityMin?: number; targetVelocityMax?: number };
    const exList = (Array.isArray(plan.exercises) ? plan.exercises : []) as PlanEx[];

    // Session has no exercise data — synthesize from the plan so the detail view
    // shows what was assigned with "No velocity data" rather than a blank screen.
    if (session.exercises.length === 0 && exList.length > 0) {
      return {
        ...session,
        exercises: exList
          .filter((pe) => pe?.name)
          .map((pe, i) => ({
            id: `${session.id}-plan-${i}`,
            name: pe.name!,
            sets: Number(pe.sets) || 0,
            reps: Number(pe.reps) || 0,
            weight: Number(pe.weight) || 0,
            weightUnit: (pe.weightUnit as 'lbs' | 'kg') || 'lbs',
            avgVelocity: 0,
            avgROM: 0,
            avgTempo: 0,
            peakVelocity: 0,
            targetVelocityMin: Number(pe.targetVelocityMin ?? pe.targetVelocity) || 0,
            targetVelocityMax: Number(pe.targetVelocityMax ?? pe.targetVelocity) || 0,
            repData: [],
          })),
      };
    }

    return {
      ...session,
      exercises: session.exercises.map((ex) => {
        const match = exList.find((pe) => normalize(pe?.name) === normalize(ex.name));
        return match
          ? { ...ex, targetVelocityMin: Number(match.targetVelocityMin ?? match.targetVelocity) || 0, targetVelocityMax: Number(match.targetVelocityMax ?? match.targetVelocity) || 0 }
          : ex;
      }),
    };
  };

  const getPlanStatus = (plan: WorkoutPlan) => {
    // Resolve direct session link first — a missed session means the plan is missed.
    if (plan.session_id) {
      const linked = sessions.find(s => s.id === plan.session_id);
      if (linked?.status === 'missed') {
        const planDate = parseISO(plan.date ?? "");
        return isPast(planDate) && !isToday(planDate) ? "missed" : "pending";
      }
      if (linked) return "completed";
    }
    if (plan.is_completed) return "completed";
    const matched = findMatchingSessionForPlan({ date: plan.date ?? "", title: plan.title ?? "" }, attendanceSessions);
    if (matched) return "completed";
    const planDate = parseISO(plan.date ?? "");
    if (isPast(planDate) && !isToday(planDate)) return "missed";
    return "pending";
  };

  const getMatchingSession = (plan: WorkoutPlan) => {
    const matched = findMatchingSessionForPlan({ date: plan.date ?? "", title: plan.title ?? "" }, attendanceSessions);
    return matched ? sessions.find((s) => s.id === matched.id) ?? null : null;
  };

  const handleTimelineItemClick = async (item: TimelineItem) => {
    if (item._timelineType === "plan") {
      const status = getPlanStatus(item);
      if (status === "completed") {
        setSessionDetailLoading(true);
        try {
          // 1. Direct link — no name matching needed
          const linkedId = item.session_id ?? null;
          // 2. Fuzzy fallback: exact name match first, then any same-date session
          //    only when this is the sole plan on that date (avoids ambiguity with
          //    multiple completed plans sharing the same date).
          const plansOnDate = plans.filter(p => p.date === item.date);
          const anyDayFallback = plansOnDate.length === 1
            ? sessions.find(s => s.date === (item.date ?? "")) ?? null
            : null;
          const match = linkedId
            ? (sessions.find(s => s.id === linkedId) ?? null)
            : (getMatchingSession(item) ?? anyDayFallback);

          if (match) {
            const fresh = await getSessionById(match.id);
            setSelectedSession(applyPlanTargets(fresh ?? match, item));
          } else {
            // No session at all — synthesize from plan exercises
            const planSession: SessionData = {
              id: `plan-${item.id}`,
              date: item.date ?? "",
              createdAt: item.created_at ?? "",
              startedAt: null,
              status: null,
              exercises: [],
            };
            setSelectedSession(applyPlanTargets(planSession, item));
          }
          setModalView("session-detail");
        } finally {
          setSessionDetailLoading(false);
        }
      } else {
        setSelectedPlan(item);
      }
    } else {
      setSessionDetailLoading(true);
      try {
        const fresh = await getSessionById(item.id);
        setSelectedSession(fresh ?? item);
        setModalView("session-detail");
      } finally {
        setSessionDetailLoading(false);
      }
    }
  };

  return (
    <>
      {/*
       * overflow-y-auto + max-h-[90vh] on DialogContent makes the dialog itself
       * the scroll container. Height is content-driven up to 90vh — no fixed h
       * needed, so there is no empty space when content is short.
       * The header uses position: sticky (z-[1]) to stay pinned while the body
       * scrolls beneath it. The close button (absolute, later in DOM) naturally
       * paints on top without needing an explicit z-index fight.
       */}
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent ref={dialogScrollRef} className="max-w-[860px] max-h-[90vh] p-0 gap-0 overflow-y-auto">
          <div className="relative flex flex-col">
            <LoadingOverlay isLoading={loading || sessionDetailLoading} message={sessionDetailLoading ? "Loading session…" : "Loading athlete data…"} />

            {modalView === "summary" ? (
              <div className="sticky top-0 z-[1] flex items-start gap-4 px-6 pt-5 pb-4 border-b pr-14" style={{ backgroundColor: '#071c32' }}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-semibold leading-tight" style={{ color: '#ffffff' }}>{athlete.name}</h2>
                    <span style={isActive
                      ? { backgroundColor: '#1f8a5b22', color: '#34c98a', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', marginTop: 4 }
                      : { backgroundColor: 'rgba(255,255,255,0.08)', color: '#9aa6ba', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', marginTop: 4 }
                    }>
                      {isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {athlete.group && (
                    <div className="mt-1">
                      <Badge className="text-xs font-medium" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#ffffff', borderRadius: 999, padding: '2px 8px' }}>{athlete.group}</Badge>
                    </div>
                  )}
                  {kpi.lastSessionDate && (
                    <p className="text-xs mt-1" style={{ color: '#9aa6ba' }}>Last session: {kpi.lastSessionDate}</p>
                  )}
                </div>
                <button
                  onClick={() => loadData()}
                  disabled={loading}
                  title="Refresh athlete data"
                  className="shrink-0 mt-0.5 p-1.5 rounded-md transition-colors disabled:opacity-40"
                  style={{ color: '#9aa6ba' }}
                >
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                </button>
              </div>
            ) : (
              <div className="sticky top-0 z-[1] bg-background flex items-center gap-3 px-6 pt-5 pb-4 border-b pr-14">
                <button
                  onClick={handleBackToSummary}
                  className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
                <div className="w-px h-4 bg-border shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-foreground leading-tight truncate">
                    {modalView === "session-detail" && selectedSession
                      ? format(parseISO(selectedSession.date), "MMMM d, yyyy")
                      : selectedMetric?.indicator.label ?? "Metric Detail"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">{athlete.name}</p>
                </div>
              </div>
            )}

            {/* Body — isolation: isolate keeps positioned body descendants
                (charts, badges) below the sticky header's stacking context */}
            <div className="isolate px-6 py-5 space-y-6" style={{ backgroundColor: '#f6f7f9' }}>

                {modalView === "summary" ? (
                  <>
                    {sessions.length > 0 && <LastSessionCard session={sessions[0]} />}

                    {sessionMetadata && (
                      <p className="text-xs -mt-2" style={{ color: '#205783' }}>
                        {sessionMetadata.count} session{sessionMetadata.count !== 1 ? "s" : ""}{" "}
                        · {sessionMetadata.activeWeeks} active week{sessionMetadata.activeWeeks !== 1 ? "s" : ""}{" "}
                        · First recorded {format(parseISO(sessionMetadata.firstDate), "MMM d, yyyy")}
                      </p>
                    )}

                    <DeviationSparklines indicators={anomalyIndicators} sparklines={sparklineMap} onCardClick={handleMetricCardClick} />

                    {/* ── Combined sessions + assigned plans list ───────── */}
                    <div>
                      <p className="text-sm font-semibold mb-3">Recent Sessions</p>
                      {timeline.length === 0 ? (
                        <div className="rounded-xl border border-dashed px-4 py-6 text-center">
                          <p className="text-sm text-muted-foreground">No sessions recorded yet</p>
                        </div>
                      ) : (
                        <div className="rounded-xl border overflow-hidden divide-y">
                          {timeline.map((item) => {
                            if (item._timelineType === "plan") {
                              const status = getPlanStatus(item);
                              const exCount = Array.isArray(item.exercises) ? (item.exercises as any[]).length : 0;
                              const planTimeLabel = item._displayTime
                                ? new Date(item._displayTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                                : null;
                              return (
                                <div
                                  key={`plan-${item.id}`}
                                  className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
                                  onClick={() => handleTimelineItemClick(item)}
                                >
                                  <span className="text-xs text-muted-foreground w-12 shrink-0">
                                    {item._timelineDate ? format(parseISO(item._timelineDate), "MMM d") : "—"}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{item.title}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {`${item.coach_id ? "Assigned by coach" : "Self-completed"} · ${exCount} exercise${exCount !== 1 ? "s" : ""}${planTimeLabel ? ` · ${planTimeLabel}` : ""}`}
                                    </p>
                                  </div>
                                  {status === "completed" ? (
                                    <>
                                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground transition-colors" />
                                    </>
                                  ) : status === "missed" ? (
                                    <>
                                      <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground transition-colors" />
                                    </>
                                  ) : (
                                    <Clock className="h-4 w-4 text-blue-400 shrink-0" />
                                  )}
                                </div>
                              );
                            }
                            // session item — look up precomputed row for velocity dropoff
                            const row = recentSessionRows.find((r) => r.id === item.id);
                            const exNames = item.exercises
                              .map((e) => e.name)
                              .filter((n) => n && n.trim().length > 0);
                            const sessionTitle = item.notes || "Self-completed workout";
                            const dropoff = row?.velocityDropoffPct ?? null;
                            const sessionTimeLabel = item._displayTime
                              ? new Date(item._displayTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                              : null;
                            return (
                              <div
                                key={`session-${item.id}`}
                                className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
                                onClick={() => handleTimelineItemClick(item)}
                              >
                                <span className="text-xs text-muted-foreground w-12 shrink-0">
                                  {item._timelineDate ? format(parseISO(item._timelineDate), "MMM d") : "—"}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">{sessionTitle}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {`Self-completed · ${exNames.length} exercise${exNames.length !== 1 ? "s" : ""}${sessionTimeLabel ? ` · ${sessionTimeLabel}` : ""}`}
                                  </p>
                                </div>
                                {item.status === "missed"
                                  ? <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                                  : <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                }
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground transition-colors" />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                ) : modalView === "metric-detail" && selectedMetric ? (
                  <>
                    {/* Metric header card */}
                    <div className="rounded-xl px-5 py-4" style={{ backgroundColor: '#071c32', borderRadius: 12 }}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: '#9aa6ba' }}>
                        {selectedMetric.indicator.label}
                      </p>
                      <div className="flex items-end gap-4 flex-wrap">
                        <div>
                          <p className="text-3xl font-bold" style={{ color: '#f5b400' }}>
                            {selectedMetric.indicator.latestValue !== null
                              ? selectedMetric.indicator.formatFn(selectedMetric.indicator.latestValue)
                              : '—'}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: '#9aa6ba' }}>Latest session</p>
                        </div>
                        <div>
                          <p className="text-xl font-semibold" style={{ color: '#ffffff' }}>
                            {selectedMetric.indicator.baseline !== null
                              ? selectedMetric.indicator.formatFn(selectedMetric.indicator.baseline)
                              : '—'}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: '#9aa6ba' }}>Baseline avg</p>
                        </div>
                        <div>
                          <p className="text-xl font-semibold" style={{
                            color: selectedMetric.indicator.ragStatus === 'red' ? '#f87171'
                              : selectedMetric.indicator.ragStatus === 'amber' ? '#fbbf24'
                              : '#34c98a',
                          }}>
                            {selectedMetric.indicator.deltaPercent !== null
                              ? `${selectedMetric.indicator.deltaPercent > 0 ? '+' : ''}${selectedMetric.indicator.deltaPercent.toFixed(1)}%`
                              : '—'}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: '#9aa6ba' }}>vs baseline</p>
                        </div>
                        <div className="ml-auto">
                          <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{
                            backgroundColor: selectedMetric.trendLabel.direction === 'improving' ? '#1f8a5b22'
                              : selectedMetric.trendLabel.direction === 'declining' ? '#ef444422'
                              : 'rgba(255,255,255,0.08)',
                            color: selectedMetric.trendLabel.direction === 'improving' ? '#34c98a'
                              : selectedMetric.trendLabel.direction === 'declining' ? '#f87171'
                              : '#9aa6ba',
                          }}>
                            {selectedMetric.trendLabel.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Full session-by-session chart */}
                    <div className="rounded-xl px-5 py-4" style={{ backgroundColor: '#ffffff', border: '1px solid rgba(7,16,31,0.06)' }}>
                      <p className="text-sm font-semibold mb-4" style={{ color: '#071c32' }}>Session history</p>
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={selectedMetric.sparkline.points}>
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8d95a4' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#8d95a4' }} axisLine={false} tickLine={false} width={36} />
                          <ReferenceLine
                            y={selectedMetric.indicator.baseline ?? undefined}
                            stroke="#205783"
                            strokeDasharray="4 2"
                            strokeWidth={1}
                            opacity={0.6}
                          />
                          <Tooltip
                            contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid rgba(7,16,31,0.06)', backgroundColor: '#ffffff' }}
                            formatter={(val: number) => [selectedMetric.indicator.formatFn(val), selectedMetric.indicator.label]}
                          />
                          <Line
                            dataKey="value"
                            stroke="#f5b400"
                            strokeWidth={2}
                            dot={{ r: 3, fill: '#f5b400', strokeWidth: 0 }}
                            activeDot={{ r: 5, fill: '#f5b400' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                      <p className="text-[10px] mt-2" style={{ color: '#8d95a4' }}>Dashed line = baseline average</p>
                    </div>

                    {/* Session-by-session table */}
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(7,16,31,0.06)' }}>
                      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8f9fb', borderBottom: '1px solid rgba(7,16,31,0.06)' }}>
                            {(['Session', 'Date', 'Value', 'vs Baseline'] as const).map(h => (
                              <th key={h} style={{
                                padding: '8px 14px', textAlign: 'left' as const,
                                fontSize: 10.5, fontWeight: 600, color: '#8d95a4',
                                letterSpacing: '0.07em', textTransform: 'uppercase' as const,
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...selectedMetric.sparkline.points].reverse().map((pt, i) => {
                            const diff = selectedMetric.indicator.baseline !== null
                              ? ((pt.value - selectedMetric.indicator.baseline) / selectedMetric.indicator.baseline) * 100
                              : null;
                            const isGood = HIGHER_IS_BETTER[selectedMetric.indicator.metric]
                              ? (diff ?? 0) >= 0
                              : (diff ?? 0) <= 0;
                            return (
                              <tr
                                key={i}
                                style={{ borderBottom: '1px solid rgba(7,16,31,0.06)', cursor: pt.sessionId ? 'pointer' : 'default' }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8f9fb')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                onClick={() => {
                                  if (pt.sessionId) {
                                    handleTimelineItemClick({ id: pt.sessionId, _timelineType: 'session' } as any);
                                  }
                                }}
                              >
                                <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#07101f' }}>
                                  {i === 0 ? 'Latest' : `Session -${i}`}
                                </td>
                                <td style={{ padding: '10px 14px', fontFamily: 'Inter', fontSize: 11, color: '#8d95a4' }}>
                                  {pt.date}
                                </td>
                                <td style={{ padding: '10px 14px', fontFamily: 'Inter', fontSize: 13, fontWeight: 600, color: '#07101f' }}>
                                  {selectedMetric.indicator.formatFn(pt.value)}
                                </td>
                                <td style={{ padding: '10px 14px', fontFamily: 'Inter', fontSize: 12, fontWeight: 500,
                                  color: diff === null ? '#8d95a4' : isGood ? '#1f8a5b' : '#c2410c' }}>
                                  {diff !== null ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%` : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  selectedSession && (
                    <InlineSessionDetail key={selectedSession.id} session={selectedSession} />
                  )
                )}

                {/*
                 * ── PRESERVED FOR EXERCISE DETAIL VIEW (next sprint) ─────────────────
                 * Re-enable when building /athlete/:id/exercise/:exerciseId.
                 * All backing data is still computed in `derived` above:
                 *   ReadinessBanner    — derived.readiness
                 *   ModalStatCard ×4   — derived.kpi
                 *   TimeWindowToggle   — timeWindow / setTimeWindow
                 *   Velocity LineChart — derived.velocityChartData + derived.baseline
                 *   Tempo BarChart     — derived.tempoChartData
                 *   Timeline           — timeline / handleTimelineItemClick
                 * ── END PRESERVED ────────────────────────────────────────────────────
                 */}

              </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Plan detail dialog — preserved */}
      <Dialog open={!!selectedPlan} onOpenChange={() => setSelectedPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPlan?.title}</DialogTitle>
            <DialogDescription>
              {selectedPlan?.date ? format(parseISO(selectedPlan.date), "PPPP") : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-2">
              <Badge variant={selectedPlan?.is_completed ? "default" : "secondary"}>
                {selectedPlan?.is_completed
                  ? "Completed"
                  : selectedPlan && getPlanStatus(selectedPlan) === "missed"
                  ? "Missed"
                  : "Upcoming"}
              </Badge>
              {selectedPlan?.coach_id && (
                <span className="text-xs text-muted-foreground">Assigned by coach</span>
              )}
            </div>
            {selectedPlan && getPlanStatus(selectedPlan) === "missed" && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-700">
                  {athlete?.name ?? "This athlete"} did not complete this workout on{" "}
                  {selectedPlan.date ? format(parseISO(selectedPlan.date), "MMMM d") : "the scheduled date"}.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2 text-sm">
                <Dumbbell className="h-4 w-4" /> Assigned Exercises
              </h4>
              <div className="divide-y max-h-72 overflow-y-auto">
                {(selectedPlan?.exercises as Array<{ name: string; sets: number; reps: number; weight: number; weightUnit: string; targetVelocity?: number }>)?.map((ex, i) => (
                  <div key={i} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{ex.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {ex.sets} × {ex.reps}
                        {ex.weight > 0 && ` @ ${ex.weight} ${ex.weightUnit || 'lbs'}`}
                      </span>
                    </div>
                    {ex.targetVelocity != null && ex.targetVelocity > 0 && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-muted-foreground">Target velocity:</span>
                        <span className="text-xs font-medium">{ex.targetVelocity.toFixed(2)} m/s</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
