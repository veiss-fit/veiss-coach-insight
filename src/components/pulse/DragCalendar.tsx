import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isBefore,
  startOfDay,
  addMonths,
  subMonths,
  isSameMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const toKey = (d: Date) => format(d, "yyyy-MM-dd");

const keyToDate = (key: string): Date => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DragCalendarProps {
  selected: Date[];
  onSelect: (dates: Date[]) => void;
}

/** Month calendar with click-to-toggle and hold-drag multi-select (mouse + touch). */
export function DragCalendar({ selected, onSelect }: DragCalendarProps) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));

  const today = useMemo(() => startOfDay(new Date()), []);
  const todayKey = useMemo(() => toKey(today), [today]);

  const isDragging = useRef(false);
  const visitedKeys = useRef(new Set<string>());
  const workingDates = useRef<Date[]>([]);
  const workingKeys = useRef(new Set<string>());

  const selectedKeys = useMemo(() => new Set(selected.map(toKey)), [selected]);

  const gridDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 0 }),
        end: endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 }),
      }),
    [viewMonth]
  );

  const isPast = useCallback((d: Date) => isBefore(d, today), [today]);

  const startDrag = useCallback(
    (date: Date, e: React.MouseEvent | React.TouchEvent) => {
      if (isPast(date)) return;
      e.preventDefault();

      isDragging.current = true;
      const key = toKey(date);
      visitedKeys.current = new Set([key]);

      workingDates.current = [...selected];
      workingKeys.current = new Set(selected.map(toKey));

      if (workingKeys.current.has(key)) {
        workingDates.current = workingDates.current.filter((d) => toKey(d) !== key);
        workingKeys.current.delete(key);
      } else {
        workingDates.current = [...workingDates.current, date];
        workingKeys.current.add(key);
      }
      onSelect(workingDates.current);
    },
    [selected, isPast, onSelect]
  );

  const addDateByKey = useCallback(
    (key: string) => {
      if (visitedKeys.current.has(key)) return;
      visitedKeys.current.add(key);
      const date = keyToDate(key);
      if (isPast(date)) return;
      if (workingKeys.current.has(key)) return;
      workingDates.current = [...workingDates.current, date];
      workingKeys.current.add(key);
      onSelect(workingDates.current);
    },
    [isPast, onSelect]
  );

  const keyAtPoint = useCallback((x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    return el?.closest("[data-date]")?.getAttribute("data-date") ?? null;
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging.current) return;
      const key = keyAtPoint(e.clientX, e.clientY);
      if (key) addDateByKey(key);
    },
    [addDateByKey, keyAtPoint]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!isDragging.current) return;
      e.preventDefault();
      const { clientX, clientY } = e.touches[0];
      const key = keyAtPoint(clientX, clientY);
      if (key) addDateByKey(key);
    },
    [addDateByKey, keyAtPoint]
  );

  useEffect(() => {
    const end = () => {
      isDragging.current = false;
      visitedKeys.current.clear();
    };
    window.addEventListener("mouseup", end);
    window.addEventListener("touchend", end);
    return () => {
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchend", end);
    };
  }, []);

  return (
    <div className="select-none">
      {/* Month navigation */}
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <button
          type="button"
          aria-label="Previous month"
          className="v-btn ghost"
          style={{ width: 28, height: 28, padding: 0, justifyContent: "center" }}
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
        >
          <ChevronLeft size={13} strokeWidth={1.5} />
        </button>
        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{format(viewMonth, "MMMM yyyy")}</span>
        <button
          type="button"
          aria-label="Next month"
          className="v-btn ghost"
          style={{ width: 28, height: 28, padding: 0, justifyContent: "center" }}
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
        >
          <ChevronRight size={13} strokeWidth={1.5} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7" style={{ marginBottom: 2 }}>
        {WEEK_DAYS.map((d) => (
          <div key={d} className="v-label" style={{ textAlign: "center", fontSize: 9.5, padding: "4px 0" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        className="grid grid-cols-7 gap-0.5"
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        style={{ touchAction: "none" }}
      >
        {gridDays.map((day) => {
          const key = toKey(day);
          const inMonth = isSameMonth(day, viewMonth);
          const past = isPast(day);
          const sel = selectedKeys.has(key);
          const isToday = key === todayKey;

          const dayStyle: React.CSSProperties = sel
            ? { backgroundColor: "var(--brand-soft)", color: "var(--brand-ink)", borderRadius: 999, border: "1.5px solid var(--brand)", fontWeight: 600 }
            : isToday
            ? { backgroundColor: "var(--brand)", color: "var(--brand-ink)", borderRadius: 999, fontWeight: 600 }
            : {};

          return (
            <div
              key={key}
              data-date={key}
              onMouseDown={(e) => startDrag(day, e)}
              onTouchStart={(e) => startDrag(day, e)}
              style={{ ...dayStyle, fontVariantNumeric: "tabular-nums", fontSize: 12.5, height: 34 }}
              className={cn(
                "flex items-center justify-center transition-colors",
                past ? "opacity-25 cursor-not-allowed" : "cursor-pointer",
                !inMonth && !sel && !isToday && "opacity-40",
                !sel && !isToday && !past && "hover:bg-surface-sunk rounded-md",
                !sel && !isToday && "rounded-md"
              )}
            >
              {format(day, "d")}
            </div>
          );
        })}
      </div>
    </div>
  );
}
