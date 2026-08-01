import { useState, useRef, useEffect } from "react";

/**
 * Athlete-page charts ported from the design reference (hand-rolled SVG,
 * token-driven, hover crosshairs). No chart library on purpose (Q10).
 */

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
  target?: [number, number];
  accent?: string;
  height?: number;
}

export function VelocityTrendChart({ data, target = [0.55, 0.85], accent = "var(--brand)", height = 220 }: VelocityTrendChartProps) {
  const { ref, width: w } = useMeasuredWidth<HTMLDivElement>(800);
  const [hover, setHover] = useState<number | null>(null);

  const PL = 36, PR = 24, PT = 16, PB = 28;
  const h = height;
  const cW = Math.max(50, w - PL - PR);
  const cH = h - PT - PB;
  if (data.length < 2) return <div ref={ref} className="v-meta" style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>Not enough sessions yet.</div>;

  const values = data.map((d) => d.v);
  const mn = Math.min(...values, target[0]) - 0.05;
  const mx = Math.max(...values, target[1]) + 0.05;
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
        <rect x={PL} y={toY(target[1])} width={cW} height={toY(target[0]) - toY(target[1])} fill={accent} opacity="0.08" />
        <line x1={PL} x2={PL + cW} y1={toY(target[1])} y2={toY(target[1])} stroke={accent} strokeDasharray="3 3" strokeWidth="0.8" opacity="0.5" />
        <line x1={PL} x2={PL + cW} y1={toY(target[0])} y2={toY(target[0])} stroke={accent} strokeDasharray="3 3" strokeWidth="0.8" opacity="0.5" />
        <text x={PL + cW - 4} y={toY(target[1]) - 4} textAnchor="end" fontSize="9.5" fontFamily="var(--font-mono)" fill={accent}>target band</text>

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
}

interface RepTraceChartProps {
  reps: RepTracePoint[];
  target?: number | null;
  accent?: string;
  /** Height of a single set's bar row (rows stack vertically, one per set). */
  rowHeight?: number;
}

/**
 * One horizontal bar row per set, stacked top-to-bottom. All rows share a
 * single velocity scale (with gridlines + tick labels) so bar heights stay
 * comparable and readable across sets; hovering a bar shows its exact value.
 */
export function RepTraceChart({ reps, target, accent = "var(--brand)", rowHeight = 140 }: RepTraceChartProps) {
  const { ref, width: w } = useMeasuredWidth<HTMLDivElement>(400);
  const [hover, setHover] = useState<{ set: number; idx: number } | null>(null);
  if (reps.length === 0) return <div ref={ref} style={{ height: rowHeight }} />;

  const vels = reps.map((r) => r.vel);
  const tgt = target ?? null;
  const mn = Math.min(...vels, tgt != null ? tgt - 0.1 : Infinity) - 0.03;
  const mx = Math.max(...vels, tgt != null ? tgt + 0.1 : -Infinity) + 0.03;
  const range = mx - mn || 0.1;

  const setOrder: number[] = [];
  const bySet = new Map<number, RepTracePoint[]>();
  for (const r of reps) {
    if (!bySet.has(r.set)) {
      bySet.set(r.set, []);
      setOrder.push(r.set);
    }
    bySet.get(r.set)!.push(r);
  }

  const LABEL_W = 40;
  const AXIS_W = 32;
  const PT = 8, PB = 8;
  const cW = Math.max(40, w - LABEL_W - AXIS_W);
  const cH = rowHeight - PT - PB;
  const MIN_BAR_H = 3;

  const yFor = (v: number) => PT + cH - ((v - mn) / range) * cH;
  const ticks = [mn + range * 0.15, mn + range * 0.5, mn + range * 0.85];
  const targetY = tgt != null ? yFor(tgt) : null;

  return (
    // No overflow:hidden here — the hover tooltip intentionally pops up above its row.
    <div ref={ref} style={{ width: "100%", minWidth: 0 }}>
      {tgt != null && (
        <div className="row" style={{ justifyContent: "flex-end", marginBottom: 4 }}>
          <span className="mono" style={{ fontSize: 9.5, color: accent }}>target {tgt.toFixed(2)} m/s</span>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {setOrder.map((setNum) => {
          const setReps = bySet.get(setNum)!;
          const bw = (cW / setReps.length) * 0.6;
          const step = cW / setReps.length;
          const hoveredRep = hover?.set === setNum ? setReps[hover.idx] : null;
          return (
            <div key={setNum} className="row" style={{ gap: 0, alignItems: "center", position: "relative" }}>
              <span className="mono v-mute2" style={{ width: LABEL_W, flexShrink: 0, fontSize: 9.5 }}>Set {setNum}</span>
              <svg width={AXIS_W + cW} height={rowHeight} style={{ display: "block", flexShrink: 0, overflow: "visible" }}>
                {ticks.map((t, i) => (
                  <g key={i}>
                    <line x1={AXIS_W} x2={AXIS_W + cW} y1={yFor(t)} y2={yFor(t)} stroke="var(--line-0)" strokeWidth="1" />
                    <text x={AXIS_W - 6} y={yFor(t) + 3} textAnchor="end" fontSize="9" fontFamily="var(--font-mono)" fill="var(--ink-3)">
                      {t.toFixed(2)}
                    </text>
                  </g>
                ))}
                {targetY != null && (
                  <line x1={AXIS_W} x2={AXIS_W + cW} y1={targetY} y2={targetY} stroke={accent} strokeWidth="0.8" strokeDasharray="3 3" opacity="0.6" />
                )}
                <line x1={AXIS_W} x2={AXIS_W + cW} y1={PT + cH} y2={PT + cH} stroke="var(--line-2)" strokeWidth="1.2" />
                {setReps.map((r, i) => {
                  const x = AXIS_W + i * step + (step - bw) / 2;
                  const barH = Math.max(MIN_BAR_H, ((r.vel - mn) / range) * cH);
                  const yv = PT + cH - barH;
                  const isHover = hover?.set === setNum && hover.idx === i;
                  const belowTarget = tgt != null && r.vel < tgt - 0.05;
                  const tone = belowTarget ? "var(--warn)" : accent;
                  return (
                    <rect
                      key={i}
                      x={x} y={yv} width={bw} height={barH} rx="1.5"
                      fill={tone}
                      fillOpacity={isHover ? 1 : 0.85}
                      stroke={isHover ? tone : "none"}
                      strokeWidth={isHover ? 1.5 : 0}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={() => setHover({ set: setNum, idx: i })}
                      onMouseLeave={() => setHover(null)}
                    />
                  );
                })}
              </svg>
              {hoveredRep && (
                <div
                  style={{
                    position: "absolute",
                    left: LABEL_W + AXIS_W + hover!.idx * step + step / 2,
                    top: -6,
                    transform: "translate(-50%, -100%)",
                    background: "var(--ink-0)", color: "white",
                    padding: "6px 9px", borderRadius: 7, fontSize: 11, fontFamily: "var(--font-mono)",
                    boxShadow: "0 8px 20px rgba(7,16,31,0.25)",
                    pointerEvents: "none", whiteSpace: "nowrap", zIndex: 1,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>Rep {hoveredRep.rep} · {hoveredRep.vel.toFixed(2)} m/s</div>
                  {tgt != null && (
                    <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 10 }}>
                      {hoveredRep.vel >= tgt ? "at or above" : "below"} target
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
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
