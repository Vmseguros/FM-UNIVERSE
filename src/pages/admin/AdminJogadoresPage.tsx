import React, { useEffect, useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { jogadoresService } from '../../services/jogadoresService';
import { clubesService } from '../../services/clubesService';
import { Player, Club, PlayerPosition, PositionCategory } from '../../types';
import { formatCurrencyBRL } from '../../utils/currency';
import { PositionBadge, RatingBadge } from '../../components/common/Badge';
import { Users, Plus, Edit2, Trash2, Eye, X, CheckCircle2, Search, Database } from 'lucide-react';

export const AdminJogadoresPage: React.FC = () => {
  const { navigate } = useNavigation();
  const [players, setPlayers] = useState<Player[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form
  const [name, setName] = useState('');
  const [knownAs, setKnownAs] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState(10);
  const [clubId, setClubId] = useState('');
  const [position, setPosition] = useState<PlayerPosition>('ATA');
  const [age, setAge] = useState(24);
  const [overall, setOverall] = useState(80);
  const [potential, setPotential] = useState(85);
  const [marketValue, setMarketValue] = useState(15000000);
  const [wage, setWage] = useState(200000);
  const [nationality, setNationality] = useState('Brasil');

  const loadData = () => {
    Promise.all([jogadoresService.getAll(), clubesService.getAll()]).then(([p, c]) => {
      setPlayers(p);
      setClubs(c);
      if (c.length > 0 && !clubId) setClubId(c[0].id);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingPlayer(null);
    setName('');
    setKnownAs('');
    setJerseyNumber(10);
    setClubId(clubs[0]?.id || 'club-1');
    setPosition('ATA');
    setAge(22);
    setOverall(80);
    setPotential(86);
    setMarketValue(15000000);
    setWage(200000);
    setNationality('Brasil');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Player) => {
    setEditingPlayer(p);
    setName(p.name);
    setKnownAs(p.knownAs || '');
    setJerseyNumber(p.jerseyNumber);
    setClubId(p.clubId);
    setPosition(p.position);
    setAge(p.age);
    setOverall(p.overall);
    setPotential(p.potential);
    setMarketValue(p.marketValue);
    setWage(p.wage);
    setNationality(p.nationality);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, playerName: string) => {
    if (confirm(`Excluir o jogador "${playerName}"?`)) {
      await jogadoresService.delete(id);
      loadData();
      setFeedback(`Jogador "${playerName}" excluído com sucesso.`);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedClub = clubs.find((c) => c.id === clubId);
    const clubName = selectedClub?.name || 'Sem Clube';

    const getCat = (pos: PlayerPosition): PositionCategory => {
      if (pos === 'GOL') return 'GOLEIRO';
      if (['ZAG', 'LE', 'LD', 'LBO'].includes(pos)) return 'DEFENSOR';
      if (['VOL', 'MC', 'MEI', 'ME', 'MD'].includes(pos)) return 'MEIO-CAMPISTA';
      return 'ATACANTE';
    };

    if (editingPlayer) {
      await jogadoresService.update(editingPlayer.id, {
        name,
        knownAs,
        jerseyNumber,
        clubId,
        clubName,
        position,
        positionCategory: getCat(position),
        age,
        overall,
        potential,
        marketValue,
        wage,
        nationality,
      });
      setFeedback(`Jogador "${name}" atualizado!`);
    } else {
      await jogadoresService.create({
        name,
        knownAs,
        jerseyNumber,
        clubId,
        clubName,
        position,
        positionCategory: getCat(position),
        secondaryPositions: [],
        age,
        nationality,
        nationalityCode: 'BRA',
        preferredFoot: 'Destro',
        overall,
        potential,
        marketValue,
        wage,
        contractUntil: '2028',
        status: 'FIT',
        condition: 100,
        morale: 'Excelente',
        attributes: {
          pace: overall - 2,
          shooting: overall,
          passing: overall - 3,
          dribbling: overall + 1,
          defending: 45,
          physical: overall - 4,
        },
        stats: {
          matches: 0,
          goals: 0,
          assists: 0,
          cleanSheets: 0,
          yellowCards: 0,
          redCards: 0,
          minutesPlayed: 0,
          averageRating: 6.8,
        },
      });
      setFeedback(`Jogador "${name}" cadastrado com sucesso!`);
    }

    setIsModalOpen(false);
    loadData();
    setTimeout(() => setFeedback(null), 3000);
  };

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.clubName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-900/40 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-400" />
            <span>Gerenciador de Jogadores</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Cadastro de atletas, overall, atributos técnicos e vínculo contratual.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start">
          <button
            onClick={() => navigate('/admin/importar-fm26')}
            className="bg-purple-950/70 hover:bg-purple-900 text-purple-200 border border-purple-700/60 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <Database className="w-4 h-4 text-purple-400" />
            <span>Importar Banco FM26</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Jogador</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Search Input */}
      <div className="relative w-full sm:w-72">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Buscar atleta por nome ou clube..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
        />
      </div>

      {/* Players Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                <th className="py-3 px-3">Nº</th>
                <th className="py-3 px-4">Jogador</th>
                <th className="py-3 px-3">Clube</th>
                <th className="py-3 px-3">Pos</th>
                <th className="py-3 px-2 text-center">Idade</th>
                <th className="py-3 px-2 text-center">OVR</th>
                <th className="py-3 px-2 text-center">POT</th>
                <th className="py-3 px-3 text-right">Valor</th>
                <th className="py-3 px-3 text-right">Salário/Mês</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-medium">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-3 font-mono text-slate-400 font-bold">#{p.jerseyNumber}</td>
                  <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                    {p.name}
                    {p.knownAs && <span className="text-slate-400 text-[11px] ml-1">({p.knownAs})</span>}
                  </td>
                  <td className="py-3 px-3 text-slate-300 whitespace-nowrap">{p.clubName}</td>
                  <td className="py-3 px-3">
                    <PositionBadge position={p.position} size="xs" />
                  </td>
                  <td className="py-3 px-2 text-center font-mono text-slate-300">{p.age}</td>
                  <td className="py-3 px-2 text-center">
                    <RatingBadge rating={p.overall} size="sm" />
                  </td>
                  <td className="py-3 px-2 text-center font-mono font-bold text-emerald-400">
                    {p.potential}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                    {formatCurrencyBRL(p.marketValue, { compact: true })}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">
                    {formatCurrencyBRL(p.wage, { compact: true, decimals: 0 })}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => navigate(`/jogadores/${p.id}`)}
                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                        title="Visualizar Perfil"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="p-1.5 hover:bg-slate-800 text-purple-400 hover:text-purple-300 rounded"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id, p.name)}
                        className="p-1.5 hover:bg-slate-800 text-rose-400 hover:text-rose-300 rounded"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-900/60 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm">
                {editingPlayer ? `Editar Jogador: ${editingPlayer.name}` : 'Cadastrar Novo Jogador'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Nome Completo:</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Apelido / Conhecido Como:</label>
                  <input
                    type="text"
                    value={knownAs}
                    onChange={(e) => setKnownAs(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Clube:</label>
                  <select
                    value={clubId}
                    onChange={(e) => setClubId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-purple-500"
                  >
                    {clubs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Posição:</label>
                  <select
                    value={position}
                    onChange={(e) => setPosition(e.target.value as PlayerPosition)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-purple-500"
                  >
                    {['GOL', 'ZAG', 'LE', 'LD', 'VOL', 'MC', 'MEI', 'PE', 'PD', 'ATA'].map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Nº Camisa:</label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={jerseyNumber}
                    onChange={(e) => setJerseyNumber(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Idade:</label>
                  <input
                    type="number"
                    min={15}
                    max={45}
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Overall (0-99):</label>
                  <input
                    type="number"
                    min={40}
                    max={99}
                    value={overall}
                    onChange={(e) => setOverall(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Potencial (0-99):</label>
                  <input
                    type="number"
                    min={40}
                    max={99}
                    value={potential}
                    onChange={(e) => setPotential(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Valor de Mercado (R$):</label>
                  <input
                    type="number"
                    step={1000000}
                    value={marketValue}
                    onChange={(e) => setMarketValue(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-emerald-400 font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Salário Mensal (R$):</label>
                  <input
                    type="number"
                    step={10000}
                    value={wage}
                    onChange={(e) => setWage(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-800">
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Salvar Jogador
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
