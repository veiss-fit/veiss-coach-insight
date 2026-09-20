import type { PlayerWithStats } from "@/services/playersService";
import type { AttentionFacts } from "./attentionFlags";
import type { RosterSignals } from "./rosterSignals";

/** The four tracked facts (SP-13) for one athlete. Shared by the roster table and the followed-athlete cards. */
export function athleteFacts(a: PlayerWithStats, sig: RosterSignals | undefined, now: number): AttentionFacts {
  return {
    daysSince: a.lastWorkout ? Math.max(0, Math.floor((now - new Date(a.lastWorkout.date).getTime()) / 86_400_000)) : null,
    drop: sig?.biggestDrop ? Math.abs(sig.biggestDrop.change) : null,
    tempo: sig?.slowestTempo ? sig.slowestTempo.change : null,
    attendance: a.attendance ?? null,
  };
}
