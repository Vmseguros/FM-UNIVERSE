import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { financasService } from '../../services/financasService';
import { adminFinancasService } from '../../services/adminFinancasService';
import { FinancialReport, ClubFinancialConfig, FinanceRecord } from '../../types';
import { formatCurrencyBRL } from '../../utils/currency';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building,
  Users,
  Trophy,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Award,
  Tv,
  Calendar,
  Shield,
  Info,
  BookOpen,
  Filter,
  CheckCircle,
} from 'lucide-react';

export const FinancasPage: React.FC = () => {
  const { managedClub } = useAuth();
  const [finances, setFinances] = useState<FinancialReport | null>(null);
  const [adminConfig, setAdminConfig] = useState<ClubFinancialConfig | null>(null);
  const [ledgerRecords, setLedgerRecords] = useState<FinanceRecord[]>([]);
  const [selectedRoundFilter, setSelectedRoundFilter] = useState<string>('ALL');
  const [boardRequestStatus, setBoardRequestStatus] = useState<string | null>(null);

  useEffect(() => {
    if (managedClub) {
      financasService.getByClubId(managedClub.id).then(setFinances);
      adminFinancasService.getConfigByClubId(managedClub.id).then(setAdminConfig);
      financasService.getRecordsByClubId(managedClub.id).then((records) => {
        setLedgerRecords(records || []);
      });
    }
  }, [managedClub]);

  if (!finances || !managedClub) {
    return (
      <div className="text-center py-16 text-slate-400">
        Carregando balancete contábil do clube...
      </div>
    );
  }

  const handleRequestBoardFunds = () => {
    setBoardRequestStatus('Solicitação enviada ao Conselho Deliberativo. Aguardando aprovação na reunião mensal.');
    setTimeout(() => setBoardRequestStatus(null), 4000);
  };

  const totalIncomes =
    finances.incomes.ticketSales +
    finances.incomes.sponsorships +
    finances.incomes.tvRights +
    finances.incomes.merchandising +
    finances.incomes.prizeMoney;

  const totalExpenses =
    finances.expenses.playerWages +
    finances.expenses.staffWages +
    finances.expenses.stadiumMaintenance +
    finances.expenses.youthAcademy;

  const netBalance = totalIncomes - totalExpenses;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-400" />
            <span>Saúde Financeira & Orçamento • {managedClub.name}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Acompanhe receitas, custos com folha salarial e solicite verba de transferências à diretoria.
          </p>
        </div>

        <button
          onClick={handleRequestBoardFunds}
          className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          Pedir Aumento de Orçamento
        </button>
      </div>

      {boardRequestStatus && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{boardRequestStatus}</span>
        </div>
      )}

      {/* 4 Pilares Econômicos Segregados (Estrutura FM Universe) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. CAIXA REAL */}
        <div className="bg-slate-900 border-2 border-emerald-500/40 p-4 rounded-xl shadow-lg shadow-emerald-950/20">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-emerald-400 block uppercase">1. Caixa Real</span>
            <span className="text-[9px] font-mono bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800/60">
              Disponível
            </span>
          </div>
          <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            {formatCurrencyBRL(finances.balance, { compact: true })}
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">Saldo real bancário do clube</span>
        </div>

        {/* 2. ORÇAMENTO DE TRANSFERÊNCIAS */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-200 block uppercase">2. Orç. Transferências</span>
            <span className="text-[9px] font-mono bg-purple-950 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800/60">
              Teto Compras
            </span>
          </div>
          <span className="text-xl sm:text-2xl font-black text-white font-mono">
            {formatCurrencyBRL(finances.transferBudget, { compact: true })}
          </span>
          <span className="text-[11px] text-purple-300 block mt-1">Limite máx. para reforços</span>
        </div>

        {/* 3. ORÇAMENTO SALARIAL */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-cyan-300 block uppercase">3. Orçamento Salarial</span>
            <span className="text-[9px] font-mono bg-cyan-950 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-800/60">
              Teto Mensal
            </span>
          </div>
          <span className="text-xl sm:text-2xl font-black text-cyan-300 font-mono">
            {formatCurrencyBRL(finances.wageBudget, { compact: true, decimals: 2 })}
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">Teto da folha de pagamento</span>
        </div>

        {/* 4. RECEITAS FUTURAS HOMOLOGADAS */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-amber-300 block uppercase">4. Receitas Futuras</span>
            <span className="text-[9px] font-mono bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded border border-amber-800/60">
              Homologadas
            </span>
          </div>
          <span className="text-xl sm:text-2xl font-black text-amber-300 font-mono">
            {formatCurrencyBRL(
              adminConfig
                ? (adminConfig.tvRights.amountPerRound * 38 + adminConfig.tvRights.amountPerCompetition) +
                  adminConfig.sponsors.reduce((acc, s) => acc + (s.contractValue || 0), 0) +
                  adminConfig.matchday.estimatedMatchRevenue * 19 +
                  adminConfig.matchday.memberSubscriptionRevenueMonthly * 12
                : totalIncomes * 12,
              { compact: true }
            )}
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">Projeção anual de contratos</span>
        </div>
      </div>

      {/* Income and Expense Detailed Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Incomes */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h2 className="font-bold text-sm text-white uppercase tracking-wider">
                Fontes de Receita Mensal
              </h2>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">
              Total: {formatCurrencyBRL(totalIncomes, { compact: true, decimals: 2 })}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-300">Bilheteria & Sócios Torcedores</span>
              <span className="font-mono font-bold text-emerald-400">
                {formatCurrencyBRL(finances.incomes.ticketSales, { compact: true, decimals: 0 })}
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-300">Contratos de Patrocínio Master</span>
              <span className="font-mono font-bold text-emerald-400">
                {formatCurrencyBRL(finances.incomes.sponsorships, { compact: true, decimals: 0 })}
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-300">Cotas de TV & Direitos de Transmissão</span>
              <span className="font-mono font-bold text-emerald-400">
                {formatCurrencyBRL(finances.incomes.tvRights, { compact: true, decimals: 0 })}
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-300">Venda de Camisas & Merchandising</span>
              <span className="font-mono font-bold text-emerald-400">
                {formatCurrencyBRL(finances.incomes.merchandising, { compact: true, decimals: 0 })}
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-300">Premiações de Jogos & Bônus</span>
              <span className="font-mono font-bold text-emerald-400">
                {formatCurrencyBRL(finances.incomes.prizeMoney, { compact: true, decimals: 0 })}
              </span>
            </div>
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-rose-400" />
              <h2 className="font-bold text-sm text-white uppercase tracking-wider">
                Despesas & Custos Fixos
              </h2>
            </div>
            <span className="text-xs font-mono font-bold text-rose-400">
              Total: {formatCurrencyBRL(totalExpenses, { compact: true, decimals: 2 })}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-300">Folha Salarial do Elenco Principal</span>
              <span className="font-mono font-bold text-rose-400">
                {formatCurrencyBRL(finances.expenses.playerWages, { compact: true, decimals: 0 })}
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-300">Salários da Comissão Técnica & Staff</span>
              <span className="font-mono font-bold text-rose-400">
                {formatCurrencyBRL(finances.expenses.staffWages, { compact: true, decimals: 0 })}
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-300">Manutenção do Estádio & Operação de Jogos</span>
              <span className="font-mono font-bold text-rose-400">
                {formatCurrencyBRL(finances.expenses.stadiumMaintenance, { compact: true, decimals: 0 })}
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-300">Estrutura das Categorias de Base (Sub-17/Sub-20)</span>
              <span className="font-mono font-bold text-rose-400">
                {formatCurrencyBRL(finances.expenses.youthAcademy, { compact: true, decimals: 0 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Regras e Contratos Oficiais Determinados pela Administração (FM Universe) */}
      {adminConfig && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-400" />
              <h2 className="font-bold text-sm text-white uppercase tracking-wider">
                Diretrizes Econômicas Fixadas pela Administração da Liga
              </h2>
            </div>
            <span className="text-[11px] font-mono text-purple-300 bg-purple-950/40 border border-purple-800/40 px-2 py-0.5 rounded">
              Temporada {adminConfig.seasonYear}
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Como Manager, seu clube opera estritamente sob as cotas, patrocínios e tetos orçamentários homologados pela Administração do FM Universe.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold block flex items-center gap-1">
                <Tv className="w-3 h-3 text-cyan-400" /> Cota TV por Rodada
              </span>
              <span className="font-mono font-bold text-white text-sm">
                {formatCurrencyBRL(adminConfig.tvRights.amountPerRound)}
              </span>
              <span className="text-[10px] text-slate-500 block">Creditado a cada partida disputada</span>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold block flex items-center gap-1">
                <Building className="w-3 h-3 text-emerald-400" /> Bilheteria Média / Jogo
              </span>
              <span className="font-mono font-bold text-white text-sm">
                {formatCurrencyBRL(adminConfig.matchday.estimatedMatchRevenue)}
              </span>
              <span className="text-[10px] text-slate-500 block">
                {adminConfig.matchday.expectedAttendance?.toLocaleString('pt-BR')} torcedores ({adminConfig.matchday.expectedOccupancyRate}% do estádio)
              </span>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold block flex items-center gap-1">
                <Trophy className="w-3 h-3 text-amber-400" /> Prêmio por Vitória
              </span>
              <span className="font-mono font-bold text-amber-300 text-sm">
                {formatCurrencyBRL(adminConfig.prizes.winPrize)}
              </span>
              <span className="text-[10px] text-slate-500 block">Bonificação esportiva por triunfo</span>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold block flex items-center gap-1">
                <Users className="w-3 h-3 text-purple-400" /> Verba Elenco & Staff
              </span>
              <span className="font-mono font-bold text-purple-300 text-sm">
                {formatCurrencyBRL(adminConfig.squadBudget + adminConfig.staffBudget, { compact: true })}
              </span>
              <span className="text-[10px] text-slate-500 block">Alocação para comissão e contratos</span>
            </div>
          </div>

          {/* Patrocinadores Homologados */}
          <div className="pt-2">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block mb-2">
              Patrocinadores Homologados ({adminConfig.sponsors.length})
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {adminConfig.sponsors.map((sp) => (
                <div key={sp.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <strong className="text-white font-bold truncate">{sp.name}</strong>
                    <span className="text-[9px] font-mono bg-purple-950/60 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800/40 shrink-0">
                      {sp.category}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                    <span>{sp.paymentMethod}:</span>
                    <strong className="text-emerald-400 font-mono">
                      {formatCurrencyBRL(sp.monthlyAmount ? sp.monthlyAmount : sp.amountPerRound)}
                      {sp.monthlyAmount ? '/mês' : '/rodada'}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LIVRO CAIXA & EXTRATO CONTÁBIL HISTÓRICO */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              <h2 className="font-bold text-base text-white uppercase tracking-wider">
                Livro Caixa Oficial & Extrato Por Rodada
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Registro cronológico auditado de todos os lançamentos financeiros gerados pelo Motor de Temporada.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 flex items-center gap-1 text-[11px]">
              <Filter className="w-3.5 h-3.5" /> Filtrar Rodada:
            </span>
            <select
              value={selectedRoundFilter}
              onChange={(e) => setSelectedRoundFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg focus:border-emerald-500 outline-none cursor-pointer font-mono"
            >
              <option value="ALL">Todas as Rodadas</option>
              {Array.from(
                new Set<number>(
                  ledgerRecords
                    .map((r) => r.round)
                    .filter((rnd): rnd is number => typeof rnd === 'number')
                )
              )
                .sort((a: number, b: number) => b - a)
                .map((r: number) => (
                  <option key={r} value={String(r)}>
                    {r}ª Rodada
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Tabela de Lançamentos */}
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 text-[10px] uppercase font-mono border-b border-slate-800">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Rodada</th>
                <th className="p-3">Tipo / Operação</th>
                <th className="p-3">Origem</th>
                <th className="p-3">Descrição</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3 text-right">Saldo em Caixa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {ledgerRecords
                .filter(
                  (r) =>
                    selectedRoundFilter === 'ALL' ||
                    r.round === Number(selectedRoundFilter)
                )
                .map((record) => {
                  const isIncome = record.type === 'INCOME';
                  return (
                    <tr key={record.id} className="hover:bg-slate-900/40 text-slate-300">
                      <td className="p-3 text-slate-400 whitespace-nowrap">{record.date}</td>
                      <td className="p-3 whitespace-nowrap">
                        {record.round ? (
                          <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] font-bold text-slate-200">
                            {record.round}ª
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                            isIncome
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                              : 'bg-rose-950 text-rose-300 border border-rose-800/60'
                          }`}
                        >
                          {isIncome ? 'CRÉDITO (+)' : 'DÉBITO (-)'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        {record.origin || record.category || 'Sistema'}
                      </td>
                      <td className="p-3 text-slate-200 font-sans max-w-xs truncate">
                        {record.description}
                      </td>
                      <td
                        className={`p-3 text-right font-bold whitespace-nowrap ${
                          isIncome ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isIncome ? '+' : '-'}
                        {formatCurrencyBRL(record.amount)}
                      </td>
                      <td className="p-3 text-right text-slate-200 font-bold whitespace-nowrap">
                        {record.balanceAfter !== undefined
                          ? formatCurrencyBRL(record.balanceAfter)
                          : '-'}
                      </td>
                    </tr>
                  );
                })}

              {ledgerRecords.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-sans italic">
                    Nenhuma movimentação registrada no Livro Caixa ainda. Avance uma rodada pelo botão "Continuar" para processar as receitas e despesas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            Integridade financeira assegurada. Nenhuma receita futura é creditada antecipadamente.
          </span>
          <span className="font-mono">
            Total de registros: {ledgerRecords.length}
          </span>
        </div>
      </div>
    </div>
  );
};
