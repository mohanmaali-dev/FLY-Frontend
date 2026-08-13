import { Link } from 'react-router-dom'
import { FiArrowLeft } from 'react-icons/fi'
import { LuQrCode } from 'react-icons/lu'

import AppHeader from '../components/AppHeader.jsx'
import Footer from '../components/Footer.jsx'

function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-ink">
      <AppHeader />
      <main className="mx-auto grid w-full max-w-6xl flex-1 place-items-center px-4 py-16 sm:px-6">
        <section className="w-full max-w-md text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent">Error 404</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">This page did not land</h1>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-ink-soft">
            The address may be incorrect, or the page may have moved. Your active sharing session has not been changed.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
            <button type="button" onClick={() => window.history.back()} className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink-soft transition hover:border-line-strong hover:text-ink">
              <FiArrowLeft size={15} /> Go back
            </button>
            <Link to="/" className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-button)] transition hover:bg-accent-hover">
              <LuQrCode size={15} /> Open FLY
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default NotFoundPage
