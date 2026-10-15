/** The staff glyph: two staff lines with one block on each side. */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 22" aria-hidden="true" className={className} fill="currentColor">
      <rect x="7" y="0" width="1" height="22" />
      <rect x="9" y="0" width="1" height="22" />
      <rect x="11.5" y="3" width="3.5" height="7" />
      <rect x="2" y="12" width="3.5" height="7" opacity="0.55" />
    </svg>
  );
}
