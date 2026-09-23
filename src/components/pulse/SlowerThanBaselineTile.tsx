import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const VISIBLE_ROWS = 3;
const DROP_THRESHOLD = 10;

export interface SlowerAthlete {
  playerId: string;
  name: string;
  /** Percent change vs the athlete's own baseline, signed (negative = slower). */
  change: number;
  /** The latest session compared against the baseline, for opening/highlighting it. */
  sessionId: string | null;
}

export interface SlowerThanBaselineTileProps {
  /** Exercises trained by at least one athlete in the 6-week baseline window. */
  exercises: string[];
  selectedExercise: string;
  onExerciseChange: (exercise: string) => void;
  /** Athletes who trained the selected exercise in the baseline window, worst change first. */
  athletes: SlowerAthlete[];
  /** Opens that athlete's session for the selected exercise, same as a Drop cell in the roster table. */
  onOpenAthlete?: (athlete: SlowerAthlete, exercise: string) => void;
}

export function SlowerThanBaselineTile({
  exercises,
  selectedExercise,
  onExerciseChange,
  athletes,
  onOpenAthlete,
}: SlowerThanBaselineTileProps) {
  const slower = athletes.filter((a) => a.change <= -DROP_THRESHOLD);
  const visible = slower.slice(0, VISIBLE_ROWS);
  const more = slower.length - visible.length;
  const maxAbs = Math.max(DROP_THRESHOLD, ...visible.map((a) => Math.abs(a.change)));

  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, height: "100%", boxSizing: "border-box", overflow: "hidden" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div className="v-label">Slower than baseline</div>
        <div className="row" style={{ gap: 8, minWidth: 0, justifyContent: "space-between" }}>
          <span className="v-meta" style={{ fontSize: 9.5, color: "var(--ink-3)", flexShrink: 0 }}>Top 3</span>
          <Select value={selectedExercise} onValueChange={onExerciseChange}>
            <SelectTrigger aria-label="Exercise" style={{ height: 20, width: "auto", minWidth: 0, maxWidth: 150, fontSize: 10.5, gap: 4, padding: "0 8px" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {exercises.map((ex) => (
                <SelectItem key={ex} value={ex} style={{ fontSize: 12 }}>
                  {ex}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 8, minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
          {Array.from({ length: VISIBLE_ROWS }, (_, i) => visible[i]).map((a, i) =>
            a ? (
              (() => {
                const w = Math.min(100, (Math.abs(a.change) / maxAbs) * 100);
                const clickable = !!onOpenAthlete;
                return (
                  <button
                    key={a.playerId}
                    type="button"
                    disabled={!clickable}
                    onClick={() => onOpenAthlete?.(a, selectedExercise)}
                    className="row"
                    style={{
                      gap: 8, minWidth: 0, border: 0, background: "transparent", padding: 0,
                      cursor: clickable ? "pointer" : "default", font: "inherit", textAlign: "left",
                    }}
                  >
                    <span className="ellipsis" style={{ flex: 1, minWidth: 0, fontSize: 11, color: "var(--ink-1)" }}>{a.name}</span>
                    <div className="row" style={{ flex: 1, minWidth: 0, gap: 6 }}>
                      <div style={{ flex: 1, height: 6, background: "var(--surface-2)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${w}%`, height: "100%", background: "var(--bad)" }} />
                      </div>
                      <span className="mono" style={{ width: 28, flexShrink: 0, textAlign: "right", fontSize: 10.5, fontWeight: 600, color: "var(--bad)" }}>
                        {a.change.toFixed(0)}%
                      </span>
                    </div>
                  </button>
                );
              })()
            ) : (
              <div
                key={`empty-${i}`}
                style={{
                  height: 16, border: "1px dashed var(--line-2)", borderRadius: 4,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <span className="v-mute2" style={{ fontSize: 9.5 }}>Not enough athletes</span>
              </div>
            )
          )}
          {more > 0 && <span className="v-mute2" style={{ fontSize: 9.5 }}>+{more} more</span>}
        </div>
      </div>
    </div>
  );
}
