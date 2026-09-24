import type { ExerciseSets } from "@/lib/metrics/setVelocitySummary";
import type { HistorySession } from "@/lib/metrics/velocityVsBaseline";
import { fastestAtHeaviestLoad } from "@/lib/metrics/velocityRecords";
import { fmtShortDate } from "@/lib/format";

/** Header stays put while the rows scroll. */
const th: React.CSSProperties = { color: "var(--ink-2)", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 1, background: "var(--surface-2)" };
/** The list scrolls past this many rows; the card keeps that height. Header allowance is approximate. */
const VISIBLE_ROWS = 5;
const LIST_MAX_HEIGHT = `calc(var(--d-row-h) * ${VISIBLE_ROWS} + 36px)`;
/** Single line; a long exercise name ends in an ellipsis at maxWidth. */
const nameCell: React.CSSProperties = {
  color: "var(--ink-0)",
  fontWeight: 500,
  maxWidth: 220,
  minWidth: 160,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const num: React.CSSProperties = { fontSize: 12.5 };

interface PersonalRecordsCardProps {
  /** The latest session, grouped by exercise. */
  exercises: ExerciseSets[];
  /** Earlier sessions per exercise name. No date window: records are all-time. */
  history?: Record<string, HistorySession[]>;
  /** Date of the latest session. Defaults to now. */
  sessionDate?: string;
}

/** SP-05: per exercise, the fastest rep at the heaviest load ever lifted. */
export function PersonalRecordsCard({ exercises, history = {}, sessionDate }: PersonalRecordsCardProps) {
  const date = sessionDate ?? new Date().toISOString();
  return (
    <div className="v-card flush">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, padding: "var(--d-card-pad) var(--d-card-pad) 12px", flexWrap: "wrap" }}>
        <div className="v-h2" style={{ color: "var(--ink-0)" }}>Personal records</div>
      </div>
      {exercises.length === 0 ? (
        <div className="v-meta" style={{ padding: "0 var(--d-card-pad) var(--d-card-pad)" }}>No reps recorded in this session.</div>
      ) : (
        <div className="v-scroll" style={{ maxHeight: LIST_MAX_HEIGHT }}>
        <table className="v-table">
          <thead>
            <tr>
              <th style={th}>Exercise</th>
              <th style={th}>Heaviest · fastest</th>
              <th style={th}>Date</th>
              <th style={th}>Set</th>
            </tr>
          </thead>
          <tbody>
            {exercises.map((e) => {
              const r = fastestAtHeaviestLoad(e.sets, date, history[e.exercise] ?? []);
              return (
                <tr key={e.exercise} style={{ cursor: "default", whiteSpace: "nowrap" }}>
                  <td style={nameCell} title={e.exercise}>{e.exercise}</td>
                  {r.ok === false ? (
                    <td colSpan={3} style={{ color: "var(--ink-2)", whiteSpace: "nowrap" }}>{r.reason}</td>
                  ) : (
                    <>
                      <td>
                        <span className="mono" style={num}>
                          <span
                            style={{ background: "var(--brand)", color: "var(--ink-0)", fontWeight: 600, padding: "2px 7px", borderRadius: 5 }}
                            title="Load (unit not verified)"
                          >
                            {r.load} lbs
                          </span>
                          {" · "}
                          <span style={{ color: "var(--ink-0)", fontWeight: 600 }}>{r.best.toFixed(2)} m/s</span>
                        </span>
                      </td>
                      <td><span className="mono" style={num}>{fmtShortDate(r.date)}</span></td>
                      <td><span className="mono" style={num}>{r.set}</span></td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
