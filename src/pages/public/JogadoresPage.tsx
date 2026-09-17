import React, { useEffect, useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { jogadoresService } from '../../services/jogadoresService';
import { clubesService } from '../../services/clubesService';
import { Player, Club, PlayerPosition } from '../../types';
import { formatCurrencyBRL } from '../../utils/currency';
import { PositionBadge, RatingBadge } from '../../components/common/Badge';
import { Users, Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

export const JogadoresPage: React.FC = () => {
  const { navigate } = useNavigation();
  const [players, setPlayers] = useState<Player[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [search, setSearch] = useState('');
  const [selectedClub, setSelectedClub] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'overall' | 'marketValue' | 'age' | 'goals'>('overall');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    Promise.all([jogadoresService.getAll(), clubesService.getAll()]).then(([p, c]) => {
      setPlayers(p);
      setClubs(c);
    });
  }, []);

  // Reset page whenever filtering changes
  useEffect(() => {
    setPage(1);
  }, [search, selectedClub, selectedCategory, sortBy, pageSize]);

  const filtered = players
    .filter((p) => {
      if (!p) return false;
      const name = p.name || '';
      const knownAs = p.knownAs || '';
      const fullName = p.fullName || '';
      const query = search.toLowerCase();

      const matchSearch =
        name.toLowerCase().includes(query) ||
        knownAs.toLowerCase().includes(query) ||
        fullName.toLowerCase().includes(query);

      const matchClub = selectedClub === 'ALL' || p.clubId === selectedClub;
      const matchCat = selectedCategory === 'ALL' || p.positionCategory === selectedCategory;
      return matchSearch && matchClub && matchCat;
    })
    .sort((a, b) => {
      const overallA = a.overall ?? 0;
      const overallB = b.overall ?? 0;
      const marketValueA = a.marketValue ?? 0;
      const marketValueB = b.marketValue ?? 0;
      const goalsA = a.stats?.goals ?? 0;
      const goalsB = b.stats?.goals ?? 0;
      const ageA = a.age ?? 0;
      const ageB = b.age ?? 0;

      if (sortBy === 'overall') return overallB - overallA;
      if (sortBy === 'marketValue') return marketValueB - marketValueA;
      if (sortBy === 'goals') return goalsB - goalsA;
      if (sortBy === 'age') return ageA - ageB;
      return 0;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const offset = (currentPage - 1) * pageSize;
  const displayedPlayers = filtered.slice(offset, offset + pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
            <Users className="w-7 h-7 text-emerald-400" />
            <span>Banco de Dados de Jogadores</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Explore todos os atletas registrados no FM Universe, com atributos detalhados, valores e contratos.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-wrap gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Nome do jogador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Club Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Clube:</span>
          <select
            value={selectedClub}
            onChange={(e) => setSelectedClub(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
          >
            <option value="ALL">Todos os Clubes</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Position Category */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Setor:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
          >
            <option value="ALL">Todas as Posições</option>
            <option value="GOLEIRO">Goleiros</option>
            <option value="DEFENSOR">Defensores</option>
            <option value="MEIO-CAMPISTA">Meio-Campistas</option>
            <option value="ATACANTE">Atacantes</option>
          </select>
        </div>

        {/* Sort By */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-400">Ordenar por:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-emerald-400 font-semibold focus:outline-none"
          >
            <option value="overall">Maior Overall</option>
            <option value="marketValue">Maior Valor de Mercado</option>
            <option value="goals">Mais Gols</option>
            <option value="age">Mais Jovem</option>
          </select>
        </div>
      </div>

      {/* Players Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                <th className="py-3 px-4">Jogador</th>
                <th className="py-3 px-3">Clube</th>
                <th className="py-3 px-3">Pos</th>
                <th className="py-3 px-3 text-center">Idade</th>
                <th className="py-3 px-3 text-center">Nac</th>
                <th className="py-3 px-3 text-center">OVR</th>
                <th className="py-3 px-3 text-center">POT</th>
                <th className="py-3 px-3 text-right">Valor Mercado</th>
                <th className="py-3 px-3 text-right">Salário/Mês</th>
                <th className="py-3 px-3 text-center">Partidas</th>
                <th className="py-3 px-3 text-center">Gols</th>
                <th className="py-3 px-3 text-center">Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-medium">
              {displayedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-500">
                    Nenhum jogador encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                displayedPlayers.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/jogadores/${p.id}`)}
                    className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-500 font-bold text-[11px] w-5">
                          #{p.jerseyNumber ?? '-'}
                        </span>
                        <div>
                          <span className="font-bold text-white hover:text-emerald-400 transition-colors">
                            {p.name || 'Jogador'}
                          </span>
                          {p.knownAs && (
                            <span className="text-slate-400 text-[11px] ml-1.5 font-normal">
                              ({p.knownAs})
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-slate-300">
                      {p.clubName || 'Sem Clube'}
                    </td>
                    <td className="py-3 px-3">
                      <PositionBadge position={p.position || 'MC'} size="xs" />
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-300">{p.age ?? '-'}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-400 text-[11px]">
                      {p.nationalityCode || '-'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <RatingBadge rating={p.overall ?? 70} size="sm" />
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-emerald-400 text-xs">
                      {p.potential ?? p.overall ?? 70}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-400">
                      {formatCurrencyBRL(p.marketValue ?? 0, { compact: true })}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">
                      {formatCurrencyBRL(p.wage ?? 0, { compact: true, decimals: 0 })}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-300">
                      {p.stats?.matches ?? 0}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-rose-400">
                      {p.stats?.goals ?? 0}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-200">
                      {typeof p.stats?.averageRating === 'number'
                        ? p.stats.averageRating.toFixed(1)
                        : '6.5'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="bg-slate-950 px-4 py-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              Mostrando{' '}
              <strong className="text-white">
                {filtered.length === 0 ? 0 : offset + 1}
              </strong>{' '}
              a{' '}
              <strong className="text-white">
                {Math.min(offset + pageSize, filtered.length)}
              </strong>{' '}
              de <strong className="text-emerald-400">{filtered.length}</strong> atletas
            </span>

            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[11px] text-slate-500">Por pág:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-200"
              title="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="font-mono text-xs px-2">
              Página <strong className="text-white">{currentPage}</strong> de{' '}
              <strong className="text-slate-300">{totalPages}</strong>
            </span>

            <button
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-slate-200"
              title="Próxima página"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
