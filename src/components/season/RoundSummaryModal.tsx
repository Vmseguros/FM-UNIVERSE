import React, { useState } from 'react';
import {
  Trophy,
  X,
  TrendingUp,
  DollarSign,
  Tv,
  Building,
  Users,
  Shield,
  Calendar,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Award,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { RoundSummaryData } from '../../types';
import { formatCurrencyBRL } from '../../utils/currency';

interface RoundSummaryModalProps {
  data: RoundSummaryData | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RoundSummaryModal: React.FC<RoundSummaryModalProps> = ({ data, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'MATCH' | 'STANDINGS' | 'FINANCE' | 'OTHERS'>('MATCH');

  if (!isOpen || !data) return null;

  const {
    round,
    seasonYear,
    competitionName,
    userMatch,
    allMatches,
    financialBreakdown,
    updatedStandings,
    previousPosition,
    newPosition,
    eventsHighlights,
  } = data;

  const isWin = financialBreakdown.matchResult === 'WIN';
  const isDraw = financialBreakdown.matchResult === 'DRAW';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black">
              {round}ª
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white uppercase tracking-tight">
                  Resumo Oficial da {round}ª Rodada
                </h2>
                <span className="text-[10px] font-mono bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2 py-0.5 rounded">
                  {competitionName} • {seasonYear}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Homologação esportiva e contábil processada com sucesso.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Placar Principal Banner */}
        <div
          className={`px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 ${
            isWin
              ? 'bg-emerald-950/20'
              : isDraw
              ? 'bg-amber-950/20'
              : 'bg-rose-950/20'
          }`}
        >
          <div className="flex items-center justify-center gap-4 sm:gap-8 w-full sm:w-auto">
            <div className="text-center sm:text-right">
              <span className="text-xs text-slate-400 block">Mandante</span>
              <strong className="text-white text-base sm:text-lg font-bold">
                {userMatch.homeClubName}
              </strong>
            </div>

            <div className="px-4 py-1.5 rounded-xl bg-slate-950 border border-slate-800 font-mono font-black text-2xl text-white tracking-widest">
              {userMatch.homeScore ?? 0} <span className="text-slate-500 text-lg">x</span>{' '}
              {userMatch.awayScore ?? 0}
            </div>

            <div className="text-center sm:text-left">
              <span className="text-xs text-slate-400 block">Visitante</span>
              <strong className="text-white text-base sm:text-lg font-bold">
                {userMatch.awayClubName}
              </strong>
            </div>
          </div>

          {/* Resultado & Público */}
          <div className="flex items-center gap-3 text-xs">
            <div
              className={`px-3 py-1.5 rounded-lg border font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isWin
                  ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50'
                  : isDraw
                  ? 'bg-amber-900/40 text-amber-300 border-amber-700/50'
                  : 'bg-rose-900/40 text-rose-300 border-rose-700/50'
              }`}
            >
              {isWin ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {isWin ? 'Vitória (+3 pts)' : isDraw ? 'Empate (+1 pt)' : 'Derrota (0 pt)'}
            </div>

            <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300">
              <span className="text-[10px] text-slate-500 block">Público Pagante</span>
              <strong className="font-mono text-white">
                {financialBreakdown.attendance.toLocaleString('pt-BR')}{' '}
                <span className="text-[10px] text-slate-500">
                  / {financialBreakdown.stadiumCapacity.toLocaleString('pt-BR')}
                </span>
              </strong>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-6 gap-2 text-xs font-bold uppercase tracking-wider">
          <button
            onClick={() => setActiveTab('MATCH')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'MATCH'
                ? 'border-emerald-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" /> Partida & Estatísticas
          </button>
          <button
            onClick={() => setActiveTab('FINANCE')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'FINANCE'
                ? 'border-emerald-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4" /> Extrato Financeiro da Rodada
          </button>
          <button
            onClick={() => setActiveTab('STANDINGS')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'STANDINGS'
                ? 'border-emerald-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Trophy className="w-4 h-4" /> Classificação Atualizada
          </button>
          <button
            onClick={() => setActiveTab('OTHERS')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'OTHERS'
                ? 'border-emerald-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" /> Outros Jogos ({allMatches.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* TAB 1: DETALHES DA PARTIDA */}
          {activeTab === 'MATCH' && (
            <div className="space-y-4">
              {/* Eventos / Gols */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Acontecimentos e Gols
                </span>
                {eventsHighlights.length > 0 ? (
                  <div className="space-y-1.5">
                    {eventsHighlights.map((hl, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-slate-300 font-mono text-xs bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800"
                      >
                        <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{hl}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 italic text-xs">Nenhum gol marcado na partida.</p>
                )}
              </div>

              {/* Estatísticas Comparadas */}
              {userMatch.stats && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Estatísticas da Partida
                  </span>
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>{userMatch.stats.possession[0]}%</span>
                        <span className="font-bold text-slate-300">Posse de Bola</span>
                        <span>{userMatch.stats.possession[1]}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
                        <div
                          className="bg-emerald-500 h-full"
                          style={{ width: `${userMatch.stats.possession[0]}%` }}
                        />
                        <div
                          className="bg-cyan-500 h-full"
                          style={{ width: `${userMatch.stats.possession[1]}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                      <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block text-[10px]">Finalizações</span>
                        <strong className="text-white text-sm font-mono">
                          {userMatch.stats.shots[0]} vs {userMatch.stats.shots[1]}
                        </strong>
                      </div>
                      <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block text-[10px]">No Alvo</span>
                        <strong className="text-white text-sm font-mono">
                          {userMatch.stats.shotsOnTarget[0]} vs {userMatch.stats.shotsOnTarget[1]}
                        </strong>
                      </div>
                      <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block text-[10px]">Escanteios</span>
                        <strong className="text-white text-sm font-mono">
                          {userMatch.stats.corners[0]} vs {userMatch.stats.corners[1]}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EXTRATO FINANCEIRO DA RODADA */}
          {activeTab === 'FINANCE' && (
            <div className="space-y-5">
              {/* Balanço Geral da Rodada */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Saldo Anterior
                  </span>
                  <span className="text-base font-mono font-bold text-slate-200">
                    {formatCurrencyBRL(financialBreakdown.previousBalance)}
                  </span>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-emerald-400 uppercase font-bold block">
                    Receitas da Rodada (+)
                  </span>
                  <span className="text-base font-mono font-bold text-emerald-400">
                    +{formatCurrencyBRL(financialBreakdown.incomes.totalIncome)}
                  </span>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-rose-400 uppercase font-bold block">
                    Despesas da Rodada (-)
                  </span>
                  <span className="text-base font-mono font-bold text-rose-400">
                    -{formatCurrencyBRL(financialBreakdown.expenses.totalExpense)}
                  </span>
                </div>

                <div
                  className={`p-3.5 rounded-xl border ${
                    financialBreakdown.netAmount >= 0
                      ? 'bg-emerald-950/40 border-emerald-800/60'
                      : 'bg-rose-950/40 border-rose-800/60'
                  }`}
                >
                  <span className="text-[10px] text-slate-300 uppercase font-bold block">
                    Novo Saldo em Caixa
                  </span>
                  <span
                    className={`text-base font-mono font-black ${
                      financialBreakdown.netAmount >= 0 ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {formatCurrencyBRL(financialBreakdown.newBalance)}
                  </span>
                </div>
              </div>

              {/* Detalhamento das Receitas e Despesas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Receitas */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" /> Receitas Efetivadas da Rodada
                  </span>

                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-400">Bilheteria & Matchday:</span>
                      <strong className="text-emerald-400 font-mono">
                        {financialBreakdown.isHomeMatch
                          ? formatCurrencyBRL(financialBreakdown.incomes.ticketSales)
                          : 'R$ 0 (Visitante)'}
                      </strong>
                    </div>

                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-400">Cota de TV por Rodada:</span>
                      <strong className="text-emerald-400 font-mono">
                        {formatCurrencyBRL(financialBreakdown.incomes.tvRights)}
                      </strong>
                    </div>

                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-400">Patrocínios Homologados:</span>
                      <strong className="text-emerald-400 font-mono">
                        {formatCurrencyBRL(financialBreakdown.incomes.sponsorships)}
                      </strong>
                    </div>

                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-400">Bônus & Premiação Esportiva:</span>
                      <strong className="text-emerald-400 font-mono">
                        {formatCurrencyBRL(
                          financialBreakdown.incomes.prizeMoney + financialBreakdown.incomes.bonuses
                        )}
                      </strong>
                    </div>

                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-400">Merchandising & Loja:</span>
                      <strong className="text-emerald-400 font-mono">
                        {formatCurrencyBRL(financialBreakdown.incomes.merchandising)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Despesas */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
                  <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" /> Despesas & Rateios Operacionais
                  </span>

                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-400">Folha Salarial do Elenco (Semanal):</span>
                      <strong className="text-rose-400 font-mono">
                        -{formatCurrencyBRL(financialBreakdown.expenses.payrollWageShare)}
                      </strong>
                    </div>

                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-400">Comissão Técnica e Staff:</span>
                      <strong className="text-rose-400 font-mono">
                        -{formatCurrencyBRL(financialBreakdown.expenses.staffWageShare)}
                      </strong>
                    </div>

                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-400">Operação e Manutenção do Estádio:</span>
                      <strong className="text-rose-400 font-mono">
                        {financialBreakdown.isHomeMatch
                          ? `-${formatCurrencyBRL(financialBreakdown.expenses.stadiumMaintenance)}`
                          : 'R$ 0 (Visitante)'}
                      </strong>
                    </div>

                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-400">Logística e Viagem:</span>
                      <strong className="text-rose-400 font-mono">
                        {!financialBreakdown.isHomeMatch
                          ? `-${formatCurrencyBRL(financialBreakdown.expenses.travelAndLogistics)}`
                          : 'R$ 0 (Mandante)'}
                      </strong>
                    </div>

                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-400">Outras Despesas Operacionais:</span>
                      <strong className="text-rose-400 font-mono">
                        -{formatCurrencyBRL(financialBreakdown.expenses.otherOperational)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Livro Caixa da Rodada */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Lançamentos Contábeis Registrados no Livro Caixa ({financialBreakdown.ledgerEntries.length})
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {financialBreakdown.ledgerEntries.map((le, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2 bg-slate-900/60 rounded-lg border border-slate-800 text-[11px]"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono font-bold text-[9px] ${
                            le.type === 'INCOME'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}
                        >
                          {le.type === 'INCOME' ? 'CRÉDITO' : 'DÉBITO'}
                        </span>
                        <span className="text-slate-300">{le.description}</span>
                      </div>

                      <div className="text-right">
                        <span
                          className={`font-mono font-bold ${
                            le.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {le.type === 'INCOME' ? '+' : '-'}
                          {formatCurrencyBRL(le.amount || 0)}
                        </span>
                        <span className="text-[10px] text-slate-500 block font-mono">
                          Saldo: {formatCurrencyBRL(le.balanceAfter || 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TABELA DE CLASSIFICAÇÃO */}
          {activeTab === 'STANDINGS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs">
                  Posição Anterior:{' '}
                  <strong className="text-white font-mono">{previousPosition}º Lugar</strong> → Nova
                  Posição: <strong className="text-emerald-400 font-mono">{newPosition}º Lugar</strong>
                </span>

                {newPosition < previousPosition && (
                  <span className="text-emerald-400 font-bold flex items-center gap-1 text-xs">
                    <ArrowUpRight className="w-4 h-4" /> Subiu {previousPosition - newPosition} posições
                  </span>
                )}
                {newPosition > previousPosition && (
                  <span className="text-rose-400 font-bold flex items-center gap-1 text-xs">
                    <ArrowDownRight className="w-4 h-4" /> Caiu {newPosition - previousPosition} posições
                  </span>
                )}
              </div>

              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 border-b border-slate-800 text-[10px] text-slate-400 uppercase font-mono">
                    <tr>
                      <th className="p-3">Pos</th>
                      <th className="p-3">Clube</th>
                      <th className="p-3 text-center">J</th>
                      <th className="p-3 text-center">V</th>
                      <th className="p-3 text-center">E</th>
                      <th className="p-3 text-center">D</th>
                      <th className="p-3 text-center">SG</th>
                      <th className="p-3 text-right">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    {updatedStandings.map((st) => {
                      const isUser = st.clubId === userMatch.homeClubId || st.clubId === userMatch.awayClubId;
                      return (
                        <tr
                          key={st.clubId}
                          className={`${
                            isUser ? 'bg-emerald-950/30 font-bold text-white' : 'text-slate-300'
                          } hover:bg-slate-900/40`}
                        >
                          <td className="p-3 font-mono font-bold text-slate-400">{st.position}º</td>
                          <td className="p-3">
                            <span className={isUser ? 'text-emerald-300' : 'text-white'}>
                              {st.clubName} {isUser ? '⭐ (Seu Clube)' : ''}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono">{st.played}</td>
                          <td className="p-3 text-center font-mono">{st.won}</td>
                          <td className="p-3 text-center font-mono">{st.drawn}</td>
                          <td className="p-3 text-center font-mono">{st.lost}</td>
                          <td className="p-3 text-center font-mono text-slate-400">
                            {st.goalDifference > 0 ? `+${st.goalDifference}` : st.goalDifference}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-400">
                            {st.points}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: DEMAIS JOGOS DA RODADA */}
          {activeTab === 'OTHERS' && (
            <div className="space-y-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Confrontos Realizados na {round}ª Rodada
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allMatches.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                      m.id === userMatch.id
                        ? 'bg-slate-900/90 border-emerald-500/50 shadow-sm'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex-1 text-right">
                      <strong className="text-white block truncate">{m.homeClubName}</strong>
                    </div>

                    <div className="px-3 py-1 mx-3 rounded bg-slate-900 border border-slate-800 font-mono font-black text-sm text-white">
                      {m.homeScore ?? 0} - {m.awayScore ?? 0}
                    </div>

                    <div className="flex-1 text-left">
                      <strong className="text-white block truncate">{m.awayClubName}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-950 p-4 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Fatos geradores econômicos e esportivos arquivados no banco de dados.
          </span>

          <button
            onClick={onClose}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            Continuar no Jogo
          </button>
        </div>
      </div>
    </div>
  );
};
