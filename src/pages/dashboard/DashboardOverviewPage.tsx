import React, { useEffect, useState, useRef } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useAuth } from '../../contexts/AuthContext';
import { jogadoresService } from '../../services/jogadoresService';
import { jogosService } from '../../services/jogosService';
import { competicoesService } from '../../services/competicoesService';
import { dataStore } from '../../services/dataStore';
import { notificacoesService } from '../../services/notificacoesService';
import { noticiasService } from '../../services/noticiasService';
import { Player, Match, ClubStanding, Stadium, NotificationItem } from '../../types';
import { formatCurrencyBRL } from '../../utils/currency';
import { PositionBadge, RatingBadge } from '../../components/common/Badge';
import { ClubBadge } from '../../components/common/ClubBadge';
import { ClubVisualIdentityHeader } from '../../components/dashboard/ClubVisualIdentityHeader';
import { NewsFeedSection } from '../../components/dashboard/NewsFeedSection';
import { NotificationCenterModal } from '../../components/notifications/NotificationCenterModal';
import {
  Users,
  Crosshair,
  DollarSign,
  TrendingUp,
  Calendar,
  Smile,
  Target,
  ArrowRight,
  Shield,
  Activity,
  Award,
  Clock,
} from 'lucide-react';

export const DashboardOverviewPage: React.FC = () => {
  const { navigate } = useNavigation();
  const { managedClub, isLoadingManager, isAuthInitialized } = useAuth();
  const [squad, setSquad] = useState<Player[]>([]);
  const [nextMatch, setNextMatch] = useState<Match | null>(null);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<ClubStanding[]>([]);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [stadium, setStadium] = useState<Stadium | undefined>(undefined);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState<number>(0);
  const [unreadNewsCount, setUnreadNewsCount] = useState<number>(0);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState<boolean>(false);
  const newsSectionRef = useRef<HTMLDivElement>(null);

  const refreshCounts = async () => {
    if (!managedClub) return;
    try {
      const notifs = await notificacoesService.getAll(managedClub.id);
      setNotifications(notifs);
      setUnreadNotifsCount(notifs.filter((n) => !n.read).length);
      const unreadNews = await noticiasService.getUnreadCount(managedClub.id);
      setUnreadNewsCount(unreadNews);
    } catch {
      // safe fallback
    }
  };

  useEffect(() => {
    if (managedClub) {
      const stad =
        dataStore.getStadiumById(managedClub.stadiumId) ||
        dataStore.getStadiums().find((s) => s.name === managedClub.stadiumName) ||
        dataStore.getStadiums()[0];
      setStadium(stad);

      jogadoresService.getByClubId(managedClub.id).then(setSquad);
      jogosService.getByClubId(managedClub.id).then((matches) => {
        // Lógica de Sincronização Temporal:
        // Encontra a primeira partida oficial SCHEDULED ainda não processada, respeitando rigorosamente a ordem das rodadas (Partida Pendente)
        const scheduled = matches
          .filter((m) => m.status === 'SCHEDULED')
          .sort((a, b) => a.round - b.round || a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
        const upcoming = scheduled[0] || null;
        const finished = matches
          .filter((m) => m.status === 'FINISHED')
          .sort((a, b) => b.round - a.round || b.date.localeCompare(a.date));
        if (upcoming) setNextMatch(upcoming);
        setRecentMatches(finished.slice(0, 3));
      });
      competicoesService.getAll().then((comps) => {
        const league = comps.find((c) => c.type === 'LIGA') || comps[0];
        if (league) {
          setStandings(league.standings.slice(0, 5));
          setCurrentRound(league.currentRound || 1);
        }
      });

      refreshCounts();
    }
  }, [managedClub]);

  if (!isAuthInitialized || (isLoadingManager && !managedClub)) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-slate-400 font-medium">Carregando dados do clube...</p>
      </div>
    );
  }

  if (!managedClub) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6">
        <Shield className="w-12 h-12 text-slate-600 mb-3" />
        <p className="text-sm font-semibold text-white mb-1">Nenhum clube vinculado</p>
        <p className="text-xs text-slate-400 mb-4 max-w-sm">
          Seu perfil de treinador ainda não possui um clube oficial fundado ou vinculado.
        </p>
        <button
          onClick={() => navigate('/manager/setup')}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
        >
          Fundar Meu Clube
        </button>
      </div>
    );
  }

  // Calculate team stats
  const squadSize = squad.length;
  const avgOverall =
    squadSize > 0
      ? Math.round(squad.reduce((acc, p) => acc + p.overall, 0) / squadSize)
      : 0;
  const totalWages = squad.reduce((acc, p) => acc + p.wage, 0);

  // Sincronização temporal: identifica conceito de PARTIDA PENDENTE (confronto SCHEDULED com data anterior ou menor rodada)
  const CURRENT_SEASON_DATE = '2026-09-10';
  const isPendingMatch = Boolean(
    nextMatch &&
    nextMatch.status === 'SCHEDULED' &&
    (nextMatch.date <= CURRENT_SEASON_DATE || nextMatch.round <= 5)
  );
  const isOverdueDate = Boolean(nextMatch && nextMatch.date < CURRENT_SEASON_DATE);

  return (
    <div className="space-y-4">
      {/* Visual Identity Header do Clube: Escudo, Nome, Treinador, Estádio e Foto */}
      <ClubVisualIdentityHeader
        club={managedClub}
        stadium={stadium}
        unreadNotifsCount={unreadNotifsCount}
        unreadNewsCount={unreadNewsCount}
        onOpenNotifications={() => setIsNotifModalOpen(true)}
        onOpenTactic={() => navigate('/dashboard/tatica')}
        onOpenSquad={() => navigate('/dashboard/elenco')}
        onScrollToNews={() => newsSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
      />

      {/* Bento Grid Main Canvas */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Bento 1: Próximo Desafio (col-span-4) */}
        <div className={`md:col-span-4 bg-[#121212] border rounded-xl p-5 flex flex-col justify-between transition-colors ${
          isPendingMatch ? 'border-amber-500/40 hover:border-amber-500/60 shadow-lg shadow-amber-500/5' : 'border-[#262626] hover:border-zinc-700/60'
        }`}>
          <div className="flex justify-between items-start gap-2">
            <div>
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-tighter">
                Próximo Desafio
              </h3>
              {nextMatch && isPendingMatch && (
                <div className="text-[11px] font-black text-amber-400 uppercase tracking-tight flex items-center gap-1.5 mt-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>RODADA {nextMatch.round} — PARTIDA PENDENTE</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isPendingMatch && (
                <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded font-black border border-amber-500/40 uppercase tracking-wide">
                  Pendente
                </span>
              )}
              <span className="bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5 rounded font-bold border border-green-500/30">
                {nextMatch?.competitionName || 'Liga FM'}
              </span>
            </div>
          </div>

          {nextMatch ? (
            <div className="my-4">
              <div className="flex items-center justify-around py-3">
                <div className="text-center">
                  <div className="mb-2 mx-auto flex items-center justify-center">
                    {nextMatch.homeClubId === managedClub.id ? (
                      <ClubBadge club={managedClub} size="lg" className="rounded-full border-2 border-green-500 shadow-sm" />
                    ) : (
                      <div className="w-14 h-14 bg-zinc-800 rounded-full border border-zinc-700 flex items-center justify-center text-xl">
                        ⚽
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-bold text-white uppercase truncate max-w-[90px]">
                    {nextMatch.homeClubName}
                  </p>
                </div>

                <div className="text-zinc-600 font-black text-2xl">VS</div>

                <div className="text-center">
                  <div className="mb-2 mx-auto flex items-center justify-center">
                    {nextMatch.awayClubId === managedClub.id ? (
                      <ClubBadge club={managedClub} size="lg" className="rounded-full border-2 border-zinc-700" />
                    ) : (
                      <div className="w-14 h-14 bg-zinc-800 rounded-full border border-zinc-700 flex items-center justify-center text-xl">
                        🛡️
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-bold text-white uppercase truncate max-w-[90px]">
                    {nextMatch.awayClubName}
                  </p>
                </div>
              </div>

              <div className="text-[10px] text-center text-zinc-400 mt-2">
                {nextMatch.stadiumName} • {nextMatch.date} às {nextMatch.time}
              </div>
              {isPendingMatch && isOverdueDate && (
                <div className="text-[10px] text-center text-amber-400/90 font-medium mt-1.5 flex items-center justify-center gap-1">
                  <span>⚠️ Partida agendada aguardando realização para sincronização da temporada</span>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-zinc-500 text-xs">
              Nenhuma partida agendada para os próximos dias.
            </div>
          )}

          <button
            onClick={() => navigate('/dashboard/tatica')}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white font-medium py-2 rounded-lg text-xs transition-colors border border-zinc-800 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Crosshair className="w-3.5 h-3.5 text-green-500" />
            <span>Escalação para a Rodada</span>
          </button>
        </div>

        {/* Bento 2: Principais Atletas (col-span-8) */}
        <div className="md:col-span-8 bg-[#121212] border border-[#262626] rounded-xl p-5 hover:border-zinc-700/60 transition-colors">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-tighter">
              Principais Atletas do Plantel
            </h3>
            <button
              onClick={() => navigate('/dashboard/elenco')}
              className="text-[10px] text-green-500 font-bold hover:underline cursor-pointer"
            >
              Ver Elenco Completo ({squad.length})
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-[10px] text-zinc-500 border-b border-zinc-800 uppercase">
                <tr>
                  <th className="pb-2">Nome</th>
                  <th className="pb-2">Pos</th>
                  <th className="pb-2">Idade</th>
                  <th className="pb-2">Condição</th>
                  <th className="pb-2">Moral</th>
                  <th className="pb-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-zinc-800/50">
                {squad.slice(0, 5).map((player) => (
                  <tr
                    key={player.id}
                    onClick={() => navigate(`/jogadores/${player.id}`)}
                    className="hover:bg-zinc-900/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 font-bold text-white group-hover:text-green-400 transition-colors flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-zinc-800 text-[10px] flex items-center justify-center text-zinc-300">
                        {player.jerseyNumber}
                      </span>
                      <span>{player.knownAs || player.name}</span>
                    </td>
                    <td className="py-2.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold border border-zinc-700">
                        {player.position}
                      </span>
                    </td>
                    <td className="py-2.5 text-zinc-400">{player.age}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${player.condition > 85 ? 'bg-green-500' : player.condition > 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${player.condition}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-400">{player.condition}%</span>
                      </div>
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`text-xs font-medium ${
                          player.morale === 'Excelente'
                            ? 'text-green-400'
                            : player.morale === 'Boa'
                            ? 'text-emerald-400'
                            : 'text-yellow-400'
                        }`}
                      >
                        {player.morale}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono text-zinc-200 font-bold">
                      {formatCurrencyBRL(player.marketValue, { compact: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bento 3: Análise Tática (col-span-4) */}
        <div className="md:col-span-4 bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col justify-between hover:border-zinc-700/60 transition-colors">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-tighter">
              Análise Tática
            </h3>
            <button
              onClick={() => navigate('/dashboard/tatica')}
              className="text-[10px] text-green-500 font-bold hover:underline cursor-pointer"
            >
              Configurar
            </button>
          </div>

          <div className="h-44 relative bg-zinc-900/50 rounded-lg border border-zinc-800 flex items-center justify-center overflow-hidden">
            {/* Field lines */}
            <div className="absolute inset-3 border border-zinc-700/40 rounded"></div>
            <div className="absolute w-full h-px bg-zinc-700/40 top-1/2"></div>
            <div className="absolute w-16 h-16 border border-zinc-700/40 rounded-full"></div>
            <div className="absolute w-20 h-10 border border-zinc-700/40 bottom-3"></div>
            <div className="absolute w-20 h-10 border border-zinc-700/40 top-3"></div>

            {/* Tactical player formation points (4-3-3 schematic) */}
            <div className="relative w-full h-full p-4 flex flex-col justify-between z-10">
              {/* Attackers */}
              <div className="flex justify-around">
                <div className="w-3 h-3 bg-green-500 rounded-full shadow-[0_0_8px_#22c55e]" title="PE"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full shadow-[0_0_8px_#22c55e]" title="ATA"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full shadow-[0_0_8px_#22c55e]" title="PD"></div>
              </div>

              {/* Midfielders */}
              <div className="flex justify-around px-4">
                <div className="w-3 h-3 bg-green-500 rounded-full" title="MC"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full shadow-[0_0_8px_#22c55e]" title="VOL"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full" title="MC"></div>
              </div>

              {/* Defenders */}
              <div className="flex justify-around">
                <div className="w-3 h-3 bg-green-500 rounded-full" title="LE"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full" title="ZAG"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full" title="ZAG"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full" title="LD"></div>
              </div>

              {/* Goalkeeper */}
              <div className="flex justify-center">
                <div className="w-3.5 h-3.5 bg-yellow-400 rounded-full shadow-[0_0_8px_#facc15]" title="GOL"></div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between items-center text-[10px] font-bold">
            <span className="text-zinc-400">ESTILO: Posse & Pressão</span>
            <span className="text-green-500 font-mono">FORMAÇÃO: 4-3-3</span>
          </div>
        </div>

        {/* Bento 4: Classificação Atual (col-span-4) */}
        <div className="md:col-span-4 bg-[#121212] border border-[#262626] rounded-xl p-5 hover:border-zinc-700/60 transition-colors">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-tighter">
              Classificação Atual
            </h3>
            <button
              onClick={() => navigate('/competicoes')}
              className="text-[10px] text-green-500 font-bold hover:underline cursor-pointer"
            >
              Tabela Completa
            </button>
          </div>

          <div className="space-y-1.5">
            {standings.length > 0 ? (
              standings.map((st) => {
                const isManaged = st.clubId === managedClub.id;
                return (
                  <div
                    key={st.clubId}
                    className={`flex items-center text-[11px] p-2 rounded transition-colors ${
                      isManaged
                        ? 'font-bold bg-green-500/10 border border-green-500/20 text-green-400'
                        : 'hover:bg-zinc-800/60 text-zinc-300'
                    }`}
                  >
                    <span className={`w-5 font-mono ${isManaged ? 'text-green-500 font-bold' : 'text-zinc-500'}`}>
                      {st.position}
                    </span>
                    <span className={`flex-1 truncate ${isManaged ? 'text-white' : 'text-zinc-300'}`}>
                      {st.clubName} {isManaged ? '(Você)' : ''}
                    </span>
                    <span className="w-12 text-right font-mono font-bold">
                      {st.points} pts
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="text-zinc-500 text-xs py-4 text-center">Nenhuma pontuação registrada ainda.</div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-between items-center text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
            <span>Rodada {currentRound} de 38</span>
            <span className="text-green-400 lowercase font-normal">Temporada Oficial</span>
          </div>
        </div>

        {/* Bento 5: Visão da Diretoria (col-span-4) */}
        <div className="md:col-span-4 bg-[#121212] border border-[#262626] rounded-xl p-5 flex flex-col justify-between hover:border-zinc-700/60 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter mb-1">
                Visão da Diretoria
              </h3>
              <p className="text-xs font-bold text-white leading-snug">
                {managedClub.seasonTarget || 'Atingir G-4 na Liga Nacional'}
              </p>
            </div>
            <div className="w-12 h-12 flex items-center justify-center rounded-full border-2 border-green-500 text-[11px] font-bold text-green-400 shrink-0">
              85%
            </div>
          </div>

          <p className="text-[11px] text-zinc-400 italic my-2">
            "{managedClub.boardExpectation}"
          </p>

          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[10px]">
            <span className="text-zinc-500">Confiança do Conselho</span>
            <span className="text-green-400 font-bold">Muito Alta</span>
          </div>
        </div>

        {/* Bento 6: Resultados Recentes do Clube (col-span-6) */}
        <div className="md:col-span-6 bg-[#121212] border border-[#262626] rounded-xl p-5 hover:border-zinc-700/60 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-tighter">
              Resultados Recentes
            </h3>
            <span className="text-[10px] text-zinc-500 uppercase">Últimos jogos</span>
          </div>

          <div className="space-y-2">
            {recentMatches.length > 0 ? (
              recentMatches.map((m) => (
                <div
                  key={m.id}
                  onClick={() => navigate(`/jogos/${m.id}`)}
                  className="bg-zinc-900/60 hover:bg-zinc-800 p-2.5 rounded-lg border border-zinc-800 flex items-center justify-between text-xs cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{m.homeClubName}</span>
                    <span className="text-zinc-500 text-[10px]">vs</span>
                    <span className="font-semibold text-white">{m.awayClubName}</span>
                  </div>
                  <div className="bg-zinc-800 font-mono font-bold text-green-400 px-2 py-0.5 rounded border border-zinc-700 text-xs">
                    {m.homeScore} - {m.awayScore}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-zinc-500 text-xs py-4 text-center">Nenhum resultado recente registrado.</div>
            )}
          </div>
        </div>

        {/* Bento 7: Finanças & Folha Salarial Resumo (col-span-6) */}
        <div className="md:col-span-6 bg-[#121212] border border-[#262626] rounded-xl p-5 hover:border-zinc-700/60 transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-tighter">
              Saúde Financeira
            </h3>
            <button
              onClick={() => navigate('/dashboard/financas')}
              className="text-[10px] text-green-500 font-bold hover:underline cursor-pointer"
            >
              Relatório Financeiro
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900/60 border border-zinc-800 p-3 rounded-lg">
              <span className="text-[10px] text-zinc-500 uppercase block">Saldo em Caixa</span>
              <span className="text-lg font-bold font-mono text-green-400">
                {formatCurrencyBRL(managedClub.balance, { compact: true })}
              </span>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800 p-3 rounded-lg">
              <span className="text-[10px] text-zinc-500 uppercase block">Orçamento Transferências</span>
              <span className="text-lg font-bold font-mono text-white">
                {formatCurrencyBRL(managedClub.transferBudget, { compact: true })}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400">
            <span>Folha Mensal: <strong className="text-white">{formatCurrencyBRL(totalWages, { compact: true, decimals: 0 })}/mês</strong></span>
            <span className="text-green-400">Dentro do teto orçamentário</span>
          </div>
        </div>
      </div>

      {/* Central de Notícias e Acontecimentos do FM Universe */}
      <div ref={newsSectionRef} className="pt-2">
        <NewsFeedSection clubId={managedClub.id} clubName={managedClub.name} />
      </div>

      {/* Central de Notificações Modal */}
      <NotificationCenterModal
        isOpen={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
        notifications={notifications}
        clubId={managedClub.id}
        onRefresh={refreshCounts}
      />
    </div>
  );
};
