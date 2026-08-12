/** The FLY mark: an F that opens into a forward transfer arrow. */
export function Logo({ size = 18, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6.5 5.5v13" />
      <path d="M6.5 5.5h10" />
      <path d="M6.5 11.8h9" />
      <path d="m13.5 8.8 3 3-3 3" />
    </svg>
  )
}

/** The mark on its brand tile — the app's avatar, used in headers and states. */
export function LogoMark({ size = 'md', className = '' }) {
  const dimensions = {
    sm: { box: 'h-9 w-9 rounded-[0.8rem]', icon: 18 },
    md: { box: 'h-11 w-11 rounded-[0.9rem]', icon: 21 },
    lg: { box: 'h-13 w-13 rounded-2xl', icon: 25 },
  }[size]

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-brand-500 to-brand-700 text-white ring-1 ring-brand-700/15 ${dimensions.box} ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-1 top-0 h-px bg-white/50"
      />
      <Logo size={dimensions.icon} />
    </span>
  )
}

export default Logo
