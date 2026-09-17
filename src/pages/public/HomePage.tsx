import React, { useEffect, useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useAuth } from '../../contexts/AuthContext';
import { clubesService } from '../../services/clubesService';
import { competicoesService } from '../../services/competicoesService';
import { jogosService } from '../../services/jogosService';
import { jogadoresService } from '../../services/jogadoresService';
import { transferenciasService } from '../../services/transferenciasService';
import { noticiasService } from '../../services/noticiasService';
import { Club, Competition, Match, Player, Transfer, News } from '../../types';
import { formatCurrencyBRL } from '../../utils/currency';
import { PositionBadge, RatingBadge } from '../../components/common/Badge';
import { ClubBadge } from '../../components/common/ClubBadge';
import {
  Trophy,
  Calendar,
  ArrowRight,
  TrendingUp,
  Flame,
  ArrowLeftRight,
  Newspaper,
  Shield,
  Clock,
  ChevronRight,
  Star,
  Activity,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const { navigate } = useNavigation();
  const { setRole, setManagedClubId } = useAuth();

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [news, setNews] = useState<News[]>([]);

  useEffect(() => {
    Promise.all([
      competicoesService.getAll(),
      jogosService.getAll(),
      clubesService.getAll(),
      jogadoresService.getAll(),
      transferenciasService.getAll(),
      noticiasService.getAll(),
    ]).then(([c, m, cl, p, t, n]) => {
      setCompetitions(c);
      setMatches(m);
      setClubs(cl);
      setPlayers(p);
      setTransfers(t);
      setNews(n);
    });
  }, []);

  const currentComp = competitions[0];
  const standings = currentComp?.standings || [];
  const scheduledMatches = matches.filter((m) => m.status === 'SCHEDULED').slice(0, 3);
  const finishedMatches = matches.filter((m) => m.status === 'FINISHED').slice(-3).reverse();

  // Top scorers calculation
  const topScorers = [...players]
    .sort((a, b) => (b.stats?.goals ?? 0) - (a.stats?.goals ?? 0) || (b.overall ?? 0) - (a.overall ?? 0))
    .slice(0, 5);

  // Featured players (highest overall / potential)
  const featuredPlayers = [...players]
    .sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0))
    .slice(0, 4);

  return (
    <div className="space-y-8">
      {/* Hero Portal Header */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/60 border border-slate-800 p-6 sm:p-8">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-xs text-emerald-400 font-semibold mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Temporada 2026/2027 em Andamento • Rodada 5
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight mb-3">
            O Universo da Gestão do Futebol ao Seu Alcance
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6">
            Acompanhe a tabela ao vivo, estatísticas de atletas, transferências de peso e assuma o comando do seu clube favorito no simulador de gestão mais completo.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                setRole('MANAGER');
                navigate('/dashboard');
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Gerenciar Minha Equipe</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/competicoes')}
              className="bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs sm:text-sm border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Ver Tabela & Jogos</span>
            </button>
          </div>
        </div>

        {/* Decorative background watermark */}
        <div className="absolute -right-8 -bottom-10 opacity-5 pointer-events-none text-9xl font-black select-none text-emerald-400">
          FM
        </div>
      </section>

      {/* Grid: Matches & Live Standings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Matches (Scheduled & Recent) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Next Matches */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <h2 className="font-bold text-sm text-white uppercase tracking-wider">Próximos Jogos</h2>
              </div>
              <button
                onClick={() => navigate('/jogos')}
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>Ver todos</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {scheduledMatches.map((m) => (
                <div
                  key={m.id}
                  onClick={() => navigate(`/jogos/${m.id}`)}
                  className="bg-slate-950/80 hover:bg-slate-800/60 p-3 rounded-lg border border-slate-800 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 font-mono">
                    <span>{m.competitionName} • Rodada {m.round}</span>
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <Clock className="w-3 h-3" />
                      {m.date.split('-').slice(1).join('/')} - {m.time}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs sm:text-sm text-white group-hover:text-emerald-400 transition-colors">
                      {m.homeClubName}
                    </span>
                    <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-xs font-mono font-bold">
                      VS
                    </span>
                    <span className="font-semibold text-xs sm:text-sm text-white group-hover:text-emerald-400 transition-colors text-right">
                      {m.awayClubName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Results */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h2 className="font-bold text-sm text-white uppercase tracking-wider">Últimos Resultados</h2>
              </div>
              <button
                onClick={() => navigate('/jogos')}
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>Súmulas</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {finishedMatches.map((m) => (
                <div
                  key={m.id}
                  onClick={() => navigate(`/jogos/${m.id}`)}
                  className="bg-slate-950/80 hover:bg-slate-800/60 p-3 rounded-lg border border-slate-800 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1 font-mono">
                    <span>Rodada {m.round}</span>
                    <span className="text-slate-500">{m.stadiumName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs sm:text-sm text-white flex-1">{m.homeClubName}</span>
                    <div className="bg-slate-800 px-2.5 py-0.5 rounded text-xs font-mono font-black text-emerald-400 tracking-wider mx-2">
                      {m.homeScore} - {m.awayScore}
                    </div>
                    <span className="font-semibold text-xs sm:text-sm text-white flex-1 text-right">{m.awayClubName}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Standings & Top Scorers */}
        <div className="lg:col-span-7 space-y-6">
          {/* Standings Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h2 className="font-bold text-sm text-white uppercase tracking-wider">
                  Classificação • {currentComp?.name || 'Liga FM Universe'}
                </h2>
              </div>
              <button
                onClick={() => navigate(`/competicoes/${currentComp?.id || 'comp-1'}`)}
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>Tabela Completa</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                    <th className="py-2 px-2">#</th>
                    <th className="py-2 px-3">Clube</th>
                    <th className="py-2 px-2 text-center">J</th>
                    <th className="py-2 px-2 text-center">V</th>
                    <th className="py-2 px-2 text-center">E</th>
                    <th className="py-2 px-2 text-center">D</th>
                    <th className="py-2 px-2 text-center">SG</th>
                    <th className="py-2 px-2 text-center font-bold text-white">PTS</th>
                    <th className="py-2 px-2 text-center hidden sm:table-cell">Forma</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {standings.map((s, idx) => (
                    <tr
                      key={s.clubId}
                      onClick={() => navigate(`/clubes/${s.clubSlug}`)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-2 px-2 font-mono">
                        <span
                          className={`w-5 h-5 inline-flex items-center justify-center rounded text-[10px] font-bold ${
                            idx === 0
                              ? 'bg-amber-500/20 text-amber-400'
                              : idx < 3
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {s.position}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-semibold text-white whitespace-nowrap">
                        {s.clubName}
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-slate-300">{s.played}</td>
                      <td className="py-2 px-2 text-center font-mono text-slate-300">{s.won}</td>
                      <td className="py-2 px-2 text-center font-mono text-slate-300">{s.drawn}</td>
                      <td className="py-2 px-2 text-center font-mono text-slate-300">{s.lost}</td>
                      <td className="py-2 px-2 text-center font-mono text-slate-300">
                        {s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}
                      </td>
                      <td className="py-2 px-2 text-center font-mono font-black text-emerald-400 text-sm">
                        {s.points}
                      </td>
                      <td className="py-2 px-2 text-center hidden sm:table-cell">
                        <div className="flex items-center justify-center gap-1">
                          {s.form.map((f, i) => (
                            <span
                              key={i}
                              className={`w-4 h-4 rounded-full text-[9px] font-bold inline-flex items-center justify-center ${
                                f === 'W'
                                  ? 'bg-emerald-600 text-white'
                                  : f === 'D'
                                  ? 'bg-slate-700 text-slate-300'
                                  : 'bg-rose-600 text-white'
                              }`}
                            >
                              {f === 'W' ? 'V' : f === 'D' ? 'E' : 'D'}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Scorers & Assists summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-500" />
                <h2 className="font-bold text-sm text-white uppercase tracking-wider">Artilharia da Liga</h2>
              </div>
              <button
                onClick={() => navigate('/ranking')}
                className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>Ver ranking</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {topScorers.map((p, idx) => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/jogadores/${p.id}`)}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-slate-500 w-4 font-bold">{idx + 1}º</span>
                    <PositionBadge position={p.position} size="xs" />
                    <div>
                      <div className="font-bold text-xs text-white hover:text-emerald-400">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-slate-400">{p.clubName}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="font-mono text-base font-black text-rose-400">
                        {p.stats?.goals ?? 0}
                      </span>
                      <span className="text-[10px] text-slate-500 block">gols</span>
                    </div>
                    <RatingBadge rating={p.overall ?? 70} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Featured Clubs Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h2 className="font-bold text-base text-white uppercase tracking-wider">Clubes em Destaque</h2>
          </div>
          <button
            onClick={() => navigate('/clubes')}
            className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
          >
            <span>Ver todos os 6 clubes</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clubs.slice(0, 3).map((club) => (
            <div
              key={club.id}
              onClick={() => navigate(`/clubes/${club.slug}`)}
              className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-xl p-5 shadow-sm transition-all hover:-translate-y-0.5 cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <ClubBadge club={club} size="md" className="group-hover:scale-105 transition-transform" />
                  <div>
                    <h3 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors">
                      {club.name}
                    </h3>
                    <p className="text-xs text-slate-400">{club.stadiumName}</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold bg-slate-800 text-emerald-400 px-2 py-0.5 rounded border border-slate-700">
                  Rep {club.reputation}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center py-2 bg-slate-950/60 rounded-lg border border-slate-800/80 mb-4">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Elenco</span>
                  <span className="font-mono font-bold text-xs text-white">{club.squadCount} atletas</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Títulos</span>
                  <span className="font-mono font-bold text-xs text-amber-400">{club.trophiesCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Orçamento</span>
                  <span className="font-mono font-bold text-xs text-emerald-400">
                    {formatCurrencyBRL(club.transferBudget, { compact: true })}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                <span className="text-slate-400">Treinador:</span>
                <span className="font-medium text-slate-200">{club.managerName}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Latest News & Transfers Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest News */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-emerald-400" />
              <h2 className="font-bold text-sm text-white uppercase tracking-wider">Notícias do Universo</h2>
            </div>
            <button
              onClick={() => navigate('/noticias')}
              className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>Ver notícias</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {news.slice(0, 2).map((item) => (
              <div
                key={item.id}
                onClick={() => navigate('/noticias')}
                className="group cursor-pointer bg-slate-950/60 p-3 rounded-lg border border-slate-800 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-1">
                  <span className="text-emerald-400 font-semibold">{item.category}</span>
                  <span>•</span>
                  <span>{item.date}</span>
                </div>
                <h3 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors mb-1.5">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {item.summary}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Latest Transfers */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-indigo-400" />
              <h2 className="font-bold text-sm text-white uppercase tracking-wider">Mercado de Transferências</h2>
            </div>
            <button
              onClick={() => navigate('/transferencias')}
              className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>Central do Mercado</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {transfers.slice(0, 4).map((tr) => (
              <div
                key={tr.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <PositionBadge position={tr.playerPosition} size="xs" />
                  <div>
                    <div className="font-bold text-white">{tr.playerName}</div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <span>{tr.fromClubName}</span>
                      <ArrowRight className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">{tr.toClubName}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono font-bold text-emerald-400 block">
                    {tr.fee > 0 ? formatCurrencyBRL(tr.fee, { compact: true }) : 'Sem Custos'}
                  </span>
                  <span
                    className={`text-[10px] font-semibold uppercase ${
                      tr.status === 'COMPLETED' ? 'text-green-400' : 'text-amber-400'
                    }`}
                  >
                    {tr.status === 'COMPLETED' ? 'Oficial' : 'Rumor'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
