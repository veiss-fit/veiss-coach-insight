import { useLayoutEffect, useRef, useState } from "react";

export type UnitCategory = "distance" | "weight" | "velocity" | "power";
export type UnitSystem = "metric" | "imperial";

export interface UnitCategoryDef {
  id: UnitCategory;
  label: string;
  metric: string;
  imperial: string;
  /** Primary = base measurements; derived = computed from them. Drives the nav menu's two-group layout. */
  group: "primary" | "derived";
}

export const UNIT_CATEGORIES: UnitCategoryDef[] = [
  { id: "distance", label: "Distance", metric: "m", imperial: "ft", group: "primary" },
  { id: "weight", label: "Weight", metric: "kg", imperial: "lb", group: "primary" },
  { id: "velocity", label: "Velocity", metric: "m/s", imperial: "ft/s", group: "derived" },
  { id: "power", label: "Power", metric: "W", imperial: "hp", group: "derived" },
];

export type UnitPrefs = Record<UnitCategory, UnitSystem> & { derivedAuto: boolean };

export const DEFAULT_UNIT_PREFS: UnitPrefs = {
  distance: "metric",
  // Weight defaults to imperial: every load display was hardcoded "lbs" before this toggle went live,
  // so this keeps that look until a coach actively switches to kg.
  weight: "imperial",
  velocity: "metric",
  power: "metric",
  derivedAuto: false,
};

const PAD = 4;
const EASE = "450ms cubic-bezier(0.32, 0.72, 0, 1)";

/** Two-way metric/imperial blob toggle for a single unit category. */
export function UnitToggle({
  category,
  value,
  onChange,
}: {
  category: UnitCategoryDef;
  value: UnitSystem;
  onChange: (system: UnitSystem) => void;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const el = refs.current[value];
    if (el) setBox({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value]);

  const options: { id: UnitSystem; label: string }[] = [
    { id: "metric", label: category.metric },
    { id: "imperial", label: category.imperial },
  ];

  return (
    <div
      role="tablist"
      aria-label={`${category.label} unit`}
      style={{
        position: "relative",
        display: "inline-flex",
        padding: PAD,
        gap: 2,
        borderRadius: 999,
        border: "1px solid var(--line-0)",
        background: "var(--surface-2, transparent)",
      }}
    >
      {box && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: PAD,
            bottom: PAD,
            left: 0,
            width: box.width,
            transform: `translateX(${box.left}px)`,
            borderRadius: 999,
            background: "var(--brand)",
            transition: `transform ${EASE}, width ${EASE}`,
          }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.id}
          ref={(el) => {
            refs.current[o.id] = el;
          }}
          role="tab"
          aria-selected={value === o.id}
          type="button"
          onClick={() => onChange(o.id)}
          style={{
            position: "relative",
            border: 0,
            background: "transparent",
            padding: "6px 14px",
            borderRadius: 999,
            font: "inherit",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            color: value === o.id ? "var(--brand-ink)" : "var(--ink-2)",
            transition: "color 200ms",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface UnitsSelectorProps {
  value: UnitPrefs;
  onChange: (prefs: UnitPrefs) => void;
  /** "tabs": pick a category, edit its toggle. "grid": all categories at once. */
  mode?: "tabs" | "grid";
}

/** Coach unit preferences: distance, weight, velocity, power. */
export function UnitsSelector({ value, onChange, mode = "grid" }: UnitsSelectorProps) {
  const [active, setActive] = useState<UnitCategory>("distance");

  const setOne = (id: UnitCategory, system: UnitSystem) => {
    onChange({ ...value, [id]: system });
  };

  if (mode === "grid") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {UNIT_CATEGORIES.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <span className="v-label" style={{ fontSize: 13, color: "var(--ink-1)" }}>{c.label}</span>
            <UnitToggle category={c} value={value[c.id]} onChange={(s) => setOne(c.id, s)} />
          </div>
        ))}
      </div>
    );
  }

  const activeCategory = UNIT_CATEGORIES.find((c) => c.id === active)!;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        role="tablist"
        style={{
          position: "relative",
          display: "inline-flex",
          padding: PAD,
          gap: 2,
          borderRadius: 999,
          border: "1px solid var(--line-0)",
          width: "fit-content",
        }}
      >
        {UNIT_CATEGORIES.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={active === c.id}
            type="button"
            onClick={() => setActive(c.id)}
            style={{
              position: "relative",
              border: 0,
              background: active === c.id ? "var(--brand)" : "transparent",
              padding: "7px 16px",
              borderRadius: 999,
              font: "inherit",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              color: active === c.id ? "var(--brand-ink)" : "var(--ink-2)",
              transition: "background 200ms, color 200ms",
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span className="v-label" style={{ fontSize: 13, color: "var(--ink-1)" }}>{activeCategory.label} unit</span>
        <UnitToggle category={activeCategory} value={value[active]} onChange={(s) => setOne(active, s)} />
      </div>
    </div>
  );
}
