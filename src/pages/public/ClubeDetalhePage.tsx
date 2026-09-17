import React, { useEffect, useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useAuth } from '../../contexts/AuthContext';
import { clubesService } from '../../services/clubesService';
import { jogadoresService } from '../../services/jogadoresService';
import { Club, Player } from '../../types';
import { formatCurrencyBRL } from '../../utils/currency';
import { PositionBadge, RatingBadge } from '../../components/common/Badge';
import { ClubBadge } from '../../components/common/ClubBadge';
import {
  Shield,
  Building2,
  Users,
  DollarSign,
  Trophy,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Target,
  Award,
} from 'lucide-react';

export const ClubeDetalhePage: React.FC = () => {
  const { params, navigate } = useNavigation();
  const { managedClub, firebaseUser, isManager } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [squad, setSquad] = useState<Player[]>([]);
  const [activeTab, setActiveTab] = useState<'elenco' | 'estatisticas' | 'estadio'>('elenco');

  useEffect(() => {
    const slugOrId = params.slug || params.id || 'fm-united';
    clubesService.getBySlug(slugOrId).then(async (c) => {
      let resolvedClub = c;
      if (!resolvedClub) {
        resolvedClub = await clubesService.getById(slugOrId);
      }
      if (resolvedClub) {
        setClub(resolvedClub);
        jogadoresService.getByClubId(resolvedClub.id).then(setSquad);
      }
    });
  }, [params.slug, params.id]);

  if (!club) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400">Carregando informações do clube...</p>
      </div>
    );
  }

  const isCurrentManaged = Boolean(managedClub?.id && managedClub.id === club.id);

  const categories = ['GOLEIRO', 'DEFENSOR', 'MEIO-CAMPISTA', 'ATACANTE'] as const;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/clubes')}
        className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar para lista de clubes</span>
      </button>

      {/* Club Hero Banner */}
      <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <ClubBadge club={club} size="xl" className="shadow-xl" />
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl sm:text-3xl font-black text-white">{club.name}</h1>
                <span className="bg-slate-800 text-emerald-400 text-xs font-mono font-bold px-2 py-0.5 rounded border border-slate-700">
                  {club.code}
                </span>
                <span className="bg-emerald-500/15 text-emerald-400 text-xs font-mono px-2 py-0.5 rounded border border-emerald-500/30">
                  Reputação {club.reputation}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  {club.stadiumName} ({(club.capacity / 1000).toFixed(1)}k)
                </span>
                <span>•</span>
                <span>Fundado em {club.foundedYear}</span>
                <span>•</span>
                <span>Treinador: <strong className="text-slate-200">{club.managerName}</strong></span>
              </p>
            </div>
          </div>

          {/* Quick Management Action */}
          <div>
            {isCurrentManaged ? (
              <button
                onClick={() => navigate('/manager')}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm shadow-lg shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
              >
                <Award className="w-4 h-4" />
                <span>Abrir Painel do Treinador</span>
              </button>
            ) : !firebaseUser ? (
              <button
                onClick={() => navigate('/login')}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-all"
              >
                <Award className="w-4 h-4 text-emerald-400" />
                <span>Área do Treinador (Login)</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Club Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block font-medium">Orçamento de Compras</span>
            <span className="font-mono text-base sm:text-lg font-bold text-emerald-400">
              {formatCurrencyBRL(club.transferBudget, { compact: true })}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block font-medium">Folha Salarial / Mês</span>
            <span className="font-mono text-base sm:text-lg font-bold text-slate-200">
              {formatCurrencyBRL(club.wageBudget, { compact: true, decimals: 2 })}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block font-medium">Títulos Oficiais</span>
            <span className="font-mono text-base sm:text-lg font-bold text-amber-400 flex items-center gap-1">
              <Trophy className="w-4 h-4 text-amber-400" />
              {club.trophiesCount} Troféus
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block font-medium">Torcedores Estimados</span>
            <span className="font-mono text-base sm:text-lg font-bold text-slate-300">
              {(club.fansCount / 1000000).toFixed(2)}M
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-4">
        <button
          onClick={() => setActiveTab('elenco')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'elenco'
              ? 'text-emerald-400 border-emerald-500'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          Elenco Completo ({squad.length} Jogadores)
        </button>
        <button
          onClick={() => setActiveTab('estatisticas')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'estatisticas'
              ? 'text-emerald-400 border-emerald-500'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          Metas & Diretoria
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'elenco' ? (
        <div className="space-y-6">
          {categories.map((cat) => {
            const catPlayers = squad.filter((p) => p.positionCategory === cat);
            if (catPlayers.length === 0) return null;

            return (
              <div key={cat} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex justify-between items-center text-xs font-bold text-slate-300 uppercase tracking-wider">
                  <span>{cat}S ({catPlayers.length})</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-800/80 font-mono text-[11px]">
                        <th className="py-2.5 px-3">Nº</th>
                        <th className="py-2.5 px-3">Jogador</th>
                        <th className="py-2.5 px-3">Posição</th>
                        <th className="py-2.5 px-3">Idade</th>
                        <th className="py-2.5 px-3">Nac.</th>
                        <th className="py-2.5 px-3 text-center">OVR</th>
                        <th className="py-2.5 px-3 text-center">POT</th>
                        <th className="py-2.5 px-3 text-right">Salário</th>
                        <th className="py-2.5 px-3 text-right">Valor</th>
                        <th className="py-2.5 px-3 text-center">Jogos</th>
                        <th className="py-2.5 px-3 text-center">Gols</th>
                        <th className="py-2.5 px-3 text-center">Nota</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {catPlayers.map((player) => (
                        <tr
                          key={player.id}
                          onClick={() => navigate(`/jogadores/${player.id}`)}
                          className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 px-3 font-mono text-slate-400 font-bold">
                            {player.jerseyNumber}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-bold text-white hover:text-emerald-400 transition-colors">
                              {player.name}
                            </span>
                            {player.knownAs && (
                              <span className="text-[11px] text-slate-400 ml-1.5 font-normal">
                                ({player.knownAs})
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <PositionBadge position={player.position} size="xs" />
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-300">{player.age}</td>
                          <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                            {player.nationalityCode}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <RatingBadge rating={player.overall} size="sm" />
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-400 text-xs">
                            {player.potential}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                            {formatCurrencyBRL(player.wage, { compact: true, decimals: 0 })}/mês
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-400">
                            {formatCurrencyBRL(player.marketValue, { compact: true })}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                            {player.stats.matches}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-rose-400 font-bold">
                            {player.stats.goals}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-200">
                            {player.stats.averageRating.toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              Objetivos da Diretoria para a Temporada
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800">
              "{club.boardExpectation}"
            </p>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>Alvo da Liga:</span>
                <span className="text-white font-semibold">{club.seasonTarget}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>Estabilidade Financeira:</span>
                <span className="text-emerald-400 font-semibold">Excelente (Superavitária)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span>Desenvolvimento de Jovens:</span>
                <span className="text-white font-semibold">Prioridade Alta</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-cyan-400" />
              Instalações do Clube
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Estádio ({club.stadiumName})</span>
                  <span className="font-mono text-emerald-400 font-bold">Nível 4/5</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-4/5" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Centro de Treinamento</span>
                  <span className="font-mono text-emerald-400 font-bold">Nível 5/5</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-full" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Categorias de Base</span>
                  <span className="font-mono text-emerald-400 font-bold">Nível 4/5</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-4/5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
