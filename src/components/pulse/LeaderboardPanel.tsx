import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar } from "./Avatar";
import { DEFAULT_DITHER, type DitherSettings } from "./rankDither";

/** Rank badge colors for the top 3; everyone else gets the neutral default. */
const RANK_COLOR: Record<number, string> = { 1: "#D4AF37", 2: "#9CA3AF", 3: "#B08D57" };

/**
 * Nominal cell size + gap in CSS px (same gap between rows and columns). Both are snapped to whole
 * device pixels at render time: at fractional display scaling (e.g. 125%) a 3px cell would be
 * 3.75 device px, which the browser snaps to 3 or 4 depending on position, so cells come out uneven.
 */
const DITHER_CELL = 3;
const DITHER_GAP = 2;
const DITHER_TRAIL = 3;
const DITHER_TRAIL_STEP = 0.1;

interface DitherHead {
  row: number;
  /** Steps from the right anchor (0 = rightmost column); grows by 1 each step as it travels left. */
  col: number;
}

interface RankRowDitherProps extends Partial<DitherSettings> {
  color: string;
}

function useDevicePixelRatio() {
  const [dpr, setDpr] = useState(() => (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1));
  useEffect(() => {
    const mq = window.matchMedia(`(resolution: ${dpr}dppx)`);
    const onChange = () => setDpr(window.devicePixelRatio || 1);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [dpr]);
  return dpr;
}

/**
 * Matrix of tiny square cells anchored to the right edge, sized to fill its container. Blocks light
 * up at random on the rightmost column and travel left one cell per step, leaving a decaying trail.
 */
function RankRowDither({
  color,
  stepMs = DEFAULT_DITHER.stepMs,
  spawnMs = DEFAULT_DITHER.spawnMs,
  setGapMs = DEFAULT_DITHER.setGapMs,
  randomness = DEFAULT_DITHER.randomness,
  maxConcurrent = DEFAULT_DITHER.maxConcurrent,
}: RankRowDitherProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [heads, setHeads] = useState<DitherHead[]>([]);

  const dpr = useDevicePixelRatio();
  const cellDev = Math.max(1, Math.round(DITHER_CELL * dpr));
  const cell = cellDev / dpr;
  const gap = Math.max(1, Math.floor(DITHER_GAP * dpr)) / dpr;
  const radius = Math.max(1, Math.round(cellDev / 6)) / dpr;
  const pitch = cell + gap;
  const rows = box.height ? Math.max(1, Math.floor((box.height + gap) / pitch)) : 0;
  const cols = box.width ? Math.max(1, Math.floor((box.width + gap) / pitch)) : 0;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setBox({ width: rect.width, height: rect.height });
    const ro = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Travel: every step, each lit block moves one cell left; drop it once its trail has left the grid.
  useEffect(() => {
    if (!cols) return;
    const id = setInterval(() => {
      setHeads((prev) => prev.map((h) => ({ ...h, col: h.col + 1 })).filter((h) => h.col - DITHER_TRAIL < cols));
    }, stepMs);
    return () => clearInterval(id);
  }, [stepMs, cols]);

  // Light-up: every (jittered) `setGapMs` a new set starts, independent of sets still traveling. A set is
  // 1..maxConcurrent lights, each on a random free row of the rightmost column, staggered by (jittered) `spawnMs`.
  useEffect(() => {
    if (!rows) return;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (ms: number, fn: () => void) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };
    const jittered = (ms: number) => Math.max(16, ms * (1 + randomness * (Math.random() * 2 - 1)));
    const light = () =>
      setHeads((prev) => {
        const busy = new Set(prev.filter((h) => h.col <= DITHER_TRAIL).map((h) => h.row));
        const free = Array.from({ length: rows }, (_, r) => r).filter((r) => !busy.has(r));
        if (!free.length) return prev;
        return [...prev, { row: free[Math.floor(Math.random() * free.length)], col: 0 }];
      });
    const startSet = () => {
      const count = 1 + Math.floor(Math.random() * maxConcurrent);
      let at = 0;
      for (let k = 0; k < count; k++) {
        if (k > 0) at += jittered(spawnMs);
        later(at, light);
      }
      later(jittered(setGapMs), startSet);
    };
    startSet();
    return () => timers.forEach(clearTimeout);
  }, [spawnMs, setGapMs, randomness, maxConcurrent, rows]);

  const opacityAt = (row: number, distFromRight: number) => {
    let op = 0.4;
    for (const h of heads) {
      if (h.row !== row) continue;
      const trail = h.col - distFromRight;
      if (trail < 0 || trail > DITHER_TRAIL) continue;
      op = Math.max(op, 0.8 - trail * DITHER_TRAIL_STEP);
    }
    return op;
  };

  return (
    <span
      ref={ref}
      aria-hidden
      className="v-rank-dither"
      style={{ color, gridTemplateColumns: `repeat(${cols}, ${cell}px)`, gridAutoRows: cell, gap }}
    >
      {Array.from({ length: rows * cols }, (_, i) => {
        const row = Math.floor(i / cols);
        const distFromRight = cols - 1 - (i % cols);
        return <span key={i} className="v-rank-dither-cell" style={{ opacity: opacityAt(row, distFromRight), borderRadius: radius }} />;
      })}
    </span>
  );
}

export type LeaderboardMetric = "velocity" | "baseline" | "sessions" | "completion";

const METRIC_LABEL: Record<LeaderboardMetric, string> = {
  velocity: "Best velocity",
  baseline: "Change vs baseline",
  sessions: "Sessions",
  completion: "Plan completion",
};

/** Sessions and plan completion aren't scoped to one exercise. */
const METRIC_USES_EXERCISE: Record<LeaderboardMetric, boolean> = {
  velocity: true,
  baseline: true,
  sessions: false,
  completion: false,
};

const VISIBLE_ROWS = 8;

export interface LeaderboardRow {
  playerId: string;
  name: string;
  /** Already in the metric's own unit (m/s, signed %, count, %). */
  value: number;
  /** Number of exercises this athlete ranks first in (any metric), for the star badge. 0/undefined shows no star. */
  firstPlaceCount?: number;
}

export interface LeaderboardPanelProps {
  exercises: string[];
  selectedExercise: string;
  onExerciseChange: (exercise: string) => void;
  metric: LeaderboardMetric;
  onMetricChange: (metric: LeaderboardMetric) => void;
  /** Best first. */
  rows: LeaderboardRow[];
  onRowClick?: (playerId: string) => void;
  /** Overrides for the top-3 row dither animation; unset fields use DEFAULT_DITHER. */
  dither?: Partial<DitherSettings>;
}

function formatValue(metric: LeaderboardMetric, value: number): string {
  switch (metric) {
    case "velocity":
      return `${value.toFixed(2)} m/s`;
    case "baseline":
      return `${value > 0 ? "+" : ""}${value.toFixed(0)}%`;
    case "sessions":
      return `${value}`;
    case "completion":
      return `${value.toFixed(0)}%`;
  }
}

export function LeaderboardPanel({
  exercises,
  selectedExercise,
  onExerciseChange,
  metric,
  onMetricChange,
  rows,
  onRowClick,
  dither,
}: LeaderboardPanelProps) {
  const showExercise = METRIC_USES_EXERCISE[metric];
  const visible = rows.slice(0, VISIBLE_ROWS);

  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, minHeight: 24, flexWrap: "wrap" }}>
        <div className="v-label">Leaderboard</div>
        <div className="row" style={{ gap: 6 }}>
          <Select value={metric} onValueChange={(m) => onMetricChange(m as LeaderboardMetric)}>
            <SelectTrigger aria-label="Metric" style={{ height: 24, width: "auto", minWidth: 0, fontSize: 11, gap: 4, padding: "0 8px" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(METRIC_LABEL) as LeaderboardMetric[]).map((m) => (
                <SelectItem key={m} value={m} style={{ fontSize: 12 }}>
                  {METRIC_LABEL[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showExercise && (
            <Select value={selectedExercise} onValueChange={onExerciseChange}>
              <SelectTrigger aria-label="Exercise" style={{ height: 24, width: "auto", minWidth: 0, maxWidth: 130, fontSize: 11, gap: 4, padding: "0 8px" }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {exercises.map((ex) => (
                  <SelectItem key={ex} value={ex} style={{ fontSize: 12 }}>
                    {ex}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="v-meta" style={{ padding: "8px 0" }}>No data for this metric yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {visible.map((row, i) => {
            const rankColor = RANK_COLOR[i + 1];
            return (
              <button
                key={row.playerId}
                type="button"
                onClick={() => onRowClick?.(row.playerId)}
                className="row"
                style={{
                  position: "relative", justifyContent: "space-between", gap: 8, border: 0, background: "transparent",
                  padding: "6px 8px", cursor: onRowClick ? "pointer" : "default", font: "inherit",
                  textAlign: "left", borderTop: i === 0 ? undefined : "1px solid var(--line-1)", overflow: "hidden",
                }}
              >
                {rankColor && <RankRowDither color={rankColor} {...dither} />}
                <div className="row" style={{ gap: 8, minWidth: 0, position: "relative" }}>
                  <span
                    className="mono"
                    style={{
                      width: 16, textAlign: "right", fontSize: 11, fontWeight: rankColor ? 700 : 400,
                      color: rankColor ?? "var(--ink-3)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <Avatar name={row.name} color={rankColor} />
                  <span className="ellipsis" style={{ fontSize: 12.5, color: "var(--ink-0)" }}>{row.name}</span>
                  {!!row.firstPlaceCount && (
                    <span className="row" style={{ gap: 2, flexShrink: 0 }} title={`Ranked first in ${row.firstPlaceCount} exercise${row.firstPlaceCount === 1 ? "" : "s"}`}>
                      <Star size={11} strokeWidth={0} fill="#D4AF37" />
                      <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-2)" }}>{row.firstPlaceCount}</span>
                    </span>
                  )}
                </div>
                {/* Padding on every value keeps the column aligned; only the top 3 get a filled rank-color pill so they read over the dither. */}
                <span
                  className="mono"
                  style={{
                    fontSize: 12.5, fontWeight: 600, color: "var(--ink-0)", flexShrink: 0, position: "relative",
                    padding: "2px 6px", borderRadius: 4, background: rankColor,
                  }}
                >
                  {formatValue(metric, row.value)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
