import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, FlaskConical, Pencil, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import type { PlayerWithStats } from "@/services/playersService";
import type { RosterSignals } from "@/lib/metrics/rosterSignals";
import {
  DEFAULT_THRESHOLDS,
  attentionFlags,
  orderByAttention,
  INITIAL_DRAFT,
  thresholdsFromDraft,
  type AttentionSignal,
  type AttentionThresholds,
  type SortKey,
  type ThresholdDraft,
} from "@/lib/metrics/attentionFlags";
import { athleteFacts } from "@/lib/metrics/athleteFacts";
import { Avatar } from "./Avatar";
import { AttBar } from "./AttBar";
import { GroupChip } from "./chips";
import { ComingSoonMetricsCard, DEFAULT_COMING_SOON_METRICS } from "./ComingSoonMetricsCard";
import type { FilterGroup } from "./FilterBar";
import { signedInt } from "@/lib/format";
import { InfoTip } from "./InfoTip";

interface RosterSignalsTableProps {
  athletes: PlayerWithStats[];
  /** SP-12 signals per athlete. Missing entry = no data. */
  signalsByPlayer: Map<string, RosterSignals>;
  onSelect?: (athlete: PlayerWithStats) => void;
  /**
   * Called when a Drop or Tempo cell is clicked: open that athlete's session
   * (`sessionId`, the latest session of `exercise`) scoped to the exercise.
   * Storybook leaves it unconnected, only the hover and click feedback exist.
   */
  onOpenExercise?: (athlete: PlayerWithStats, exercise: string, sessionId: string | null, kind: "drop" | "tempo") => void;
  /** Today's date, for days since the last session. Defaults to now. */
  today?: string;
  /** Flag cut-offs. Pass both to share them with other components (the followed-athlete cards); otherwise the table keeps its own. */
  draft?: ThresholdDraft;
  onDraftChange?: (d: ThresholdDraft) => void;
  /** Team filter dropdown, next to Sort by. Omit to hide it. */
  groups?: FilterGroup[];
  groupFilter?: string;
  onGroupFilterChange?: (id: string) => void;
  /** Name search, tucked behind the search icon in the Athlete column header. Omit to hide it. */
  search?: string;
  onSearchChange?: (q: string) => void;
}

const dash = (
  <span className="v-mute2 mono" style={{ fontSize: 12.5 }}>
    —
  </span>
);
export type ColumnKey = "attendance" | "drop" | "tempo" | "last";
/** The coach can show at most this many columns besides Athlete and Group. */
export const MAX_COLUMNS = 4;

const COLUMN_LABEL: Record<ColumnKey, string> = {
  attendance: "Attendance",
  drop: "Biggest drop vs baseline",
  tempo: "Slowest tempo shift",
  last: "Last session",
};
const ALL_COLUMNS: ColumnKey[] = ["attendance", "drop", "tempo", "last"];

/**
 * Column header. In edit mode the name becomes a dropdown: pick which column
 * this slot shows (picking one already shown elsewhere swaps the two), or
 * remove the column. An empty slot shows "Add column".
 */
function ColumnHeader({
  column,
  info,
  editing,
  slots,
  onPick,
}: {
  column: ColumnKey | null;
  info?: React.ReactNode;
  editing: boolean;
  slots: (ColumnKey | null)[];
  onPick: (next: ColumnKey | null) => void;
}) {
  if (!editing && !column) return null;
  const tip = column && info && (
    <InfoTip label={`About ${COLUMN_LABEL[column].toLowerCase()}`} align="start" maxWidth={320}>
      {info}
    </InfoTip>
  );
  if (!editing) {
    return (
      <th>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {COLUMN_LABEL[column!]}
          {tip}
        </span>
      </th>
    );
  }
  return (
    <th>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="roster-colpick"
              aria-label={column ? `Change column ${COLUMN_LABEL[column]}` : "Add column"}
            >
              {column ? (
                COLUMN_LABEL[column]
              ) : (
                <>
                  <Plus size={12} strokeWidth={1.75} /> Add column
                </>
              )}
              <ChevronDown size={12} strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" style={{ fontSize: 12, minWidth: 210 }}>
            {ALL_COLUMNS.map((k) => (
              <DropdownMenuItem key={k} onSelect={() => onPick(k)} style={{ fontSize: 12, gap: 8 }}>
                <span style={{ width: 14, display: "inline-flex" }}>{column === k && <Check size={13} strokeWidth={1.75} />}</span>
                {COLUMN_LABEL[k]}
                {column !== k && slots.includes(k) && <span className="v-meta" style={{ marginLeft: "auto" }}>swap</span>}
              </DropdownMenuItem>
            ))}
            {column && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onPick(null)} style={{ fontSize: 12 }}>
                  Remove column
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {tip}
      </span>
    </th>
  );
}

/** Athlete column header: a search icon that opens into an inline name search box. Stays open while there's a query. */
function AthleteHeaderCell({ search, onSearchChange }: { search?: string; onSearchChange?: (q: string) => void }) {
  const [active, setActive] = useState(false);
  if (!onSearchChange) return <th>Athlete</th>;
  const open = active || !!search;

  if (!open) {
    return (
      <th>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          Athlete
          <button
            type="button"
            aria-label="Search athletes"
            onClick={(e) => {
              e.stopPropagation();
              setActive(true);
            }}
            style={{ display: "inline-flex", border: 0, background: "transparent", padding: 2, cursor: "pointer", color: "var(--ink-3)" }}
          >
            <Search size={12} strokeWidth={1.5} />
          </button>
        </span>
      </th>
    );
  }

  return (
    <th onClick={(e) => e.stopPropagation()}>
      <span className="row" style={{ gap: 4 }}>
        <Search size={12} strokeWidth={1.5} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
        <input
          autoFocus
          value={search ?? ""}
          onChange={(e) => onSearchChange(e.target.value)}
          onBlur={() => {
            if (!search) setActive(false);
          }}
          placeholder="Search athletes…"
          aria-label="Search athletes"
          style={{
            border: 0, background: "transparent", outline: "none", font: "inherit",
            fontSize: 12, textTransform: "none", letterSpacing: "normal", fontWeight: 400,
            color: "var(--ink-0)", width: 120,
          }}
        />
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onSearchChange("");
            setActive(false);
          }}
          style={{ display: "inline-flex", border: 0, background: "transparent", padding: 0, cursor: "pointer", color: "var(--ink-3)" }}
        >
          <X size={12} strokeWidth={1.5} />
        </button>
      </span>
    </th>
  );
}

const TEMPO_INFO = (
  <p style={{ margin: 0 }}>
    <strong>Slowest tempo shift</strong>: how much longer the lifting part of a rep took in the last set vs. the first, on the
    athlete's most-affected exercise. Ignores load, so a heavier later set can also explain a slowdown.
  </p>
);

const DROP_INFO = (
  <p style={{ margin: 0 }}>
    <strong>Biggest drop vs baseline</strong>: how far the athlete's latest session sits below their own recent baseline, on the
    exercise with the largest gap. Pooled across loads, so a heavier load can explain part of the drop.
  </p>
);

const DAYS_INFO = (
  <p style={{ margin: 0 }}>
    <strong>Last session</strong>: the date of the last workout and how many days ago that was.
  </p>
);

/** Clickable signal cell: tint and nudge on hover, press-in on click. Stops the row click. */
function SignalLink({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="roster-signal"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
      <ChevronRight size={12} strokeWidth={1.5} className="roster-signal-arrow" />
    </button>
  );
}

/** Signed percent plus exercise name, clickable, with an optional line under it. */
function ExerciseSignal({
  athlete,
  signal,
  flagged,
  kind,
  onOpen,
  extra,
}: {
  athlete: PlayerWithStats;
  signal: { change: number; exercise: string; sessionId: string | null };
  flagged: boolean;
  /** Which signal this is: a drop opens the velocity graphs, a tempo shift the rep-timing ones. */
  kind: "drop" | "tempo";
  onOpen?: (athlete: PlayerWithStats, exercise: string, sessionId: string | null, kind: "drop" | "tempo") => void;
  extra?: string | null;
}) {
  return (
    <SignalLink label={`Open ${signal.exercise} session for ${athlete.name}`} onClick={() => onOpen?.(athlete, signal.exercise, signal.sessionId, kind)}>
      <div>
        <div className="row" style={{ gap: 6 }}>
          <span className="mono" style={{ fontSize: 12.5, color: "var(--ink-0)", fontWeight: flagged ? 600 : 400 }}>
            {signedInt(signal.change)}
          </span>
          <span className="v-meta ellipsis" style={{ fontSize: 11, maxWidth: 150 }}>
            {signal.exercise}
          </span>
        </div>
        {extra && (
          <div className="v-meta mono" style={{ fontSize: 11 }}>
            {extra}
          </div>
        )}
      </div>
    </SignalLink>
  );
}

const COLUMN_INFO: Partial<Record<ColumnKey, React.ReactNode>> = { drop: DROP_INFO, tempo: TEMPO_INFO, last: DAYS_INFO };

const SIGNAL_CSS = `
.roster-signal{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;margin:-4px -8px;border:0;border-radius:7px;background:transparent;text-align:left;cursor:pointer;font:inherit;color:inherit;transition:background 140ms ease,transform 140ms ease}
.roster-signal:hover{background:var(--surface-2,rgba(7,16,31,0.06))}
.roster-signal:active{transform:scale(0.97)}
.roster-signal:focus-visible{outline:2px solid var(--ink-0);outline-offset:1px}
.roster-signal-arrow{color:var(--ink-3);opacity:0;transform:translateX(-4px);transition:opacity 140ms ease,transform 140ms ease}
.roster-signal:hover .roster-signal-arrow,.roster-signal:focus-visible .roster-signal-arrow{opacity:1;transform:none}
.roster-colpick{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 8px;border:1px dashed var(--line-1);border-radius:6px;background:var(--surface-1);font:inherit;text-transform:inherit;letter-spacing:inherit;color:var(--ink-0);cursor:pointer;transition:background 140ms ease,border-color 140ms ease}
.roster-colpick:hover{background:var(--surface-2);border-color:var(--ink-3)}
.v-table tbody tr.roster-flagged{background:rgba(220,38,38,0.06)}
.v-table tbody tr.roster-flagged:hover{background:rgba(220,38,38,0.1)}
.v-table tbody tr.roster-flagged td.roster-hit{background:rgba(220,38,38,0.16)}
`;

const SIGNAL_LABELS: { key: AttentionSignal; label: string; unit: string; hint: string }[] = [
  { key: "days", label: "Days since last session", unit: "days", hint: "above" },
  { key: "drop", label: "Drop vs baseline", unit: "%", hint: "at least" },
  { key: "tempo", label: "Slowest tempo shift", unit: "%", hint: "at least" },
  { key: "attendance", label: "Attendance", unit: "%", hint: "below" },
];

/** "name" is applied here before orderByAttention, which keeps that order inside each group. */
type TableSort = SortKey | "name" | "flagged";

const SORT_OPTIONS: { key: TableSort; label: string }[] = [
  { key: "name", label: "Name (A-Z)" },
  { key: "default", label: "Roster order" },
  { key: "flagged", label: "Flagged first" },
  { key: "days", label: "Days since last session" },
  { key: "drop", label: "Drop vs baseline" },
  { key: "tempo", label: "Slowest tempo shift" },
  { key: "attendance", label: "Attendance (lowest first)" },
];

const controlStyle: React.CSSProperties = {
  height: 28,
  padding: "0 8px",
  borderRadius: 7,
  border: "1px solid var(--line-1)",
  background: "var(--surface-1)",
  fontSize: 12,
  color: "var(--ink-1)",
};

/** Cut-offs, sort and column-edit controls. An unchecked signal is off. */
function AttentionControls({
  draft,
  setDraft,
  sort,
  setSort,
  editing,
  setEditing,
  groups,
  groupFilter,
  onGroupFilterChange,
}: {
  draft: Record<AttentionSignal, string>;
  setDraft: (d: Record<AttentionSignal, string>) => void;
  sort: TableSort;
  setSort: (s: TableSort) => void;
  editing: boolean;
  setEditing: (e: boolean) => void;
  groups?: FilterGroup[];
  groupFilter?: string;
  onGroupFilterChange?: (id: string) => void;
}) {
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  return (
    <div className="row" style={{ justifyContent: "flex-end", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--line-0)", flexWrap: "wrap" }}>
      <button
        type="button"
        className="v-btn"
        aria-pressed={editing}
        aria-label={editing ? "Done editing columns" : "Edit columns"}
        onClick={() => setEditing(!editing)}
        style={{
          ...controlStyle,
          marginRight: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: editing ? "var(--ink-0)" : "var(--surface-1)",
          color: editing ? "#fff" : "var(--ink-1)",
          borderColor: editing ? "var(--ink-0)" : "var(--line-1)",
        }}
      >
        {editing ? <Check size={13} strokeWidth={1.75} /> : <Pencil size={13} strokeWidth={1.5} />}
        {editing ? "Done" : "Edit columns"}
      </button>
      <button
        type="button"
        className="v-chip"
        data-tone="info"
        title="What's coming next"
        onClick={() => setComingSoonOpen(true)}
        style={{ cursor: "pointer", border: 0 }}
      >
        <FlaskConical size={11} strokeWidth={1.75} />
        Beta
      </button>
      <Dialog open={comingSoonOpen} onOpenChange={setComingSoonOpen}>
        <DialogContent
          style={{
            maxWidth: 420, maxHeight: "85vh", padding: 0, background: "transparent", border: 0, boxShadow: "none",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}
        >
          <DialogTitle className="sr-only">Coming soon metrics</DialogTitle>
          <ComingSoonMetricsCard metrics={DEFAULT_COMING_SOON_METRICS} />
        </DialogContent>
      </Dialog>
      {groups && (
        <label className="v-meta" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink-1)" }}>
          Team
          <select
            value={groupFilter ?? "all"}
            onChange={(e) => onGroupFilterChange?.(e.target.value)}
            style={controlStyle}
            aria-label="Filter roster by team"
          >
            <option value="all">All groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {g.size != null ? ` (${g.size})` : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="v-meta" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink-1)" }}>
        Sort by
        <select value={sort} onChange={(e) => setSort(e.target.value as TableSort)} style={controlStyle} aria-label="Sort roster by">
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="v-btn" style={{ ...controlStyle, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <SlidersHorizontal size={13} strokeWidth={1.5} />
            Flag settings
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" style={{ width: 320, fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Flag an athlete when</div>
          <div className="v-meta" style={{ marginBottom: 10 }}>
            Any one of these is crossed. Uncheck a signal to turn it off. The starting numbers are uncalibrated.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "8px 10px", alignItems: "center" }}>
            {SIGNAL_LABELS.map((s) => {
              const enabled = draft[s.key] !== "";
              return (
                <label key={s.key} style={{ display: "contents" }}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setDraft({ ...draft, [s.key]: e.target.checked ? String(DEFAULT_THRESHOLDS[s.key]) : "" })}
                    aria-label={`Enable ${s.label}`}
                  />
                  <span style={{ color: enabled ? "var(--ink-0)" : "var(--ink-3)" }}>
                    {s.label} <span className="v-meta">{s.hint}</span>
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={enabled ? draft[s.key] : ""}
                      disabled={!enabled}
                      onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}
                      aria-label={`${s.label} cut-off`}
                      style={{ ...controlStyle, width: 64, fontFamily: "var(--font-mono)", opacity: enabled ? 1 : 0.4 }}
                    />
                    <span className="v-meta" style={{ width: 28 }}>
                      {s.unit}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * SP-12 and SP-13 prototype: copy of the roster table (AthleteTable.tsx). The
 * Velocity column is replaced by signals (biggest drop vs baseline, slowest
 * tempo shift). Athlete and Group are fixed. The coach fills up to MAX_COLUMNS
 * slots after them (pen button, top left: each header becomes a dropdown to
 * change, swap or remove the column). Athletes crossing a coach-set cut-off get
 * a light red row, with the crossing cell darker, whether or not that column is
 * shown. Flagged rows can be pinned to the top; the coach picks the sort key.
 * No composite score. Storybook only.
 *
 * TODO(page integration): the chosen column slots live in component state
 * here and reset on reload; the cut-offs (draft/onDraftChange) are lifted to
 * FollowedAthletesContext and persist via localStorage. Persist slots per
 * coach (e.g. profile settings) too when placed.
 */
export function RosterSignalsTable({
  athletes,
  signalsByPlayer,
  onSelect,
  onOpenExercise,
  today,
  draft: draftProp,
  onDraftChange,
  groups,
  groupFilter,
  onGroupFilterChange,
  search,
  onSearchChange,
}: RosterSignalsTableProps) {
  const [ownDraft, setOwnDraft] = useState<ThresholdDraft>(INITIAL_DRAFT);
  const draft = draftProp ?? ownDraft;
  const setDraft = onDraftChange ?? setOwnDraft;
  const [sort, setSort] = useState<TableSort>("flagged");
  const [editing, setEditing] = useState(false);
  const [slots, setSlots] = useState<(ColumnKey | null)[]>([...ALL_COLUMNS]);

  const thresholds = useMemo(() => thresholdsFromDraft(draft), [draft]);
  const now = useMemo(() => (today ? new Date(today) : new Date()).getTime(), [today]);

  const pick = (slot: number, next: ColumnKey | null) => {
    const out = [...slots];
    const from = next ? out.indexOf(next) : -1;
    if (from >= 0 && from !== slot) out[from] = out[slot];
    out[slot] = next;
    setSlots(out);
  };

  const rows = useMemo(() => {
    const ordered = sort === "name" ? [...athletes].sort((a, b) => a.name.localeCompare(b.name)) : athletes;
    const withFlags = ordered.map((a) => {
      const facts = athleteFacts(a, signalsByPlayer.get(a.id), now);
      return { a, facts, flags: attentionFlags(facts, thresholds) };
    });
    const metricSort = sort === "name" || sort === "flagged" ? "default" : sort;
    return orderByAttention(withFlags, (r) => r.facts, (r) => r.flags.flagged, metricSort, sort === "flagged");
  }, [athletes, signalsByPlayer, thresholds, sort, now]);

  /** Slots to draw: all of them while editing (empty ones as "Add column"), otherwise only filled ones. */
  const drawn = slots.map((column, slot) => ({ column, slot })).filter((s) => editing || s.column);

  return (
    <div>
      <style>{SIGNAL_CSS}</style>
      <AttentionControls
        draft={draft}
        setDraft={setDraft}
        sort={sort}
        setSort={setSort}
        editing={editing}
        setEditing={setEditing}
        groups={groups}
        groupFilter={groupFilter}
        onGroupFilterChange={onGroupFilterChange}
      />
      <table className="v-table">
        <thead>
          <tr>
            <AthleteHeaderCell search={search} onSearchChange={onSearchChange} />
            <th>Group</th>
            {drawn.map(({ column, slot }) => (
              <ColumnHeader
                key={slot}
                column={column}
                info={column ? COLUMN_INFO[column] : undefined}
                editing={editing}
                slots={slots}
                onPick={(next) => pick(slot, next)}
              />
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr style={{ cursor: "default" }}>
              <td colSpan={drawn.length + 3} style={{ textAlign: "center", color: "var(--ink-3)", height: 88 }}>
                No athletes match the current filters.
              </td>
            </tr>
          ) : (
            rows.map(({ a, facts, flags }) => {
              const sig = signalsByPlayer.get(a.id);
              const drop = sig?.biggestDrop;
              const tempo = sig?.slowestTempo;

              const cell = (column: ColumnKey | null, slot: number) => {
                if (!column) return <td key={slot} />;
                switch (column) {
                  case "attendance":
                    return (
                      <td key={slot} className={flags.attendance ? "roster-hit" : undefined}>
                        <AttBar pct={a.attendance} />
                      </td>
                    );
                  case "drop":
                    return (
                      <td key={slot} className={flags.drop ? "roster-hit" : undefined}>
                        {drop ? (
                          <ExerciseSignal
                            athlete={a}
                            signal={drop}
                            flagged={flags.drop}
                            kind="drop"
                            onOpen={onOpenExercise}
                            extra={drop.loadFrom != null && drop.loadTo != null ? `load ${drop.loadFrom} to ${drop.loadTo}` : null}
                          />
                        ) : (
                          dash
                        )}
                      </td>
                    );
                  case "tempo":
                    return (
                      <td key={slot} className={flags.tempo ? "roster-hit" : undefined}>
                        {tempo ? <ExerciseSignal athlete={a} signal={tempo} flagged={flags.tempo} kind="tempo" onOpen={onOpenExercise} /> : dash}
                      </td>
                    );
                  case "last":
                    return (
                      <td key={slot} className={flags.days ? "roster-hit" : undefined}>
                        {a.lastWorkout ? (
                          <div>
                            <div className="row" style={{ gap: 6 }}>
                              <span className="mono" style={{ fontSize: 12.5, color: "var(--ink-2)", fontWeight: flags.days ? 600 : 400 }}>
                                {format(new Date(a.lastWorkout.date), "MMM d")}
                              </span>
                              <span className="v-meta ellipsis" style={{ fontSize: 11, maxWidth: 140 }}>
                                {a.lastWorkout.name}
                              </span>
                            </div>
                            <div className="v-meta mono" style={{ fontSize: 11 }}>
                              {facts.daysSince} day{facts.daysSince === 1 ? "" : "s"} ago
                            </div>
                          </div>
                        ) : (
                          dash
                        )}
                      </td>
                    );
                }
              };

              return (
                <tr key={a.id} className={flags.flagged ? "roster-flagged" : undefined} onClick={() => onSelect?.(a)}>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <Avatar name={a.name} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-0)" }}>{a.name}</div>
                        {a.jersey_number != null && (
                          <div className="v-meta mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                            #{a.jersey_number}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <GroupChip name={a.group || "—"} />
                  </td>
                  {drawn.map(({ column, slot }) => cell(column, slot))}
                  <td style={{ width: 40, textAlign: "right" }}>
                    <ChevronRight size={12} strokeWidth={1.5} style={{ color: "var(--ink-3)" }} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
