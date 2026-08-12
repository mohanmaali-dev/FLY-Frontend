import { Link } from 'react-router-dom'
import { FiGlobe, FiLock, FiZap } from 'react-icons/fi'

import { useAuth } from '../context/AuthContext.jsx'
import { LogoMark } from './Logo.jsx'

const HIGHLIGHTS = [
  {
    icon: FiZap,
    title: 'Instant transfer',
    body: 'Shared items appear on both screens right away.',
  },
  {
    icon: FiLock,
    title: 'Temporary sessions',
    body: 'Your activity clears when the session ends.',
  },
  {
    icon: FiGlobe,
    title: 'Browser based',
    body: 'Works on phones, tablets and computers. No app needed.',
  },
]

/**
 * @param {object} props
 * @param {boolean} [props.compact] Trims to the legal strip — used on screens
 *   with a live session, where the brand blurb is just noise.
 */
export function Footer({ compact = false }) {
  const { user } = useAuth()
  const year = new Date().getFullYear()

  if (compact) {
    return (
      <footer className="mt-auto px-3 pb-3 pt-8 sm:px-5 sm:pb-4">
        <div className="mx-auto flex max-w-[1380px] flex-col gap-3 rounded-2xl border border-line bg-raised/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2.5">
            <LogoMark size="sm" className="shadow-[var(--shadow-card)]" />
            <div>
              <p className="text-sm font-semibold tracking-tight text-ink">FLY</p>
              <p className="mt-0.5 text-[0.68rem] text-ink-mute">
                Share between screens
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-5 border-t border-line pt-3 sm:border-t-0 sm:pt-0">
            <span className="flex items-center gap-1.5 text-xs text-ink-mute">
              <FiLock size={12} aria-hidden="true" />
              Clears when disconnected
            </span>
            <span className="text-xs text-ink-mute">&copy; {year}</span>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer className="mt-auto px-3 pb-3 pt-10 sm:px-5 sm:pb-4 sm:pt-14">
      <div className="mx-auto max-w-[1380px] overflow-hidden rounded-[2rem] border border-line-strong bg-raised shadow-[var(--shadow-raised)]">
        <div className="grid gap-9 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1.05fr_1.55fr_auto] lg:gap-12 lg:px-10">
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <LogoMark size="md" className="shadow-[var(--shadow-button)]" />
              <div>
                <p className="text-lg font-semibold leading-none tracking-tight text-ink">
                  FLY
                </p>
                <p className="mt-1.5 text-xs font-medium text-ink-mute">
                  Share between screens
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              Move text, links and files between your devices without an app,
              cable or complicated setup.
            </p>
          </div>

          <ul className="grid gap-5 sm:grid-cols-3 sm:gap-6">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex items-start gap-3 sm:block">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent-line bg-accent-soft text-accent">
                  <item.icon size={14} />
                </span>
                <div className="min-w-0 sm:mt-3">
                  <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <nav className="grid grid-cols-2 gap-10 sm:flex sm:gap-12 lg:gap-10">
            <div>
              <h2 className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.14em] text-ink-mute">
                Product
              </h2>
              <ul className="mt-3 space-y-2.5">
                <li>
                  <Link
                    to="/"
                    className="text-sm font-medium text-ink-soft transition hover:text-accent-hover"
                  >
                    Pair a device
                  </Link>
                </li>
                {user && (
                  <li>
                    <Link
                      to="/notes"
                      className="text-sm font-medium text-ink-soft transition hover:text-accent-hover"
                    >
                      Notes
                    </Link>
                  </li>
                )}
              </ul>
            </div>

            <div>
              <h2 className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.14em] text-ink-mute">
                Account
              </h2>
              <ul className="mt-3 space-y-2.5">
                {user ? (
                  <li className="max-w-[10rem] truncate text-sm font-medium text-ink-soft">
                    {user.name}
                  </li>
                ) : (
                  <>
                    <li>
                      <Link
                        to="/login"
                        className="text-sm font-medium text-ink-soft transition hover:text-accent-hover"
                      >
                        Log in
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/register"
                        className="text-sm font-medium text-ink-soft transition hover:text-accent-hover"
                      >
                        Create account
                      </Link>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </nav>
        </div>

        <div className="flex flex-col gap-2 border-t border-line bg-surface/70 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <p className="text-xs text-ink-mute">&copy; {year} FLY</p>
          <p className="text-xs text-ink-mute">
            Fast device sharing, directly in your browser.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
