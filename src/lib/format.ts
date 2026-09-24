/** Signed percent, one decimal place. −0.0% never shows a sign (matches the design ref). */
export const signedPct = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return r === 0 ? "0%" : r > 0 ? `+${r.toFixed(1)}%` : `−${Math.abs(r).toFixed(1)}%`;
};

/** Signed percent, whole number. */
export const signedInt = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(0)}%`;

/** e.g. "Jun 19" — UTC so a session's calendar date never shifts with the viewer's timezone. */
export const fmtShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" });
