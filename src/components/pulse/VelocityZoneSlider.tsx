import { useRef, useEffect } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { VBT_MAX, VBT_STEP, VELOCITY_ZONES, ZONE_BOUNDARIES, zoneOf } from "@/lib/vbtZones";

const snap = (v: number) =>
  parseFloat((Math.round(Math.max(0, Math.min(VBT_MAX, v)) / VBT_STEP) * VBT_STEP).toFixed(2));

const TRACK_GRADIENT = VELOCITY_ZONES.map((z) => {
  const s = (z.min / VBT_MAX) * 100;
  const e = (z.max / VBT_MAX) * 100;
  return `${z.color} ${s}%, ${z.color} ${e}%`;
}).join(", ");

interface VelocityZoneSliderProps {
  value: number;
  onChange: (v: number) => void;
  /** Show the ⓘ popover explaining Bryan Mann's VBT zones. */
  showInfo?: boolean;
}

/** VBT velocity-zone slider: %1RM axis, zone-colored track, m/s axis, readout. */
export function VelocityZoneSlider({ value, onChange, showInfo = true }: VelocityZoneSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const valFromClientX = (clientX: number) => {
    if (!trackRef.current) return 0;
    const { left, width } = trackRef.current.getBoundingClientRect();
    return snap(((clientX - left) / width) * VBT_MAX);
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (draggingRef.current) onChangeRef.current(valFromClientX(e.clientX));
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const zone = zoneOf(value);
  const pct = (value / VBT_MAX) * 100;

  const axisLabel = (i: number) =>
    i === 0 ? "none" : i === ZONE_BOUNDARIES.length - 1 ? "translateX(-100%)" : "translateX(-50%)";

  return (
    <div style={{ userSelect: "none" }}>
      {showInfo && (
        <div className="row" style={{ gap: 5, marginBottom: 6 }}>
          <span className="v-label" style={{ fontSize: 9.5 }}>Target velocity</span>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" style={{ border: "none", background: "none", padding: 0, color: "var(--ink-4)", cursor: "pointer", display: "inline-flex" }}>
                <Info size={12} strokeWidth={1.5} />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-96 p-4">
              <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Velocity-Based Training Zones</p>
              <p className="v-meta" style={{ fontSize: 11.5, marginBottom: 10 }}>
                Developed by Dr. Bryan Mann from data on Division I athletes. Each zone targets a distinct
                neuromuscular adaptation based on bar speed.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {VELOCITY_ZONES.map((z, i) => {
                  const hi = ZONE_BOUNDARIES[i]?.pct1rm ?? 100;
                  const lo = ZONE_BOUNDARIES[i + 1]?.pct1rm ?? 0;
                  return (
                    <div key={z.label} className="row" style={{ gap: 8, fontSize: 11.5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: z.color }} />
                      <span style={{ fontWeight: 500 }}>{z.label}</span>
                      <span className="mono" style={{ marginLeft: "auto", color: "var(--ink-3)" }}>
                        {z.min}–{z.max} m/s · {lo}–{hi}% 1RM
                      </span>
                    </div>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* %1RM axis */}
      <div style={{ position: "relative", height: 12, marginBottom: 2 }}>
        {ZONE_BOUNDARIES.map((b, i) => (
          <span
            key={b.ms}
            className="mono"
            style={{
              position: "absolute",
              top: 0,
              left: `${(b.ms / VBT_MAX) * 100}%`,
              fontSize: 9.5,
              color: "var(--ink-3)",
              transform: axisLabel(i),
            }}
          >
            {b.pct1rm}%
          </span>
        ))}
      </div>

      {/* Colored track */}
      <div
        ref={trackRef}
        style={{
          position: "relative",
          height: 22,
          borderRadius: 6,
          cursor: "crosshair",
          background: `linear-gradient(to right, ${TRACK_GRADIENT})`,
          touchAction: "none",
        }}
        onPointerDown={(e) => {
          draggingRef.current = true;
          onChangeRef.current(valFromClientX(e.clientX));
        }}
      >
        {ZONE_BOUNDARIES.map((b) => (
          <div
            key={b.ms}
            style={{ position: "absolute", top: 0, bottom: 0, width: 1, background: "rgba(0,0,0,0.18)", left: `${(b.ms / VBT_MAX) * 100}%`, pointerEvents: "none" }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${pct}%`,
            transform: "translate(-50%,-50%)",
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            border: `2px solid ${zone.color}`,
            boxShadow: "0 2px 6px rgba(7,16,31,0.25)",
            cursor: "grab",
            zIndex: 2,
            touchAction: "none",
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            draggingRef.current = true;
          }}
        />
      </div>

      {/* m/s axis */}
      <div style={{ position: "relative", height: 12, marginTop: 2 }}>
        {ZONE_BOUNDARIES.map((b, i) => (
          <span
            key={b.ms}
            className="mono"
            style={{
              position: "absolute",
              top: 0,
              left: `${(b.ms / VBT_MAX) * 100}%`,
              fontSize: 9.5,
              color: "var(--ink-3)",
              transform: axisLabel(i),
            }}
          >
            {b.ms === 0 ? "0" : b.ms}
          </span>
        ))}
      </div>

      {/* Readout */}
      <div className="row" style={{ marginTop: 8, gap: 8 }}>
        <input
          type="number"
          step={VBT_STEP}
          min={0}
          max={VBT_MAX}
          className="v-input mono"
          value={value.toFixed(2)}
          onChange={(e) => onChange(snap(parseFloat(e.target.value) || 0))}
          style={{ width: 68, height: 28, textAlign: "center", fontSize: 12.5 }}
        />
        <span className="v-mute2 mono" style={{ fontSize: 10.5 }}>m/s</span>
        <span className="v-chip" style={{ background: zone.color, color: "#fff" }}>{zone.label}</span>
      </div>
    </div>
  );
}
