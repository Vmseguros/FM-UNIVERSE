import React, { useEffect, useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { clubesService } from '../../services/clubesService';
import { jogadoresService } from '../../services/jogadoresService';
import { competicoesService } from '../../services/competicoesService';
import { jogosService } from '../../services/jogosService';
import { transferenciasService } from '../../services/transferenciasService';
import { calendarioService } from '../../services/calendarioService';
import {
  Sliders,
  Shield,
  Users,
  Trophy,
  Calendar,
  ArrowRightLeft,
  CheckCircle,
  Plus,
  RefreshCw,
  Globe,
  Database,
  DollarSign,
} from 'lucide-react';

export const AdminOverviewPage: React.FC = () => {
  const { navigate } = useNavigation();
  const [counts, setCounts] = useState({
    clubs: 0,
    players: 0,
    competitions: 0,
    matches: 0,
    transfers: 0,
  });

  useEffect(() => {
    Promise.all([
      clubesService.getAll(),
      jogadoresService.getAll(),
      competicoesService.getAll(),
      calendarioService.getCalendarByCompetition('comp-1'),
      transferenciasService.getAll(),
    ]).then(([cl, p, c, m, t]) => {
      setCounts({
        clubs: cl.length,
        players: p.length,
        competitions: c.length,
        matches: m.length,
        transfers: t.length,
      });
    });
  }, []);

  const statsCards = [
    { label: 'Clubes Cadastrados', count: counts.clubs, path: '/admin/clubes', icon: Shield, color: 'emerald' },
    { label: 'Jogadores Registrados', count: counts.players, path: '/admin/jogadores', icon: Users, color: 'cyan' },
    { label: 'Competições & Ligas', count: counts.competitions, path: '/admin/competicoes', icon: Trophy, color: 'amber' },
    { label: 'Partidas Criadas', count: counts.matches, path: '/admin/jogos', icon: Calendar, color: 'purple' },
    { label: 'Transferências Registradas', count: counts.transfers, path: '/transferencias', icon: ArrowRightLeft, color: 'indigo' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-900/40 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Sliders className="w-6 h-6 text-purple-400" />
            <span>Centro de Controle Administrativo</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Painel mestre para gerenciar equipes, atletas, ligas e parâmetros do ecossistema FM Universe.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/admin/importar-fm26')}
            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Database className="w-4 h-4" />
            <span>Importar Banco FM26</span>
          </button>
          <div className="hidden sm:flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-purple-900/40 text-xs">
            <Database className="w-4 h-4 text-purple-400" />
            <span className="text-slate-300">DataStore: <strong className="text-purple-300">Firestore-First / Fallback Ativo</strong></span>
          </div>
        </div>
      </div>

      {/* Universe Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {statsCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              onClick={() => navigate(card.path)}
              className="bg-slate-900 border border-slate-800 hover:border-purple-500/50 p-4 rounded-xl cursor-pointer transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs">{card.label}</span>
                <Icon className="w-4 h-4 text-purple-400" />
              </div>
              <span className="font-mono text-2xl font-black text-white">{card.count}</span>
            </div>
          );
        })}
      </div>

      {/* Quick Action Hub */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4 text-purple-400" />
          Ações Rápidas de Gerenciamento
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <button
            onClick={() => navigate('/admin/financas')}
            className="bg-slate-950 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-600/40 p-4 rounded-xl text-left transition-all cursor-pointer"
          >
            <DollarSign className="w-5 h-5 text-purple-400 mb-2" />
            <h3 className="font-bold text-xs text-white">Configuração Financeira</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Orçamentos, TV, patrocínios e cotas</p>
          </button>

          <button
            onClick={() => navigate('/admin/clubes')}
            className="bg-slate-950 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-600/40 p-4 rounded-xl text-left transition-all cursor-pointer"
          >
            <Shield className="w-5 h-5 text-emerald-400 mb-2" />
            <h3 className="font-bold text-xs text-white">Adicionar Clube</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Criar time com estádio e orçamento</p>
          </button>

          <button
            onClick={() => navigate('/admin/jogadores')}
            className="bg-slate-950 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-600/40 p-4 rounded-xl text-left transition-all"
          >
            <Users className="w-5 h-5 text-cyan-400 mb-2" />
            <h3 className="font-bold text-xs text-white">Cadastrar Jogador</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Definir atributos, overall e salário</p>
          </button>

          <button
            onClick={() => navigate('/admin/importar-fm26')}
            className="bg-slate-950 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-600/40 p-4 rounded-xl text-left transition-all"
          >
            <Database className="w-5 h-5 text-purple-400 mb-2" />
            <h3 className="font-bold text-xs text-white">Importar Banco FM26</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Validador de CSV do Football Manager</p>
          </button>

          <button
            onClick={() => navigate('/admin/jogos')}
            className="bg-slate-950 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-600/40 p-4 rounded-xl text-left transition-all"
          >
            <Calendar className="w-5 h-5 text-purple-400 mb-2" />
            <h3 className="font-bold text-xs text-white">Criar Nova Partida</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Agendar confronto e súmula</p>
          </button>

          <button
            onClick={() => navigate('/admin/universo')}
            className="bg-slate-950 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-600/40 p-4 rounded-xl text-left transition-all"
          >
            <Globe className="w-5 h-5 text-amber-400 mb-2" />
            <h3 className="font-bold text-xs text-white">Configurar Temporada</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Ajustar parâmetros e ligas</p>
          </button>
        </div>
      </div>
    </div>
  );
};
