import { useState } from "react";
import { useMeasuredSize } from "@/hooks/useMeasuredSize";

/**
 * Athlete-page charts ported from the design reference (hand-rolled SVG,
 * token-driven, hover crosshairs). No chart library on purpose (Q10).
 */

export function useMeasuredWidth<T extends HTMLElement>(fallback: number) {
  const { ref, width } = useMeasuredSize<T>({ width: fallback, height: 0 });
  return { ref, width };
}

/** "Nice" round tick step (0.1/0.2/0.25/0.5 m/s-scale, not raw-data-derived). */
function niceStep(rawStep: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep || 0.01)));
  const norm = rawStep / mag;
  const mult = norm >= 5 ? 5 : norm >= 2 ? 2 : 1;
  return mult * mag;
}

export function niceTicks(min: number, max: number, targetCount = 5): number[] {
  const range = max - min || 0.2;
  const step = niceStep(range / targetCount);
  const start = Math.max(0, Math.floor(min / step) * step);
  const ticks: number[] = [];
  for (let t = start; t <= max + step * 0.5; t += step) ticks.push(+t.toFixed(2));
  return ticks;
}

/** Distinct line colors, one per set, cycling if there are more sets than colors. */
export const SET_COLORS = [
  "#2563eb", // blue
  "#d97706", // amber
  "#7c3aed", // violet
  "#059669", // emerald
  "#db2777", // pink
  "#0891b2", // cyan
  "#b91c1c", // red
  "#4b5563", // slate
];


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
  /** Larger, darker labels (used by the SP-08 prototype). */
  legible?: boolean;
  /** Stretch to fill whatever height the parent gives it (measured), instead of the fixed `height` prop. Parent must give the chart's wrapper a real height (e.g. flex: 1 in a flex column). */
  fill?: boolean;
}

/** Right-hand room kept free for the target label, px. */
const TARGET_GUTTER = 64;

export function WeeklyLoadChart({ data, target = 4, accent = "var(--brand)", height = 130, legible = false, fill = false }: WeeklyLoadChartProps) {
  const { ref, width: w, height: measuredHeight } = useMeasuredSize<HTMLDivElement>({ width: 400, height });
  const h = fill ? measuredHeight : height;

  const PL = 28, PR = 12, PT = legible ? 18 : 14, PB = legible ? 28 : 24;
  const fs = legible ? "11.5" : undefined;
  const cW = w - PL - PR;
  const cH = Math.max(20, h - PT - PB);
  if (data.length === 0) return <div ref={ref} style={{ height: fill ? "100%" : height }} />;
  const mx = Math.max(...data.map((d) => d.v), target + 1);
  // Legible: bars pack to the left and leave a gutter so the "target" label clears the last bar.
  const step = (legible ? cW - TARGET_GUTTER : cW) / data.length;
  const bw = step * (legible ? 0.7 : 0.6);

  return (
    <div ref={ref} style={{ width: "100%", minWidth: 0, height: fill ? "100%" : undefined, overflow: "hidden" }}>
      <svg
        width={fill ? "100%" : w}
        height={fill ? "100%" : h}
        viewBox={fill ? `0 0 ${w} ${h}` : undefined}
        preserveAspectRatio={fill ? "none" : undefined}
        style={{ display: "block" }}
      >
        <line
          x1={PL} x2={PL + cW}
          y1={PT + cH - (target / mx) * cH}
          y2={PT + cH - (target / mx) * cH}
          stroke={accent} strokeWidth="1" strokeDasharray="3 3" opacity="0.6"
        />
        <text x={PL + cW - 4} y={PT + cH - (target / mx) * cH - 4} textAnchor="end" fontSize={fs ?? "9.5"} fontFamily="var(--font-mono)" fill={accent}>
          target {target}
        </text>
        {data.map((d, i) => {
          const x = PL + i * step + (step - bw) / 2;
          const yv = PT + cH - (d.v / mx) * cH;
          return (
            <g key={i}>
              <rect x={x} y={yv} width={bw} height={PT + cH - yv} rx="2" fill="var(--ink-0)" opacity={d.v >= target ? 0.85 : 0.55} />
              <text x={x + bw / 2} y={yv - 4} textAnchor="middle" fontSize={fs ?? "10"} fontFamily="var(--font-mono)" fill={legible ? "var(--ink-1)" : "var(--ink-2)"}>{d.v}</text>
              <text x={x + bw / 2} y={h - 6} textAnchor="middle" fontSize={fs ?? "9.5"} fontFamily="var(--font-mono)" fill={legible ? "var(--ink-1)" : "var(--ink-3)"}>{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
