import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export default function Card({ children, title, className = '' }: CardProps) {
  return (
    <div className={`rounded-2xl border border-slate-700 bg-slate-900/70 p-6 shadow-lg backdrop-blur ${className}`}>
      {title && <h2 className="mb-5 text-lg font-semibold tracking-tight text-slate-100">{title}</h2>}
      {children}
    </div>
  );
}
