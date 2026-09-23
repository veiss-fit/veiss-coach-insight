import { BetaBadge, MetricInfoTip } from "./BetaBadge";

export interface PowerSetPoint {
  set: number;
  meanW: number;
  peakW: number;
}

export interface PowerBetaCardProps {
  exercise: string;
  sessionDate: string;
  /** One exercise's sets, oldest first. All-mock data — see BetaBadge. */
  sets: PowerSetPoint[];
}

const MEAN_COLOR = "var(--brand)";
const PEAK_COLOR = "#2563eb";
const BAR_AREA = 110, HEADROOM = 22, BAR_W = 30, BAR_GAP = 4;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Group 2 — Power. Same grain and x-axis as SetVelocityBars/RepTimingCards: per set, within one
 * exercise, one session — a set's best-rep mean and peak power, side by side. New view alongside
 * Velocity/Time on the Sessions tab, not folded into Velocity (different units, and blocked on
 * load as well as the waveform). Nothing in the schema carries power today.
 */
export function PowerBetaCard({ exercise, sessionDate, sets }: PowerBetaCardProps) {
  const max = Math.max(1, ...sets.flatMap((s) => [s.meanW, s.peakW]));
  const px = (v: number) => Math.max(2, (v / (max * 1.1)) * BAR_AREA);

  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div className="v-h2" style={{ color: "var(--ink-0)" }}>{exercise}</div>
          <div className="v-meta" style={{ fontSize: 11 }}>{fmtDate(sessionDate)} · per set</div>
        </div>
        <span className="row" style={{ gap: 4 }}>
          <BetaBadge />
          <MetricInfoTip label="About power" text="Each set's best-rep mean and peak power, side by side." />
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
                      <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-1)", marginBottom: 2 }}>{Math.round(s.meanW)}</span>
                      <div style={{ width: "100%", height: px(s.meanW), background: MEAN_COLOR, borderRadius: "2px 2px 0 0" }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: BAR_W }}>
                      <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-1)", marginBottom: 2 }}>{Math.round(s.peakW)}</span>
                      <div style={{ width: "100%", height: px(s.peakW), background: PEAK_COLOR, borderRadius: "2px 2px 0 0" }} />
                    </div>
                  </div>
                </div>
                <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-1)" }}>Set {s.set}</div>
              </div>
            ))}
          </div>
          <div className="row v-meta" style={{ gap: 14, fontSize: 11, flexWrap: "wrap" }}>
            <span className="row" style={{ gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: MEAN_COLOR }} /> mean</span>
            <span className="row" style={{ gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: PEAK_COLOR }} /> peak</span>
            <span className="mono" style={{ color: "var(--ink-1)" }}>watts</span>
          </div>
        </>
      )}
    </div>
  );
}
