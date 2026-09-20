import type { CSSProperties } from "react";

/** Narrowest a card may get before the grid drops to one column (px). Not tuned on screen yet. */
export const MIN_CARD = 420;

/**
 * Card grid used across the athlete page: two columns whenever each card can stay at
 * least `minCard` wide, one column below that. Never more than two, and a lone card
 * stays one cell wide (auto-fill keeps the empty track; auto-fit would stretch it).
 * The 11px is half the 20px gap plus a pixel, so two columns cannot round down to one.
 */
export const twoColumnGrid = (minCard = MIN_CARD, gap = 20): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, max(${minCard}px, calc(50% - ${gap / 2 + 1}px))), 1fr))`,
  gap,
});
