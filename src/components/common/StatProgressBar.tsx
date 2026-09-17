import React from 'react';

interface StatProgressBarProps {
  label?: string;
  value: number; // 0 to 100
  max?: number;
  showNumeric?: boolean;
  color?: 'emerald' | 'cyan' | 'amber' | 'rose' | 'indigo';
  size?: 'sm' | 'md';
  className?: string;
}

export const StatProgressBar: React.FC<StatProgressBarProps> = ({
  label,
  value,
  max = 100,
  showNumeric = true,
  color = 'emerald',
  size = 'sm',
  className = '',
}) => {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  const colorClasses: Record<string, string> = {
    emerald: 'bg-emerald-500',
    cyan: 'bg-cyan-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    indigo: 'bg-indigo-500',
  };

  const barHeight = size === 'sm' ? 'h-1.5' : 'h-2.5';

  return (
    <div className={`w-full ${className}`}>
      {(label || showNumeric) && (
        <div className="flex justify-between items-center text-xs mb-1">
          {label && <span className="text-slate-400 font-medium">{label}</span>}
          {showNumeric && (
            <span className="font-mono font-semibold text-slate-200 ml-auto">
              {value}
              {max !== 100 && <span className="text-slate-500 text-[10px]">/{max}</span>}
            </span>
          )}
        </div>
      )}
      <div className={`w-full bg-slate-800 rounded-full overflow-hidden ${barHeight} border border-slate-700/50`}>
        <div
          className={`${colorClasses[color]} ${barHeight} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
