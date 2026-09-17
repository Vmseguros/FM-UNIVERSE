import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { firebaseAuth } from '../../config/firebase';
import { auctionV2Service } from '../../services/auctionV2Service';
import { jogadoresService } from '../../services/jogadoresService';
import { clubesService } from '../../services/clubesService';
import {
  AuctionV2,
  AuctionV2Bid,
  AuctionV2AuditLog,
  AuctionV2Status,
} from '../../types/auctionV2';
import { Player, Club } from '../../types';
import { formatCurrencyBRL } from '../../utils/currency';
import { PositionBadge, RatingBadge } from '../../components/common/Badge';
import {
  Gavel,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  X,
  RefreshCw,
  History,
  FileText,
  DollarSign,
  TrendingUp,
  Ban,
  PlayCircle,
  ChevronLeft,
  ChevronRight,
  Trophy,
} from 'lucide-react';

export const AdminLeiloesPage: React.FC = () => {
  const { firebaseUser } = useAuth();
  const [auctions, setAuctions] = useState<AuctionV2[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  const [searchQuery, setSearchQuery] = useState('');
  const [runtimeUid, setRuntimeUid] = useState<string | null>(() => firebaseAuth?.currentUser?.uid || null);

  useEffect(() => {
    const rawUid = firebaseAuth?.currentUser?.uid;
    console.log('AUTH UID RUNTIME:' + (rawUid ?? ' NULL'));
    setRuntimeUid(rawUid || null);

    if (firebaseAuth) {
      const unsubscribe = firebaseAuth.onAuthStateChanged((user) => {
        const u = user?.uid;
        console.log('AUTH UID RUNTIME:' + (u ?? ' NULL'));
        setRuntimeUid(u || null);
      });
      return () => unsubscribe();
    }
  }, []);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [bidsModalAuction, setBidsModalAuction] = useState<AuctionV2 | null>(null);
  const [auctionBids, setAuctionBids] = useState<AuctionV2Bid[]>([]);
  const [auditModalAuction, setAuditModalAuction] = useState<AuctionV2 | null>(null);
  const [auctionAudits, setAuctionAudits] = useState<AuctionV2AuditLog[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [playerPage, setPlayerPage] = useState(1);
  const PLAYERS_PER_PAGE = 30;
  const [initialPrice, setInitialPrice] = useState<number>(5000000);
  const [minIncrement, setMinIncrement] = useState<number>(500000);
  const [scheduledOpenDate, setScheduledOpenDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [scheduledCloseDate, setScheduledCloseDate] = useState<string>(
    new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allAuctions, allPlayers, allClubs] = await Promise.all([
        auctionV2Service.getAuctions(),
        jogadoresService.getAll(),
        clubesService.getAll(),
      ]);
      setAuctions(allAuctions);
      setPlayers(allPlayers);
      setClubs(allClubs);
    } catch (err) {
      console.error('Erro ao carregar dados de leilões V2:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Filtragem de jogadores disponíveis para criação
  const availablePlayers = useMemo(() => {
    const activePlayerIds = new Set(
      auctions
        .filter((a) => a.status === 'ABERTO' || a.status === 'AGENDADO')
        .map((a) => a.playerId)
    );

    return players
      .filter((p) => {
        // Bloqueia jogador que já tem clube proprietário no FM Universe
        if (p.currentClubId) return false;
        // Bloqueia jogador já em leilão ativo
        if (activePlayerIds.has(p.id)) return false;
        if (p.isAuctionActive || p.auctionStatus === 'SOLD' || p.auctionStatus === 'IN_AUCTION') return false;
        return true;
      })
      .filter((p) => {
        if (!playerSearchQuery.trim()) return true;
        const q = playerSearchQuery.toLowerCase().trim();

        const nameMatch =
          (p.name || '').toLowerCase().includes(q) ||
          (p.fullName || '').toLowerCase().includes(q) ||
          (p.knownAs || '').toLowerCase().includes(q);

        const originClub = (p.clubName || p.club || (p.rawFMData && p.rawFMData['Club']) || '').toLowerCase();
        const originClubMatch = originClub.includes(q);

        const positionMatch =
          (p.position || '').toLowerCase().includes(q) ||
          (p.positionCategory || '').toLowerCase().includes(q);

        return nameMatch || originClubMatch || positionMatch;
      });
  }, [players, auctions, playerSearchQuery]);

  const totalPlayerPages = Math.max(1, Math.ceil(availablePlayers.length / PLAYERS_PER_PAGE));

  const paginatedPlayers = useMemo(() => {
    const start = (playerPage - 1) * PLAYERS_PER_PAGE;
    return availablePlayers.slice(start, start + PLAYERS_PER_PAGE);
  }, [availablePlayers, playerPage]);

  const selectedPlayer = useMemo(() => {
    return players.find((p) => p.id === selectedPlayerId) || null;
  }, [players, selectedPlayerId]);

  const handleSelectPlayer = (p: Player) => {
    setSelectedPlayerId(p.id);
    const suggestedInitial = p.marketValue ? Math.max(1000000, Math.round(p.marketValue * 0.7)) : 5000000;
    const suggestedIncrement = Math.max(250000, Math.round(suggestedInitial * 0.05));
    setInitialPrice(suggestedInitial);
    setMinIncrement(suggestedIncrement);
  };

  const handleCreateAuction = async () => {
    if (!selectedPlayerId) {
      showToast('error', 'Selecione um jogador para o leilão.');
      return;
    }
    if (initialPrice <= 0 || minIncrement <= 0) {
      showToast('error', 'O lance inicial e o incremento mínimo devem ser maiores que zero.');
      return;
    }
    if (!scheduledOpenDate || !scheduledCloseDate) {
      showToast('error', 'Preencha as datas de abertura e encerramento.');
      return;
    }

    const openIso = new Date(scheduledOpenDate).toISOString();
    const closeIso = new Date(scheduledCloseDate).toISOString();

    if (new Date(closeIso) <= new Date(openIso)) {
      showToast('error', 'A data de encerramento deve ser posterior à data de abertura.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await auctionV2Service.createAuction({
        playerId: selectedPlayerId,
        initialPrice,
        minIncrement,
        startTime: openIso,
        endTime: closeIso,
        adminId: firebaseUser?.uid || 'admin-system',
      });

      if (!res.success) {
        showToast('error', res.error || 'Falha ao criar leilão V2.');
        return;
      }

      showToast('success', 'Leilão V2 criado com sucesso no Firestore!');
      setIsCreateModalOpen(false);
      setSelectedPlayerId('');
      setPlayerSearchQuery('');
      await loadData();
    } catch (err) {
      showToast('error', 'Erro interno ao processar criação de leilão V2.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusTransition = async (auctionId: string, newStatus: AuctionV2Status) => {
    const confirmMessage =
      newStatus === 'ENCERRADO'
        ? 'Deseja realmente encerrar este leilão V2 agora? Se houver líder, a venda será consolidada no clube vencedor com débito financeiro real.'
        : newStatus === 'CANCELADO'
        ? 'Deseja cancelar o leilão V2? As reservas financeiras serão liberadas imediatamente.'
        : `Confirma alterar o status para ${newStatus}?`;

    if (!window.confirm(confirmMessage)) return;

    setIsSubmitting(true);
    try {
      const res = await auctionV2Service.updateStatus(
        auctionId,
        newStatus,
        firebaseUser?.uid || 'admin-system'
      );

      if (!res.success) {
        showToast('error', res.error || 'Falha ao atualizar leilão.');
        return;
      }

      showToast('success', `Status atualizado para ${newStatus} com sucesso!`);
      await loadData();
    } catch (err) {
      showToast('error', 'Erro ao alterar status do leilão V2.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenBidsModal = async (auction: AuctionV2) => {
    setBidsModalAuction(auction);
    try {
      const bids = await auctionV2Service.getBidsByAuction(auction.id);
      setAuctionBids(bids);
    } catch (err) {
      console.error('Erro ao carregar lances:', err);
    }
  };

  const handleOpenAuditModal = async (auction: AuctionV2) => {
    setAuditModalAuction(auction);
    try {
      const audits = await auctionV2Service.getAuditLogs(auction.id);
      setAuctionAudits(audits);
    } catch (err) {
      console.error('Erro ao carregar auditoria:', err);
    }
  };

  // Filtragem
  const filteredAuctions = useMemo(() => {
    return auctions.filter((a) => {
      if (filterStatus !== 'TODOS' && a.status !== filterStatus) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        (a.playerName || '').toLowerCase().includes(q) ||
        (a.playerClub || '').toLowerCase().includes(q) ||
        (a.currentLeaderClubName || '').toLowerCase().includes(q) ||
        (a.winnerClubName || '').toLowerCase().includes(q)
      );
    });
  }, [auctions, filterStatus, searchQuery]);

  // Estatísticas
  const stats = useMemo(() => {
    return {
      total: auctions.length,
      abertos: auctions.filter((a) => a.status === 'ABERTO').length,
      agendados: auctions.filter((a) => a.status === 'AGENDADO').length,
      encerrados: auctions.filter((a) => a.status === 'ENCERRADO').length,
      cancelados: auctions.filter((a) => a.status === 'CANCELADO').length,
    };
  }, [auctions]);

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between border shadow-lg ${
            feedback.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-600 text-emerald-200'
              : 'bg-red-950/90 border-red-600 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-zinc-400 hover:text-white ml-4 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#121212] border border-[#262626] p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
              <Gavel className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white">
                Painel Administrativo: Leilões V2
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Crie, agende, abra, acompanhe lances e encerre leilões no Firestore Real.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl border border-zinc-800 transition-colors cursor-pointer"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-900/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Novo Leilão V2</span>
          </button>
        </div>
      </div>

      {/* Diagnóstico Visível: AUTH UID RUNTIME */}
      <div className="bg-[#18150c] border-2 border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
            Diagnóstico de Sessão Firebase Auth (Tempo de Execução):
          </span>
        </div>
        <div className="font-mono text-sm font-black px-3.5 py-1.5 bg-black/80 rounded-xl border border-amber-500/40 text-amber-300">
          {runtimeUid ? `AUTH UID RUNTIME: ${runtimeUid}` : 'AUTH UID RUNTIME: NULL'}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-[#121212] border border-[#262626] p-4 rounded-xl">
          <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-medium">Total</div>
          <div className="text-2xl font-black text-white mt-1">{stats.total}</div>
        </div>
        <div className="bg-[#121212] border border-[#262626] p-4 rounded-xl">
          <div className="text-[11px] uppercase tracking-wider text-emerald-400 font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Abertos
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{stats.abertos}</div>
        </div>
        <div className="bg-[#121212] border border-[#262626] p-4 rounded-xl">
          <div className="text-[11px] uppercase tracking-wider text-blue-400 font-medium">Agendados</div>
          <div className="text-2xl font-black text-blue-400 mt-1">{stats.agendados}</div>
        </div>
        <div className="bg-[#121212] border border-[#262626] p-4 rounded-xl">
          <div className="text-[11px] uppercase tracking-wider text-purple-400 font-medium">Encerrados</div>
          <div className="text-2xl font-black text-purple-400 mt-1">{stats.encerrados}</div>
        </div>
        <div className="bg-[#121212] border border-[#262626] p-4 rounded-xl">
          <div className="text-[11px] uppercase tracking-wider text-red-400 font-medium">Cancelados</div>
          <div className="text-2xl font-black text-red-400 mt-1">{stats.cancelados}</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-[#121212] border border-[#262626] p-4 rounded-xl flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        <div className="flex flex-wrap gap-1.5">
          {['TODOS', 'ABERTO', 'AGENDADO', 'ENCERRADO', 'CANCELADO'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filterStatus === st
                  ? 'bg-purple-600 text-white'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por jogador, clube ou líder..."
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Auctions List */}
      {filteredAuctions.length === 0 ? (
        <div className="bg-[#121212] border border-[#262626] rounded-2xl p-12 text-center">
          <Gavel className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">Nenhum leilão V2 encontrado</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto mb-4">
            {filterStatus !== 'TODOS'
              ? `Não existem leilões com status "${filterStatus}".`
              : 'Nenhum leilão V2 criado ainda no Firestore.'}
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Primeiro Leilão V2</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAuctions.map((auction) => {
            const hasLeader = Boolean(auction.currentLeaderClubId && auction.totalBids > 0);
            return (
              <div
                key={auction.id}
                className="bg-[#121212] border border-[#262626] hover:border-purple-900/50 rounded-2xl p-5 flex flex-col justify-between transition-all shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        auction.status === 'ABERTO'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : auction.status === 'AGENDADO'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : auction.status === 'ENCERRADO'
                          ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {auction.status}
                    </span>

                    <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      {new Date(auction.endTime).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center font-bold text-zinc-300 text-sm overflow-hidden shrink-0">
                      {auction.playerPhoto ? (
                        <img
                          src={auction.playerPhoto}
                          alt={auction.playerName}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        auction.playerName.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white text-sm truncate">{auction.playerName}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        {auction.playerPosition && <PositionBadge position={auction.playerPosition} />}
                        {auction.playerRating && <RatingBadge rating={auction.playerRating} />}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-1 truncate">
                        Origem: {auction.playerClub || 'Livre'}
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0a0a0a] border border-[#222] p-3 rounded-xl space-y-2 text-xs mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Lance Atual</span>
                      <span className="font-black text-white font-mono text-sm">
                        {formatCurrencyBRL(auction.currentBid)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-1 border-t border-zinc-900">
                      <span className="text-zinc-500">Líder Atual</span>
                      <span className="font-bold text-purple-300 truncate max-w-[150px]">
                        {hasLeader ? auction.currentLeaderClubName : 'Sem lances'}
                      </span>
                    </div>

                    {auction.status === 'ENCERRADO' && auction.winnerClubName && (
                      <div className="flex justify-between items-center pt-1 border-t border-emerald-950 bg-emerald-950/20 p-1.5 rounded-lg">
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <Trophy className="w-3.5 h-3.5" />
                          Vencedor
                        </span>
                        <span className="font-black text-emerald-300 truncate max-w-[140px]">
                          {auction.winnerClubName}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-1 border-t border-zinc-900 text-zinc-400 text-[11px]">
                      <span>Total de lances: {auction.totalBids || 0}</span>
                      <span>+{formatCurrencyBRL(auction.minIncrement)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-3 border-t border-zinc-800">
                  <div className="flex flex-wrap gap-1.5">
                    {auction.status === 'AGENDADO' && (
                      <>
                        <button
                          onClick={() => handleStatusTransition(auction.id, 'ABERTO')}
                          disabled={isSubmitting}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          <span>Abrir Agora</span>
                        </button>
                        <button
                          onClick={() => handleStatusTransition(auction.id, 'CANCELADO')}
                          disabled={isSubmitting}
                          className="py-1.5 px-2 bg-zinc-800 hover:bg-red-900/60 text-zinc-300 hover:text-red-200 text-[11px] font-medium rounded-lg transition-colors cursor-pointer"
                          title="Cancelar"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    {auction.status === 'ABERTO' && (
                      <>
                        <button
                          onClick={() => handleStatusTransition(auction.id, 'ENCERRADO')}
                          disabled={isSubmitting}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
                          title="Finaliza o leilão consolidando a venda atômica ao líder atual"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Encerrar Manualmente</span>
                        </button>
                        <button
                          onClick={() => handleStatusTransition(auction.id, 'CANCELADO')}
                          disabled={isSubmitting}
                          className="py-1.5 px-2 bg-zinc-800 hover:bg-red-900/60 text-zinc-300 hover:text-red-200 text-[11px] font-medium rounded-lg transition-colors cursor-pointer"
                          title="Cancelar"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => handleOpenBidsModal(auction)}
                      className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[11px] font-medium rounded-lg border border-zinc-800 transition-colors cursor-pointer"
                    >
                      <History className="w-3 h-3 text-purple-400" />
                      <span>Ver Lances ({auction.totalBids || 0})</span>
                    </button>
                    <button
                      onClick={() => handleOpenAuditModal(auction)}
                      className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[11px] font-medium rounded-lg border border-zinc-800 transition-colors cursor-pointer"
                    >
                      <FileText className="w-3 h-3 text-blue-400" />
                      <span>Auditoria</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criação de Leilão V2 */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#262626] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#222] pb-4">
              <div className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Criar Novo Leilão V2</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Diagnóstico Runtime UID no Modal */}
              <div className="bg-[#18150c] border border-amber-500/30 rounded-xl p-3 font-mono text-xs text-amber-300 flex items-center justify-between">
                <span className="font-semibold">Sessão Firebase Auth Atual:</span>
                <span className="font-black px-2 py-0.5 bg-black/60 rounded border border-amber-500/20">
                  {runtimeUid ? `AUTH UID RUNTIME: ${runtimeUid}` : 'AUTH UID RUNTIME: NULL'}
                </span>
              </div>
              {/* Seleção de Jogador */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">
                  1. Escolher Jogador Sem Clube FM Universe
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={playerSearchQuery}
                    onChange={(e) => {
                      setPlayerSearchQuery(e.target.value);
                      setPlayerPage(1);
                    }}
                    placeholder="Buscar por nome, posição ou clube FM2008..."
                    className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="border border-zinc-800 rounded-xl max-h-48 overflow-y-auto bg-[#0a0a0a] divide-y divide-zinc-900">
                  {paginatedPlayers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-zinc-500">
                      Nenhum jogador disponível para novo leilão.
                    </div>
                  ) : (
                    paginatedPlayers.map((p) => {
                      const isSel = p.id === selectedPlayerId;
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleSelectPlayer(p)}
                          className={`p-2.5 flex items-center justify-between hover:bg-zinc-900/80 cursor-pointer text-xs transition-colors ${
                            isSel ? 'bg-purple-950/40 border-l-2 border-purple-500' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{p.name}</span>
                            <PositionBadge position={p.position} />
                            <span className="text-[11px] text-zinc-500">
                              Origem: {p.clubName || p.club || 'Livre'}
                            </span>
                          </div>
                          <div className="text-zinc-400 font-mono text-[11px]">
                            {p.marketValue ? formatCurrencyBRL(p.marketValue) : 'R$ 5.000.000'}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Paginação de jogadores */}
                {totalPlayerPages > 1 && (
                  <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
                    <span>
                      Página {playerPage} de {totalPlayerPages} ({availablePlayers.length} atletas)
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={playerPage <= 1}
                        onClick={() => setPlayerPage((prev) => Math.max(1, prev - 1))}
                        className="p-1 bg-zinc-900 border border-zinc-800 rounded hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={playerPage >= totalPlayerPages}
                        onClick={() => setPlayerPage((prev) => Math.min(totalPlayerPages, prev + 1))}
                        className="p-1 bg-zinc-900 border border-zinc-800 rounded hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Jogador Selecionado Preview */}
              {selectedPlayer && (
                <div className="bg-purple-950/20 border border-purple-500/30 p-3 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400" />
                    <span className="font-bold text-white">{selectedPlayer.name}</span>
                    <span className="text-zinc-400">({selectedPlayer.position})</span>
                  </div>
                  <span className="text-purple-300 font-semibold">
                    Origem FM2008 preservada: {selectedPlayer.clubName || selectedPlayer.club || 'Livre'}
                  </span>
                </div>
              )}

              {/* Valores do Leilão */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Lance Inicial (R$)
                  </label>
                  <input
                    type="number"
                    value={initialPrice}
                    onChange={(e) => setInitialPrice(Number(e.target.value))}
                    step={500000}
                    className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    {formatCurrencyBRL(initialPrice)}
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Incremento Mínimo (R$)
                  </label>
                  <input
                    type="number"
                    value={minIncrement}
                    onChange={(e) => setMinIncrement(Number(e.target.value))}
                    step={100000}
                    className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    {formatCurrencyBRL(minIncrement)}
                  </span>
                </div>
              </div>

              {/* Datas e Horários */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Data/Hora de Abertura
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledOpenDate}
                    onChange={(e) => setScheduledOpenDate(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Data/Hora de Encerramento
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledCloseDate}
                    onChange={(e) => setScheduledCloseDate(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#222] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateAuction}
                disabled={isSubmitting || !selectedPlayerId}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-900/30 flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Publicando...</span>
                  </>
                ) : (
                  <>
                    <Gavel className="w-4 h-4" />
                    <span>Publicar Leilão V2</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Lances */}
      {bidsModalAuction && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#262626] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#222] pb-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">
                  Lances do Leilão V2: {bidsModalAuction.playerName}
                </h3>
              </div>
              <button
                onClick={() => setBidsModalAuction(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {auctionBids.length === 0 ? (
                <div className="text-center p-8 text-zinc-500 text-xs">
                  Nenhum lance registrado neste leilão.
                </div>
              ) : (
                auctionBids.map((bid, index) => (
                  <div
                    key={bid.id}
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      index === 0
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                        : 'bg-[#0a0a0a] border-zinc-800 text-zinc-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{bid.clubName}</span>
                        {index === 0 && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-bold">
                            Maior Lance
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        Manager UID: {bid.managerId.slice(0, 10)}... • {new Date(bid.bidTime || bid.createdAt).toLocaleTimeString('pt-BR')}
                      </div>
                    </div>
                    <div className="text-sm font-black font-mono text-white">
                      {formatCurrencyBRL(bid.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-[#222]">
              <button
                onClick={() => setBidsModalAuction(null)}
                className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Auditoria */}
      {auditModalAuction && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#262626] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#222] pb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">
                  Auditoria V2: {auditModalAuction.playerName}
                </h3>
              </div>
              <button
                onClick={() => setAuditModalAuction(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {auctionAudits.length === 0 ? (
                <div className="text-center p-8 text-zinc-500 text-xs">
                  Nenhum registro de auditoria neste leilão.
                </div>
              ) : (
                auctionAudits.map((log) => (
                  <div key={log.id} className="p-3 bg-[#0a0a0a] border border-zinc-800 rounded-xl text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-blue-400 uppercase text-[10px]">
                        {log.action}
                      </span>
                      <span className="text-zinc-500 text-[10px] font-mono">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className="text-zinc-300 text-xs">{log.details}</div>
                    <div className="text-zinc-500 text-[10px] mt-1 font-mono">
                      Manager/Admin: {log.managerId}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-[#222]">
              <button
                onClick={() => setAuditModalAuction(null)}
                className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
