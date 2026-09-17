import React, { useEffect, useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { competicoesService } from '../../services/competicoesService';
import { Competition } from '../../types';
import { Trophy, Calendar, Users, ArrowRight } from 'lucide-react';

export const CompeticoesPage: React.FC = () => {
  const { navigate } = useNavigation();
  const [competitions, setCompetitions] = useState<Competition[]>([]);

  useEffect(() => {
    competicoesService.getAll().then(setCompetitions);
  }, []);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
          <Trophy className="w-7 h-7 text-amber-400" />
          <span>Competições Oficiais</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Ligas e copas que movimentam o calendário do FM Universe.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {competitions.map((comp) => (
          <div
            key={comp.id}
            onClick={() => navigate(`/competicoes/${comp.id}`)}
            className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 transition-all hover:-translate-y-1 cursor-pointer group shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-3xl shadow-md group-hover:scale-105 transition-transform">
                    {comp.logo}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                      {comp.name}
                    </h2>
                    <span className="text-xs font-mono text-slate-400">
                      Temporada {comp.season} • {comp.teamsCount} Clubes
                    </span>
                  </div>
                </div>

                <span className="bg-emerald-500/15 text-emerald-400 text-xs font-mono font-bold px-2.5 py-1 rounded-lg border border-emerald-500/30">
                  Rodada {comp.currentRound} / {comp.roundsCount}
                </span>
              </div>

              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                {comp.description}
              </p>

              {/* Leader preview */}
              {comp.standings && comp.standings.length > 0 && (
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 mb-4 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Líder Atual:</span>
                  <span className="font-bold text-emerald-400">
                    {comp.standings[0].clubName} ({comp.standings[0].points} pts)
                  </span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-emerald-400 group-hover:text-emerald-300">
              <span>Acessar Tabela, Calendário & Estatísticas</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
