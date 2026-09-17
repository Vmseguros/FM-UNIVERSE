import React, { useState } from 'react';
import { NotificationItem } from '../../types';
import { notificacoesService } from '../../services/notificacoesService';
import { useNavigation } from '../../contexts/NavigationContext';
import {
  Bell,
  X,
  CheckCheck,
  Trash2,
  ExternalLink,
  Info,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  ArrowRightLeft,
  Calendar,
} from 'lucide-react';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  clubId?: string;
  onRefresh: () => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  notifications,
  clubId,
  onRefresh,
}) => {
  const { navigate } = useNavigation();
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'TRANSFERS' | 'MATCHES'>('ALL');

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.read;
    if (filter === 'TRANSFERS') {
      return (
        n.type.includes('TRANSFER') ||
        n.title.toLowerCase().includes('proposta') ||
        n.title.toLowerCase().includes('transferência')
      );
    }
    if (filter === 'MATCHES') {
      return (
        n.title.toLowerCase().includes('rodada') ||
        n.title.toLowerCase().includes('partida') ||
        n.title.toLowerCase().includes('jogo')
      );
    }
    return true;
  });

  const handleMarkAsRead = async (id: string) => {
    await notificacoesService.markAsRead(id);
    onRefresh();
  };

  const handleMarkAllRead = async () => {
    await notificacoesService.markAllAsRead(clubId);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    await notificacoesService.delete(id);
    onRefresh();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'SUCCESS':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'WARNING':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'ALERT':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'TRANSFER_OFFER_RECEIVED':
      case 'TRANSFER_OFFER_ACCEPTED':
      case 'TRANSFER_OFFER_REJECTED':
        return <ArrowRightLeft className="w-4 h-4 text-cyan-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.read) {
      await notificacoesService.markAsRead(notif.id);
      onRefresh();
    }
    if (notif.link) {
      navigate(notif.link);
      onClose();
    } else if (notif.offerId || notif.type.includes('TRANSFER')) {
      navigate('/dashboard/mercado');
      onClose();
    } else if (notif.title.toLowerCase().includes('rodada')) {
      navigate('/dashboard');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0f0f12] border border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Central de Notificações</span>
                {unreadCount > 0 && (
                  <span className="bg-emerald-500 text-slate-950 text-xs font-black px-2 py-0.5 rounded-full">
                    {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-400">
                Avisos e comunicados em tempo real do FM Universe
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-emerald-500/10 transition-colors cursor-pointer"
                title="Marcar todas como lidas"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Marcar todas</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-3 border-b border-zinc-800/80 bg-zinc-950/40 overflow-x-auto text-xs">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
              filter === 'ALL'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            Todas ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('UNREAD')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
              filter === 'UNREAD'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            Não lidas ({unreadCount})
          </button>
          <button
            onClick={() => setFilter('TRANSFERS')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
              filter === 'TRANSFERS'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            Mercado
          </button>
          <button
            onClick={() => setFilter('MATCHES')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
              filter === 'MATCHES'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            Partidas
          </button>
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-zinc-800/40">
          {filteredNotifications.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              <Bell className="w-8 h-8 mx-auto mb-2 text-zinc-700 opacity-60" />
              Nenhuma notificação encontrada neste filtro.
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`pt-2.5 first:pt-0 group flex items-start gap-3 p-3 rounded-xl transition-all ${
                  notif.read
                    ? 'bg-zinc-900/30 hover:bg-zinc-900/60 border border-transparent'
                    : 'bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 shadow-sm'
                }`}
              >
                <div className="mt-0.5 shrink-0 p-2 rounded-lg bg-zinc-800/80 border border-zinc-700/50">
                  {getIcon(notif.type)}
                </div>

                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4
                      className={`text-xs font-bold truncate ${
                        notif.read ? 'text-zinc-300' : 'text-white'
                      }`}
                    >
                      {notif.title}
                    </h4>
                    <span className="text-[10px] text-zinc-500 shrink-0 font-mono">
                      {notif.date || 'Hoje'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                    {notif.message}
                  </p>

                  <div className="flex items-center gap-3 mt-2 text-[10px]">
                    {!notif.read && (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Não lida
                      </span>
                    )}
                    <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors flex items-center gap-1">
                      <span>Clique para ver detalhes</span>
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1 shrink-0">
                  {!notif.read && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="p-1 text-zinc-400 hover:text-emerald-400 transition-colors"
                      title="Marcar como lida"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(notif.id)}
                    className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between text-xs text-zinc-400">
          <span>Notificações oficiais do clube e da liga</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
