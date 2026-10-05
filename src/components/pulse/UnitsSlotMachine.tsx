import { useMemo, useState } from "react";
import { Ruler, Scale, Gauge, Zap } from "lucide-react";
import { UNIT_CATEGORIES, type UnitCategory, type UnitPrefs, type UnitSystem } from "./UnitsSelector";

const ICONS: Record<UnitCategory, typeof Ruler> = {
  distance: Ruler,
  weight: Scale,
  velocity: Gauge,
  power: Zap,
};

const ITEM_H = 40;
const VISIBLE = 3; // rows shown in the window (prev / current / next)
const REEL_LEN = 24; // long strip so a spin has room to run before landing

interface ReelProps {
  category: (typeof UNIT_CATEGORIES)[number];
  value: UnitSystem;
  onChange: (system: UnitSystem) => void;
}

function Reel({ category, value, onChange }: ReelProps) {
  const startsMetric = value === "metric";
  // strip alternates metric/imperial; parity of index determines which system shows
  const strip = useMemo(
    () => Array.from({ length: REEL_LEN }, (_, i) => ((i % 2 === 0) === startsMetric ? "metric" : "imperial")) as UnitSystem[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [pos, setPos] = useState(2);
  const [spinning, setSpinning] = useState(false);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    const jump = 6 + Math.floor(Math.random() * 4) * 2 + 1; // odd -> lands on the other system
    const next = pos + jump;
    setPos(next);
    onChange(strip[next % strip.length]);
    window.setTimeout(() => setSpinning(false), 900);
  };

  const Icon = ICONS[category.id];
  const label = (s: UnitSystem) => (s === "metric" ? category.metric : category.imperial);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 76,
          height: ITEM_H * VISIBLE,
          borderRadius: 10,
          padding: 3,
          background: "linear-gradient(180deg, #2b2b33, #17171b)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06), 0 6px 16px rgba(0,0,0,0.35)",
          position: "relative",
        }}
      >
        {/* glass window */}
        <div
          role="button"
          tabIndex={0}
          aria-label={`Spin ${category.label} unit`}
          onClick={spin}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && spin()}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            overflow: "hidden",
            borderRadius: 7,
            background: "#0c0c0e",
            cursor: spinning ? "default" : "pointer",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: -ITEM_H,
              transform: `translateY(${-pos * ITEM_H}px)`,
              transition: spinning ? "transform 900ms cubic-bezier(0.15, 0.85, 0.25, 1)" : "none",
            }}
          >
            {strip.map((s, i) => (
              <div
                key={i}
                style={{
                  height: ITEM_H,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 15,
                  fontWeight: 800,
                  fontFamily: "var(--font-mono, monospace)",
                  color: "#efe6c8",
                  opacity: 0.9,
                }}
              >
                {label(s)}
              </div>
            ))}
          </div>

          {/* center payline */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: ITEM_H,
              height: ITEM_H,
              boxShadow: "inset 0 0 0 1px var(--brand)",
              background: "linear-gradient(180deg, transparent, rgba(255,195,0,0.08), transparent)",
              pointerEvents: "none",
            }}
          />
          {/* top/bottom fade */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, #0c0c0e 0%, transparent 30%, transparent 70%, #0c0c0e 100%)",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <Icon size={12} style={{ color: "var(--brand-ink)" }} />
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: "var(--ink-2)", textTransform: "uppercase" }}>
          {category.label}
        </span>
      </div>
    </div>
  );
}

interface UnitsSlotMachineProps {
  value: UnitPrefs;
  onChange: (prefs: UnitPrefs) => void;
}

/** Casino slot-machine styling for unit prefs: click a reel to spin it to the other system. */
export function UnitsSlotMachine({ value, onChange }: UnitsSlotMachineProps) {
  const jackpot = UNIT_CATEGORIES.every((c) => value[c.id] === value[UNIT_CATEGORIES[0].id]);

  const setOne = (id: UnitCategory, system: UnitSystem) => {
    onChange({ ...value, [id]: system });
  };

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        borderRadius: 18,
        background: "linear-gradient(160deg, #3a2e12, #1b1508)",
        boxShadow: jackpot
          ? "0 0 0 2px var(--brand), 0 0 24px 4px rgba(255,195,0,0.55), 0 12px 30px rgba(0,0,0,0.4)"
          : "0 0 0 1px rgba(255,195,0,0.25), 0 12px 30px rgba(0,0,0,0.4)",
        transition: "box-shadow 300ms",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "var(--brand)", textTransform: "uppercase" }}>
          Unit Reels
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.5,
            color: jackpot ? "var(--brand)" : "rgba(255,255,255,0.35)",
            transition: "color 300ms",
          }}
        >
          {jackpot ? "★ ALL MATCH ★" : "spin to match"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 10, padding: 10, borderRadius: 12, background: "rgba(0,0,0,0.25)" }}>
        {UNIT_CATEGORIES.map((c) => (
          <Reel key={c.id} category={c} value={value[c.id]} onChange={(s) => setOne(c.id, s)} />
        ))}
      </div>
    </div>
  );
}
