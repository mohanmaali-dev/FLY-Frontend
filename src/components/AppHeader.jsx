import { FiLogOut } from 'react-icons/fi'

/**
 * Shared brand header.
 *
 * Same logo + layout on every page (Dashboard + JoinPairing + Home).
 * The only dynamic parts are optional status pill + optional logout button.
 */
export function AppHeader({ statusNode, user, onLogout }) {
  return (
    <header className="sticky-header">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        {/* Brand mark — identical everywhere */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-white shadow-sm">
            <span className="text-[13px] font-bold tracking-tight">F</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-[15px] font-semibold leading-none text-ink-900 sm:text-base">
                FLY Bridge
              </h1>
            </div>
            <p className="mt-1 hidden text-[12px] text-ink-500 sm:block">
              Cross-device transfer
            </p>
          </div>
        </div>

        {/* Right side: status + logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          {statusNode}

          {user && onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-2 text-[11px] font-medium text-ink-500 transition hover:bg-white hover:text-ink-700 sm:px-3 sm:text-xs"
              title="Log out"
            >
              <FiLogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
