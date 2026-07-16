import { ChevronRight } from "lucide-react";
import { format } from "date-fns";
import type { PlayerWithStats } from "@/services/playersService";
import type { RosterAthleteMetrics } from "@/services/rosterMetricsService";
import { Avatar } from "./Avatar";
import { AttBar } from "./AttBar";
import { Delta } from "./Delta";
import { GroupChip, LoadRecChip, EngagementChip } from "./chips";

interface PulseAthleteTableProps {
  athletes: PlayerWithStats[];
  metricsByPlayer: Map<string, RosterAthleteMetrics>;
  showAdvanced: boolean;
  onSelect?: (athlete: PlayerWithStats) => void;
}

/** Roster table in the Pulse design (replaces the legacy components/AthleteTable). */
export function PulseAthleteTable({ athletes, metricsByPlayer, showAdvanced, onSelect }: PulseAthleteTableProps) {
  return (
    <table className="v-table">
      <thead>
        <tr>
          <th>Athlete</th>
          <th>Group</th>
          <th>Attendance</th>
          <th>Velocity</th>
          <th>Load</th>
          <th>Engagement</th>
          {showAdvanced && <th>ROM</th>}
          {showAdvanced && <th>Tempo</th>}
          <th>Last session</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {athletes.length === 0 ? (
          <tr style={{ cursor: "default" }}>
            <td colSpan={showAdvanced ? 10 : 8} style={{ textAlign: "center", color: "var(--ink-3)", height: 88 }}>
              No athletes match the current filters.
            </td>
          </tr>
        ) : (
          athletes.map((a) => {
            const m = metricsByPlayer.get(a.id);
            const vel = m?.recentVel ?? a.avgVelocity;
            return (
              <tr key={a.id} onClick={() => onSelect?.(a)}>
                <td>
                  <div className="row" style={{ gap: 10 }}>
                    <Avatar name={a.name} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 500, color: "var(--ink-0)" }}>{a.name}</div>
                      {a.jersey_number != null && (
                        <div className="v-meta mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                          #{a.jersey_number}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <GroupChip name={a.group || "—"} />
                </td>
                <td><AttBar pct={a.attendance} /></td>
                <td>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="mono" style={{ fontSize: 12.5, color: "var(--ink-0)" }}>
                      {vel > 0 ? vel.toFixed(2) : "—"}
                    </span>
                    <Delta value={m?.velDelta ?? null} />
                  </div>
                </td>
                <td><LoadRecChip rec={a.loadRec} /></td>
                <td><EngagementChip level={a.engagement} /></td>
                {showAdvanced && (
                  <td>
                    <span className="mono" style={{ fontSize: 12 }}>
                      {a.avgROM > 0 ? a.avgROM : "—"}
                      {a.avgROM > 0 && <span className="v-mute2" style={{ fontSize: 10.5, marginLeft: 2 }}>mm</span>}
                    </span>
                  </td>
                )}
                {showAdvanced && (
                  <td>
                    <span className="mono" style={{ fontSize: 12 }}>
                      {a.avgTempo > 0 ? a.avgTempo.toFixed(2) : "—"}
                      {a.avgTempo > 0 && <span className="v-mute2" style={{ fontSize: 10.5, marginLeft: 2 }}>s</span>}
                    </span>
                  </td>
                )}
                <td>
                  {a.lastWorkout ? (
                    <div className="row" style={{ gap: 6 }}>
                      <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-2)" }}>
                        {format(new Date(a.lastWorkout.date), "MMM d")}
                      </span>
                      <span className="v-meta ellipsis" style={{ fontSize: 11.5, maxWidth: 140 }}>{a.lastWorkout.name}</span>
                    </div>
                  ) : (
                    <span className="v-mute2 mono" style={{ fontSize: 11.5 }}>—</span>
                  )}
                </td>
                <td style={{ width: 40, textAlign: "right" }}>
                  <ChevronRight size={12} strokeWidth={1.5} style={{ color: "var(--ink-3)" }} />
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
