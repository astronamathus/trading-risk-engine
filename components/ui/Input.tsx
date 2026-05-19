// Reusable Input component
// A simple, styled input field with label

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
    <div className="flex flex-col gap-1">
      <label htmlFor={label} className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        id={label}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        className={`px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-500' : 'border-gray-300'
        }`}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
