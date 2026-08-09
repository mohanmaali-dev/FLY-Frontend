/**
 * The FLY mark.
 *
 * Drawn as geometry rather than the ✈ emoji it replaced: an emoji renders as a
 * different colour cartoon on every platform and cannot inherit currentColor.
 * The stroke weight and round joins match the Feather icon set used everywhere
 * else in the app, so the logo and the UI icons read as one family.
 */
export function Logo({ size = 18, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </svg>
  )
}

/** The mark on its brand tile — the app's avatar, used in headers and states. */
export function LogoMark({ size = 'md', className = '' }) {
  const dimensions = {
    sm: { box: 'h-8 w-8 rounded-xl', icon: 16 },
    md: { box: 'h-10 w-10 rounded-xl', icon: 20 },
    lg: { box: 'h-12 w-12 rounded-2xl', icon: 24 },
  }[size]

  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-brand text-white ${dimensions.box} ${className}`}
    >
      <Logo size={dimensions.icon} />
    </span>
  )
}

export default Logo
