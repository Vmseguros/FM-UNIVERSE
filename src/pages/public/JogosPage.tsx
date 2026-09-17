import React, { useEffect, useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { jogosService } from '../../services/jogosService';
import { Match } from '../../types';
import { Calendar, Clock, MapPin, ChevronRight, Activity } from 'lucide-react';

export const JogosPage: React.FC = () => {
  const { navigate } = useNavigation();
  const [matches, setMatches] = useState<Match[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'SCHEDULED' | 'FINISHED'>('ALL');

  useEffect(() => {
    jogosService.getAll().then(setMatches);
  }, []);

  const filtered = matches.filter((m) => {
    if (filter === 'SCHEDULED') return m.status === 'SCHEDULED';
    if (filter === 'FINISHED') return m.status === 'FINISHED';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
            <Calendar className="w-7 h-7 text-emerald-400" />
            <span>Calendário & Súmulas de Jogos</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Resultados consolidados, próximos confrontos, estatísticas e escalações completas.
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 self-start">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === 'ALL'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos ({matches.length})
          </button>
          <button
            onClick={() => setFilter('SCHEDULED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === 'SCHEDULED'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Próximos
          </button>
          <button
            onClick={() => setFilter('FINISHED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === 'FINISHED'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Encerrados
          </button>
        </div>
      </div>

      {/* Matches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((m) => (
          <div
            key={m.id}
            onClick={() => navigate(`/jogos/${m.id}`)}
            className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-5 transition-all hover:-translate-y-0.5 cursor-pointer group shadow-sm flex flex-col justify-between"
          >
            <div>
              {/* Competition & Date */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3 font-mono">
                <span className="text-emerald-400 font-semibold">{m.competitionName} • Rodada {m.round}</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {m.date.split('-').slice(1).join('/')} • {m.time}
                </span>
              </div>

              {/* Clubs and Score */}
              <div className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <span className="font-bold text-sm sm:text-base text-white group-hover:text-emerald-400 transition-colors block">
                    {m.homeClubName}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase">Mandante</span>
                </div>

                <div className="bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl text-center mx-3 shrink-0">
                  {m.status === 'FINISHED' ? (
                    <span className="font-mono text-lg font-black text-emerald-400">
                      {m.homeScore} - {m.awayScore}
                    </span>
                  ) : (
                    <span className="font-mono text-xs font-bold text-slate-400 uppercase">
                      Agendado
                    </span>
                  )}
                </div>

                <div className="flex-1 text-right">
                  <span className="font-bold text-sm sm:text-base text-white group-hover:text-emerald-400 transition-colors block">
                    {m.awayClubName}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase">Visitante</span>
                </div>
              </div>

              {/* Stadium */}
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800/80">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>{m.stadiumName}</span>
                {m.attendance && m.attendance > 0 && (
                  <span className="text-slate-500 font-mono ml-auto">
                    Público: {m.attendance.toLocaleString()} pagantes
                  </span>
                )}
              </div>
            </div>

            <div className="mt-3 pt-2 flex items-center justify-between text-xs font-semibold text-emerald-400 group-hover:text-emerald-300">
              <span>Ver Súmula e Detalhes</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
