import React, { useEffect, useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { clubesService } from '../../services/clubesService';
import { Club } from '../../types';
import { formatCurrencyBRL } from '../../utils/currency';
import { ClubBadge } from '../../components/common/ClubBadge';
import { Shield, Plus, Edit2, Trash2, Eye, X, CheckCircle2 } from 'lucide-react';

export const AdminClubesPage: React.FC = () => {
  const { navigate } = useNavigation();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [badge, setBadge] = useState('⚽');
  const [reputation, setReputation] = useState(75);
  const [transferBudget, setTransferBudget] = useState(25000000);
  const [wageBudget, setWageBudget] = useState(3000000);
  const [stadiumName, setStadiumName] = useState('Estádio Municipal');
  const [capacity, setCapacity] = useState(35000);
  const [managerName, setManagerName] = useState('Novo Treinador');

  const loadClubs = () => {
    clubesService.getAll().then(setClubs);
  };

  useEffect(() => {
    loadClubs();
  }, []);

  const handleOpenCreate = () => {
    setEditingClub(null);
    setName('');
    setCode('');
    setBadge('⚽');
    setReputation(75);
    setTransferBudget(25000000);
    setWageBudget(3000000);
    setStadiumName('Estádio Central');
    setCapacity(35000);
    setManagerName('Treinador Padrão');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (club: Club) => {
    setEditingClub(club);
    setName(club.name);
    setCode(club.code);
    setBadge(club.badge);
    setReputation(club.reputation);
    setTransferBudget(club.transferBudget);
    setWageBudget(club.wageBudget);
    setStadiumName(club.stadiumName);
    setCapacity(club.capacity);
    setManagerName(club.managerName);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, clubName: string) => {
    if (confirm(`Tem certeza que deseja excluir o clube "${clubName}"?`)) {
      await clubesService.delete(id);
      loadClubs();
      setFeedback(`Clube "${clubName}" removido com sucesso.`);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingClub) {
      await clubesService.update(editingClub.id, {
        name,
        code: code.toUpperCase(),
        badge,
        reputation,
        transferBudget,
        wageBudget,
        stadiumName,
        capacity,
        managerName,
      });
      setFeedback(`Clube "${name}" atualizado com sucesso!`);
    } else {
      const slug = name.toLowerCase().replace(/\s+/g, '-');
      await clubesService.create({
        name,
        slug,
        shortName: code.toUpperCase() || 'NEW',
        code: code.toUpperCase() || 'NEW',
        badge: badge || '⚽',
        stadiumId: 'stad-1',
        primaryColor: '#10b981',
        secondaryColor: '#0f172a',
        foundedYear: 2025,
        stadiumName,
        capacity,
        balance: transferBudget * 1.5,
        transferBudget,
        wageBudget,
        reputation,
        fansCount: 500000,
        squadCount: 22,
        trophiesCount: 0,
        managerName,
        boardExpectation: 'Garantir estabilidade na liga e desenvolver talentos',
        seasonTarget: 'Meio de tabela',
      });
      setFeedback(`Clube "${name}" criado com sucesso!`);
    }

    setIsModalOpen(false);
    loadClubs();
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-900/40 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-400" />
            <span>Gerenciador de Clubes</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Cadastro, edição de atributos financeiros, reputação e estádios dos times.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Clube</span>
        </button>
      </div>

      {feedback && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Clubs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                <th className="py-3 px-4">Clube</th>
                <th className="py-3 px-3">Sigla</th>
                <th className="py-3 px-3 text-center">Reputação</th>
                <th className="py-3 px-3">Estádio</th>
                <th className="py-3 px-3 text-center">Capacidade</th>
                <th className="py-3 px-3 text-right">Orçamento Compras</th>
                <th className="py-3 px-3">Treinador</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-medium">
              {clubs.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <ClubBadge club={c} size="xs" />
                      <span className="font-bold text-white">{c.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-emerald-400">{c.code}</td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-purple-300">
                    {c.reputation} / 100
                  </td>
                  <td className="py-3 px-3 text-slate-300">{c.stadiumName}</td>
                  <td className="py-3 px-3 text-center font-mono text-slate-400">
                    {c.capacity.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                    {formatCurrencyBRL(c.transferBudget, { compact: true })}
                  </td>
                  <td className="py-3 px-3 text-slate-300">{c.managerName}</td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => navigate(`/clubes/${c.slug}`)}
                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded"
                        title="Visualizar"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="p-1.5 hover:bg-slate-800 text-purple-400 hover:text-purple-300 rounded"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
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

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-900/60 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm">
                {editingClub ? `Editar Clube: ${editingClub.name}` : 'Cadastrar Novo Clube'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Nome do Clube:</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Sigla (3 letras):</label>
                  <input
                    type="text"
                    maxLength={4}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Ícone / Emoji:</label>
                  <input
                    type="text"
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-center focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Reputação (0-100):</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={reputation}
                    onChange={(e) => setReputation(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Capacidade Estádio:</label>
                  <input
                    type="number"
                    step={1000}
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Nome do Estádio:</label>
                <input
                  type="text"
                  value={stadiumName}
                  onChange={(e) => setStadiumName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Orçamento Compras (R$):</label>
                  <input
                    type="number"
                    step={1000000}
                    value={transferBudget}
                    onChange={(e) => setTransferBudget(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-emerald-400 font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Nome do Treinador:</label>
                  <input
                    type="text"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-800">
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Salvar Clube
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
