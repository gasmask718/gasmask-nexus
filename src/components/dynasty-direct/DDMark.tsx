interface DDMarkProps {
  /** Rendered height in px. The mark stays crisp from 16px to hero scale. */
  size?: number;
  className?: string;
  /** Render the wordmark next to the mark. */
  withWordmark?: boolean;
  /** Invert the wordmark for dark (navy) chrome. */
  onDark?: boolean;
  title?: string;
}

/**
 * Dynasty Direct mark: two D-forms — left navy, right gold — separated by a
 * right-pointing arrow cut out of the shared negative space between them.
 * Pure vector, no raster, no gradients.
 */
export function DDMark({
  size = 32,
  className,
  withWordmark = false,
  onDark = false,
  title = "Dynasty Direct",
}: DDMarkProps) {
  const uid = `ddmark-${size}-${onDark ? "d" : "l"}`;
  const glyph = (
    <svg
      width={(size * 104) / 64}
      height={size}
      viewBox="0 0 104 64"
      fill="none"
      role="img"
      aria-label={title}
      className={withWordmark ? undefined : className}
      shapeRendering="geometricPrecision"
    >
      <title>{title}</title>
      <defs>
        <mask id={uid} maskUnits="userSpaceOnUse" x="0" y="0" width="104" height="64">
          <rect x="0" y="0" width="104" height="64" fill="#fff" />
          {/* The arrow: a chevron carved out of the gap between the two D's */}
          <path
            d="M40 2 L74 32 L40 62 L40 46 L56 32 L40 18 Z"
            fill="#000"
          />
        </mask>
      </defs>
      <g mask={`url(#${uid})`}>
        {/* Left D — navy */}
        <path
          d="M2 3 H30 A29 29 0 0 1 30 61 H2 Z M16 17 V47 H29 A15 15 0 0 0 29 17 Z"
          fill="hsl(var(--dd-navy))"
          fillRule="evenodd"
        />
        {/* Right D — gold */}
        <path
          d="M46 3 H74 A29 29 0 0 1 74 61 H46 Z M60 17 V47 H73 A15 15 0 0 0 73 17 Z"
          fill="hsl(var(--dd-gold))"
          fillRule="evenodd"
        />
      </g>
    </svg>
  );

  if (!withWordmark) return glyph;

  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ""}`}>
      {glyph}
      <span
        className="font-display leading-none"
        style={{ fontSize: size * 0.52, letterSpacing: "-0.01em" }}
      >
        <span style={{ color: onDark ? "#FFFFFF" : "hsl(var(--dd-navy))" }}>DYNASTY</span>
        <span style={{ color: "hsl(var(--dd-gold))" }}> DIRECT</span>
      </span>
    </span>
  );
}

/** The mark's arrow, on its own — for active nav markers, steps and dividers. */
export function DDChevron({
  size = 14,
  className,
  color = "hsl(var(--dd-gold))",
}: {
  size?: number;
  className?: string;
  color?: string;
}) {
  return (
    <svg
      width={(size * 34) / 60}
      height={size}
      viewBox="0 0 34 60"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path d="M0 0 L34 30 L0 60 L0 44 L16 30 L0 16 Z" fill={color} />
    </svg>
  );
}

export default DDMark;
