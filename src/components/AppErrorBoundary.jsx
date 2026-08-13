import { Component } from 'react'

import { LogoMark } from './Logo.jsx'
import { recordEvent } from '../services/telemetry.service.js'

class AppErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('FLY could not render the page:', error, info)
    recordEvent('app_error', { source: 'boundary', errorName: error?.name || 'Error' })
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="grid min-h-screen place-items-center bg-raised px-4 text-ink">
        <section className="w-full max-w-md rounded-3xl border border-line-strong bg-surface p-6 text-center shadow-[var(--shadow-float)] sm:p-8">
          <LogoMark size="lg" className="mx-auto" />
          <p className="mt-5 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-danger">Something went wrong</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">This page could not load</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">Your shared files and session have not been deleted. Reload the page to reconnect safely.</p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <a href="/" className="rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink-soft transition hover:border-line-strong hover:text-ink">Go to home</a>
            <button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-button)] transition hover:bg-accent-hover">Reload page</button>
          </div>
        </section>
      </main>
    )
  }
}

export default AppErrorBoundary
