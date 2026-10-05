import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BetaBadge, MetricInfoTip } from "./BetaBadge";
import { useMeasuredSize } from "@/hooks/useMeasuredSize";
import { useUnits } from "@/contexts/UnitsContext";
import { convertWeightLbs } from "@/lib/units";
import type { UnitSystem } from "./UnitsSelector";

const M_PER_FT = 0.3048;

export interface WeeklyLoadVolumePoint {
  label: string;
  tonnageLbs: number;
  totalWorkKj: number;
  distanceM: number;
}

export type LoadVolumeMetric = "tonnageLbs" | "totalWorkKj" | "distanceM";

export const METRIC_LABEL: Record<LoadVolumeMetric, string> = {
  tonnageLbs: "Tonnage",
  totalWorkKj: "Total work",
  distanceM: "Bar distance",
};
export const unitFor = (metric: LoadVolumeMetric, distSystem: UnitSystem, weightSystem: UnitSystem): string =>
  metric === "distanceM" ? (distSystem === "imperial" ? "ft" : "m") : metric === "tonnageLbs" ? (weightSystem === "metric" ? "kg" : "lbs") : "kJ";
export const fmtLoadVolumeVal = (metric: LoadVolumeMetric, v: number, distSystem: UnitSystem, weightSystem: UnitSystem) => {
  if (metric === "tonnageLbs") {
    const c = convertWeightLbs(v, weightSystem);
    return c >= 1000 ? `${(c / 1000).toFixed(1)}k` : `${Math.round(c)}`;
  }
  if (metric === "distanceM") return `${Math.round(distSystem === "imperial" ? v / M_PER_FT : v)}`;
  return v.toFixed(1);
};

export interface WeeklyLoadVolumeBetaCardProps {
  athleteName: string;
  /** 8 weeks, oldest first, across every exercise (not blended per-exercise — same aggregate scope as the shipped weekly panels). All-mock data — see BetaBadge. */
  weeks: WeeklyLoadVolumePoint[];
  coveragePct: number;
}

const PL = 8, PR = 8, PT = 18, PB = 20;

/**
 * Group 3 (Load & volume) merged with group 5's cumulative distance, per Opus's review: e1RM is
 * dropped here (already real on LoadVelocityProfileCard, per exercise); Tonnage, Total work and Bar
 * distance are all weekly totals, so they share one weekly bar chart with a metric picker, same
 * shape as the shipped WeeklyVolumePanel (home, team-wide) but scoped to one athlete's Performance
 * tab, all exercises combined. Total work uses weight x g x displacement, computable today; only the
 * extra work from bar acceleration needs Power's waveform.
 */
export function WeeklyLoadVolumeBetaCard({ athleteName, weeks, coveragePct }: WeeklyLoadVolumeBetaCardProps) {
  const [metric, setMetric] = useState<LoadVolumeMetric>("tonnageLbs");
  const { prefs } = useUnits();
  const { ref, width: w, height: h } = useMeasuredSize<HTMLDivElement>({ width: 400, height: 130 });
  const cW = Math.max(50, w - PL - PR);
  const cH = Math.max(30, h - PT - PB);
  const mx = Math.max(1, ...weeks.map((d) => d[metric]));
  const step = weeks.length ? cW / weeks.length : cW;
  const bw = step * 0.6;

  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0, height: "100%" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div className="v-h2" style={{ color: "var(--ink-0)" }}>Load &amp; volume</div>
          <div className="v-meta" style={{ fontSize: 11 }}>{athleteName} · 8 weeks · every exercise</div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <Select value={metric} onValueChange={(m) => setMetric(m as LoadVolumeMetric)}>
            <SelectTrigger aria-label="Metric" style={{ height: 24, width: "auto", minWidth: 0, fontSize: 11, gap: 4, padding: "0 8px" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(METRIC_LABEL) as LoadVolumeMetric[]).map((m) => (
                <SelectItem key={m} value={m} style={{ fontSize: 12 }}>{METRIC_LABEL[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="row" style={{ gap: 4 }}>
            <BetaBadge />
            <MetricInfoTip label="About load & volume" text="Weekly tonnage, total work, and bar distance for this athlete, across every exercise." />
          </span>
        </div>
      </div>

      {weeks.length === 0 ? (
        <div className="v-meta" style={{ padding: "8px 0" }}>No weight-recorded reps in the last 8 weeks.</div>
      ) : (
        <>
          <div ref={ref} style={{ width: "100%", minWidth: 0, flex: 1, minHeight: 0, overflow: "hidden" }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
              {weeks.map((d, i) => {
                const x = PL + i * step + (step - bw) / 2;
                const barH = mx > 0 ? (d[metric] / mx) * cH : 0;
                const y = PT + cH - barH;
                return (
                  <g key={i}>
                    <rect x={x} y={y} width={bw} height={barH} rx="2" fill="var(--brand)" opacity="0.85" />
                    <text x={x + bw / 2} y={y - 4} textAnchor="middle" fontSize="9.5" fontFamily="var(--font-mono)" fill="var(--ink-2)">
                      {fmtLoadVolumeVal(metric, d[metric], prefs.distance, prefs.weight)}
                    </text>
                    <text x={x + bw / 2} y={h - 6} textAnchor="middle" fontSize="9.5" fontFamily="var(--font-mono)" fill="var(--ink-3)">
                      {d.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="v-meta" style={{ fontSize: 10.5 }} title="Only reps with a recorded weight count toward these totals; unit not verified.">
            {unitFor(metric, prefs.distance, prefs.weight)} · based on {coveragePct.toFixed(0)}% of reps with a recorded weight
          </div>
        </>
      )}
    </div>
  );
}
