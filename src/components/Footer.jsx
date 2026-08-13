import { Link } from 'react-router-dom'
import { FiLock } from 'react-icons/fi'

import { LogoMark } from './Logo.jsx'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto px-3 pb-3 pt-8 sm:px-5 sm:pb-4">
      <div className="mx-auto flex max-w-[1380px] flex-col gap-3 rounded-2xl border border-line bg-raised/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <Link
          to="/"
          state={{ showPairView: true }}
          aria-label="FLY home"
          className="flex w-fit items-center gap-2.5 rounded-xl"
        >
          <LogoMark size="sm" className="shadow-[var(--shadow-card)]" />
          <div>
            <p className="text-sm font-semibold tracking-tight text-ink">FLY</p>
            <p className="mt-0.5 text-[0.68rem] text-ink-mute">
              Share between screens
            </p>
          </div>
        </Link>

        <div className="flex flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-center sm:gap-5 sm:border-t-0 sm:pt-0">
          <nav aria-label="Footer" className="flex items-center gap-4 text-xs font-medium text-ink-mute">
            <Link to="/privacy" className="transition hover:text-ink">Privacy</Link>
            <Link to="/terms" className="transition hover:text-ink">Terms</Link>
            <Link to="/contact" className="transition hover:text-ink">Support</Link>
          </nav>
          <span className="flex items-center gap-1.5 text-xs text-ink-mute">
            <FiLock size={12} aria-hidden="true" />
            Private sharing, made simple
          </span>
          <span className="text-xs text-ink-mute">&copy; {year}</span>
        </div>
      </div>
    </footer>
  )
}

export default Footer
