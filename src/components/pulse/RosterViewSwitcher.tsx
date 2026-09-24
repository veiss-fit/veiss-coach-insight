import { BlobSelector, type BlobOption } from "./BlobSelector";
import { RosterSignalsTable } from "./RosterSignalsTable";
import type { ThresholdDraft } from "@/lib/metrics/attentionFlags";
import { LeaderboardPanel, type LeaderboardPanelProps } from "./LeaderboardPanel";
import { TrainingGridPanel, type TrainingGridRow } from "./TrainingGridPanel";
import { TeamPrsPanel, type TeamPrsPanelProps } from "./TeamPrsPanel";
import type { FilterGroup } from "./FilterBar";
import type { PlayerWithStats } from "@/services/playersService";
import type { RosterSignals } from "@/lib/metrics/rosterSignals";

export type RosterView = "roster" | "leaderboard" | "grid" | "team-prs";

const VIEW_OPTIONS: BlobOption<RosterView>[] = [
  { id: "roster", label: "Roster" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "grid", label: "Training grid" },
  { id: "team-prs", label: "Team PRs" },
];

interface RosterSignalsTableProps {
  athletes: PlayerWithStats[];
  signalsByPlayer: Map<string, RosterSignals>;
  onSelect?: (athlete: PlayerWithStats) => void;
  onOpenExercise?: (athlete: PlayerWithStats, exercise: string, sessionId: string | null, kind: "drop" | "tempo") => void;
  today?: string;
  draft?: ThresholdDraft;
  onDraftChange?: (d: ThresholdDraft) => void;
  groups?: FilterGroup[];
  groupFilter?: string;
  onGroupFilterChange?: (id: string) => void;
  search?: string;
  onSearchChange?: (q: string) => void;
}

interface TrainingGridProps {
  dayLabels: string[];
  rows: TrainingGridRow[];
  onRowClick?: (playerId: string) => void;
}

export interface RosterViewSwitcherProps {
  view: RosterView;
  onViewChange: (view: RosterView) => void;
  roster: RosterSignalsTableProps;
  leaderboard: LeaderboardPanelProps;
  grid: TrainingGridProps;
  teamPrs: TeamPrsPanelProps;
  /** Skip rendering the built-in BlobSelector, when the caller places it elsewhere (e.g. next to a header button). */
  hideSelector?: boolean;
}

export { VIEW_OPTIONS };

/**
 * Tab bar (roster table / leaderboard / training grid) above the roster
 * section, replacing the plain roster table. Only one view's data is fetched
 * eagerly today (roster); leaderboard and grid props come from the same
 * already-loaded roster metrics, no extra queries. See temp/HOME_DASHBOARD_PLAN.md.
 */
export function RosterViewSwitcher({ view, onViewChange, roster, leaderboard, grid, teamPrs, hideSelector }: RosterViewSwitcherProps) {
  return (
    <div>
      {!hideSelector && (
        <div style={{ marginBottom: 14 }}>
          <BlobSelector options={VIEW_OPTIONS} value={view} onChange={onViewChange} />
        </div>
      )}
      {view === "roster" && (
        <div className="v-card flush v-scroll" style={{ overflow: "auto" }}>
          <RosterSignalsTable {...roster} />
        </div>
      )}
      {view === "leaderboard" && <LeaderboardPanel {...leaderboard} />}
      {view === "grid" && <TrainingGridPanel {...grid} />}
      {view === "team-prs" && <TeamPrsPanel {...teamPrs} />}
    </div>
  );
}
