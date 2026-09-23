import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BetaBadge, MetricInfoTip } from "./BetaBadge";

export type VelocityVariable = "mean" | "peak" | "eccMean" | "propulsive" | "at100ms";

const VARIABLE_LABEL: Record<VelocityVariable, string> = {
  mean: "Mean",
  peak: "Peak",
  eccMean: "Eccentric mean",
  propulsive: "Propulsive",
  at100ms: "At 100ms",
};
const VARIABLE_COLOR: Record<VelocityVariable, string> = {
  mean: "var(--brand)",
  peak: "#2563eb",
  eccMean: "#7c3aed",
  propulsive: "#059669",
  at100ms: "#db2777",
};

export interface VelocitySetPoint {
  set: number;
  values: Record<VelocityVariable, number>;
}

export interface VelocityBetaCardProps {
  exercise: string;
  sessionDate: string;
  /** One exercise's sets, oldest first. All-mock data — see BetaBadge. */
  sets: VelocitySetPoint[];
}

const BAR_AREA = 110, HEADROOM = 22, BAR_W = 34;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Group 1 — Velocity. Same grain and x-axis as the shipped SetVelocityBars (per set, within one
 * exercise, one session): this previews adding a variable picker to that card rather than
 * plotting all 5 variables on one axis, which mixes incompatible scales (peak vs. eccentric).
 * Mean is already real there; the other 4 need a per-rep waveform we don't capture.
 */
export function VelocityBetaCard({ exercise, sessionDate, sets }: VelocityBetaCardProps) {
  const [variable, setVariable] = useState<VelocityVariable>("mean");
  const color = VARIABLE_COLOR[variable];
  const max = Math.max(0.1, ...sets.map((s) => s.values[variable]));
  const px = (v: number) => Math.max(2, (v / (max * 1.1)) * BAR_AREA);

  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div className="v-h2" style={{ color: "var(--ink-0)" }}>{exercise}</div>
          <div className="v-meta" style={{ fontSize: 11 }}>{fmtDate(sessionDate)} · per set</div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <Select value={variable} onValueChange={(v) => setVariable(v as VelocityVariable)}>
            <SelectTrigger aria-label="Velocity variable" style={{ height: 24, width: "auto", minWidth: 0, fontSize: 11, gap: 4, padding: "0 8px" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(VARIABLE_LABEL) as VelocityVariable[]).map((v) => (
                <SelectItem key={v} value={v} style={{ fontSize: 12 }}>{VARIABLE_LABEL[v]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="row" style={{ gap: 4 }}>
            <BetaBadge />
            <MetricInfoTip label="About velocity variables" text="Per-set bar speed by variable: mean, peak, eccentric mean, propulsive, or speed at 100ms into the rep." />
          </span>
        </div>
      </div>

      {sets.length === 0 ? (
        <div className="v-meta" style={{ padding: "8px 0" }}>No sets in this session.</div>
      ) : (
        <div className="row" style={{ gap: 12, alignItems: "flex-end" }}>
          {sets.map((s) => (
            <div key={s.set} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ height: BAR_AREA + HEADROOM, width: "100%", display: "flex", justifyContent: "center", alignItems: "flex-end", borderBottom: "1px solid var(--line-1)" }}>
                <div style={{ width: BAR_W, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-1)", marginBottom: 2 }}>{s.values[variable].toFixed(2)}</span>
                  <div style={{ width: "100%", height: px(s.values[variable]), background: color, borderRadius: "2px 2px 0 0" }} />
                </div>
              </div>
              <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-1)" }}>Set {s.set}</div>
            </div>
          ))}
        </div>
      )}
      <div className="v-meta" style={{ fontSize: 10 }}>m/s</div>
    </div>
  );
}
