// TODO(cleanup): Storybook-only, no production caller currently.
import { trainingExposure, type SessionInput } from "@/lib/metrics/trainingExposure";
import { SESSIONS_TARGET } from "@/lib/vbtZones";
import { WeeklyLoadChart, type WeeklyLoadPoint } from "./charts";

interface TrainingExposureCardProps {
  /** Every session of the athlete (at least the last 8 weeks) with its valid-rep count. */
  sessions: SessionInput[];
  /** Today's date. Defaults to now. */
  today?: string;
}

/**
 * SP-08. The "Weekly volume" card from the athlete Performance tab (same
 * chart component, same header, same stat row), fed with the SP-08 weekly
 * counts, plus one extra stat: days since the last session.
 */
export function TrainingExposureCard({ sessions, today }: TrainingExposureCardProps) {
  const e = trainingExposure(sessions, today ?? new Date().toISOString());
  const weekly8: WeeklyLoadPoint[] = e.weeks.map((w, i) => ({
    label: i === e.weeks.length - 1 ? "now" : `W-${e.weeks.length - 1 - i}`,
    v: w.sessions,
  }));
  const sessionsThisWeek = weekly8.length ? weekly8[weekly8.length - 1].v : 0;
  const avg = (weekly8.reduce((s, d) => s + d.v, 0) / (weekly8.length || 1)).toFixed(1);
  const onTarget = weekly8.filter((d) => d.v >= SESSIONS_TARGET).length;

  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ marginBottom: 10 }}>
        <div className="v-h2">Weekly volume</div>
        <div className="v-meta" style={{ marginTop: 2 }}>Sessions per week vs {SESSIONS_TARGET}/wk target.</div>
      </div>
      <WeeklyLoadChart data={weekly8} target={SESSIONS_TARGET} height={172} legible />
      <div className="row" style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--line-0)" }}>
        {[
          { v: avg, l: "8-wk avg / wk" },
          { v: `${sessionsThisWeek}/${SESSIONS_TARGET}`, l: "this week" },
          { v: `${onTarget}/8`, l: "weeks on target" },
          { v: e.daysSinceLast == null ? "—" : `${e.daysSinceLast}`, l: "days since last" },
        ].map((stat, i) => (
          <div key={stat.l} style={{ flex: 1, borderLeft: i ? "1px solid var(--line-0)" : "none", paddingLeft: i ? 14 : 0 }}>
            <div className="num" style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>{stat.v}</div>
            <div className="v-meta" style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 1 }}>{stat.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
