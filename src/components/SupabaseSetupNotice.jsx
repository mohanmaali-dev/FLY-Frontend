import { FiSettings } from 'react-icons/fi'

/**
 * Shown instead of the app when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are
 * missing. Without this the client would fail during module evaluation and the
 * page would simply be blank.
 */
function SupabaseSetupNotice() {
  // In production a visitor gets a plain apology. Setup instructions, file
  // paths and env var names are for whoever deploys it — and Vite strips this
  // whole branch from the production bundle, so they are not shipped at all.
  if (!import.meta.env.DEV) {
    return (
      <main className="grid min-h-screen place-items-center bg-surface px-6 text-center text-ink">
        <div className="w-full max-w-sm">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-warn-soft text-warn">
            <FiSettings size={20} />
          </div>
          <h1 className="mt-6 text-xl font-semibold tracking-tight">
            FLY is temporarily unavailable
          </h1>
          <p className="mt-3 text-base leading-relaxed text-ink-soft">
            We are working on it. Please try again shortly.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="grid min-h-screen place-items-center bg-raised px-6 py-12 text-ink">
      <section className="w-full max-w-xl rounded-3xl border border-line-strong bg-surface p-8 shadow-[var(--shadow-raised)]">
        <div className="grid size-14 place-items-center rounded-2xl bg-warn-soft text-warn">
          <FiSettings size={24} />
        </div>

        <h1 className="mt-6 text-2xl font-bold">Supabase is not configured</h1>

        <p className="mt-3 text-sm leading-7 text-slate-600">
          FLY now runs entirely on Supabase. Add your project credentials to{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
            FLY-Frontend/.env
          </code>{' '}
          and restart <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">npm run dev</code>.
        </p>

        <pre className="mt-5 overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-6 text-slate-100">
{`VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
        </pre>

        <ol className="mt-6 space-y-2 text-sm leading-7 text-slate-600">
          <li>
            <span className="font-semibold text-ink">1.</span> Create a project at{' '}
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-accent-hover hover:underline"
            >
              supabase.com/dashboard
            </a>
          </li>
          <li>
            <span className="font-semibold text-ink">2.</span> Copy the URL and{' '}
            <code className="font-mono text-xs">anon</code> key from Project
            Settings → API
          </li>
          <li>
            <span className="font-semibold text-ink">3.</span> Run{' '}
            <code className="font-mono text-xs">supabase/schema.sql</code> in the
            SQL Editor
          </li>
        </ol>

        <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-xs leading-6 text-red-700">
          Use the <strong>anon</strong> key, never the{' '}
          <code className="font-mono">service_role</code> key — the latter
          bypasses row level security and must never reach a browser.
        </p>
      </section>
    </main>
  )
}

export default SupabaseSetupNotice
