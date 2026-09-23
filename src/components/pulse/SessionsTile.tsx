import { Delta } from "./Delta";
import { MiniBars } from "./MiniBars";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export interface SessionsTileProps {
  sessionsThisWeek: number;
  sessionsLastWeek: number;
  /** Sessions logged Mon..Sun of the current week. */
  sessionsByDay: number[];
}

export function SessionsTile({ sessionsThisWeek, sessionsLastWeek, sessionsByDay }: SessionsTileProps) {
  const delta = sessionsThisWeek - sessionsLastWeek;

  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, height: "100%", boxSizing: "border-box", overflow: "hidden" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="v-label">Sessions</div>
        <Delta value={delta} />
      </div>
      <div className="row" style={{ alignItems: "baseline", gap: 4 }}>
        <span className="num" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink-0)" }}>
          {sessionsThisWeek}
        </span>
        <span className="v-mute2 mono" style={{ fontSize: 11.5 }}>this week</span>
      </div>
      <div style={{ marginTop: "auto" }}>
        <MiniBars data={sessionsByDay} labels={DAY_LABELS} height={30} showValues accent="var(--brand)" />
      </div>
    </div>
  );
}
