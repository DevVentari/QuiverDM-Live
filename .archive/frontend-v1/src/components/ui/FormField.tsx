'use client';

import { cn } from '@/lib/utils';
import { forwardRef, type ReactNode } from 'react';

interface FormFieldProps {
  /** Field label */
  label: string;
  /** HTML id for the input (auto-generated if not provided) */
  id?: string;
  /** Error message */
  error?: string;
  /** Help text shown below the field */
  helpText?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Children (the input element) */
  children: ReactNode;
  /** Additional class name for the container */
  className?: string;
}

export function FormField({
  label,
  id,
  error,
  helpText,
  required = false,
  disabled = false,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={id}
        className={cn(
          'block text-sm font-medium',
          disabled ? 'text-gray-500' : 'text-gray-200',
          error && 'text-red-400'
        )}
      >
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      {helpText && !error && (
        <p className="text-sm text-gray-500">{helpText}</p>
      )}
    </div>
  );
}

// Common input styles that can be applied to inputs
export const inputClassName = cn(
  'w-full rounded-md border bg-gray-900 px-3 py-2 text-sm text-gray-100',
  'border-gray-700 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500',
  'placeholder:text-gray-500',
  'disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500'
);

export const inputErrorClassName = cn(
  'border-red-500 focus:border-red-500 focus:ring-red-500'
);

// Text input component
interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ error, className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(inputClassName, error && inputErrorClassName, className)}
        {...props}
      />
    );
  }
);
TextInput.displayName = 'TextInput';

// Textarea component
interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          inputClassName,
          'min-h-[80px] resize-y',
          error && inputErrorClassName,
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

// Select component
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, options, placeholder, className, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(inputClassName, error && inputErrorClassName, className)}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
);
Select.displayName = 'Select';
