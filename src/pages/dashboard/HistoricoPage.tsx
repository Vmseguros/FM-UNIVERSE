import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Trophy, History, Award, Star, Calendar } from 'lucide-react';

export const HistoricoPage: React.FC = () => {
  const { managedClub } = useAuth();

  if (!managedClub) {
    return <div className="text-center py-16 text-slate-400">Clube não carregado.</div>;
  }

  const trophies = [
    { name: 'Campeonato Nacional FM Universe', count: managedClub.trophiesCount > 1 ? managedClub.trophiesCount - 1 : 1, year: '2023, 2021' },
    { name: 'Copa dos Campeões do Universo', count: 2, year: '2022, 2020' },
    { name: 'Supercopa de Clubes', count: 3, year: '2024, 2022, 2021' },
  ];

  const pastSeasons = [
    { season: '2024/2025', position: '2º Lugar', points: 74, topScorer: 'Gabriel Gol (22 gols)' },
    { season: '2023/2024', position: '1º Lugar (Campeão)', points: 81, topScorer: 'Lucas Moura (19 gols)' },
    { season: '2022/2023', position: '3º Lugar', points: 69, topScorer: 'Diego Ribas (16 gols)' },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <History className="w-6 h-6 text-emerald-400" />
          <span>Sala de Troféus & Histórico do Clube</span>
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Conquistas históricas, campanhas passadas e o legado do {managedClub.name}.
        </p>
      </div>

      {/* Trophy Room Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Trophy className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Galeria de Glórias ({managedClub.trophiesCount} Títulos Oficiais)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {trophies.map((tr, i) => (
            <div
              key={i}
              className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-start gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <span className="font-mono text-xs font-bold text-amber-400 block">
                  {tr.count}x Campeão
                </span>
                <h3 className="font-bold text-sm text-white">{tr.name}</h3>
                <span className="text-[11px] text-slate-500 block mt-1">Anos: {tr.year}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Past Seasons Record */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Desempenho em Temporadas Anteriores
          </h2>
        </div>

        <div className="space-y-3">
          {pastSeasons.map((ps, idx) => (
            <div
              key={idx}
              className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-emerald-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                  {ps.season}
                </span>
                <div>
                  <span className="font-bold text-white text-sm">{ps.position}</span>
                  <span className="text-slate-400 block text-[11px]">Artilheiro do clube: {ps.topScorer}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="font-mono font-black text-emerald-400 text-sm">{ps.points}</span>
                <span className="text-[10px] text-slate-500 block uppercase font-mono">Pontos Conquistados</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
