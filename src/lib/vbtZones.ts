// Velocity-based-training zone model (research-standard m/s → %1RM mapping).
// Used by the velocity-zone slider on the Programming page and anywhere a
// prescribed mean velocity needs a zone label/color.

export interface VelocityZone {
  label: string;
  short: string;
  min: number;
  max: number;
  color: string;
}

export interface ZoneBoundary {
  ms: number;
  pct1rm: number;
}

export const VBT_MAX = 1.6;
export const VBT_STEP = 0.05;

/** Weekly session target used across athlete KPIs (no per-athlete setting exists yet). */
export const SESSIONS_TARGET = 4;

export const VELOCITY_ZONES: VelocityZone[] = [
  { label: "Absolute Strength",     short: "Absolute", min: 0,    max: 0.35, color: "#b91c1c" },
  { label: "Accelerative Strength", short: "Accel.",   min: 0.35, max: 0.5,  color: "#dc2626" },
  { label: "Strength / Speed",      short: "Str·Spd",  min: 0.5,  max: 0.75, color: "#d97706" },
  { label: "Speed / Strength",      short: "Spd·Str",  min: 0.75, max: 1.0,  color: "#65a30d" },
  { label: "Starting Strength",     short: "Starting", min: 1.0,  max: 1.3,  color: "#16a34a" },
  { label: "Power",                 short: "Power",    min: 1.3,  max: 1.6,  color: "#059669" },
];

export const ZONE_BOUNDARIES: ZoneBoundary[] = [
  { ms: 0,    pct1rm: 100 },
  { ms: 0.35, pct1rm: 80  },
  { ms: 0.5,  pct1rm: 70  },
  { ms: 0.75, pct1rm: 50  },
  { ms: 1.0,  pct1rm: 30  },
  { ms: 1.3,  pct1rm: 20  },
  { ms: 1.6,  pct1rm: 0   },
];

export function zoneOf(v: number): VelocityZone {
  return (
    VELOCITY_ZONES.find((z) => v >= z.min && v < z.max) ??
    VELOCITY_ZONES[VELOCITY_ZONES.length - 1]
  );
}
