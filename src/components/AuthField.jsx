function AuthField({ label, ...props }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-ink-700">{label}</span>
      <input
        className="w-full rounded-md border border-ink-200 bg-white px-4 py-3 outline-none transition placeholder:text-ink-400 focus:border-primary focus:ring-2 focus:ring-primary-ring"
        {...props}
      />
    </label>
  )
}

export default AuthField
