import type { AttentionSignal } from "@/lib/metrics/attentionFlags";

const REASON_LABEL: Record<AttentionSignal, string> = {
  days: "Inactive",
  drop: "Velocity drop",
  tempo: "Tempo shift",
  attendance: "Attendance",
};

const REASON_ORDER: AttentionSignal[] = ["days", "drop", "tempo", "attendance"];

export interface NeedsAttentionTileProps {
  flaggedCount: number;
  totalCount: number;
  reasonCounts: Record<AttentionSignal, number>;
  /** Filters the roster table to athletes flagged for this reason. */
  onReasonClick?: (reason: AttentionSignal) => void;
}

export function NeedsAttentionTile({ flaggedCount, totalCount, reasonCounts, onReasonClick }: NeedsAttentionTileProps) {
  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, height: "100%", boxSizing: "border-box", overflow: "hidden" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div className="v-label">Flagged athletes</div>
        <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-0)" }}>
          {flaggedCount} <span className="v-mute2" style={{ fontWeight: 400 }}>of {totalCount}</span>
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, justifyContent: "space-between" }}>
        {REASON_ORDER.map((reason) => {
          const count = reasonCounts[reason];
          const clickable = !!onReasonClick && count > 0;
          return (
            <button
              key={reason}
              type="button"
              disabled={!clickable}
              onClick={() => onReasonClick?.(reason)}
              className="row"
              style={{
                justifyContent: "space-between",
                gap: 8,
                padding: "1px 6px",
                margin: "0 -6px",
                borderRadius: 5,
                border: 0,
                background: count > 0 ? "rgba(220,38,38,0.16)" : "transparent",
                cursor: clickable ? "pointer" : "default",
                font: "inherit",
                textAlign: "left",
              }}
            >
              <span className="v-meta" style={{ fontSize: 11 }}>{REASON_LABEL[reason]}</span>
              <span className="mono" style={{ fontSize: 12, color: "var(--ink-0)", fontWeight: count > 0 ? 600 : 400 }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
