import React, { useState, useEffect } from 'react';
import { News, NewsCategory } from '../../types';
import { noticiasService } from '../../services/noticiasService';
import { NewsDetailModal } from '../news/NewsDetailModal';
import {
  Newspaper,
  Search,
  Filter,
  CheckCheck,
  Calendar,
  Clock,
  ExternalLink,
  Shield,
  MapPin,
  ChevronRight,
  TrendingUp,
  ArrowRightLeft,
  AlertTriangle,
  Landmark,
} from 'lucide-react';

interface NewsFeedSectionProps {
  clubId?: string;
  clubName?: string;
}

export const NewsFeedSection: React.FC<NewsFeedSectionProps> = ({ clubId, clubName }) => {
  const [news, setNews] = useState<News[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedNews, setSelectedNews] = useState<News | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadNews = async () => {
    setIsLoading(true);
    try {
      const allNews = await noticiasService.getAll();
      setNews(allNews);
    } catch (err) {
      console.warn('Erro ao carregar notícias:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNews();
  }, [clubId]);

  const handleOpenNews = async (item: News) => {
    setSelectedNews(item);
    setIsModalOpen(true);
    if (!item.isRead) {
      await noticiasService.markAsRead(item.id);
      setNews((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
    }
  };

  const handleMarkAllRead = async () => {
    await noticiasService.markAllAsRead(clubId);
    setNews((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  // Filter criteria
  const filteredNews = news.filter((item) => {
    // Category filter
    if (selectedCategory === 'MY_CLUB') {
      if (clubId && item.clubId !== clubId) return false;
    } else if (selectedCategory === 'TRANSFERS') {
      if (item.category !== 'TRANSFERENCIAS' && !item.type?.includes('TRANSFER')) return false;
    } else if (selectedCategory === 'MATCHES') {
      if (item.category !== 'COMPETICAO' && item.type !== 'MATCH_RESULT' && item.type !== 'OTHER_CLUB_EVENT')
        return false;
    } else if (selectedCategory === 'FINANCE_STADIUM') {
      if (item.category !== 'FINANCAS' && item.category !== 'ESTADIO' && item.type !== 'STADIUM_UPGRADE' && item.type !== 'FINANCE_RECORD')
        return false;
    } else if (selectedCategory === 'OTHER_CLUBS') {
      if (clubId && item.clubId === clubId) return false;
    } else if (selectedCategory === 'DISCIPLINE') {
      if (item.category !== 'DM_DISCIPLINA' && item.type !== 'SUSPENSION' && item.type !== 'INJURY')
        return false;
    }

    // Search query filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchSummary = item.summary.toLowerCase().includes(q);
      const matchClub = item.clubName?.toLowerCase().includes(q);
      if (!matchTitle && !matchSummary && !matchClub) return false;
    }

    return true;
  });

  const unreadCount = news.filter((n) => !n.isRead).length;

  const getTypeBadge = (type?: string, category?: string) => {
    if (type === 'TRANSFER_PROPOSAL' || type === 'TRANSFER_COUNTER') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
          Proposta Mercado
        </span>
      );
    }
    if (type === 'TRANSFER_COMPLETED') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          Transferência
        </span>
      );
    }
    if (type === 'MATCH_RESULT') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
          Resultado de Jogo
        </span>
      );
    }
    if (type === 'OTHER_CLUB_EVENT') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-700/40 text-zinc-300 border border-zinc-700">
          Outros Clubes
        </span>
      );
    }
    if (type === 'STADIUM_UPGRADE') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          Estádio & Obras
        </span>
      );
    }
    if (type === 'SUSPENSION' || type === 'INJURY') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
          DM & Disciplina
        </span>
      );
    }
    if (type === 'STANDINGS_CHANGE') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
          Classificação
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
        {category || 'OFICIAL'}
      </span>
    );
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'URGENTE':
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/40 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            Urgente
          </span>
        );
      case 'ALTA':
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40">
            Destaque
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 hover:border-zinc-700/60 transition-colors">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Newspaper className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                Central de Notícias do FM Universe
              </h3>
              <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                {news.length} acontecimentos
              </span>
              {unreadCount > 0 && (
                <span className="bg-amber-500/20 text-amber-300 text-xs font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                  {unreadCount} não lida{unreadCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Feed dinâmico gerado em tempo real a partir de jogos, mercado, estádios e acontecimentos oficiais
            </p>
          </div>
        </div>

        {/* Right tools: Search and Mark all read */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar notícia, clube, atleta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-emerald-400 rounded-lg border border-zinc-800 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
              title="Marcar todas as notícias como lidas"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Marcar lidas</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Category Chips */}
      <div className="flex items-center gap-1.5 py-3 overflow-x-auto border-b border-zinc-800/60 text-xs">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
            selectedCategory === 'ALL'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          Todas ({news.length})
        </button>
        <button
          onClick={() => setSelectedCategory('MY_CLUB')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
            selectedCategory === 'MY_CLUB'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          ⭐ Meu Clube {clubName ? `(${clubName})` : ''}
        </button>
        <button
          onClick={() => setSelectedCategory('TRANSFERS')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
            selectedCategory === 'TRANSFERS'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          Mercado & Propostas
        </button>
        <button
          onClick={() => setSelectedCategory('MATCHES')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
            selectedCategory === 'MATCHES'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          Resultados de Jogos
        </button>
        <button
          onClick={() => setSelectedCategory('FINANCE_STADIUM')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
            selectedCategory === 'FINANCE_STADIUM'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          Finanças & Estádio
        </button>
        <button
          onClick={() => setSelectedCategory('OTHER_CLUBS')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
            selectedCategory === 'OTHER_CLUBS'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          Outros Clubes
        </button>
        <button
          onClick={() => setSelectedCategory('DISCIPLINE')}
          className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
            selectedCategory === 'DISCIPLINE'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          DM & Suspensões
        </button>
      </div>

      {/* News Grid */}
      <div className="pt-4">
        {filteredNews.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-xs">
            <Newspaper className="w-8 h-8 mx-auto mb-2 text-zinc-700 opacity-60" />
            Nenhuma notícia encontrada para os critérios selecionados.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredNews.map((item) => {
              const isUnread = !item.isRead;
              const hasStadium = Boolean(item.stadiumImage);

              return (
                <div
                  key={item.id}
                  onClick={() => handleOpenNews(item)}
                  className={`group rounded-xl border p-4 flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden ${
                    isUnread
                      ? 'bg-zinc-900/90 hover:bg-zinc-850 border-zinc-700/80 shadow-md hover:border-emerald-500/50'
                      : 'bg-zinc-900/40 hover:bg-zinc-900/70 border-zinc-800/80 hover:border-zinc-700'
                  }`}
                >
                  {/* Top Header Card */}
                  <div>
                    {/* Club badge & Name Identification + Priority */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {item.clubName ? (
                          <div className="flex items-center gap-1.5 bg-zinc-800/90 border border-zinc-700/70 px-2 py-0.5 rounded-lg text-xs font-bold text-white truncate">
                            <span className="text-sm shrink-0">{item.clubBadge || '🛡️'}</span>
                            <span className="truncate">{item.clubName}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-zinc-400 text-xs font-semibold">
                            <Shield className="w-3.5 h-3.5 text-emerald-500" />
                            <span>FM Universe</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {getPriorityBadge(item.priority)}
                        {isUnread && (
                          <span
                            className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                            title="Não lida"
                          />
                        )}
                      </div>
                    </div>

                    {/* Stadium Thumbnail if available */}
                    {hasStadium && (
                      <div className="relative h-28 w-full rounded-lg overflow-hidden mb-3 border border-zinc-800 bg-zinc-950">
                        <img
                          src={item.stadiumImage}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        <div className="absolute bottom-1.5 left-2 flex items-center gap-1 text-[10px] text-white font-medium">
                          <MapPin className="w-3 h-3 text-emerald-400" />
                          <span>Estádio Oficial</span>
                        </div>
                      </div>
                    )}

                    {/* Type tag */}
                    <div className="mb-1.5">{getTypeBadge(item.type, item.category)}</div>

                    {/* Headline */}
                    <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors leading-snug line-clamp-2 mb-2">
                      {item.title}
                    </h4>

                    {/* Summary */}
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mb-3">
                      {item.summary}
                    </p>
                  </div>

                  {/* Footer metadata */}
                  <div className="pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-zinc-600" />
                        <span>{item.date}</span>
                      </span>
                      <span>•</span>
                      <span className="truncate max-w-[90px]">{item.author || 'Imprensa FM'}</span>
                    </div>

                    <span className="text-emerald-400 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                      <span>Ler</span>
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detailed Reading Modal */}
      <NewsDetailModal
        news={selectedNews}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};
