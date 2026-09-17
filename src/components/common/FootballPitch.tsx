import React from 'react';
import { TacticPositionSlot, TacticalSlot, Player } from '../../types';
import { UserCheck } from 'lucide-react';

export interface FootballPitchProps {
  slots: (TacticPositionSlot | TacticalSlot)[];
  players?: Player[];
  selectedSlotId?: string | null;
  onSelectSlot?: (slot: any) => void;
  onSlotClick?: (slot: any) => void;
  readOnly?: boolean;
}

export const FootballPitch: React.FC<FootballPitchProps> = ({
  slots,
  players = [],
  selectedSlotId,
  onSelectSlot,
  onSlotClick,
  readOnly = false,
}) => {
  const getPlayer = (slot: any): Player | undefined => {
    if (slot.player) return slot.player;
    if (slot.assignedPlayerId && players.length > 0) {
      return players.find((p) => p.id === slot.assignedPlayerId);
    }
    return undefined;
  };

  const handleSlotClick = (slot: any) => {
    if (readOnly) return;
    if (onSelectSlot) onSelectSlot(slot);
    if (onSlotClick) onSlotClick(slot);
  };

  return (
    <div
      id="fm-tactical-pitch"
      className="relative w-full aspect-[4/5] sm:aspect-[4/5] md:aspect-[3/4] max-w-lg mx-auto bg-emerald-950/80 rounded-xl border-2 border-emerald-700/60 overflow-hidden shadow-2xl p-4 select-none"
      style={{
        backgroundImage: `
          repeating-linear-gradient(
            0deg,
            rgba(6, 78, 59, 0.45) 0px,
            rgba(6, 78, 59, 0.45) 30px,
            rgba(6, 95, 70, 0.55) 30px,
            rgba(6, 95, 70, 0.55) 60px
          )
        `,
      }}
    >
      {/* Pitch Markings */}
      {/* Outer border line */}
      <div className="absolute inset-3 border border-white/25 rounded pointer-events-none" />

      {/* Halfway line */}
      <div className="absolute left-3 right-3 top-1/2 h-[1px] bg-white/25 pointer-events-none" />

      {/* Center circle */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 border border-white/25 rounded-full pointer-events-none" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/40 rounded-full pointer-events-none" />

      {/* Top Penalty Area (Away goal) */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-48 h-20 border-b border-x border-white/25 pointer-events-none" />
      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-8 border-b border-x border-white/25 pointer-events-none" />
      <div className="absolute top-23 left-1/2 -translate-x-1/2 w-16 h-8 border-b border-white/20 rounded-b-full pointer-events-none" />

      {/* Bottom Penalty Area (Home goal / Our goalkeeper) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-48 h-20 border-t border-x border-white/25 pointer-events-none" />
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-24 h-8 border-t border-x border-white/25 pointer-events-none" />
      <div className="absolute bottom-23 left-1/2 -translate-x-1/2 w-16 h-8 border-t border-white/20 rounded-t-full pointer-events-none" />

      {/* Tactical Slots */}
      {slots.map((slot) => {
        const player = getPlayer(slot);
        const isSelected = selectedSlotId === slot.id;
        const roleLabel = (slot as any).defaultRole || (slot as any).positionName || slot.label || 'JOG';

        return (
          <div
            key={slot.id}
            id={`pitch-slot-${slot.id}`}
            onClick={() => handleSlotClick(slot)}
            className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer transition-all duration-200 group ${
              readOnly ? 'cursor-default' : 'hover:scale-110 active:scale-95'
            }`}
            style={{
              left: `${slot.x}%`,
              top: `${slot.y}%`,
            }}
          >
            {/* Player Token */}
            <div
              className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-xs font-bold shadow-lg transition-colors border-2 ${
                isSelected
                  ? 'bg-amber-400 text-slate-950 border-white ring-4 ring-amber-400/50 shadow-[0_0_15px_rgba(251,191,36,0.5)]'
                  : player
                  ? 'bg-slate-900 text-emerald-400 border-emerald-400/80 group-hover:border-white group-hover:shadow-[0_0_12px_rgba(34,197,94,0.4)]'
                  : 'bg-slate-950/80 text-slate-400 border-dashed border-slate-500'
              }`}
            >
              {player ? (
                <span className="font-mono text-sm tracking-tight">{player.jerseyNumber}</span>
              ) : (
                <UserCheck className="w-4 h-4 opacity-50" />
              )}

              {/* Overall badge on corner */}
              {player && (
                <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 text-[10px] font-black px-1 rounded-sm shadow border border-slate-900 leading-none py-0.5">
                  {player.overall}
                </span>
              )}
            </div>

            {/* Player Name and Position Label */}
            <div className="mt-1 flex flex-col items-center pointer-events-none">
              <span
                className={`text-[11px] font-semibold px-1.5 py-0.5 rounded shadow max-w-[90px] truncate text-center leading-tight ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-md'
                    : 'bg-slate-950/90 text-slate-100 border border-slate-800'
                }`}
              >
                {player ? player.knownAs || player.name.split(' ').pop() : roleLabel}
              </span>
              <span className={`text-[9px] font-bold uppercase tracking-wider drop-shadow-md ${
                isSelected ? 'text-amber-300' : 'text-emerald-300/90'
              }`}>
                {roleLabel}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
