interface MiniBarsProps {
  data: number[];
  labels?: string[];
  height?: number;
  accent?: string;
}

export function MiniBars({ data, labels, height = 36, accent = "var(--ink-0)" }: MiniBarsProps) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height, marginTop: 2 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
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
