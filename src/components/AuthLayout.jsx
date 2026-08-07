import { Outlet } from 'react-router-dom'

function AuthLayout() {
  return (
    <main className="grid min-h-screen place-items-center bg-cream px-5 py-8">
      <div className="mx-auto w-full max-w-md">
        <section className="rounded-2xl border border-primary/15 bg-white p-6 sm:p-8">
          <Outlet />
        </section>
      </div>
    </main>
  )
}

export default AuthLayout
