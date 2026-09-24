import { BetaBadge, MetricInfoTip } from "./BetaBadge";
import { fmtShortDate } from "@/lib/format";

export interface SetEffortPoint {
  set: number;
  rir: number;
  rpe: number;
}

export interface SetEffortBetaCardProps {
  exercise: string;
  sessionDate: string;
  /** One exercise's sets, oldest first. Athlete-reported. All-mock data — see BetaBadge. */
  sets: SetEffortPoint[];
}

/**
 * Group 6a — RIR/RPE. Half of the old "Effort & readiness" card, split out because RIR/RPE are
 * athlete-reported per set (no single "session RIR" is defined), same grain and x-axis as
 * SetVelocityBars/RepTimingCards. Not collected today — needs a new input path, not a formula.
 * "Readiness" is dropped from the name: the spec retired readiness composites.
 */
export function SetEffortBetaCard({ exercise, sessionDate, sets }: SetEffortBetaCardProps) {
  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div className="v-h2" style={{ color: "var(--ink-0)" }}>{exercise}</div>
          <div className="v-meta" style={{ fontSize: 11 }}>{fmtShortDate(sessionDate)} · per set · athlete-reported</div>
        </div>
        <span className="row" style={{ gap: 4 }}>
          <BetaBadge />
          <MetricInfoTip label="About RIR and RPE" text="Athlete-reported effort per set: reps in reserve (RIR) and rate of perceived exertion (RPE)." />
        </span>
      </div>

      {sets.length === 0 ? (
        <div className="v-meta" style={{ padding: "8px 0" }}>No sets in this session.</div>
      ) : (
        <div className="row" style={{ gap: 12 }}>
          {sets.map((s) => (
            <div key={s.set} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-1)" }}>Set {s.set}</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 10px", background: "var(--surface-sunk)", borderRadius: 6, width: "100%" }}>
                <span className="num" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-0)" }}>{s.rir}</span>
                <span className="v-meta" style={{ fontSize: 9 }}>RIR</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 10px", background: "var(--surface-sunk)", borderRadius: 6, width: "100%" }}>
                <span className="num" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-0)" }}>{s.rpe}</span>
                <span className="v-meta" style={{ fontSize: 9 }}>RPE</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
