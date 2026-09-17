import React, { useEffect, useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { jogosService } from '../../services/jogosService';
import { Match } from '../../types';
import { formatCurrencyBRL } from '../../utils/currency';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  DollarSign,
  ArrowLeft,
  Activity,
  Flame,
  Shield,
} from 'lucide-react';

export const JogoDetalhePage: React.FC = () => {
  const { params, navigate } = useNavigation();
  const [match, setMatch] = useState<Match | null>(null);

  useEffect(() => {
    const id = params.id || 'match-1';
    jogosService.getById(id).then(setMatch);
  }, [params.id]);

  if (!match) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400">Carregando detalhes do confronto...</p>
      </div>
    );
  }

  const stats = match.stats || {
    possession: [50, 50],
    shots: [10, 10],
    shotsOnTarget: [4, 4],
    fouls: [12, 12],
    corners: [5, 5],
    offsides: [2, 2],
    passesAccuracy: [80, 80],
  };

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/jogos')}
        className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar para lista de jogos</span>
      </button>

      {/* Match Scoreboard Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">
        <div className="text-center text-xs text-slate-400 font-mono mb-4">
          <span className="text-emerald-400 font-bold">{match.competitionName}</span> • Rodada {match.round} • {match.date.split('-').slice(1).join('/')} às {match.time}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-4">
          {/* Home Team */}
          <div className="text-center sm:text-left flex-1">
            <h2 className="text-xl sm:text-2xl font-black text-white">{match.homeClubName}</h2>
            <span className="text-xs text-slate-400">Mandante</span>
          </div>

          {/* Score Box */}
          <div className="bg-slate-950 border border-slate-800 px-6 py-3 rounded-2xl text-center shadow-inner">
            {match.status === 'FINISHED' ? (
              <div>
                <span className="font-mono text-3xl sm:text-4xl font-black text-emerald-400 tracking-wider">
                  {match.homeScore} - {match.awayScore}
                </span>
                <span className="block text-[10px] uppercase font-mono font-bold text-slate-500 mt-1">
                  Encerrado
                </span>
              </div>
            ) : (
              <div>
                <span className="font-mono text-xl sm:text-2xl font-black text-slate-300 tracking-wider">
                  VS
                </span>
                <span className="block text-[10px] uppercase font-mono font-bold text-emerald-400 mt-1">
                  Agendado
                </span>
              </div>
            )}
          </div>

          {/* Away Team */}
          <div className="text-center sm:text-right flex-1">
            <h2 className="text-xl sm:text-2xl font-black text-white">{match.awayClubName}</h2>
            <span className="text-xs text-slate-400">Visitante</span>
          </div>
        </div>

        {/* Stadium, Attendance & Revenue HUD */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-800/80 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="truncate">Estádio: <strong className="text-slate-200">{match.stadiumName}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500 shrink-0" />
            <span>Público: <strong className="text-slate-200 font-mono">{match.attendance ? `${match.attendance.toLocaleString()} pagantes` : 'A definir'}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Renda da Partida: <strong className="text-emerald-400 font-mono">{match.ticketRevenue ? formatCurrencyBRL(match.ticketRevenue, { compact: true, decimals: 2 }) : 'A definir'}</strong></span>
          </div>
        </div>
      </div>

      {/* Events & Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Match Events Timeline */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Flame className="w-4 h-4 text-rose-500" />
            <h3 className="font-bold text-sm text-white uppercase tracking-wider">
              Linha do Tempo de Eventos
            </h3>
          </div>

          {match.events && match.events.length > 0 ? (
            <div className="space-y-3">
              {match.events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-emerald-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {ev.minute}'
                    </span>
                    <div>
                      <span className="font-bold text-white">{ev.playerName}</span>
                      {ev.detail && <span className="text-slate-400 ml-1">({ev.detail})</span>}
                    </div>
                  </div>

                  <span className="text-[11px] font-semibold text-rose-400 uppercase font-mono">
                    {ev.type === 'GOAL' ? '⚽ Gol' : ev.type === 'YELLOW_CARD' ? '🟨 Cartão' : ev.type}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-xs">
              Nenhum evento registrado ainda nesta partida.
            </div>
          )}
        </div>

        {/* Match Statistics Comparison */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="font-bold text-sm text-white uppercase tracking-wider">
                Estatísticas do Confronto
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-emerald-400 font-bold">{match.homeClubName}</span>
              <span className="text-slate-500">vs</span>
              <span className="text-cyan-400 font-bold">{match.awayClubName}</span>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            {/* Possession */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-mono font-bold text-emerald-400">{stats.possession[0]}%</span>
                <span className="text-slate-400 font-medium">Posse de Bola</span>
                <span className="font-mono font-bold text-cyan-400">{stats.possession[1]}%</span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-800">
                <div className="bg-emerald-500 h-full" style={{ width: `${stats.possession[0]}%` }} />
                <div className="bg-cyan-500 h-full" style={{ width: `${stats.possession[1]}%` }} />
              </div>
            </div>

            {/* Total Shots */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-mono font-bold text-emerald-400">{stats.shots[0]}</span>
                <span className="text-slate-400 font-medium">Finalizações</span>
                <span className="font-mono font-bold text-cyan-400">{stats.shots[1]}</span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-800">
                <div
                  className="bg-emerald-500 h-full"
                  style={{ width: `${(stats.shots[0] / (stats.shots[0] + stats.shots[1] || 1)) * 100}%` }}
                />
                <div
                  className="bg-cyan-500 h-full"
                  style={{ width: `${(stats.shots[1] / (stats.shots[0] + stats.shots[1] || 1)) * 100}%` }}
                />
              </div>
            </div>

            {/* Shots on target */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-mono font-bold text-emerald-400">{stats.shotsOnTarget[0]}</span>
                <span className="text-slate-400 font-medium">Chutes no Alvo</span>
                <span className="font-mono font-bold text-cyan-400">{stats.shotsOnTarget[1]}</span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-800">
                <div
                  className="bg-emerald-500 h-full"
                  style={{ width: `${(stats.shotsOnTarget[0] / (stats.shotsOnTarget[0] + stats.shotsOnTarget[1] || 1)) * 100}%` }}
                />
                <div
                  className="bg-cyan-500 h-full"
                  style={{ width: `${(stats.shotsOnTarget[1] / (stats.shotsOnTarget[0] + stats.shotsOnTarget[1] || 1)) * 100}%` }}
                />
              </div>
            </div>

            {/* Passes Accuracy */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-mono font-bold text-emerald-400">{stats.passesAccuracy[0]}%</span>
                <span className="text-slate-400 font-medium">Precisão dos Passes</span>
                <span className="font-mono font-bold text-cyan-400">{stats.passesAccuracy[1]}%</span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-800">
                <div className="bg-emerald-500 h-full" style={{ width: `${stats.passesAccuracy[0]}%` }} />
                <div className="bg-cyan-500 h-full" style={{ width: `${stats.passesAccuracy[1]}%` }} />
              </div>
            </div>

            {/* Fouls */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-mono font-bold text-emerald-400">{stats.fouls[0]}</span>
                <span className="text-slate-400 font-medium">Faltas Cometidas</span>
                <span className="font-mono font-bold text-cyan-400">{stats.fouls[1]}</span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-800">
                <div
                  className="bg-emerald-500 h-full"
                  style={{ width: `${(stats.fouls[0] / (stats.fouls[0] + stats.fouls[1] || 1)) * 100}%` }}
                />
                <div
                  className="bg-cyan-500 h-full"
                  style={{ width: `${(stats.fouls[1] / (stats.fouls[0] + stats.fouls[1] || 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
