import { ChevronLeft, ChevronRight } from "lucide-react";

/** Always drawn; greyed out and not clickable when there is nothing further to move to. */
const arrowStyle = (disabled: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, padding: 0,
  border: 0, background: "transparent", color: "var(--ink-1)", borderRadius: 4,
  cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.3 : 1,
});

/**
 * Set selector for a chart that can show `max` sets at once. Next to the exercise name:
 * the word "Sets", one tiny block per set (the shown window in yellow, the others dark) and
 * an arrow at each end that moves the window one set. Drawn for every exercise; with `max`
 * sets or fewer all blocks are yellow and both arrows are inactive.
 */
export function SetWindow({ total, start, max, onMove }: { total: number; start: number; max: number; onMove: (start: number) => void }) {
  const last = start >= total - max;
  return (
    <span className="row" style={{ gap: 3, flexShrink: 0 }} title={`Sets ${start + 1} to ${Math.min(total, start + max)} of ${total}`}>
      <span className="v-meta" style={{ fontSize: 11.5, marginRight: 3 }}>Sets</span>
      <button type="button" aria-label="Earlier sets" disabled={start === 0} onClick={() => onMove(start - 1)} style={arrowStyle(start === 0)}>
        <ChevronLeft size={14} strokeWidth={1.5} />
      </button>
      {Array.from({ length: total }).map((_, i) => {
        const shown = i >= start && i < start + max;
        return (
          <span
            key={i}
            style={{
              width: 7, height: 7, borderRadius: 2,
              background: shown ? "var(--brand)" : "var(--ink-0)",
              border: `1px solid ${shown ? "var(--brand)" : "var(--ink-0)"}`,
            }}
          />
        );
      })}
      <button type="button" aria-label="Later sets" disabled={last} onClick={() => onMove(start + 1)} style={arrowStyle(last)}>
        <ChevronRight size={14} strokeWidth={1.5} />
      </button>
    </span>
  );
}
