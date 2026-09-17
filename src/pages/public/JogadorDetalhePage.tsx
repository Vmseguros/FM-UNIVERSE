import React, { useEffect, useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { jogadoresService } from '../../services/jogadoresService';
import { Player } from '../../types';
import { formatCurrencyBRL } from '../../utils/currency';
import { PositionBadge, RatingBadge } from '../../components/common/Badge';
import { StatProgressBar } from '../../components/common/StatProgressBar';
import {
  User,
  ArrowLeft,
  Shield,
  Zap,
  Activity,
  Award,
  DollarSign,
  Calendar,
  Smile,
  HeartPulse,
} from 'lucide-react';

export const JogadorDetalhePage: React.FC = () => {
  const { params, navigate } = useNavigation();
  const [player, setPlayer] = useState<Player | null>(null);

  useEffect(() => {
    const id = params.id || 'p-11';
    jogadoresService.getById(id).then(setPlayer);
  }, [params.id]);

  if (!player) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400">Carregando dados do jogador...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/jogadores')}
        className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar para lista de jogadores</span>
      </button>

      {/* Player Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Jersey number circle */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-950 border-2 border-emerald-500/60 flex flex-col items-center justify-center text-white font-mono shadow-xl">
              <span className="text-xs text-slate-400 font-sans uppercase">Camisa</span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                {player.jerseyNumber ?? '-'}
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h1 className="text-2xl sm:text-3xl font-black text-white">{player.name}</h1>
                {player.knownAs && (
                  <span className="text-base text-emerald-400 font-semibold">
                    "{player.knownAs}"
                  </span>
                )}
                <PositionBadge position={player.position || 'MC'} size="md" />
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span
                  onClick={() => navigate(`/clubes/${player.clubId}`)}
                  className="text-white hover:text-emerald-400 font-semibold cursor-pointer underline decoration-slate-700"
                >
                  {player.clubName || 'Sem Clube'}
                </span>
                <span>•</span>
                <span>{player.age ?? 22} anos</span>
                <span>•</span>
                <span>{player.nationality || 'Brasil'} ({player.nationalityCode || 'BRA'})</span>
                <span>•</span>
                <span>Pé preferido: <strong>{player.preferredFoot || 'Destro'}</strong></span>
              </div>
            </div>
          </div>

          {/* OVR & Potential badges */}
          <div className="flex items-center gap-3 self-end sm:self-center">
            <div className="text-center">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold mb-1">
                Overall
              </span>
              <RatingBadge rating={player.overall ?? 70} size="lg" />
            </div>
            <div className="text-center">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold mb-1">
                Potencial
              </span>
              <div className="w-10 h-10 rounded-md bg-slate-950 border border-emerald-500/60 flex items-center justify-center font-mono text-emerald-400 text-base font-black">
                {player.potential ?? player.overall ?? 70}
              </div>
            </div>
          </div>
        </div>

        {/* Contract & Value quick bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Valor de Mercado</span>
            <span className="font-mono text-base font-bold text-emerald-400">
              {formatCurrencyBRL(player.marketValue, { compact: true })}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Salário Mensal</span>
            <span className="font-mono text-base font-bold text-white">
              {formatCurrencyBRL(player.wage, { compact: true, decimals: 0 })}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Contrato Vigente</span>
            <span className="font-mono text-sm font-semibold text-slate-200">
              Até {player.contractUntil}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Moral & Status</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Smile className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-emerald-400">{player.morale}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Attributes & Season Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Core Attributes (FM Style cluster) */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <h2 className="font-bold text-sm text-white uppercase tracking-wider">
                Atributos Principais
              </h2>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Escala 0-99</span>
          </div>

          <div className="space-y-3">
            <StatProgressBar
              label="Velocidade & Aceleração (Pace)"
              value={player.attributes?.pace ?? 70}
              color="emerald"
            />
            <StatProgressBar
              label="Finalização & Chute (Shooting)"
              value={player.attributes?.shooting ?? 65}
              color="rose"
            />
            <StatProgressBar
              label="Passe & Visão de Jogo (Passing)"
              value={player.attributes?.passing ?? 70}
              color="cyan"
            />
            <StatProgressBar
              label="Drible & Agilidade (Dribbling)"
              value={player.attributes?.dribbling ?? 70}
              color="indigo"
            />
            <StatProgressBar
              label="Marcação & Desarme (Defending)"
              value={player.attributes?.defending ?? 60}
              color="amber"
            />
            <StatProgressBar
              label="Físico & Resistência (Physical)"
              value={player.attributes?.physical ?? 70}
              color="emerald"
            />
          </div>

          {/* Condition & Fitness */}
          <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-3">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <HeartPulse className="w-3.5 h-3.5 text-emerald-400" />
                <span>Condição de Jogo</span>
              </div>
              <StatProgressBar value={player.condition ?? 95} color="emerald" size="sm" />
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Status Físico</span>
              </div>
              <span className="text-xs font-bold text-emerald-400">Apto para 90 min</span>
            </div>
          </div>
        </div>

        {/* Season Statistics */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h2 className="font-bold text-sm text-white uppercase tracking-wider">
                Estatísticas da Temporada 2026/2027
              </h2>
            </div>
            <span className="text-xs font-bold text-emerald-400 font-mono">
              Nota Média: {player.stats.averageRating.toFixed(2)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Partidas Disputadas</span>
              <span className="font-mono text-xl font-bold text-white">
                {player.stats.matches}
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Gols Marcados</span>
              <span className="font-mono text-xl font-bold text-rose-400">
                {player.stats.goals}
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Assistências</span>
              <span className="font-mono text-xl font-bold text-cyan-400">
                {player.stats.assists}
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Minutos em Campo</span>
              <span className="font-mono text-xl font-bold text-slate-300">
                {player.stats.minutesPlayed}'
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Cartões Amarelos</span>
              <span className="font-mono text-xl font-bold text-amber-400">
                {player.stats.yellowCards}
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Jogos sem Levar Gol</span>
              <span className="font-mono text-xl font-bold text-emerald-400">
                {player.stats.cleanSheets}
              </span>
            </div>
          </div>

          {/* Performance narrative */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs leading-relaxed text-slate-300">
            <span className="font-bold text-white block mb-1">Parecer dos Olheiros:</span>
            Atleta de nível técnico destacado na Liga FM Universe. Apresenta grande compostura sob pressão, consistência de nota ({player.stats.averageRating.toFixed(1)}) e forte impacto ofensivo para sua equipe.
          </div>
        </div>
      </div>
    </div>
  );
};
