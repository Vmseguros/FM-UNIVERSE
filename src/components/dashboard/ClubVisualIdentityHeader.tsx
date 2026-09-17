import React from 'react';
import { Club, Stadium } from '../../types';
import { ClubBadge } from '../common/ClubBadge';
import {
  MapPin,
  Users,
  Shield,
  Award,
  Bell,
  Crosshair,
  TrendingUp,
  Newspaper,
  CheckCircle,
  Sparkles,
} from 'lucide-react';

interface ClubVisualIdentityHeaderProps {
  club: Club;
  stadium?: Stadium;
  unreadNotifsCount: number;
  unreadNewsCount: number;
  onOpenNotifications: () => void;
  onOpenTactic: () => void;
  onOpenSquad: () => void;
  onScrollToNews: () => void;
}

export const ClubVisualIdentityHeader: React.FC<ClubVisualIdentityHeaderProps> = ({
  club,
  stadium,
  unreadNotifsCount,
  unreadNewsCount,
  onOpenNotifications,
  onOpenTactic,
  onOpenSquad,
  onScrollToNews,
}) => {
  const stadiumImage =
    stadium?.image ||
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80';

  return (
    <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-[#0c0c0e] shadow-xl">
      {/* Stadium Banner Background with Gradient Overlays */}
      <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-zinc-950">
        <img
          src={stadiumImage}
          alt={stadium?.name || club.stadiumName || 'Estádio'}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center brightness-60 contrast-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0e] via-[#0c0c0e]/60 to-black/30" />
        <div className="absolute inset-0 bg-radial-gradient from-transparent via-black/40 to-black/80" />

        {/* Top Badges overlay on banner */}
        <div className="absolute top-3 right-4 flex items-center gap-2">
          {/* Unread Notifications button */}
          <button
            onClick={onOpenNotifications}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-white text-xs font-semibold backdrop-blur-md border border-white/10 transition-colors cursor-pointer shadow-lg"
          >
            <Bell className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Notificações</span>
            {unreadNotifsCount > 0 && (
              <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full leading-tight animate-pulse">
                {unreadNotifsCount}
              </span>
            )}
          </button>

          {/* Quick News button */}
          <button
            onClick={onScrollToNews}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold backdrop-blur-md border border-emerald-500/40 transition-colors cursor-pointer shadow-lg"
          >
            <Newspaper className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Central de Notícias</span>
            {unreadNewsCount > 0 && (
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full leading-tight">
                {unreadNewsCount}
              </span>
            )}
          </button>
        </div>

        {/* Stadium pill label on banner */}
        <div className="absolute top-3 left-4 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl border border-white/10 text-xs text-zinc-200">
          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-bold">{stadium?.name || club.stadiumName || 'Arena Principal'}</span>
          <span className="text-zinc-500">•</span>
          <span className="text-zinc-400">{stadium?.city || 'São Paulo, Brasil'}</span>
        </div>
      </div>

      {/* Club Identity Foreground Info */}
      <div className="relative px-5 pb-5 -mt-14 sm:-mt-16 flex flex-col lg:flex-row items-start lg:items-end justify-between gap-6">
        {/* Shield & Main Identity */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div className="p-1.5 rounded-2xl bg-[#0c0c0e] border-2 border-emerald-500/60 shadow-2xl shrink-0">
            <ClubBadge club={club} size="xl" className="shadow-lg" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow-md">
                {club.name}
              </h1>
              <span className="bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/40">
                {club.code || club.shortName || 'TFC'}
              </span>
              <span className="bg-zinc-800 text-zinc-300 text-xs font-semibold px-2 py-0.5 rounded border border-zinc-700">
                Fundado em {club.foundedYear || 2024}
              </span>
            </div>

            {/* Manager and Board summary */}
            <div className="flex items-center gap-3 text-xs text-zinc-400 flex-wrap pt-0.5">
              <div className="flex items-center gap-1">
                <span className="text-zinc-500">Treinador Oficial:</span>
                <span className="font-bold text-white">
                  {club.managerName || 'Thales (Você)'}
                </span>
              </div>
              <span className="text-zinc-700">•</span>
              <div className="flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>Reputação:</span>
                <span className="font-mono font-bold text-amber-300">
                  {club.reputation || 86}/100
                </span>
              </div>
              <span className="text-zinc-700">•</span>
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Meta:</span>
                <span className="text-zinc-300 font-medium">{club.seasonTarget || 'G-4'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stadium Info Card & Quick Action CTAs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          {/* Stadium Mini Card */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 flex items-center gap-3.5 backdrop-blur-md">
            <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-zinc-700 bg-zinc-800">
              <img
                src={stadiumImage}
                alt={stadium?.name || 'Estádio'}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-xs">
              <div className="font-bold text-white flex items-center gap-1">
                <span>{stadium?.name || club.stadiumName || 'Arena Thales'}</span>
              </div>
              <div className="text-zinc-400 text-[11px] mt-0.5 flex items-center gap-2">
                <span>
                  Capacidade:{' '}
                  <strong className="text-emerald-400 font-mono">
                    {(stadium?.capacity || club.capacity || 75000).toLocaleString('pt-BR')}
                  </strong>
                </span>
                <span>•</span>
                <span>{stadium?.surface || 'Grama Natural'}</span>
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">
                Condição do gramado: {stadium?.pitchCondition || 98}% (Excelente)
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenTactic}
              className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs uppercase tracking-tight flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
            >
              <Crosshair className="w-4 h-4" />
              <span>Ajustar Tática</span>
            </button>
            <button
              onClick={onOpenSquad}
              className="flex-1 sm:flex-initial bg-zinc-900 hover:bg-zinc-800 text-white font-semibold px-4 py-2.5 rounded-xl text-xs border border-zinc-700/80 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Users className="w-4 h-4 text-zinc-400" />
              <span>Ver Elenco</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
