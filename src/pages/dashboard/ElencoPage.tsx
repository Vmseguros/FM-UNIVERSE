import React, { useEffect, useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useAuth } from '../../contexts/AuthContext';
import { jogadoresService } from '../../services/jogadoresService';
import { Player } from '../../types';
import { formatCurrencyBRL } from '../../utils/currency';
import { PositionBadge, RatingBadge } from '../../components/common/Badge';
import { Users, Search, Filter, ArrowRight, DollarSign, Activity, CheckCircle } from 'lucide-react';

export const ElencoPage: React.FC = () => {
  const { navigate } = useNavigation();
  const { managedClub } = useAuth();
  const [squad, setSquad] = useState<Player[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (managedClub) {
      jogadoresService.getByClubId(managedClub.id).then(setSquad);
    }
  }, [managedClub]);

  const filtered = squad.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.knownAs && p.knownAs.toLowerCase().includes(search.toLowerCase()));
    const matchCat = selectedCategory === 'ALL' || p.positionCategory === selectedCategory;
    return matchSearch && matchCat;
  });

  const handleContractRenew = (playerId: string, playerName: string) => {
    // Renew contract by 1 year in local state
    setSquad((prev) =>
      prev.map((p) =>
        p.id === playerId ? { ...p, contractUntil: '2028', wage: Math.round(p.wage * 1.1) } : p
      )
    );
    setActionSuccessMessage(`Contrato de ${playerName} renovado com sucesso até 2028!`);
    setTimeout(() => setActionSuccessMessage(null), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400" />
            <span>Gestão do Elenco • {managedClub?.name}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Supervisione a condição física, contratos, moral e desempenho de cada atleta do plantel.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">
            Total no Plantel: <strong className="text-white">{squad.length} jogadores</strong>
          </span>
        </div>
      </div>

      {actionSuccessMessage && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-wrap gap-3 items-center justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar por nome do jogador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Setor:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
          >
            <option value="ALL">Todos os Setores</option>
            <option value="GOLEIRO">Goleiros</option>
            <option value="DEFENSOR">Defensores</option>
            <option value="MEIO-CAMPISTA">Meio-Campistas</option>
            <option value="ATACANTE">Atacantes</option>
          </select>
        </div>
      </div>

      {/* Squad Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                <th className="py-3 px-3">Nº</th>
                <th className="py-3 px-4">Jogador</th>
                <th className="py-3 px-3">Posição</th>
                <th className="py-3 px-2 text-center">Idade</th>
                <th className="py-3 px-2 text-center">OVR</th>
                <th className="py-3 px-2 text-center">POT</th>
                <th className="py-3 px-3 text-center">Físico</th>
                <th className="py-3 px-3 text-center">Moral</th>
                <th className="py-3 px-3 text-right">Salário/Mês</th>
                <th className="py-3 px-3 text-right">Valor</th>
                <th className="py-3 px-3 text-center">Contrato</th>
                <th className="py-3 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-medium">
              {filtered.map((player) => (
                <tr key={player.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-3 font-mono text-slate-400 font-bold">
                    #{player.jerseyNumber}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      onClick={() => navigate(`/jogadores/${player.id}`)}
                      className="font-bold text-white hover:text-emerald-400 transition-colors cursor-pointer"
                    >
                      {player.name}
                    </span>
                    {player.knownAs && (
                      <span className="text-[11px] text-slate-400 ml-1.5 font-normal">
                        ({player.knownAs})
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <PositionBadge position={player.position} size="xs" />
                  </td>
                  <td className="py-3 px-2 text-center font-mono text-slate-300">{player.age ?? '-'}</td>
                  <td className="py-3 px-2 text-center">
                    <RatingBadge rating={player.overall ?? 70} size="sm" />
                  </td>
                  <td className="py-3 px-2 text-center font-mono font-bold text-emerald-400 text-xs">
                    {player.potential ?? player.overall ?? 70}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-emerald-400 font-bold">
                    {player.condition ?? 95}%
                  </td>
                  <td className="py-3 px-3 text-center text-amber-300 font-semibold text-[11px]">
                    {player.morale || 'Boa'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">
                    {formatCurrencyBRL(player.wage ?? 0, { compact: true, decimals: 0 })}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-400">
                    {formatCurrencyBRL(player.marketValue ?? 0, { compact: true })}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-slate-400">
                    {player.contractUntil}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => handleContractRenew(player.id, player.name)}
                      className="bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 px-2 py-1 rounded text-[10px] font-semibold border border-slate-700 transition-colors"
                    >
                      Renovar +1 ano
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
