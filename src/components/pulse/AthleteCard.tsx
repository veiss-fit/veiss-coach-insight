import { Calendar } from "lucide-react";
import type { PlayerWithStats } from "@/services/playersService";
import type { RosterAthleteMetrics } from "@/services/rosterMetricsService";
import { flagsFor, lastDaysFor } from "@/lib/rosterFlags";
import { SESSIONS_TARGET } from "@/lib/vbtZones";
import { Avatar } from "./Avatar";
import { Delta } from "./Delta";
import { Sparkline } from "./Sparkline";
import { MiniBars } from "./MiniBars";
import { LoadRecChip } from "./chips";

export interface NextPlanInfo {
  day: string;
  label: string;
}

interface AthleteCardProps {
  athlete: PlayerWithStats;
  metrics?: RosterAthleteMetrics;
  nextPlan?: NextPlanInfo | null;
  onSelect?: (athlete: PlayerWithStats) => void;
}

/** Focus card for the "Worth a look" row on the dashboard. */
export function AthleteCard({ athlete, metrics, nextPlan, onSelect }: AthleteCardProps) {
  const flag = flagsFor(athlete, metrics)[0];
  const lastDays = lastDaysFor(athlete, metrics);
  const vel = metrics?.recentVel ?? athlete.avgVelocity;

  return (
    <div
      className="v-card interactive padded"
      onClick={() => onSelect?.(athlete)}
      style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}
    >
      <div className="row" style={{ alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div className="row" style={{ gap: 10, minWidth: 0 }}>
          <Avatar name={athlete.name} size="lg" />
          <div style={{ minWidth: 0 }}>
            <div className="ellipsis" style={{ fontWeight: 600, fontSize: 14, color: "var(--ink-0)" }}>{athlete.name}</div>
            <div className="v-meta mono" style={{ fontSize: 11 }}>
              {athlete.jersey_number != null ? `#${athlete.jersey_number} · ` : ""}{athlete.group || "—"}
            </div>
          </div>
        </div>
        <span className="v-chip" data-tone={flag.tone}>{flag.label}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <div className="v-label" style={{ fontSize: 9.5 }}>Velocity</div>
          <div className="row" style={{ gap: 6, alignItems: "baseline" }}>
            <span className="num" style={{ fontSize: 17, fontWeight: 600 }}>{vel > 0 ? vel.toFixed(2) : "—"}</span>
            <Delta value={metrics?.velDelta ?? null} />
          </div>
          {metrics && metrics.velSeries.length >= 2 && (
            <Sparkline data={metrics.velSeries} stroke="var(--brand)" fill="transparent" height={20} />
          )}
        </div>
        <div>
          <div className="v-label" style={{ fontSize: 9.5 }}>Attendance</div>
          <div className="num" style={{ fontSize: 17, fontWeight: 600 }}>{athlete.attendance}%</div>
          <div className="v-meta mono" style={{ fontSize: 10.5, color: "var(--ink-3)" }}>
            {Number.isFinite(lastDays) ? `last ${lastDays}d ago` : "no sessions"}
          </div>
        </div>
        <div>
          <div className="v-label" style={{ fontSize: 9.5 }}>Sessions wk</div>
          <div className="num" style={{ fontSize: 17, fontWeight: 600 }}>
            {metrics?.sessionsThisWeek ?? 0}
            <span className="v-mute2" style={{ fontSize: 11, fontWeight: 400 }}>/{SESSIONS_TARGET}</span>
          </div>
          {metrics && <MiniBars data={metrics.sessSeries.slice(-7)} height={18} accent="var(--ink-0)" />}
        </div>
      </div>

      <div className="row" style={{ justifyContent: "space-between", borderTop: "1px solid var(--line-0)", paddingTop: 10, gap: 8 }}>
        <LoadRecChip rec={athlete.loadRec} />
        {nextPlan && (
          <div className="v-meta mono ellipsis row" style={{ fontSize: 11, color: "var(--ink-2)", gap: 4 }}>
            <Calendar size={12} strokeWidth={1.5} style={{ flexShrink: 0 }} />
            {nextPlan.day} · {nextPlan.label}
          </div>
        )}
      </div>
    </div>
  );
}
