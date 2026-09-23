import { Delta } from "./Delta";
import { Sparkline } from "./Sparkline";
import { MiniBars } from "./MiniBars";

interface KpiTileProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number | null;
  deltaSuffix?: string;
  deltaInvert?: boolean;
  footnote?: string;
  sparkData?: number[];
  sparkTarget?: number;
  /** Labels for the start/end of the sparkline's time span, e.g. ["8 wks ago", "this wk"]. */
  sparkAxisLabels?: [string, string];
  accent?: string;
  /** Bars instead of a sparkline, e.g. per-week values. Takes precedence over sparkData. */
  barData?: number[];
  barLabels?: string[];
}

export function KpiTile({
  label,
  value,
  unit,
  delta,
  deltaSuffix,
  deltaInvert,
  footnote,
  sparkData,
  sparkTarget,
  sparkAxisLabels,
  accent,
  barData,
  barLabels,
}: KpiTileProps) {
  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, height: "100%", boxSizing: "border-box", overflow: "hidden" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="v-label">{label}</div>
        {delta != null && <Delta value={delta} suffix={deltaSuffix} invert={deltaInvert} />}
      </div>
      <div className="row" style={{ alignItems: "baseline", gap: 4 }}>
        <span className="num" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink-0)" }}>
          {value}
        </span>
        {unit && <span className="v-mute2 mono" style={{ fontSize: 11.5 }}>{unit}</span>}
        {footnote && <span className="v-mute2 mono" style={{ fontSize: 11.5 }}>{footnote}</span>}
      </div>
      {barData ? (
        <div style={{ marginTop: "auto" }}>
          <MiniBars data={barData} labels={barLabels} height={30} showValues accent={accent || "var(--brand)"} />
        </div>
      ) : (
        sparkData && (
          <div style={{ marginTop: 4 }}>
            <Sparkline data={sparkData} target={sparkTarget} stroke={accent || "var(--ink-0)"} fill="transparent" />
            {sparkAxisLabels && (
              <div className="row" style={{ justifyContent: "space-between", marginTop: 2 }}>
                <span className="v-mute2" style={{ fontSize: 9.5 }}>{sparkAxisLabels[0]}</span>
                <span className="v-mute2" style={{ fontSize: 9.5 }}>{sparkAxisLabels[1]}</span>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
