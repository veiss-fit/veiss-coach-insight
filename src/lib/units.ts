import type { UnitSystem } from "@/components/pulse/UnitsSelector";

/**
 * Render-only unit conversion: every raw value here stays in its storage unit
 * (mm, m, s, m/s, W) everywhere else in the app — calculations, thresholds,
 * chart scales, and anything written back to the DB. These helpers format a
 * final value for display only; never feed their output back into math.
 */

const MM_PER_INCH = 25.4;
const M_PER_FT = 0.3048;
const MS_PER_FTS = 0.3048; // 1 ft/s = 0.3048 m/s
const W_PER_HP = 745.7;
const KG_PER_LB = 0.453592;

/** ROM-style distances stored in mm: metric shows cm (existing behavior), imperial shows inches. */
export function convertDistanceMm(mm: number, system: UnitSystem): number {
  return system === "imperial" ? mm / MM_PER_INCH : mm / 10;
}

export function fmtDistanceMm(mm: number, system: UnitSystem, digits = 1): string {
  return `${convertDistanceMm(mm, system).toFixed(digits)} ${system === "imperial" ? "in" : "cm"}`;
}

/** Bar-path style distances stored in metres. */
export function fmtDistanceM(m: number, system: UnitSystem, digits = 1): string {
  if (system === "imperial") return `${(m / M_PER_FT).toFixed(digits)} ft`;
  return `${m.toFixed(digits)} m`;
}

/** Velocity stored in m/s. */
export function convertVelocity(ms: number, system: UnitSystem): number {
  return system === "imperial" ? ms / MS_PER_FTS : ms;
}

export function fmtVelocity(ms: number, system: UnitSystem, digits = 2): string {
  return `${convertVelocity(ms, system).toFixed(digits)} ${system === "imperial" ? "ft/s" : "m/s"}`;
}

/** Weight/load stored in lbs (reps.weight, set loads). Imperial keeps lbs; metric converts to kg. */
export function convertWeightLbs(lbs: number, system: UnitSystem): number {
  return system === "metric" ? lbs * KG_PER_LB : lbs;
}

export function fmtWeightLbs(lbs: number, system: UnitSystem, digits = 0): string {
  return `${convertWeightLbs(lbs, system).toFixed(digits)} ${system === "metric" ? "kg" : "lb"}`;
}

/** Power stored in watts (mock data only today — see PowerBetaCard). */
export function fmtPower(w: number, system: UnitSystem): string {
  if (system === "imperial") return `${(w / W_PER_HP).toFixed(2)} hp`;
  return `${Math.round(w)} W`;
}
