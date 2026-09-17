import React, { useEffect, useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useAuth } from '../../contexts/AuthContext';
import { clubesService } from '../../services/clubesService';
import { adminFinancasService } from '../../services/adminFinancasService';
import {
  Club,
  ClubFinancialConfig,
  SponsorContract,
  SponsorCategory,
  SponsorPaymentMethod,
  SponsorStatus,
  CompetitionPrize,
} from '../../types';
import { formatCurrencyBRL } from '../../utils/currency';
import { ClubBadge } from '../../components/common/ClubBadge';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building,
  Tv,
  Trophy,
  Award,
  Wallet,
  Shield,
  Save,
  CheckCircle2,
  Plus,
  Trash2,
  Edit3,
  Calendar,
  Sparkles,
  Info,
  AlertCircle,
  Users,
  Clock,
  History,
  FileCheck,
  RotateCcw,
  ShoppingBag,
  Ticket,
  Calculator,
  HelpCircle,
  Lock,
} from 'lucide-react';

export const AdminFinancasPage: React.FC = () => {
  const { navigate } = useNavigation();
  const { user, isRealAdmin, firebaseEmail, firebaseUid } = useAuth();

  // Permissão de Edição
  const canEdit = isRealAdmin || user?.role === 'ADMIN' || !user?.id;

  // Clubes e Temporadas
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string>('');
  const seasonsList = ['2026/2027', '2027/2028', '2028/2029', '2029/2030'];
  const [selectedSeason, setSelectedSeason] = useState<string>('2026/2027');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Configuração Financeira Ativa
  const [config, setConfig] = useState<ClubFinancialConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // 8 Seções Oficiais Conforme Especificação
  const [activeTab, setActiveTab] = useState<
    'orcamento' | 'patrocinios' | 'bilheteria' | 'tv' | 'premiacoes' | 'merchandising' | 'despesas' | 'homologacao'
  >('orcamento');

  // Motivo da alteração informado pelo Administrador
  const [reasonInput, setReasonInput] = useState('');

  // Modais de Ação
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [isHomologateModalOpen, setIsHomologateModalOpen] = useState(false);

  // Modal de Patrocinador (Criação e Edição)
  const [isSponsorModalOpen, setIsSponsorModalOpen] = useState(false);
  const [editingSponsorId, setEditingSponsorId] = useState<string | null>(null);
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorCategory, setSponsorCategory] = useState<SponsorCategory>('MASTER');
  const [sponsorValue, setSponsorValue] = useState<number>(10000000);
  const [sponsorMethod, setSponsorMethod] = useState<SponsorPaymentMethod>('MENSAL');
  const [sponsorPerRound, setSponsorPerRound] = useState<number>(260000);
  const [sponsorMonthly, setSponsorMonthly] = useState<number>(833333);
  const [sponsorBonusWin, setSponsorBonusWin] = useState<number>(50000);
  const [sponsorBonusDraw, setSponsorBonusDraw] = useState<number>(20000);
  const [sponsorBonusQual, setSponsorBonusQual] = useState<number>(250000);
  const [sponsorBonusTitle, setSponsorBonusTitle] = useState<number>(1000000);
  const [sponsorStartDate, setSponsorStartDate] = useState('2026-01-01');
  const [sponsorEndDate, setSponsorEndDate] = useState('2026-12-31');
  const [sponsorStatus, setSponsorStatus] = useState<SponsorStatus>('ATIVO');

  // Modal de Premiação por Torneio
  const [isCompPrizeModalOpen, setIsCompPrizeModalOpen] = useState(false);
  const [compName, setCompName] = useState('');
  const [compChamp, setCompChamp] = useState(25000000);
  const [compRunner, setCompRunner] = useState(12000000);
  const [compPart, setCompPart] = useState(3000000);

  // 1. Carrega lista de clubes
  useEffect(() => {
    clubesService.getAll().then((loadedClubs) => {
      setClubs(loadedClubs);
      if (loadedClubs.length > 0) {
        const thales = loadedClubs.find((c) => c.id === 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3');
        const defaultId = thales ? thales.id : loadedClubs[0].id;
        setSelectedClubId(defaultId);
      }
      setLoading(false);
    });
  }, []);

  // 2. Carrega configuração do clube selecionado e temporada
  useEffect(() => {
    if (!selectedClubId) return;

    setLoading(true);
    adminFinancasService.getConfigByClubId(selectedClubId, selectedSeason).then((loadedConfig) => {
      setConfig(loadedConfig);
      setIsEditing(false);
      setLoading(false);
    });
  }, [selectedClubId, selectedSeason]);

  const selectedClub = clubs.find((c) => c.id === selectedClubId);

  // Salvar Rascunho
  const handleSaveDraft = async () => {
    if (!config || !selectedClub) return;
    setSaving(true);
    setFeedback(null);

    try {
      const adminInfo = {
        email: firebaseEmail || user?.email || 'admin@fmuniverse.com',
        uid: firebaseUid || user?.id || 'admin',
      };

      const saved = await adminFinancasService.saveDraft(config, adminInfo, reasonInput);
      setConfig(saved);
      setIsEditing(false);
      setIsDraftModalOpen(false);
      setReasonInput('');
      setFeedback({
        type: 'success',
        message: `Rascunho salvo com sucesso para o ${selectedClub.name} (${selectedSeason})! As regras permanecem em edição.`,
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Erro ao salvar rascunho de configuração financeira.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Homologar Temporada (Oficial)
  const handleHomologateSeason = async () => {
    if (!config || !selectedClub) return;
    setSaving(true);
    setFeedback(null);

    try {
      const adminInfo = {
        email: firebaseEmail || user?.email || 'admin@fmuniverse.com',
        uid: firebaseUid || user?.id || 'admin',
      };

      const homologated = await adminFinancasService.homologateSeason(config, adminInfo, reasonInput);
      setConfig(homologated);
      setIsHomologateModalOpen(false);
      setIsEditing(false);
      setReasonInput('');
      setFeedback({
        type: 'success',
        message: `Temporada ${selectedSeason} HOMOLOGADA como REGRA OFICIAL para o ${selectedClub.name}! Os valores estão vigentes na liga.`,
      });
      setTimeout(() => setFeedback(null), 6000);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Erro ao homologar temporada no sistema.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Restaurar Padrão da Liga
  const handleResetToLeagueDefaults = () => {
    if (!selectedClub) return;
    if (
      confirm(
        `Deseja restaurar as configurações orçamentárias padrão da Liga para o ${selectedClub.name} (${selectedSeason})?`
      )
    ) {
      const standard = adminFinancasService.getDefaultConfigForClub(selectedClub, selectedSeason);
      setConfig(standard);
      setIsEditing(true);
      setFeedback({
        type: 'success',
        message: 'Valores padrão da temporada carregados. Clique em "Salvar Rascunho" ou "Homologar" para confirmar.',
      });
    }
  };

  // Abrir Modal de Patrocinador (Novo ou Edição)
  const handleOpenSponsorModal = (sponsor?: SponsorContract) => {
    if (sponsor) {
      setEditingSponsorId(sponsor.id);
      setSponsorName(sponsor.name);
      setSponsorCategory(sponsor.category);
      setSponsorValue(sponsor.contractValue);
      setSponsorMethod(sponsor.paymentMethod);
      setSponsorPerRound(sponsor.amountPerRound);
      setSponsorMonthly(sponsor.monthlyAmount || 0);
      setSponsorBonusWin(sponsor.bonusWin || 0);
      setSponsorBonusDraw(sponsor.bonusDraw || 0);
      setSponsorBonusQual(sponsor.bonusQualification || 0);
      setSponsorBonusTitle(sponsor.bonusTitle || 0);
      setSponsorStartDate(sponsor.startDate || '2026-01-01');
      setSponsorEndDate(sponsor.endDate || '2026-12-31');
      setSponsorStatus(sponsor.status);
    } else {
      setEditingSponsorId(null);
      setSponsorName('');
      setSponsorCategory('MASTER');
      setSponsorValue(12000000);
      setSponsorMethod('MENSAL');
      setSponsorPerRound(310000);
      setSponsorMonthly(1000000);
      setSponsorBonusWin(60000);
      setSponsorBonusDraw(20000);
      setSponsorBonusQual(300000);
      setSponsorBonusTitle(1500000);
      setSponsorStartDate('2026-01-01');
      setSponsorEndDate('2026-12-31');
      setSponsorStatus('ATIVO');
    }
    setIsSponsorModalOpen(true);
  };

  // Salvar Patrocinador no Config
  const handleSaveSponsorModal = () => {
    if (!sponsorName.trim() || !config) return;

    if (editingSponsorId) {
      const updatedSponsors = config.sponsors.map((s) => {
        if (s.id === editingSponsorId) {
          return {
            ...s,
            name: sponsorName.trim(),
            category: sponsorCategory,
            contractValue: Number(sponsorValue) || 0,
            paymentMethod: sponsorMethod,
            amountPerRound: Number(sponsorPerRound) || 0,
            monthlyAmount: Number(sponsorMonthly) || 0,
            bonusWin: Number(sponsorBonusWin) || 0,
            bonusDraw: Number(sponsorBonusDraw) || 0,
            bonusQualification: Number(sponsorBonusQual) || 0,
            bonusTitle: Number(sponsorBonusTitle) || 0,
            startDate: sponsorStartDate,
            endDate: sponsorEndDate,
            status: sponsorStatus,
          };
        }
        return s;
      });

      setConfig({ ...config, sponsors: updatedSponsors });
    } else {
      const newSponsor: SponsorContract = {
        id: `sp-${Date.now()}`,
        name: sponsorName.trim(),
        category: sponsorCategory,
        contractValue: Number(sponsorValue) || 0,
        paymentMethod: sponsorMethod,
        amountPerRound: Number(sponsorPerRound) || 0,
        monthlyAmount: Number(sponsorMonthly) || 0,
        bonusWin: Number(sponsorBonusWin) || 0,
        bonusDraw: Number(sponsorBonusDraw) || 0,
        bonusQualification: Number(sponsorBonusQual) || 0,
        bonusTitle: Number(sponsorBonusTitle) || 0,
        startDate: sponsorStartDate,
        endDate: sponsorEndDate,
        status: sponsorStatus,
      };

      setConfig({ ...config, sponsors: [...config.sponsors, newSponsor] });
    }

    setIsSponsorModalOpen(false);
    setIsEditing(true);
  };

  // Remover Patrocinador
  const handleRemoveSponsor = (sponsorId: string) => {
    if (!config) return;
    if (confirm('Deseja realmente remover este contrato de patrocínio?')) {
      setConfig({
        ...config,
        sponsors: config.sponsors.filter((s) => s.id !== sponsorId),
      });
      setIsEditing(true);
    }
  };

  // Adicionar Premiação de Torneio Específico
  const handleAddCompPrize = () => {
    if (!compName.trim() || !config) return;
    const newPrize: CompetitionPrize = {
      competitionId: `comp-${Date.now()}`,
      competitionName: compName.trim(),
      championPrize: Number(compChamp) || 0,
      runnerUpPrize: Number(compRunner) || 0,
      participationPrize: Number(compPart) || 0,
    };

    setConfig({
      ...config,
      prizes: {
        ...config.prizes,
        specificCompetitionPrizes: [...config.prizes.specificCompetitionPrizes, newPrize],
      },
    });

    setIsCompPrizeModalOpen(false);
    setCompName('');
    setIsEditing(true);
  };

  // Remover Premiação de Torneio Específico
  const handleRemoveCompPrize = (compId: string) => {
    if (!config) return;
    setConfig({
      ...config,
      prizes: {
        ...config.prizes,
        specificCompetitionPrizes: config.prizes.specificCompetitionPrizes.filter((c) => c.competitionId !== compId),
      },
    });
    setIsEditing(true);
  };

  // Recalcular Bilheteria com Base em Ocupação e Capacidade Real
  const handleRecalculateMatchdayRevenue = () => {
    if (!config || !selectedClub) return;
    const capacity = selectedClub.capacity || 50000;
    const occupancyRate = config.matchday.expectedOccupancyRate || 75;
    const avgPrice = config.matchday.ticketAveragePrice || 60;

    const calculatedAttendance = Math.round(capacity * (occupancyRate / 100));
    const calculatedRevenue = Math.round(calculatedAttendance * avgPrice);

    setConfig({
      ...config,
      matchday: {
        ...config.matchday,
        expectedAttendance: calculatedAttendance,
        estimatedMatchRevenue: calculatedRevenue,
      },
    });
    setIsEditing(true);
  };

  if (loading || !config || !selectedClub) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-slate-400 font-medium">Carregando painel de configuração financeira...</p>
      </div>
    );
  }

  // Cálculos de Projeção Anual de Receitas Futuras (Conceito 4)
  const totalSponsorsYearly = config.sponsors
    .filter((s) => s.status === 'ATIVO')
    .reduce((sum, s) => sum + (s.contractValue || 0), 0);

  const estimatedMatchdayYearly =
    (config.matchday.estimatedMatchRevenue +
      config.matchday.concessionsRevenuePerMatch +
      config.matchday.parkingAndCommercialRevenue) *
      19 +
    config.matchday.memberSubscriptionRevenueMonthly * 12 +
    (config.merchandising?.monthlyRevenue || config.matchday.merchandisingMonthly || 0) * 12;

  const estimatedTvYearly =
    config.tvRights.amountPerRound * 38 +
    (config.tvRights.monthlyQuota ? config.tvRights.monthlyQuota * 12 : 0) +
    config.tvRights.amountPerCompetition +
    config.tvRights.bonusAudienceShare * 12 +
    (config.tvRights.internationalBroadcasting || 0);

  const estimatedPrizesBaseline =
    config.prizes.winPrize * 18 +
    config.prizes.drawPrize * 8 +
    config.prizes.qualificationPrize;

  const totalFutureRevenuesYearly =
    totalSponsorsYearly + estimatedMatchdayYearly + estimatedTvYearly + estimatedPrizesBaseline;

  // Total de Despesas Fixas Mensais
  const totalFixedExpensesMonthly =
    config.expenses.payrollWageMonthly +
    config.expenses.coachingStaffWageMonthly +
    config.expenses.operationalStaffWageMonthly +
    config.expenses.stadiumMaintenanceMonthly +
    config.expenses.youthAcademyMonthly +
    (config.expenses.otherOperationalExpensesMonthly || 0);

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER PRINCIPAL */}
      <div className="bg-slate-900 border border-purple-900/40 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-950 to-indigo-900 border border-purple-600/40 flex items-center justify-center shadow-inner">
              <Shield className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white tracking-tight">
                  ADMIN → CONFIGURAÇÃO FINANCEIRA
                </h1>
                <span className="bg-purple-950 text-purple-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-purple-800/60">
                  EXCLUSIVO ADMIN
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Regulamentação e homologação oficial das regras econômicas por clube e temporada.
              </p>
            </div>
          </div>

          {/* Seleção de Clube e Temporada */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <ClubBadge club={selectedClub} size="sm" />
              <select
                value={selectedClubId}
                onChange={(e) => setSelectedClubId(e.target.value)}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
              >
                {clubs.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                    {c.name} {c.id === 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3' ? '⭐ (Thales FC)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-400">Temporada:</span>
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
              >
                {seasonsList.map((s) => (
                  <option key={s} value={s} className="bg-slate-900 text-white">
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleResetToLeagueDefaults}
              title="Restaurar parâmetros padrão da liga"
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Padrão da Liga</span>
            </button>
          </div>
        </div>

        {/* Barra de Status e Ações Rápidas */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-3">
            {config.status === 'HOMOLOGADA' ? (
              <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>OFICIAL • TEMPORADA HOMOLOGADA</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-amber-950/40 border border-amber-500/40 text-amber-300 px-3 py-1.5 rounded-xl text-xs font-bold">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>RASCUNHO EM EDIÇÃO • NÃO HOMOLOGADA</span>
              </div>
            )}

            {config.homologatedAt && (
              <span className="text-[11px] text-slate-400 hidden md:inline">
                Homologado em {new Date(config.homologatedAt).toLocaleDateString('pt-BR')} por {config.homologatedBy || 'Admin'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Botão Salvar Rascunho */}
            <button
              onClick={() => setIsDraftModalOpen(true)}
              disabled={saving}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs px-4 py-2 rounded-xl shadow transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-slate-400" />
              <span>Salvar Rascunho</span>
            </button>

            {/* Botão Homologar Temporada */}
            <button
              onClick={() => setIsHomologateModalOpen(true)}
              disabled={saving}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg shadow-purple-900/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <FileCheck className="w-4 h-4" />
              <span>Homologar Temporada</span>
            </button>
          </div>
        </div>

        {/* Feedback visual */}
        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}
      </div>

      {/* 4 PILARES ECONÔMICOS SEGREGADOS (ESTRUTURA ECONÔMICA FM UNIVERSE) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-purple-400" />
            Estrutura Econômica Segregada • 4 Pilares Conceituais
          </span>
          <span className="text-[10px] text-slate-400">O Caixa real não é misturado com orçamentos ou projeções</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. CAIXA REAL */}
          <div className="bg-slate-900 border-2 border-emerald-500/40 p-4 rounded-xl relative overflow-hidden shadow-lg shadow-emerald-950/20">
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5" /> 1. Caixa Real
              </span>
              <span className="text-[9px] font-mono bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800/60">
                Liquidez Imediata
              </span>
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
              {formatCurrencyBRL(selectedClub.balance, { compact: false })}
            </div>
            <p className="text-[11px] text-slate-400 mt-2 leading-tight">
              Dinheiro que o clube possui neste momento em conta bancária.
            </p>
          </div>

          {/* 2. ORÇAMENTO DE TRANSFERÊNCIAS */}
          <div className="bg-slate-900 border border-slate-800 hover:border-purple-500/40 p-4 rounded-xl transition-all">
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-bold text-purple-300 uppercase tracking-wide flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-purple-400" /> 2. Orç. Transferências
              </span>
              <span className="text-[9px] font-mono bg-purple-950/80 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800/60">
                Teto Compras
              </span>
            </div>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {formatCurrencyBRL(config.transferBudget, { compact: false })}
            </div>
            <p className="text-[11px] text-slate-400 mt-2 leading-tight">
              Limite disponível para contratações. Bloqueia propostas acima do valor.
            </p>
          </div>

          {/* 3. ORÇAMENTO SALARIAL */}
          <div className="bg-slate-900 border border-slate-800 hover:border-cyan-500/40 p-4 rounded-xl transition-all">
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-bold text-cyan-300 uppercase tracking-wide flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-cyan-400" /> 3. Orçamento Salarial
              </span>
              <span className="text-[9px] font-mono bg-cyan-950/80 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-800/60">
                Teto Mensal
              </span>
            </div>
            <div className="text-2xl font-black text-cyan-300 font-mono mt-1">
              {formatCurrencyBRL(config.wageBudget, { compact: false })}
            </div>
            <p className="text-[11px] text-slate-400 mt-2 leading-tight">
              Limite mensal para salários do elenco e comissão técnica.
            </p>
          </div>

          {/* 4. RECEITAS FUTURAS */}
          <div className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 p-4 rounded-xl transition-all">
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> 4. Receitas Futuras
              </span>
              <span className="text-[9px] font-mono bg-amber-950/80 text-amber-300 px-1.5 py-0.5 rounded border border-amber-800/60">
                Projeção Anual
              </span>
            </div>
            <div className="text-2xl font-black text-amber-300 font-mono mt-1">
              {formatCurrencyBRL(totalFutureRevenuesYearly, { compact: true })}
            </div>
            <p className="text-[11px] text-slate-400 mt-2 leading-tight">
              Dinheiro previsto para entrar posteriormente (TV, patrocínios, bilheteria).
            </p>
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO ENTRE AS 8 SEÇÕES OFICIAIS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800 scrollbar-none">
          <button
            onClick={() => setActiveTab('orcamento')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'orcamento'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>1. Orçamento Inicial</span>
          </button>

          <button
            onClick={() => setActiveTab('patrocinios')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'patrocinios'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>2. Patrocínios ({config.sponsors.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('bilheteria')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'bilheteria'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>3. Bilheteria</span>
          </button>

          <button
            onClick={() => setActiveTab('tv')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'tv'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>4. Televisão</span>
          </button>

          <button
            onClick={() => setActiveTab('premiacoes')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'premiacoes'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>5. Premiações</span>
          </button>

          <button
            onClick={() => setActiveTab('merchandising')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'merchandising'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>6. Merchandising</span>
          </button>

          <button
            onClick={() => setActiveTab('despesas')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'despesas'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>7. Despesas</span>
          </button>

          <button
            onClick={() => setActiveTab('homologacao')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'homologacao'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-950 text-indigo-300 hover:text-white border border-indigo-900/40'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>8. Homologação & Histórico</span>
          </button>
        </div>

        {/* 1. SEÇÃO: ORÇAMENTO INICIAL */}
        {activeTab === 'orcamento' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  1. Orçamento Inicial da Temporada ({selectedSeason})
                </h3>
                <p className="text-xs text-slate-400">
                  Configure a verba inicial, teto de contratações, limite mensal de salários e verbas dedicadas a elenco e staff.
                </p>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-800/40">
                Caixa Real Atual: {formatCurrencyBRL(selectedClub.balance)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Caixa Inicial */}
              <div className="bg-slate-950 p-4 rounded-xl border border-emerald-900/40 space-y-1.5">
                <label className="text-xs font-bold text-emerald-300 block">Caixa Inicial (R$)</label>
                <input
                  type="number"
                  value={config.initialCash ?? config.initialSeasonBudget}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setConfig({ ...config, initialCash: val, initialSeasonBudget: val });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-emerald-700/60 text-emerald-200 font-mono font-bold text-sm px-3 py-2 rounded-lg focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">
                  Verba inicial disponível para o clube no início da temporada
                </span>
              </div>

              {/* Orçamento de Transferências */}
              <div className="bg-slate-950 p-4 rounded-xl border border-purple-900/40 space-y-1.5">
                <label className="text-xs font-bold text-purple-300 block">Orçamento de Transferências (Compras)</label>
                <input
                  type="number"
                  value={config.transferBudget}
                  onChange={(e) => {
                    setConfig({ ...config, transferBudget: Number(e.target.value) || 0 });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-purple-700 text-purple-200 font-mono font-bold text-sm px-3 py-2 rounded-lg focus:border-purple-400 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">
                  Teto disponível para reforços no Mercado
                </span>
              </div>

              {/* Teto Salarial Mensal */}
              <div className="bg-slate-950 p-4 rounded-xl border border-cyan-900/40 space-y-1.5">
                <label className="text-xs font-bold text-cyan-300 block">Teto Salarial Mensal (Folha)</label>
                <input
                  type="number"
                  value={config.wageBudget}
                  onChange={(e) => {
                    setConfig({ ...config, wageBudget: Number(e.target.value) || 0 });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-cyan-700 text-cyan-200 font-mono font-bold text-sm px-3 py-2 rounded-lg focus:border-cyan-400 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">
                  Limite operacional máximo para salários mensais
                </span>
              </div>

              {/* Verba para Montagem do Elenco */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Verba para Montagem do Elenco</label>
                <input
                  type="number"
                  value={config.squadBudget}
                  onChange={(e) => {
                    setConfig({ ...config, squadBudget: Number(e.target.value) || 0 });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-white font-mono font-bold text-sm px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">
                  Luvas, bônus de assinatura e renovações contratuais
                </span>
              </div>

              {/* Verba para Comissão Técnica */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Verba para Comissão Técnica</label>
                <input
                  type="number"
                  value={config.coachingStaffBudget ?? Math.round(config.staffBudget * 0.6)}
                  onChange={(e) => {
                    setConfig({ ...config, coachingStaffBudget: Number(e.target.value) || 0 });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-white font-mono font-bold text-sm px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">
                  Contratação e renovação de treinadores e auxiliares
                </span>
              </div>

              {/* Verba para Staff */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Verba para Staff Operacional / Médico</label>
                <input
                  type="number"
                  value={config.staffBudget}
                  onChange={(e) => {
                    setConfig({ ...config, staffBudget: Number(e.target.value) || 0 });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-white font-mono font-bold text-sm px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">
                  Preparadores físicos, fisioterapeutas, olheiros e médicos
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 2. SEÇÃO: PATROCÍNIOS */}
        {activeTab === 'patrocinios' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  2. Contratos de Patrocínio Cadastrados ({config.sponsors.length})
                </h3>
                <p className="text-xs text-slate-400">
                  O Administrador cadastra os patrocinadores do clube, formas de pagamento, valores mensais/por rodada e bônus esportivos.
                </p>
              </div>

              <button
                onClick={() => handleOpenSponsorModal()}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Patrocinador</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {config.sponsors.map((sponsor) => (
                <div
                  key={sponsor.id}
                  className="bg-slate-950 p-4 rounded-xl border border-slate-800 hover:border-purple-600/40 space-y-2.5 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono bg-purple-950/70 text-purple-300 px-2 py-0.5 rounded border border-purple-800/40 font-bold">
                        {sponsor.category}
                      </span>
                      <strong className="text-white text-sm font-bold">{sponsor.name}</strong>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenSponsorModal(sponsor)}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-purple-300 transition-all cursor-pointer"
                        title="Editar Patrocinador"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemoveSponsor(sponsor.id)}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                        title="Excluir Patrocinador"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1 border-t border-slate-900">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Valor Total:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {formatCurrencyBRL(sponsor.contractValue)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block">Forma Pagto:</span>
                      <span className="font-mono text-slate-300">{sponsor.paymentMethod}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block">Valor Mensal:</span>
                      <span className="font-mono text-cyan-300">
                        {sponsor.monthlyAmount ? formatCurrencyBRL(sponsor.monthlyAmount) : '-'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block">Por Rodada:</span>
                      <span className="font-mono text-cyan-300">
                        {sponsor.amountPerRound ? formatCurrencyBRL(sponsor.amountPerRound) : '-'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block">Bônus Vitória:</span>
                      <span className="font-mono text-amber-300">
                        {sponsor.bonusWin ? formatCurrencyBRL(sponsor.bonusWin) : '-'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block">Bônus Empate:</span>
                      <span className="font-mono text-amber-300">
                        {sponsor.bonusDraw ? formatCurrencyBRL(sponsor.bonusDraw) : '-'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block">Bônus Classif.:</span>
                      <span className="font-mono text-purple-300">
                        {sponsor.bonusQualification ? formatCurrencyBRL(sponsor.bonusQualification) : '-'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block">Bônus Título:</span>
                      <span className="font-mono text-amber-300">
                        {sponsor.bonusTitle ? formatCurrencyBRL(sponsor.bonusTitle) : '-'}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1.5 border-t border-slate-900/60">
                    <span>
                      Vigência: {sponsor.startDate} até {sponsor.endDate}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold ${
                        sponsor.status === 'ATIVO' ? 'bg-emerald-950/60 text-emerald-400' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {sponsor.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. SEÇÃO: BILHETERIA */}
        {activeTab === 'bilheteria' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  3. Parâmetros de Bilheteria & Ocupação do Estádio
                </h3>
                <p className="text-xs text-slate-400">
                  Estádio: {selectedClub.stadiumName} • Capacidade oficial: {selectedClub.capacity.toLocaleString('pt-BR')} torcedores
                </p>
              </div>

              <button
                onClick={handleRecalculateMatchdayRevenue}
                className="bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                title="Calcular receita estimada com base na capacidade e taxa de ocupação"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Simular por Capacidade</span>
              </button>
            </div>

            {/* Aviso conceitual mandatório */}
            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3.5 text-xs text-emerald-200 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-emerald-300 font-bold mb-0.5">
                  Regra Econômica do FM Universe:
                </strong>
                A receita real de bilheteria deverá futuramente ser calculada com base no público e ocupação efetiva de cada partida, e não simplesmente criada artificialmente.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Preço Mínimo */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Preço Mínimo do Ingresso (R$)</label>
                <input
                  type="number"
                  value={config.matchday.ticketMinPrice ?? 20}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      matchday: { ...config.matchday, ticketMinPrice: Number(e.target.value) || 0 },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-white font-mono px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Setor popular e gratuidades legais</span>
              </div>

              {/* Preço Médio */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-emerald-300 block">Preço Médio do Ingresso (R$)</label>
                <input
                  type="number"
                  value={config.matchday.ticketAveragePrice}
                  onChange={(e) => {
                    const price = Number(e.target.value) || 0;
                    const calculatedRev = Math.round(config.matchday.expectedAttendance * price);
                    setConfig({
                      ...config,
                      matchday: {
                        ...config.matchday,
                        ticketAveragePrice: price,
                        estimatedMatchRevenue: calculatedRev,
                      },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-emerald-300 font-mono font-bold px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Ticket médio ponderado de todas as arquibancadas</span>
              </div>

              {/* Preço Máximo */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Preço Máximo do Ingresso (R$)</label>
                <input
                  type="number"
                  value={config.matchday.ticketMaxPrice ?? 250}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      matchday: { ...config.matchday, ticketMaxPrice: Number(e.target.value) || 0 },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-white font-mono px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Camarotes, cadeiras VIP e hospitalidade</span>
              </div>

              {/* Público Esperado */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Público Esperado por Partida</label>
                <input
                  type="number"
                  value={config.matchday.expectedAttendance}
                  onChange={(e) => {
                    const att = Number(e.target.value) || 0;
                    const calculatedRev = Math.round(att * config.matchday.ticketAveragePrice);
                    const calculatedRate = selectedClub.capacity ? Math.round((att / selectedClub.capacity) * 100) : 75;
                    setConfig({
                      ...config,
                      matchday: {
                        ...config.matchday,
                        expectedAttendance: att,
                        estimatedMatchRevenue: calculatedRev,
                        expectedOccupancyRate: calculatedRate,
                      },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-white font-mono font-bold px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">
                  Lotação prevista em partidas com mando de campo
                </span>
              </div>

              {/* Percentual Médio de Ocupação */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-cyan-300 block">Percentual Médio de Ocupação (%)</label>
                <input
                  type="number"
                  value={config.matchday.expectedOccupancyRate}
                  onChange={(e) => {
                    const rate = Number(e.target.value) || 0;
                    const calculatedAtt = Math.round((selectedClub.capacity || 50000) * (rate / 100));
                    const calculatedRev = Math.round(calculatedAtt * config.matchday.ticketAveragePrice);
                    setConfig({
                      ...config,
                      matchday: {
                        ...config.matchday,
                        expectedOccupancyRate: rate,
                        expectedAttendance: calculatedAtt,
                        estimatedMatchRevenue: calculatedRev,
                      },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-cyan-200 font-mono font-bold px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">
                  Taxa de ocupação histórica do estádio ({selectedClub.capacity.toLocaleString()} lug.)
                </span>
              </div>

              {/* Receita Estimada por Partida */}
              <div className="bg-slate-950 p-4 rounded-xl border border-emerald-900/40 space-y-1.5">
                <label className="text-xs font-bold text-emerald-400 block">Receita Estimada por Partida (R$)</label>
                <input
                  type="number"
                  value={config.matchday.estimatedMatchRevenue}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      matchday: {
                        ...config.matchday,
                        estimatedMatchRevenue: Number(e.target.value) || 0,
                      },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-emerald-700 text-emerald-400 font-mono font-bold px-3 py-2 rounded-lg focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">
                  Estimativa bruta por partida como mandante (19 jogos no ano)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 4. SEÇÃO: TELEVISÃO */}
        {activeTab === 'tv' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                4. Cotas e Direitos de Televisão & Transmissão
              </h3>
              <p className="text-xs text-slate-400">
                Determine as cotas de transmissão por rodada, cota mensal fixa, valores por competição e bônus de classificação.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Cota por Rodada */}
              <div className="bg-slate-950 p-4 rounded-xl border border-cyan-900/40 space-y-1.5">
                <label className="text-xs font-bold text-cyan-300 block">Cota de TV por Rodada (R$)</label>
                <input
                  type="number"
                  value={config.tvRights.amountPerRound}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      tvRights: { ...config.tvRights, amountPerRound: Number(e.target.value) || 0 },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-cyan-700 text-cyan-200 font-mono font-bold px-3 py-2 rounded-lg focus:border-cyan-400 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Repasse a cada partida disputada na temporada</span>
              </div>

              {/* Cota Mensal */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Cota Mensal Fixa (R$)</label>
                <input
                  type="number"
                  value={config.tvRights.monthlyQuota ?? 1200000}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      tvRights: { ...config.tvRights, monthlyQuota: Number(e.target.value) || 0 },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-white font-mono px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Repasse mensal regular de direitos televisivos</span>
              </div>

              {/* Cota por Competição */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Cota Fixa por Competição (R$)</label>
                <input
                  type="number"
                  value={config.tvRights.amountPerCompetition}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      tvRights: { ...config.tvRights, amountPerCompetition: Number(e.target.value) || 0 },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-white font-mono px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Cota única pela participação na competição</span>
              </div>

              {/* Bônus por Classificação */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-purple-300 block">Bônus por Classificação de Fase (R$)</label>
                <input
                  type="number"
                  value={config.tvRights.bonusQualification}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      tvRights: { ...config.tvRights, bonusQualification: Number(e.target.value) || 0 },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-purple-200 font-mono px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Bonificação adicional por avanço de fase em mata-matas</span>
              </div>

              {/* Bônus Audiência / PPV */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Audiência Mensal / Pay-per-view (R$)</label>
                <input
                  type="number"
                  value={config.tvRights.bonusAudienceShare}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      tvRights: { ...config.tvRights, bonusAudienceShare: Number(e.target.value) || 0 },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-white font-mono px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Participação em vendas de assinaturas de PPV</span>
              </div>

              {/* Direitos Internacionais */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Transmissão Internacional (R$ / Ano)</label>
                <input
                  type="number"
                  value={config.tvRights.internationalBroadcasting || 0}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      tvRights: { ...config.tvRights, internationalBroadcasting: Number(e.target.value) || 0 },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-white font-mono px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Direitos de exibição internacional dos jogos</span>
              </div>
            </div>
          </div>
        )}

        {/* 5. SEÇÃO: PREMIAÇÕES */}
        {activeTab === 'premiacoes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  5. Premiações Esportivas & Torneios Específicos
                </h3>
                <p className="text-xs text-slate-400">
                  Valores creditados ao clube por vitórias, empates, classificação e tabela de premiação de cada torneio.
                </p>
              </div>

              <button
                onClick={() => setIsCompPrizeModalOpen(true)}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Competição</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Vitória */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-amber-300 block">Prêmio por Vitória (R$)</label>
                <input
                  type="number"
                  value={config.prizes.winPrize}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      prizes: { ...config.prizes, winPrize: Number(e.target.value) || 0 },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-amber-300 font-mono font-bold text-sm px-3 py-1.5 rounded-lg focus:border-amber-400 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Bonificação por 3 pontos conquistados</span>
              </div>

              {/* Empate */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Prêmio por Empate (R$)</label>
                <input
                  type="number"
                  value={config.prizes.drawPrize}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      prizes: { ...config.prizes, drawPrize: Number(e.target.value) || 0 },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-white font-mono font-bold text-sm px-3 py-1.5 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Bonificação por 1 ponto conquistado</span>
              </div>

              {/* Classificação */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-purple-300 block">Prêmio por Classificação (R$)</label>
                <input
                  type="number"
                  value={config.prizes.qualificationPrize}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      prizes: { ...config.prizes, qualificationPrize: Number(e.target.value) || 0 },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-purple-300 font-mono font-bold text-sm px-3 py-1.5 rounded-lg focus:border-purple-400 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Avanço para mata-matas</span>
              </div>

              {/* Título Geral */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-amber-400 block">Prêmio por Título Geral (R$)</label>
                <input
                  type="number"
                  value={config.prizes.titlePrize}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      prizes: { ...config.prizes, titlePrize: Number(e.target.value) || 0 },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-amber-400 font-mono font-bold text-sm px-3 py-1.5 rounded-lg focus:border-amber-400 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Conquista de campeonato principal</span>
              </div>
            </div>

            {/* Premiações de Competições Específicas */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Competições Específicas Homologadas
              </span>
              <div className="divide-y divide-slate-900 text-xs">
                {config.prizes.specificCompetitionPrizes.map((cp) => (
                  <div key={cp.competitionId} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <strong className="text-white block">{cp.competitionName}</strong>
                      <span className="text-[10px] text-slate-500">
                        Participação: {formatCurrencyBRL(cp.participationPrize)}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 font-mono">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Campeão:</span>
                        <span className="text-amber-400 font-bold">{formatCurrencyBRL(cp.championPrize)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Vice-Campeão:</span>
                        <span className="text-slate-300">{formatCurrencyBRL(cp.runnerUpPrize)}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveCompPrize(cp.competitionId)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-rose-400 cursor-pointer"
                        title="Remover Competição"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 6. SEÇÃO: MERCHANDISING */}
        {activeTab === 'merchandising' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                6. Merchandising, Lojas Oficiais & Produtos Licenciados
              </h3>
              <p className="text-xs text-slate-400">
                Configure os parâmetros de venda de camisas, produtos licenciados em dias de jogo e eventos especiais do clube.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Receita Média por Rodada */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-emerald-300 block">Receita Média por Rodada (R$)</label>
                <input
                  type="number"
                  value={config.merchandising?.revenuePerRound ?? 85000}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setConfig({
                      ...config,
                      merchandising: {
                        revenuePerRound: val,
                        monthlyRevenue: config.merchandising?.monthlyRevenue ?? 350000,
                        specialEventsRevenue: config.merchandising?.specialEventsRevenue ?? 500000,
                      },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-emerald-300 font-mono font-bold px-3 py-2 rounded-lg focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">
                  Vendas no estádio em dias de jogos com mando de campo
                </span>
              </div>

              {/* Receita Mensal */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Receita Mensal em Lojas Físicas / E-commerce (R$)</label>
                <input
                  type="number"
                  value={config.merchandising?.monthlyRevenue ?? 350000}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setConfig({
                      ...config,
                      merchandising: {
                        revenuePerRound: config.merchandising?.revenuePerRound ?? 85000,
                        monthlyRevenue: val,
                        specialEventsRevenue: config.merchandising?.specialEventsRevenue ?? 500000,
                      },
                      matchday: {
                        ...config.matchday,
                        merchandisingMonthly: val,
                      },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-white font-mono px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">
                  Operação contínua de lojas oficiais e venda online
                </span>
              </div>

              {/* Bônus / Eventos Especiais */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-amber-300 block">Bônus & Eventos Especiais (R$ / Temporada)</label>
                <input
                  type="number"
                  value={config.merchandising?.specialEventsRevenue ?? 500000}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setConfig({
                      ...config,
                      merchandising: {
                        revenuePerRound: config.merchandising?.revenuePerRound ?? 85000,
                        monthlyRevenue: config.merchandising?.monthlyRevenue ?? 350000,
                        specialEventsRevenue: val,
                      },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-amber-300 font-mono px-3 py-2 rounded-lg focus:border-amber-400 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">
                  Lançamento de uniformes de gala, títulos e festas comemorativas
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 7. SEÇÃO: DESPESAS */}
        {activeTab === 'despesas' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  7. Despesas Operacionais, Folha & Custos Fixos
                </h3>
                <p className="text-xs text-slate-400">
                  Custos mensais debitados para folha salarial, comissão técnica, staff, manutenção do estádio, categorias de base e logística.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-rose-400 bg-rose-950/40 px-2.5 py-1 rounded border border-rose-800/40">
                Total Mensal: {formatCurrencyBRL(totalFixedExpensesMonthly)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Folha Salarial */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-rose-300 block">Folha Salarial dos Atletas (Mensal)</label>
                <input
                  type="number"
                  value={config.expenses.payrollWageMonthly}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      expenses: { ...config.expenses, payrollWageMonthly: Number(e.target.value) || 0 },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-rose-300 font-mono font-bold text-sm px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Salários contratados do elenco principal</span>
              </div>

              {/* Comissão Técnica */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-rose-300 block">Comissão Técnica Principal (Mensal)</label>
                <input
                  type="number"
                  value={config.expenses.coachingStaffWageMonthly}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      expenses: { ...config.expenses, coachingStaffWageMonthly: Number(e.target.value) || 0 },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-rose-300 font-mono font-bold text-sm px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Treinador, auxiliares e preparadores físicos</span>
              </div>

              {/* Staff Operacional */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Staff Operacional & Médico (Mensal)</label>
                <input
                  type="number"
                  value={config.expenses.operationalStaffWageMonthly}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      expenses: { ...config.expenses, operationalStaffWageMonthly: Number(e.target.value) || 0 },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 font-mono font-bold text-sm px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Fisioterapeutas, médicos e rouparia</span>
              </div>

              {/* Manutenção do Estádio */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Manutenção do Estádio (Mensal)</label>
                <input
                  type="number"
                  value={config.expenses.stadiumMaintenanceMonthly}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      expenses: { ...config.expenses, stadiumMaintenanceMonthly: Number(e.target.value) || 0 },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 font-mono font-bold text-sm px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Gramado, iluminação, segurança e conservação</span>
              </div>

              {/* Categorias de Base */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Categorias de Base (Sub-17 / Sub-20)</label>
                <input
                  type="number"
                  value={config.expenses.youthAcademyMonthly}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      expenses: { ...config.expenses, youthAcademyMonthly: Number(e.target.value) || 0 },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 font-mono font-bold text-sm px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Alojamento, formação e torneios juniores</span>
              </div>

              {/* Logística */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Logística por Partida Fora de Casa</label>
                <input
                  type="number"
                  value={config.expenses.travelAndLogisticsPerMatch}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      expenses: { ...config.expenses, travelAndLogisticsPerMatch: Number(e.target.value) || 0 },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-rose-300 font-mono font-bold text-sm px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Voos fretados, hotelaria e translado</span>
              </div>

              {/* Outras Despesas */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">Outras Despesas Operacionais (Mensal)</label>
                <input
                  type="number"
                  value={config.expenses.otherOperationalExpensesMonthly || 0}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      expenses: { ...config.expenses, otherOperationalExpensesMonthly: Number(e.target.value) || 0 },
                    });
                    setIsEditing(true);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 font-mono font-bold text-sm px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block">Assessoria jurídica, taxas bancárias e contábeis</span>
              </div>
            </div>
          </div>
        )}

        {/* 8. SEÇÃO: HOMOLOGAÇÃO & HISTÓRICO DE AUDITORIA */}
        {activeTab === 'homologacao' && (
          <div className="space-y-5">
            {/* Status e Ações de Homologação */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-purple-400" />
                    8. Homologação Oficial da Temporada ({selectedSeason})
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Somente o Administrador possui permissão para definir, alterar e homologar as regras da Liga.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsDraftModalOpen(true)}
                    disabled={saving}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5 text-slate-400" />
                    <span>Salvar Rascunho</span>
                  </button>

                  <button
                    onClick={() => setIsHomologateModalOpen(true)}
                    disabled={saving}
                    className="bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-purple-900/30 cursor-pointer disabled:opacity-50"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Homologar Temporada</span>
                  </button>
                </div>
              </div>

              {/* Regras e efeitos de homologação */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-900/70 p-3.5 rounded-lg border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-white">
                    <Lock className="w-3.5 h-3.5 text-purple-400" /> Bloqueio para o Manager
                  </div>
                  <p className="text-[11px] text-slate-400">
                    O Manager não cria dinheiro e apenas visualiza os parâmetros homologados pelo Admin.
                  </p>
                </div>

                <div className="bg-slate-900/70 p-3.5 rounded-lg border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-white">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Status Oficial
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Ao homologar, a temporada é marcada como OFICIAL e disponibilizada para os serviços do Mercado.
                  </p>
                </div>

                <div className="bg-slate-900/70 p-3.5 rounded-lg border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-white">
                    <Shield className="w-3.5 h-3.5 text-cyan-400" /> Somente Admin Altera
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Qualquer alteração futura exige carimbo de auditoria, e-mail do Admin e justificativa.
                  </p>
                </div>
              </div>
            </div>

            {/* Histórico Completo de Auditoria */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-400" />
                    Histórico de Alterações & Auditoria
                  </h3>
                  <p className="text-xs text-slate-400">
                    Registro de clube, temporada, administrador, campo alterado, valor anterior, novo valor e motivo.
                  </p>
                </div>

                <span className="text-[11px] font-mono text-indigo-300 bg-indigo-950/60 px-2.5 py-1 rounded border border-indigo-800/40">
                  {config.auditHistory?.length || 0} Registros Auditados
                </span>
              </div>

              {(!config.auditHistory || config.auditHistory.length === 0) ? (
                <div className="text-center py-10 bg-slate-950 rounded-xl border border-slate-800 text-slate-500 text-xs">
                  Nenhum evento registrado no histórico para esta temporada.
                </div>
              ) : (
                <div className="space-y-3">
                  {config.auditHistory.map((audit) => (
                    <div
                      key={audit.id}
                      className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-3 text-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-900 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold ${
                              audit.action === 'HOMOLOGATE_SEASON'
                                ? 'bg-purple-950 text-purple-300 border border-purple-800/50'
                                : 'bg-indigo-950 text-indigo-300 border border-indigo-800/50'
                            }`}
                          >
                            {audit.action === 'HOMOLOGATE_SEASON' ? 'HOMOLOGAÇÃO OFICIAL' : 'ATUALIZAÇÃO DE PARÂMETROS'}
                          </span>
                          <strong className="text-white">{audit.description}</strong>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            {new Date(audit.timestamp).toLocaleString('pt-BR')}
                          </span>
                          <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
                            {audit.adminEmail}
                          </span>
                        </div>
                      </div>

                      {/* Motivo se informado */}
                      {audit.reason && (
                        <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-slate-300 text-xs flex items-center gap-2">
                          <strong className="text-purple-300 text-[11px]">Motivo registrado:</strong>
                          <span>{audit.reason}</span>
                        </div>
                      )}

                      {/* Tabela de Campo | Valor Anterior | Novo Valor */}
                      {audit.fieldChanges && audit.fieldChanges.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[11px]">
                            <thead>
                              <tr className="text-slate-500 border-b border-slate-900 font-mono">
                                <th className="py-1 pr-3">Campo Alterado</th>
                                <th className="py-1 pr-3">Valor Anterior</th>
                                <th className="py-1">Novo Valor Homologado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900/60 font-mono">
                              {audit.fieldChanges.map((change, cIdx) => (
                                <tr key={cIdx} className="text-slate-300">
                                  <td className="py-1.5 pr-3 font-medium text-white">{change.fieldLabel}</td>
                                  <td className="py-1.5 pr-3 text-slate-500">
                                    {typeof change.previousValue === 'number'
                                      ? formatCurrencyBRL(change.previousValue)
                                      : String(change.previousValue)}
                                  </td>
                                  <td className="py-1.5 text-emerald-400 font-bold">
                                    {typeof change.newValue === 'number'
                                      ? formatCurrencyBRL(change.newValue)
                                      : String(change.newValue)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: SALVAR RASCUNHO (COM MOTIVO OPCIONAL) */}
      {isDraftModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Save className="w-5 h-5 text-slate-400" />
                <span>Salvar Rascunho</span>
              </h3>
              <button
                onClick={() => setIsDraftModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              O rascunho armazena os parâmetros sem marcá-los como homologados. O status continuará como{' '}
              <strong className="text-amber-400 font-bold">RASCUNHO</strong> e os dados poderão ser alterados a qualquer momento.
            </p>

            <div className="space-y-1 text-xs">
              <label className="text-slate-300 block font-bold">Motivo da Alteração (Opcional)</label>
              <input
                type="text"
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="Ex: Ajuste preliminar da folha salarial"
                className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500 block">Será registrado no histórico de auditoria</span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsDraftModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Confirmar e Salvar Rascunho'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: HOMOLOGAR TEMPORADA (OFICIAL) */}
      {isHomologateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-800/40 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-purple-400" />
                <span>Homologação Oficial da Temporada</span>
              </h3>
              <button
                onClick={() => setIsHomologateModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                Ao homologar, esta configuração se tornará a{' '}
                <strong className="text-white font-bold">REGRA OFICIAL VIGENTE</strong> para o{' '}
                <strong className="text-emerald-400">{selectedClub.name}</strong> na temporada{' '}
                <strong className="text-cyan-400">{selectedSeason}</strong>.
              </p>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-purple-300 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                  Efeitos da Homologação:
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                  <li>Configuração marcada formalmente como <strong>OFICIAL</strong>.</li>
                  <li>Data/hora e Administrador responsável gravados permanentemente.</li>
                  <li>Edição bloqueada para o Manager (apenas leitura das regras vigentes).</li>
                  <li>Valores disponibilizados oficialmente para os serviços econômicos e Mercado.</li>
                  <li>Permissão de alteração posterior restrita exclusivamente ao Administrador.</li>
                </ul>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 block font-bold">Motivo da Homologação (Opcional)</label>
                <input
                  type="text"
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="Ex: Aprovação oficial do conselho para início da temporada"
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsHomologateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleHomologateSeason}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/30 cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Homologando...' : 'Confirmar e Homologar Temporada'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADICIONAR / EDITAR PATROCINADOR */}
      {isSponsorModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-800/40 rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-400" />
                <span>{editingSponsorId ? 'Editar Contrato de Patrocínio' : 'Novo Contrato de Patrocínio'}</span>
              </h3>
              <button
                onClick={() => setIsSponsorModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Nome do Patrocinador</label>
                <input
                  type="text"
                  value={sponsorName}
                  onChange={(e) => setSponsorName(e.target.value)}
                  placeholder="Ex: Banco Global Prime"
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">Categoria</label>
                  <select
                    value={sponsorCategory}
                    onChange={(e) => setSponsorCategory(e.target.value as SponsorCategory)}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none cursor-pointer"
                  >
                    <option value="MASTER">Master (Peito)</option>
                    <option value="MANGA">Mangas</option>
                    <option value="COSTAS">Costas</option>
                    <option value="OMBRO">Omoplata</option>
                    <option value="CALCAO">Calção</option>
                    <option value="MATERIAL_ESPORTIVO">Fornecedor Esportivo</option>
                    <option value="ESTADIO_NAMING_RIGHTS">Naming Rights Estádio</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Forma de Pagamento</label>
                  <select
                    value={sponsorMethod}
                    onChange={(e) => setSponsorMethod(e.target.value as SponsorPaymentMethod)}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none cursor-pointer"
                  >
                    <option value="MENSAL">Mensal</option>
                    <option value="POR_RODADA">Por Rodada</option>
                    <option value="A_VISTA">À Vista</option>
                    <option value="POR_TEMPORADA">Por Temporada</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">Valor Total (R$)</label>
                  <input
                    type="number"
                    value={sponsorValue}
                    onChange={(e) => setSponsorValue(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 text-white font-mono px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Valor por Mês (R$)</label>
                  <input
                    type="number"
                    value={sponsorMonthly}
                    onChange={(e) => setSponsorMonthly(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 text-white font-mono px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Valor por Rodada (R$)</label>
                  <input
                    type="number"
                    value={sponsorPerRound}
                    onChange={(e) => setSponsorPerRound(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 text-white font-mono px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Bônus esportivos */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div>
                  <label className="text-slate-300 block mb-1">Bônus Vitória</label>
                  <input
                    type="number"
                    value={sponsorBonusWin}
                    onChange={(e) => setSponsorBonusWin(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 text-white font-mono px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Bônus Empate</label>
                  <input
                    type="number"
                    value={sponsorBonusDraw}
                    onChange={(e) => setSponsorBonusDraw(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 text-white font-mono px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Bônus Classif.</label>
                  <input
                    type="number"
                    value={sponsorBonusQual}
                    onChange={(e) => setSponsorBonusQual(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 text-white font-mono px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Bônus Título</label>
                  <input
                    type="number"
                    value={sponsorBonusTitle}
                    onChange={(e) => setSponsorBonusTitle(Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 text-white font-mono px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">Data Inicial</label>
                  <input
                    type="date"
                    value={sponsorStartDate}
                    onChange={(e) => setSponsorStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Data Final</label>
                  <input
                    type="date"
                    value={sponsorEndDate}
                    onChange={(e) => setSponsorEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Status</label>
                  <select
                    value={sponsorStatus}
                    onChange={(e) => setSponsorStatus(e.target.value as SponsorStatus)}
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none cursor-pointer"
                  >
                    <option value="ATIVO">ATIVO</option>
                    <option value="PENDENTE">PENDENTE</option>
                    <option value="ENCERRADO">ENCERRADO</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsSponsorModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSponsorModal}
                disabled={!sponsorName.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow cursor-pointer disabled:opacity-50"
              >
                {editingSponsorId ? 'Atualizar Patrocinador' : 'Adicionar Patrocinador'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADICIONAR COMPETIÇÃO ESPECÍFICA */}
      {isCompPrizeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-800/40 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span>Nova Premiação por Torneio</span>
              </h3>
              <button
                onClick={() => setIsCompPrizeModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Nome da Competição</label>
                <input
                  type="text"
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  placeholder="Ex: Supercopa da Liga"
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Prêmio Campeão (R$)</label>
                <input
                  type="number"
                  value={compChamp}
                  onChange={(e) => setCompChamp(Number(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 text-amber-300 font-mono px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Prêmio Vice-Campeão (R$)</label>
                <input
                  type="number"
                  value={compRunner}
                  onChange={(e) => setCompRunner(Number(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 text-white font-mono px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Cota de Participação (R$)</label>
                <input
                  type="number"
                  value={compPart}
                  onChange={(e) => setCompPart(Number(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 text-white font-mono px-3 py-2 rounded-lg focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsCompPrizeModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddCompPrize}
                disabled={!compName.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow cursor-pointer disabled:opacity-50"
              >
                Adicionar Torneio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
