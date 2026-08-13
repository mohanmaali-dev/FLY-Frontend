import AppHeader from './AppHeader.jsx'
import Footer from './Footer.jsx'

export function InfoPage({ eyebrow, title, intro, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-raised text-ink">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
        <header className="max-w-2xl">
          <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-accent-hover">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-4 text-base leading-7 text-ink-soft">{intro}</p>
          <p className="mt-3 text-xs text-ink-mute">Last updated: 13 August 2026</p>
        </header>

        <div className="mt-10 space-y-8 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-8">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  )
}

export function InfoSection({ title, children }) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-ink-soft">{children}</div>
    </section>
  )
}

export default InfoPage
