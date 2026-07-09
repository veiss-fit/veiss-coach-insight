import { Search } from "lucide-react";

export interface FilterGroup {
  id: string;
  name: string;
  color?: string;
  size?: number;
}

interface FilterBarProps {
  groups: FilterGroup[];
  value: string;
  onChange?: (id: string) => void;
  search: string;
  onSearch?: (q: string) => void;
  right?: React.ReactNode;
}

export function FilterBar({ groups, value, onChange, search, onSearch, right }: FilterBarProps) {
  return (
    <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {[{ id: "all", name: "All groups" } as FilterGroup, ...groups].map((g) => {
          const active = value === g.id;
          return (
            <button
              key={g.id}
              className="v-btn"
              onClick={() => onChange?.(g.id)}
              style={{
                height: 28,
                padding: "0 10px",
                fontSize: 12,
                background: active ? "var(--ink-0)" : "var(--surface-1)",
                color: active ? "#fff" : "var(--ink-1)",
                borderColor: active ? "var(--ink-0)" : "var(--line-1)",
                gap: 5,
              }}
            >
              {g.color && <span style={{ width: 6, height: 6, borderRadius: 999, background: g.color }} />}
              {g.name}
              {g.id !== "all" && g.size != null && (
                <span className="mono" style={{ marginLeft: 4, opacity: 0.6, fontSize: 10.5 }}>{g.size}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)", display: "inline-flex" }}>
            <Search size={14} strokeWidth={1.5} />
          </span>
          <input
            className="v-input"
            placeholder="Search athletes…"
            value={search}
            onChange={(e) => onSearch?.(e.target.value)}
            style={{ width: 220, paddingLeft: 28 }}
          />
        </div>
        {right}
      </div>
    </div>
  );
}
