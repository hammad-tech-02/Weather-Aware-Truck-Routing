interface SpotterMarkProps {
  className?: string;
  title?: string;
}

/**
 * The Spotter mark as vector circles (one coral dot over a row of three), so it
 * stays crisp at any size. Geometry follows the official icon: equal radii on
 * a 54-unit grid.
 */
export function SpotterMark({ className, title = "Spotter" }: SpotterMarkProps) {
  return (
    <svg viewBox="0 0 158 104" className={className} role="img" aria-label={title}>
      <circle cx="25" cy="25" r="25" fill="#f2405a" />
      <circle cx="25" cy="79" r="25" fill="#0d8582" />
      <circle cx="79" cy="79" r="25" fill="#b8dfe0" />
      <circle cx="133" cy="79" r="25" fill="#b8dfe0" />
    </svg>
  );
}
