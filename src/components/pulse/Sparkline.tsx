interface SparklineProps {
  data: number[];
  height?: number;
  stroke?: string;
  fill?: string;
  showDot?: boolean;
  target?: number;
  min?: number;
  max?: number;
}

export function Sparkline({
  data,
  height = 28,
  stroke = "var(--ink-0)",
  fill = "rgba(7,16,31,0.06)",
  showDot = true,
  target,
  min,
  max,
}: SparklineProps) {
  const w = 100; // viewBox width
  if (!data || data.length < 2) return <div className="v-spark" />;
  const mn = min != null ? min : Math.min(...data);
  const mx = max != null ? max : Math.max(...data);
  const range = mx - mn || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - 2 - ((v - mn) / range) * (height - 6);
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => (i ? `L${x},${y}` : `M${x},${y}`)).join(" ");
  const area = `${d} L${pts[pts.length - 1][0]},${height} L${pts[0][0]},${height} Z`;
  const last = pts[pts.length - 1];
  const targetY = target != null ? height - 2 - ((target - mn) / range) * (height - 6) : null;
  return (
    <svg
      className="v-spark"
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      style={{ height, overflow: "visible" }}
    >
      {targetY != null && (
        <line x1="0" x2={w} y1={targetY} y2={targetY} stroke="var(--line-1)" strokeDasharray="2 2" strokeWidth="0.6" />
      )}
      <path d={area} fill={fill} />
      <path d={d} stroke={stroke} strokeWidth="1.4" fill="none" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {showDot && <circle cx={last[0]} cy={last[1]} r="2" fill={stroke} />}
    </svg>
  );
}
