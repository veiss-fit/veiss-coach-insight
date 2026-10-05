import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { DEFAULT_UNIT_PREFS, type UnitCategory, type UnitPrefs, type UnitSystem } from "@/components/pulse/UnitsSelector";

const PREFS_KEY = "veiss.unitPrefs";

const readPrefs = (): UnitPrefs => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_UNIT_PREFS, ...(JSON.parse(raw) as Partial<UnitPrefs>) } : DEFAULT_UNIT_PREFS;
  } catch {
    return DEFAULT_UNIT_PREFS;
  }
};

/** Derived categories (velocity, power) that "Auto" mirrors off Distance's system. */
const DERIVED_AUTO_CATEGORIES: UnitCategory[] = ["velocity", "power"];

interface UnitsContextValue {
  /** Effective values for display: when derivedAuto is on, velocity/power mirror Distance. */
  prefs: UnitPrefs;
  setUnit: (category: UnitCategory, system: UnitSystem) => void;
  derivedAuto: boolean;
  setDerivedAuto: (auto: boolean) => void;
}

const UnitsContext = createContext<UnitsContextValue | null>(null);

/** Coach's metric/imperial pick per category. Persisted to this browser only (no coach-account sync yet). */
export function UnitsProvider({ children }: { children: ReactNode }) {
  const [rawPrefs, setRawPrefs] = useState<UnitPrefs>(readPrefs);

  // Keep multiple tabs/windows in sync when the toggle changes elsewhere.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PREFS_KEY) setRawPrefs(readPrefs());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: UnitPrefs) => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: pref lasts for this visit only */
    }
  }, []);

  const setUnit = useCallback(
    (category: UnitCategory, system: UnitSystem) => {
      setRawPrefs((p) => {
        if (p.derivedAuto && DERIVED_AUTO_CATEGORIES.includes(category)) return p; // locked while auto is on
        const next = { ...p, [category]: system };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const setDerivedAuto = useCallback(
    (auto: boolean) => {
      setRawPrefs((p) => {
        const next: UnitPrefs = auto
          ? { ...p, derivedAuto: true, velocity: p.distance, power: p.distance }
          : { ...p, derivedAuto: false };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const prefs = useMemo<UnitPrefs>(
    () => (rawPrefs.derivedAuto ? { ...rawPrefs, velocity: rawPrefs.distance, power: rawPrefs.distance } : rawPrefs),
    [rawPrefs],
  );

  const value = useMemo(
    () => ({ prefs, setUnit, derivedAuto: rawPrefs.derivedAuto, setDerivedAuto }),
    [prefs, setUnit, rawPrefs.derivedAuto, setDerivedAuto],
  );

  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

export function useUnits() {
  const ctx = useContext(UnitsContext);
  if (!ctx) throw new Error("useUnits must be used within a UnitsProvider");
  return ctx;
}
