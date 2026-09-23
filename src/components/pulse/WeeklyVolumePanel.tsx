import { useRef, useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BetaBadge, MetricInfoTip } from "./BetaBadge";
import {
  METRIC_LABEL,
  METRIC_UNIT,
  fmtLoadVolumeVal,
  type LoadVolumeMetric,
  type WeeklyLoadVolumePoint,
} from "./WeeklyLoadVolumeBetaCard";

export type WeeklyVolumePoint = WeeklyLoadVolumePoint;

export interface WeeklyVolumePanelProps {
  /** 8 weeks, oldest first. Only tonnageLbs is real (SP-08); totalWorkKj/distanceM are mock — see BetaBadge. */
  data: WeeklyVolumePoint[];
  /** Share of reps in this window that carry a recorded weight and so count toward the totals (0-100). */
  coveragePct: number;
}

function useMeasuredSize<T extends HTMLElement>(fallback: { width: number; height: number }) {
  const ref = useRef<T>(null);
  const [size, setSize] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) =>
      setSize({ width: e.contentRect.width || fallback.width, height: e.contentRect.height || fallback.height })
    );
    ro.observe(ref.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { ref, ...size };
}

const PL = 8, PR = 8, PT = 18, PB = 20;

/**
 * SP-08 team-wide, 8 weeks, with a metric picker matching WeeklyLoadVolumeBetaCard (the
 * per-athlete Performance-tab version). Only Tonnage is real; Total work and Bar distance
 * aren't computed yet, hence BetaBadge — see that card's doc comment for why they're mock.
 */
export function WeeklyVolumePanel({ data, coveragePct }: WeeklyVolumePanelProps) {
  const [metric, setMetric] = useState<LoadVolumeMetric>("tonnageLbs");
  const { ref, width: w, height } = useMeasuredSize<HTMLDivElement>({ width: 400, height: 130 });
  const cW = Math.max(50, w - PL - PR);
  const cH = Math.max(20, height - PT - PB);
  const mx = Math.max(1, ...data.map((d) => d[metric]));
  const step = data.length ? cW / data.length : cW;
  const bw = step * 0.6;

  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0, height: "100%", boxSizing: "border-box" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div className="v-label">Weekly volume</div>
        <div className="row" style={{ gap: 6 }}>
          <Select value={metric} onValueChange={(m) => setMetric(m as LoadVolumeMetric)}>
            <SelectTrigger aria-label="Metric" style={{ height: 24, width: "auto", minWidth: 0, fontSize: 11, gap: 4, padding: "0 8px" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(METRIC_LABEL) as LoadVolumeMetric[]).map((m) => (
                <SelectItem key={m} value={m} style={{ fontSize: 12 }}>{METRIC_LABEL[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="row" style={{ gap: 4 }}>
            <BetaBadge />
            <MetricInfoTip label="About weekly volume" text="Team-wide weekly tonnage, total work, and bar distance, averaged across the roster." />
          </span>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="v-meta" style={{ padding: "8px 0" }}>No weight-recorded reps in the last 8 weeks.</div>
      ) : (
        <>
          <div ref={ref} style={{ width: "100%", minWidth: 0, flex: 1, minHeight: 0, overflow: "hidden", position: "relative" }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
              {data.map((d, i) => {
                const x = PL + i * step + (step - bw) / 2;
                const barH = mx > 0 ? (d[metric] / mx) * cH : 0;
                const y = PT + cH - barH;
                return <rect key={i} x={x} y={y} width={bw} height={barH} rx="2" fill="var(--brand)" opacity="0.85" />;
              })}
            </svg>
            {/* Labels rendered as fixed-size HTML, not scaled SVG text — same px size regardless of chart size, matching MiniBars. */}
            {data.map((d, i) => {
              const x = PL + i * step + (step - bw) / 2;
              const barH = mx > 0 ? (d[metric] / mx) * cH : 0;
              const y = PT + cH - barH;
              const left = ((x + bw / 2) / w) * 100;
              const top = ((y - 4) / height) * 100;
              return (
                <div key={i} style={{ position: "absolute", left: `${left}%`, top: `${top}%`, transform: "translate(-50%, -100%)", fontSize: 9.5, fontFamily: "var(--font-mono)", color: "var(--ink-2)", whiteSpace: "nowrap" }}>
                  {fmtLoadVolumeVal(metric, d[metric])}
                </div>
              );
            })}
            {data.map((d, i) => {
              const x = PL + i * step + (step - bw) / 2;
              const left = ((x + bw / 2) / w) * 100;
              const top = ((PT + cH + 4) / height) * 100;
              return (
                <div key={`l-${i}`} style={{ position: "absolute", left: `${left}%`, top: `${top}%`, transform: "translateX(-50%)", fontSize: 9.5, fontFamily: "var(--font-mono)", color: "var(--ink-3)", whiteSpace: "nowrap" }}>
                  {d.label}
                </div>
              );
            })}
          </div>
          <div className="v-meta" style={{ fontSize: 10.5 }} title="Only reps with a recorded weight count toward these totals; unit not verified.">
            {METRIC_UNIT[metric]} · based on {coveragePct.toFixed(0)}% of reps with a recorded weight
          </div>
        </>
      )}
    </div>
  );
}
