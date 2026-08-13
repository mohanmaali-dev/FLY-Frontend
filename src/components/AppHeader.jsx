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
export function AppHeader({ children, homeTo = '/', preserveSession = false }) {
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-3 rounded-2xl border border-line-strong bg-surface/92 px-3 py-2.5 shadow-[var(--shadow-raised)] backdrop-blur-xl sm:px-4">
        <Link
          to={homeTo}
          state={preserveSession ? undefined : { showPairView: true }}
          aria-label={preserveSession ? 'FLY — active sharing session' : 'FLY home'}
          aria-current={preserveSession ? 'page' : undefined}
          title={preserveSession ? 'Sharing session active' : 'FLY home'}
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

        {children ? (
          <div className="flex items-center gap-2">{children}</div>
        ) : (
          <nav aria-label="Main navigation" className="flex items-center gap-1 rounded-xl border border-line bg-raised/75 p-1 shadow-[var(--shadow-card)]">
            <Link
              to="/#how-it-works"
              state={{ showPairView: true }}
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-surface hover:text-ink hover:shadow-[var(--shadow-card)] sm:block"
            >
              How it works
            </Link>
            <Link
              to="/#join-session"
              state={{ showPairView: true }}
              className="rounded-lg bg-accent-strong px-3.5 py-2 text-sm font-medium text-white shadow-[var(--shadow-button)] transition active:scale-[0.98] hover:bg-accent-hover sm:px-4"
            >
              <span className="sm:hidden">Enter code</span>
              <span className="hidden sm:inline">Join with code</span>
            </Link>
          </nav>
        )}
      </div>
    </header>
  )
}

export default AppHeader
