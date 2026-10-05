import { useLayoutEffect, useRef, useState } from "react";
import { Ruler, Scale, Gauge, Zap, ChevronDown, Paperclip } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  UNIT_CATEGORIES,
  type UnitCategory,
  type UnitCategoryDef,
  type UnitSystem,
} from "./UnitsSelector";
import { useUnits } from "@/contexts/UnitsContext";

const ICONS: Record<UnitCategory, typeof Ruler> = {
  distance: Ruler,
  weight: Scale,
  velocity: Gauge,
  power: Zap,
};

const TOGGLE_PAD = 4;
const TOGGLE_EASE = "450ms cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * Vertical sibling of UnitsSelector's UnitToggle: same sliding-blob mechanism
 * (measured from the buttons, animated with a matching ease), stacked top-to-bottom
 * instead of side-by-side, for use inside the nav bar's narrow per-category popover.
 */
function UnitToggleVertical({
  category,
  value,
  onChange,
}: {
  category: UnitCategoryDef;
  value: UnitSystem;
  onChange: (system: UnitSystem) => void;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const el = refs.current[value];
    if (el) setBox({ top: el.offsetTop, height: el.offsetHeight });
  }, [value]);

  const options: { id: UnitSystem; label: string }[] = [
    { id: "metric", label: category.metric },
    { id: "imperial", label: category.imperial },
  ];

  return (
    <div
      role="tablist"
      aria-label={`${category.label} unit`}
      aria-orientation="vertical"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "var(--radix-popover-trigger-width)",
        boxSizing: "border-box",
        padding: TOGGLE_PAD,
        gap: 2,
        borderRadius: 12,
        border: "1px solid var(--line-0)",
        background: "var(--surface-2, transparent)",
      }}
    >
      {box && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: TOGGLE_PAD,
            right: TOGGLE_PAD,
            top: 0,
            height: box.height,
            transform: `translateY(${box.top}px)`,
            borderRadius: 8,
            background: "var(--brand)",
            transition: `transform ${TOGGLE_EASE}, height ${TOGGLE_EASE}`,
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
            width: "100%",
            border: 0,
            background: "transparent",
            padding: "6px 16px",
            borderRadius: 8,
            font: "inherit",
            fontSize: 13,
            fontWeight: 500,
            textAlign: "center",
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

function CategoryCell({
  c,
  first,
  active,
  openCategory,
  setOpenCategory,
  setOne,
  locked = false,
}: {
  c: UnitCategoryDef;
  first: boolean;
  active: UnitSystem;
  openCategory: UnitCategory | null;
  setOpenCategory: (c: UnitCategory | null) => void;
  setOne: (id: UnitCategory, system: UnitSystem) => void;
  locked?: boolean;
}) {
  const Icon = ICONS[c.id];
  return (
    <div
      style={{
        padding: "12px 4px",
        borderLeft: first ? "none" : "1px solid var(--line-0)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--brand-soft)",
        }}
      >
        <Icon size={16} style={{ color: "var(--brand-ink)" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-1)", textTransform: "uppercase", letterSpacing: 0.3 }}>
        {c.label}
      </span>

      {locked ? (
        <div
          aria-label={`${c.label} unit, locked to Auto`}
          style={{
            width: "100%",
            height: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 500,
            borderRadius: 6,
            border: "1px dashed var(--line-0)",
            color: "var(--ink-2)",
          }}
        >
          {active === "metric" ? c.metric : c.imperial}
        </div>
      ) : (
        <Popover open={openCategory === c.id} onOpenChange={(o) => setOpenCategory(o ? c.id : null)}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`${c.label} unit`}
              className="focus:outline-none focus:ring-0 focus-visible:ring-0"
              style={{
                width: "100%",
                height: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 6,
                border: "1px solid var(--line-0)",
                background: "var(--surface-0, #fff)",
                color: "var(--ink-1)",
                cursor: "pointer",
              }}
            >
              {active === "metric" ? c.metric : c.imperial}
              <ChevronDown size={12} style={{ color: "var(--ink-2)", opacity: 0.6 }} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="center" sideOffset={6} className="z-[60] w-auto border-0 bg-transparent p-0 shadow-none">
            <UnitToggleVertical category={c} value={active} onChange={(s) => setOne(c.id, s)} />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

function GroupLabel({
  children,
  align = "center",
  padded = true,
  style,
}: {
  children: string;
  align?: "center" | "left";
  padded?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        color: "var(--ink-2)",
        padding: padded ? "8px 4px 0" : 0,
        textAlign: align,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Sits beside the Derived label: locks Velocity/Power to mirror Distance's system. Click again to unlock. */
function AutoButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? "Auto is on: click to unlock Velocity and Power" : "Turn on Auto: lock Velocity and Power to match Distance"}
      className="focus:outline-none focus:ring-0 focus-visible:ring-0"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 20,
        height: 20,
        padding: 0,
        borderRadius: 999,
        border: `1px solid ${active ? "var(--brand)" : "var(--line-0)"}`,
        background: active ? "var(--brand-soft)" : "transparent",
        color: active ? "var(--brand-ink)" : "var(--ink-2)",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <Paperclip size={11} />
    </button>
  );
}

/** Nav bar trigger + dropdown for metric/imperial preferences, split into Primary (distance/time/weight) and Derived (velocity/power). */
export function UnitsNavMenu() {
  const { prefs, setUnit, derivedAuto, setDerivedAuto } = useUnits();
  const [openCategory, setOpenCategory] = useState<UnitCategory | null>(null);

  const primary = UNIT_CATEGORIES.filter((c) => c.group === "primary");
  const derived = UNIT_CATEGORIES.filter((c) => c.group === "derived");

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="row focus:outline-none focus:ring-0 focus-visible:ring-0"
          style={{
            gap: 6,
            alignItems: "center",
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid var(--line-0)",
            background: "transparent",
            font: "inherit",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ink-1)",
            cursor: "pointer",
          }}
        >
          <Gauge size={14} style={{ color: "var(--brand-ink)" }} />
          Units
          <ChevronDown size={13} style={{ color: "var(--ink-2)" }} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="z-50 border-0 p-0"
        style={{
          width: 360,
          borderRadius: 16,
          overflow: "hidden",
          background: "var(--surface-0, #fff)",
          border: "1px solid var(--line-0)",
          boxShadow: "0 16px 40px -12px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ display: "flex" }}>
          <div style={{ flex: primary.length, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 30 }}>
              <GroupLabel padded={false}>Primary</GroupLabel>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${primary.length}, 1fr)` }}>
              {primary.map((c, i) => (
                <CategoryCell
                  key={c.id}
                  c={c}
                  first={i === 0}
                  active={prefs[c.id]}
                  openCategory={openCategory}
                  setOpenCategory={setOpenCategory}
                  setOne={setUnit}
                />
              ))}
            </div>
          </div>
          <div style={{ width: 1, background: "var(--line-0)" }} />
          <div style={{ flex: derived.length, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", height: 30, padding: "0 6px 0 4px" }}>
              <div aria-hidden style={{ width: 20, flexShrink: 0 }} />
              <GroupLabel align="center" padded={false} style={{ flex: 1 }}>Derived</GroupLabel>
              <AutoButton active={derivedAuto} onToggle={() => setDerivedAuto(!derivedAuto)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${derived.length}, 1fr)` }}>
              {derived.map((c, i) => (
                <CategoryCell
                  key={c.id}
                  c={c}
                  first={i === 0}
                  active={prefs[c.id]}
                  openCategory={openCategory}
                  setOpenCategory={setOpenCategory}
                  setOne={setUnit}
                  locked={derivedAuto}
                />
              ))}
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
