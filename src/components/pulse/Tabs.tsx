export interface UnderlineTab {
  id: string;
  label: string;
  count?: number;
}

interface UnderlineTabsProps {
  tabs: UnderlineTab[];
  active: string;
  onChange: (id: string) => void;
}

/** Design-system underline tabs (distinct from the shadcn pill Tabs). */
export function UnderlineTabs({ tabs, active, onChange }: UnderlineTabsProps) {
  return (
    <div className="row" style={{ gap: 0, borderBottom: "1px solid var(--line-0)", padding: 0, marginTop: 4 }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            position: "relative",
            border: "none",
            background: "transparent",
            padding: "10px 14px",
            font: "inherit",
            fontSize: 13,
            fontWeight: 500,
            color: active === t.id ? "var(--ink-0)" : "var(--ink-2)",
            cursor: "pointer",
          }}
        >
          {t.label}
          {t.count != null && (
            <span className="mono v-mute2" style={{ marginLeft: 6, fontSize: 11 }}>{t.count}</span>
          )}
          {active === t.id && (
            <span
              style={{
                position: "absolute",
                left: 12,
                right: 12,
                bottom: -1,
                height: 2,
                background: "var(--ink-0)",
                borderRadius: 999,
              }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
