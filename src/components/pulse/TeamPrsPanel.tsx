import { useState } from "react";
import { Avatar } from "./Avatar";
import { fmtShortDate } from "@/lib/format";

const VISIBLE_ROWS = 8;

export interface TeamPrRow {
  playerId: string;
  name: string;
  exercise: string;
  /** Heaviest verified set load in the 8-week window, unit not verified (assumed lbs). */
  load: number;
  /** Fastest valid rep at that load, m/s. */
  best: number;
  /** ISO date of the session that holds the record. */
  date: string;
}

export interface TeamPrsPanelProps {
  /** One row per athlete + exercise PR, newest first. Already windowed to the last 8 weeks by the caller. */
  rows: TeamPrRow[];
  onRowClick?: (playerId: string) => void;
}

/**
 * SP-05 per athlete, team-wide: fastest rep at the heaviest load each athlete lifted in the last
 * 8 weeks, one row per athlete + exercise, newest first. "PR" here means best in 8 weeks, not all-time.
 */
export function TeamPrsPanel({ rows, onRowClick }: TeamPrsPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, VISIBLE_ROWS);

  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div className="row" style={{ alignItems: "center", minHeight: 24 }}>
        <div className="v-label">Recent team PRs</div>
      </div>

      {rows.length === 0 ? (
        <div className="v-meta" style={{ padding: "8px 0" }}>No PRs with a recorded weight in the last 8 weeks.</div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {visible.map((row, i) => (
              <button
                key={`${row.playerId}-${row.exercise}`}
                type="button"
                onClick={() => onRowClick?.(row.playerId)}
                className="row"
                style={{
                  justifyContent: "space-between", gap: 8, border: 0, background: "transparent",
                  padding: "6px 8px", cursor: onRowClick ? "pointer" : "default", font: "inherit",
                  textAlign: "left", borderTop: i === 0 ? undefined : "1px solid var(--line-1)",
                }}
              >
                <div className="row" style={{ gap: 8, minWidth: 0 }}>
                  <Avatar name={row.name} />
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: 1 }}>
                    <span className="ellipsis" style={{ fontSize: 12.5, color: "var(--ink-0)" }}>{row.name}</span>
                    <span className="ellipsis" style={{ fontSize: 10.5, color: "var(--ink-2)" }}>{row.exercise} · {fmtShortDate(row.date)}</span>
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 12, flexShrink: 0, whiteSpace: "nowrap" }}>
                  <span
                    style={{ background: "var(--brand)", color: "var(--ink-0)", fontWeight: 600, padding: "2px 7px", borderRadius: 5 }}
                    title="Load (unit not verified)"
                  >
                    {row.load} lbs
                  </span>
                  {" · "}
                  <span style={{ color: "var(--ink-0)", fontWeight: 600 }}>{row.best.toFixed(2)} m/s</span>
                </span>
              </button>
            ))}
          </div>
          {rows.length > VISIBLE_ROWS && (
            <button type="button" className="v-btn ghost" style={{ fontSize: 11.5, alignSelf: "flex-start" }} onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show fewer" : `Show all ${rows.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
