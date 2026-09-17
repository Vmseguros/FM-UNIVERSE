import React, { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import { useAuth } from '../contexts/AuthContext';
import { notificacoesService } from '../services/notificacoesService';
import { jogosService } from '../services/jogosService';
import { seasonMotorService } from '../services/seasonMotorService';
import { dataStore } from '../services/dataStore';
import { NotificationItem, Match, RoundSummaryData } from '../types';
import { RoundSummaryModal } from '../components/season/RoundSummaryModal';
import { NotificationCenterModal } from '../components/notifications/NotificationCenterModal';
import { formatCurrencyBRL } from '../utils/currency';
import { ClubBadge } from '../components/common/ClubBadge';
import {
  LayoutDashboard,
  Users,
  Crosshair,
  DollarSign,
  Building2,
  Briefcase,
  Search,
  History,
  Bell,
  ArrowLeft,
  Calendar,
  Smile,
  Target,
  Menu,
  X,
  ChevronRight,
  TrendingUp,
  Database,
  Shield,
  LogOut,
  Play,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Gavel,
} from 'lucide-react';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentPath, navigate } = useNavigation();
  const { managedClub, role, firebaseUser, managerProfile, logoutManager, refreshClubData } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [isCenterModalOpen, setIsCenterModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [nextMatch, setNextMatch] = useState<Match | null>(null);

  // Motor de Temporada State
  const [isAdvancingRound, setIsAdvancingRound] = useState(false);
  const [roundSummary, setRoundSummary] = useState<RoundSummaryData | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [pendingRoundNumber, setPendingRoundNumber] = useState<number>(5);
  const [hasValidMatchForClub, setHasValidMatchForClub] = useState<boolean>(true);
  const [calendarDiagnostic, setCalendarDiagnostic] = useState<string | null>(null);
  const [isPendingRound, setIsPendingRound] = useState<boolean>(false);
  const [isOverdue, setIsOverdue] = useState<boolean>(false);
  const [advanceFeedback, setAdvanceFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const fetchNextPending = useCallback(async () => {
    try {
      const nextInfo = await seasonMotorService.getNextPendingRound(managedClub?.id);
      if (nextInfo) {
        setPendingRoundNumber(nextInfo.roundNumber);
        setHasValidMatchForClub(nextInfo.hasValidMatchForClub);
        setCalendarDiagnostic(nextInfo.diagnosticReason || null);
        setIsPendingRound(Boolean(nextInfo.isPendingRound));
        setIsOverdue(Boolean(nextInfo.isOverdue));
      }
    } catch {
      // fallback
    }
  }, [managedClub?.id]);

  useEffect(() => {
    const fetchNotifs = () => {
      notificacoesService.getAll(managedClub?.id).then(setNotifications);
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 10000);

    if (managedClub) {
      jogosService.getByClubId(managedClub.id).then((matches) => {
        // Encontra a partida SCHEDULED mais antiga respeitando a ordem das rodadas
        const scheduled = matches
          .filter((m) => m.status === 'SCHEDULED')
          .sort((a, b) => a.round - b.round || a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
        const upcoming = scheduled[0] || null;
        if (upcoming) setNextMatch(upcoming);
      });
    }

    fetchNextPending();

    return () => clearInterval(interval);
  }, [managedClub, fetchNextPending]);

  const handleAdvanceRound = async () => {
    if (!managedClub) {
      setAdvanceFeedback({ type: 'error', message: 'Nenhum clube ativo selecionado para avançar.' });
      return;
    }

    if (!hasValidMatchForClub) {
      setAdvanceFeedback({
        type: 'error',
        message:
          calendarDiagnostic ||
          `Avanço bloqueado: O clube ${managedClub.name} não possui partida agendada no calendário oficial da Rodada ${pendingRoundNumber}.`,
      });
      setTimeout(() => setAdvanceFeedback(null), 7000);
      return;
    }

    setIsAdvancingRound(true);
    setAdvanceFeedback(null);

    try {
      const tactic = dataStore.getTactic(managedClub.id);
      const summary = await seasonMotorService.advanceRound(managedClub.id, tactic);

      setRoundSummary(summary);
      setIsSummaryModalOpen(true);

      // Atualiza o estado global e o clube
      await refreshClubData();

      // Atualiza notificações e próximo jogo
      const notifs = await notificacoesService.getAll(managedClub.id);
      setNotifications(notifs);

      const matches = await jogosService.getByClubId(managedClub.id);
      const scheduled = matches
        .filter((m) => m.status === 'SCHEDULED')
        .sort((a, b) => a.round - b.round || a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
      const upcoming = scheduled[0] || null;
      setNextMatch(upcoming || null);

      await fetchNextPending();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAdvanceFeedback({ type: 'error', message: msg });
      setTimeout(() => setAdvanceFeedback(null), 6000);
    } finally {
      setIsAdvancingRound(false);
    }
  };

  const navOffice = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Elenco', path: '/dashboard/elenco', icon: Users },
    { label: 'Tática', path: '/dashboard/tatica', icon: Crosshair },
    { label: 'Mercado', path: '/dashboard/mercado', icon: Search },
    { label: 'Leilões V3', path: '/dashboard/leiloes-v3', icon: Gavel },
    { label: 'Leilões (V2)', path: '/dashboard/leiloes', icon: Gavel },
  ];

  const navClub = [
    { label: 'Finanças', path: '/dashboard/financas', icon: DollarSign },
    { label: 'Estádio', path: '/dashboard/estadio', icon: Building2 },
    { label: 'Staff', path: '/dashboard/comissao', icon: Briefcase },
    { label: 'Histórico', path: '/dashboard/historico', icon: History },
  ];

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNav = (path: string) => {
    navigate(path);
    setMobileNavOpen(false);
  };

  const markAllRead = () => {
    notifications.forEach((n) => notificacoesService.markAsRead(n.id));
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col md:flex-row font-sans selection:bg-green-500 selection:text-black">
      {/* Sidebar Desktop - Bento Grid Style */}
      <aside className="hidden md:flex flex-col w-64 bg-[#0f0f0f] border-r border-[#262626] shrink-0">
        {/* Brand Header */}
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center font-bold text-xl text-black">
            FM
          </div>
          <span className="text-xl font-black tracking-tighter text-white">UNIVERSE</span>
        </div>

        {/* Categorized Navigation */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] uppercase text-zinc-500 font-bold px-2 py-3 tracking-widest">
            Escritório
          </div>
          {navOffice.map((item) => {
            const isActive =
              item.path === '/dashboard'
                ? currentPath === '/dashboard'
                : currentPath.startsWith(item.path);
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-green-500' : 'text-zinc-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="text-[10px] uppercase text-zinc-500 font-bold px-2 pt-6 pb-3 tracking-widest">
            Clube
          </div>
          {navClub.map((item) => {
            const isActive = currentPath.startsWith(item.path);
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-green-500' : 'text-zinc-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Admin section only visible when role === 'ADMIN' (hidden from MANAGER) */}
          {role === 'ADMIN' && (
            <>
              <div className="text-[10px] uppercase text-purple-400 font-bold px-2 pt-6 pb-3 tracking-widest flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-purple-400" />
                <span>Administração</span>
              </div>
              <button
                onClick={() => handleNav('/admin/importar-fm26')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                  currentPath === '/admin/importar-fm26'
                    ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30 font-bold'
                    : 'text-purple-300/80 hover:bg-purple-950/40 hover:text-white'
                }`}
              >
                <Database className="w-4 h-4 text-purple-400" />
                <span>Importar Banco FM26</span>
              </button>
            </>
          )}
        </nav>

        {/* Bottom Trainer Profile Card */}
        <div className="p-4 border-t border-[#262626] space-y-2">
          <div className="flex items-center gap-3 p-2 bg-zinc-900 border border-zinc-800 rounded-lg">
            <ClubBadge club={managedClub} size="sm" className="rounded-full" />
            <div className="overflow-hidden min-w-0 flex-1">
              <p className="text-xs font-bold truncate text-white">
                {managerProfile?.name || managedClub?.managerName || 'Treinador'}
              </p>
              <p className="text-[10px] text-emerald-400 truncate font-semibold">
                {managedClub?.name || 'Sem Clube'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-md text-xs transition-colors border border-zinc-800/60 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Portal</span>
            </button>

            {firebaseUser && (
              <button
                onClick={async () => {
                  await logoutManager();
                  navigate('/login');
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-950/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 rounded-md text-xs transition-colors border border-red-500/20 cursor-pointer"
                title="Sair da Conta"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#050505]">
        {/* Bento Grid Header */}
        <header className="h-16 border-b border-[#262626] flex items-center justify-between px-4 sm:px-8 bg-[#0a0a0a] sticky top-0 z-20">
          {/* Mobile Top Bar */}
          <div className="flex md:hidden items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-green-500 rounded flex items-center justify-center font-bold text-xs text-black">
                FM
              </div>
              <span className="font-bold text-sm text-white truncate">{managedClub?.name || 'Sem Clube'}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                className="relative p-2 text-zinc-400 hover:bg-zinc-800 rounded-lg cursor-pointer"
                title="Notificações"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-[17px] text-[10px] font-extrabold bg-emerald-500 text-slate-950 rounded-full text-center shadow-lg leading-tight animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                className="p-2 text-zinc-400 hover:bg-zinc-800 rounded-lg"
              >
                {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Desktop HUD Stats */}
          <div className="hidden md:flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
                Clube Atual
              </span>
              <span className="text-sm font-bold text-white">
                {managedClub?.name || 'Sem Clube'}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
                Saldo
              </span>
              <span className="text-sm font-bold text-green-400 font-mono">
                {formatCurrencyBRL(managedClub?.balance || 0, { compact: true })}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
                Próximo Jogo
              </span>
              <span className="text-sm font-bold text-white">
                {nextMatch
                  ? `${nextMatch.homeClubId === managedClub?.id ? nextMatch.awayClubName : nextMatch.homeClubName} (${nextMatch.homeClubId === managedClub?.id ? 'C' : 'F'})`
                  : (managedClub ? 'Aguardando calendário' : 'Sem Jogos')}
              </span>
            </div>
          </div>

          {/* Right Action Tools */}
          <div className="hidden md:flex items-center gap-4">
            <div className="bg-zinc-900 px-3 py-1 rounded border border-zinc-800 text-xs font-mono text-zinc-300 flex items-center gap-1.5">
              {nextMatch ? (
                <>
                  {isPendingRound && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Partida Pendente Obrigatória" />}
                  <span>{nextMatch.date}</span>
                </>
              ) : (
                <span>{managedClub ? 'Temporada Oficial' : '-'}</span>
              )}
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                className="relative p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                title="Notificações"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 min-w-[16px] text-[10px] font-black bg-emerald-500 text-slate-950 rounded-full text-center shadow-md leading-tight animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {notifDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-[#121212] border border-[#262626] rounded-xl shadow-2xl p-3 z-50 text-xs">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800">
                    <span className="font-bold text-white">Notificações</span>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-[10px] text-green-400 hover:underline cursor-pointer"
                        >
                          Marcar lidas
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setNotifDropdownOpen(false);
                          setIsCenterModalOpen(true);
                        }}
                        className="text-[10px] text-emerald-400 font-bold hover:underline cursor-pointer"
                      >
                        Ver Central
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-4 text-center text-zinc-500 text-[11px]">
                        Nenhuma notificação registrada.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-2 rounded-lg border ${
                            n.read
                              ? 'bg-zinc-900/50 border-zinc-800/60 text-zinc-400'
                              : 'bg-zinc-800/70 border-zinc-700 text-zinc-200'
                          }`}
                        >
                          <div className="flex justify-between font-semibold text-white mb-0.5">
                            <span>{n.title}</span>
                            <span className="text-[10px] text-zinc-500">{n.date}</span>
                          </div>
                          <p className="text-[11px] text-zinc-300">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-2 pt-2 border-t border-zinc-800 text-center">
                    <button
                      onClick={() => {
                        setNotifDropdownOpen(false);
                        setIsCenterModalOpen(true);
                      }}
                      className="w-full py-1.5 bg-zinc-900 hover:bg-zinc-800 text-emerald-400 hover:text-emerald-300 rounded text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      Abrir Central de Notificações
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleAdvanceRound}
              disabled={isAdvancingRound || !hasValidMatchForClub}
              className={`px-4 py-1.5 rounded text-xs font-bold transition-all uppercase tracking-tight flex items-center gap-1.5 shadow-md ${
                !hasValidMatchForClub
                  ? 'bg-zinc-800/90 text-zinc-400 border border-zinc-700/80 cursor-not-allowed opacity-90'
                  : 'bg-green-600 hover:bg-green-500 disabled:opacity-60 disabled:cursor-not-allowed text-black cursor-pointer hover:shadow-green-500/20 active:scale-95'
              }`}
              title={
                !hasValidMatchForClub
                  ? (calendarDiagnostic || 'Avanço bloqueado: Não há partida agendada no calendário oficial para o seu clube.')
                  : isPendingRound
                  ? `Partida pendente obrigatória da Rodada ${pendingRoundNumber}. O avanço além desta rodada está bloqueado.`
                  : 'Avançar rodada da temporada no FM Universe'
              }
            >
              {isAdvancingRound ? (
                <>
                  <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Processando...</span>
                </>
              ) : !hasValidMatchForClub ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Sem Jogo (R{pendingRoundNumber})</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-black text-black" />
                  <span>Continuar</span>
                  <span className={`px-1 py-0.5 rounded text-[10px] font-mono leading-none ${
                    isPendingRound ? 'bg-amber-400 text-black font-black' : 'bg-black/20'
                  }`}>
                    R{pendingRoundNumber}{isPendingRound ? ' • Pendente' : ''}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Banner de feedback caso ocorra algum erro ou bloqueio */}
          {advanceFeedback && (
            <div
              className={`absolute top-16 right-4 z-40 px-4 py-2.5 rounded-xl border text-xs flex items-center gap-2 shadow-2xl animate-in slide-in-from-top duration-200 ${
                advanceFeedback.type === 'error'
                  ? 'bg-rose-950/95 border-rose-800 text-rose-200'
                  : 'bg-emerald-950/95 border-emerald-800 text-emerald-200'
              }`}
            >
              {advanceFeedback.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span className="font-medium">{advanceFeedback.message}</span>
              <button
                onClick={() => setAdvanceFeedback(null)}
                className="ml-2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Mobile Drawer */}
          {mobileNavOpen && (
            <div className="md:hidden absolute top-16 left-0 right-0 bg-[#0f0f0f] border-b border-[#262626] px-4 py-3 space-y-1 z-30 shadow-2xl">
              <div className="p-2">
                <button
                  onClick={handleAdvanceRound}
                  disabled={isAdvancingRound || !hasValidMatchForClub}
                  className={`w-full px-4 py-2.5 rounded-lg text-xs font-bold transition-all uppercase tracking-tight flex items-center justify-center gap-2 ${
                    !hasValidMatchForClub
                      ? 'bg-zinc-800/90 text-zinc-400 border border-zinc-700/80 cursor-not-allowed opacity-90'
                      : 'bg-green-600 hover:bg-green-500 disabled:opacity-60 text-black cursor-pointer'
                  }`}
                >
                  {isAdvancingRound ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Processando Rodada...</span>
                    </>
                  ) : !hasValidMatchForClub ? (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Sem Jogo Válido (R{pendingRoundNumber})</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-black text-black" />
                      <span>
                        Continuar (Avançar Rodada {pendingRoundNumber}
                        {isPendingRound ? ' • Pendente' : ''})
                      </span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-[10px] uppercase text-zinc-500 font-bold px-2 py-1">Escritório</div>
              {navOffice.map((item) => {
                const isActive =
                  item.path === '/dashboard'
                    ? currentPath === '/dashboard'
                    : currentPath.startsWith(item.path);
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNav(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium ${
                      isActive
                        ? 'bg-green-500/10 text-green-500 border border-green-500/20 font-bold'
                        : 'text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
              <div className="text-[10px] uppercase text-zinc-500 font-bold px-2 pt-2">Clube</div>
              {navClub.map((item) => {
                const isActive = currentPath.startsWith(item.path);
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNav(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium ${
                      isActive
                        ? 'bg-green-500/10 text-green-500 border border-green-500/20 font-bold'
                        : 'text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              {/* Admin section for mobile when role === 'ADMIN' */}
              {role === 'ADMIN' && (
                <>
                  <div className="text-[10px] uppercase text-purple-400 font-bold px-2 pt-2 flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-purple-400" />
                    <span>Administração</span>
                  </div>
                  <button
                    onClick={() => handleNav('/admin/importar-fm26')}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium text-purple-300 hover:bg-purple-950/40"
                  >
                    <Database className="w-4 h-4 text-purple-400" />
                    <span>Importar Banco FM26</span>
                  </button>
                </>
              )}
              <div className="pt-2 border-t border-[#262626]">
                <button
                  onClick={() => navigate('/')}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-zinc-900 text-zinc-300 rounded-md text-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar ao Portal Público</span>
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Dynamic Outlet */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Modal Oficial de Resumo da Rodada (Motor de Temporada FM Universe) */}
        <RoundSummaryModal
          data={roundSummary}
          isOpen={isSummaryModalOpen}
          onClose={() => {
            setIsSummaryModalOpen(false);
            refreshClubData();
          }}
        />

        {/* Central de Notificações Modal */}
        <NotificationCenterModal
          isOpen={isCenterModalOpen}
          onClose={() => setIsCenterModalOpen(false)}
          notifications={notifications}
          clubId={managedClub?.id}
          onRefresh={() => notificacoesService.getAll(managedClub?.id).then(setNotifications)}
        />
      </div>
    </div>
  );
};
