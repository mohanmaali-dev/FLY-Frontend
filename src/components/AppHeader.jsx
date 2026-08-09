import { Link } from 'react-router-dom'

import { LogoMark } from './Logo.jsx'

/**
 * The header every screen renders, including the full-page loading, ended and
 * error states.
 *
 * Those states previously returned a bare centred <main>, so ending a session
 * left the user on a page with no navigation at all — the logo is the way back
 * to a fresh pairing code.
 */
export function AppHeader({ children }) {
  return (
    // Sticky: the pairing page scrolls well past a viewport, and the logo is
    // the only route back to a fresh code. Translucent rather than solid so the
    // content visibly passes under it instead of hitting an opaque band.
    <header className="sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4">
        <Link
          to="/"
          aria-label="FLY home"
          className="flex items-center gap-2.5 rounded-lg transition hover:opacity-80"
        >
          <LogoMark size="sm" />
          <span className="text-base font-semibold tracking-tight">FLY</span>
        </Link>

        {children}
      </div>
    </header>
  )
}

export default AppHeader
