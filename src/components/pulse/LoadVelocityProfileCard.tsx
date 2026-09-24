import { useState } from "react";
import type { HistorySession } from "@/lib/metrics/velocityVsBaseline";
import { estimateOneRm, isUpperBodyExercise, DEFAULT_MVT, type OneRmEstimate } from "@/lib/metrics/estimatedOneRm";
import { loadVelocityProfile, MIN_LOADS, PROFILE_WINDOW_DAYS, type LoadVelocityProfile } from "@/lib/metrics/loadVelocityProfile";
import { useMeasuredWidth } from "./charts";
import { StatsDetailMenu } from "./StatsDetailMenu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtShortDate } from "@/lib/format";

const ACCENT = "var(--brand)";
const HEIGHT = 220;
const PL = 60;
const PR = 16;
const PT = 16;
const PB = 40;

const TIP_BOX: React.CSSProperties = {
  position: "absolute",
  background: "var(--ink-0)",
  color: "white",
  padding: "8px 10px",
  borderRadius: 8,
  fontSize: 11.5,
  fontFamily: "var(--font-mono)",
  boxShadow: "0 8px 20px rgba(7,16,31,0.25)",
  pointerEvents: "none",
};

/**
 * Copy of the load-velocity scatter on the Performance tab (dots, dashed fit
 * line, dark hover box) with two changes: a dot is one load (its fastest rep),
 * not one set, and the line needs only 2 loads. Dots are all the same shade.
 */
function ProfileChart({ profile, est }: { profile: LoadVelocityProfile; est: OneRmEstimate | null }) {
  const { ref, width: w } = useMeasuredWidth<HTMLDivElement>(600);
  const [hover, setHover] = useState<number | null>(null);
  const [hoverEst, setHoverEst] = useState(false);
  const { points, fit } = profile;
  const cW = Math.max(50, w - PL - PR);
  const cH = HEIGHT - PT - PB;
  if (points.length === 0) {
    return (
      <div ref={ref} className="v-meta" style={{ height: HEIGHT, display: "flex", alignItems: "center", justifyContent: "center" }}>
        No sets with load + velocity yet.
      </div>
    );
  }

  const loads = points.map((d) => d.load);
  const vels = points.map((d) => d.best);
  const mnX = Math.min(...loads) * 0.9;
  const estOk = est?.ok === true ? est : null;
  const mxX = Math.max(...loads, estOk ? estOk.oneRm : 0) * 1.05 || 1;
  const mnY = Math.max(0, Math.min(...vels, estOk ? estOk.mvt : Infinity) - 0.1);
  const mxY = Math.max(...vels) + 0.1;
  const toX = (x: number) => PL + ((x - mnX) / (mxX - mnX || 1)) * cW;
  const toY = (y: number) => PT + cH - ((y - mnY) / (mxY - mnY || 1)) * cH;

  let linePath = "";
  if (fit) {
    const pts: Array<[number, number]> = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const x = mnX + ((mxX - mnX) * i) / steps;
      const yv = fit.intercept + fit.slope * x;
      if (yv > mnY && yv < mxY) pts.push([toX(x), toY(yv)]);
    }
    linePath = pts.map((p, i) => (i ? "L" : "M") + p[0] + "," + p[1]).join(" ");
  }

  const yTicks = [0.25, 0.5, 0.75].map((f) => +(mnY + (mxY - mnY) * f).toFixed(2));
  const xTicks = [0.2, 0.5, 0.8].map((f) => Math.round(mnX + (mxX - mnX) * f));

  return (
    <div ref={ref} style={{ position: "relative", width: "100%", minWidth: 0, overflow: "hidden" }}>
      <svg width={w} height={HEIGHT} style={{ display: "block" }} role="img" aria-label="Load-velocity profile, one dot per load">
        {yTicks.map((y) => (
          <g key={y}>
            <line x1={PL} x2={PL + cW} y1={toY(y)} y2={toY(y)} stroke="var(--line-0)" />
            <text x={PL - 10} y={toY(y) + 3} textAnchor="end" fontSize="11.5" fontFamily="var(--font-mono)" fill="var(--ink-1)">{y.toFixed(2)}</text>
          </g>
        ))}
        {xTicks.map((x) => (
          <text key={x} x={toX(x)} y={HEIGHT - 19} textAnchor="middle" fontSize="11.5" fontFamily="var(--font-mono)" fill="var(--ink-1)">{x}</text>
        ))}
        <text x={14} y={PT + cH / 2} textAnchor="middle" fontSize="11.5" fontFamily="var(--font-mono)" fill="var(--ink-1)" transform={`rotate(-90, 14, ${PT + cH / 2})`}>velocity m/s</text>
        <text x={PL + cW / 2} y={HEIGHT - 3} textAnchor="middle" fontSize="11.5" fontFamily="var(--font-mono)" fill="var(--ink-1)">load</text>

        {linePath && <path d={linePath} stroke={ACCENT} strokeWidth="1.4" strokeDasharray="3 3" fill="none" opacity="0.5" />}

        {estOk && (
          <circle
            cx={toX(estOk.oneRm)}
            cy={toY(estOk.mvt)}
            r={hoverEst ? 7 : 5}
            fill="var(--surface-1)"
            stroke={ACCENT}
            strokeWidth="2"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHoverEst(true)}
            onMouseLeave={() => setHoverEst(false)}
          />
        )}

        {points.map((d, i) => (
          <circle
            key={d.load}
            cx={toX(d.load)}
            cy={toY(d.best)}
            r={hover === i ? 7 : 5}
            fill={ACCENT}
            fillOpacity={0.95}
            stroke="var(--surface-1)"
            strokeWidth="1.5"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>

      {estOk && hoverEst && (
        <div
          style={{
            ...TIP_BOX,
            left: Math.min(toX(estOk.oneRm) - 150, w - 170),
            top: Math.max(toY(estOk.mvt) - 60, 4),
          }}
        >
          <div style={{ fontWeight: 600 }}>est. 1RM {Math.round(estOk.oneRm)}</div>
          <div style={{ marginTop: 2, color: "rgba(255,255,255,0.65)", fontSize: 10 }}>at {estOk.mvt.toFixed(2)} m/s</div>
        </div>
      )}

      {hover != null && (
        <div
          style={{
            ...TIP_BOX,
            left: Math.min(toX(points[hover].load) + 10, w - 170),
            top: Math.max(toY(points[hover].best) - 40, 4),
          }}
        >
          <div style={{ fontWeight: 600 }}>{points[hover].load} load</div>
          <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
            <span>{points[hover].best.toFixed(2)} m/s</span>
          </div>
          <div style={{ marginTop: 2, color: "rgba(255,255,255,0.65)", fontSize: 10 }}>
            latest {fmtShortDate(points[hover].latest)}
          </div>
        </div>
      )}
    </div>
  );
}

const PROFILE_INFO = (
  <>
    <p style={{ margin: 0 }}>
      <strong>Load-velocity profile</strong>: one dot per load lifted in the last {PROFILE_WINDOW_DAYS / 7} weeks, each the
      fastest valid rep at that load, with a fitted line through them.
    </p>
    <p style={{ margin: "6px 0 0" }}>
      <strong>R²</strong> is how closely the dots follow that line. <strong>Velocity span</strong> is the speed difference
      between the lightest and heaviest load.
    </p>
    <p style={{ margin: "6px 0 0" }}>
      <strong>Estimated 1RM</strong> (upper-body lifts only): the load where the fitted line reaches your set minimum
      velocity — an extrapolation past the loads actually lifted, so treat it as rough.
    </p>
    <p style={{ margin: "6px 0 0" }}>
      <strong>Min velocity</strong> is the slowest bar speed still counted as a true 1-rep max; it is not calibrated per
      lifter or exercise, so adjust it to suit.
    </p>
  </>
);

function pillsFor(profile: LoadVelocityProfile, est: OneRmEstimate | null): string[] {
  const { points, fit, span } = profile;
  const out: string[] = [];
  if (est && est.ok === true) {
    out.push(`estimated 1RM ${Math.round(est.oneRm)} · at ${est.mvt.toFixed(2)} m/s`);
    if (est.beyondHeaviest > 0) out.push(`${Math.round(est.beyondHeaviest)} above heaviest load tested`);
  }
  if (fit) {
    out.push(points.length >= 3 ? `R² ${fit.r2.toFixed(2)}` : "R²: needs 3+ loads");
  }
  if (span) out.push(`velocity span ${span.drop.toFixed(2)} m/s · load ${span.lightest} to ${span.heaviest}`);
  return out;
}

interface LoadVelocityProfileCardProps {
  /** All sessions per exercise name (any age; the card applies its own window). */
  sessions: Record<string, HistorySession[]>;
  /** Today's date. Defaults to now. */
  today?: string;
}

/** SP-09: load-velocity profile with an exercise picker, like the Performance tab card. */
export function LoadVelocityProfileCard({ sessions, today }: LoadVelocityProfileCardProps) {
  const names = Object.keys(sessions);
  const [pick, setPick] = useState<string | null>(null);
  const exercise = pick && names.includes(pick) ? pick : names[0];
  const now = today ?? new Date().toISOString();
  const profile = loadVelocityProfile(exercise ? sessions[exercise] : [], now);
  const [mvts, setMvts] = useState<Record<string, string>>({});
  const upper = exercise ? isUpperBodyExercise(exercise) : false;
  const mvtText = mvts[exercise] ?? String(DEFAULT_MVT);
  const est = upper ? estimateOneRm(profile, parseFloat(mvtText)) : null;

  return (
    <div className="v-card padded" style={{ minWidth: 0 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div className="v-h2">Load–velocity profile</div>
          <div className="v-meta" style={{ marginTop: 2 }}>Each dot is one load: its fastest rep, last {PROFILE_WINDOW_DAYS / 7} weeks.</div>
        </div>
        <div style={{ flexShrink: 0 }}>
          <StatsDetailMenu pills={pillsFor(profile, est)} info={PROFILE_INFO} infoLabel="About the load-velocity profile" idPrefix="lvp" />
        </div>
      </div>
      {(names.length > 1 || upper) && (
        <div className="row" style={{ marginBottom: 8, gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {names.length > 1 && (
            <Select value={exercise} onValueChange={setPick}>
              <SelectTrigger aria-label="Exercise" style={{ height: 30, width: "auto", minWidth: 180, fontSize: 12, gap: 8 }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {names.map((name) => (
                  <SelectItem key={name} value={name} style={{ fontSize: 12 }}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {upper && (
            <label className="v-meta" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink-1)" }}>
              Min velocity
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={mvtText}
                onChange={(e) => setMvts({ ...mvts, [exercise]: e.target.value })}
                aria-label="Minimum velocity for 1RM estimate, m/s"
                style={{ width: 64, height: 30, padding: "0 8px", borderRadius: 6, border: "1px solid var(--line-1, var(--line-0))", fontSize: 12, fontFamily: "var(--font-mono)" }}
              />
              m/s
            </label>
          )}
        </div>
      )}
      <ProfileChart profile={profile} est={est} />
      {exercise && !upper && (
        <div className="v-meta" style={{ marginTop: 8 }}>1RM is not estimated for this exercise (upper-body lifts only).</div>
      )}
      {est && est.ok === false && profile.points.length >= MIN_LOADS && (
        <div className="v-meta" style={{ marginTop: 8 }}>1RM not estimated: {est.reason}.</div>
      )}
      {profile.points.length > 0 && profile.points.length < MIN_LOADS && (
        <div className="v-meta" style={{ marginTop: 8 }}>Needs at least {MIN_LOADS} different loads for a profile.</div>
      )}
    </div>
  );
}
