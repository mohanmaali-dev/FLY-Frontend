import { Link, Outlet } from 'react-router-dom'
import { FiArrowLeft } from 'react-icons/fi'

import { LogoMark } from './Logo.jsx'

/**
 * The shell every auth screen renders inside.
 *
 * These pages previously had no route out — no header, no logo, no link home —
 * so landing on one by mistake left the browser's back button as the only way
 * back to pairing. The mark above the card and the link below it are both
 * deliberate: the mark is where people look first, the worded link is what
 * they look for when the mark does not read as clickable.
 */
function AuthLayout() {
  return (
    <main className="grid min-h-screen place-items-center bg-raised px-4 py-8 sm:px-5 sm:py-10">
      <div className="mx-auto w-full max-w-md">
        <Link
          to="/"
          aria-label="FLY home"
          className="mx-auto flex w-fit items-center gap-2.5 rounded-xl transition hover:opacity-80"
        >
          <LogoMark size="sm" className="shadow-[var(--shadow-button)]" />
          <div>
            <p className="text-base font-semibold leading-none tracking-tight text-ink">FLY</p>
            <p className="mt-1.5 text-[0.65rem] text-ink-mute">Share between screens</p>
          </div>
        </Link>

        <section className="mt-4 rounded-2xl border border-line-strong bg-surface p-4 shadow-[var(--shadow-raised)] sm:mt-6 sm:p-8">
          <Outlet />
        </section>

        <Link
          to="/"
          className="mx-auto mt-5 flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-soft transition hover:bg-surface hover:text-ink sm:mt-6"
        >
          <FiArrowLeft size={15} />
          Back to pairing
        </Link>
      </div>
    </main>
  )
}

export default AuthLayout
