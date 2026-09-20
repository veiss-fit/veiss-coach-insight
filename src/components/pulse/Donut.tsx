// TODO(cleanup): unused, Index.tsx no longer shows the load recommendation mix. See temp/CLEANUP.md.
interface DonutSegment {
  value: number;
  color: string;
}

interface DonutProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string | number;
}

export function Donut({ segments, size = 96, thickness = 12, centerLabel, centerValue }: DonutProps) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-sunk)" strokeWidth={thickness} fill="none" />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const seg = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={s.color}
              strokeWidth={thickness}
              fill="none"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-off}
              strokeLinecap="butt"
            />
          );
          off += len + 1;
          return seg;
        })}
      </svg>
      {(centerValue != null || centerLabel) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          {centerValue != null && (
            <span className="num" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink-0)" }}>{centerValue}</span>
          )}
          {centerLabel && <span className="v-mute2" style={{ fontSize: 10 }}>{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}
