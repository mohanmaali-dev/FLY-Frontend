import { Link } from 'react-router-dom'
import { FiGlobe, FiLock, FiZap } from 'react-icons/fi'

import { useAuth } from '../context/AuthContext.jsx'
import { LogoMark } from './Logo.jsx'

// Written as benefits a person gets, not as a description of how the app is
// built. What it does for you, not what it does internally.
const HIGHLIGHTS = [
  {
    icon: FiZap,
    title: 'Instant',
    body: 'Whatever you send lands on the other screen right away.',
  },
  {
    icon: FiLock,
    title: 'Private by design',
    body: 'A session belongs to your devices and closes with them.',
  },
  {
    icon: FiGlobe,
    title: 'Works everywhere',
    body: 'Any phone, tablet or laptop with a browser. Nothing to install.',
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

  return (
    <footer className="mt-auto border-t border-line bg-raised">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {!compact && (
          <div className="flex flex-col gap-8 pb-8 sm:flex-row sm:justify-between">
            <div className="max-w-sm">
              <div className="flex items-center gap-2.5">
                <LogoMark size="sm" />
                <span className="text-base font-semibold tracking-tight">FLY</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                The quickest way to get a link, a note or a file from one screen
                to another.
              </p>
            </div>

            {/* Only routes that exist. Invented links are what make a site feel
                like a template. */}
            <nav className="flex gap-12 sm:gap-16">
              <div>
                <h2 className="text-sm font-medium text-ink">Product</h2>
                <ul className="mt-3 space-y-2.5">
                  <li>
                    <Link
                      to="/"
                      className="text-sm text-ink-soft transition hover:text-ink"
                    >
                      Pair a device
                    </Link>
                  </li>
                  {user && (
                    <li>
                      <Link
                        to="/notes"
                        className="text-sm text-ink-soft transition hover:text-ink"
                      >
                        Notes
                      </Link>
                    </li>
                  )}
                </ul>
              </div>

              <div>
                <h2 className="text-sm font-medium text-ink">Account</h2>
                <ul className="mt-3 space-y-2.5">
                  {user ? (
                    <li className="max-w-[12rem] truncate text-sm text-ink-soft">
                      {user.name}
                    </li>
                  ) : (
                    <>
                      <li>
                        <Link
                          to="/login"
                          className="text-sm text-ink-soft transition hover:text-ink"
                        >
                          Log in
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="/register"
                          className="text-sm text-ink-soft transition hover:text-ink"
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
        )}

        {!compact && (
          <ul className="grid gap-6 border-t border-line py-8 sm:grid-cols-3 sm:gap-8">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title}>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent-line bg-accent-soft text-accent">
                  <item.icon size={16} />
                </span>
                <h3 className="mt-3 text-sm font-medium text-ink">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        )}

        <div
          className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${
            compact ? '' : 'border-t border-line pt-6'
          }`}
        >
          <p className="text-xs text-ink-mute">&copy; {year} FLY</p>
          <p className="text-xs text-ink-mute">Made for moving between screens</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
