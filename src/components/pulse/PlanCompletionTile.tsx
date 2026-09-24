// TODO(cleanup): Storybook-only, no production caller currently.
import { Delta } from "./Delta";
import { MiniBars } from "./MiniBars";

export interface PlanCompletionTileProps {
  completedThisWeek: number;
  assignedThisWeek: number;
  /** Percentage-point change vs last week's completion rate. */
  deltaPct: number | null;
  /** 8-week completion % series, oldest first, for the sparkline. */
  series: number[];
}

export function PlanCompletionTile({ completedThisWeek, assignedThisWeek, deltaPct, series }: PlanCompletionTileProps) {
  const pending = Math.max(0, assignedThisWeek - completedThisWeek);

  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, height: "100%", boxSizing: "border-box", overflow: "hidden" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="v-label">Plan completion</div>
        {deltaPct != null && <Delta value={deltaPct} suffix="pt" />}
      </div>
      <div className="row" style={{ alignItems: "baseline", gap: 4 }}>
        <span className="num" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink-0)" }}>
          {completedThisWeek}
        </span>
        <span className="v-mute2 mono" style={{ fontSize: 11.5 }}>/ {assignedThisWeek} this week · {pending} pending</span>
      </div>
      {series.length > 1 && (
        <div style={{ marginTop: "auto" }}>
          <MiniBars data={series} height={30} showValues accent="var(--brand)" />
        </div>
      )}
    </div>
  );
}
