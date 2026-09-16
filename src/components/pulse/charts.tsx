import { useState, useRef, useEffect } from "react";

/**
 * Athlete-page charts ported from the design reference (hand-rolled SVG,
 * token-driven, hover crosshairs). No chart library on purpose (Q10).
 */

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

function useMeasuredWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width || fallback));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [fallback]);
  return { ref, width };
}

// ─── 12-week velocity trend ──────────────────────────────────────────────────

export interface VelTrendPoint {
  label: string;
  v: number;
  /** Sessions contributing to the weekly average. */
  n: number;
}

interface VelocityTrendChartProps {
  data: VelTrendPoint[];
  /** Optional — draws a shaded target band + dashed bounds. Only pass a range
   *  that's actually true for every point on this line; a blended
   *  cross-exercise series (like the 12-week trend) has no single real target,
   *  so it should be omitted rather than filled with a placeholder range. */
  target?: [number, number];
  accent?: string;
  height?: number;
}

export function VelocityTrendChart({ data, target, accent = "var(--brand)", height = 220 }: VelocityTrendChartProps) {
  const { ref, width: w } = useMeasuredWidth<HTMLDivElement>(800);
  const [hover, setHover] = useState<number | null>(null);

  const PL = 36, PR = 24, PT = 16, PB = 28;
  const h = height;
  const cW = Math.max(50, w - PL - PR);
  const cH = h - PT - PB;
  if (data.length < 2) return <div ref={ref} className="v-meta" style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>Not enough sessions yet.</div>;

  const values = data.map((d) => d.v);
  const mn = Math.min(...values, ...(target ? [target[0]] : [])) - 0.05;
  const mx = Math.max(...values, ...(target ? [target[1]] : [])) + 0.05;
  const range = mx - mn || 0.1;

  const toX = (i: number) => PL + (i / (data.length - 1)) * cW;
  const toY = (v: number) => PT + cH - ((v - mn) / range) * cH;

  const path = data.map((d, i) => (i ? "L" : "M") + toX(i) + "," + toY(d.v)).join(" ");
  const area = path + ` L${toX(data.length - 1)},${PT + cH} L${toX(0)},${PT + cH} Z`;
  const ticks = [mn + range * 0.1, mn + range * 0.5, mn + range * 0.9].map((v) => +v.toFixed(2));

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const idx = Math.round(((px - PL) / cW) * (data.length - 1));
    setHover(idx >= 0 && idx < data.length ? idx : null);
  };

  return (
    <div ref={ref} style={{ position: "relative", width: "100%", minWidth: 0, overflow: "hidden" }}>
      <svg width={w} height={h} onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ cursor: "crosshair", display: "block" }}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PL} x2={PL + cW} y1={toY(t)} y2={toY(t)} stroke="var(--line-0)" strokeWidth="1" />
            <text x={PL - 8} y={toY(t) + 3} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--ink-3)">{t.toFixed(2)}</text>
          </g>
        ))}
        {target && (
          <>
            <rect x={PL} y={toY(target[1])} width={cW} height={toY(target[0]) - toY(target[1])} fill={accent} opacity="0.08" />
            <line x1={PL} x2={PL + cW} y1={toY(target[1])} y2={toY(target[1])} stroke={accent} strokeDasharray="3 3" strokeWidth="0.8" opacity="0.5" />
            <line x1={PL} x2={PL + cW} y1={toY(target[0])} y2={toY(target[0])} stroke={accent} strokeDasharray="3 3" strokeWidth="0.8" opacity="0.5" />
            <text x={PL + cW - 4} y={toY(target[1]) - 4} textAnchor="end" fontSize="9.5" fontFamily="var(--font-mono)" fill={accent}>target band</text>
          </>
        )}

        <path d={area} fill={accent} fillOpacity="0.12" />
        <path d={path} stroke={accent} strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />

        {data.map((d, i) => (
          <circle key={i} cx={toX(i)} cy={toY(d.v)} r={hover === i ? 4 : 2.5} fill={accent} stroke="var(--surface-1)" strokeWidth="1.5" />
        ))}

        {data.map((d, i) => (i % 2 === 0 || i === data.length - 1) && (
          <text key={i} x={toX(i)} y={h - 8} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--ink-3)">{d.label}</text>
        ))}

        {hover != null && (
          <line x1={toX(hover)} x2={toX(hover)} y1={PT} y2={PT + cH} stroke="var(--ink-2)" strokeWidth="0.8" strokeDasharray="2 2" />
        )}
      </svg>

      {hover != null && (
        <div
          style={{
            position: "absolute",
            left: Math.min(Math.max(toX(hover) - 80, 0), w - 170),
            top: Math.max(toY(data[hover].v) - 70, 4),
            background: "var(--ink-0)", color: "white",
            padding: "8px 10px", borderRadius: 8, fontSize: 11.5, fontFamily: "var(--font-mono)",
            boxShadow: "0 8px 20px rgba(7,16,31,0.25)",
            pointerEvents: "none", minWidth: 140,
          }}
        >
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{data[hover].label}</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span>Velocity</span>
            <span style={{ fontWeight: 600 }}>{data[hover].v.toFixed(2)} m/s</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "rgba(255,255,255,0.6)" }}>Sessions</span>
            <span>{data[hover].n}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Load–velocity scatter ───────────────────────────────────────────────────

export interface FVPoint {
  exercise: string;
  /** Absolute load (weight) in the athlete's unit — the design's %1RM axis
      isn't derivable without 1RM data. */
  load: number;
  vel: number;
  recent: boolean;
}

interface ForceVelocityChartProps {
  data: FVPoint[];
  unitLabel?: string;
  accent?: string;
  height?: number;
}

export function ForceVelocityChart({ data, unitLabel = "load", accent = "var(--brand)", height = 220 }: ForceVelocityChartProps) {
  const { ref, width: w } = useMeasuredWidth<HTMLDivElement>(600);
  const [hover, setHover] = useState<number | null>(null);

  const PL = 40, PR = 16, PT = 16, PB = 32;
  const h = height;
  const cW = Math.max(50, w - PL - PR);
  const cH = h - PT - PB;
  if (data.length === 0) return <div ref={ref} className="v-meta" style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>No sets with load + velocity yet.</div>;

  const loads = data.map((d) => d.load);
  const vels = data.map((d) => d.vel);
  const mnX = Math.min(...loads) * 0.9;
  const mxX = Math.max(...loads) * 1.05 || 1;
  const mnY = Math.max(0, Math.min(...vels) - 0.1);
  const mxY = Math.max(...vels) + 0.1;
  const toX = (x: number) => PL + ((x - mnX) / (mxX - mnX || 1)) * cW;
  const toY = (y: number) => PT + cH - ((y - mnY) / (mxY - mnY || 1)) * cH;

  // Least-squares load–velocity regression (the design used a hardcoded theoretical line)
  let lvPath = "";
  if (data.length >= 4) {
    const n = data.length;
    const sx = loads.reduce((s, x) => s + x, 0);
    const sy = vels.reduce((s, y) => s + y, 0);
    const sxy = data.reduce((s, d) => s + d.load * d.vel, 0);
    const sxx = loads.reduce((s, x) => s + x * x, 0);
    const denom = n * sxx - sx * sx;
    if (denom !== 0) {
      const b = (n * sxy - sx * sy) / denom;
      const a = (sy - b * sx) / n;
      const pts: Array<[number, number]> = [];
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const x = mnX + ((mxX - mnX) * i) / steps;
        const yv = a + b * x;
        if (yv > mnY && yv < mxY) pts.push([toX(x), toY(yv)]);
      }
      lvPath = pts.map((p, i) => (i ? "L" : "M") + p[0] + "," + p[1]).join(" ");
    }
  }

  const yTicks = [0.25, 0.5, 0.75].map((f) => +(mnY + (mxY - mnY) * f).toFixed(2));
  const xTicks = [0.2, 0.5, 0.8].map((f) => Math.round(mnX + (mxX - mnX) * f));

  return (
    <div ref={ref} style={{ position: "relative", width: "100%", minWidth: 0, overflow: "hidden" }}>
      <svg width={w} height={h} style={{ display: "block" }}>
        {yTicks.map((y) => (
          <g key={y}>
            <line x1={PL} x2={PL + cW} y1={toY(y)} y2={toY(y)} stroke="var(--line-0)" />
            <text x={PL - 8} y={toY(y) + 3} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--ink-3)">{y.toFixed(2)}</text>
          </g>
        ))}
        {xTicks.map((x) => (
          <text key={x} x={toX(x)} y={h - 14} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--ink-3)">{x}</text>
        ))}
        <text x={PL - 28} y={PT + cH / 2} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--ink-3)" transform={`rotate(-90, ${PL - 28}, ${PT + cH / 2})`}>velocity m/s</text>
        <text x={PL + cW / 2} y={h - 2} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--ink-3)">{unitLabel}</text>

        {lvPath && <path d={lvPath} stroke={accent} strokeWidth="1.4" strokeDasharray="3 3" fill="none" opacity="0.5" />}

        {data.map((d, i) => (
          <circle
            key={i}
            cx={toX(d.load)}
            cy={toY(d.vel)}
            r={hover === i ? 7 : 5}
            fill={accent}
            fillOpacity={d.recent ? 0.95 : 0.35}
            stroke="var(--surface-1)"
            strokeWidth="1.5"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>

      {hover != null && (
        <div
          style={{
            position: "absolute",
            left: Math.min(toX(data[hover].load) + 10, w - 170),
            top: Math.max(toY(data[hover].vel) - 40, 4),
            background: "var(--ink-0)", color: "white",
            padding: "8px 10px", borderRadius: 8, fontSize: 11.5, fontFamily: "var(--font-mono)",
            boxShadow: "0 8px 20px rgba(7,16,31,0.25)",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontWeight: 600 }}>{data[hover].exercise}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
            <span>{data[hover].load} {unitLabel}</span>
            <span>{data[hover].vel.toFixed(2)} m/s</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Rep-by-rep fatigue trace ────────────────────────────────────────────────

export interface RepTracePoint {
  set: number;
  rep: number;
  vel: number;
  /** This rep's own logged load — omitted (undefined) when not recorded. */
  weight?: number;
}

interface RepTraceChartProps {
  reps: RepTracePoint[];
  /** Real coach-set target range for this exercise instance, or null when
   *  none was assigned — draw no line/band, and color bars neutrally, rather
   *  than guessing or implying a target exists. */
  target?: { min: number; max: number } | null;
  weightUnit?: string;
  accent?: string;
  /** Total chart height (one continuous trace, not stacked per-set rows). */
  height?: number;
}

/** "Nice" round tick step (0.1/0.2/0.25/0.5 m/s-scale, not raw-data-derived). */
function niceStep(rawStep: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep || 0.01)));
  const norm = rawStep / mag;
  const mult = norm >= 5 ? 5 : norm >= 2 ? 2 : 1;
  return mult * mag;
}

function niceTicks(min: number, max: number, targetCount = 5): number[] {
  const range = max - min || 0.2;
  const step = niceStep(range / targetCount);
  const start = Math.max(0, Math.floor(min / step) * step);
  const ticks: number[] = [];
  for (let t = start; t <= max + step * 0.5; t += step) ticks.push(+t.toFixed(2));
  return ticks;
}

/**
 * One continuous rep-by-rep trace for the whole exercise — a single shared
 * y-axis (velocity) and one set of gridlines, with sets shown as labeled
 * groups along the x-axis rather than N disconnected mini-charts each
 * repeating their own axis/chrome. Bars are colored by target status
 * (in-zone / outside zone) only when a real coach-set target exists for this
 * exercise instance; with no target, every bar is one neutral color so the
 * chart never implies a target that isn't there.
 */
export function RepTraceChart({ reps, target, weightUnit, accent = "var(--brand)", height = 200 }: RepTraceChartProps) {
  const { ref, width: w } = useMeasuredWidth<HTMLDivElement>(400);
  const [hover, setHover] = useState<{ set: number; idx: number } | null>(null);
  if (reps.length === 0) return <div ref={ref} style={{ height }} />;

  const tgt = target ?? null;
  const vels = reps.map((r) => r.vel);
  const rawMn = Math.min(...vels, tgt != null ? tgt.min : Infinity);
  const rawMx = Math.max(...vels, tgt != null ? tgt.max : -Infinity);
  const ticks = niceTicks(rawMn - 0.05, rawMx + 0.05);
  const mn = ticks[0];
  const mx = ticks[ticks.length - 1];
  const range = mx - mn || 0.2;

  const setOrder: number[] = [];
  const bySet = new Map<number, RepTracePoint[]>();
  for (const r of reps) {
    if (!bySet.has(r.set)) {
      bySet.set(r.set, []);
      setOrder.push(r.set);
    }
    bySet.get(r.set)!.push(r);
  }

  const PL = 36; // left axis label column
  const PT = 10, PB = 8;
  const LABEL_H = 30; // set number + weight caption, below the chart
  const GAP = 18; // px between set groups
  const cW = Math.max(60, w - PL);
  const cH = Math.max(40, height - PT - PB - LABEL_H);
  const MIN_BAR_H = 3;

  const totalReps = reps.length;
  const totalGaps = Math.max(0, setOrder.length - 1) * GAP;
  const slot = Math.max(2, (cW - totalGaps) / totalReps);
  const bw = Math.max(2, slot * 0.6);

  interface SetLayout { setNum: number; reps: RepTracePoint[]; xStart: number; xCenter: number; weightLabel: string }
  const layout: SetLayout[] = [];
  let cursor = PL;
  for (const setNum of setOrder) {
    const setReps = bySet.get(setNum)!;
    const groupW = setReps.length * slot;
    const weights = setReps.map((r) => r.weight).filter((v): v is number => v != null && v > 0);
    const weightLabel = weights.length ? `${Math.round(mean(weights))} ${weightUnit ?? "lbs"}` : "no load logged";
    layout.push({ setNum, reps: setReps, xStart: cursor, xCenter: cursor + groupW / 2, weightLabel });
    cursor += groupW + GAP;
  }

  const yFor = (v: number) => PT + cH - ((v - mn) / range) * cH;
  const targetYMin = tgt != null ? yFor(tgt.min) : null;
  const targetYMax = tgt != null ? yFor(tgt.max) : null;

  const hoveredSet = hover != null ? layout.find((s) => s.setNum === hover.set) : null;
  const hoveredRep = hoveredSet ? hoveredSet.reps[hover!.idx] : null;
  const hoveredX = hoveredSet ? hoveredSet.xStart + hover!.idx * slot + slot / 2 : 0;

  return (
    // No overflow:hidden here — the hover tooltip intentionally pops up above the chart.
    <div ref={ref} style={{ width: "100%", minWidth: 0, position: "relative" }}>
      {tgt != null && (
        <div className="row" style={{ justifyContent: "flex-end", marginBottom: 4 }}>
          <span className="mono" style={{ fontSize: 9.5, color: accent }}>target {tgt.min.toFixed(2)}–{tgt.max.toFixed(2)} m/s</span>
        </div>
      )}
      <svg width={w} height={height} style={{ display: "block", overflow: "visible" }}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PL} x2={PL + cW} y1={yFor(t)} y2={yFor(t)} stroke="var(--line-0)" strokeWidth="1" />
            <text x={PL - 8} y={yFor(t) + 3} textAnchor="end" fontSize="9" fontFamily="var(--font-mono)" fill="var(--ink-3)">
              {t.toFixed(2)}
            </text>
          </g>
        ))}
        {targetYMin != null && targetYMax != null && (
          <>
            <rect x={PL} y={targetYMax} width={cW} height={targetYMin - targetYMax} fill={accent} opacity="0.08" />
            <line x1={PL} x2={PL + cW} y1={targetYMin} y2={targetYMin} stroke={accent} strokeWidth="0.8" strokeDasharray="3 3" opacity="0.6" />
            <line x1={PL} x2={PL + cW} y1={targetYMax} y2={targetYMax} stroke={accent} strokeWidth="0.8" strokeDasharray="3 3" opacity="0.6" />
          </>
        )}
        <line x1={PL} x2={PL + cW} y1={PT + cH} y2={PT + cH} stroke="var(--line-2)" strokeWidth="1.2" />

        {layout.map((s, si) => (
          <g key={s.setNum}>
            {si > 0 && (
              <line
                x1={s.xStart - GAP / 2} x2={s.xStart - GAP / 2}
                y1={PT} y2={PT + cH}
                stroke="var(--line-0)" strokeWidth="1" strokeDasharray="2 3"
              />
            )}
            {s.reps.map((r, i) => {
              const x = s.xStart + i * slot + (slot - bw) / 2;
              const barH = Math.max(MIN_BAR_H, ((r.vel - mn) / range) * cH);
              const yv = PT + cH - barH;
              const isHover = hover?.set === s.setNum && hover.idx === i;
              const outOfRange = tgt != null && (r.vel < tgt.min || r.vel > tgt.max);
              // In-zone/outside-zone uses the same good/warn semantic colors as
              // the rest of the app; no target at all → one neutral color, never
              // implying a target exists when it doesn't.
              const tone = tgt == null ? "var(--ink-3)" : outOfRange ? "var(--warn)" : "var(--good)";
              return (
                <rect
                  key={i}
                  x={x} y={yv} width={bw} height={barH} rx="1.5"
                  fill={tone}
                  fillOpacity={isHover ? 1 : 0.85}
                  stroke={isHover ? tone : "none"}
                  strokeWidth={isHover ? 1.5 : 0}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHover({ set: s.setNum, idx: i })}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}
            <text x={s.xCenter} y={PT + cH + 14} textAnchor="middle" fontSize="9.5" fontFamily="var(--font-mono)" fill="var(--ink-2)">
              Set {s.setNum}
            </text>
            <text x={s.xCenter} y={PT + cH + 25} textAnchor="middle" fontSize="8.5" fontFamily="var(--font-mono)" fill="var(--ink-3)">
              {s.weightLabel}
            </text>
          </g>
        ))}
      </svg>

      {hoveredRep && (
        <div
          style={{
            position: "absolute",
            left: Math.min(Math.max(hoveredX, 70), w - 70),
            top: Math.max(yFor(hoveredRep.vel) - 60, 4),
            transform: "translate(-50%, 0)",
            background: "var(--ink-0)", color: "white",
            padding: "6px 9px", borderRadius: 7, fontSize: 11, fontFamily: "var(--font-mono)",
            boxShadow: "0 8px 20px rgba(7,16,31,0.25)",
            pointerEvents: "none", whiteSpace: "nowrap", zIndex: 1,
          }}
        >
          <div style={{ fontWeight: 600 }}>Rep {hoveredRep.rep} · {hoveredRep.vel.toFixed(2)} m/s</div>
          {tgt != null && (
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 10 }}>
              {hoveredRep.vel < tgt.min ? "below target" : hoveredRep.vel > tgt.max ? "above target" : "in target"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Weekly load bars ────────────────────────────────────────────────────────

export interface WeeklyLoadPoint {
  label: string;
  v: number;
}

interface WeeklyLoadChartProps {
  data: WeeklyLoadPoint[];
  target?: number;
  height?: number;
  accent?: string;
}

export function WeeklyLoadChart({ data, target = 4, accent = "var(--brand)", height = 130 }: WeeklyLoadChartProps) {
  const { ref, width: w } = useMeasuredWidth<HTMLDivElement>(400);

  const PL = 28, PR = 12, PT = 14, PB = 24;
  const h = height;
  const cW = w - PL - PR;
  const cH = h - PT - PB;
  if (data.length === 0) return <div ref={ref} style={{ height }} />;
  const mx = Math.max(...data.map((d) => d.v), target + 1);
  const step = cW / data.length;
  const bw = step * 0.6;

  return (
    <div ref={ref} style={{ width: "100%", minWidth: 0, overflow: "hidden" }}>
      <svg width={w} height={h} style={{ display: "block" }}>
        <line
          x1={PL} x2={PL + cW}
          y1={PT + cH - (target / mx) * cH}
          y2={PT + cH - (target / mx) * cH}
          stroke={accent} strokeWidth="1" strokeDasharray="3 3" opacity="0.6"
        />
        <text x={PL + cW - 4} y={PT + cH - (target / mx) * cH - 4} textAnchor="end" fontSize="9.5" fontFamily="var(--font-mono)" fill={accent}>
          target {target}
        </text>
        {data.map((d, i) => {
          const x = PL + i * step + (step - bw) / 2;
          const yv = PT + cH - (d.v / mx) * cH;
          return (
            <g key={i}>
              <rect x={x} y={yv} width={bw} height={PT + cH - yv} rx="2" fill="var(--ink-0)" opacity={d.v >= target ? 0.85 : 0.55} />
              <text x={x + bw / 2} y={yv - 4} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--ink-2)">{d.v}</text>
              <text x={x + bw / 2} y={h - 6} textAnchor="middle" fontSize="9.5" fontFamily="var(--font-mono)" fill="var(--ink-3)">{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Per-exercise velocity range bars ────────────────────────────────────────

export interface ExerciseRangeRow {
  name: string;
  min: number;
  max: number;
  avg: number;
  sessions: number;
}

interface ExerciseRangeChartProps {
  data: ExerciseRangeRow[];
  accent?: string;
}

export function ExerciseRangeChart({ data, accent = "var(--brand)" }: ExerciseRangeChartProps) {
  if (data.length === 0) {
    return <div className="v-meta">No exercise data in this window yet.</div>;
  }
  const min = Math.min(...data.map((d) => d.min));
  const max = Math.max(...data.map((d) => d.max));
  const range = max - min || 0.1;
  const toPct = (v: number) => ((v - min) / range) * 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map((d) => (
        <div key={d.name} className="row" style={{ gap: 10 }}>
          <div className="ellipsis" style={{ width: 110, fontSize: 12, color: "var(--ink-1)" }}>{d.name}</div>
          <div style={{ flex: 1, position: "relative", height: 14, background: "var(--surface-sunk)", borderRadius: 4 }}>
            <div
              style={{
                position: "absolute", left: toPct(d.min) + "%", width: toPct(d.max) - toPct(d.min) + "%",
                top: 0, bottom: 0, background: accent, opacity: 0.25, borderRadius: 4,
              }}
            />
            <div style={{ position: "absolute", left: `calc(${toPct(d.avg)}% - 1px)`, top: -2, bottom: -2, width: 2, background: accent, borderRadius: 1 }} />
          </div>
          <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-0)", width: 50, textAlign: "right" }}>{d.avg.toFixed(2)}</div>
          <div className="mono v-mute2" style={{ fontSize: 10.5, width: 60, textAlign: "right" }}>{d.sessions}× ses</div>
        </div>
      ))}
    </div>
  );
}
