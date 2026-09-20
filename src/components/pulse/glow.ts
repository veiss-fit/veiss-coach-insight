import type { CSSProperties } from "react";

/** Props for a card list that can highlight one exercise's card until it is clicked. */
export interface GlowProps {
  /** Exercise whose card glows. */
  glowExercise?: string | null;
  /** Called when the glowing card is clicked. */
  onGlowClear?: () => void;
}

/** Yellow ring around the whole card. */
export function glowStyle(active: boolean): CSSProperties {
  return {
    boxShadow: active ? "0 0 0 2px var(--brand), 0 0 16px 2px color-mix(in srgb, var(--brand) 55%, transparent)" : undefined,
    transition: "box-shadow 200ms ease",
    cursor: active ? "pointer" : undefined,
  };
}
