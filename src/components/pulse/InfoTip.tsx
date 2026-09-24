import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/** (i) tooltip button, shared by beta-card metrics, roster column headers and stats-detail panels. */
export function InfoTip({
  label,
  children,
  side = "bottom",
  align = "end",
  maxWidth = 280,
  iconSize = 13,
}: {
  /** Full aria-label text, e.g. "About drop" — callers own any prefix/casing. */
  label: string;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  maxWidth?: number;
  iconSize?: number;
}) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            onClick={(e) => e.stopPropagation()}
            style={{ display: "inline-flex", border: "none", background: "transparent", padding: 2, cursor: "help", color: "var(--ink-2)" }}
          >
            <Info size={iconSize} strokeWidth={1.5} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          style={{ maxWidth, fontSize: 12, lineHeight: 1.45, textTransform: "none", letterSpacing: "normal", fontWeight: 400 }}
        >
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
