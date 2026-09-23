import { Clock } from "lucide-react";

export interface ComingSoonMetric {
  name: string;
  /** Short reason it isn't available yet — a raw signal we don't collect, or a derived one we can't compute from what we have. */
  reason?: string;
}

export interface ComingSoonMetricsCardProps {
  metrics: ComingSoonMetric[];
}

/**
 * What coaches asked for (2026-09-23 email) that we don't compute or show yet — cross-referenced
 * against reps/sessions columns and src/lib/metrics/*. What the codebase already has, for
 * reference (not part of this list): mean velocity per rep, rep/set counts, range of motion (ROM),
 * concentric/eccentric duration + time under tension, eccentric:concentric ratio, and an
 * upper-body-only estimated 1RM.
 */
export const DEFAULT_COMING_SOON_METRICS: ComingSoonMetric[] = [
  { name: "Strength Score", reason: "no formula defined" },
  { name: "Speed Score", reason: "no formula defined" },
  { name: "Total Performance Score", reason: "no formula defined" },
  { name: "Peak Velocity (m/s)", reason: "only mean velocity per rep is recorded" },
  { name: "Power — mean & peak (W)", reason: "not in the data at all" },
  { name: "Eccentric Mean Velocity (m/s)", reason: "no phase-split velocity, only duration" },
  { name: "Time to Peak Velocity (s)", reason: "needs a rep waveform, not just an average" },
  { name: "Time to Peak Power (s)", reason: "needs a rep waveform, not just an average" },
  { name: "Velocity at 100ms (m/s)", reason: "needs a rep waveform, not just an average" },
  { name: "Mean Propulsive Velocity (m/s)", reason: "needs a rep waveform, not just an average" },
  { name: "Efficiency (%)", reason: "no formula defined" },
  { name: "Tonnage (lbs)", reason: "load x reps — in progress" },
  { name: "Total Work (kJ)", reason: "needs power to compute" },
  { name: "RIR", reason: "not collected" },
  { name: "RPE", reason: "not collected" },
  { name: "Heart Rate (bpm)", reason: "not collected" },
  { name: "Calories (kcal)", reason: "not collected" },
  { name: "Barbell Distance (mi)", reason: "cumulative distance not summed anywhere" },
];

/**
 * Metrics coaches asked for (2026-09-23 email) that the platform doesn't compute or display yet.
 * Cross-referenced against reps/sessions columns and src/lib/metrics/*: we have mean velocity per
 * rep, rep/set counts, ROM, concentric/eccentric duration + time under tension, and an upper-body-only
 * e1RM estimate. Nothing in the schema carries power, a rep's force/velocity waveform (so no peak
 * velocity, time-to-peak, velocity-at-100ms, propulsive velocity, efficiency), RIR/RPE, heart rate,
 * calories, or cumulative bar distance — those need new hardware fields or new formulas, not just a
 * new view on existing columns.
 */
export function ComingSoonMetricsCard({ metrics }: ComingSoonMetricsCardProps) {
  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0, maxHeight: "85vh", overflow: "hidden" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 8, paddingRight: 20, flexShrink: 0 }}>
        <div className="v-label">Coming soon</div>
        <span className="v-meta" style={{ fontSize: 10.5 }}>Requested by coaches</span>
      </div>

      {metrics.length === 0 ? (
        <div className="v-meta" style={{ padding: "8px 0" }}>Nothing on the list right now.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", overflowY: "auto", minHeight: 0 }}>
          {metrics.map((m, i) => (
            <div
              key={m.name}
              className="row"
              style={{
                alignItems: "center", gap: 8,
                padding: "6px 8px", borderTop: i === 0 ? undefined : "1px solid var(--line-1)",
              }}
            >
              <span className="row" style={{ gap: 8, minWidth: 0 }}>
                <Clock size={13} strokeWidth={1.75} color="var(--ink-3)" />
                <span className="ellipsis" style={{ fontSize: 12.5, color: "var(--ink-1)" }}>{m.name}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
