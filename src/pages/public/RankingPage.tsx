import React, { useEffect, useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { jogadoresService } from '../../services/jogadoresService';
import { clubesService } from '../../services/clubesService';
import { Player, Club } from '../../types';
import { formatCurrencyBRL } from '../../utils/currency';
import { PositionBadge, RatingBadge } from '../../components/common/Badge';
import { ClubBadge } from '../../components/common/ClubBadge';
import { Trophy, Flame, Star, Shield, Award } from 'lucide-react';

export const RankingPage: React.FC = () => {
  const { navigate } = useNavigation();
  const [players, setPlayers] = useState<Player[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [activeTab, setActiveTab] = useState<'artilheiros' | 'assistencias' | 'melhores' | 'clubes'>('artilheiros');

  useEffect(() => {
    Promise.all([jogadoresService.getAll(), clubesService.getAll()]).then(([p, c]) => {
      setPlayers(p);
      setClubs(c);
    });
  }, []);

  const topScorers = [...players].sort(
    (a, b) => (b.stats?.goals ?? 0) - (a.stats?.goals ?? 0) || (b.overall ?? 0) - (a.overall ?? 0)
  );
  const topAssists = [...players].sort(
    (a, b) => (b.stats?.assists ?? 0) - (a.stats?.assists ?? 0) || (b.overall ?? 0) - (a.overall ?? 0)
  );
  const topRated = [...players].sort(
    (a, b) => (b.stats?.averageRating ?? 0) - (a.stats?.averageRating ?? 0) || (b.overall ?? 0) - (a.overall ?? 0)
  );
  const topClubs = [...clubs].sort(
    (a, b) => (b.reputation ?? 0) - (a.reputation ?? 0) || (b.trophiesCount ?? 0) - (a.trophiesCount ?? 0)
  );

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
          <Trophy className="w-7 h-7 text-amber-400" />
          <span>Rankings & Líderes Estatísticos</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Artilheiros, assistentes, atletas de maior rendimento e os clubes mais prestigiados da temporada.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2 sm:gap-4 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('artilheiros')}
          className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'artilheiros'
              ? 'text-emerald-400 border-emerald-500'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          Artilharia (Gols)
        </button>
        <button
          onClick={() => setActiveTab('assistencias')}
          className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'assistencias'
              ? 'text-emerald-400 border-emerald-500'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          Garçons (Assistências)
        </button>
        <button
          onClick={() => setActiveTab('melhores')}
          className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'melhores'
              ? 'text-emerald-400 border-emerald-500'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          Notas Médias da Temporada
        </button>
        <button
          onClick={() => setActiveTab('clubes')}
          className={`pb-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'clubes'
              ? 'text-emerald-400 border-emerald-500'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          Reputação de Clubes
        </button>
      </div>

      {/* Tables for each ranking */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          {activeTab === 'artilheiros' && (
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-4">Jogador</th>
                  <th className="py-3 px-3">Clube</th>
                  <th className="py-3 px-3">Posição</th>
                  <th className="py-3 px-3 text-center">Partidas</th>
                  <th className="py-3 px-3 text-center font-bold text-rose-400">Gols Marcados</th>
                  <th className="py-3 px-3 text-center">Média/Jogo</th>
                  <th className="py-3 px-3 text-center">OVR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {topScorers.map((p, idx) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/jogadores/${p.id}`)}
                    className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3 font-mono font-bold text-slate-400">
                      {idx + 1}º
                    </td>
                    <td className="py-3 px-4 font-bold text-white hover:text-emerald-400 whitespace-nowrap">
                      {p.name}
                    </td>
                    <td className="py-3 px-3 text-slate-300">{p.clubName}</td>
                    <td className="py-3 px-3">
                      <PositionBadge position={p.position} size="xs" />
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-300">
                      {p.stats?.matches ?? 0}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-base font-black text-rose-400">
                      {p.stats?.goals ?? 0}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-400">
                      {(p.stats?.matches ?? 0) > 0
                        ? ((p.stats?.goals ?? 0) / (p.stats?.matches ?? 1)).toFixed(2)
                        : '0.00'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <RatingBadge rating={p.overall ?? 70} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'assistencias' && (
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-4">Jogador</th>
                  <th className="py-3 px-3">Clube</th>
                  <th className="py-3 px-3">Posição</th>
                  <th className="py-3 px-3 text-center">Partidas</th>
                  <th className="py-3 px-3 text-center font-bold text-cyan-400">Assistências</th>
                  <th className="py-3 px-3 text-center">OVR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {topAssists.map((p, idx) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/jogadores/${p.id}`)}
                    className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3 font-mono font-bold text-slate-400">
                      {idx + 1}º
                    </td>
                    <td className="py-3 px-4 font-bold text-white hover:text-emerald-400 whitespace-nowrap">
                      {p.name}
                    </td>
                    <td className="py-3 px-3 text-slate-300">{p.clubName}</td>
                    <td className="py-3 px-3">
                      <PositionBadge position={p.position} size="xs" />
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-300">
                      {p.stats?.matches ?? 0}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-base font-black text-cyan-400">
                      {p.stats?.assists ?? 0}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <RatingBadge rating={p.overall ?? 70} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'melhores' && (
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-4">Jogador</th>
                  <th className="py-3 px-3">Clube</th>
                  <th className="py-3 px-3">Posição</th>
                  <th className="py-3 px-3 text-center">Jogos</th>
                  <th className="py-3 px-3 text-center font-bold text-emerald-400">Nota Média</th>
                  <th className="py-3 px-3 text-center">OVR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {topRated.map((p, idx) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/jogadores/${p.id}`)}
                    className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3 font-mono font-bold text-slate-400">
                      {idx + 1}º
                    </td>
                    <td className="py-3 px-4 font-bold text-white hover:text-emerald-400 whitespace-nowrap">
                      {p.name}
                    </td>
                    <td className="py-3 px-3 text-slate-300">{p.clubName}</td>
                    <td className="py-3 px-3">
                      <PositionBadge position={p.position} size="xs" />
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-300">
                      {p.stats?.matches ?? 0}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-base font-black text-emerald-400">
                      {typeof p.stats?.averageRating === 'number'
                        ? p.stats.averageRating.toFixed(2)
                        : '6.50'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <RatingBadge rating={p.overall ?? 70} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'clubes' && (
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-4">Clube</th>
                  <th className="py-3 px-3 text-center">Reputação</th>
                  <th className="py-3 px-3 text-center">Títulos Oficiais</th>
                  <th className="py-3 px-3 text-right">Orçamento Transf.</th>
                  <th className="py-3 px-3">Treinador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium">
                {topClubs.map((c, idx) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/clubes/${c.slug}`)}
                    className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3 font-mono font-bold text-slate-400">
                      {idx + 1}º
                    </td>
                    <td className="py-3 px-4 font-bold text-white hover:text-emerald-400 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <ClubBadge club={c} size="xs" />
                        <span>{c.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-emerald-400">
                      {c.reputation} / 100
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-amber-400 font-bold">
                      {c.trophiesCount}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-400 font-semibold">
                      {formatCurrencyBRL(c.transferBudget, { compact: true })}
                    </td>
                    <td className="py-3 px-3 text-slate-300">{c.managerName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
