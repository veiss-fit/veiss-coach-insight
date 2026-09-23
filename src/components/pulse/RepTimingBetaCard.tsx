import { BetaBadge, MetricInfoTip } from "./BetaBadge";

export interface RepTimingSetPoint {
  set: number;
  /** Mean time to peak velocity across the set's reps, s. */
  toPeakVelocityS: number;
  /** Mean time to peak power across the set's reps, s. */
  toPeakPowerS: number;
}

export interface RepTimingBetaCardProps {
  exercise: string;
  sessionDate: string;
  /** One exercise's sets, oldest first. All-mock data — see BetaBadge. */
  sets: RepTimingSetPoint[];
}

const VEL_COLOR = "var(--brand)";
const POWER_COLOR = "#2563eb";
const BAR_AREA = 90, HEADROOM = 20, BAR_W = 30, BAR_GAP = 4;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Group 4 — Rep timing, new fields. Same grain and x-axis as the shipped RepTimingCards: per set,
 * within one exercise, one session. Meant to sit as extra pills/bars alongside that card's mean
 * concentric/eccentric duration and TUT, not as a standalone "one rep" card. Time to peak power is
 * also blocked on group 2 (Power).
 */
export function RepTimingBetaCard({ exercise, sessionDate, sets }: RepTimingBetaCardProps) {
  const max = Math.max(0.1, ...sets.flatMap((s) => [s.toPeakVelocityS, s.toPeakPowerS]));
  const px = (v: number) => Math.max(2, (v / (max * 1.1)) * BAR_AREA);

  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div className="v-h2" style={{ color: "var(--ink-0)" }}>{exercise}</div>
          <div className="v-meta" style={{ fontSize: 11 }}>{fmtDate(sessionDate)} · per set · new rep-timing fields</div>
        </div>
        <span className="row" style={{ gap: 4 }}>
          <BetaBadge />
          <MetricInfoTip label="About rep timing" text="Mean time to peak velocity and to peak power, per set." />
        </span>
      </div>

      {sets.length === 0 ? (
        <div className="v-meta" style={{ padding: "8px 0" }}>No sets in this session.</div>
      ) : (
        <>
          <div className="row" style={{ gap: 12, alignItems: "flex-end" }}>
            {sets.map((s) => (
              <div key={s.set} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ height: BAR_AREA + HEADROOM, width: "100%", display: "flex", justifyContent: "center", alignItems: "flex-end", borderBottom: "1px solid var(--line-1)" }}>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: BAR_GAP }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: BAR_W }}>
                      <span className="mono" style={{ fontSize: 10, color: "var(--ink-1)", marginBottom: 2 }}>{s.toPeakVelocityS.toFixed(2)}</span>
                      <div style={{ width: "100%", height: px(s.toPeakVelocityS), background: VEL_COLOR, borderRadius: "2px 2px 0 0" }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: BAR_W }}>
                      <span className="mono" style={{ fontSize: 10, color: "var(--ink-1)", marginBottom: 2 }}>{s.toPeakPowerS.toFixed(2)}</span>
                      <div style={{ width: "100%", height: px(s.toPeakPowerS), background: POWER_COLOR, borderRadius: "2px 2px 0 0" }} />
                    </div>
                  </div>
                </div>
                <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-1)" }}>Set {s.set}</div>
              </div>
            ))}
          </div>
          <div className="row v-meta" style={{ gap: 14, fontSize: 11, flexWrap: "wrap" }}>
            <span className="row" style={{ gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: VEL_COLOR }} /> to peak velocity</span>
            <span className="row" style={{ gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: POWER_COLOR }} /> to peak power</span>
            <span className="mono" style={{ color: "var(--ink-1)" }}>seconds</span>
          </div>
        </>
      )}
    </div>
  );
}
