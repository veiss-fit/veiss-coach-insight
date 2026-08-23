import { Check } from "lucide-react";
import type { PlayerWithStats } from "@/services/playersService";
import { Avatar } from "./Avatar";
import { LoadRecChip } from "./chips";

interface AthletePickerProps {
  athletes: PlayerWithStats[];
  groupsList: Array<{ id: string; name: string }>;
  selected: string[];
  onToggle: (id: string) => void;
  onBulk: (ids: string[]) => void;
  filterGroup: string;
  setFilterGroup: (id: string) => void;
  loading: boolean;
}

/**
 * Shared recipient picker: group-filter dropdown + "select all"/"clear" +
 * a checkbox list of athletes. Used by both Send Programming and Messages so
 * "who do I send this to" is one interaction model, not two (D15).
 */
export function AthletePicker({ athletes, groupsList, selected, onToggle, onBulk, filterGroup, setFilterGroup, loading }: AthletePickerProps) {
  const list = athletes.filter((a) => filterGroup === "all" || a.team_id === filterGroup);
  return (
    <div className="v-card flush" style={{ overflow: "hidden" }}>
      <div style={{ padding: 14, borderBottom: "1px solid var(--line-0)", background: "var(--surface-2)" }}>
        <div className="v-label" style={{ marginBottom: 8 }}>
          Recipients{selected.length > 0 ? ` · ${selected.length} selected` : ""}
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <select
            className="v-input"
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            style={{ height: 32, minWidth: 150 }}
          >
            <option value="all">All groups</option>
            {groupsList.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <button className="v-btn" style={{ height: 32, fontSize: 12 }} onClick={() => onBulk(list.map((a) => a.id))}>
            Select all ({list.length})
          </button>
          <button className="v-btn ghost" style={{ height: 32, fontSize: 12 }} onClick={() => onBulk([])}>
            Clear
          </button>
        </div>
      </div>
      <div className="v-scroll" style={{ maxHeight: 320, overflow: "auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--ink-3)", fontSize: 12.5 }}>Loading athletes…</div>
        ) : list.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--ink-3)", fontSize: 12.5 }}>No athletes found</div>
        ) : (
          list.map((a) => {
            const on = selected.includes(a.id);
            return (
              <label
                key={a.id}
                className="row"
                style={{
                  gap: 10,
                  padding: "9px 14px",
                  borderBottom: "1px solid var(--line-0)",
                  cursor: "pointer",
                  background: on ? "var(--brand-soft)" : "transparent",
                }}
              >
                <span
                  style={{
                    width: 17, height: 17, borderRadius: 5, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "1.5px solid " + (on ? "var(--brand)" : "var(--line-2)"),
                    background: on ? "var(--brand)" : "var(--surface-1)",
                    color: "var(--brand-ink)",
                  }}
                >
                  {on && <Check size={12} strokeWidth={2} />}
                </span>
                <input type="checkbox" checked={on} onChange={() => onToggle(a.id)} style={{ display: "none" }} />
                <Avatar name={a.name} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{a.name}</div>
                  <div className="v-meta mono" style={{ fontSize: 10.5, color: "var(--ink-3)" }}>
                    {a.jersey_number != null ? `#${a.jersey_number} · ` : ""}{a.group || "—"}
                  </div>
                </div>
                <LoadRecChip rec={a.loadRec} />
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
