import type { DeviationIndicator, RAGStatus } from "@/lib/athleteSummaryUtils";
import { Sparkline } from "./Sparkline";

const RAG_COLOR: Record<RAGStatus, string> = {
  green: "var(--good)",
  amber: "var(--warn)",
  red: "var(--bad)",
  insufficient: "var(--ink-3)",
};

interface DeviationBaselineCardProps {
  indicators: DeviationIndicator[];
  /** Last sessions' values per indicator metric, oldest first. Missing or short: no sparkline. */
  sparks: Record<string, number[] | undefined>;
}

/**
 * "Deviation from baseline" card, moved out of the athlete page's Readiness tab
 * (that tab was removed). Each tile is one indicator: latest value, change against
 * the athlete's own baseline, a status dot and a sparkline of the recent sessions.
 * Status uses the z-score model in athleteSummaryUtils (green within 1 sigma, amber
 * within 2, red beyond).
 */
export function DeviationBaselineCard({ indicators, sparks }: DeviationBaselineCardProps) {
  return (
    <div className="v-card padded">
      <div className="v-h2">Deviation from baseline</div>
      <div className="v-meta" style={{ marginTop: 2 }}>
        Last 4 sessions vs historical baseline · green ≤1σ, amber ≤2σ, red &gt;2σ.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        {indicators.map((ind) => {
          const spark = sparks[ind.metric];
          return (
            <div key={ind.metric} style={{ border: "1px solid var(--line-0)", borderRadius: 8, padding: "10px 12px" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="v-label" style={{ fontSize: 9.5 }}>{ind.label}</span>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: RAG_COLOR[ind.ragStatus], flexShrink: 0 }} title={ind.ragStatus} />
              </div>
              <div className="row" style={{ alignItems: "baseline", gap: 6, marginTop: 4 }}>
                <span className="num" style={{ fontSize: 17, fontWeight: 600 }}>
                  {ind.value != null ? ind.formatFn(ind.value) : "—"}
                </span>
                {ind.deltaPercent != null && (
                  <span className="mono" style={{ fontSize: 10.5, color: ind.deltaPercent >= 0 ? "var(--good)" : "var(--bad)" }}>
                    {ind.deltaPercent > 0 ? "+" : ""}{ind.deltaPercent.toFixed(1)}%
                  </span>
                )}
              </div>
              {ind.ragStatus === "insufficient" ? (
                <div className="v-mute2" style={{ fontSize: 10.5, marginTop: 6 }}>Needs ≥7 sessions</div>
              ) : (
                spark && spark.length > 1 && <Sparkline data={spark} stroke={RAG_COLOR[ind.ragStatus]} fill="transparent" height={20} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
