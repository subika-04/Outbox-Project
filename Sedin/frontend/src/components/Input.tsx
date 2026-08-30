import { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, forwardRef, ReactNode } from 'react';

interface FieldWrapperProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
}

export const FieldWrapper = ({ label, hint, error, required, htmlFor, children }: FieldWrapperProps) => (
  <div className="flex flex-col gap-1.5">
    {label && (
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
        {required && <span className="text-manifest-failed ml-0.5">*</span>}
      </label>
    )}
    {children}
    {error ? (
      <p className="text-xs text-manifest-failed">{error}</p>
    ) : hint ? (
      <p className="text-xs text-ink-faint">{hint}</p>
    ) : null}
  </div>
);

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, required, id, className = '', ...rest }, ref) => (
    <FieldWrapper label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <input
        ref={ref}
        id={id}
        required={required}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-ink bg-white placeholder:text-ink-faint focus-ring transition-colors ${
          error ? 'border-manifest-failed' : 'border-line focus:border-brand-400'
        } ${className}`}
        {...rest}
      />
    </FieldWrapper>
  )
);
Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, required, id, className = '', ...rest }, ref) => (
    <FieldWrapper label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <textarea
        ref={ref}
        id={id}
        required={required}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-ink bg-white placeholder:text-ink-faint focus-ring transition-colors resize-y ${
          error ? 'border-manifest-failed' : 'border-line focus:border-brand-400'
        } ${className}`}
        {...rest}
      />
    </FieldWrapper>
  )
);
Textarea.displayName = 'Textarea';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, required, id, options, placeholder, className = '', ...rest }, ref) => (
    <FieldWrapper label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <select
        ref={ref}
        id={id}
        required={required}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-ink bg-white focus-ring transition-colors ${
          error ? 'border-manifest-failed' : 'border-line focus:border-brand-400'
        } ${className}`}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  )
);
Select.displayName = 'Select';
