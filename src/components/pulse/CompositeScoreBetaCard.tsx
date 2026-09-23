import { useEffect, useId, useRef, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BetaBadge, MetricInfoTip } from "./BetaBadge";

/** Measures both dimensions, so the chart can stretch to fill whatever height the grid gives the card (not a fixed height). */
function useMeasuredSize<T extends HTMLElement>(fallback: { width: number; height: number }) {
  const ref = useRef<T>(null);
  const [size, setSize] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) =>
      setSize({ width: e.contentRect.width || fallback.width, height: e.contentRect.height || fallback.height })
    );
    ro.observe(ref.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { ref, ...size };
}

export interface CompositeScoreWeekPoint {
  label: string;
  strength: number;
  speed: number;
  total: number;
}

export interface CompositeScoreBetaCardProps {
  exercise: string;
  /** Every exercise the coach can pick from the header dropdown. */
  exercises: string[];
  onExerciseChange: (exercise: string) => void;
  /** Rolling window, oldest first (e.g. weekly over the baseline window). Last entry is "current". All-mock data — see BetaBadge. */
  weeks: CompositeScoreWeekPoint[];
}

type ScoreView = "current" | "trend";
type ScoreKey = "strength" | "speed" | "total";

const SERIES: Array<{ key: ScoreKey; label: string; color: string }> = [
  { key: "strength", label: "Strength", color: "#2563eb" },
  { key: "speed", label: "Speed", color: "#059669" },
  { key: "total", label: "Total perf.", color: "var(--brand)" },
];

const PL = 26, PR = 8, PT = 16, PB = 20;
/** Fade duration for the hover label and the dimmed lines, ms. */
const FADE_MS = 160;
const LABEL_W = 100;
const LABEL_H = 36;
const DIM_OPACITY = 0.15;

const signedPct = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return r === 0 ? "0%" : r > 0 ? `+${r.toFixed(1)}%` : `−${Math.abs(r).toFixed(1)}%`;
};

function ScoreRing({ label, value, color, size = 68 }: { label: string; value: number; color: string; size?: number }) {
  const thickness = Math.max(6, size * 0.12);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, value));
  const len = (filled / 100) * c;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-sunk)" strokeWidth={thickness} fill="none" />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={color} strokeWidth={thickness} fill="none"
            strokeDasharray={`${len} ${c - len}`} strokeLinecap="butt"
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="num" style={{ fontSize: Math.round(size * 0.235), fontWeight: 600, color: "var(--ink-0)" }}>{Math.round(value)}</span>
        </div>
      </div>
      <span className="v-meta ellipsis" style={{ fontSize: Math.max(10, Math.round(size * 0.147)), textAlign: "center", maxWidth: size + 12 }}>{label}</span>
    </div>
  );
}

/**
 * Group 7 — Composite scores. Per exercise, over the rolling baseline window (never blended
 * across exercises or team-wide, per METRIC_SPEC) — not per session, since day-level velocity
 * estimates are unreliable at that grain. Real blocker is a verified load-velocity profile, not
 * just Velocity + Power. Efficiency % is dropped here: no formula defined for it anywhere.
 * Two views: Current (this week's three scores as rings) and Over time (one line per score, one
 * point per week, toggled by a legend and hoverable for a value + week-over-week change tooltip —
 * same pattern as the shipped RangeOfMotionCard's displacement lines) — same underlying weekly
 * data, different read. Over time also supports drag-to-zoom, both axes: dragging mostly sideways
 * zooms the week range, mostly up/down zooms the score range, and a diagonal drag zooms both at
 * once from the same box. Reset returns to the full window on both axes. Zooming the week range
 * re-derives "vs prev week" against the new visible range's own previous point.
 */
export function CompositeScoreBetaCard({ exercise, exercises, onExerciseChange, weeks }: CompositeScoreBetaCardProps) {
  const [view, setView] = useState<ScoreView>("current");
  /** Series picked in the legend. Empty = nothing picked, every line at full opacity. */
  const [picked, setPicked] = useState<Set<ScoreKey>>(new Set());
  const [hover, setHover] = useState<{ key: ScoreKey; index: number } | null>(null);
  /** Indices into `weeks`, inclusive, of the zoomed-in range. null = showing every week. */
  const [zoomRange, setZoomRange] = useState<[number, number] | null>(null);
  /** [min, max] score values shown on the y-axis. null = the full 0-100 scale. */
  const [zoomYRange, setZoomYRange] = useState<[number, number] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragPx, setDragPx] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const clipId = useId();
  const { ref, width: w, height } = useMeasuredSize<HTMLDivElement>({ width: 400, height: 150 });
  const cW = Math.max(50, w - PL - PR);
  const cH = Math.max(30, height - PT - PB);
  const { ref: ringsRef, width: ringsW, height: ringsH } = useMeasuredSize<HTMLDivElement>({ width: 400, height: 150 });
  const RING_GAP = 24, RING_LABEL_H = 34;
  const ringSize = Math.max(60, Math.min(95, (ringsW - RING_GAP * 2) / 3, ringsH - RING_LABEL_H));
  const current = weeks[weeks.length - 1];
  const visible = zoomRange ? weeks.slice(zoomRange[0], zoomRange[1] + 1) : weeks;
  const [yMin, yMax] = zoomYRange ?? [0, 100];
  const yRange = yMax - yMin || 1;
  const toY = (v: number) => PT + cH - ((v - yMin) / yRange) * cH;

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.min(Math.max(e.clientX - rect.left, PL), PL + cW);
      const y = Math.min(Math.max(e.clientY - rect.top, PT), PT + cH);
      setDragPx((p) => (p ? { ...p, x2: x, y2: y } : p));
    };
    const onUp = () => {
      setDragging(false);
      setDragPx((p) => {
        if (p) {
          const xlo = Math.min(p.x1, p.x2), xhi = Math.max(p.x1, p.x2);
          const ylo = Math.min(p.y1, p.y2), yhi = Math.max(p.y1, p.y2);
          // Ignore near-zero drags on an axis (a click, or a drag that barely moved on that axis).
          if (xhi - xlo > 6) {
            const n = visible.length;
            const idxAt = (px: number) => Math.round(((px - PL) / cW) * (n - 1));
            let startIdx = Math.max(0, Math.min(n - 1, idxAt(xlo)));
            let endIdx = Math.max(0, Math.min(n - 1, idxAt(xhi)));
            if (endIdx - startIdx < 1) {
              // Too small a range to zoom into meaningfully: widen symmetrically around the drag point,
              // clamped to bounds (so the point stays centered instead of pinned to the left edge).
              const mid = (startIdx + endIdx) / 2;
              startIdx = Math.max(0, Math.floor(mid) - 1);
              endIdx = Math.min(n - 1, Math.ceil(mid) + 1);
              if (endIdx - startIdx < 1) {
                if (startIdx < n - 1) endIdx = startIdx + 1;
                else startIdx = endIdx - 1;
              }
            }
            const base = zoomRange ? zoomRange[0] : 0;
            setZoomRange([base + startIdx, base + endIdx]);
          }
          if (yhi - ylo > 6) {
            const valueAtY = (py: number) => yMax - ((py - PT) / cH) * yRange;
            let newMax = valueAtY(ylo);
            let newMin = valueAtY(yhi);
            if (newMax - newMin < 5) {
              // Too thin a band to read: widen around its center.
              const mid = (newMax + newMin) / 2;
              newMax = mid + 2.5;
              newMin = mid - 2.5;
            }
            setZoomYRange([Math.max(0, newMin), Math.min(100, newMax)]);
          }
        }
        return null;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, cW, cH, visible.length, zoomRange, yMin, yMax, yRange]);

  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0, height: "100%", boxSizing: "border-box" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div className="v-h2" style={{ color: "var(--ink-0)" }}>Composite score</div>
          <div className="v-meta" style={{ fontSize: 11 }}>{exercise} · weekly · rolling window</div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {exercises.length > 0 && (
            <Select value={exercise} onValueChange={onExerciseChange}>
              <SelectTrigger aria-label="Exercise" style={{ height: 24, width: "auto", minWidth: 0, fontSize: 11, gap: 4, padding: "0 8px" }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {exercises.map((ex) => (
                  <SelectItem key={ex} value={ex} style={{ fontSize: 12 }}>{ex}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={view} onValueChange={(v) => setView(v as ScoreView)}>
            <SelectTrigger aria-label="View" style={{ height: 24, width: "auto", minWidth: 0, fontSize: 11, gap: 4, padding: "0 8px" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current" style={{ fontSize: 12 }}>Current</SelectItem>
              <SelectItem value="trend" style={{ fontSize: 12 }}>Over time</SelectItem>
            </SelectContent>
          </Select>
          <span className="row" style={{ gap: 4 }}>
            <BetaBadge />
            <MetricInfoTip label="About composite score" text="Strength, speed, and total performance for one exercise, over a rolling weekly window." />
          </span>
        </div>
      </div>

      {weeks.length === 0 ? (
        <div className="v-meta" style={{ padding: "8px 0" }}>No weeks yet.</div>
      ) : view === "current" ? (
        <div ref={ringsRef} style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center" }}>
          <div className="row" style={{ gap: RING_GAP, justifyContent: "space-around", flexWrap: "wrap", width: "100%" }}>
            {SERIES.map((s) => (
              <ScoreRing key={s.key} label={s.label} value={current[s.key]} color={s.color} size={ringSize} />
            ))}
          </div>
        </div>
      ) : weeks.length < 2 ? (
        <div className="v-meta" style={{ padding: "8px 0" }}>Not enough weeks yet.</div>
      ) : (
        <>
          <div ref={ref} style={{ width: "100%", minWidth: 0, flex: 1, minHeight: 0, overflow: "hidden" }}>
            <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
              <defs>
                <clipPath id={clipId}>
                  <rect x={PL} y={PT} width={cW} height={cH} />
                </clipPath>
              </defs>
              {[yMin, (yMin + yMax) / 2, yMax].map((t, i) => (
                <g key={i}>
                  <line x1={PL} x2={PL + cW} y1={toY(t)} y2={toY(t)} stroke="var(--line-0)" strokeWidth="1" />
                  <text x={PL - 6} y={toY(t) + 3} textAnchor="end" fontSize="9" fontFamily="var(--font-mono)" fill="var(--ink-3)">{Math.round(t)}</text>
                </g>
              ))}
              {visible.map((wk, i) => (i % 2 === 0 || i === visible.length - 1) && (
                <text key={i} x={PL + (i / (visible.length - 1)) * cW} y={height - 6} textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="var(--ink-3)">
                  {wk.label}
                </text>
              ))}
              {/* Drag-to-zoom capture: sits under the data (painted first), so point hover circles on top still work. */}
              <rect
                x={PL} y={PT} width={cW} height={cH}
                fill="transparent"
                style={{ cursor: "crosshair", pointerEvents: "all" }}
                onMouseDown={(e) => {
                  const rect = svgRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  setDragging(true);
                  setDragPx({ x1: x, y1: y, x2: x, y2: y });
                }}
              />
              {dragging && dragPx && (
                <rect
                  x={Math.min(dragPx.x1, dragPx.x2)}
                  y={Math.min(dragPx.y1, dragPx.y2)}
                  width={Math.abs(dragPx.x2 - dragPx.x1)}
                  height={Math.abs(dragPx.y2 - dragPx.y1)}
                  fill="var(--brand)"
                  opacity="0.12"
                  stroke="var(--brand)"
                  strokeDasharray="3 3"
                  pointerEvents="none"
                />
              )}
              <g clipPath={`url(#${clipId})`}>
                {SERIES.map((s) => {
                  const toX = (i: number) => PL + (i / (visible.length - 1)) * cW;
                  const path = visible.map((wk, i) => (i ? "L" : "M") + toX(i) + "," + toY(wk[s.key])).join(" ");
                  // Hovering a point wins; otherwise lines outside the legend selection fade.
                  const dimmed = hover != null ? hover.key !== s.key : picked.size > 0 && !picked.has(s.key);
                  return (
                    <g key={s.key} style={{ opacity: dimmed ? DIM_OPACITY : 1, transition: `opacity ${FADE_MS}ms ease` }}>
                      <path d={path} stroke={s.color} strokeWidth="1.8" fill="none" strokeLinejoin="round" strokeLinecap="round" />
                      {visible.map((wk, i) => (
                        <circle key={i} cx={toX(i)} cy={toY(wk[s.key])} r="3.5" fill={s.color} stroke="var(--surface-1)" strokeWidth="1.5" />
                      ))}
                    </g>
                  );
                })}
              </g>
              {SERIES.map((s) =>
                visible.map((wk, i) => {
                  const toX = (idx: number) => PL + (idx / (visible.length - 1)) * cW;
                  const active = hover?.key === s.key && hover.index === i;
                  const prev = i > 0 ? visible[i - 1] : null;
                  const change = prev ? ((wk[s.key] - prev[s.key]) / prev[s.key]) * 100 : null;
                  const cx = toX(i);
                  const cy = toY(wk[s.key]);
                  const lx = Math.min(Math.max(cx - LABEL_W / 2, 0), Math.max(0, w - LABEL_W));
                  const above = cy - LABEL_H - 10 >= 0;
                  const ly = above ? cy - LABEL_H - 10 : cy + 10;
                  return (
                    <g key={`${s.key}-${i}`}>
                      <g style={{ opacity: active ? 1 : 0, transition: `opacity ${FADE_MS}ms ease`, pointerEvents: "none" }}>
                        <rect x={lx} y={ly} width={LABEL_W} height={LABEL_H} rx="6" fill="var(--ink-0)" />
                        <text x={lx + LABEL_W / 2} y={ly + 14} textAnchor="middle" fontSize="11" fontWeight="600" fontFamily="var(--font-mono)" fill="#fff">
                          {s.label} {Math.round(wk[s.key])}
                        </text>
                        <text x={lx + LABEL_W / 2} y={ly + 28} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="#fff">
                          {change == null ? "first week" : `${signedPct(change)} vs prev wk`}
                        </text>
                      </g>
                      <circle
                        cx={cx}
                        cy={cy}
                        r="9"
                        fill="transparent"
                        tabIndex={0}
                        aria-label={`${s.label}, ${wk.label}, ${Math.round(wk[s.key])}`}
                        style={{ cursor: "pointer", outline: "none" }}
                        onMouseEnter={() => setHover({ key: s.key, index: i })}
                        onMouseLeave={() => setHover(null)}
                        onFocus={() => setHover({ key: s.key, index: i })}
                        onBlur={() => setHover(null)}
                      />
                    </g>
                  );
                }),
              )}
            </svg>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }} role="group" aria-label="Highlight scores">
            {SERIES.map((s) => {
              const on = picked.has(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  className="v-btn"
                  aria-pressed={on}
                  onClick={() =>
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (next.has(s.key)) next.delete(s.key);
                      else next.add(s.key);
                      // Every series picked is the same as none picked: clear.
                      return next.size === SERIES.length ? new Set() : next;
                    })
                  }
                  style={{
                    height: 26, padding: "0 9px", fontSize: 11.5, gap: 6,
                    background: on ? "var(--ink-0)" : "var(--surface-1)",
                    color: on ? "#fff" : "var(--ink-1)",
                    borderColor: on ? "var(--ink-0)" : "var(--line-1)",
                  }}
                >
                  <span style={{ width: 12, height: 2.5, borderRadius: 2, background: s.color }} />
                  {s.label}
                </button>
              );
            })}
            {(zoomRange || zoomYRange) && (
              <button
                type="button"
                className="v-btn ghost"
                onClick={() => {
                  setZoomRange(null);
                  setZoomYRange(null);
                }}
                style={{ height: 26, padding: "0 9px", fontSize: 11.5 }}
              >
                Reset zoom
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
