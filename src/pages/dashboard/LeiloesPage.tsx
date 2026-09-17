import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { auctionV2Service } from '../../services/auctionV2Service';
import {
  AuctionV2,
  AuctionV2Bid,
  AuctionV2BudgetSummary,
} from '../../types/auctionV2';
import { Club } from '../../types';
import { formatCurrencyBRL } from '../../utils/currency';
import { PositionBadge, RatingBadge } from '../../components/common/Badge';
import { ClubBadge } from '../../components/common/ClubBadge';
import {
  Gavel,
  Clock,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Search,
  Lock,
  ArrowUpRight,
  Info,
  X,
  History,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

export const LeiloesPage: React.FC = () => {
  const { firebaseUser, managerProfile, refreshClubData } = useAuth();

  const [auctions, setAuctions] = useState<AuctionV2[]>([]);
  const [managerClub, setManagerClub] = useState<Club | null>(null);
  const [budgetSummary, setBudgetSummary] = useState<AuctionV2BudgetSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ABERTOS' | 'MEUS_LANCES' | 'ENCERRADOS'>('ABERTOS');
  const [searchQuery, setSearchQuery] = useState('');

  // Bid Modal State
  const [biddingAuction, setBiddingAuction] = useState<AuctionV2 | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    currentBid?: number;
    reservedAmount?: number;
  } | null>(null);

  // Modal de Histórico de Lances do Leilão
  const [viewHistoryAuction, setViewHistoryAuction] = useState<AuctionV2 | null>(null);
  const [historyBids, setHistoryBids] = useState<AuctionV2Bid[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Carrega todos os leilões V2
      const allAuctions = await auctionV2Service.getAuctions();
      setAuctions(allAuctions);

      // 2. Localiza o clube oficial do Manager autenticado sem IDs fixos
      if (firebaseUser?.uid) {
        const club = await auctionV2Service.findManagerClub(firebaseUser.uid);
        setManagerClub(club);

        if (club) {
          const budget = await auctionV2Service.getClubAuctionBudget(club.id);
          setBudgetSummary(budget);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados do leilão V2:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Atualização em tempo real a cada 10 segundos
    const timer = setInterval(() => {
      loadData();
    }, 10000);
    return () => clearInterval(timer);
  }, [firebaseUser?.uid]);

  const showToast = (
    type: 'success' | 'error',
    message: string,
    currentBid?: number,
    reservedAmount?: number
  ) => {
    setFeedback({ type, message, currentBid, reservedAmount });
    if (type === 'error') {
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  // Abre modal de lance
  const handleOpenBidModal = (auction: AuctionV2) => {
    setBiddingAuction(auction);
    const isFirstBid = Number(auction.totalBids) === 0 || !auction.currentLeaderClubId;
    const minNextBid = isFirstBid
      ? auction.initialPrice
      : (Number(auction.currentBid) || auction.initialPrice) + Number(auction.minIncrement);
    setBidAmount(minNextBid);
  };

  // Submissão atômica de lance no Firestore REAL
  const handleConfirmBid = async () => {
    if (!biddingAuction) return;

    if (!firebaseUser) {
      showToast('error', 'É necessário estar autenticado para realizar lances.');
      return;
    }

    if (!managerClub) {
      showToast('error', 'Você não possui um clube registrado vinculado ao seu perfil no FM Universe.');
      return;
    }

    const isFirstBid = Number(biddingAuction.totalBids) === 0 || !biddingAuction.currentLeaderClubId;
    const currentBidVal = Number(biddingAuction.currentBid) || biddingAuction.initialPrice;
    const minRequired = isFirstBid
      ? biddingAuction.initialPrice
      : currentBidVal + Number(biddingAuction.minIncrement);

    if (bidAmount < minRequired) {
      showToast(
        'error',
        `O lance deve ser de no mínimo ${formatCurrencyBRL(minRequired)} (incremento de ${formatCurrencyBRL(
          biddingAuction.minIncrement
        )}).`
      );
      return;
    }

    if (budgetSummary && bidAmount > budgetSummary.availableBudget) {
      // Se for o mesmo clube superando o próprio lance, a reserva atual abate
      const isCurrentLeader = biddingAuction.currentLeaderClubId === managerClub.id;
      const neededExtra = isCurrentLeader ? bidAmount - currentBidVal : bidAmount;
      if (neededExtra > budgetSummary.availableBudget) {
        showToast(
          'error',
          `Saldo insuficiente. Seu orçamento disponível é ${formatCurrencyBRL(
            budgetSummary.availableBudget
          )}.`
        );
        return;
      }
    }

    setIsSubmittingBid(true);
    try {
      const managerName =
        managerProfile?.name ||
        managerClub.managerName ||
        firebaseUser.displayName ||
        'Manager Autorizado';

      const res = await auctionV2Service.placeBid({
        auctionId: biddingAuction.id,
        managerId: firebaseUser.uid,
        managerName,
        bidAmount,
      });

      if (!res.success) {
        showToast('error', res.error || 'Falha ao processar o lance.');
        return;
      }

      // Requisito 9: Após um lance bem sucedido, mostrar imediatamente:
      // "Lance realizado com sucesso", "Lance atual", "Valor reservado"
      showToast(
        'success',
        'Lance realizado com sucesso!',
        bidAmount,
        res.reservedAmount || bidAmount
      );
      setBiddingAuction(null);

      // Recarrega dados reais do leilão e orçamento
      await Promise.all([loadData(), refreshClubData()]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar lance.';
      showToast('error', msg);
    } finally {
      setIsSubmittingBid(false);
    }
  };

  const handleOpenHistoryModal = async (auction: AuctionV2) => {
    setViewHistoryAuction(auction);
    setIsLoadingHistory(true);
    try {
      const bids = await auctionV2Service.getBidsByAuction(auction.id);
      setHistoryBids(bids);
    } catch (err) {
      console.error('Erro ao carregar histórico de lances V2:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Filtros
  const filteredAuctions = useMemo(() => {
    return auctions.filter((a) => {
      if (activeTab === 'ABERTOS' && a.status !== 'ABERTO') return false;
      if (activeTab === 'MEUS_LANCES') {
        const isMyLeader = a.currentLeaderClubId === managerClub?.id;
        if (!isMyLeader) return false;
      }
      if (activeTab === 'ENCERRADOS' && a.status !== 'ENCERRADO') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          a.playerName.toLowerCase().includes(q) ||
          (a.playerClub || '').toLowerCase().includes(q) ||
          (a.playerPosition || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [auctions, activeTab, managerClub?.id, searchQuery]);

  const openCount = auctions.filter((a) => a.status === 'ABERTO').length;
  const myLeadingCount = managerClub
    ? auctions.filter((a) => a.status === 'ABERTO' && a.currentLeaderClubId === managerClub.id).length
    : 0;

  return (
    <div className="space-y-6">
      {/* Toast Feedback Completo (Requisito 9) */}
      {feedback && (
        <div
          className={`p-5 rounded-2xl text-sm font-medium border shadow-2xl transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500/60 text-emerald-100'
              : 'bg-red-950/95 border-red-500/60 text-red-100'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {feedback.type === 'success' ? (
                <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400 shrink-0 mt-0.5">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              ) : (
                <div className="p-2 bg-red-500/20 rounded-xl text-red-400 shrink-0 mt-0.5">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              )}
              <div>
                <div className="text-base font-bold text-white">{feedback.message}</div>
                {feedback.type === 'success' && feedback.currentBid && (
                  <div className="mt-2 flex flex-wrap gap-4 text-xs font-mono">
                    <div className="bg-emerald-900/50 px-3 py-1.5 rounded-lg border border-emerald-500/30">
                      <span className="text-emerald-300 font-sans font-semibold mr-1">Lance atual:</span>
                      <strong className="text-white text-sm">{formatCurrencyBRL(feedback.currentBid)}</strong>
                    </div>
                    {feedback.reservedAmount && (
                      <div className="bg-emerald-900/50 px-3 py-1.5 rounded-lg border border-emerald-500/30">
                        <span className="text-emerald-300 font-sans font-semibold mr-1">Valor reservado:</span>
                        <strong className="text-amber-300 text-sm">{formatCurrencyBRL(feedback.reservedAmount)}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Top Banner & Manager Financial Dashboard */}
      <div className="bg-[#121212] border border-[#262626] p-5 sm:p-6 rounded-2xl shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-5 pb-5 border-b border-[#222]">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                <Gavel className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-black tracking-tight text-white">Leilão V2 de Jogadores</h1>
              <span className="bg-purple-600/20 text-purple-300 text-[11px] font-bold px-2 py-0.5 rounded-full border border-purple-500/30">
                Firestore Real
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Dispute atletas em tempo real no Firestore com reserva atômica de orçamento e identificação real de Manager.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {managerClub && (
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl">
                <ClubBadge
                  club={{
                    id: managerClub.id,
                    name: managerClub.name,
                    shortName: managerClub.shortName,
                    primaryColor: managerClub.primaryColor,
                    secondaryColor: managerClub.secondaryColor,
                    badge: managerClub.badge,
                  }}
                  size="sm"
                />
                <div>
                  <div className="text-[10px] text-zinc-400 font-semibold uppercase">Clube Vinculado</div>
                  <div className="text-xs font-bold text-white leading-tight">
                    {managerClub.name}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl border border-zinc-800 transition-colors cursor-pointer"
              title="Atualizar leilões"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Manager Budget Cards (Requisitos 6 e 9) */}
        {budgetSummary ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[#0a0a0a] border border-[#222] p-4 rounded-xl">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span>Orçamento Total</span>
                <DollarSign className="w-4 h-4 text-zinc-500" />
              </div>
              <div className="text-xl font-black text-white font-mono mt-1">
                {formatCurrencyBRL(budgetSummary.totalBudget)}
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">Orçamento oficial do clube</div>
            </div>

            <div className="bg-[#0a0a0a] border border-amber-900/40 p-4 rounded-xl">
              <div className="flex items-center justify-between text-amber-400 text-xs font-medium">
                <span>Valor Reservado</span>
                <Lock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-xl font-black text-amber-400 font-mono mt-1">
                {formatCurrencyBRL(budgetSummary.reservedBudget)}
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">Retido em lances ativos como líder</div>
            </div>

            <div className="bg-[#0a0a0a] border border-emerald-900/40 p-4 rounded-xl">
              <div className="flex items-center justify-between text-emerald-400 text-xs font-medium">
                <span>Saldo Disponível</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                {formatCurrencyBRL(budgetSummary.availableBudget)}
              </div>
              <div className="text-[11px] text-emerald-500/80 mt-1">Livre para novos lances</div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-zinc-500 italic p-2">
            Faça login com um Manager com clube registrado para visualizar o saldo orçamentário.
          </div>
        )}
      </div>

      {/* Tabs and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-[#121212] p-1 rounded-xl border border-[#262626]">
          <button
            onClick={() => setActiveTab('ABERTOS')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'ABERTOS'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>Leilões Abertos</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-black/40 rounded-full">
              {openCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('MEUS_LANCES')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'MEUS_LANCES'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>Liderando</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-black/40 rounded-full">
              {myLeadingCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ENCERRADOS')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'ENCERRADOS'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Encerrados
          </button>
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar jogador, clube de origem..."
            className="w-full bg-[#121212] border border-[#262626] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Grid de Leilões V2 */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 text-zinc-400">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-500 mb-3" />
          <div className="text-sm font-semibold">Carregando leilões V2...</div>
        </div>
      ) : filteredAuctions.length === 0 ? (
        <div className="bg-[#121212] border border-[#262626] rounded-2xl p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-500">
            <Gavel className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">Nenhum leilão encontrado</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
            {activeTab === 'ABERTOS'
              ? 'Não há leilões abertos no momento. Aguarde novas publicações da administração.'
              : activeTab === 'MEUS_LANCES'
              ? 'Seu clube ainda não está liderando nenhum leilão ativo.'
              : 'Nenhum leilão encerrado registrado.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAuctions.map((auction) => {
            const isLeading = managerClub && auction.currentLeaderClubId === managerClub.id;
            const isFirstBid = Number(auction.totalBids) === 0 || !auction.currentLeaderClubId;
            const currentBidVal = Number(auction.currentBid) || auction.initialPrice;
            const minNextBid = isFirstBid
              ? auction.initialPrice
              : currentBidVal + Number(auction.minIncrement);
            const isOpen = auction.status === 'ABERTO';

            return (
              <div
                key={auction.id}
                className={`bg-[#121212] border rounded-2xl overflow-hidden flex flex-col justify-between shadow-xl transition-all hover:border-zinc-700 ${
                  isLeading
                    ? 'border-emerald-500/50 shadow-emerald-950/20'
                    : 'border-[#262626]'
                }`}
              >
                {/* Header Card */}
                <div>
                  <div className="p-4 border-b border-[#222] flex items-center justify-between bg-zinc-900/40">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          auction.status === 'ABERTO'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : auction.status === 'ENCERRADO'
                            ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {auction.status}
                      </span>
                      {isLeading && (
                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                          <CheckCircle2 className="w-3 h-3" />
                          Você Lidera
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{new Date(auction.endTime).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>

                  {/* Player Info */}
                  <div className="p-5 flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 overflow-hidden text-zinc-500 font-bold text-lg">
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
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white truncate">
                          {auction.playerName}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {auction.playerPosition && (
                          <PositionBadge position={auction.playerPosition} />
                        )}
                        {auction.playerRating && (
                          <RatingBadge rating={auction.playerRating} />
                        )}
                        {auction.playerAge && (
                          <span className="text-[11px] text-zinc-400 font-medium">
                            {auction.playerAge} anos
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-zinc-400 mt-2 truncate">
                        Origem FM2008:{' '}
                        <strong className="text-zinc-300">
                          {auction.playerClub || 'Sem clube'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Financial & Bid Details (Requisito 9) */}
                  <div className="px-5 pb-4 space-y-2.5">
                    <div className="bg-[#0a0a0a] border border-[#222] p-3.5 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400">Lance Atual</span>
                        <span className="text-base font-black text-white font-mono">
                          {formatCurrencyBRL(currentBidVal)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-900">
                        <span className="text-zinc-500">Incremento Mínimo</span>
                        <span className="font-semibold text-purple-400 font-mono">
                          +{formatCurrencyBRL(auction.minIncrement)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-900">
                        <span className="text-zinc-500">Total de Lances</span>
                        <span className="font-bold text-zinc-300">
                          {auction.totalBids || 0} lances
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-900">
                        <span className="text-zinc-500">Líder do Leilão</span>
                        <span className="font-bold text-zinc-200 truncate max-w-[150px]">
                          {auction.currentLeaderClubName ? (
                            <span className={isLeading ? 'text-emerald-400 font-black' : 'text-zinc-200'}>
                              {auction.currentLeaderClubName}
                            </span>
                          ) : (
                            <span className="text-zinc-500 italic">Sem lances ainda</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="p-4 border-t border-[#222] bg-zinc-900/30 flex items-center gap-2">
                  <button
                    onClick={() => handleOpenHistoryModal(auction)}
                    className="p-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl border border-zinc-800 transition-colors cursor-pointer"
                    title="Ver histórico de lances"
                  >
                    <History className="w-4 h-4" />
                  </button>

                  {isOpen ? (
                    <button
                      onClick={() => handleOpenBidModal(auction)}
                      disabled={isLeading}
                      className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        isLeading
                          ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-500/30 cursor-default'
                          : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20 active:scale-[0.98]'
                      }`}
                    >
                      <Gavel className="w-4 h-4" />
                      <span>{isLeading ? 'Você é o Maior Lance' : 'Dar Lance'}</span>
                    </button>
                  ) : (
                    <div className="flex-1 py-2.5 px-4 bg-zinc-900 text-zinc-500 rounded-xl text-xs font-semibold text-center border border-zinc-800">
                      {auction.status === 'ENCERRADO' ? 'Leilão Finalizado' : 'Indisponível'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Confirmação de Lance */}
      {biddingAuction && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#262626] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#222] pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400">
                  <Gavel className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Confirmar Lance no Leilão V2</h3>
              </div>
              <button
                onClick={() => setBiddingAuction(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center font-bold text-white shrink-0 overflow-hidden">
                {biddingAuction.playerPhoto ? (
                  <img
                    src={biddingAuction.playerPhoto}
                    alt={biddingAuction.playerName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  biddingAuction.playerName.slice(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <div className="text-sm font-bold text-white">{biddingAuction.playerName}</div>
                <div className="text-xs text-zinc-400">
                  {biddingAuction.playerPosition} • Origem: {biddingAuction.playerClub || 'Livre'}
                </div>
              </div>
            </div>

            {/* Input de Lance */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300">
                Valor do Lance (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-sm font-bold">
                  R$
                </span>
                <input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(Number(e.target.value))}
                  step={biddingAuction.minIncrement}
                  className="w-full bg-black border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-base font-bold text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="flex justify-between text-[11px] text-zinc-400 pt-1">
                <span>
                  Mínimo:{' '}
                  <strong className="text-zinc-300">
                    {formatCurrencyBRL(
                      Number(biddingAuction.totalBids) === 0 || !biddingAuction.currentLeaderClubId
                        ? biddingAuction.initialPrice
                        : (Number(biddingAuction.currentBid) || biddingAuction.initialPrice) + Number(biddingAuction.minIncrement)
                    )}
                  </strong>
                </span>
                <span>
                  Disponível:{' '}
                  <strong className="text-emerald-400 font-mono">
                    {formatCurrencyBRL(budgetSummary?.availableBudget || 0)}
                  </strong>
                </span>
              </div>
            </div>

            {/* Atalhos Rápidos de Incremento */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBidAmount((prev) => prev + biddingAuction.minIncrement)}
                className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-purple-300 text-xs font-semibold rounded-lg border border-zinc-800 transition-colors cursor-pointer"
              >
                +{formatCurrencyBRL(biddingAuction.minIncrement)}
              </button>
              <button
                type="button"
                onClick={() => setBidAmount((prev) => prev + biddingAuction.minIncrement * 2)}
                className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-purple-300 text-xs font-semibold rounded-lg border border-zinc-800 transition-colors cursor-pointer"
              >
                +{formatCurrencyBRL(biddingAuction.minIncrement * 2)}
              </button>
            </div>

            {/* Confirmação e Aviso */}
            <div className="bg-purple-950/30 border border-purple-800/40 p-3 rounded-xl text-[11px] text-purple-200 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>
                Ao confirmar, o valor de <strong>{formatCurrencyBRL(bidAmount)}</strong> será temporariamente reservado do orçamento do seu clube no Firestore. Se você for superado por outro manager, o valor será liberado imediatamente.
              </span>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBiddingAuction(null)}
                className="flex-1 py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmBid}
                disabled={isSubmittingBid}
                className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmittingBid ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <Gavel className="w-4 h-4" />
                    <span>Confirmar Lance</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Histórico de Lances */}
      {viewHistoryAuction && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-[#262626] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#222] pb-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">
                  Histórico de Lances: {viewHistoryAuction.playerName}
                </h3>
              </div>
              <button
                onClick={() => setViewHistoryAuction(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {isLoadingHistory ? (
                <div className="flex flex-col items-center justify-center p-8 text-zinc-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-purple-500 mb-2" />
                  <span className="text-xs">Carregando lances do Firestore...</span>
                </div>
              ) : historyBids.length === 0 ? (
                <div className="text-center p-8 text-zinc-500 text-xs">
                  Nenhum lance registrado neste leilão até o momento.
                </div>
              ) : (
                historyBids.map((bid, index) => (
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
                            Líder Atual
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        {bid.managerName} • {new Date(bid.bidTime || bid.createdAt).toLocaleTimeString('pt-BR')}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-black font-mono text-white">
                        {formatCurrencyBRL(bid.amount)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-[#222]">
              <button
                onClick={() => setViewHistoryAuction(null)}
                className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
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
