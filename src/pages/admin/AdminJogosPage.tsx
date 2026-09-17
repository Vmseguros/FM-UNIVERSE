import React, { useEffect, useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { jogosService } from '../../services/jogosService';
import { clubesService } from '../../services/clubesService';
import { Match, Club } from '../../types';
import { Calendar, Plus, Edit2, Play, CheckCircle2, Clock, MapPin, X } from 'lucide-react';

export const AdminJogosPage: React.FC = () => {
  const { navigate } = useNavigation();
  const [matches, setMatches] = useState<Match[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scoreModalMatch, setScoreModalMatch] = useState<Match | null>(null);
  const [homeScoreInput, setHomeScoreInput] = useState(2);
  const [awayScoreInput, setAwayScoreInput] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);

  // New match form
  const [homeClubId, setHomeClubId] = useState('');
  const [awayClubId, setAwayClubId] = useState('');
  const [round, setRound] = useState(6);
  const [date, setDate] = useState('2025-10-15');
  const [time, setTime] = useState('16:00');

  const loadData = () => {
    Promise.all([jogosService.getAll(), clubesService.getAll()]).then(([m, c]) => {
      setMatches(m);
      setClubs(c);
      if (c.length >= 2) {
        if (!homeClubId) setHomeClubId(c[0].id);
        if (!awayClubId) setAwayClubId(c[1].id);
      }
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenScoreModal = (m: Match) => {
    setScoreModalMatch(m);
    setHomeScoreInput(m.homeScore || 0);
    setAwayScoreInput(m.awayScore || 0);
  };

  const handleSaveScore = async () => {
    if (!scoreModalMatch) return;

    await jogosService.update(scoreModalMatch.id, {
      homeScore: homeScoreInput,
      awayScore: awayScoreInput,
      status: 'FINISHED',
      attendance: 42000,
      ticketRevenue: 1850000,
    });

    setFeedback(`Resultado da partida gravado na súmula: ${scoreModalMatch.homeClubName} ${homeScoreInput} x ${awayScoreInput} ${scoreModalMatch.awayClubName}!`);
    setScoreModalMatch(null);
    loadData();
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (homeClubId === awayClubId) {
      alert('Selecione dois clubes distintos para o confronto!');
      return;
    }

    const home = clubs.find((c) => c.id === homeClubId);
    const away = clubs.find((c) => c.id === awayClubId);

    await jogosService.create({
      competitionId: 'comp-1',
      competitionName: 'Liga FM Universe',
      season: '2025/2026',
      round,
      date,
      time,
      stadiumId: home?.stadiumId || 'stad-1',
      stadiumName: home?.stadiumName || 'Estádio Central',
      homeClubId,
      homeClubName: home?.name || 'Mandante',
      awayClubId,
      awayClubName: away?.name || 'Visitante',
      status: 'SCHEDULED',
      events: [],
    });

    setFeedback(`Confronto ${home?.name} vs ${away?.name} agendado com sucesso!`);
    setIsModalOpen(false);
    loadData();
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-900/40 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-purple-400" />
            <span>Gerenciador de Jogos & Súmulas</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Agendamento de jogos, registro de placares e atualização de resultados em tempo real.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Agendar Partida</span>
        </button>
      </div>

      {feedback && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Matches Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                <th className="py-3 px-3">Rodada</th>
                <th className="py-3 px-3">Data/Hora</th>
                <th className="py-3 px-4">Confronto</th>
                <th className="py-3 px-3 text-center">Placar</th>
                <th className="py-3 px-3">Estádio</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-medium">
              {matches.map((m) => (
                <tr key={m.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-3 font-mono text-purple-400 font-bold">R{m.round}</td>
                  <td className="py-3 px-3 font-mono text-slate-400">
                    {m.date.split('-').slice(1).join('/')} {m.time}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap font-bold text-white">
                    <span>{m.homeClubName}</span>
                    <span className="text-slate-500 mx-2 font-normal">vs</span>
                    <span>{m.awayClubName}</span>
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-black text-emerald-400 text-sm">
                    {m.status === 'FINISHED' ? `${m.homeScore} - ${m.awayScore}` : '-'}
                  </td>
                  <td className="py-3 px-3 text-slate-300">{m.stadiumName}</td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                        m.status === 'FINISHED'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-amber-500/15 text-amber-400'
                      }`}
                    >
                      {m.status === 'FINISHED' ? 'Encerrado' : 'Agendado'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => handleOpenScoreModal(m)}
                      className="bg-slate-800 hover:bg-purple-600 hover:text-white text-slate-300 px-2.5 py-1 rounded text-[10px] font-semibold transition-colors"
                    >
                      Editar Placar / Súmula
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Score Modal */}
      {scoreModalMatch && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-900/60 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <h3 className="font-bold text-white text-sm">
              Súmula Oficial do Confronto
            </h3>

            <div className="py-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="flex items-center justify-around">
                <div>
                  <span className="text-xs font-bold text-white block mb-1">
                    {scoreModalMatch.homeClubName}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={homeScoreInput}
                    onChange={(e) => setHomeScoreInput(Number(e.target.value))}
                    className="w-14 h-12 bg-slate-900 border border-slate-700 rounded-lg text-center font-mono text-2xl font-black text-emerald-400 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <span className="font-mono text-xl text-slate-500 font-bold">X</span>

                <div>
                  <span className="text-xs font-bold text-white block mb-1">
                    {scoreModalMatch.awayClubName}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={awayScoreInput}
                    onChange={(e) => setAwayScoreInput(Number(e.target.value))}
                    className="w-14 h-12 bg-slate-900 border border-slate-700 rounded-lg text-center font-mono text-2xl font-black text-emerald-400 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSaveScore}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Salvar e Encerrar Jogo
              </button>
              <button
                onClick={() => setScoreModalMatch(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Match Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-900/60 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm">Agendar Nova Partida</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMatch} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Clube Mandante:</label>
                <select
                  value={homeClubId}
                  onChange={(e) => setHomeClubId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                >
                  {clubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.stadiumName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Clube Visitante:</label>
                <select
                  value={awayClubId}
                  onChange={(e) => setAwayClubId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                >
                  {clubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Rodada:</label>
                  <input
                    type="number"
                    min={1}
                    max={38}
                    value={round}
                    onChange={(e) => setRound(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Data:</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Hora:</label>
                  <input
                    type="text"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-800">
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Confirmar Agendamento
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
