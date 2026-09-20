import { useState } from "react";
import type { ExerciseRom, SetRom } from "@/lib/metrics/rangeOfMotion";
import { romConsistency, romSetToSetChange } from "@/lib/metrics/rangeOfMotion";
import { niceTicks, SET_COLORS, useMeasuredWidth } from "./charts";
import { StatsDetailMenu } from "./StatsDetailMenu";
import { twoColumnGrid } from "./twoColumnGrid";
import { glowStyle, type GlowProps } from "./glow";

const HEIGHT = 190;
const PL = 52;
const PR = 10;
const PT = 10;
const PB = 40;

const cm = (mm: number) => mm / 10;

/** Fade duration for the hover label and the dimmed lines, ms. */
const FADE_MS = 160;
const LABEL_W = 96;
const LABEL_H = 36;
const DIM_OPACITY = 0.15;

const signedPct = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return r === 0 ? "0%" : r > 0 ? `+${r.toFixed(1)}%` : `−${Math.abs(r).toFixed(1)}%`;
};

/**
 * SP-06 chart: one line per set, one point per counted rep (x = rep number,
 * y = ROM in cm). A line breaks where a rep is missing or not counted.
 */
function RomLines({ sets }: { sets: SetRom[] }) {
  const { ref, width: w } = useMeasuredWidth<HTMLDivElement>(480);
  const [hover, setHover] = useState<{ set: number; rep: number } | null>(null);
  /** Sets picked in the legend. Empty = nothing picked, every line at full opacity. */
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const all = sets.flatMap((s) => s.points.map((p) => cm(p.mm)));
  if (all.length === 0) {
    return (
      <div ref={ref} className="v-meta" style={{ padding: "24px 0" }}>
        No reps with a range of motion recorded.
      </div>
    );
  }
  const ticks = niceTicks(Math.min(...all) - 0.5, Math.max(...all) + 0.5, 4);
  const mn = ticks[0];
  const mx = ticks[ticks.length - 1];
  const range = mx - mn || 1;
  const maxRep = Math.max(1, ...sets.flatMap((s) => s.points.map((p) => p.rep_number)));
  const cW = Math.max(60, w - PL - PR);
  const cH = HEIGHT - PT - PB;
  const x = (rep: number) => (maxRep <= 1 ? PL + cW / 2 : PL + ((rep - 1) / (maxRep - 1)) * cW);
  const y = (v: number) => PT + cH - ((v - mn) / range) * cH;
  const drawn = sets.filter((s) => s.points.length > 0);
  const colorOf = (setNumber: number) => SET_COLORS[sets.findIndex((s) => s.set_number === setNumber) % SET_COLORS.length];

  return (
    <div ref={ref} style={{ width: "100%", minWidth: 0 }}>
      <svg width={w} height={HEIGHT} style={{ display: "block" }} role="img" aria-label="Range of motion per rep, one line per set">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PL} x2={PL + cW} y1={y(t)} y2={y(t)} stroke="var(--line-0)" strokeWidth="1" />
            <text x={PL - 8} y={y(t) + 3} textAnchor="end" fontSize="11.5" fontFamily="var(--font-mono)" fill="var(--ink-1)">
              {t}
            </text>
          </g>
        ))}
        <text
          transform={`translate(11,${PT + cH / 2}) rotate(-90)`}
          textAnchor="middle"
          fontSize="11.5"
          fontFamily="var(--font-mono)"
          fill="var(--ink-1)"
        >
          Range of motion (cm)
        </text>
        <line x1={PL} x2={PL + cW} y1={PT + cH} y2={PT + cH} stroke="var(--line-2)" strokeWidth="1.2" />
        {Array.from({ length: maxRep }, (_, i) => i + 1).map((rn) => (
          <text key={rn} x={x(rn)} y={PT + cH + 16} textAnchor="middle" fontSize="11.5" fontFamily="var(--font-mono)" fill="var(--ink-1)">
            {rn}
          </text>
        ))}
        <text x={PL + cW / 2} y={HEIGHT - 4} textAnchor="middle" fontSize="11.5" fontFamily="var(--font-mono)" fill="var(--ink-1)">
          rep
        </text>
        {drawn.map((s) => {
          const color = colorOf(s.set_number);
          // Hovering a point wins; otherwise lines outside the legend selection fade.
          const dimmed = hover != null ? hover.set !== s.set_number : picked.size > 0 && !picked.has(s.set_number);
          // Break the line wherever consecutive counted reps are not adjacent rep numbers.
          const path = s.points
            .map((p, i) => `${i === 0 || p.rep_number !== s.points[i - 1].rep_number + 1 ? "M" : "L"}${x(p.rep_number)},${y(cm(p.mm))}`)
            .join(" ");
          return (
            <g key={s.set_number} style={{ opacity: dimmed ? DIM_OPACITY : 1, transition: `opacity ${FADE_MS}ms ease` }}>
              <path d={path} stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
              {s.points.map((p) => (
                <circle key={p.rep_number} cx={x(p.rep_number)} cy={y(cm(p.mm))} r="4" fill={color} stroke="var(--surface-1)" strokeWidth="1.5" />
              ))}
            </g>
          );
        })}
        {drawn.map((s) =>
          s.points.map((p, i) => {
            const active = hover?.set === s.set_number && hover.rep === p.rep_number;
            // Drop against the previous counted rep of the same set. The first rep has nothing to compare with.
            const prev = i > 0 ? s.points[i - 1] : null;
            const change = prev ? ((p.mm - prev.mm) / prev.mm) * 100 : null;
            const cx = x(p.rep_number);
            const cy = y(cm(p.mm));
            const lx = Math.min(Math.max(cx - LABEL_W / 2, 0), Math.max(0, w - LABEL_W));
            const above = cy - LABEL_H - 10 >= 0;
            const ly = above ? cy - LABEL_H - 10 : cy + 10;
            return (
              <g key={`${s.set_number}-${p.rep_number}`}>
                <g style={{ opacity: active ? 1 : 0, transition: `opacity ${FADE_MS}ms ease`, pointerEvents: "none" }}>
                  <rect x={lx} y={ly} width={LABEL_W} height={LABEL_H} rx="6" fill="var(--ink-0)" />
                  <text x={lx + LABEL_W / 2} y={ly + 14} textAnchor="middle" fontSize="11" fontWeight="600" fontFamily="var(--font-mono)" fill="#fff">
                    {cm(p.mm).toFixed(1)} cm
                  </text>
                  <text x={lx + LABEL_W / 2} y={ly + 28} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="#fff">
                    {change == null ? "first rep" : `${signedPct(change)} vs prev`}
                  </text>
                </g>
                <circle
                  cx={cx}
                  cy={cy}
                  r="9"
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`Set ${s.set_number}, rep ${p.rep_number}, ${cm(p.mm).toFixed(1)} cm`}
                  style={{ cursor: "pointer", outline: "none" }}
                  onMouseEnter={() => setHover({ set: s.set_number, rep: p.rep_number })}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover({ set: s.set_number, rep: p.rep_number })}
                  onBlur={() => setHover(null)}
                />
              </g>
            );
          }),
        )}
      </svg>
      <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: "wrap" }} role="group" aria-label="Highlight sets">
        {drawn.map((s) => {
          const on = picked.has(s.set_number);
          return (
            <button
              key={s.set_number}
              type="button"
              className="v-btn"
              aria-pressed={on}
              onClick={() =>
                setPicked((prev) => {
                  const next = new Set(prev);
                  if (next.has(s.set_number)) next.delete(s.set_number);
                  else next.add(s.set_number);
                  // Every set picked is the same as none picked: clear.
                  return next.size === drawn.length ? new Set() : next;
                })
              }
              style={{
                height: 28,
                padding: "0 10px",
                fontSize: 12,
                gap: 6,
                background: on ? "var(--ink-0)" : "var(--surface-1)",
                color: on ? "#fff" : "var(--ink-1)",
                borderColor: on ? "var(--ink-0)" : "var(--line-1)",
              }}
            >
              <span style={{ width: 14, height: 3, borderRadius: 2, background: colorOf(s.set_number) }} />
              Set {s.set_number}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const ROM_INFO = (
  <>
    <p style={{ margin: 0 }}>
      <strong>Range of motion</strong> per rep, one line per set. Reps with no recorded range, or with an invalid velocity, are left out.
    </p>
    <p style={{ margin: "6px 0 0" }}>
      <strong>ROM change</strong> is the change in average range from the first to the last set of the exercise.
    </p>
    <p style={{ margin: "6px 0 0" }}>
      <strong>Consistency</strong> is how much the range varies from rep to rep within a set (standard deviation as a % of the mean),
      shown as the median across sets with at least 2 counted reps.
    </p>
  </>
);

function pillsFor(sets: SetRom[]): string[] {
  const out: string[] = [];
  const c = romSetToSetChange(sets);
  if (c.ok) {
    const r = Math.round(c.change);
    out.push(`ROM change ${r === 0 ? "0%" : r > 0 ? `+${r}%` : `−${Math.abs(r)}%`} · set ${c.firstSet} to ${c.lastSet}`);
  } else if (c.ok === false && sets.some((s) => s.points.length > 0)) {
    out.push(`ROM change: ${c.reason}`);
  }
  const k = romConsistency(sets);
  if (k) out.push(`ROM consistency CV ${k.medianCv.toFixed(1)}% · ${k.sets} set${k.sets === 1 ? "" : "s"}`);
  return out;
}

interface RangeOfMotionCardsProps extends GlowProps {
  exercises: ExerciseRom[];
}

/** SP-06: one "Range of motion" card per exercise. Nothing is blended across exercises. */
export function RangeOfMotionCards({ exercises, glowExercise, onGlowClear }: RangeOfMotionCardsProps) {
  if (exercises.length === 0) return <div className="v-meta">No reps recorded in this session.</div>;
  return (
    <div style={twoColumnGrid()}>
      {exercises.map((e, i) => (
        <div
          key={e.exercise}
          className="v-card padded"
          style={{ position: "relative", ...glowStyle(glowExercise === e.exercise) }}
          onClick={glowExercise === e.exercise ? onGlowClear : undefined}
        >
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div className="v-h2" style={{ color: "var(--ink-0)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={e.exercise}>
                {e.exercise}
              </div>
              <div className="v-meta" style={{ fontSize: 11 }}>Range of motion</div>
            </div>
            <StatsDetailMenu pills={pillsFor(e.sets)} info={ROM_INFO} infoLabel="About range of motion" idPrefix={`rom-${i}`} />
          </div>
          <RomLines sets={e.sets} />
        </div>
      ))}
    </div>
  );
}
