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
    // bg-raised, not the old bg-cream. That alias resolves to the same white as
    // the card, so the panel was a white rectangle on a white page held apart
    // by a hairline. A recessed ground gives it something to sit on.
    <main className="grid min-h-screen place-items-center bg-raised px-5 py-10">
      <div className="mx-auto w-full max-w-md">
        <Link
          to="/"
          aria-label="FLY home"
          className="mx-auto flex w-fit items-center gap-2.5 rounded-lg transition hover:opacity-80"
        >
          <LogoMark size="sm" />
          <span className="text-base font-semibold tracking-tight">FLY</span>
        </Link>

        <section className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
          <Outlet />
        </section>

        <Link
          to="/"
          className="mx-auto mt-6 flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-ink-soft transition hover:text-ink"
        >
          <FiArrowLeft size={15} />
          Back to pairing
        </Link>
      </div>
    </main>
  )
}

export default AuthLayout
