import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'outline' | 'neutral';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  className = '',
}) => {
  const variantStyles: Record<string, string> = {
    primary: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    secondary: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    success: 'bg-green-500/15 text-green-400 border-green-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    danger: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    info: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    neutral: 'bg-slate-800 text-slate-300 border-slate-700',
    outline: 'bg-transparent text-slate-300 border-slate-700',
  };

  const sizeStyles: Record<string, string> = {
    xs: 'text-[10px] px-1.5 py-0.5 font-medium tracking-wide',
    sm: 'text-xs px-2 py-0.5 font-semibold',
    md: 'text-sm px-2.5 py-1 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center justify-center whitespace-nowrap rounded border ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};

export const PositionBadge: React.FC<{ position: string; size?: 'xs' | 'sm' | 'md' }> = ({
  position,
  size = 'sm',
}) => {
  let color = 'bg-slate-800 text-slate-300 border-slate-700';

  if (position === 'GK') {
    color = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  } else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(position)) {
    color = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  } else if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(position)) {
    color = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  } else if (['ST', 'CF', 'LW', 'RW'].includes(position)) {
    color = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  }

  const sizeClasses = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : size === 'md' ? 'text-xs px-2.5 py-1 font-bold' : 'text-[11px] px-2 py-0.5 font-bold';

  return (
    <span className={`inline-flex items-center justify-center rounded font-mono uppercase tracking-wider border ${color} ${sizeClasses}`}>
      {position}
    </span>
  );
};

export const RatingBadge: React.FC<{ rating: number; size?: 'sm' | 'md' | 'lg' }> = ({
  rating,
  size = 'md',
}) => {
  let bg = 'bg-slate-800 text-slate-300 border-slate-700';
  if (rating >= 85) bg = 'bg-emerald-500 text-slate-950 font-bold border-emerald-400 shadow-sm shadow-emerald-500/20';
  else if (rating >= 80) bg = 'bg-emerald-600/90 text-white font-bold border-emerald-500';
  else if (rating >= 75) bg = 'bg-cyan-600/90 text-white font-bold border-cyan-500';
  else if (rating >= 70) bg = 'bg-amber-600/90 text-white font-bold border-amber-500';
  else bg = 'bg-rose-600/90 text-white font-bold border-rose-500';

  const sizeClasses =
    size === 'sm'
      ? 'w-6 h-6 text-xs'
      : size === 'lg'
      ? 'w-10 h-10 text-base font-extrabold'
      : 'w-7 h-7 text-xs font-bold';

  return (
    <div
      className={`inline-flex items-center justify-center rounded-md border text-center font-mono ${bg} ${sizeClasses}`}
      title={`Overall: ${rating}`}
    >
      {rating}
    </div>
  );
};
