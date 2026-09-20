import type { ExerciseTiming, SetTiming } from "@/lib/metrics/repTiming";
import { concentricSetToSetChange, eccentricSetToSetChange, exerciseTimingSummary } from "@/lib/metrics/repTiming";
import { useState } from "react";
import { StatsDetailMenu } from "./StatsDetailMenu";
import { SetWindow } from "./SetWindow";
import { twoColumnGrid } from "./twoColumnGrid";
import { glowStyle, type GlowProps } from "./glow";

const BAR_AREA = 130;
/** Room above the tallest bar for its total label. */
const HEADROOM = 22;
const BAR_W = 44;
/** Shortest segment that can hold its value inside it, px. */
const MIN_SEGMENT_FOR_TEXT = 16;
/** Most sets drawn at once; more sets scroll one at a time with the set selector. Not tuned on screen yet. */
const MAX_VISIBLE_SETS = 4;

const CONC_COLOR = "var(--brand)";
const ECC_COLOR = "var(--ink-2)";

const fmtS = (v: number) => `${v.toFixed(1)} s`;

/**
 * SP-07 chart: one stacked bar per set. Bottom segment = mean concentric
 * duration, top segment = mean eccentric duration. The label above the bar is
 * their sum. Values are seconds.
 */
function TimingBars({ sets, scaleSets = sets }: { sets: SetTiming[]; /** Every set, for the bar scale, so bars do not rescale when the window moves. */ scaleSets?: SetTiming[] }) {
  const totals = sets.map((s) => (s.concMean ?? 0) + (s.eccMean ?? 0));
  const top = Math.max(...scaleSets.map((s) => (s.concMean ?? 0) + (s.eccMean ?? 0)), 0);
  const max = top > 0 ? top * 1.1 : 1;
  const px = (v: number) => Math.max(2, (v / max) * BAR_AREA);

  return (
    <div>
      <div className="row" style={{ gap: 12, alignItems: "flex-end" }}>
        {sets.map((s, i) => {
          const empty = s.concMean == null && s.eccMean == null;
          const hConc = s.concMean != null ? px(s.concMean) : 0;
          const hEcc = s.eccMean != null ? px(s.eccMean) : 0;
          return (
            <div key={s.set_number} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  height: BAR_AREA + HEADROOM,
                  width: "100%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "flex-end",
                  borderBottom: "1px solid var(--line-1)",
                }}
              >
                {empty ? (
                  <span className="mono" style={{ fontSize: 11.5, alignSelf: "center", color: "var(--ink-1)" }}>no timing</span>
                ) : (
                  <div style={{ width: BAR_W, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                    <span
                      className="mono"
                      title={`Set ${s.set_number} total: mean concentric time plus mean eccentric time per rep${s.concMean == null || s.eccMean == null ? " (only one of the two was recorded)" : ""}`}
                      style={{ fontSize: 11.5, color: "var(--ink-1)", marginBottom: 2 }}
                    >
                      {fmtS(totals[i])}
                    </span>
                    {s.eccMean != null && (
                      <Segment
                        height={hEcc}
                        color={ECC_COLOR}
                        textColor="#fff"
                        text={fmtS(s.eccMean)}
                        title={`Set ${s.set_number} eccentric, mean of ${s.nEcc} rep${s.nEcc === 1 ? "" : "s"}`}
                        radius="2px 2px 0 0"
                      />
                    )}
                    {s.concMean != null && (
                      <Segment
                        height={hConc}
                        color={CONC_COLOR}
                        textColor="var(--ink-0)"
                        text={fmtS(s.concMean)}
                        title={`Set ${s.set_number} concentric, mean of ${s.nConc} rep${s.nConc === 1 ? "" : "s"}`}
                        radius={s.eccMean != null ? "0" : "2px 2px 0 0"}
                      />
                    )}
                  </div>
                )}
              </div>
              <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-1)" }}>Set {s.set_number}</div>
              <div className="v-meta mono" style={{ fontSize: 11.5, color: "var(--ink-1)" }}>
                {Math.max(s.nConc, s.nEcc)} rep{Math.max(s.nConc, s.nEcc) === 1 ? "" : "s"}
              </div>
            </div>
          );
        })}
      </div>
      <div className="row v-meta" style={{ gap: 14, marginTop: 10, fontSize: 11.5, color: "var(--ink-1)", flexWrap: "wrap" }}>
        <span className="row" style={{ gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: CONC_COLOR }} /> concentric
        </span>
        <span className="row" style={{ gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: ECC_COLOR }} /> eccentric
        </span>
        <span className="mono" style={{ color: "var(--ink-1)" }}>seconds per rep</span>
      </div>
    </div>
  );
}

function Segment({ height, color, textColor, text, title, radius }: { height: number; color: string; textColor: string; text: string; title: string; radius: string }) {
  return (
    <div title={title} style={{ width: "100%", height, background: color, borderRadius: radius, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {height >= MIN_SEGMENT_FOR_TEXT && (
        <span className="mono" style={{ fontSize: 10.5, fontWeight: 600, color: textColor, whiteSpace: "nowrap", lineHeight: 1 }}>
          {text}
        </span>
      )}
    </div>
  );
}

const TIMING_INFO = (
  <>
    <p style={{ margin: 0 }}>
      <strong>Mean eccentric and concentric time</strong> per set: the mean concentric (lifting) and eccentric (lowering) duration, stacked in one bar.
      Reps with no recorded duration, or an invalid velocity, are left out.
    </p>
    <p style={{ margin: "6px 0 0" }}>
      <strong>Time under tension (TUT)</strong> is the concentric plus eccentric time summed over the reps that have both, across all sets of the exercise.
    </p>
    <p style={{ margin: "6px 0 0" }}>
      <strong>E:C ratio</strong> is eccentric time divided by concentric time. <strong>Concentric and eccentric change</strong> are the
      difference in average duration from the first to the last set.
    </p>
  </>
);

function pillsFor(sets: SetTiming[]): string[] {
  const out: string[] = [];
  const sum = exerciseTimingSummary(sets);
  if (sum.tut != null) out.push(`TUT ${fmtS(sum.tut)} · ${sum.tutSets} set${sum.tutSets === 1 ? "" : "s"}`);
  if (sum.conc != null || sum.ecc != null) {
    out.push(`mean concentric ${sum.conc != null ? fmtS(sum.conc) : "—"} · eccentric ${sum.ecc != null ? fmtS(sum.ecc) : "—"}`);
  }
  if (sum.ecRatio != null) out.push(`E:C ratio ${sum.ecRatio.toFixed(1)}`);
  const changes = [
    ["concentric", "concMean", concentricSetToSetChange(sets)],
    ["eccentric", "eccMean", eccentricSetToSetChange(sets)],
  ] as const;
  for (const [label, key, c] of changes) {
    if (c.ok) {
      const r = Math.round(c.change);
      out.push(`${label} ${r === 0 ? "0%" : r > 0 ? `+${r}%` : `−${Math.abs(r)}%`} · set ${c.firstSet} to ${c.lastSet}`);
    } else if (c.ok === false && sets.some((s) => s[key] != null)) {
      out.push(`${label} change: ${c.reason}`);
    }
  }
  return out;
}

interface RepTimingCardsProps extends GlowProps {
  exercises: ExerciseTiming[];
}

function TimingCard({ e, index, glow = false, onGlowClear }: { e: ExerciseTiming; index: number; glow?: boolean; onGlowClear?: () => void }) {
  // More sets than fit: draw MAX_VISIBLE_SETS of them and move that window one set at a time.
  const [offset, setOffset] = useState(0);
  const start = Math.min(Math.max(0, offset), Math.max(0, e.sets.length - MAX_VISIBLE_SETS));
  const visible = e.sets.slice(start, start + MAX_VISIBLE_SETS);
  return (
    <div className="v-card padded" style={{ position: "relative", ...glowStyle(glow) }} onClick={glow ? onGlowClear : undefined}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 10, minWidth: 0 }}>
            <div className="v-h2" style={{ color: "var(--ink-0)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={e.exercise}>
              {e.exercise}
            </div>
            <SetWindow total={e.sets.length} start={start} max={MAX_VISIBLE_SETS} onMove={setOffset} />
          </div>
          <div className="v-meta" style={{ fontSize: 11 }}>Mean eccentric and concentric time</div>
        </div>
        <StatsDetailMenu pills={pillsFor(e.sets)} info={TIMING_INFO} infoLabel="About eccentric and concentric time" idPrefix={`timing-${index}`} />
      </div>
      <TimingBars sets={visible} scaleSets={e.sets} />
    </div>
  );
}

/** SP-07: one "Rep timing" card per exercise. Nothing is blended across exercises. */
export function RepTimingCards({ exercises, glowExercise, onGlowClear }: RepTimingCardsProps) {
  if (exercises.length === 0) return <div className="v-meta">No reps recorded in this session.</div>;
  return (
    <div style={twoColumnGrid()}>
      {exercises.map((e, i) => (
        <TimingCard key={e.exercise} e={e} index={i} glow={glowExercise === e.exercise} onGlowClear={onGlowClear} />
      ))}
    </div>
  );
}
