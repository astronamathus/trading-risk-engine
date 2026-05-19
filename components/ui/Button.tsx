// Reusable Button component
// A simple, styled button with loading state support

import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary';
  className?: string;
}

export default function Button({
  children,
  onClick,
  disabled = false,
  loading = false,
  type = 'button',
  variant = 'primary',
  className = '',
}: ButtonProps) {
  const baseStyles = 'px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
}
