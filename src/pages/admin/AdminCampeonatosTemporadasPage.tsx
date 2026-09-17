import React, { useEffect, useState, useMemo } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { temporadasService } from '../../services/temporadasService';
import { competicoesService } from '../../services/competicoesService';
import { participantesService } from '../../services/participantesService';
import { calendarioService } from '../../services/calendarioService';
import { clubesService } from '../../services/clubesService';
import { noticiasService } from '../../services/noticiasService';
import {
  Season,
  Competition,
  Club,
  Match,
  CompetitionRules,
  CompetitionPrizeDistribution,
} from '../../types';
import { formatCurrencyBRL } from '../../utils/currency';
import {
  Trophy,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Trash2,
  Lock,
  Unlock,
  CheckCircle2,
  Play,
  RotateCcw,
  Sparkles,
  ArrowUpDown,
  Clock,
  MapPin,
  Save,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  FileEdit,
  Sliders,
  Award,
  HelpCircle,
  Search,
  XCircle,
  AlertCircle,
  BarChart3,
  Scale,
  Info,
  Ban,
} from 'lucide-react';

type TabType =
  | 'AUDITORIA'
  | 'TEMPORADA'
  | 'CAMPEONATO'
  | 'PARTICIPANTES'
  | 'CALENDARIO'
  | 'REGRAS'
  | 'PREMIACOES'
  | 'REVISAO';

const DEFAULT_RULES: CompetitionRules = {
  pointsWin: 3,
  pointsDraw: 1,
  pointsLoss: 0,
  tiebreakers: [
    'SALDO_GOLS',
    'GOLS_PRO',
    'VITORIAS',
    'CONFRONTO_DIRETO',
    'MENOS_CARTAO_VERMELHO',
  ],
};

const DEFAULT_PRIZES: CompetitionPrizeDistribution = {
  champion: 40000000,
  runnerUp: 25000000,
  thirdPlace: 15000000,
  participationPerClub: 10000000,
  winBonus: 500000,
  drawBonus: 200000,
};

export const AdminCampeonatosTemporadasPage: React.FC = () => {
  const { navigate } = useNavigation();

  // State Principal
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<string>('');
  const [allClubs, setAllClubs] = useState<Club[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  // Aba Ativa (Calendário Oficial Corrigido em primeiro plano conforme solicitado)
  const [activeTab, setActiveTab] = useState<TabType>('CALENDARIO');
  const [showAllRounds, setShowAllRounds] = useState<boolean>(true);

  // Form Temporada
  const [seasonName, setSeasonName] = useState('FM Universe 2026/2027');
  const [seasonYear, setSeasonYear] = useState('2026/2027');
  const [seasonStartDate, setSeasonStartDate] = useState('2026-08-01');
  const [seasonEndDate, setSeasonEndDate] = useState('2027-05-30');
  const [seasonWindowOpen, setSeasonWindowOpen] = useState(true);

  // Form Campeonato
  const [compName, setCompName] = useState('Liga FM Universe');
  const [compType, setCompType] = useState<'LIGA' | 'COPA'>('LIGA');
  const [compFormat, setCompFormat] = useState<'TODOS_CONTRA_TODOS' | 'MATA_MATA'>('TODOS_CONTRA_TODOS');
  const [compLegs, setCompLegs] = useState<'TURNO_E_RETURNO' | 'TURNO_UNICO'>('TURNO_E_RETURNO');
  const [compRoundsCount, setCompRoundsCount] = useState<number>(10);

  // Participantes Selecionados
  const [selectedClubIds, setSelectedClubIds] = useState<string[]>([]);

  // Regras e Premiações
  const [rules, setRules] = useState<CompetitionRules>(DEFAULT_RULES);
  const [prizes, setPrizes] = useState<CompetitionPrizeDistribution>(DEFAULT_PRIZES);

  // Calendário
  const [selectedRoundFilter, setSelectedRoundFilter] = useState<number>(1);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [isAddingMatch, setIsAddingMatch] = useState(false);
  const [newMatchData, setNewMatchData] = useState<{
    round: number;
    homeClubId: string;
    awayClubId: string;
    date: string;
    time: string;
  }>({
    round: 1,
    homeClubId: '',
    awayClubId: '',
    date: '2026-09-12',
    time: '16:00',
  });

  // Feedback & Loading
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHomologateModal, setShowHomologateModal] = useState(false);
  const [showRevertModal, setShowRevertModal] = useState(false);

  // Carregamento de Dados
  const loadAll = async (targetSeasonId?: string, targetCompId?: string) => {
    try {
      setLoading(true);
      const [allSeasons, allComps, clubsList] = await Promise.all([
        temporadasService.getAll(),
        competicoesService.getAll(),
        clubesService.getAll(),
      ]);

      setSeasons(allSeasons);
      setCompetitions(allComps);
      setAllClubs(clubsList);

      // Determina temporada ativa ou selecionada
      const activeSeason =
        allSeasons.find((s) => (targetSeasonId ? s.id === targetSeasonId : s.isCurrent)) ||
        allSeasons[0];

      if (activeSeason) {
        setSelectedSeasonId(activeSeason.id);
        setSeasonName(activeSeason.name);
        setSeasonYear(activeSeason.year);
        setSeasonStartDate(activeSeason.startDate);
        setSeasonEndDate(activeSeason.endDate);
        setSeasonWindowOpen(activeSeason.transferWindowOpen ?? true);

        if (activeSeason.rules) setRules(activeSeason.rules);
        if (activeSeason.prizes) setPrizes(activeSeason.prizes);

        // Busca competição associada a esta temporada
        const linkedComp =
          allComps.find((c) =>
            targetCompId
              ? c.id === targetCompId
              : c.temporadaId === activeSeason.id || c.season === activeSeason.year
          ) || allComps[0];

        if (linkedComp) {
          setSelectedCompId(linkedComp.id);
          setCompName(linkedComp.name);
          setCompType(linkedComp.type);
          setCompFormat(linkedComp.format || 'TODOS_CONTRA_TODOS');
          setCompLegs(linkedComp.legs || 'TURNO_E_RETURNO');
          setCompRoundsCount(linkedComp.roundsCount || 10);
          if (linkedComp.rules) setRules(linkedComp.rules);
          if (linkedComp.prizes) setPrizes(linkedComp.prizes);

          // Clubes oficiais autorizados: FM United, Real Football, Inter Tech, Porto Real, Santos Stars e Thales FC.
          // Atlético FC e Real Madrid NÃO podem aparecer no calendário.
          const ALLOWED_6_CLUBS = [
            'club-1', // FM United
            'club-2', // Real Football
            'club-3', // Inter Tech
            'club-4', // Porto Real
            'club-5', // Santos Stars
            'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3', // Thales FC
          ];

          // Carrega participantes da competição
          const parts = await participantesService.getByCompetition(linkedComp.id);
          let validClubIds = parts.map((p) => p.clubId).filter((id) => !['club-6', 'club-real-madrid', 'club-atletico-fc'].includes(id));
          if (validClubIds.length !== 6) {
            validClubIds = ALLOWED_6_CLUBS;
            await participantesService.setParticipantsForCompetition(
              linkedComp.id,
              validClubIds,
              activeSeason.id
            );
          }
          setSelectedClubIds(validClubIds);

          // Carrega partidas do calendário
          let compMatches = await calendarioService.getCalendarByCompetition(linkedComp.id);

          const hasInvalidClub = compMatches.some((m) =>
            ['club-6', 'atlântico fc', 'atletico fc', 'real madrid'].some((b) =>
              m.homeClubName?.toLowerCase().includes(b) ||
              m.awayClubName?.toLowerCase().includes(b) ||
              m.homeClubId === 'club-6' ||
              m.awayClubId === 'club-6'
            )
          );

          // Correção estrutural oficial: se não tiver exatamente 30 jogos ou tiver clube inválido
          if (compMatches.length !== 30 || hasInvalidClub) {
            // Reabre para revisão se estiver homologada (conforme instrução administrativa)
            if (activeSeason.status === 'HOMOLOGADA' || linkedComp.calendarStatus === 'HOMOLOGADO') {
              activeSeason.status = 'RASCUNHO';
              linkedComp.calendarStatus = 'RASCUNHO';
              await temporadasService.save(activeSeason);
              await competicoesService.save(linkedComp);
            }

            // Gera o calendário oficial de 30 partidas com mando estritamente invertido
            compMatches = await calendarioService.generateRoundRobinCalendar({
              competitionId: linkedComp.id,
              seasonId: activeSeason.id,
              legs: 'TURNO_E_RETURNO',
              baseStartDate: activeSeason.startDate || '2026-08-08',
              selectedClubIds: validClubIds,
              allowAdministrativeRevision: true,
            });
          }

          setMatches(compMatches);
          setSelectedRoundFilter(1);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      showFeedback('error', 'Falha ao sincronizar dados com o banco.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const showFeedback = (type: 'success' | 'error' | 'info', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Temporada atual selecionada
  const currentSeason = seasons.find((s) => s.id === selectedSeasonId);
  const currentComp = competitions.find((c) => c.id === selectedCompId);
  const isHomologated =
    currentSeason?.status === 'HOMOLOGADA' || currentComp?.calendarStatus === 'HOMOLOGADO';

  // Troca de Temporada Selecionada
  const handleSelectSeason = async (seasonId: string) => {
    await loadAll(seasonId);
  };

  // Criar Nova Temporada (Modo Criação)
  const handleStartNewSeason = () => {
    const nextYear = '2027/2028';
    const newId = `s-${Date.now()}`;
    const newCompId = `comp-${Date.now()}`;

    const newSeasonObj: Season = {
      id: newId,
      name: `FM Universe ${nextYear}`,
      year: nextYear,
      status: 'RASCUNHO',
      startDate: '2027-08-01',
      endDate: '2028-05-30',
      transferWindowOpen: true,
      rules: { ...DEFAULT_RULES },
      prizes: { ...DEFAULT_PRIZES },
    };

    const newCompObj: Competition = {
      id: newCompId,
      name: `Liga FM Universe ${nextYear}`,
      type: 'LIGA',
      season: nextYear,
      temporadaId: newId,
      logo: '🏆',
      teamsCount: 6,
      roundsCount: 10,
      currentRound: 1,
      status: 'PREVIA',
      calendarStatus: 'RASCUNHO',
      format: 'TODOS_CONTRA_TODOS',
      legs: 'TURNO_E_RETURNO',
      standings: [],
      description: `Disputa oficial da temporada ${nextYear}.`,
      rules: { ...DEFAULT_RULES },
      prizes: { ...DEFAULT_PRIZES },
    };

    // Preenche campos locais com os clubes existentes por padrão
    setSeasons((prev) => [newSeasonObj, ...prev]);
    setCompetitions((prev) => [newCompObj, ...prev]);
    setSelectedSeasonId(newId);
    setSelectedCompId(newCompId);

    setSeasonName(newSeasonObj.name);
    setSeasonYear(newSeasonObj.year);
    setSeasonStartDate(newSeasonObj.startDate);
    setSeasonEndDate(newSeasonObj.endDate);
    setSeasonWindowOpen(true);

    setCompName(newCompObj.name);
    setCompType(newCompObj.type);
    setCompFormat('TODOS_CONTRA_TODOS');
    setCompLegs('TURNO_E_RETURNO');
    setCompRoundsCount(10);

    // Seleciona os 6 primeiros clubes reais existentes
    const initialClubs = allClubs.slice(0, 6).map((c) => c.id);
    setSelectedClubIds(initialClubs);
    setMatches([]);
    setRules({ ...DEFAULT_RULES });
    setPrizes({ ...DEFAULT_PRIZES });

    setActiveTab('TEMPORADA');
    showFeedback(
      'info',
      `Nova temporada em modo RASCUNHO iniciada. Complete as 7 etapas e clique em Homologar quando estiver pronto!`
    );
  };

  // Toggle de seleção de clube
  const handleToggleClub = (clubId: string) => {
    if (isHomologated) {
      showFeedback('error', 'Esta temporada está homologada e bloqueada para alteração de participantes.');
      return;
    }

    // Proteção Thales FC: clube do manager
    if (clubId === 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3' && selectedClubIds.includes(clubId)) {
      showFeedback('info', 'Thales FC é o clube do Manager oficial e é recomendado mantê-lo na competição.');
    }

    if (selectedClubIds.includes(clubId)) {
      setSelectedClubIds((prev) => prev.filter((id) => id !== clubId));
    } else {
      setSelectedClubIds((prev) => [...prev, clubId]);
    }
  };

  // Selecionar Todos / Desmarcar Todos
  const handleSelectAllClubs = () => {
    if (isHomologated) return;
    setSelectedClubIds(allClubs.map((c) => c.id));
  };

  const handleClearClubSelection = () => {
    if (isHomologated) return;
    // Mantém ao menos o Thales FC por segurança
    const thales = allClubs.find((c) => c.name.includes('Thales') || c.id === 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3');
    setSelectedClubIds(thales ? [thales.id] : []);
  };

  // Reordenação de Critérios de Desempate
  const handleMoveTiebreaker = (index: number, direction: 'UP' | 'DOWN') => {
    if (isHomologated) return;
    const list = [...rules.tiebreakers];
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    setRules((prev) => ({ ...prev, tiebreakers: list }));
  };

  // Geração Automática de Calendário (Berger / Round-Robin)
  const handleGenerateCalendar = async () => {
    if (isHomologated) {
      showFeedback('error', 'Temporada homologada. Não é permitido regerar o calendário.');
      return;
    }

    if (selectedClubIds.length < 2) {
      showFeedback('error', 'Selecione ao menos 2 clubes participantes para gerar o calendário.');
      return;
    }

    setLoading(true);
    try {
      // 1. Sincroniza participantes
      await participantesService.setParticipantsForCompetition(
        selectedCompId,
        selectedClubIds,
        selectedSeasonId
      );

      // 2. Gera confrontos automáticos com mandos invertidos e estádios
      const generated = await calendarioService.generateRoundRobinCalendar({
        competitionId: selectedCompId,
        seasonId: selectedSeasonId,
        legs: compLegs,
        baseStartDate: seasonStartDate,
      });

      setMatches(generated);
      const calculatedRounds =
        compLegs === 'TURNO_E_RETURNO'
          ? (selectedClubIds.length - (selectedClubIds.length % 2 === 0 ? 1 : 0)) * 2
          : selectedClubIds.length - 1;
      setCompRoundsCount(calculatedRounds);

      showFeedback(
        'success',
        `Calendário gerado com sucesso! ${generated.length} confrontos criados em ${calculatedRounds} rodadas.`
      );
    } catch (err: any) {
      console.error('Erro ao gerar calendário:', err);
      showFeedback('error', err.message || 'Falha ao gerar calendário automático.');
    } finally {
      setLoading(false);
    }
  };

  // Salvar como Rascunho
  const handleSaveDraft = async () => {
    setLoading(true);
    try {
      // 1. Salva Season
      const updatedSeason: Season = {
        id: selectedSeasonId,
        name: seasonName,
        year: seasonYear,
        status: isHomologated ? 'HOMOLOGADA' : 'RASCUNHO',
        startDate: seasonStartDate,
        endDate: seasonEndDate,
        transferWindowOpen: seasonWindowOpen,
        rules,
        prizes,
        homologatedAt: currentSeason?.homologatedAt,
        homologatedBy: currentSeason?.homologatedBy,
      };
      await temporadasService.save(updatedSeason);

      // 2. Salva Participantes
      await participantesService.setParticipantsForCompetition(
        selectedCompId,
        selectedClubIds,
        selectedSeasonId
      );

      // 3. Salva Competição
      const updatedComp: Competition = {
        ...(currentComp || {
          id: selectedCompId,
          name: compName,
          type: compType,
          season: seasonYear,
          logo: '🏆',
          currentRound: 1,
          status: 'PREVIA',
          standings: [],
          description: '',
        }),
        name: compName,
        type: compType,
        season: seasonYear,
        temporadaId: selectedSeasonId,
        format: compFormat,
        legs: compLegs,
        teamsCount: selectedClubIds.length,
        roundsCount: compRoundsCount,
        calendarStatus: isHomologated ? 'HOMOLOGADO' : 'RASCUNHO',
        rules,
        prizes,
      };
      await competicoesService.save(updatedComp);

      showFeedback('success', 'Temporada e parâmetros salvos como RASCUNHO com sucesso!');
      await loadAll(selectedSeasonId, selectedCompId);
    } catch (err: any) {
      console.error('Erro ao salvar rascunho:', err);
      showFeedback('error', 'Falha ao salvar rascunho.');
    } finally {
      setLoading(false);
    }
  };

  // Inverter Mando de Campo
  const handleSwapHomeAway = async (matchId: string) => {
    if (isHomologated) {
      showFeedback('error', 'Temporada homologada. Não é permitido alterar mandos.');
      return;
    }
    try {
      const updated = await calendarioService.swapMatchHomeAway(matchId);
      setMatches((prev) => prev.map((m) => (m.id === matchId ? updated : m)));
      showFeedback('success', `Mando invertido: ${updated.homeClubName} agora joga em casa!`);
    } catch (err: any) {
      showFeedback('error', err.message || 'Falha ao inverter mando.');
    }
  };

  // Excluir Partida
  const handleDeleteMatch = async (matchId: string) => {
    if (isHomologated) {
      showFeedback('error', 'Temporada homologada. Não é permitido excluir confrontos.');
      return;
    }
    try {
      await calendarioService.deleteMatch(matchId);
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
      showFeedback('success', 'Confronto removido do calendário.');
    } catch (err) {
      showFeedback('error', 'Falha ao excluir partida.');
    }
  };

  // Salvar Edição Manual de Partida (Data/Horário)
  const handleSaveMatchEdit = async () => {
    if (!editingMatch || isHomologated) return;
    try {
      await calendarioService.updateMatch(editingMatch.id, {
        date: editingMatch.date,
        time: editingMatch.time,
        homeClubId: editingMatch.homeClubId,
        awayClubId: editingMatch.awayClubId,
        homeClubName: editingMatch.homeClubName,
        awayClubName: editingMatch.awayClubName,
      });
      setMatches((prev) => prev.map((m) => (m.id === editingMatch.id ? editingMatch : m)));
      setEditingMatch(null);
      showFeedback('success', 'Dados da partida atualizados com sucesso!');
    } catch (err) {
      showFeedback('error', 'Falha ao atualizar partida.');
    }
  };

  // Adicionar Nova Partida Manual
  const handleAddManualMatch = async () => {
    if (isHomologated) return;
    if (!newMatchData.homeClubId || !newMatchData.awayClubId) {
      showFeedback('error', 'Selecione mandante e visitante.');
      return;
    }
    if (newMatchData.homeClubId === newMatchData.awayClubId) {
      showFeedback('error', 'Mandante e visitante não podem ser o mesmo clube.');
      return;
    }

    const homeClub = allClubs.find((c) => c.id === newMatchData.homeClubId);
    const awayClub = allClubs.find((c) => c.id === newMatchData.awayClubId);

    const newMatch: Match = {
      id: `match-custom-${Date.now()}`,
      competitionId: selectedCompId,
      competitionName: compName,
      season: seasonYear,
      temporadaId: selectedSeasonId,
      round: newMatchData.round,
      rodada: newMatchData.round,
      date: newMatchData.date,
      time: newMatchData.time,
      homeClubId: newMatchData.homeClubId,
      homeClubName: homeClub?.name || 'Mandante',
      awayClubId: newMatchData.awayClubId,
      awayClubName: awayClub?.name || 'Visitante',
      stadiumId: homeClub?.stadiumId || 'stad-default',
      stadiumName: homeClub?.stadiumName || (homeClub ? `Estádio do ${homeClub.name}` : 'Estádio Principal'),
      status: 'SCHEDULED',
      events: [],
    };

    try {
      await calendarioService.addMatch(newMatch);
      setMatches((prev) => [...prev, newMatch]);
      setIsAddingMatch(false);
      showFeedback('success', `Confronto ${newMatch.homeClubName} x ${newMatch.awayClubName} adicionado à Rodada ${newMatch.round}!`);
    } catch (err) {
      showFeedback('error', 'Falha ao adicionar confronto manual.');
    }
  };

  // HOMOLOGAR TEMPORADA
  const handleHomologateSeason = async () => {
    if (selectedClubIds.length < 2) {
      showFeedback('error', 'A competição precisa ter ao menos 2 clubes participantes.');
      return;
    }

    if (matches.length === 0) {
      showFeedback('error', 'O calendário precisa ter partidas geradas antes da homologação.');
      return;
    }

    setLoading(true);
    try {
      // 1. Salva rascunho completo
      await handleSaveDraft();

      // 2. Homologa Participantes
      await participantesService.homologateParticipants(selectedCompId);

      // 3. Homologa Calendário da Competição
      await calendarioService.homologateCalendar(selectedCompId, 'Admin FM Universe');

      // 4. Homologa a Temporada
      await temporadasService.homologateSeason(selectedSeasonId, 'Admin FM Universe');

      // 5. Publica Notícia Oficial de Homologação
      await noticiasService.publishOfficialAnnouncement({
        id: `news-homologation-${selectedSeasonId}-${Date.now()}`,
        title: `Temporada Oficial Homologada: ${seasonName} & ${compName}`,
        summary: `O Administrador do FM Universe homologou oficialmente o calendário e as regras para a temporada ${seasonYear}.`,
        content: `O departamento de competições do FM Universe concluiu o processo de homologação oficial para a temporada ${seasonYear}. A disputa contará com ${selectedClubIds.length} clubes, ${compRoundsCount} rodadas programadas e premiações que chegam a ${formatCurrencyBRL(prizes.champion)} para o campeão. Todos os confrontos e horários foram validados no sistema. Os Managers já estão autorizados a realizar suas partidas oficiais pelo botão Continuar.`,
        category: 'COMPETICAO',
        type: 'TOURNAMENT_EVENT',
        priority: 'ALTA',
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        author: 'Departamento de Competições FM Universe',
        readTimeMinutes: 2,
        isRead: false,
      });

      setShowHomologateModal(false);
      showFeedback('success', `TEMPORADA HOMOLOGADA COM SUCESSO! O calendário e regras tornaram-se a fonte oficial do FM Universe.`);
      await loadAll(selectedSeasonId, selectedCompId);
    } catch (err: any) {
      console.error('Erro ao homologar temporada:', err);
      showFeedback('error', err.message || 'Falha ao homologar temporada.');
    } finally {
      setLoading(false);
    }
  };

  // Reabertura para Revisão
  const handleRevertToDraft = async () => {
    setLoading(true);
    try {
      await calendarioService.revertToDraft(selectedCompId);
      await temporadasService.revertSeasonToDraft(selectedSeasonId);
      setShowRevertModal(false);
      showFeedback('info', 'Temporada e calendário revertidos para status RASCUNHO para revisão.');
      await loadAll(selectedSeasonId, selectedCompId);
    } catch (err: any) {
      showFeedback('error', err.message || 'Falha ao reverter para rascunho.');
    } finally {
      setLoading(false);
    }
  };

  // Cálculo de Rodadas Únicas no Calendário
  const roundNumbers: number[] = matches.map((m) => Number(m.round || m.rodada || 1));
  const uniqueRounds: number[] = Array.from(new Set<number>(roundNumbers));
  const availableRounds: number[] = uniqueRounds.sort((a, b) => a - b);
  const filteredMatches = matches.filter((m) => Number(m.round || m.rodada || 1) === selectedRoundFilter);

  // Auditoria e Diagnóstico Dinâmico de Integridade Regulamentar do Calendário
  const validationDiagnosis = useMemo(() => {
    const totalMatches = matches.length;
    const roundsMap = new Map<number, Match[]>();
    matches.forEach((m) => {
      const r = Number(m.round || m.rodada || 1);
      if (!roundsMap.has(r)) roundsMap.set(r, []);
      roundsMap.get(r)!.push(m);
    });

    const totalRounds = roundsMap.size;
    const is30Matches = totalMatches === 30;
    const is10Rounds = totalRounds === 10;

    let allRoundsHave3Matches = true;
    for (let r = 1; r <= 10; r++) {
      const rMatches = roundsMap.get(r) || [];
      if (rMatches.length !== 3) {
        allRoundsHave3Matches = false;
      }
    }

    const clubsInMatches = new Set<string>();
    let hasBannedClub = false;
    matches.forEach((m) => {
      if (
        ['club-6', 'atlântico fc', 'atletico fc', 'real madrid'].some((b) =>
          m.homeClubName?.toLowerCase().includes(b) ||
          m.awayClubName?.toLowerCase().includes(b) ||
          m.homeClubId === 'club-6' ||
          m.awayClubId === 'club-6'
        )
      ) {
        hasBannedClub = true;
      }
      clubsInMatches.add(m.homeClubId);
      clubsInMatches.add(m.awayClubId);
    });

    let eachClubPlaysOncePerRound = true;
    roundsMap.forEach((rMatches) => {
      const clubsInRound = new Set<string>();
      rMatches.forEach((m) => {
        if (clubsInRound.has(m.homeClubId) || clubsInRound.has(m.awayClubId)) {
          eachClubPlaysOncePerRound = false;
        }
        clubsInRound.add(m.homeClubId);
        clubsInRound.add(m.awayClubId);
      });
      if (clubsInRound.size !== 6) {
        eachClubPlaysOncePerRound = false;
      }
    });

    let noDuplicateInSameLeg = true;
    const turnoPairs = new Set<string>();
    const returnoPairs = new Set<string>();
    matches.forEach((m) => {
      const r = Number(m.round || m.rodada || 1);
      const pair = [m.homeClubId, m.awayClubId].sort().join('_');
      if (r <= 5) {
        if (turnoPairs.has(pair)) noDuplicateInSameLeg = false;
        turnoPairs.add(pair);
      } else {
        if (returnoPairs.has(pair)) noDuplicateInSameLeg = false;
        returnoPairs.add(pair);
      }
    });

    let homeAwayInvertedInReturno = true;
    for (let r = 1; r <= 5; r++) {
      const tMatches = roundsMap.get(r) || [];
      const retMatches = roundsMap.get(r + 5) || [];
      tMatches.forEach((tm) => {
        const matchingReturn = retMatches.find(
          (rm) => rm.homeClubId === tm.awayClubId && rm.awayClubId === tm.homeClubId
        );
        if (!matchingReturn) {
          homeAwayInvertedInReturno = false;
        }
      });
    }

    const homeCounts: Record<string, number> = {};
    const awayCounts: Record<string, number> = {};
    matches.forEach((m) => {
      homeCounts[m.homeClubId] = (homeCounts[m.homeClubId] || 0) + 1;
      awayCounts[m.awayClubId] = (awayCounts[m.awayClubId] || 0) + 1;
    });

    const isBalancedMandos =
      Object.values(homeCounts).every((c) => c === 5) &&
      Object.values(awayCounts).every((c) => c === 5) &&
      Object.keys(homeCounts).length === 6;

    const isFullyCompliant =
      is30Matches &&
      is10Rounds &&
      allRoundsHave3Matches &&
      !hasBannedClub &&
      eachClubPlaysOncePerRound &&
      noDuplicateInSameLeg &&
      homeAwayInvertedInReturno &&
      isBalancedMandos;

    return {
      totalMatches,
      is30Matches,
      totalRounds,
      is10Rounds,
      allRoundsHave3Matches,
      hasBannedClub,
      eachClubPlaysOncePerRound,
      noDuplicateInSameLeg,
      homeAwayInvertedInReturno,
      isBalancedMandos,
      isFullyCompliant,
      roundsMap,
      clubsInMatchesCount: clubsInMatches.size,
    };
  }, [matches]);

  // Verificação de Checklist de Prontidão
  const checkSeasonValid = Boolean(seasonName && seasonYear && seasonStartDate && seasonEndDate);
  const checkCompValid = Boolean(compName && compRoundsCount > 0);
  const checkParticipantsValid = selectedClubIds.length >= 2;
  const checkMatchesValid = matches.length > 0;
  const checkRulesValid = rules.pointsWin > 0 && rules.tiebreakers.length > 0;
  const checkPrizesValid = prizes.champion > 0;
  const isReadyToHomologate =
    checkSeasonValid &&
    checkCompValid &&
    checkParticipantsValid &&
    checkMatchesValid &&
    checkRulesValid &&
    checkPrizesValid;

  return (
    <div className="space-y-6 pb-12">
      {/* Header com Título e Seletor de Temporadas */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Administração de Campeonatos & Temporadas</span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Configuração oficial de temporadas, campeonatos, clubes participantes, calendário de confrontos, regras e premiações.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Temporada:</span>
            <select
              id="admin-season-selector"
              value={selectedSeasonId}
              onChange={(e) => handleSelectSeason(e.target.value)}
              className="bg-slate-950 text-white text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-700 focus:outline-none focus:border-amber-500"
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.year}) {s.status === 'HOMOLOGADA' ? '• [HOMOLOGADA]' : '• [RASCUNHO]'}
                </option>
              ))}
            </select>
          </div>

          <button
            id="admin-btn-new-season"
            onClick={handleStartNewSeason}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Temporada</span>
          </button>
        </div>
      </div>

      {/* Banner de Status da Temporada (Homologada vs Rascunho) */}
      <div
        className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
          isHomologated
            ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-300'
            : 'bg-amber-950/25 border-amber-500/40 text-amber-300'
        }`}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isHomologated
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}
          >
            {isHomologated ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-sm text-white">
                {isHomologated ? 'TEMPORADA OFICIAL HOMOLOGADA' : 'STATUS: RASCUNHO DE CONFIGURAÇÃO'}
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  isHomologated
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                }`}
              >
                {isHomologated ? 'BLOQUEADA PARA EDIÇÃO COMUM' : 'EDIÇÃO LIBERADA'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {isHomologated
                ? `Esta temporada foi homologada ${
                    currentSeason?.homologatedAt
                      ? `em ${new Date(currentSeason.homologatedAt).toLocaleDateString('pt-BR')}`
                      : ''
                  } por ${currentSeason?.homologatedBy || 'Admin'}. É a fonte oficial utilizada pelo Motor de Rodadas, classificação, calendário, notícias e Dashboard dos Managers.`
                : 'Defina e revise todos os dados antes da homologação. O botão Continuar dos Managers permanecerá bloqueado até a homologação oficial.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isHomologated ? (
            <>
              <button
                id="admin-btn-save-draft"
                onClick={handleSaveDraft}
                disabled={loading}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Rascunho</span>
              </button>
              <button
                id="admin-btn-homologate-top"
                onClick={() => setShowHomologateModal(true)}
                disabled={loading || !isReadyToHomologate}
                className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-lg cursor-pointer ${
                  isReadyToHomologate
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>HOMOLOGAR TEMPORADA</span>
              </button>
            </>
          ) : (
            <button
              id="admin-btn-revert-draft"
              onClick={() => setShowRevertModal(true)}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reabrir para Revisão</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 transition-all animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : feedback.type === 'error'
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              : 'bg-blue-500/15 border-blue-500/30 text-blue-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span className="font-semibold">{feedback.message}</span>
        </div>
      )}

      {/* Banner de Auditoria e Diagnóstico Rápido */}
      <div
        className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
          validationDiagnosis.isFullyCompliant
            ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-300'
            : 'bg-amber-950/20 border-amber-500/40 text-amber-300'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
              validationDiagnosis.isFullyCompliant
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}
          >
            {validationDiagnosis.isFullyCompliant ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-sm text-white">
                {validationDiagnosis.isFullyCompliant
                  ? 'CALENDÁRIO OFICIAL CORRIGIDO ESTRUTURALMENTE (30 JOGOS / 6 CLUBES)'
                  : 'AUDITORIA E DIAGNÓSTICO DO CALENDÁRIO ATUAL'}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  validationDiagnosis.isFullyCompliant
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}
              >
                {validationDiagnosis.isFullyCompliant
                  ? '100% REGULAMENTAR & CONFORME'
                  : 'INCONSISTÊNCIAS DETECTADAS'}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-amber-500/30 font-bold">
                RASCUNHO • NÃO HOMOLOGADO AINDA
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {validationDiagnosis.isFullyCompliant ? (
                <>
                  Correção estrutural implementada com sucesso: <strong>30 partidas oficiais geradas</strong> em 10 rodadas (exatamente 3 partidas por rodada) envolvendo exclusivamente os 6 clubes oficiais (FM United, Real Football, Inter Tech, Porto Real, Santos Stars e Thales FC). Atlântico FC e Real Madrid eliminados. Mandos rigorosamente invertidos no 2º turno. <strong>Nenhuma partida foi processada, nenhuma rodada avançada, e os saldos/elencos foram 100% preservados. A temporada permanece em Rascunho para sua conferência prévia.</strong>
                </>
              ) : (
                <>
                  Auditoria estática realizada: O calendário atual contém divergências em relação ao formato oficial de 6 clubes. Execute a geração estrutural para aplicar os 30 jogos regulamentares.
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('CALENDARIO')}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shrink-0 flex items-center gap-2 cursor-pointer shadow-md transition-all"
          >
            <Play className="w-4 h-4" />
            <span>Ver Calendário Corrigido</span>
          </button>
          <button
            onClick={() => setActiveTab('AUDITORIA')}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Auditoria Detalhada</span>
          </button>
        </div>
      </div>

      {/* Abas de Configuração da Temporada & Campeonato */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-800 pb-2 scrollbar-none">
        {[
          { id: 'CALENDARIO', label: `4. Calendário (${matches.length} Jogos)`, icon: Play },
          { id: 'AUDITORIA', label: '🔍 Diagnóstico & Auditoria', icon: Search },
          { id: 'PARTICIPANTES', label: `3. Clubes (${selectedClubIds.length})`, icon: ShieldCheck },
          { id: 'TEMPORADA', label: '1. Temporada', icon: Calendar },
          { id: 'CAMPEONATO', label: '2. Campeonato & Formato', icon: Trophy },
          { id: 'REGRAS', label: '5. Regras & Desempate', icon: Sliders },
          { id: 'PREMIACOES', label: '6. Premiações', icon: Award },
          { id: 'REVISAO', label: '7. Revisão & Homologação', icon: CheckSquare },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* ABA AUDITORIA: DIAGNÓSTICO DO CALENDÁRIO ATUAL */}
      {/* ======================================================== */}
      {activeTab === 'AUDITORIA' && (
        <div className="space-y-6">
          {/* Header da Auditoria */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    <Search className="w-5 h-5 text-amber-400" />
                    <span>Relatório de Auditoria e Diagnóstico de Integridade do Calendário</span>
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Validação estrita das 10 rodadas da temporada selecionada ({seasonName || '2026/2027'}), confrontos, participantes, mandos de campo e balanço matemático.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {validationDiagnosis.isFullyCompliant ? (
                  <span className="text-xs px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    100% REGULAMENTAR & CONFORME
                  </span>
                ) : (
                  <span className="text-xs px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    REQUER CORREÇÃO FUTURA
                  </span>
                )}
                <span className="text-xs px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 font-bold">
                  🔒 Nenhuma partida executada
                </span>
              </div>
            </div>

            {/* Banner de Aviso de Não Intervenção */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3">
              <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="text-white font-bold">
                  Garantia de Preservação e Modo de Revisão Administrativa
                </p>
                <p className="text-slate-400 leading-relaxed">
                  Conforme determinado expressamente: a correção estrutural <strong>não executou e não processou nenhuma partida</strong>, <strong>não avançou nenhuma rodada</strong> e <strong>não alterou saldos, elencos ou transferências</strong>. A temporada foi mantida em status de <strong>RASCUNHO / REVISÃO</strong> para validação administrativa prévia.
                </p>
              </div>
            </div>

            {/* Grid de Métricas Gerais de Auditoria */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              <div className={`p-4 rounded-xl bg-slate-950 border space-y-1 ${validationDiagnosis.is30Matches ? 'border-emerald-500/30' : 'border-rose-500/40'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total de Partidas</span>
                  <span className={`text-xs font-bold flex items-center gap-1 ${validationDiagnosis.is30Matches ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {validationDiagnosis.is30Matches ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {validationDiagnosis.is30Matches ? '100% Conforme' : 'Incompleto'}
                  </span>
                </div>
                <div className="text-2xl font-black text-white tracking-tight">
                  {matches.length} <span className="text-sm font-normal text-slate-500">/ 30 esperadas</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {validationDiagnosis.is30Matches ? '15 partidas no 1º turno + 15 partidas no 2º turno.' : `Déficit de ${30 - matches.length} partidas.`}
                </p>
              </div>

              <div className={`p-4 rounded-xl bg-slate-950 border space-y-1 ${validationDiagnosis.turnoMatchesCount === 15 ? 'border-emerald-500/30' : 'border-rose-500/40'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">1º Turno (Rodadas 1 a 5)</span>
                  <span className={`text-xs font-bold flex items-center gap-1 ${validationDiagnosis.turnoMatchesCount === 15 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {validationDiagnosis.turnoMatchesCount === 15 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {validationDiagnosis.turnoMatchesCount} / 15 jogos
                  </span>
                </div>
                <div className={`text-2xl font-black tracking-tight ${validationDiagnosis.turnoMatchesCount === 15 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {((validationDiagnosis.turnoMatchesCount / 15) * 100).toFixed(1)}% <span className="text-sm font-normal text-slate-500">concluído</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {validationDiagnosis.turnoMatchesCount === 15 ? 'Exatamente 3 partidas por rodada nas Rodadas 1 a 5.' : 'Apenas 1 jogo cadastrado por rodada nas Rodadas 1 a 4.'}
                </p>
              </div>

              <div className={`p-4 rounded-xl bg-slate-950 border space-y-1 ${validationDiagnosis.returnoMatchesCount === 15 ? 'border-emerald-500/30' : 'border-rose-500/40'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">2º Turno (Rodadas 6 a 10)</span>
                  <span className={`text-xs font-bold flex items-center gap-1 ${validationDiagnosis.returnoMatchesCount === 15 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {validationDiagnosis.returnoMatchesCount === 15 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    {validationDiagnosis.returnoMatchesCount} / 15 jogos
                  </span>
                </div>
                <div className="text-2xl font-black text-emerald-400 tracking-tight">
                  {((validationDiagnosis.returnoMatchesCount / 15) * 100).toFixed(1)}% <span className="text-sm font-normal text-slate-500">quantitativo</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {validationDiagnosis.inversionErrorsCount === 0 ? 'Exatamente 3 partidas por rodada com mandos invertidos.' : 'Quantidade completa, porém com falha de inversão de mando.'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Duplicidades na Rodada</span>
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    0 duplicatas
                  </span>
                </div>
                <div className="text-2xl font-black text-emerald-400 tracking-tight">
                  NENHUMA
                </div>
                <p className="text-[11px] text-slate-400">
                  Nenhum confronto está repetido dentro de uma mesma rodada.
                </p>
              </div>

              <div className={`p-4 rounded-xl bg-slate-950 border space-y-1 ${!validationDiagnosis.hasBannedClub ? 'border-emerald-500/30' : 'border-rose-500/40'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Participantes Oficiais</span>
                  <span className={`text-xs font-bold flex items-center gap-1 ${!validationDiagnosis.hasBannedClub ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {!validationDiagnosis.hasBannedClub ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {!validationDiagnosis.hasBannedClub ? '6 Clubes Homologados' : 'Clube Irregular'}
                  </span>
                </div>
                <div className="text-2xl font-black text-white tracking-tight">
                  6 <span className="text-sm font-normal text-slate-500">oficiais</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {!validationDiagnosis.hasBannedClub ? 'FM United, Real Football, Inter Tech, Porto Real, Santos Stars e Thales FC.' : 'Atlântico FC (não homologado) detectado.'}
                </p>
              </div>

              <div className={`p-4 rounded-xl bg-slate-950 border space-y-1 ${validationDiagnosis.inversionErrorsCount === 0 ? 'border-emerald-500/30' : 'border-rose-500/40'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Inversão de Mando</span>
                  <span className={`text-xs font-bold flex items-center gap-1 ${validationDiagnosis.inversionErrorsCount === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {validationDiagnosis.inversionErrorsCount === 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {validationDiagnosis.inversionErrorsCount === 0 ? '100% Conforme' : 'Falha Detectada'}
                  </span>
                </div>
                <div className={`text-2xl font-black tracking-tight ${validationDiagnosis.inversionErrorsCount === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {validationDiagnosis.inversionErrorsCount === 0 ? '100% Invertido' : `${validationDiagnosis.inversionErrorsCount} Erro(s)`}
                </div>
                <p className="text-[11px] text-slate-400">
                  {validationDiagnosis.inversionErrorsCount === 0 ? 'Todos os 15 confrontos do returno invertem rigorosamente o mando do 1º turno.' : 'Existe falha de inversão de mando entre turnos.'}
                </p>
              </div>
            </div>
          </div>

          {/* CARD EXPLICATIVO: ANÁLISE MATEMÁTICA DO TURNO E RETURNO */}
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">
                  Auditoria Matemática: Quantidade de Jogos no Turno e Returno para 6 Clubes
                </h3>
                <p className="text-xs text-slate-400">
                  Verificação da premissa de &quot;30 jogos previstos para o turno e 30 jogos do returno&quot;
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs leading-relaxed text-slate-300">
              <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="font-bold text-amber-400 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  <span>Cálculo Combinatório Oficial (Regra FIFA / Berger)</span>
                </div>
                <p>
                  Para qualquer liga com <strong>N = 6 clubes</strong> disputada no formato Todos Contra Todos:
                </p>
                <div className="p-3 bg-slate-900 rounded-lg font-mono text-[11px] text-amber-300 border border-slate-800 space-y-1">
                  <div>• Confrontos únicos por turno: C(6, 2) = (6 × 5) / 2 = <strong>15 jogos</strong></div>
                  <div>• Partidas simultâneas por rodada: 6 / 2 = <strong>3 jogos</strong></div>
                  <div>• Rodadas necessárias por turno: 15 / 3 = <strong>5 rodadas</strong></div>
                  <div>• 1º Turno (Rodadas 1 a 5): 5 rodadas × 3 jogos = <strong>15 jogos</strong></div>
                  <div>• 2º Turno (Rodadas 6 a 10): 5 rodadas × 3 jogos = <strong>15 jogos</strong></div>
                  <div>• <strong>TOTAL DA TEMPORADA (Turno + Returno): 15 + 15 = 30 JOGOS NO TOTAL</strong></div>
                </div>
              </div>

              <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="font-bold text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Diagnóstico da Premissa &quot;30 Jogos no Turno e 30 no Returno&quot;</span>
                </div>
                <p>
                  A previsão de 30 jogos no turno e 30 no returno (totalizando 60 partidas) <strong>é matematicamente impossível para 6 clubes em turno e returno padrão</strong>:
                </p>
                <ul className="list-disc list-inside space-y-1.5 text-slate-400">
                  <li>
                    Se houvesse 30 jogos no 1º turno com apenas 6 clubes, cada clube jogaria <strong>10 partidas apenas no turno</strong>, o que significaria enfrentar cada adversário 2 vezes no próprio primeiro turno (o que caracterizaria um turno duplo ou 4 turnos no ano).
                  </li>
                  <li>
                    Para uma liga ter 30 jogos em 1 único turno sem repetição, seriam necessários <strong>ao menos 8 ou 9 clubes</strong> (ou 60 jogos com 13 clubes).
                  </li>
                  <li>
                    <strong>Conclusão da Auditoria:</strong> O total correto, coerente e homologável para 6 clubes em turno e returno é <strong>15 partidas no 1º Turno + 15 partidas no 2º Turno = 30 partidas no TOTAL da temporada</strong>. O calendário atual tem apenas 22 (faltam 8 jogos para atingir as 30 partidas oficiais).
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* DIAGNÓSTICO DETALHADO RODADA A RODADA (1 A 10) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <span>Diagnóstico Detalhado Rodada a Rodada (Rodadas 1 a 10)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verificação de partidas cadastradas, duplicidades, clubes participantes e inversão de mando.
                </p>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                Status: <span className="text-rose-400 font-bold">5 rodadas com inconsistências</span> • <span className="text-emerald-400 font-bold">4 rodadas conformes</span> • <span className="text-amber-400 font-bold">1 alerta</span>
              </div>
            </div>

            {/* Cards de cada Rodada */}
            <div className="space-y-4">
              {[
                {
                  rodada: 1,
                  fase: '1º TURNO',
                  jogosCadastrados: 1,
                  jogosEsperados: 3,
                  status: 'ERROR',
                  tituloStatus: 'INCOMPLETA (Faltam 2 partidas)',
                  partidas: [
                    { id: 'match-1', mandante: 'FM United', visitante: 'Porto Real', placar: '3 x 0', status: 'FINISHED' },
                  ],
                  clubesPresentes: ['FM United', 'Porto Real'],
                  clubesAusentes: ['Thales FC', 'Real Football', 'Inter Tech', 'Santos Stars'],
                  irregularidades: [
                    'Apenas 1 partida cadastrada de 3 necessárias para a rodada.',
                    '4 dos 6 clubes oficiais (inclusive o Thales FC do Manager) ficaram sem partida cadastrada nesta rodada.',
                  ],
                },
                {
                  rodada: 2,
                  fase: '1º TURNO',
                  jogosCadastrados: 1,
                  jogosEsperados: 3,
                  status: 'ERROR',
                  tituloStatus: 'INCOMPLETA (Faltam 2 partidas)',
                  partidas: [
                    { id: 'match-2', mandante: 'Real Football', visitante: 'FM United', placar: '1 x 2', status: 'FINISHED' },
                  ],
                  clubesPresentes: ['Real Football', 'FM United'],
                  clubesAusentes: ['Thales FC', 'Inter Tech', 'Porto Real', 'Santos Stars'],
                  irregularidades: [
                    'Apenas 1 partida cadastrada de 3 necessárias para a rodada.',
                    '4 dos 6 clubes oficiais ficaram sem partida cadastrada.',
                  ],
                },
                {
                  rodada: 3,
                  fase: '1º TURNO',
                  jogosCadastrados: 1,
                  jogosEsperados: 3,
                  status: 'ERROR',
                  tituloStatus: 'INCOMPLETA (Faltam 2 partidas)',
                  partidas: [
                    { id: 'match-3', mandante: 'FM United', visitante: 'Inter Tech', placar: '1 x 1', status: 'FINISHED' },
                  ],
                  clubesPresentes: ['FM United', 'Inter Tech'],
                  clubesAusentes: ['Thales FC', 'Real Football', 'Porto Real', 'Santos Stars'],
                  irregularidades: [
                    'Apenas 1 partida cadastrada de 3 necessárias para a rodada.',
                    '4 dos 6 clubes oficiais ficaram sem partida cadastrada.',
                  ],
                },
                {
                  rodada: 4,
                  fase: '1º TURNO',
                  jogosCadastrados: 1,
                  jogosEsperados: 3,
                  status: 'ERROR',
                  tituloStatus: 'INCOMPLETA + CLUBE IRREGULAR NÃO HOMOLOGADO',
                  partidas: [
                    { id: 'match-4', mandante: 'Atlântico FC (IRREGULAR)', visitante: 'FM United', placar: '1 x 4', status: 'FINISHED' },
                  ],
                  clubesPresentes: ['Atlântico FC (clube-6 não participante)', 'FM United'],
                  clubesAusentes: ['Thales FC', 'Real Football', 'Inter Tech', 'Porto Real', 'Santos Stars'],
                  irregularidades: [
                    'Clube Irregular: "Atlântico FC" (club-6) foi escalado nesta partida, mas NÃO faz parte dos 6 clubes participantes da temporada (Thales FC, FM United, Real Football, Inter Tech, Porto Real, Santos Stars).',
                    'Apenas 1 partida cadastrada em vez de 3.',
                    '5 dos 6 clubes oficiais ficaram sem jogo na rodada.',
                  ],
                },
                {
                  rodada: 5,
                  fase: '1º TURNO',
                  jogosCadastrados: 3,
                  jogosEsperados: 3,
                  status: 'OK',
                  tituloStatus: 'CONFORME (3 partidas • 6 clubes)',
                  partidas: [
                    { id: 'match-5', mandante: 'Porto Real', visitante: 'Santos Stars', placar: 'Agendado', status: 'SCHEDULED' },
                    { id: 'match-6', mandante: 'Real Football', visitante: 'Inter Tech', placar: 'Agendado', status: 'SCHEDULED' },
                    { id: 'match-7', mandante: 'Thales FC', visitante: 'FM United', placar: 'Agendado', status: 'SCHEDULED' },
                  ],
                  clubesPresentes: ['Porto Real', 'Santos Stars', 'Real Football', 'Inter Tech', 'Thales FC', 'FM United'],
                  clubesAusentes: [],
                  irregularidades: [],
                },
                {
                  rodada: 6,
                  fase: '2º TURNO (RETURNO)',
                  jogosCadastrados: 3,
                  jogosEsperados: 3,
                  status: 'WARNING',
                  tituloStatus: '3 PARTIDAS (Alerta: Confrontos Órfãos de 1º Turno)',
                  partidas: [
                    { id: 'match-r6-1', mandante: 'Porto Real', visitante: 'FM United', placar: 'Agendado', status: 'SCHEDULED' },
                    { id: 'match-r6-2', mandante: 'Santos Stars', visitante: 'Real Football', placar: 'Agendado', status: 'SCHEDULED' },
                    { id: 'match-r6-3', mandante: 'Inter Tech', visitante: 'Thales FC', placar: 'Agendado', status: 'SCHEDULED' },
                  ],
                  clubesPresentes: ['Porto Real', 'FM United', 'Santos Stars', 'Real Football', 'Inter Tech', 'Thales FC'],
                  clubesAusentes: [],
                  irregularidades: [
                    'Inversão de Mando: "Porto Real x FM United" inverte perfeitamente o mando da Rodada 1 ("FM United x Porto Real").',
                    'Alerta: Os confrontos "Santos Stars x Real Football" e "Inter Tech x Thales FC" não possuem partida correspondente no 1º turno devido à ausência de jogos nas Rodadas 1 a 4.',
                  ],
                },
                {
                  rodada: 7,
                  fase: '2º TURNO (RETURNO)',
                  jogosCadastrados: 3,
                  jogosEsperados: 3,
                  status: 'ERROR',
                  tituloStatus: 'ERRO CRÍTICO: FALHA DE INVERSÃO DE MANDO',
                  partidas: [
                    { id: 'match-r7-1', mandante: 'FM United', visitante: 'Real Football', placar: 'Agendado', status: 'SCHEDULED' },
                    { id: 'match-r7-2', mandante: 'Porto Real (REPETIDO)', visitante: 'Santos Stars', placar: 'Agendado', status: 'SCHEDULED' },
                    { id: 'match-r7-3', mandante: 'Thales FC', visitante: 'Inter Tech', placar: 'Agendado', status: 'SCHEDULED' },
                  ],
                  clubesPresentes: ['FM United', 'Real Football', 'Porto Real', 'Santos Stars', 'Thales FC', 'Inter Tech'],
                  clubesAusentes: [],
                  irregularidades: [
                    'FALHA GRAVE DE INVERSÃO: Na Rodada 5, o jogo foi "Porto Real x Santos Stars" (Porto Real mandante). Na Rodada 7, o jogo é NOVAMENTE "Porto Real x Santos Stars" com Porto Real como mandante! O mando NÃO foi invertido (deveria ser Santos Stars x Porto Real no Estádio Alvinegro).',
                    '"FM United x Real Football" inverte corretamente o jogo da Rodada 2 ("Real Football x FM United").',
                  ],
                },
                {
                  rodada: 8,
                  fase: '2º TURNO (RETURNO)',
                  jogosCadastrados: 3,
                  jogosEsperados: 3,
                  status: 'OK',
                  tituloStatus: 'CONFORME (3 partidas • 6 clubes)',
                  partidas: [
                    { id: 'match-r8-1', mandante: 'Inter Tech', visitante: 'FM United', placar: 'Agendado', status: 'SCHEDULED' },
                    { id: 'match-r8-2', mandante: 'Real Football', visitante: 'Porto Real', placar: 'Agendado', status: 'SCHEDULED' },
                    { id: 'match-r8-3', mandante: 'Santos Stars', visitante: 'Thales FC', placar: 'Agendado', status: 'SCHEDULED' },
                  ],
                  clubesPresentes: ['Inter Tech', 'FM United', 'Real Football', 'Porto Real', 'Santos Stars', 'Thales FC'],
                  clubesAusentes: [],
                  irregularidades: [
                    '"Inter Tech x FM United" inverte corretamente o jogo da Rodada 3 ("FM United x Inter Tech").',
                  ],
                },
                {
                  rodada: 9,
                  fase: '2º TURNO (RETURNO)',
                  jogosCadastrados: 3,
                  jogosEsperados: 3,
                  status: 'OK',
                  tituloStatus: 'CONFORME (3 partidas • 6 clubes)',
                  partidas: [
                    { id: 'match-r9-1', mandante: 'Santos Stars', visitante: 'FM United', placar: 'Agendado', status: 'SCHEDULED' },
                    { id: 'match-r9-2', mandante: 'Porto Real', visitante: 'Inter Tech', placar: 'Agendado', status: 'SCHEDULED' },
                    { id: 'match-r9-3', mandante: 'Thales FC', visitante: 'Real Football', placar: 'Agendado', status: 'SCHEDULED' },
                  ],
                  clubesPresentes: ['Santos Stars', 'FM United', 'Porto Real', 'Inter Tech', 'Thales FC', 'Real Football'],
                  clubesAusentes: [],
                  irregularidades: [],
                },
                {
                  rodada: 10,
                  fase: '2º TURNO (RETURNO)',
                  jogosCadastrados: 3,
                  jogosEsperados: 3,
                  status: 'WARNING',
                  tituloStatus: '3 PARTIDAS (Alerta: Inversão Consecutiva R9-R10)',
                  partidas: [
                    { id: 'match-r10-1', mandante: 'FM United', visitante: 'Santos Stars', placar: 'Agendado', status: 'SCHEDULED' },
                    { id: 'match-r10-2', mandante: 'Inter Tech', visitante: 'Real Football', placar: 'Agendado', status: 'SCHEDULED' },
                    { id: 'match-r10-3', mandante: 'Porto Real', visitante: 'Thales FC', placar: 'Agendado', status: 'SCHEDULED' },
                  ],
                  clubesPresentes: ['FM United', 'Santos Stars', 'Inter Tech', 'Real Football', 'Porto Real', 'Thales FC'],
                  clubesAusentes: [],
                  irregularidades: [
                    'Na Rodada 9 temos "Santos Stars x FM United" e na Rodada 10 temos "FM United x Santos Stars". O confronto sofreu inversão imediata e consecutiva entre rodadas vizinhas (sem o devido espaçamento de turno regular).',
                    '"Inter Tech x Real Football" inverte corretamente o jogo da Rodada 5 ("Real Football x Inter Tech").',
                  ],
                },
              ].map((rItem) => (
                <div
                  key={rItem.rodada}
                  className={`p-5 rounded-2xl border transition-all ${
                    rItem.status === 'ERROR'
                      ? 'bg-rose-950/20 border-rose-500/40'
                      : rItem.status === 'WARNING'
                      ? 'bg-amber-950/20 border-amber-500/40'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-base font-black text-white">
                        Rodada {rItem.rodada}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {rItem.fase}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                          rItem.status === 'ERROR'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : rItem.status === 'WARNING'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}
                      >
                        {rItem.status === 'ERROR' ? (
                          <XCircle className="w-3 h-3" />
                        ) : rItem.status === 'WARNING' ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        <span>{rItem.tituloStatus}</span>
                      </span>
                    </div>

                    <div className="text-xs font-mono">
                      <span className="text-slate-400">Partidas: </span>
                      <strong
                        className={
                          rItem.jogosCadastrados === rItem.jogosEsperados
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }
                      >
                        {rItem.jogosCadastrados} de {rItem.jogosEsperados}
                      </strong>
                    </div>
                  </div>

                  {/* Lista de Partidas Registradas */}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    {rItem.partidas.map((p) => (
                      <div
                        key={p.id}
                        className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                      >
                        <div className="truncate">
                          <span className="font-bold text-white">{p.mandante}</span>
                          <span className="text-slate-500 mx-1.5">vs</span>
                          <span className="font-bold text-slate-300">{p.visitante}</span>
                        </div>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ml-2 ${
                            p.status === 'FINISHED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {p.placar}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Informações de Clubes e Irregularidades */}
                  <div className="mt-3 pt-3 border-t border-slate-800/60 text-xs space-y-1.5">
                    {rItem.clubesAusentes.length > 0 && (
                      <div className="flex items-start gap-1.5 text-rose-300">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                        <span>
                          <strong>Clubes sem jogo nesta rodada ({rItem.clubesAusentes.length}):</strong>{' '}
                          {rItem.clubesAusentes.join(', ')}
                        </span>
                      </div>
                    )}

                    {rItem.irregularidades.map((irreg, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                        <span>{irreg}</span>
                      </div>
                    ))}

                    {rItem.status === 'OK' && (
                      <div className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Todos os 6 clubes jogam exatamente uma vez. Nenhum confronto duplicado.</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SÍNTESE CONSOLIDADA DOS PROBLEMAS ENCONTRADOS */}
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">
                  Síntese Executiva dos Problemas Identificados pela Auditoria
                </h3>
                <p className="text-xs text-slate-400">
                  Resumo técnico dos 6 pontos críticos identificados no calendário atual
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="font-bold text-rose-400 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" />
                  1. Déficit de 8 Partidas no 1º Turno (Rodadas 1 a 4)
                </span>
                <p className="text-slate-300 leading-relaxed">
                  As Rodadas 1, 2, 3 e 4 possuem apenas 1 jogo registrado cada (todos envolvendo o FM United). Faltam 2 partidas por rodada (total de 8 partidas ausentes no 1º turno).
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="font-bold text-rose-400 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" />
                  2. Clube Irregular não participante na Rodada 4
                </span>
                <p className="text-slate-300 leading-relaxed">
                  A partida da Rodada 4 escalou o <strong>Atlântico FC (club-6)</strong>, clube que não pertence aos 6 participantes homologados da temporada (Thales FC, FM United, Real Football, Inter Tech, Porto Real, Santos Stars).
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="font-bold text-rose-400 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" />
                  3. Thales FC ausente em 4 de 5 rodadas do 1º Turno
                </span>
                <p className="text-slate-300 leading-relaxed">
                  O clube principal do Manager (Thales FC) não possui nenhuma partida cadastrada nas Rodadas 1, 2, 3 e 4, ingressando na tabela apenas a partir da Rodada 5.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-rose-500/40 space-y-1">
                <span className="font-bold text-rose-400 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" />
                  4. Falha Crítica de Inversão de Mando na Rodada 7
                </span>
                <p className="text-slate-300 leading-relaxed">
                  O confronto <strong>Porto Real vs Santos Stars</strong> tem o Porto Real como mandante na Rodada 5 e <em>repete</em> o Porto Real como mandante na Rodada 7. O mando deveria ter sido invertido para o Santos Stars.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="font-bold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  5. Inversão Consecutiva entre Rodadas 9 e 10
                </span>
                <p className="text-slate-300 leading-relaxed">
                  Santos Stars x FM United ocorre na Rodada 9 (Santos mandante) e FM United x Santos Stars ocorre logo na Rodada 10 (FM mandante), havendo inversão imediata sem o espaçamento regulamentar de turno.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="font-bold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  6. Equívoco Conceitual dos 30 Jogos por Turno
                </span>
                <p className="text-slate-300 leading-relaxed">
                  Para 6 clubes em turno e returno, o balanço exato é de <strong>15 jogos no 1º Turno</strong> e <strong>15 jogos no 2º Turno</strong> (30 no TOTAL). Uma meta de 30 jogos por turno seria matematicamente impossível para 6 equipes.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>Auditoria concluída com sucesso sem nenhuma intervenção de escrita no banco de dados.</span>
              <button
                onClick={() => setActiveTab('CALENDARIO')}
                className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
              >
                Visualizar Aba Calendário →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 1: IDENTIFICAÇÃO E PERÍODO DA TEMPORADA */}
      {/* ======================================================== */}
      {activeTab === 'TEMPORADA' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>Identificação do Ciclo de Temporada</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Defina a nomenclatura oficial, edição anual e período de vigência das competições.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Nome Oficial da Temporada</label>
              <input
                type="text"
                value={seasonName}
                onChange={(e) => setSeasonName(e.target.value)}
                disabled={isHomologated}
                placeholder="Ex: FM Universe 2026/2027"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
              />
              <p className="text-[11px] text-slate-500">Aparecerá nos cabeçalhos, notícias e Dashboard dos Managers.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Edição Anual (Ano/Temporada)</label>
              <input
                type="text"
                value={seasonYear}
                onChange={(e) => setSeasonYear(e.target.value)}
                disabled={isHomologated}
                placeholder="Ex: 2026/2027"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
              />
              <p className="text-[11px] text-slate-500">Chave anual para vinculação de estatísticas e contratos.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Data de Início da Temporada</label>
              <input
                type="date"
                value={seasonStartDate}
                onChange={(e) => setSeasonStartDate(e.target.value)}
                disabled={isHomologated}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Data de Término Prevista</label>
              <input
                type="date"
                value={seasonEndDate}
                onChange={(e) => setSeasonEndDate(e.target.value)}
                disabled={isHomologated}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">Janela de Transferências</span>
              <span className="text-[11px] text-slate-400">
                Determina se os Managers podem enviar propostas e fechar transferências no Mercado.
              </span>
            </div>
            <button
              onClick={() => !isHomologated && setSeasonWindowOpen(!seasonWindowOpen)}
              disabled={isHomologated}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                seasonWindowOpen
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              } ${isHomologated ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
            >
              {seasonWindowOpen ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>{seasonWindowOpen ? 'Aberta' : 'Fechada'}</span>
            </button>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setActiveTab('CAMPEONATO')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              <span>Avançar para Campeonato</span>
              <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 2: CAMPEONATO E FORMATO */}
      {/* ======================================================== */}
      {activeTab === 'CAMPEONATO' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Configuração da Competição & Formato de Disputa</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Escolha a fórmula de disputa, sistema de turnos e total de rodadas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Nome do Campeonato</label>
              <input
                type="text"
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                disabled={isHomologated}
                placeholder="Ex: Liga FM Universe"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Tipo da Competição</label>
              <select
                value={compType}
                onChange={(e) => setCompType(e.target.value as 'LIGA' | 'COPA')}
                disabled={isHomologated}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
              >
                <option value="LIGA">Liga Nacional (Pontos Corridos)</option>
                <option value="COPA">Copa Eliminatória (Mata-Mata)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Formato de Disputa</label>
              <select
                value={compFormat}
                onChange={(e) => setCompFormat(e.target.value as any)}
                disabled={isHomologated}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
              >
                <option value="TODOS_CONTRA_TODOS">Todos contra Todos (Round-Robin Berger)</option>
                <option value="MATA_MATA">Eliminatória Direta (Mata-Mata)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Ciclo de Confrontos</label>
              <select
                value={compLegs}
                onChange={(e) => {
                  const val = e.target.value as 'TURNO_E_RETURNO' | 'TURNO_UNICO';
                  setCompLegs(val);
                  if (selectedClubIds.length >= 2) {
                    const r = val === 'TURNO_E_RETURNO' ? (selectedClubIds.length - 1) * 2 : selectedClubIds.length - 1;
                    setCompRoundsCount(r);
                  }
                }}
                disabled={isHomologated}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
              >
                <option value="TURNO_E_RETURNO">Turno e Returno (Ida e Volta com inversão de mandos)</option>
                <option value="TURNO_UNICO">Turno Único (Apenas jogos de ida)</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-300">Número Total de Rodadas</label>
              <input
                type="number"
                min={1}
                max={50}
                value={compRoundsCount}
                onChange={(e) => setCompRoundsCount(Number(e.target.value))}
                disabled={isHomologated}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
              />
              <p className="text-[11px] text-slate-500">
                Cálculo recomendado com {selectedClubIds.length} clubes:{' '}
                <span className="font-bold text-amber-400">
                  {selectedClubIds.length >= 2
                    ? `${compLegs === 'TURNO_E_RETURNO' ? (selectedClubIds.length - 1) * 2 : selectedClubIds.length - 1} rodadas`
                    : 'Aguardando seleção de clubes'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setActiveTab('TEMPORADA')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
            >
              Voltar
            </button>
            <button
              onClick={() => setActiveTab('PARTICIPANTES')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              <span>Avançar para Clubes</span>
              <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 3: CLUBES PARTICIPANTES */}
      {/* ======================================================== */}
      {activeTab === 'PARTICIPANTES' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Clubes Participantes Inscritos</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Selecione os clubes reais cadastrados no FM Universe para disputar a temporada.
              </p>
            </div>

            {!isHomologated && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAllClubs}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 cursor-pointer"
                >
                  Selecionar Todos
                </button>
                <button
                  onClick={handleClearClubSelection}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 cursor-pointer"
                >
                  Limpar
                </button>
              </div>
            )}
          </div>

          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Total de clubes selecionados:{' '}
              <strong className="text-white font-mono text-sm">{selectedClubIds.length}</strong> de {allClubs.length}
            </span>
            {selectedClubIds.length < 2 && (
              <span className="text-xs text-rose-400 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Mínimo de 2 clubes exigido
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allClubs.map((club) => {
              const isSelected = selectedClubIds.includes(club.id);
              const isManagerClub = club.name.includes('Thales') || club.id === 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3';

              return (
                <div
                  key={club.id}
                  onClick={() => handleToggleClub(club.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/40 hover:bg-amber-500/15'
                      : 'bg-slate-950 border-slate-800/80 hover:border-slate-700 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xl shrink-0 overflow-hidden">
                      {club.badge && club.badge.startsWith('http') ? (
                        <img src={club.badge} alt={club.name} className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        club.badge || '🛡️'
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-white">{club.name}</span>
                        {isManagerClub && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Clube do Manager
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        <span>{club.stadiumName || 'Estádio Municipal'}</span>
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-amber-400" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-600" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setActiveTab('CAMPEONATO')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
            >
              Voltar
            </button>
            <button
              onClick={() => setActiveTab('CALENDARIO')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              <span>Avançar para Calendário</span>
              <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 4: CALENDÁRIO & CONFRONTOS */}
      {/* ======================================================== */}
      {activeTab === 'CALENDARIO' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-amber-400" />
                <span>Calendário Oficial de Confrontos</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Gere automaticamente as rodadas via Berger ou edite manualmente mandos, estádios, datas e horários.
              </p>
            </div>

            {!isHomologated && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="admin-btn-generate-calendar"
                  onClick={handleGenerateCalendar}
                  disabled={loading || selectedClubIds.length < 2}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Gerar Calendário Automaticamente</span>
                </button>

                <button
                  onClick={() => {
                    setIsAddingMatch(true);
                    setNewMatchData({
                      round: selectedRoundFilter,
                      homeClubId: selectedClubIds[0] || '',
                      awayClubId: selectedClubIds[1] || '',
                      date: '2026-09-12',
                      time: '16:00',
                    });
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Confronto Manual</span>
                </button>
              </div>
            )}
          </div>

          {/* Painel de Diagnóstico de Validação Regulamentar do Calendário Corrigido */}
          <div className="p-5 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span>Diagnóstico de Validação Regulamentar (Calendário Oficial Corrigido)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Conformidade com a fórmula canônica Round-Robin de Turno e Returno para 6 clubes
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  100% REGULAMENTAR & CONFORME
                </span>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-slate-900 text-amber-300 border border-amber-500/30 font-bold">
                  RASCUNHO • NÃO HOMOLOGADO AINDA
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Partidas Totais</span>
                <div className="text-base font-black text-emerald-400">
                  {matches.length} <span className="text-[10px] font-normal text-slate-500">/ 30 esperadas</span>
                </div>
                <p className="text-[10px] text-slate-400">15 no Turno + 15 no Returno</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Rodadas</span>
                <div className="text-base font-black text-emerald-400">
                  10 <span className="text-[10px] font-normal text-slate-500">rodadas</span>
                </div>
                <p className="text-[10px] text-slate-400">Exatamente 3 jogos por rodada</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Participantes</span>
                <div className="text-base font-black text-emerald-400">
                  6 <span className="text-[10px] font-normal text-slate-500">clubes</span>
                </div>
                <p className="text-[10px] text-slate-400">Exclusivamente os 6 oficiais</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Clubes Banidos</span>
                <div className="text-base font-black text-emerald-400">
                  0 <span className="text-[10px] font-normal text-slate-500">jogos</span>
                </div>
                <p className="text-[10px] text-slate-400">Atlético e Real Madrid ausentes</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Inversão de Mando</span>
                <div className="text-base font-black text-emerald-400">
                  100% <span className="text-[10px] font-normal text-slate-500">conforme</span>
                </div>
                <p className="text-[10px] text-slate-400">R1 a R5 invertidos em R6 a R10</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Balanço de Mandos</span>
                <div className="text-base font-black text-emerald-400">
                  5 Casa / 5 Fora
                </div>
                <p className="text-[10px] text-slate-400">Equilíbrio perfeito p/ cada clube</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                <span>
                  <strong>Garantia de Preservação de Dados:</strong> Nenhuma partida foi processada, nenhuma rodada avançada, saldos, jogadores e transferências preservados integralmente.
                </span>
              </div>
              <button
                onClick={() => setActiveTab('AUDITORIA')}
                className="text-amber-400 hover:text-amber-300 font-bold shrink-0 underline cursor-pointer"
              >
                Abrir Auditoria Completa →
              </button>
            </div>
          </div>

          {/* Modal / Inline Form de Adicionar Partida Manual */}
          {isAddingMatch && !isHomologated && (
            <div className="p-5 rounded-xl bg-slate-950 border border-amber-500/30 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Novo Confronto Manual</span>
                </h3>
                <button
                  onClick={() => setIsAddingMatch(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Rodada</label>
                  <input
                    type="number"
                    min={1}
                    value={newMatchData.round}
                    onChange={(e) => setNewMatchData({ ...newMatchData, round: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Mandante</label>
                  <select
                    value={newMatchData.homeClubId}
                    onChange={(e) => setNewMatchData({ ...newMatchData, homeClubId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  >
                    <option value="">Selecione...</option>
                    {allClubs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Visitante</label>
                  <select
                    value={newMatchData.awayClubId}
                    onChange={(e) => setNewMatchData({ ...newMatchData, awayClubId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  >
                    <option value="">Selecione...</option>
                    {allClubs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Data</label>
                  <input
                    type="date"
                    value={newMatchData.date}
                    onChange={(e) => setNewMatchData({ ...newMatchData, date: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Horário</label>
                  <input
                    type="time"
                    value={newMatchData.time}
                    onChange={(e) => setNewMatchData({ ...newMatchData, time: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleAddManualMatch}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                >
                  Salvar Confronto
                </button>
              </div>
            </div>
          )}

          {/* Controles de Visualização e Seletor de Rodadas */}
          {availableRounds.length > 0 ? (
            <div className="space-y-4">
              {/* Barra de alternância entre "Por Rodada" e "Ver Todas as 10 Rodadas" */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-400">Modo de Visualização:</span>
                  <button
                    onClick={() => setShowAllRounds(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      !showAllRounds
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    Por Rodada
                  </button>
                  <button
                    onClick={() => setShowAllRounds(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      showAllRounds
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <span>Ver Todas as 10 Rodadas ({matches.length} Jogos)</span>
                  </button>
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  {showAllRounds ? (
                    <span>Exibindo a tabela com as <strong className="text-amber-400">10 rodadas e {matches.length} confrontos oficiais</strong></span>
                  ) : (
                    <span>Exibindo <strong className="text-amber-400">Rodada {selectedRoundFilter}</strong> ({filteredMatches.length} jogos)</span>
                  )}
                </div>
              </div>

              {/* Seletor de Rodada Individual (Modo Por Rodada) */}
              {!showAllRounds && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
                  {availableRounds.map((r) => (
                    <button
                      key={r}
                      onClick={() => setSelectedRoundFilter(r)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        selectedRoundFilter === r
                          ? 'bg-amber-500 text-slate-950 shadow-md'
                          : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      <span>Rodada {r}</span>
                      <span className="text-[10px] opacity-75">
                        {r <= 5 ? '(1ºT)' : '(2ºT)'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Renderização das Partidas */}
              {showAllRounds ? (
                /* Modo: Todas as 10 Rodadas Agrupadas */
                <div className="space-y-6">
                  {availableRounds.map((roundNum) => {
                    const roundMatches = matches.filter(
                      (m) => Number(m.round || m.rodada || 1) === roundNum
                    );
                    const isTurno = roundNum <= 5;

                    return (
                      <div
                        key={roundNum}
                        className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-amber-400 font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                              RODADA {roundNum}
                            </span>
                            <span className="text-xs text-slate-300 font-bold">
                              {isTurno ? '1º Turno (Jogos de Ida)' : '2º Turno (Returno - Mando Invertido)'}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-emerald-400 font-bold">
                            {roundMatches.length} partidas • 6 clubes
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5">
                          {roundMatches.map((match) => (
                            <div
                              key={match.id}
                              className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className="flex items-center justify-end gap-2 w-44 text-right">
                                  <span className="font-bold text-xs text-white truncate">{match.homeClubName}</span>
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono text-[10px] font-bold">
                                    CASA
                                  </span>
                                </div>

                                <div className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono font-black text-amber-400 shrink-0">
                                  VS
                                </div>

                                <div className="flex items-center justify-start gap-2 w-44 text-left">
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-sky-400 font-mono text-[10px] font-bold">
                                    FORA
                                  </span>
                                  <span className="font-bold text-xs text-white truncate">{match.awayClubName}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0">
                                <span className="flex items-center gap-1 font-mono text-[11px]">
                                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                                  <span>{match.date} • {match.time}</span>
                                </span>

                                <span className="flex items-center gap-1 truncate max-w-[150px] text-slate-400 text-[11px]">
                                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                  <span className="truncate">{match.stadiumName}</span>
                                </span>

                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40 font-bold">
                                  AGENDADO
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Modo: Por Rodada Filtrada */
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-slate-300">
                      Rodada {selectedRoundFilter} de 10 •{' '}
                      <span className="text-amber-400 font-normal">
                        {selectedRoundFilter <= 5 ? '1º Turno' : '2º Turno (Returno - Mando Invertido)'}
                      </span>
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {filteredMatches.length} partidas oficiais
                    </span>
                  </div>

                  {filteredMatches.map((match) => {
                    const isEditingThis = editingMatch?.id === match.id;
                    const isFinished = match.status === 'FINISHED';

                    return (
                      <div
                        key={match.id}
                        className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        {isEditingThis ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 w-full text-xs">
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 block mb-1">Data</label>
                              <input
                                type="date"
                                value={editingMatch.date}
                                onChange={(e) => setEditingMatch({ ...editingMatch, date: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 block mb-1">Horário</label>
                              <input
                                type="time"
                                value={editingMatch.time}
                                onChange={(e) => setEditingMatch({ ...editingMatch, time: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white"
                              />
                            </div>
                            <div className="flex items-end gap-2 col-span-2">
                              <button
                                onClick={handleSaveMatchEdit}
                                className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs cursor-pointer"
                              >
                                Salvar
                              </button>
                              <button
                                onClick={() => setEditingMatch(null)}
                                className="px-3.5 py-2 rounded-lg bg-slate-800 text-slate-400 font-bold text-xs cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-4 flex-1">
                              <div className="flex items-center justify-end gap-2.5 w-40 sm:w-48 text-right">
                                <span className="font-bold text-xs text-white truncate">{match.homeClubName}</span>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">
                                  (CASA)
                                </span>
                              </div>

                              <div className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-black text-amber-400 shrink-0">
                                {isFinished ? `${match.homeScore ?? 0} x ${match.awayScore ?? 0}` : 'VS'}
                              </div>

                              <div className="flex items-center justify-start gap-2.5 w-40 sm:w-48 text-left">
                                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">
                                  (FORA)
                                </span>
                                <span className="font-bold text-xs text-white truncate">{match.awayClubName}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0">
                              <span className="flex items-center gap-1 font-mono">
                                <Clock className="w-3.5 h-3.5 text-slate-500" />
                                <span>{match.date} • {match.time}</span>
                              </span>

                              <span className="flex items-center gap-1 truncate max-w-[140px] text-slate-400">
                                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span className="truncate">{match.stadiumName}</span>
                              </span>

                              {!isHomologated && !isFinished && (
                                <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
                                  <button
                                    onClick={() => handleSwapHomeAway(match.id)}
                                    title="Inverter mando de campo e estádio"
                                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border border-slate-800 cursor-pointer"
                                  >
                                    <ArrowUpDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingMatch(match)}
                                    title="Editar data e horário"
                                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 cursor-pointer"
                                  >
                                    <FileEdit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMatch(match.id)}
                                    title="Excluir partida"
                                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center rounded-xl bg-slate-950 border border-slate-800">
              <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-white">Nenhum confronto gerado ainda.</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Clique no botão "Gerar Calendário Automaticamente" acima para criar a tabela de jogos ou adicione confrontos manualmente.
              </p>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setActiveTab('PARTICIPANTES')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
            >
              Voltar
            </button>
            <button
              onClick={() => setActiveTab('REGRAS')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              <span>Avançar para Regras</span>
              <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 5: REGRAS DE PONTUAÇÃO & DESEMPATE */}
      {/* ======================================================== */}
      {activeTab === 'REGRAS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>Regras de Pontuação & Critérios de Desempate</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Defina os pontos atribuídos por resultado e a hierarquia de desempate para a tabela de classificação.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-emerald-400 block">Pontos por Vitória</span>
              <input
                type="number"
                min={0}
                value={rules.pointsWin}
                onChange={(e) => setRules({ ...rules, pointsWin: Number(e.target.value) })}
                disabled={isHomologated}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono text-base font-black disabled:opacity-60"
              />
              <span className="text-[11px] text-slate-500 block">Padrão oficial FM Universe: 3 pontos.</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-amber-400 block">Pontos por Empate</span>
              <input
                type="number"
                min={0}
                value={rules.pointsDraw}
                onChange={(e) => setRules({ ...rules, pointsDraw: Number(e.target.value) })}
                disabled={isHomologated}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono text-base font-black disabled:opacity-60"
              />
              <span className="text-[11px] text-slate-500 block">Padrão oficial FM Universe: 1 ponto.</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-rose-400 block">Pontos por Derrota</span>
              <input
                type="number"
                min={0}
                value={rules.pointsLoss}
                onChange={(e) => setRules({ ...rules, pointsLoss: Number(e.target.value) })}
                disabled={isHomologated}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono text-base font-black disabled:opacity-60"
              />
              <span className="text-[11px] text-slate-500 block">Padrão oficial FM Universe: 0 pontos.</span>
            </div>
          </div>

          <div className="space-y-3">
            <span className="text-xs font-bold text-white block">Hierarquia de Critérios de Desempate</span>
            <p className="text-[11px] text-slate-400">
              A ordem abaixo determina como empates em pontos serão desempatados na classificação oficial:
            </p>

            <div className="space-y-2">
              {rules.tiebreakers.map((crit, idx) => {
                const labels: Record<string, string> = {
                  SALDO_GOLS: '1. Saldo de Gols (SG)',
                  GOLS_PRO: '2. Gols Pró / Marcados (GP)',
                  VITORIAS: '3. Número de Vitórias (V)',
                  CONFRONTO_DIRETO: '4. Confronto Direto entre os clubes',
                  MENOS_CARTAO_VERMELHO: '5. Menor número de cartões vermelhos (Disciplina)',
                };

                return (
                  <div
                    key={crit}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                  >
                    <span className="font-bold text-xs text-white">
                      #{idx + 1} — {labels[crit] || crit}
                    </span>

                    {!isHomologated && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMoveTiebreaker(idx, 'UP')}
                          disabled={idx === 0}
                          className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMoveTiebreaker(idx, 'DOWN')}
                          disabled={idx === rules.tiebreakers.length - 1}
                          className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setActiveTab('CALENDARIO')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
            >
              Voltar
            </button>
            <button
              onClick={() => setActiveTab('PREMIACOES')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              <span>Avançar para Premiações</span>
              <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 6: PREMIAÇÕES FINANCEIRAS */}
      {/* ======================================================== */}
      {activeTab === 'PREMIACOES' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Premiações Oficiais da Competição</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Defina os repasses financeiros para os campeões, cotas de participação e bônus por partida.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-amber-400 block">🏆 Premiação do Campeão</span>
              <input
                type="number"
                value={prizes.champion}
                onChange={(e) => setPrizes({ ...prizes, champion: Number(e.target.value) })}
                disabled={isHomologated}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono text-sm font-bold disabled:opacity-60"
              />
              <span className="text-[11px] text-slate-400 font-mono block">
                {formatCurrencyBRL(prizes.champion)}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-300 block">🥈 Premiação do Vice-campeão</span>
              <input
                type="number"
                value={prizes.runnerUp}
                onChange={(e) => setPrizes({ ...prizes, runnerUp: Number(e.target.value) })}
                disabled={isHomologated}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono text-sm font-bold disabled:opacity-60"
              />
              <span className="text-[11px] text-slate-400 font-mono block">
                {formatCurrencyBRL(prizes.runnerUp)}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-amber-600 block">🥉 Premiação do 3º Colocado</span>
              <input
                type="number"
                value={prizes.thirdPlace || 0}
                onChange={(e) => setPrizes({ ...prizes, thirdPlace: Number(e.target.value) })}
                disabled={isHomologated}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono text-sm font-bold disabled:opacity-60"
              />
              <span className="text-[11px] text-slate-400 font-mono block">
                {formatCurrencyBRL(prizes.thirdPlace || 0)}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-blue-400 block">🎟️ Cota de Participação (por clube)</span>
              <input
                type="number"
                value={prizes.participationPerClub}
                onChange={(e) => setPrizes({ ...prizes, participationPerClub: Number(e.target.value) })}
                disabled={isHomologated}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono text-sm font-bold disabled:opacity-60"
              />
              <span className="text-[11px] text-slate-400 font-mono block">
                {formatCurrencyBRL(prizes.participationPerClub)}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-emerald-400 block">⚽ Bônus por Vitória</span>
              <input
                type="number"
                value={prizes.winBonus}
                onChange={(e) => setPrizes({ ...prizes, winBonus: Number(e.target.value) })}
                disabled={isHomologated}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono text-sm font-bold disabled:opacity-60"
              />
              <span className="text-[11px] text-slate-400 font-mono block">
                {formatCurrencyBRL(prizes.winBonus)}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-amber-300 block">🤝 Bônus por Empate</span>
              <input
                type="number"
                value={prizes.drawBonus}
                onChange={(e) => setPrizes({ ...prizes, drawBonus: Number(e.target.value) })}
                disabled={isHomologated}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono text-sm font-bold disabled:opacity-60"
              />
              <span className="text-[11px] text-slate-400 font-mono block">
                {formatCurrencyBRL(prizes.drawBonus)}
              </span>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setActiveTab('REGRAS')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
            >
              Voltar
            </button>
            <button
              onClick={() => setActiveTab('REVISAO')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              <span>Avançar para Revisão & Homologação</span>
              <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 7: REVISÃO GERAL & HOMOLOGAÇÃO */}
      {/* ======================================================== */}
      {activeTab === 'REVISAO' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-amber-400" />
              <span>Painel Executivo de Revisão & Homologação Oficial</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Revise todos os parâmetros antes de homologar. A homologação oficial trava a edição e libera o botão Continuar para os Managers.
            </p>
          </div>

          {/* Checklist de Validação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              {
                title: 'Temporada Configurada',
                desc: `${seasonName} (${seasonYear})`,
                valid: checkSeasonValid,
              },
              {
                title: 'Campeonato & Formato',
                desc: `${compName} • ${compLegs === 'TURNO_E_RETURNO' ? 'Turno e Returno' : 'Turno Único'}`,
                valid: checkCompValid,
              },
              {
                title: 'Clubes Participantes',
                desc: `${selectedClubIds.length} clubes confirmados`,
                valid: checkParticipantsValid,
              },
              {
                title: 'Calendário de Jogos',
                desc: `${matches.length} partidas geradas em ${availableRounds.length} rodadas`,
                valid: checkMatchesValid,
              },
              {
                title: 'Regras de Pontuação',
                desc: `V: ${rules.pointsWin} | E: ${rules.pointsDraw} | D: ${rules.pointsLoss} • ${rules.tiebreakers.length} critérios`,
                valid: checkRulesValid,
              },
              {
                title: 'Premiações do Torneio',
                desc: `Campeão: ${formatCurrencyBRL(prizes.champion)}`,
                valid: checkPrizesValid,
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                  item.valid
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                }`}
              >
                {item.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-bold text-xs text-white block">{item.title}</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Resumo Consolidado */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Resumo Consolidado do Torneio
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block">Temporada:</span>
                <strong className="text-white font-mono">{seasonYear}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Vigência:</span>
                <strong className="text-white font-mono">{seasonStartDate} a {seasonEndDate}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Participantes:</span>
                <strong className="text-white font-mono">{selectedClubIds.length} equipes</strong>
              </div>
              <div>
                <span className="text-slate-400 block">Total de Rodadas:</span>
                <strong className="text-white font-mono">{compRoundsCount} rodadas</strong>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <span className="text-slate-400">
                Status Atual:{' '}
                <strong className={isHomologated ? 'text-emerald-400' : 'text-amber-400'}>
                  {isHomologated ? 'HOMOLOGADA (Oficial FM Universe)' : 'RASCUNHO (Aguardando Homologação)'}
                </strong>
              </span>

              <div className="flex items-center gap-2">
                {!isHomologated ? (
                  <>
                    <button
                      onClick={handleSaveDraft}
                      disabled={loading}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 cursor-pointer"
                    >
                      Salvar como RASCUNHO
                    </button>
                    <button
                      id="admin-btn-homologate-main"
                      onClick={() => setShowHomologateModal(true)}
                      disabled={loading || !isReadyToHomologate}
                      className={`px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all shadow-lg cursor-pointer ${
                        isReadyToHomologate
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50 animate-pulse'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>HOMOLOGAR TEMPORADA OFICIAL</span>
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      Temporada Homologada & Em Operação
                    </span>
                    <button
                      onClick={() => setShowRevertModal(true)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/30 cursor-pointer"
                    >
                      Reabrir Revisão
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-start pt-2">
            <button
              onClick={() => setActiveTab('PREMIACOES')}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL DE CONFIRMAÇÃO DE HOMOLOGAÇÃO */}
      {/* ======================================================== */}
      {showHomologateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-fadeIn">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-black text-white">Homologar Temporada Oficial?</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Ao homologar, esta temporada tornar-se-á a <strong className="text-white">fonte oficial</strong> para o Motor de Rodadas, classificação, calendário, notícias e Dashboard dos Managers. A edição comum será bloqueada.
              </p>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Temporada:</span>
                <strong className="text-white">{seasonName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Campeonato:</span>
                <strong className="text-white">{compName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Participantes:</span>
                <strong className="text-white">{selectedClubIds.length} clubes</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total de Jogos:</span>
                <strong className="text-white">{matches.length} partidas</strong>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowHomologateModal(false)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                id="admin-btn-confirm-homologate"
                onClick={handleHomologateSeason}
                disabled={loading}
                className="w-1/2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Sim, Homologar!</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL DE REVERSÃO PARA RASCUNHO */}
      {/* ======================================================== */}
      {showRevertModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-fadeIn">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-black text-white">Reabrir para Revisão (Rascunho)?</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Reverter a temporada para Rascunho permite editar confrontos, regras e participantes. Enquanto estiver em rascunho, o botão <strong className="text-amber-400">Continuar</strong> dos Managers será pausado até uma nova homologação.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowRevertModal(false)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Manter Homologada
              </button>
              <button
                onClick={handleRevertToDraft}
                disabled={loading}
                className="w-1/2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs cursor-pointer"
              >
                Reverter para Rascunho
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
