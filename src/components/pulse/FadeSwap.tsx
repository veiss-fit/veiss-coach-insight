/**
 * Swaps its content when `id` changes: the old content is gone at once and, when
 * `animate` is true, the content of its cards fades in (opacity only, keyframes in
 * index.css); the cards themselves do not fade. The caller sets `animate` only for the
 * change it wants animated, so mounting, tab switches and workout changes stay instant.
 */
export function FadeSwap({ id, animate, children }: { id: string; animate: boolean; children: React.ReactNode }) {
  return (
    <div key={id} className={animate ? "v-fade-in" : undefined}>
      {children}
    </div>
  );
}
