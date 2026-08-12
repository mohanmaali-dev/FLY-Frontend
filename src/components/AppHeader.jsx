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
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-3 rounded-2xl border border-line-strong bg-surface/92 px-3 py-2.5 shadow-[var(--shadow-raised)] backdrop-blur-xl sm:px-4">
        <Link
          to="/"
          aria-label="FLY home"
          className="group flex items-center gap-3 rounded-xl"
        >
          <LogoMark
            size="sm"
            className="shadow-[var(--shadow-button)] transition duration-200 group-hover:-translate-y-0.5"
          />
          <span className="flex flex-col">
            <span className="text-[1.05rem] font-semibold leading-none tracking-[-0.025em] text-ink">
              FLY
            </span>
            <span className="mt-1.5 hidden text-[0.65rem] font-medium leading-none text-ink-mute sm:block">
              Share between screens
            </span>
          </span>
        </Link>

        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </header>
  )
}

export default AppHeader
