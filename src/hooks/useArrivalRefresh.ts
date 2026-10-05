import { useEffect, useRef } from "react";
import { format, startOfWeek } from "date-fns";
import { getArrivalStamp, stampsEqual, type ArrivalStamp } from "@/services/arrivalService";

/** How often a visible tab looks for newly arrived workouts. */
const CHECK_MS = 30_000;
/** After a change is spotted, how long to wait before checking whether the upload has stopped changing. */
const SETTLE_MS = 5_000;
/** Give up waiting for an upload to settle after this many extra looks and refresh anyway. */
const MAX_SETTLE_LOOKS = 12;
/** Quiet full refresh even when nothing looked different, as a net under anything the check misses. */
const SAFETY_MS = 5 * 60_000;

const weekKey = () => format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface Options {
  /** `players.id` of the athletes to watch. Nothing runs while empty. */
  playerIds: string[];
  /** Turn the watch off entirely (page not showing arrival-driven data, tab not needed, etc.). */
  enabled: boolean;
  /** Re-fetch and update the page's data quietly: no loader, no toast. */
  onRefresh: () => void | Promise<void>;
}

/**
 * Keeps a page current without a manual reload. Every 30s on a visible tab it takes a tiny fingerprint of
 * what has reached the database for the watched athletes; only when that changes does it call `onRefresh`,
 * after waiting for the upload to stop changing (a workout's rows land in steps). Also refreshes once when
 * the calendar week changes (the weekly windows slide on Monday with no new workout) and every 5 minutes as
 * a safety net. Checks pause while the tab is hidden and run at once when it comes back.
 */
export function useArrivalRefresh({ playerIds, enabled, onRefresh }: Options) {
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  const idsKey = [...playerIds].sort().join(",");

  useEffect(() => {
    if (!enabled || !idsKey) return;
    const ids = idsKey.split(",");
    let cancelled = false;
    let running = false;
    let baseline: ArrivalStamp | null = null;
    let lastFull = Date.now();
    let lastWeek = weekKey();

    // The fingerprint is taken before the refetch, so a workout that lands during the refetch still
    // differs from the baseline at the next check.
    const refresh = async () => {
      const before = await getArrivalStamp(ids);
      await refreshRef.current();
      if (cancelled) return;
      baseline = before;
      lastFull = Date.now();
      lastWeek = weekKey();
    };

    const check = async () => {
      if (running || cancelled || document.hidden) return;
      running = true;
      try {
        if (weekKey() !== lastWeek || Date.now() - lastFull >= SAFETY_MS) {
          await refresh();
          return;
        }
        const stamp = await getArrivalStamp(ids);
        if (cancelled) return;
        if (!baseline) {
          baseline = stamp;
          return;
        }
        if (stampsEqual(stamp, baseline)) return;

        // Something arrived. Wait until the rows stop changing, then refresh.
        let previous = stamp;
        for (let look = 0; look < MAX_SETTLE_LOOKS; look++) {
          await sleep(SETTLE_MS);
          if (cancelled) return;
          const again = await getArrivalStamp(ids);
          if (stampsEqual(again, previous)) break;
          previous = again;
        }
        await refresh();
      } catch (error) {
        console.warn("Arrival check failed, will retry:", error);
      } finally {
        running = false;
      }
    };

    getArrivalStamp(ids)
      .then((stamp) => {
        if (!cancelled && !baseline) baseline = stamp;
      })
      .catch((error) => console.warn("Arrival baseline failed:", error));

    const interval = setInterval(check, CHECK_MS);
    const onVisible = () => {
      if (!document.hidden) void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, idsKey]);
}
