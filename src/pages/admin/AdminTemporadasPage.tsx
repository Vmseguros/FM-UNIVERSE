import React, { useEffect, useState } from 'react';
import { temporadasService } from '../../services/temporadasService';
import { Season } from '../../types';
import { Calendar, Plus, CheckCircle2, Lock, Unlock, Clock } from 'lucide-react';

export const AdminTemporadasPage: React.FC = () => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = () => {
    temporadasService.getAll().then(setSeasons);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleWindow = async (s: Season) => {
    const nextStatus = !s.transferWindowOpen;
    await temporadasService.update(s.id, { transferWindowOpen: nextStatus });
    setFeedback(`Janela de transferências da temporada ${s.year} agora está ${nextStatus ? 'ABERTA' : 'FECHADA'}!`);
    loadData();
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-900/40 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-purple-400" />
            <span>Ciclos de Temporadas & Janelas</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Abertura e fechamento de janelas de transferências e histórico de calendários anuais.
          </p>
        </div>
      </div>

      {feedback && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {seasons.map((season) => (
          <div
            key={season.id}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-purple-950/60 border border-purple-800 flex items-center justify-center text-purple-400 text-xl font-mono font-black">
                    {season.year.split('/')[0]}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Temporada {season.year}</h2>
                    <span className="text-xs text-slate-400">
                      Início: {season.startDate} • Término: {season.endDate}
                    </span>
                  </div>
                </div>

                <span
                  className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
                    season.isCurrent
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {season.isCurrent ? 'Temporada Ativa' : 'Encerrada'}
                </span>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs mb-5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Janela de Transferências:</span>
                  <span
                    className={`font-bold flex items-center gap-1 ${
                      season.transferWindowOpen ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {season.transferWindowOpen ? (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Aberta para negociações</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Fechada</span>
                      </>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Competições Vinculadas:</span>
                  <span className="text-white font-mono font-semibold">
                    {season.competitionsCount} Ligas / Copas
                  </span>
                </div>
              </div>
            </div>

            {season.isCurrent && (
              <div className="pt-3 border-t border-slate-800">
                <button
                  onClick={() => handleToggleWindow(season)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    season.transferWindowOpen
                      ? 'bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 border border-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                  }`}
                >
                  {season.transferWindowOpen ? (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Fechar Janela de Transferências</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4" />
                      <span>Abrir Janela de Transferências</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
