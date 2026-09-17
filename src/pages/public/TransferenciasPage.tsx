import React, { useEffect, useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';
import { transferenciasService } from '../../services/transferenciasService';
import { Transfer } from '../../types';
import { formatCurrencyBRL } from '../../utils/currency';
import { PositionBadge } from '../../components/common/Badge';
import { ArrowLeftRight, ArrowRight, DollarSign, CheckCircle2, HelpCircle } from 'lucide-react';

export const TransferenciasPage: React.FC = () => {
  const { navigate } = useNavigation();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'COMPLETED' | 'RUMOR'>('ALL');

  useEffect(() => {
    transferenciasService.getAll().then(setTransfers);
  }, []);

  const filtered = transfers.filter((t) => {
    if (filter === 'COMPLETED') return t.status === 'COMPLETED';
    if (filter === 'RUMOR') return t.status === 'RUMOR';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
            <ArrowLeftRight className="w-7 h-7 text-indigo-400" />
            <span>Mercado da Bola & Transferências</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Negociações concluídas, rumores dos bastidores e movimentações financeiras.
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 self-start">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === 'ALL'
                ? 'bg-indigo-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Todas ({transfers.length})
          </button>
          <button
            onClick={() => setFilter('COMPLETED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === 'COMPLETED'
                ? 'bg-indigo-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Oficiais
          </button>
          <button
            onClick={() => setFilter('RUMOR')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === 'RUMOR'
                ? 'bg-indigo-600 text-white font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Rumores
          </button>
        </div>
      </div>

      {/* Transfers Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                <th className="py-3 px-4">Jogador</th>
                <th className="py-3 px-3">Pos</th>
                <th className="py-3 px-3 text-center">Idade</th>
                <th className="py-3 px-3">Origem</th>
                <th className="py-3 px-3">Destino</th>
                <th className="py-3 px-3 text-right">Valor da Operação</th>
                <th className="py-3 px-3 text-center">Data</th>
                <th className="py-3 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-medium">
              {filtered.map((tr) => (
                <tr key={tr.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4 whitespace-nowrap font-bold text-white">
                    {tr.playerName}
                  </td>
                  <td className="py-3 px-3">
                    <PositionBadge position={tr.playerPosition} size="xs" />
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-slate-300">{tr.playerAge}</td>
                  <td className="py-3 px-3 text-slate-300 whitespace-nowrap">{tr.fromClubName}</td>
                  <td className="py-3 px-3 text-emerald-400 font-semibold whitespace-nowrap">
                    {tr.toClubName}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-white">
                    {tr.fee > 0 ? formatCurrencyBRL(tr.fee, { compact: true }) : 'Custo Zero'}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-slate-400">{tr.date}</td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                        tr.status === 'COMPLETED'
                          ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {tr.status === 'COMPLETED' ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Concluído</span>
                        </>
                      ) : (
                        <>
                          <HelpCircle className="w-3 h-3" />
                          <span>Especulação</span>
                        </>
                      )}
                    </span>
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
