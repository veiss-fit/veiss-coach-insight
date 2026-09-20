import { useState } from "react";
import type { ExerciseSets, SetVelocitySummary } from "@/lib/metrics/setVelocitySummary";
import { exerciseLossSummary, withinSetVelocityLoss } from "@/lib/metrics/withinSetVelocityLoss";
import { setToSetChange } from "@/lib/metrics/setToSetChange";
import { velocityVsBaseline, type BaselineComparison, type HistorySession } from "@/lib/metrics/velocityVsBaseline";
import { StatsDetailMenu } from "./StatsDetailMenu";
import { SetWindow } from "./SetWindow";
import { twoColumnGrid } from "./twoColumnGrid";
import { glowStyle, type GlowProps } from "./glow";

const BAR_AREA = 120;
/** Room above the tallest bar for its value label. */
const HEADROOM = 28;
const BAR_W = 30;
const BAR_GAP = 4;
const GROUP_W = BAR_W * 3 + BAR_GAP * 2;
/** Shortest last-rep bar that can hold the loss text inside it. Shorter bars show it above the bar instead. */
const MIN_BAR_FOR_INSIDE_TEXT = 18;

const LAST_COLOR = "var(--ink-2)";
const LOSS_TITLE = "Velocity loss: last valid rep vs fastest rep";

interface SetVelocityBarsProps {
  /** The sets to draw (at most MAX_VISIBLE_SETS from SetVelocityBlocks). */
  sets: SetVelocitySummary[];
  /** Every set of the exercise, for the bar scale, so the bars do not rescale when the window moves. Defaults to `sets`. */
  scaleSets?: SetVelocitySummary[];
  /** SP-04 baseline (m/s). Drawn as a dashed line at fastest-rep scale with its label at the right. */
  baseline?: number | null;
}

const BASELINE_LABEL_W = 60;
/** Most sets drawn at once (with the baseline label, bars get too close beyond this). More sets scroll one at a time. Not tuned on screen yet. */
const MAX_VISIBLE_SETS = 3;

/**
 * SP-01 + SP-02 for one exercise. Per set: fastest rep (gold), mean (light) and,
 * when the set has enough valid reps, the last valid rep (dark) with the
 * velocity loss written inside it, centered. Sets with too few valid reps get
 * dashed bars, no last-rep bar and no loss. Under each set, one square per
 * attempted rep (filled = valid, dashed = invalid).
 */
export function SetVelocityBars({ sets, scaleSets = sets, baseline = null }: SetVelocityBarsProps) {
  const top = Math.max(...scaleSets.map((s) => s.vBest ?? 0), baseline ?? 0, 0);
  const max = top > 0 ? top * 1.1 : 1;
  const px = (v: number) => Math.max(2, (v / max) * BAR_AREA);
  /** Signed % of a velocity against the baseline, null without a baseline. */
  const vsBase = (v: number) => (baseline != null && baseline > 0 ? signedInt(Math.round(((v - baseline) / baseline) * 100)) : null);

  return (
    <div>
      <div className="row" style={{ gap: 12, alignItems: "flex-end" }}>
        {sets.map((s) => {
          const loss = withinSetVelocityLoss(s);
          const gated = !loss.ok;
          const pxLast = loss.ok ? px(loss.vLast) : 0;
          const lossText = loss.ok ? formatLoss(loss.loss) : null;
          const fitsInside = pxLast >= MIN_BAR_FOR_INSIDE_TEXT;
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
                  position: "relative",
                }}
              >
                {baseline != null && (
                  <div
                    aria-hidden
                    style={{ position: "absolute", left: 0, right: 0, bottom: px(baseline), borderTop: "1.5px dashed var(--ink-2)", opacity: 0.5, pointerEvents: "none" }}
                  />
                )}
                {s.vBest == null || s.vMean == null ? (
                  <span className="mono" style={{ fontSize: 11.5, alignSelf: "center", color: "var(--ink-1)" }}>no valid reps</span>
                ) : (
                  <div style={{ position: "relative", width: "100%", maxWidth: GROUP_W, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: BAR_GAP }}>
                    <Bar value={s.vBest} height={px(s.vBest)} color="var(--brand)" opacity={gated ? 0.3 : 1} dashed={gated} vsBaseline={gated ? null : vsBase(s.vBest)} />
                    <Bar value={s.vMean} height={px(s.vMean)} color="var(--ink-0)" opacity={gated ? 0.12 : 0.3} dashed={gated} />
                    {loss.ok && (
                      <Bar
                        value={loss.vLast}
                        height={pxLast}
                        color={LAST_COLOR}
                        vsBaseline={vsBase(loss.vLast)}
                       
                        insideText={fitsInside ? lossText : null}
                        annotation={fitsInside ? null : <LossText text={lossText!} />}
                      />
                    )}
                  </div>
                )}
              </div>
              <div className="row mono" style={{ fontSize: 11.5, color: "var(--ink-1)", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                Set {s.set_number}
                <span
                  style={{ fontWeight: 600, color: "var(--ink-0)", background: "var(--brand)", padding: "1px 6px", borderRadius: 4 }}
                  title={s.load == null ? "No load recorded" : "Set load (unit not verified)"}
                >
                  {s.load == null ? "NA" : `${s.load} lbs`}
                </span>
              </div>
              <div className="row" style={{ gap: 3, flexWrap: "wrap", justifyContent: "center" }} title={`${s.n} valid, ${s.invalid} invalid`}>
                {s.reps.map((r) => (
                  <span
                    key={r.rep_number}
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 2,
                      background: r.velocity == null ? "transparent" : "var(--ink-0)",
                      border: r.velocity == null ? "1px dashed var(--ink-3)" : "1px solid var(--ink-0)",
                    }}
                  />
                ))}
              </div>
              <div className="v-meta mono" style={{ fontSize: 11.5, color: "var(--ink-1)" }}>
                {s.n} rep{s.n === 1 ? "" : "s"}
                {s.invalid > 0 ? ` · ${s.invalid} invalid` : ""}
              </div>
            </div>
          );
        })}
        {baseline != null && (
          <div style={{ width: BASELINE_LABEL_W, flexShrink: 0, height: BAR_AREA + HEADROOM, position: "relative", alignSelf: "flex-start" }}>
            <div
              className="mono"
              style={{ position: "absolute", left: 0, bottom: px(baseline) - 13, fontSize: 11.5, lineHeight: "13px", color: "var(--ink-1)", whiteSpace: "nowrap" }}
            >
              baseline<br />
              <strong style={{ fontWeight: 600, color: "var(--ink-0)" }}>{baseline.toFixed(2)}</strong>
            </div>
          </div>
        )}
      </div>
      <div className="row v-meta" style={{ gap: 14, marginTop: 10, fontSize: 11.5, color: "var(--ink-1)", flexWrap: "wrap" }}>
        <span className="row" style={{ gap: 5 }}><Swatch color="var(--brand)" /> fastest rep</span>
        <span className="row" style={{ gap: 5 }}><Swatch color="var(--ink-0)" opacity={0.3} /> mean</span>
        <span className="row" style={{ gap: 5 }}><Swatch color={LAST_COLOR} /> last rep</span>
        <span className="mono" style={{ color: "var(--ink-1)" }}>m/s</span>
        {baseline == null && <span className="mono" style={{ color: "var(--ink-2)" }}>No baseline specified</span>}
      </div>
    </div>
  );
}

/** Loss is always >= 0 (last rep cannot beat the fastest). Shown as a signed drop. */
function formatLoss(loss: number): string {
  const rounded = Math.round(loss);
  return rounded === 0 ? "0%" : `−${rounded}%`;
}

function LossText({ text }: { text: string }) {
  return (
    <span
      className="mono"
      title={LOSS_TITLE}
      style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-0)", whiteSpace: "nowrap", marginBottom: 2, lineHeight: "12px" }}
    >
      {text}
    </span>
  );
}

interface BarProps {
  value: number;
  height: number;
  color: string;
  opacity?: number;
  dashed?: boolean;
  annotation?: React.ReactNode;
  /** Text centered inside the bar (white on the bar colour). */
  insideText?: string | null;
  /** Signed % against the baseline, written above the value. */
  vsBaseline?: string | null;
}

function Bar({ value, height, color, opacity = 1, dashed = false, annotation, insideText, vsBaseline }: BarProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", flex: `1 1 0`, minWidth: 0, maxWidth: BAR_W }}>
      {annotation}
      {vsBaseline && (
        <span className="mono" title="Change vs baseline" style={{ fontSize: 10.5, color: "var(--ink-1)", whiteSpace: "nowrap", lineHeight: "12px" }}>
          {vsBaseline}
        </span>
      )}
      <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-1)", marginBottom: 2 }}>{value.toFixed(2)}</span>
      {dashed ? (
        <div style={{ width: "100%", height, boxSizing: "border-box", background: `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, transparent)`, border: "1.5px dashed var(--ink-2)", borderBottom: "none", borderRadius: "2px 2px 0 0" }} />
      ) : (
        <div
          style={{ width: "100%", height, background: color, opacity, borderRadius: "2px 2px 0 0", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {insideText && (
            <span
              className="mono"
              title={LOSS_TITLE}
              style={{ fontSize: 10.5, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", lineHeight: 1 }}
            >
              {insideText}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Swatch({ color, opacity = 1 }: { color: string; opacity?: number }) {
  return <span style={{ width: 10, height: 10, borderRadius: 2, background: color, opacity }} />;
}

const LOSS_INFO = (
  <>
  <p style={{ margin: 0 }}>
    <strong>Velocity loss</strong> is how much slower the last rep of a set was than its fastest rep. The median is the
    middle value across this exercise's sets that have at least 2 valid reps.
  </p>
  <p style={{ margin: "6px 0 0" }}>
    <strong>Set-to-set</strong> is the change in average velocity from the first set to the last set of the exercise.
    It is only calculated when both sets used the same known load.
  </p>
  <p style={{ margin: "6px 0 0" }}>
    <strong>Vs baseline</strong> compares this session's average fastest rep with an exponentially weighted average of
    earlier sessions of this exercise in the last 42 days (recent sessions count more). It is matched on load when the
    load is known; otherwise all sets are pooled and it is marked not load-matched.
  </p>
  <p style={{ margin: "6px 0 0" }}>
    The <strong>% above each bar</strong> is that bar's velocity against the same baseline: the fastest rep and the last
    valid rep of the set. It is not shown without a baseline.
  </p>
  </>
);

const signedInt = (r: number) => (r === 0 ? "0%" : r > 0 ? `+${r}%` : `−${Math.abs(r)}%`);

function lossSummaryText(sets: SetVelocitySummary[]): string | null {
  const s = exerciseLossSummary(sets);
  if (!s) return null;
  return `median loss ${s.median.toFixed(0)}% · ${s.sets} set${s.sets === 1 ? "" : "s"}`;
}

function setToSetText(sets: SetVelocitySummary[]): string | null {
  if (sets.filter((s) => s.n >= 1).length < 2) return null;
  const c = setToSetChange(sets);
  if (c.ok === false) return `set-to-set: ${c.reason}`;
  return `set-to-set ${signedInt(Math.round(c.change))}`;
}

function baselineTexts(c: BaselineComparison) {
  if (c.ok === false) return { main: `vs baseline: ${c.reason}`, badge: null as string | null };
  const r = Math.round(c.change);
  const dir = r === 0 ? "" : r > 0 ? "faster" : "slower";
  return {
    main: `vs baseline ${signedInt(r)}${dir ? ` (${dir})` : ""} · ${c.nBaseline} session${c.nBaseline === 1 ? "" : "s"}`,
    badge: c.tier === "B" ? "not load-matched" : null,
  };
}

interface ExerciseBlockProps {
  exercise: ExerciseSets;
  history: HistorySession[];
  sessionDate: string;
  idPrefix: string;
  glow?: boolean;
  onGlowClear?: () => void;
}

function ExerciseBlock({ exercise: e, history, sessionDate, idPrefix, glow = false, onGlowClear }: ExerciseBlockProps) {
  const cmp = velocityVsBaseline(e.sets, sessionDate, history);
  const b = baselineTexts(cmp);
  const pills = [lossSummaryText(e.sets), setToSetText(e.sets), b.main, b.badge].filter((t): t is string => !!t);
  // More sets than fit: draw MAX_VISIBLE_SETS of them and move that window one set at a time.
  // The bars stay where they are, only the sets shown in them change.
  const overflow = e.sets.length > MAX_VISIBLE_SETS;
  const [offset, setOffset] = useState(0);
  const start = Math.min(Math.max(0, offset), Math.max(0, e.sets.length - MAX_VISIBLE_SETS));
  const visible = overflow ? e.sets.slice(start, start + MAX_VISIBLE_SETS) : e.sets;
  return (
    <div className="v-card padded" style={{ position: "relative", ...glowStyle(glow) }} onClick={glow ? onGlowClear : undefined}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div className="row" style={{ gap: 10, minWidth: 0 }}>
          <div className="v-h2" style={{ color: "var(--ink-0)" }}>{e.exercise}</div>
          <SetWindow total={e.sets.length} start={start} max={MAX_VISIBLE_SETS} onMove={setOffset} />
        </div>
        <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
          <StatsDetailMenu pills={pills} info={LOSS_INFO} infoLabel="About velocity loss" idPrefix={idPrefix} />
        </div>
      </div>
      <SetVelocityBars sets={visible} scaleSets={e.sets} baseline={cmp.ok ? cmp.baseline : null} />
    </div>
  );
}

interface SetVelocityBlocksProps extends GlowProps {
  exercises: ExerciseSets[];
  /** Earlier sessions per exercise name, for the SP-04 baseline. */
  history?: Record<string, HistorySession[]>;
  /** Date of the session shown. The baseline window ends here. Defaults to now. */
  sessionDate?: string;
}

/** One card per exercise, two per row when there is room. Nothing is blended across exercises. */
export function SetVelocityBlocks({ exercises, history = {}, sessionDate, glowExercise, onGlowClear }: SetVelocityBlocksProps) {
  if (exercises.length === 0) {
    return <div className="v-meta">No reps recorded in this session.</div>;
  }
  const date = sessionDate ?? new Date().toISOString();
  return (
    <div style={twoColumnGrid()}>
      {exercises.map((e, i) => (
        <ExerciseBlock key={e.exercise} exercise={e} history={history[e.exercise] ?? []} sessionDate={date} idPrefix={`sv-${i}`} glow={glowExercise === e.exercise} onGlowClear={onGlowClear} />
      ))}
    </div>
  );
}
