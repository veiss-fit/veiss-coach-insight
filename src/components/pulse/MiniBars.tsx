interface MiniBarsProps {
  data: number[];
  labels?: string[];
  height?: number;
  accent?: string;
  /** Show each bar's value above it. */
  showValues?: boolean;
}

export function MiniBars({ data, labels, height = 36, accent = "var(--ink-0)", showValues = false }: MiniBarsProps) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginTop: 2 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          {showValues && (
            <span className="mono" style={{ fontSize: 9, color: "var(--ink-2)", lineHeight: 1 }}>{v > 0 ? v : " "}</span>
          )}
          <div
            style={{
              width: "100%",
              height: Math.max(2, (v / max) * (height - 14)),
              background: accent,
              opacity: 0.4 + 0.6 * (v / max),
              borderRadius: 2,
            }}
          />
          {labels && (
            <span style={{ fontSize: 9.5, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{labels[i]}</span>
          )}
        </div>
      ))}
    </div>
  );
}
