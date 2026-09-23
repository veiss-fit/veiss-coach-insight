import { Fragment, useState } from "react";
import { Avatar } from "./Avatar";

const VISIBLE_ROWS = 10;

export interface TrainingGridRow {
  playerId: string;
  name: string;
  /** Sessions per day, oldest first, aligned with `days`. */
  countsByDay: number[];
}

export interface TrainingGridPanelProps {
  /** Short date labels, oldest first, e.g. "Mon 15". Length matches each row's countsByDay. */
  dayLabels: string[];
  rows: TrainingGridRow[];
  onRowClick?: (playerId: string) => void;
}

const cellColor = (count: number, max: number) => {
  if (count === 0) return "var(--surface-2)";
  const opacity = 0.25 + 0.75 * Math.min(1, count / Math.max(1, max));
  return `color-mix(in srgb, var(--brand) ${Math.round(opacity * 100)}%, var(--surface-2))`;
};

export function TrainingGridPanel({ dayLabels, rows, onRowClick }: TrainingGridPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, VISIBLE_ROWS);
  const max = Math.max(1, ...rows.flatMap((r) => r.countsByDay));

  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div className="row" style={{ alignItems: "center", minHeight: 24 }}>
        <div className="v-label">Training grid · last 7 days</div>
      </div>

      {rows.length === 0 ? (
        <div className="v-meta" style={{ padding: "8px 0" }}>No sessions in the last 7 days.</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: `1fr repeat(${dayLabels.length}, 28px)`, gap: 4, alignItems: "center" }}>
            <span />
            {dayLabels.map((d) => (
              <span key={d} className="v-mute2" style={{ fontSize: 9.5, textAlign: "center" }}>{d}</span>
            ))}
            {visible.map((row) => (
              <Fragment key={row.playerId}>
                <button
                  type="button"
                  onClick={() => onRowClick?.(row.playerId)}
                  className="row"
                  style={{
                    gap: 6, border: 0, background: "transparent", padding: "3px 0", minWidth: 0,
                    cursor: onRowClick ? "pointer" : "default", font: "inherit", textAlign: "left",
                  }}
                >
                  <Avatar name={row.name} />
                  <span className="ellipsis" style={{ fontSize: 12, color: "var(--ink-0)" }}>{row.name}</span>
                </button>
                {row.countsByDay.map((count, i) => (
                  <span
                    key={`${row.playerId}-${i}`}
                    title={`${count} session${count === 1 ? "" : "s"}`}
                    style={{
                      width: 28, height: 20, borderRadius: 4, background: cellColor(count, max),
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9.5, fontFamily: "var(--font-mono)",
                      color: count > 0 ? "var(--brand-ink)" : "var(--ink-3)",
                    }}
                  >
                    {count > 0 ? count : ""}
                  </span>
                ))}
              </Fragment>
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
