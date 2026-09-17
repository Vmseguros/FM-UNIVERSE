import React, { useEffect, useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { competicoesService } from '../../services/competicoesService';
import { jogosService } from '../../services/jogosService';
import { Competition, Match } from '../../types';
import { Trophy, Calendar, ArrowLeft, ChevronRight, Clock, Activity } from 'lucide-react';

export const CompeticaoDetalhePage: React.FC = () => {
  const { params, navigate } = useNavigation();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeTab, setActiveTab] = useState<'tabela' | 'jogos'>('tabela');
  const [selectedRound, setSelectedRound] = useState<number>(4);

  useEffect(() => {
    const id = params.id || 'comp-1';
    competicoesService.getById(id).then((comp) => {
      if (comp) {
        setCompetition(comp);
        setSelectedRound(comp.currentRound || 4);
      }
    });
    jogosService.getAll().then(setMatches);
  }, [params.id]);

  if (!competition) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400">Carregando detalhes da competição...</p>
      </div>
    );
  }

  const roundMatches = matches.filter((m) => m.round === selectedRound);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/competicoes')}
        className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar para competições</span>
      </button>

      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-950 border border-slate-700 flex items-center justify-center text-4xl shadow-xl">
              {competition.logo}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl sm:text-3xl font-black text-white">{competition.name}</h1>
                <span className="bg-emerald-500/15 text-emerald-400 text-xs font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                  {competition.season}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400">
                {competition.teamsCount} Clubes • {competition.roundsCount} Rodadas de pura disputa
              </p>
            </div>
          </div>

          <div className="bg-slate-950/80 px-4 py-3 rounded-xl border border-slate-800 text-right">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Fase Atual</span>
            <span className="font-mono text-base font-bold text-emerald-400">
              Rodada {competition.currentRound} de {competition.roundsCount}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-4">
        <button
          onClick={() => setActiveTab('tabela')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'tabela'
              ? 'text-emerald-400 border-emerald-500'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          Classificação Completa
        </button>
        <button
          onClick={() => setActiveTab('jogos')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'jogos'
              ? 'text-emerald-400 border-emerald-500'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          Calendário de Rodadas
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'tabela' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-4">Clube</th>
                  <th className="py-3 px-3 text-center">J</th>
                  <th className="py-3 px-3 text-center">V</th>
                  <th className="py-3 px-3 text-center">E</th>
                  <th className="py-3 px-3 text-center">D</th>
                  <th className="py-3 px-3 text-center">GP</th>
                  <th className="py-3 px-3 text-center">GC</th>
                  <th className="py-3 px-3 text-center">SG</th>
                  <th className="py-3 px-4 text-center font-bold text-white">PTS</th>
                  <th className="py-3 px-3 text-center">Últimos 5 Jogos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {competition.standings.map((s, idx) => (
                  <tr
                    key={s.clubId}
                    onClick={() => navigate(`/clubes/${s.clubSlug}`)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3 font-mono">
                      <span
                        className={`w-6 h-6 inline-flex items-center justify-center rounded text-xs font-bold ${
                          idx === 0
                            ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-400/40'
                            : idx < 3
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {s.position}º
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-white whitespace-nowrap hover:text-emerald-400">
                      {s.clubName}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-300">{s.played}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-300">{s.won}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-300">{s.drawn}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-300">{s.lost}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-400">{s.goalsFor}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-400">{s.goalsAgainst}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-300">
                      {s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-black text-emerald-400 text-sm">
                      {s.points}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {s.form.map((f, i) => (
                          <span
                            key={i}
                            className={`w-5 h-5 rounded-full text-[10px] font-bold inline-flex items-center justify-center ${
                              f === 'W'
                                ? 'bg-emerald-600 text-white'
                                : f === 'D'
                                ? 'bg-slate-700 text-slate-300'
                                : 'bg-rose-600 text-white'
                            }`}
                          >
                            {f === 'W' ? 'V' : f === 'D' ? 'E' : 'D'}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Round selector */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRound(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedRound === r
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Rodada {r}
              </button>
            ))}
          </div>

          {/* Matches for selected round */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roundMatches.length > 0 ? (
              roundMatches.map((m) => (
                <div
                  key={m.id}
                  onClick={() => navigate(`/jogos/${m.id}`)}
                  className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-xl p-4 transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-center text-[11px] text-slate-400 mb-3 font-mono">
                    <span>{m.stadiumName}</span>
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Clock className="w-3 h-3" />
                      {m.date.split('-').slice(1).join('/')} • {m.time}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white group-hover:text-emerald-400 flex-1">
                      {m.homeClubName}
                    </span>
                    <div className="bg-slate-950 px-3 py-1 rounded text-sm font-mono font-black text-emerald-400 mx-3 border border-slate-800">
                      {m.status === 'FINISHED' ? `${m.homeScore} - ${m.awayScore}` : 'VS'}
                    </div>
                    <span className="font-bold text-sm text-white group-hover:text-emerald-400 flex-1 text-right">
                      {m.awayClubName}
                    </span>
                  </div>

                  {m.status === 'FINISHED' && m.events.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                      <span>Gols: </span>
                      {m.events
                        .filter((e) => e.type === 'GOAL')
                        .map((e) => `${e.playerName} (${e.minute}')`)
                        .join(', ')}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="col-span-2 text-center py-10 bg-slate-900 rounded-xl border border-slate-800 text-slate-400 text-xs">
                Nenhuma partida agendada para esta rodada no momento.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
