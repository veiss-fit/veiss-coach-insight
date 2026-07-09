interface AttBarProps {
  pct: number;
  width?: number;
  accent?: string;
}

export function AttBar({ pct, width = 60, accent }: AttBarProps) {
  const tone = pct >= 85 ? "var(--good)" : pct >= 70 ? "var(--warn)" : "var(--bad)";
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span className="mono" style={{ fontSize: 12, color: "var(--ink-0)", minWidth: 28, textAlign: "right" }}>
        {pct}%
      </span>
      <div style={{ width, height: 4, background: "var(--surface-sunk)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: accent || tone, borderRadius: 999 }} />
      </div>
    </div>
  );
}
