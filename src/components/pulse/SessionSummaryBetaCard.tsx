import { BetaBadge, MetricInfoTip } from "./BetaBadge";
import { fmtShortDate } from "@/lib/format";

export interface SessionSummaryBetaStats {
  caloriesKcal: number;
}

export interface SessionSummaryBetaCardProps {
  sessionName: string;
  sessionDate: string;
  /** From a wearable, not the bar sensor. All-mock data — see BetaBadge. */
  stats: SessionSummaryBetaStats;
}

/**
 * Group 6b — Calories. Other half of the old "Effort & readiness" card, split out
 * because these are per-session, from a wearable — a different grain and a different input path
 * than RIR/RPE (per set, athlete-reported; see SetEffortBetaCard). Previewed as a summary strip
 * at the top of a session, not a chart — there's no natural x-axis at this grain yet.
 */
export function SessionSummaryBetaCard({ sessionName, sessionDate, stats }: SessionSummaryBetaCardProps) {
  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div className="v-h2" style={{ color: "var(--ink-0)" }}>{sessionName}</div>
          <div className="v-meta" style={{ fontSize: 11 }}>{fmtShortDate(sessionDate)} · whole session · wearable</div>
        </div>
        <span className="row" style={{ gap: 4 }}>
          <BetaBadge />
          <MetricInfoTip label="About session summary" text="Whole-session calories, from a wearable rather than the bar sensor." />
        </span>
      </div>
      <div className="row" style={{ gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="v-meta" style={{ fontSize: 10.5 }}>Calories</span>
          <span className="row" style={{ alignItems: "baseline", gap: 3 }}>
            <span className="num" style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink-0)" }}>
              {Math.round(stats.caloriesKcal)}
            </span>
            <span className="v-mute2 mono" style={{ fontSize: 10.5 }}>kcal</span>
          </span>
        </div>
      </div>
    </div>
  );
}
