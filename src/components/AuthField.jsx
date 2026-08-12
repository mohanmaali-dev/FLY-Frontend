import { useId, useState } from 'react'
import { FiEye, FiEyeOff } from 'react-icons/fi'

function AuthField({ label, hint, id, type = 'text', ...props }) {
  const generatedId = useId()
  const inputId = id || generatedId
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 sm:mb-2">
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
        {hint && <span className="text-xs text-ink-mute">{hint}</span>}
      </div>

      <div className="relative">
        <input
          id={inputId}
          type={isPassword && showPassword ? 'text' : type}
          className={`w-full rounded-xl border border-line-strong bg-raised px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-mute hover:border-ink-mute focus:bg-surface sm:px-4 sm:py-3 ${
            isPassword ? 'pr-12' : ''
          }`}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-lg text-ink-mute transition hover:text-ink"
          >
            {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
          </button>
        )}
      </div>
    </div>
  )
}

export default AuthField
