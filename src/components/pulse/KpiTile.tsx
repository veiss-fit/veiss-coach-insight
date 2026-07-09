import { Delta } from "./Delta";
import { Sparkline } from "./Sparkline";

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
  accent?: string;
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
  accent,
}: KpiTileProps) {
  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="v-label">{label}</div>
        {delta != null && <Delta value={delta} suffix={deltaSuffix} invert={deltaInvert} />}
      </div>
      <div className="row" style={{ alignItems: "baseline", gap: 4 }}>
        <span className="num" style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink-0)" }}>
          {value}
        </span>
        {unit && <span className="v-mute2 mono" style={{ fontSize: 12 }}>{unit}</span>}
      </div>
      {footnote && <div className="v-meta" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{footnote}</div>}
      {sparkData && (
        <div style={{ marginTop: 4 }}>
          <Sparkline data={sparkData} target={sparkTarget} stroke={accent || "var(--ink-0)"} fill="transparent" />
        </div>
      )}
    </div>
  );
}
