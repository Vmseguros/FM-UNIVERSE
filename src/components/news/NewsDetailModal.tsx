import React from 'react';
import { News } from '../../types';
import { useNavigation } from '../../contexts/NavigationContext';
import {
  X,
  Calendar,
  Clock,
  User,
  Shield,
  MapPin,
  ExternalLink,
  Tag,
  AlertCircle,
} from 'lucide-react';

interface NewsDetailModalProps {
  news: News | null;
  isOpen: boolean;
  onClose: () => void;
}

export const NewsDetailModal: React.FC<NewsDetailModalProps> = ({ news, isOpen, onClose }) => {
  const { navigate } = useNavigation();

  if (!isOpen || !news) return null;

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'URGENTE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            Urgente
          </span>
        );
      case 'ALTA':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40">
            Prioridade Alta
          </span>
        );
      case 'MEDIA':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
            Geral
          </span>
        );
      default:
        return null;
    }
  };

  const getActionTarget = () => {
    if (news.type?.includes('TRANSFER') || news.category === 'TRANSFERENCIAS') {
      return { label: 'Acessar Mercado de Transferências', path: '/dashboard/mercado' };
    }
    if (news.type === 'MATCH_RESULT' || news.category === 'COMPETICAO') {
      return { label: 'Acessar Calendário & Partidas', path: '/jogos' };
    }
    if (news.type === 'STADIUM_UPGRADE' || news.category === 'ESTADIO') {
      return { label: 'Acessar Estádio & Patrimônio', path: '/dashboard/estadio' };
    }
    if (news.type === 'SUSPENSION' || news.type === 'INJURY' || news.category === 'DM_DISCIPLINA') {
      return { label: 'Ajustar Escalação Tática', path: '/dashboard/tatica' };
    }
    if (news.type === 'FINANCE_RECORD' || news.category === 'FINANCAS') {
      return { label: 'Acessar Finanças do Clube', path: '/dashboard/financas' };
    }
    return null;
  };

  const actionTarget = getActionTarget();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0f0f12] border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Stadium or Hero Image Banner if available */}
        {(news.stadiumImage || news.imageUrl) && (
          <div className="relative h-48 sm:h-56 w-full overflow-hidden bg-zinc-950 border-b border-zinc-800">
            <img
              src={news.stadiumImage || news.imageUrl}
              alt={news.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f12] via-[#0f0f12]/50 to-transparent" />
            
            {/* Club badge on banner */}
            {news.clubName && (
              <div className="absolute bottom-3 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs text-white font-bold">
                <span className="text-base">{news.clubBadge || '🛡️'}</span>
                <span>{news.clubName}</span>
              </div>
            )}

            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content Container */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Top meta tags */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                {news.category}
              </span>
              {getPriorityBadge(news.priority)}
            </div>

            {!news.stadiumImage && !news.imageUrl && (
              <button
                onClick={onClose}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Title */}
          <h2 className="text-xl sm:text-2xl font-black text-white leading-tight tracking-tight">
            {news.title}
          </h2>

          {/* Metadata info */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 border-y border-zinc-800/80 py-2.5">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              <span>{news.date}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-zinc-500" />
              <span>{news.author || 'Imprensa FM Universe'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <span>{news.readTimeMinutes || 2} min de leitura</span>
            </div>
          </div>

          {/* Summary Lead */}
          <p className="text-sm font-semibold text-zinc-300 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800 leading-relaxed">
            {news.summary}
          </p>

          {/* Full content with paragraphs */}
          <div className="text-xs sm:text-sm text-zinc-300 leading-relaxed whitespace-pre-line space-y-3 font-normal">
            {news.content}
          </div>
        </div>

        {/* Footer with action button */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[11px] text-zinc-500">
            Acontecimentos e coberturas oficiais do universo FM
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {actionTarget && (
              <button
                onClick={() => {
                  navigate(actionTarget.path);
                  onClose();
                }}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-md"
              >
                <span>{actionTarget.label}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs rounded-xl transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
