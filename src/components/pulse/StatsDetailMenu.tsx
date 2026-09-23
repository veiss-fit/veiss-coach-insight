import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** Overlay fade and slide duration, ms. */
const PANEL_MS = 180;
/** Gap between the button and the panel, px. */
const PANEL_GAP = 6;

/** Same look as an active roster group filter button (FilterBar), without the click affordance. */
export function StatPill({ text }: { text: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 28,
        padding: "0 10px",
        borderRadius: 7,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: "nowrap",
        background: "var(--ink-0)",
        color: "#fff",
        border: "1px solid var(--ink-0)",
      }}
    >
      {text}
    </span>
  );
}

interface StatsDetailMenuProps {
  /** One pill per entry, stacked in a column. */
  pills: string[];
  /** Tooltip body for the (i) icon. */
  info: React.ReactNode;
  infoLabel: string;
  idPrefix: string;
}

/**
 * "Stats detail" button plus (i) tooltip. The button opens an overlay that
 * floats over the card (the card's layout does not change), fades and slides
 * in, and closes on an outside click or Escape. Rendered through a portal
 * into document.body so it always paints above every card, regardless of
 * each card's own stacking context (cards use position: relative for their
 * glow ring, which otherwise stacks a later sibling card on top of an
 * earlier card's open panel).
 */
export function StatsDetailMenu({ pills, info, infoLabel, idPrefix }: StatsDetailMenuProps) {
  const [open, setOpen] = useState(false);
  /** Stays true through the exit animation so the panel can fade out before it unmounts. */
  const [mounted, setMounted] = useState(false);
  /** Drives the fade and slide: false = hidden position, true = resting position. */
  const [shown, setShown] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({ top: rect.bottom + PANEL_GAP, right: window.innerWidth - rect.right });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Two frames so the hidden state is painted before the transition starts.
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), PANEL_MS);
    return () => window.clearTimeout(t);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={anchorRef} className="row" style={{ gap: 6 }}>
      <button
        type="button"
        className="v-btn"
        aria-expanded={open}
        aria-controls={`${idPrefix}-detail`}
        onClick={() => setOpen((o) => !o)}
        style={{ height: 28, padding: "0 10px", fontSize: 12, gap: 5 }}
      >
        Stats detail
        <ChevronDown size={14} strokeWidth={1.5} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 120ms" }} />
      </button>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={infoLabel}
              style={{ display: "inline-flex", border: "none", background: "transparent", padding: 2, cursor: "help", color: "var(--ink-2)" }}
            >
              <Info size={15} strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end" style={{ maxWidth: 320, fontSize: 12, lineHeight: 1.45 }}>
            {info}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {mounted &&
        createPortal(
          <div
            ref={panelRef}
            id={`${idPrefix}-detail`}
            style={{
              position: "fixed",
              top: pos.top,
              right: pos.right,
              zIndex: 1000,
              width: "max-content",
              maxWidth: 420,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 6,
              padding: 12,
              background: "var(--surface-1)",
              border: "1px solid var(--line-1)",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(7, 16, 31, 0.14)",
              opacity: shown ? 1 : 0,
              transform: shown ? "translateY(0)" : "translateY(-6px)",
              transition: `opacity ${PANEL_MS}ms ease, transform ${PANEL_MS}ms ease`,
              pointerEvents: open ? "auto" : "none",
            }}
          >
            {pills.length === 0 ? <span className="v-meta">Nothing to show.</span> : pills.map((t) => <StatPill key={t} text={t} />)}
          </div>,
          document.body
        )}
    </div>
  );
}
