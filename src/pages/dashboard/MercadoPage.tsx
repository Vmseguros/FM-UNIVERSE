import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { jogadoresService } from '../../services/jogadoresService';
import { transferOffersService, resolveSellerClub, SellerClubResolution } from '../../services/transferOffersService';
import { Player, TransferOffer, Club } from '../../types';
import { PositionBadge, RatingBadge } from '../../components/common/Badge';
import { runTransferOfferTests } from '../../services/transferOffersService.test';
import { mockClubs } from '../../data/mockData';
import { formatCurrencyBRL } from '../../utils/currency';
import {
  Search,
  ArrowRightLeft,
  DollarSign,
  CheckCircle2,
  Send,
  X,
  Clock,
  Check,
  Ban,
  Inbox,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  AlertCircle,
  Play,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Gavel,
} from 'lucide-react';

type MercadoTab = 'EXPLORAR' | 'ENVIADAS' | 'RECEBIDAS';

export const MercadoPage: React.FC = () => {
  const { navigate } = useNavigation();
  const { user, managedClub, allClubs, setManagedClubId, refreshClubData, isRealAdmin } = useAuth();
  
  // Abas e listagens
  const [activeTab, setActiveTab] = useState<MercadoTab>('EXPLORAR');
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [sentOffers, setSentOffers] = useState<TransferOffer[]>([]);
  const [receivedOffers, setReceivedOffers] = useState<TransferOffer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Filtros e Paginação Escalável
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [marketPage, setMarketPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Modal de proposta inicial
  const [targetPlayer, setTargetPlayer] = useState<Player | null>(null);
  const [sellerResolution, setSellerResolution] = useState<SellerClubResolution | null>(null);
  const [offerFee, setOfferFee] = useState<number>(10000000);
  const [isSubmittingOffer, setIsSubmittingOffer] = useState<boolean>(false);
  const [offerError, setOfferError] = useState<string | null>(null);

  // Modal de negociação (contraproposta)
  const [negotiatingOffer, setNegotiatingOffer] = useState<TransferOffer | null>(null);
  const [negotiatingRole, setNegotiatingRole] = useState<'SELLER' | 'BUYER'>('SELLER');
  const [counterOfferFee, setCounterOfferFee] = useState<number>(10000000);
  const [isSubmittingCounter, setIsSubmittingCounter] = useState<boolean>(false);
  const [counterOfferError, setCounterOfferError] = useState<string | null>(null);

  // Ações de aceite/recusa
  const [processingOfferId, setProcessingOfferId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Suite de diagnóstico / teste
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<{ passed: boolean; details: string[] } | null>(null);

  // Carregar todos os dados
  const loadData = useCallback(async (overrideClub?: Club | null) => {
    const club = overrideClub !== undefined ? overrideClub : managedClub;
    setIsLoading(true);
    try {
      const [players, sent, received] = await Promise.all([
        jogadoresService.getAll(),
        club ? transferOffersService.getOffersSent(club.id) : Promise.resolve([]),
        club ? transferOffersService.getOffersReceived(club.id) : Promise.resolve([]),
      ]);

      // Atletas que não pertencem ao clube gerenciado (se houver clube gerenciado definido)
      const availablePlayers = club
        ? players.filter((p) => p.clubId !== club.id)
        : players;

      setAllPlayers(availablePlayers);
      setSentOffers(sent);
      setReceivedOffers(received);
    } catch (err) {
      console.error('Erro ao carregar dados do mercado:', err);
    } finally {
      setIsLoading(false);
    }
  }, [managedClub]);

  const handleClubChange = (clubId: string) => {
    setManagedClubId(clubId);
    const target =
      allClubs.find((c) => c.id === clubId) ||
      mockClubs.find((c) => c.id === clubId) ||
      null;
    if (target) {
      loadData(target);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sincronizar com query params ou navegação se houver (ex: ?tab=explorar | ?tab=recebidas | ?tab=enviadas)
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get('tab')?.toUpperCase();
      if (tabParam === 'EXPLORAR' || tabParam === 'RECEBIDAS' || tabParam === 'ENVIADAS') {
        setActiveTab(tabParam as MercadoTab);
      }
    } catch {
      // Ignora erro em ambientes sem window
    }
  }, []);

  // Transição controlada de abas garantindo carregamento de jogadores
  const handleSelectTab = useCallback(
    (tab: MercadoTab) => {
      setActiveTab(tab);
      if (tab === 'EXPLORAR' && allPlayers.length === 0) {
        loadData();
      }
    },
    [allPlayers.length, loadData]
  );

  // Contadores
  const pendingReceivedCount = receivedOffers.filter(
    (o) => o.status === 'PENDING' || (o.status as string) === 'NEGOCIAÇÃO' || (o.status as string) === 'NEGOTIATION'
  ).length;
  const pendingSentCount = sentOffers.filter(
    (o) => o.status === 'PENDING' || (o.status as string) === 'NEGOCIAÇÃO' || (o.status as string) === 'NEGOTIATION'
  ).length;

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const filteredPlayers = allPlayers.filter((p) => {
    const q = search.trim().toLowerCase();
    const pName = (p.name || '').toLowerCase();
    const cName = (p.clubName || '').toLowerCase();
    const pPos = (p.position || '').toLowerCase();
    const pNat = (p.nationality || '').toLowerCase();
    const matchSearch =
      !q ||
      pName.includes(q) ||
      cName.includes(q) ||
      pPos.includes(q) ||
      pNat.includes(q);
    const matchCat = selectedCategory === 'ALL' || p.positionCategory === selectedCategory;
    return matchSearch && matchCat;
  });

  useEffect(() => {
    setMarketPage(1);
  }, [search, selectedCategory, pageSize]);

  const totalMarketPages = Math.max(1, Math.ceil(filteredPlayers.length / pageSize));
  const currentMarketPage = Math.min(Math.max(1, marketPage), totalMarketPages);
  const marketOffset = (currentMarketPage - 1) * pageSize;
  const paginatedMarketPlayers = filteredPlayers.slice(
    marketOffset,
    marketOffset + pageSize
  );

  const handleOpenProposal = async (player: Player) => {
    setTargetPlayer(player);
    setOfferFee(player.marketValue && player.marketValue > 0 ? player.marketValue : 1000000);
    
    // Validação e resolução rigorosa do clube proprietário usando os clubes da coleção
    const resolution = await resolveSellerClub(player, allClubs);
    setSellerResolution(resolution);
    if (!resolution.sellerClub) {
      setOfferError(resolution.error || 'O jogador ainda não possui clube proprietário cadastrado no universo.');
    } else {
      setOfferError(null);
    }
  };

  const handleSendProposal = async () => {
    if (!targetPlayer || !managedClub) return;

    if (sellerResolution && !sellerResolution.sellerClub) {
      setOfferError(sellerResolution.error || 'O jogador ainda não possui clube proprietário cadastrado no universo.');
      return;
    }

    if (!offerFee || offerFee <= 0) {
      setOfferError('Digite um valor válido para a proposta.');
      return;
    }

    const availableBudget = managedClub.transferBudget || 0;
    if (offerFee > availableBudget) {
      setOfferError(
        `Orçamento insuficiente! Seu limite é de ${formatCurrencyBRL(availableBudget, { compact: true })}.`
      );
      return;
    }

    setIsSubmittingOffer(true);
    setOfferError(null);

    try {
      const res = await transferOffersService.createOffer({
        playerId: targetPlayer.id,
        buyerClubId: managedClub.id,
        amount: offerFee,
        userId: user.id,
      });

      if (!res.success || !res.offer) {
        setOfferError(res.error || 'Erro ao enviar proposta.');
        setIsSubmittingOffer(false);
        return;
      }

      // Sucesso
      setTargetPlayer(null);
      setSellerResolution(null);
      showFeedback(
        'success',
        `Proposta oficial de ${formatCurrencyBRL(offerFee, { compact: true })} enviada com sucesso ao ${targetPlayer.clubName} por ${targetPlayer.name}!`
      );
      await loadData();
      setActiveTab('ENVIADAS');
    } catch (err) {
      setOfferError('Ocorreu uma falha na conexão ao persistir a proposta.');
    } finally {
      setIsSubmittingOffer(false);
    }
  };

  const handleAcceptOffer = async (offer: TransferOffer) => {
    if (processingOfferId) return;

    setProcessingOfferId(offer.id);
    try {
      const res = await transferOffersService.acceptOffer(offer.id);
      if (!res.success) {
        showFeedback('error', res.error || 'Falha ao aceitar proposta de transferência.');
      } else {
        const effectiveAmount = offer.counterOfferAmount || offer.amount;
        showFeedback(
          'success',
          res.alreadyProcessed
            ? `Transferência de ${offer.playerName} já havia sido concluída. Dados sincronizados com sucesso!`
            : `Proposta aceita com sucesso! ${offer.playerName} agora é atleta do ${offer.buyerClubName}. ${formatCurrencyBRL(effectiveAmount, { compact: true })} movimentados com sucesso!`
        );
        await Promise.all([loadData(), refreshClubData()]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao comunicar com o servidor de transferências.';
      showFeedback('error', msg);
    } finally {
      setProcessingOfferId(null);
    }
  };

  const handleOpenNegotiation = (offer: TransferOffer, role: 'SELLER' | 'BUYER' = 'SELLER') => {
    setNegotiatingOffer(offer);
    setNegotiatingRole(role);
    setCounterOfferError(null);

    const baseValue = offer.counterOfferAmount || offer.amount;
    const playerMkt =
      offer.playerSnapshot?.marketValue ||
      allPlayers.find((p) => p.id === offer.playerId)?.marketValue;

    if (role === 'SELLER') {
      const suggested = playerMkt && playerMkt > baseValue ? playerMkt : Math.round(baseValue * 1.15);
      setCounterOfferFee(suggested);
    } else {
      setCounterOfferFee(baseValue);
    }
  };

  const handleSendCounterOffer = async () => {
    if (!negotiatingOffer) return;

    if (!counterOfferFee || counterOfferFee <= 0 || isNaN(counterOfferFee)) {
      setCounterOfferError('Por favor informe um valor válido maior que zero.');
      return;
    }

    if (negotiatingRole === 'BUYER' && counterOfferFee > (managedClub?.transferBudget || 0)) {
      setCounterOfferError(
        `Orçamento insuficiente! Seu limite é de ${formatCurrencyBRL(managedClub?.transferBudget || 0, { compact: true })}.`
      );
      return;
    }

    setIsSubmittingCounter(true);
    setCounterOfferError(null);

    try {
      const res = await transferOffersService.negotiateOffer({
        offerId: negotiatingOffer.id,
        counterOfferAmount: counterOfferFee,
        proposedBy: negotiatingRole,
      });

      if (!res.success) {
        setCounterOfferError(res.error || 'Falha ao enviar contraproposta.');
      } else {
        showFeedback(
          'success',
          `Contraproposta de ${formatCurrencyBRL(counterOfferFee, { compact: true })} enviada com sucesso! Status alterado para NEGOCIAÇÃO.`
        );
        setNegotiatingOffer(null);
        await Promise.all([loadData(), refreshClubData()]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar contraproposta.';
      setCounterOfferError(msg);
    } finally {
      setIsSubmittingCounter(false);
    }
  };

  const handleRejectOffer = async (offer: TransferOffer) => {
    if (processingOfferId) return;

    setProcessingOfferId(offer.id);
    try {
      const res = await transferOffersService.rejectOffer(offer.id);
      if (!res.success) {
        showFeedback('error', res.error || 'Falha ao recusar proposta.');
      } else {
        showFeedback('success', `Proposta por ${offer.playerName} recusada com sucesso.`);
        await loadData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao registrar recusa da proposta.';
      showFeedback('error', msg);
    } finally {
      setProcessingOfferId(null);
    }
  };

  const handleCancelOffer = async (offer: TransferOffer) => {
    if (processingOfferId) return;

    setProcessingOfferId(offer.id);
    try {
      const res = await transferOffersService.cancelOffer(offer.id);
      if (!res.success) {
        showFeedback('error', res.error || 'Falha ao cancelar proposta.');
      } else {
        showFeedback('success', 'Proposta cancelada com sucesso.');
        await loadData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cancelar proposta.';
      showFeedback('error', msg);
    } finally {
      setProcessingOfferId(null);
    }
  };

  const handleRunDiagnostic = async () => {
    setIsRunningTests(true);
    try {
      const results = await runTransferOfferTests();
      setTestResults(results);
      await Promise.all([loadData(), refreshClubData()]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRunningTests(false);
    }
  };

  const renderStatusBadge = (status: TransferOffer['status']) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            Pendente
          </span>
        );
      case 'NEGOCIAÇÃO':
      case 'NEGOTIATION':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <span>🟡</span>
            Negociação
          </span>
        );
      case 'ACCEPTED':
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Check className="w-3 h-3" />
            Concluída
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <Ban className="w-3 h-3" />
            Recusada
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            <X className="w-3 h-3" />
            Cancelada
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <ArrowRightLeft className="w-6 h-6 text-emerald-400" />
              <span>Mercado de Transferências & Propostas</span>
            </h1>
            <button
              onClick={loadData}
              disabled={isLoading}
              title="Atualizar dados do mercado"
              className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Negocie atletas com outros clubes da liga em tempo real com validação orçamentária e persistência oficial.
          </p>
        </div>

        {/* Informações do Clube & Alternador Rápido de Treinador para Testes */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl flex items-center gap-3.5 shadow-sm">
            <div className="text-left">
              <div className="flex items-center gap-1.5 mb-1">
                <label
                  htmlFor="select-clube-gerenciado"
                  className="text-[10px] text-slate-400 uppercase font-semibold"
                >
                  Clube que Você Gerencia
                </label>
                {isRealAdmin && (
                  <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[9px] font-bold px-1.5 py-0.2 rounded tracking-wide">
                    ADMIN TESTE
                  </span>
                )}
              </div>
              {isRealAdmin ? (
                <div className="relative inline-flex items-center">
                  <select
                    id="select-clube-gerenciado"
                    value={managedClub?.id || ''}
                    onChange={(e) => handleClubChange(e.target.value)}
                    className="bg-slate-950 hover:bg-slate-900 border border-emerald-500/50 hover:border-emerald-400 text-xs font-bold text-white rounded-lg pl-2.5 pr-8 py-1.5 outline-none cursor-pointer focus:ring-1 focus:ring-emerald-400 transition-colors appearance-none"
                    title="Seletor de clube para testes rápidos (Modo Admin)"
                  >
                    {allClubs.map((c) => (
                      <option key={c.id} value={c.id} className="bg-slate-900 text-white font-medium py-1">
                        {c.name}
                      </option>
                    ))}
                    {managedClub && !allClubs.some((c) => c.id === managedClub.id) && (
                      <option value={managedClub.id} className="bg-slate-900 text-white font-medium py-1">
                        {managedClub.name}
                      </option>
                    )}
                  </select>
                  <div className="pointer-events-none absolute right-2 text-emerald-400">
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              ) : (
                <span className="text-xs font-bold text-white">
                  {managedClub?.name || 'Clube não configurado'}
                </span>
              )}
            </div>
            <div className="h-8 w-px bg-slate-800 mx-0.5" />
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase block font-semibold">Orçamento</span>
              <span className="font-mono text-sm font-bold text-emerald-400">
                {formatCurrencyBRL(managedClub?.transferBudget || 0, { compact: true })}
              </span>
            </div>
          </div>

          <button
            onClick={handleRunDiagnostic}
            disabled={isRunningTests}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            title="Executar bateria de testes do fluxo completo de transferências"
          >
            <Play className={`w-3.5 h-3.5 text-indigo-400 ${isRunningTests ? 'animate-spin' : ''}`} />
            <span>{isRunningTests ? 'Testando...' : 'Diagnóstico'}</span>
          </button>
        </div>
      </div>

      {/* Resultados do Diagnóstico caso executado */}
      {testResults && (
        <div className="bg-slate-900/90 border border-indigo-500/40 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Relatório de Validação de Propostas
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  testResults.passed
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {testResults.passed ? 'TODOS OS TESTES APROVADOS' : 'FALHA NOS TESTES'}
              </span>
            </div>
            <button
              onClick={() => setTestResults(null)}
              className="text-slate-400 hover:text-white text-xs font-semibold"
            >
              Fechar
            </button>
          </div>
          <div className="space-y-1 text-xs font-mono">
            {testResults.details.map((d, i) => (
              <p key={i} className="text-slate-300">
                {d}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`px-4 py-3 rounded-xl text-xs flex items-center justify-between gap-2 animate-fadeIn border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Abas de Navegação */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          id="tab-btn-explorar"
          type="button"
          onClick={() => handleSelectTab('EXPLORAR')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'EXPLORAR'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Explorar Mercado</span>
        </button>

        <button
          id="tab-btn-recebidas"
          type="button"
          onClick={() => handleSelectTab('RECEBIDAS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer relative ${
            activeTab === 'RECEBIDAS'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Inbox className="w-3.5 h-3.5" />
          <span>Propostas Recebidas</span>
          {pendingReceivedCount > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'RECEBIDAS'
                  ? 'bg-slate-950 text-emerald-400'
                  : 'bg-amber-500 text-slate-950 animate-pulse'
              }`}
            >
              {pendingReceivedCount}
            </span>
          )}
        </button>

        <button
          id="tab-btn-enviadas"
          type="button"
          onClick={() => handleSelectTab('ENVIADAS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer relative ${
            activeTab === 'ENVIADAS'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>Propostas Enviadas</span>
          {pendingSentCount > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'ENVIADAS'
                  ? 'bg-slate-950 text-emerald-400'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {pendingSentCount}
            </span>
          )}
        </button>

        <button
          id="tab-btn-leiloes"
          type="button"
          onClick={() => navigate('/dashboard/leiloes')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 ml-auto shadow-sm"
          title="Ir para o Sistema de Leilões ao Vivo"
        >
          <Gavel className="w-3.5 h-3.5 text-purple-400" />
          <span>Leilões Ao Vivo</span>
          <span className="bg-purple-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider">
            Novo
          </span>
        </button>
      </div>

      {/* ABA 1: EXPLORAR MERCADO (Tabela de Jogadores) */}
      {activeTab === 'EXPLORAR' && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-wrap gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por jogador ou clube rival..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Posição Alvo:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
              >
                <option value="ALL">Todas as Posições</option>
                <option value="GOLEIRO">Goleiros</option>
                <option value="DEFENSOR">Defensores</option>
                <option value="MEIO-CAMPISTA">Meio-Campistas</option>
                <option value="ATACANTE">Atacantes</option>
              </select>
            </div>
          </div>

          {/* Tabela de Jogadores Disponíveis */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                    <th className="py-3 px-4">Alvo</th>
                    <th className="py-3 px-3">Clube Proprietário</th>
                    <th className="py-3 px-3">Pos</th>
                    <th className="py-3 px-2 text-center">Idade</th>
                    <th className="py-3 px-2 text-center">OVR</th>
                    <th className="py-3 px-2 text-center">POT</th>
                    <th className="py-3 px-3 text-right">Valor Estimado</th>
                    <th className="py-3 px-3 text-right">Salário Atual</th>
                    <th className="py-3 px-3 text-center">Ação do Treinador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium">
                  {isLoading && allPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                        <p className="font-semibold text-white">Carregando mercado de transferências...</p>
                        <p className="text-slate-500 text-[11px] mt-1">Buscando atletas disponíveis para negociação</p>
                      </td>
                    </tr>
                  ) : filteredPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        <p>Nenhum jogador rival encontrado para os filtros selecionados.</p>
                        {(search || selectedCategory !== 'ALL') && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearch('');
                              setSelectedCategory('ALL');
                            }}
                            className="mt-2 text-emerald-400 hover:underline text-xs font-semibold cursor-pointer"
                          >
                            Limpar filtros de busca
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginatedMarketPlayers.map((player) => (
                      <tr key={player.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap font-bold text-white">
                          {player.name}
                        </td>
                        <td className="py-3 px-3 text-slate-300 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{player.clubName || 'Sem Clube'}</span>
                            {!allClubs.some(
                              (c) =>
                                c.id === player.clubId ||
                                c.name.toLowerCase() === (player.clubName || '').toLowerCase()
                            ) && (
                              <span
                                className="text-[10px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded font-medium"
                                title="Clube ainda não cadastrado no FM Universe"
                              >
                                Não registrado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <PositionBadge position={player.position} size="xs" />
                        </td>
                        <td className="py-3 px-2 text-center font-mono text-slate-300">
                          {player.age}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <RatingBadge rating={player.overall} size="sm" />
                        </td>
                        <td className="py-3 px-2 text-center font-mono font-bold text-emerald-400">
                          {player.potential}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                          {formatCurrencyBRL(player.marketValue, { compact: true })}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-400">
                          {formatCurrencyBRL(player.wage, { compact: true, decimals: 0 })}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleOpenProposal(player)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer shadow-sm"
                          >
                            Fazer Oferta
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredPlayers.length > 0 && (
              <div className="bg-slate-950 px-4 py-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <span>
                    Mostrando <strong className="text-white">{marketOffset + 1}</strong> a{' '}
                    <strong className="text-white">
                      {Math.min(marketOffset + pageSize, filteredPlayers.length)}
                    </strong>{' '}
                    de <strong className="text-emerald-400">{filteredPlayers.length.toLocaleString('pt-BR')}</strong> atletas
                  </span>

                  <div className="flex items-center gap-1.5 ml-2">
                    <span className="text-[11px] text-slate-500">Por página:</span>
                    {[25, 50, 100].map((size) => (
                      <button
                        key={size}
                        onClick={() => {
                          setPageSize(size);
                          setMarketPage(1);
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                          pageSize === size
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setMarketPage(1)}
                    disabled={currentMarketPage <= 1}
                    className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-200"
                    title="Primeira página"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setMarketPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentMarketPage <= 1}
                    className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-200"
                    title="Página anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="font-mono text-xs px-2">
                    Página <strong className="text-white">{currentMarketPage}</strong> de{' '}
                    <strong className="text-slate-300">{totalMarketPages}</strong>
                  </span>

                  <button
                    onClick={() => setMarketPage((prev) => Math.min(totalMarketPages, prev + 1))}
                    disabled={currentMarketPage >= totalMarketPages}
                    className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-200"
                    title="Próxima página"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setMarketPage(totalMarketPages)}
                    disabled={currentMarketPage >= totalMarketPages}
                    className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-200"
                    title="Última página"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 2: PROPOSTAS RECEBIDAS */}
      {activeTab === 'RECEBIDAS' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Inbox className="w-4 h-4 text-emerald-400" />
                <span>Propostas Oficiais Recebidas pelo {managedClub?.name}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Clubes rivais interessados em atletas do seu elenco. Avalie e tome a decisão.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Total: <strong className="text-white">{receivedOffers.length}</strong>
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                    <th className="py-3 px-4">Atleta do Seu Clube</th>
                    <th className="py-3 px-3">Clube Interessado</th>
                    <th className="py-3 px-3 text-right">Valor Oferecido</th>
                    <th className="py-3 px-3 text-center">Data</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Decisão da Diretoria</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium">
                  {receivedOffers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        <Inbox className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-50" />
                        <p>Nenhuma proposta de transferência recebida no momento.</p>
                        <p className="text-[11px] text-slate-600 mt-1">
                          Quando outro clube enviar uma oferta oficial por um jogador seu, ela aparecerá aqui.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    receivedOffers.map((offer) => {
                      const isPendingOrNegotiating =
                        offer.status === 'PENDING' ||
                        (offer.status as string) === 'NEGOCIAÇÃO' ||
                        (offer.status as string) === 'NEGOTIATION';
                      const isProcessing = processingOfferId === offer.id;

                      return (
                        <tr key={offer.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-bold text-white">{offer.playerName}</div>
                            {offer.playerSnapshot && (
                              <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                <span>{offer.playerSnapshot.position}</span>
                                <span>•</span>
                                <span>OVR {offer.playerSnapshot.overall}</span>
                                <span>•</span>
                                <span>{offer.playerSnapshot.age} anos</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-slate-200 font-semibold whitespace-nowrap">
                            {offer.buyerClubName || offer.fromClubName || (offer as any).fromClub || offer.buyerClubId}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap text-sm">
                            <div>{formatCurrencyBRL(offer.amount, { compact: true })}</div>
                            {offer.counterOfferAmount && (
                              <div className="text-[10px] text-amber-400 font-semibold mt-0.5">
                                Contraproposta: {formatCurrencyBRL(offer.counterOfferAmount, { compact: true })}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-center font-mono text-slate-400 whitespace-nowrap">
                            {offer.createdAt.split('T')[0]}
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            {renderStatusBadge(offer.status)}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {isPendingOrNegotiating ? (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  id={`btn-accept-offer-${offer.id}`}
                                  onClick={() => handleAcceptOffer(offer)}
                                  disabled={isProcessing || Boolean(processingOfferId)}
                                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                                  title="Aceitar proposta e transferir atleta imediatamente"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{isProcessing ? 'Processando...' : 'Aceitar'}</span>
                                </button>
                                <button
                                  id={`btn-negotiate-offer-${offer.id}`}
                                  onClick={() => handleOpenNegotiation(offer, 'SELLER')}
                                  disabled={isProcessing || Boolean(processingOfferId)}
                                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                                  title="Fazer contraproposta oficial"
                                >
                                  <span>🟡 Negociar</span>
                                </button>
                                <button
                                  id={`btn-reject-offer-${offer.id}`}
                                  onClick={() => handleRejectOffer(offer)}
                                  disabled={isProcessing || Boolean(processingOfferId)}
                                  className="bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-300 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Recusar proposta oficial"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>Recusar</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500 italic">
                                Finalizada ({offer.status === 'ACCEPTED' || offer.status === 'COMPLETED' ? 'Concluída' : 'Arquivada'})
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: PROPOSTAS ENVIADAS */}
      {activeTab === 'ENVIADAS' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                <span>Propostas Enviadas pelo {managedClub?.name}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Acompanhe o status das ofertas de transferência emitidas pela sua diretoria.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Total: <strong className="text-white">{sentOffers.length}</strong>
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                    <th className="py-3 px-4">Atleta Alvo</th>
                    <th className="py-3 px-3">Clube Vendedor</th>
                    <th className="py-3 px-3 text-right">Valor Ofertado</th>
                    <th className="py-3 px-3 text-center">Data de Envio</th>
                    <th className="py-3 px-3 text-center">Status Oficial</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium">
                  {sentOffers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        <Send className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-50" />
                        <p>Nenhuma proposta oficial enviada pelo seu clube ainda.</p>
                        <p className="text-[11px] text-slate-600 mt-1">
                          Vá na aba{' '}
                          <button
                            type="button"
                            onClick={() => handleSelectTab('EXPLORAR')}
                            className="text-emerald-400 hover:underline font-bold cursor-pointer inline-flex items-center"
                          >
                            Explorar Mercado
                          </button>{' '}
                          e clique em "Fazer Oferta" em qualquer jogador rival.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    sentOffers.map((offer) => {
                      const isPending = offer.status === 'PENDING';
                      const isProcessing = processingOfferId === offer.id;

                      return (
                        <tr key={offer.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-bold text-white">{offer.playerName}</div>
                            {offer.playerSnapshot && (
                              <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                <span>{offer.playerSnapshot.position}</span>
                                <span>•</span>
                                <span>OVR {offer.playerSnapshot.overall}</span>
                                <span>•</span>
                                <span>{offer.playerSnapshot.age} anos</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-slate-200 font-semibold whitespace-nowrap">
                            {offer.sellerClubName || offer.toClubName || (offer as any).toClub || offer.sellerClubId}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap text-sm">
                            <div>{formatCurrencyBRL(offer.amount, { compact: true })}</div>
                            {offer.counterOfferAmount && (
                              <div className="text-[10px] text-amber-400 font-semibold mt-0.5">
                                Contraproposta: {formatCurrencyBRL(offer.counterOfferAmount, { compact: true })}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-center font-mono text-slate-400 whitespace-nowrap">
                            {offer.createdAt.split('T')[0]}
                          </td>
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            {renderStatusBadge(offer.status)}
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {(offer.status as string) === 'NEGOCIAÇÃO' || (offer.status as string) === 'NEGOTIATION' ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  id={`btn-accept-counter-${offer.id}`}
                                  onClick={() => handleAcceptOffer(offer)}
                                  disabled={isProcessing || Boolean(processingOfferId)}
                                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                                  title="Aceitar contraproposta e fechar negócio"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{isProcessing ? 'Processando...' : 'Aceitar'}</span>
                                </button>
                                <button
                                  id={`btn-renegotiate-${offer.id}`}
                                  onClick={() => handleOpenNegotiation(offer, 'BUYER')}
                                  disabled={isProcessing || Boolean(processingOfferId)}
                                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                                  title="Fazer nova contraproposta"
                                >
                                  <span>Negociar novamente</span>
                                </button>
                                <button
                                  id={`btn-reject-counter-${offer.id}`}
                                  onClick={() => handleRejectOffer(offer)}
                                  disabled={isProcessing || Boolean(processingOfferId)}
                                  className="bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-300 font-bold px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Recusar contraproposta"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>Recusar</span>
                                </button>
                              </div>
                            ) : isPending ? (
                              <button
                                onClick={() => handleCancelOffer(offer)}
                                disabled={isProcessing || Boolean(processingOfferId)}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-slate-700"
                              >
                                {isProcessing ? 'Cancelando...' : 'Retirar Oferta'}
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-500">
                                {offer.status === 'ACCEPTED' || offer.status === 'COMPLETED' ? 'Concluída com Sucesso' : 'Encerrada'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Fazer Oferta Oficial */}
      {targetPlayer && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-400" />
                <span>Enviar Proposta Oficial de Transferência</span>
              </h3>
              <button
                onClick={() => setTargetPlayer(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {sellerResolution && !sellerResolution.sellerClub ? (
              <div className="bg-amber-500/15 border border-amber-500/30 text-amber-300 px-3.5 py-3 rounded-xl text-xs flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-white">Proposta Indisponível</p>
                  <p className="text-amber-200/90 text-xs leading-relaxed">
                    {sellerResolution.error || 'O jogador ainda não possui clube proprietário cadastrado no universo.'}
                  </p>
                </div>
              </div>
            ) : offerError ? (
              <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 px-3.5 py-2 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{offerError}</span>
              </div>
            ) : null}

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Atleta Alvo:</span>
                <span className="font-bold text-white">
                  {targetPlayer.name} ({targetPlayer.position})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Clube Proprietário:</span>
                <div className="text-right">
                  <span className="font-semibold text-slate-200">{targetPlayer.clubName}</span>
                  {sellerResolution && !sellerResolution.sellerClub && (
                    <span className="block text-[10px] text-amber-400">Não cadastrado no universo</span>
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Overall / Potencial:</span>
                <span className="font-mono text-slate-200">
                  {targetPlayer.overall} / {targetPlayer.potential}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Valor Estimado de Mercado:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {formatCurrencyBRL(targetPlayer.marketValue, { compact: true })}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-800/80 pt-2">
                <span className="text-slate-400">Orçamento do {managedClub?.name}:</span>
                <span className="font-mono text-slate-300 font-bold">
                  {formatCurrencyBRL(managedClub?.transferBudget || 0, { compact: true })}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-semibold block">
                Valor da Oferta Oficial (R$):
              </label>
              <input
                type="number"
                step="500000"
                min="500000"
                value={offerFee}
                onChange={(e) => setOfferFee(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Formatado: {formatCurrencyBRL(offerFee, { compact: true, decimals: 2 })}</span>
                {offerFee > (managedClub?.transferBudget || 0) && (
                  <span className="text-rose-400 font-semibold">Excede o orçamento!</span>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSendProposal}
                disabled={isSubmittingOffer || !sellerResolution?.sellerClub || offerFee > (managedClub?.transferBudget || 0)}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md"
              >
                <Send className="w-4 h-4" />
                <span>
                  {!sellerResolution?.sellerClub
                    ? 'Clube Não Registrado'
                    : isSubmittingOffer
                    ? 'Enviando Proposta...'
                    : 'Confirmar e Enviar Proposta'}
                </span>
              </button>
              <button
                onClick={() => setTargetPlayer(null)}
                disabled={isSubmittingOffer}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Negociar / Contraproposta */}
      {negotiatingOffer && (
        <div
          id="modal-negotiation-offer"
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
        >
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <span className="text-amber-400">🟡</span>
                <span>
                  {negotiatingRole === 'SELLER'
                    ? 'Negociar Transferência - Enviar Contraproposta'
                    : 'Renegociar Transferência - Nova Contraproposta'}
                </span>
              </h3>
              <button
                id="btn-close-negotiation"
                onClick={() => setNegotiatingOffer(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {counterOfferError && (
              <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 px-3.5 py-2 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{counterOfferError}</span>
              </div>
            )}

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Nome do jogador:</span>
                <span className="font-bold text-white text-sm">{negotiatingOffer.playerName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Clube interessado:</span>
                <span className="font-semibold text-slate-200">
                  {negotiatingOffer.buyerClubName ||
                    negotiatingOffer.fromClubName ||
                    (negotiatingOffer as any).fromClub ||
                    negotiatingOffer.buyerClubId}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Valor da proposta atual:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {formatCurrencyBRL(
                    negotiatingOffer.counterOfferAmount || negotiatingOffer.amount,
                    { compact: true }
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Valor estimado do jogador:</span>
                <span className="font-mono text-slate-300 font-bold">
                  {formatCurrencyBRL(
                    negotiatingOffer.playerSnapshot?.marketValue ||
                      allPlayers.find((p) => p.id === negotiatingOffer.playerId)?.marketValue ||
                      negotiatingOffer.amount,
                    { compact: true }
                  )}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="input-counter-proposal-amount"
                className="text-xs text-slate-300 font-semibold block"
              >
                Nova contraproposta (R$):
              </label>
              <input
                id="input-counter-proposal-amount"
                type="number"
                step="500000"
                min="500000"
                value={counterOfferFee}
                onChange={(e) => setCounterOfferFee(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500"
                placeholder="Informe o valor da contraproposta"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Formatado: {formatCurrencyBRL(counterOfferFee, { compact: true, decimals: 2 })}</span>
                {negotiatingRole === 'BUYER' &&
                  counterOfferFee > (managedClub?.transferBudget || 0) && (
                    <span className="text-rose-400 font-semibold">Excede o orçamento!</span>
                  )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                id="btn-submit-counter-proposal"
                onClick={handleSendCounterOffer}
                disabled={
                  isSubmittingCounter ||
                  (negotiatingRole === 'BUYER' &&
                    counterOfferFee > (managedClub?.transferBudget || 0))
                }
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md"
              >
                <span>{isSubmittingCounter ? 'Enviando...' : 'Enviar Contraproposta'}</span>
              </button>
              <button
                id="btn-cancel-negotiation"
                onClick={() => setNegotiatingOffer(null)}
                disabled={isSubmittingCounter}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

