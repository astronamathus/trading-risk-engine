import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export default function Card({ children, title, className = '' }: CardProps) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur ${className}`}>
      {title && <h2 className="mb-5 text-lg font-semibold tracking-tight text-slate-900">{title}</h2>}
      {children}
    </div>
  );
}
