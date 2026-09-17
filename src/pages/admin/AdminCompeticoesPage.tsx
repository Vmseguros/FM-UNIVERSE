import React, { useEffect, useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { competicoesService } from '../../services/competicoesService';
import { participantesService } from '../../services/participantesService';
import { calendarioService } from '../../services/calendarioService';
import { clubesService } from '../../services/clubesService';
import { jogosService } from '../../services/jogosService';
import { Competition, CompetitionParticipant, Club, Match, CalendarStatus } from '../../types';
import {
  Trophy,
  Calendar,
  Users,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Play,
  RotateCcw,
  ShieldCheck,
  ChevronRight,
  MapPin,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

export const AdminCompeticoesPage: React.FC = () => {
  const { navigate } = useNavigation();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<string>('comp-1');
  const [activeTab, setActiveTab] = useState<'PARTICIPANTES' | 'CALENDARIO' | 'FORMATO'>('CALENDARIO');
  const [selectedRound, setSelectedRound] = useState<number>(5);

  const [participants, setParticipants] = useState<CompetitionParticipant[]>([]);
  const [allClubs, setAllClubs] = useState<Club[]>([]);
  const [calendarMatches, setCalendarMatches] = useState<Match[]>([]);

  const [formatLegs, setFormatLegs] = useState<'TURNO_E_RETURNO' | 'TURNO_UNICO'>('TURNO_E_RETURNO');
  const [selectedClubToAdd, setSelectedClubToAdd] = useState<string>('');

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const loadAllData = async () => {
    try {
      const [comps, clubsList] = await Promise.all([
        competicoesService.getAll(),
        clubesService.getAll(),
      ]);
      setCompetitions(comps);
      setAllClubs(clubsList);

      const targetId = selectedCompId || comps[0]?.id || 'comp-1';
      setSelectedCompId(targetId);

      const [parts, matches] = await Promise.all([
        participantesService.getByCompetition(targetId),
        calendarioService.getCalendarByCompetition(targetId),
      ]);
      setParticipants(parts);
      setCalendarMatches(matches);

      const currentComp = comps.find((c) => c.id === targetId);
      if (currentComp) {
        if (currentComp.legs) setFormatLegs(currentComp.legs);
        if (currentComp.currentRound) setSelectedRound(currentComp.currentRound);
      }
    } catch (err) {
      console.error('Erro ao carregar dados de competições:', err);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [selectedCompId]);

  const showFeedback = (type: 'success' | 'error' | 'info', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  };

  const selectedCompetition = competitions.find((c) => c.id === selectedCompId);
  const calendarStatus: CalendarStatus = selectedCompetition?.calendarStatus || 'HOMOLOGADO';

  const handleGenerateCalendar = async () => {
    if (!selectedCompetition) return;
    if (calendarStatus === 'HOMOLOGADO') {
      showFeedback('error', 'O calendário já está HOMOLOGADO. Reverta para Rascunho se desejar regerá-lo.');
      return;
    }

    setLoading(true);
    try {
      const generated = await calendarioService.generateRoundRobinCalendar({
        competitionId: selectedCompetition.id,
        seasonId: selectedCompetition.temporadaId || 's-2025',
        legs: formatLegs,
      });
      showFeedback('success', `Calendário gerado com sucesso! ${generated.length} partidas criadas no formato Todos contra Todos.`);
      await loadAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showFeedback('error', `Falha ao gerar calendário: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleHomologateCalendar = async () => {
    if (!selectedCompetition) return;
    setLoading(true);
    try {
      await calendarioService.homologateCalendar(selectedCompetition.id, 'Admin FM Universe');
      showFeedback('success', `Calendário da competição "${selectedCompetition.name}" HOMOLOGADO OFICIALMENTE! Liberado para o Manager e Motor de Rodadas.`);
      await loadAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showFeedback('error', `Falha ao homologar calendário: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRevertToDraft = async () => {
    if (!selectedCompetition) return;
    setLoading(true);
    try {
      await calendarioService.revertToDraft(selectedCompetition.id);
      showFeedback('info', 'Status revertido para RASCUNHO. Alterações de participantes e confrontos agora são permitidas.');
      await loadAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showFeedback('error', `Não foi possível reverter: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddParticipant = async () => {
    if (!selectedClubToAdd || !selectedCompetition) return;
    if (calendarStatus === 'HOMOLOGADO') {
      showFeedback('error', 'Não é possível adicionar participantes com o calendário HOMOLOGADO. Reverta para Rascunho antes.');
      return;
    }

    try {
      await participantesService.addParticipant({
        competitionId: selectedCompetition.id,
        clubId: selectedClubToAdd,
        seasonId: selectedCompetition.temporadaId || 's-2025',
      });
      setSelectedClubToAdd('');
      showFeedback('success', 'Clube adicionado aos participantes oficiais!');
      await loadAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showFeedback('error', `Erro ao adicionar participante: ${msg}`);
    }
  };

  const handleRemoveParticipant = async (clubId: string) => {
    if (!selectedCompetition) return;
    if (calendarStatus === 'HOMOLOGADO') {
      showFeedback('error', 'Não é possível remover participantes de um calendário HOMOLOGADO.');
      return;
    }

    // Impede remover o Thales FC para não quebrar o save do usuário
    if (clubId === 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3') {
      showFeedback('error', 'O clube Thales FC é o clube do Manager e deve obrigatoriamente permanecer na competição.');
      return;
    }

    try {
      await participantesService.removeParticipant(selectedCompetition.id, clubId);
      showFeedback('info', 'Participante removido.');
      await loadAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showFeedback('error', `Erro ao remover participante: ${msg}`);
    }
  };

  const handleAdvanceRound = async (comp: Competition) => {
    const nextRound = Math.min(comp.roundsCount, comp.currentRound + 1);
    await competicoesService.update(comp.id, { currentRound: nextRound });
    showFeedback('success', `Rodada avançada para ${nextRound} na competição "${comp.name}"!`);
    await loadAllData();
  };

  // Filtragem de partidas da rodada selecionada
  const roundMatches = calendarMatches.filter(
    (m) => m.round === selectedRound || m.rodada === selectedRound
  );

  const availableClubsToAdd = allClubs.filter(
    (c) => !participants.some((p) => p.clubId === c.id)
  );

  const totalRounds = selectedCompetition?.roundsCount || 10;
  const roundNumbers = Array.from({ length: totalRounds }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-900/40 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-purple-400" />
            <span>Gerenciador de Competições & Calendário Oficial</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Estrutura Oficial: Temporada → Competição → Participantes → Calendário → Rodadas → Partidas
          </p>
        </div>

        <div className="flex items-center gap-2">
          {competitions.map((comp) => (
            <button
              key={comp.id}
              onClick={() => setSelectedCompId(comp.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
                selectedCompId === comp.id
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <span>{comp.logo}</span>
              <span>{comp.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`px-4 py-3 rounded-xl text-xs flex items-center gap-2 border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : feedback.type === 'error'
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              : 'bg-sky-500/15 border-sky-500/30 text-sky-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : feedback.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          ) : (
            <Sparkles className="w-4 h-4 shrink-0 text-sky-400" />
          )}
          <span className="font-medium">{feedback.message}</span>
        </div>
      )}

      {selectedCompetition && (
        <>
          {/* Card de Visão Geral da Competição Selecionada */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-4xl shrink-0 shadow-inner">
                  {selectedCompetition.logo}
                </div>
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl font-black text-white">{selectedCompetition.name}</h2>
                    {calendarStatus === 'HOMOLOGADO' ? (
                      <span className="bg-emerald-500/20 text-emerald-400 font-mono text-xs font-bold px-2.5 py-1 rounded-lg border border-emerald-500/40 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        HOMOLOGADO OFICIAL
                      </span>
                    ) : calendarStatus === 'RASCUNHO' ? (
                      <span className="bg-amber-500/20 text-amber-300 font-mono text-xs font-bold px-2.5 py-1 rounded-lg border border-amber-500/40 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        RASCUNHO - NÃO PUBLICADO
                      </span>
                    ) : (
                      <span className="bg-slate-800 text-slate-400 font-mono text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-700">
                        ENCERRADO
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                    {selectedCompetition.description}
                  </p>

                  <div className="flex items-center gap-4 text-xs font-mono text-purple-300 mt-2 flex-wrap">
                    <span>Temporada {selectedCompetition.season}</span>
                    <span>•</span>
                    <span>Tipo: {selectedCompetition.type}</span>
                    <span>•</span>
                    <span>Formato: {selectedCompetition.format || 'TODOS_CONTRA_TODOS'}</span>
                    <span>•</span>
                    <span>{selectedCompetition.legs === 'TURNO_UNICO' ? 'Turno Único' : 'Turno e Returno'}</span>
                  </div>
                </div>
              </div>

              {/* Botões de Ação de Homologação e Ciclo */}
              <div className="flex flex-wrap items-center gap-2">
                {calendarStatus === 'RASCUNHO' ? (
                  <button
                    onClick={handleHomologateCalendar}
                    disabled={loading || participants.length < 2 || calendarMatches.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Homologar Calendário Oficial</span>
                  </button>
                ) : (
                  <button
                    onClick={handleRevertToDraft}
                    disabled={loading}
                    className="bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold px-4 py-2 rounded-xl text-xs transition-colors flex items-center gap-2 cursor-pointer border border-amber-500/30"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reverter para Rascunho</span>
                  </button>
                )}

                <button
                  onClick={() => handleAdvanceRound(selectedCompetition)}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Play className="w-4 h-4" />
                  <span>Avançar Rodada (+1)</span>
                </button>

                <button
                  onClick={() => navigate(`/competicoes/${selectedCompetition.id}`)}
                  className="bg-slate-950 hover:bg-slate-800 text-slate-300 px-3 py-2 rounded-xl text-xs transition-colors flex items-center gap-1.5 border border-slate-800"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ver Tabela</span>
                </button>
              </div>
            </div>

            {/* Metadados Rápidos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80 text-center text-xs">
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                <span className="text-[10px] text-slate-500 block uppercase font-mono">Participantes Oficiais</span>
                <span className="font-mono font-bold text-white text-sm">{participants.length} clubes</span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                <span className="text-[10px] text-slate-500 block uppercase font-mono">Rodada Atual</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {selectedCompetition.currentRound} / {selectedCompetition.roundsCount}
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                <span className="text-[10px] text-slate-500 block uppercase font-mono">Total de Partidas</span>
                <span className="font-mono font-bold text-purple-300 text-sm">
                  {calendarMatches.length} jogos
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                <span className="text-[10px] text-slate-500 block uppercase font-mono">Status do Motor</span>
                <span
                  className={`font-mono font-bold text-sm ${
                    calendarStatus === 'HOMOLOGADO' ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {calendarStatus === 'HOMOLOGADO' ? 'Liberado para Jogar' : 'Bloqueado (Rascunho)'}
                </span>
              </div>
            </div>
          </div>

          {/* Abas de Navegação */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab('CALENDARIO')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'CALENDARIO'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Calendário & Rodadas ({calendarMatches.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('PARTICIPANTES')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'PARTICIPANTES'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Participantes Oficiais ({participants.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('FORMATO')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'FORMATO'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Formato & Geração</span>
            </button>
          </div>

          {/* Conteúdo da Aba 1: CALENDÁRIO */}
          {activeTab === 'CALENDARIO' && (
            <div className="space-y-4">
              {/* Seletor de Rodadas */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-2 overflow-x-auto">
                <span className="text-xs font-bold text-slate-400 uppercase font-mono mr-2 shrink-0">
                  Rodadas:
                </span>
                {roundNumbers.map((r) => {
                  const isCurrent = r === selectedCompetition.currentRound;
                  const isSelected = r === selectedRound;
                  return (
                    <button
                      key={r}
                      onClick={() => setSelectedRound(r)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-purple-600 text-white shadow-md'
                          : isCurrent
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                          : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <span>R{r}</span>
                      {isCurrent && <span className="ml-1 text-[9px] text-emerald-400 font-bold">• Atual</span>}
                    </button>
                  );
                })}
              </div>

              {/* Lista de Partidas da Rodada Selecionada */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-5 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>Rodada {selectedRound}</span>
                      {selectedRound === selectedCompetition.currentRound && (
                        <span className="bg-emerald-500/15 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-500/30 font-bold">
                          Próxima Rodada em Disputa
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {roundMatches.length} confrontos agendados para esta rodada
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {calendarStatus === 'RASCUNHO' && (
                      <button
                        onClick={handleGenerateCalendar}
                        disabled={loading}
                        className="bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-semibold px-3 py-1.5 rounded-lg border border-purple-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Regerar Calendário</span>
                      </button>
                    )}
                  </div>
                </div>

                {roundMatches.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
                    <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">Nenhuma partida gerada para a Rodada {selectedRound}.</p>
                    <button
                      onClick={handleGenerateCalendar}
                      className="mt-3 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                    >
                      Gerar Calendário Round-Robin
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {roundMatches.map((match) => {
                      const isThalesMatch =
                        match.homeClubId === 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3' ||
                        match.awayClubId === 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3';

                      return (
                        <div
                          key={match.id}
                          className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                            isThalesMatch
                              ? 'bg-purple-950/20 border-purple-500/50 shadow-sm'
                              : 'bg-slate-950 border-slate-800/80'
                          }`}
                        >
                          <div>
                            {/* Header do Card */}
                            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-3 border-b border-slate-800/60 pb-2">
                              <span className="flex items-center gap-1 text-slate-400">
                                <Clock className="w-3 h-3 text-purple-400" />
                                {match.date} às {match.time}
                              </span>

                              {isThalesMatch && (
                                <span className="bg-purple-500/20 text-purple-300 font-bold px-1.5 py-0.5 rounded text-[10px] border border-purple-500/30">
                                  ⭐ Thales FC
                                </span>
                              )}

                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  match.status === 'FINISHED' || match.status === 'CONCLUIDA'
                                    ? 'bg-slate-800 text-slate-300'
                                    : match.status === 'LIVE' || match.status === 'EM_ANDAMENTO'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                }`}
                              >
                                {match.status === 'FINISHED' || match.status === 'CONCLUIDA'
                                  ? 'CONCLUÍDA'
                                  : match.status === 'LIVE' || match.status === 'EM_ANDAMENTO'
                                  ? 'AO VIVO'
                                  : 'AGENDADA'}
                              </span>
                            </div>

                            {/* Confronto */}
                            <div className="space-y-2.5 my-2">
                              {/* Mandante */}
                              <div className="flex items-center justify-between">
                                <span
                                  className={`text-xs font-bold ${
                                    match.homeClubId === 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3'
                                      ? 'text-purple-300'
                                      : 'text-white'
                                  }`}
                                >
                                  {match.homeClubName} (Mandante)
                                </span>
                                {(match.status === 'FINISHED' || match.status === 'CONCLUIDA') && (
                                  <span className="font-mono font-bold text-white text-sm bg-slate-900 px-2 py-0.5 rounded">
                                    {match.homeScore ?? 0}
                                  </span>
                                )}
                              </div>

                              <div className="text-[10px] text-center text-slate-500 font-mono">VS</div>

                              {/* Visitante */}
                              <div className="flex items-center justify-between">
                                <span
                                  className={`text-xs font-bold ${
                                    match.awayClubId === 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3'
                                      ? 'text-purple-300'
                                      : 'text-white'
                                  }`}
                                >
                                  {match.awayClubName} (Visitante)
                                </span>
                                {(match.status === 'FINISHED' || match.status === 'CONCLUIDA') && (
                                  <span className="font-mono font-bold text-white text-sm bg-slate-900 px-2 py-0.5 rounded">
                                    {match.awayScore ?? 0}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Estádio oficial do mandante */}
                          <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                            <span className="flex items-center gap-1 truncate max-w-[200px]" title={match.stadiumName}>
                              <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="truncate">{match.stadiumName}</span>
                            </span>
                            <span className="font-mono text-[10px] text-slate-500">Rodada {match.round}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Conteúdo da Aba 2: PARTICIPANTES OFICIAIS */}
          {activeTab === 'PARTICIPANTES' && (
            <div className="space-y-6">
              {/* Adicionar Participante */}
              {calendarStatus === 'RASCUNHO' && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex-1 w-full">
                    <label className="text-xs font-bold text-slate-400 block mb-1">
                      Adicionar Clube à Competição
                    </label>
                    <select
                      value={selectedClubToAdd}
                      onChange={(e) => setSelectedClubToAdd(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="">Selecione um clube disponível...</option>
                      {availableClubsToAdd.map((club) => (
                        <option key={club.id} value={club.id}>
                          {club.name} ({club.stadiumName} • Cap: {club.capacity.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full sm:w-auto pt-4 sm:pt-5">
                    <button
                      onClick={handleAddParticipant}
                      disabled={!selectedClubToAdd}
                      className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Inscrever Clube</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Tabela de Clubes Inscritos */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-400" />
                      <span>Clubes Oficiais Inscritos ({participants.length})</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Apenas clubes inscritos e homologados podem ter partidas oficiais no calendário.
                    </p>
                  </div>

                  {participants.some((p) => p.clubId === 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3') && (
                    <span className="bg-purple-500/20 text-purple-300 font-mono text-xs font-bold px-3 py-1 rounded-xl border border-purple-500/40 flex items-center gap-1.5">
                      <span>⭐</span>
                      <span>Thales FC Inscrito</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {participants.map((part) => {
                    const club = allClubs.find((c) => c.id === part.clubId);
                    const isThales = part.clubId === 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3';

                    return (
                      <div
                        key={part.id}
                        className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                          isThales
                            ? 'bg-purple-950/20 border-purple-500/40 shadow-sm'
                            : 'bg-slate-950 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-2xl font-bold">
                            {club?.badge || '🛡️'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white">{part.clubName}</h4>
                              {isThales && (
                                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded font-bold border border-purple-500/30">
                                  Você (Manager)
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-emerald-400" />
                              <span>{club?.stadiumName || 'Arena Principal'}</span>
                              <span className="font-mono text-slate-500">
                                ({club?.capacity?.toLocaleString() || '50.000'} assentos)
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${
                              part.status === 'HOMOLOGADO'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {part.status}
                          </span>

                          {calendarStatus === 'RASCUNHO' && !isThales && (
                            <button
                              onClick={() => handleRemoveParticipant(part.clubId)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Remover participante"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Conteúdo da Aba 3: FORMATO & CONFIGURAÇÃO */}
          {activeTab === 'FORMATO' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-purple-400" />
                  <span>Configurações Oficiais de Disputa</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Regras de chaveamento do motor, algoritmos de mando de campo e geração oficial do calendário.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Formato de Disputa */}
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                  <label className="text-xs font-bold text-slate-300 block uppercase font-mono">
                    Formato da Competição
                  </label>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white">
                    <span className="font-bold text-purple-300">Todos contra Todos (Round-Robin)</span>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Algoritmo de Berger: garante que todos os clubes se enfrentem exatamente o mesmo número de vezes, com alternância de mando e estádios próprios.
                    </p>
                  </div>
                </div>

                {/* Turnos */}
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                  <label className="text-xs font-bold text-slate-300 block uppercase font-mono">
                    Ciclo de Confrontos
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      disabled={calendarStatus === 'HOMOLOGADO'}
                      onClick={() => setFormatLegs('TURNO_E_RETURNO')}
                      className={`flex-1 p-3 rounded-xl text-xs font-bold transition-all text-left border cursor-pointer ${
                        formatLegs === 'TURNO_E_RETURNO'
                          ? 'bg-purple-900/30 border-purple-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-bold">Turno e Returno</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-normal">
                        Ida e volta com inversão de mandos (10 rodadas)
                      </div>
                    </button>

                    <button
                      disabled={calendarStatus === 'HOMOLOGADO'}
                      onClick={() => setFormatLegs('TURNO_UNICO')}
                      className={`flex-1 p-3 rounded-xl text-xs font-bold transition-all text-left border cursor-pointer ${
                        formatLegs === 'TURNO_UNICO'
                          ? 'bg-purple-900/30 border-purple-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-bold">Turno Único</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-normal">
                        Apenas jogos de ida (5 rodadas)
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Ação de Geração */}
              <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white">Geração do Calendário Oficial</h4>
                  <p className="text-xs text-slate-400">
                    O calendário gerado ficará com status RASCUNHO até que seja explicitamente homologado pelo Administrador.
                  </p>
                </div>

                <button
                  onClick={handleGenerateCalendar}
                  disabled={loading || calendarStatus === 'HOMOLOGADO'}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Gerar Calendário Oficial</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
