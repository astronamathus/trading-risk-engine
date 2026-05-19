import React from 'react';

interface InputProps {
  label: string;
  type?: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  step?: string;
}

export default function Input({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  required = false,
  step,
}: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={label} className="text-sm font-medium text-slate-200">
        {label}
        {required && <span className="ml-1 text-rose-400">*</span>}
      </label>
      <input
        id={label}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        className={`rounded-xl border bg-slate-900 px-3 py-2.5 text-slate-50 shadow-sm outline-none transition placeholder:text-slate-500 focus:ring-2 focus:ring-slate-500 ${
          error ? 'border-rose-400' : 'border-slate-700'
        }`}
      />
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
