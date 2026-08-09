function AuthField({ label, ...props }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-ink">{label}</span>
      {/* index.css already gives inputs a themed focus ring, so the local
          focus:* rules here only fought it. Left off deliberately. */}
      <input
        className="w-full rounded-xl border border-line-strong bg-surface px-4 py-3 text-ink outline-none transition placeholder:text-ink-mute hover:border-ink-mute"
        {...props}
      />
    </label>
  )
}

export default AuthField
