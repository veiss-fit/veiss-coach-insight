import { Search } from "lucide-react";

export interface FilterGroup {
  id: string;
  name: string;
  color?: string;
  size?: number;
}

interface FilterBarProps {
  search: string;
  onSearch?: (q: string) => void;
  right?: React.ReactNode;
}

export function FilterBar({ search, onSearch, right }: FilterBarProps) {
  return (
    <div className="row" style={{ justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
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
