import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: React.ReactNode
  containerClassName?: string
}

export function Input({
  label,
  error,
  hint,
  icon,
  type = 'text',
  containerClassName = '',
  className = '',
  id,
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className={`flex flex-col gap-1 ${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-text-secondary"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {icon && (
          <span className="absolute left-3 text-text-secondary pointer-events-none">
            {icon}
          </span>
        )}

        <input
          id={inputId}
          type={inputType}
          className={[
            'w-full rounded-xl bg-bg-input text-text-primary placeholder:text-text-secondary',
            'border border-border transition-colors duration-150',
            'focus:outline-none focus:border-padel-green focus:ring-1 focus:ring-padel-green',
            'min-h-11 px-4 py-2.5 text-sm',
            icon ? 'pl-10' : '',
            isPassword ? 'pr-10' : '',
            error ? 'border-trust-low focus:border-trust-low focus:ring-trust-low' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 text-text-secondary hover:text-text-primary transition-colors min-h-11 min-w-11 flex items-center justify-center"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>

      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-trust-low">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${inputId}-hint`} className="text-xs text-text-secondary">
          {hint}
        </p>
      )}
    </div>
  )
}
