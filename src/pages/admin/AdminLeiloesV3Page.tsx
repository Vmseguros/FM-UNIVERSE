import React, { useState, useEffect } from 'react';
import {
  Gavel,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Shield,
  Eye,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { leiloesV3Service } from '../../services/leiloesV3Service';
import { jogadoresService } from '../../services/jogadoresService';
import { Leilao, Lance, LeilaoStatus } from '../../types/leiloesV3';
import { Player } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

export const AdminLeiloesV3Page: React.FC = () => {
  const { firebaseUser } = useAuth();

  // Estados dos Leilões (/leiloes)
  const [leiloes, setLeiloes] = useState<Leilao[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estados do Modal de Criação
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [jogadores, setJogadores] = useState<Player[]>([]);
  const [loadingJogadores, setLoadingJogadores] = useState(false);
  const [filtroJogador, setFiltroJogador] = useState('');
  const [jogadorSelecionado, setJogadorSelecionado] = useState<Player | null>(null);
  const [initialBid, setInitialBid] = useState<number>(1000000);
  const [minIncrement, setMinIncrement] = useState<number>(100000);
  const [startTime, setStartTime] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [endTime, setEndTime] = useState<string>(() => {
    const now = new Date();
    now.setHours(now.getHours() + 24);
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });

  // Modal de Visualização de Lances
  const [leilaoSelecionado, setLeilaoSelecionado] = useState<Leilao | null>(null);
  const [lancesModal, setLancesModal] = useState<Lance[]>([]);

  // Modal de Confirmação de Alteração de Status (substitui window.confirm bloqueado no iFrame)
  const [confirmModal, setConfirmModal] = useState<{
    leilaoId: string;
    nomeJogador: string;
    novoStatus: LeilaoStatus;
  } | null>(null);

  // Escuta leilões em tempo real de /leiloes
  useEffect(() => {
    setLoading(true);
    const unsub = leiloesV3Service.escutarLeiloes((list) => {
      setLeiloes(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Escuta lances do leilão aberto no modal
  useEffect(() => {
    if (!leilaoSelecionado) {
      setLancesModal([]);
      return;
    }
    const unsub = leiloesV3Service.escutarLances(leilaoSelecionado.id, (list) => {
      setLancesModal(list);
    });
    return () => unsub();
  }, [leilaoSelecionado]);

  // Carrega catálogo de jogadores para o modal de criação
  const carregarJogadores = async () => {
    if (jogadores.length > 0) return;
    setLoadingJogadores(true);
    try {
      const lista = await jogadoresService.getAll();
      setJogadores(lista || []);
    } catch (err) {
      console.warn('Erro ao carregar catálogo de jogadores:', err);
    } finally {
      setLoadingJogadores(false);
    }
  };

  const handleOpenCreateModal = () => {
    setIsModalOpen(true);
    carregarJogadores();
  };

  // Criação de Leilão: UMA ÚNICA gravação em /leiloes
  const handleCriarLeilao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jogadorSelecionado) {
      setFeedback({ type: 'error', message: 'Selecione um jogador para o leilão.' });
      return;
    }
    if (!firebaseUser?.uid) {
      setFeedback({ type: 'error', message: 'Administrador não autenticado.' });
      return;
    }

    setActionLoading(true);
    setFeedback(null);

    const res = await leiloesV3Service.criarLeilao({
      playerId: jogadorSelecionado.id,
      playerName: jogadorSelecionado.name,
      initialBid: Number(initialBid),
      minIncrement: Number(minIncrement),
      startTime,
      endTime,
      status: 'ABERTO',
      createdBy: firebaseUser.uid,
      playerAge: jogadorSelecionado.age,
      playerClub: jogadorSelecionado.clubName || 'Sem clube',
      playerPosition: jogadorSelecionado.position,
      playerRating: jogadorSelecionado.overall || 70,
      playerPhoto: jogadorSelecionado.photoUrl || null,
    });

    setActionLoading(false);

    if (res.success && res.id) {
      setFeedback({
        type: 'success',
        message: `Leilão de ${jogadorSelecionado.name} criado com sucesso em /leiloes/${res.id}!`,
      });
      setIsModalOpen(false);
      setJogadorSelecionado(null);
    } else {
      setFeedback({
        type: 'error',
        message: res.error || 'Falha ao criar leilão.',
      });
    }
  };

  // Abre a confirmação visual na interface (substitui window.confirm bloqueado no iFrame)
  const solicitarMudarStatus = (leilaoId: string, nomeJogador: string, novoStatus: LeilaoStatus) => {
    setConfirmModal({
      leilaoId,
      nomeJogador,
      novoStatus,
    });
  };

  // Executa a alteração de status existente após confirmação no modal
  const executarMudarStatus = async () => {
    if (!confirmModal) return;
    const { leilaoId, novoStatus } = confirmModal;
    setConfirmModal(null);

    setActionLoading(true);
    const res = await leiloesV3Service.atualizarStatus(leilaoId, novoStatus);
    setActionLoading(false);

    if (res.success) {
      setFeedback({ type: 'success', message: `Status do leilão alterado para "${novoStatus}".` });
    } else {
      setFeedback({ type: 'error', message: res.error || 'Falha ao atualizar status.' });
    }
  };

  const jogadoresFiltrados = jogadores.filter((p) => {
    if (!filtroJogador) return true;
    const q = filtroJogador.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.position || '').toLowerCase().includes(q) ||
      (p.clubName || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <Gavel className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Leilões (Painel Administrativo)</h1>
            <p className="text-sm text-slate-400">
              Coleção isolada em <code className="text-amber-400 font-mono text-xs">/leiloes</code> e lances em <code className="text-amber-400 font-mono text-xs">/leiloes/[id]/lances</code>
            </p>
          </div>
        </div>

        <button
          id="btn-abrir-criar-leilao"
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl transition-all shadow-lg hover:shadow-amber-500/20 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Novo Leilão
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-red-950/40 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100 uppercase tracking-wider font-bold"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Tabela de Leilões */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>Leilões Cadastrados</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {leiloes.length}
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
            <p>Carregando leilões em tempo real...</p>
          </div>
        ) : leiloes.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Gavel className="w-12 h-12 mx-auto text-slate-600 stroke-[1.5]" />
            <p className="text-base font-medium text-slate-300">Nenhum leilão cadastrado em /leiloes.</p>
            <p className="text-sm text-slate-500">
              Clique em "Novo Leilão" para publicar o primeiro jogador.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/50">
                  <th className="p-4 font-medium">Jogador</th>
                  <th className="p-4 font-medium">Posição / Idade</th>
                  <th className="p-4 font-medium">Lance Inicial</th>
                  <th className="p-4 font-medium">Incremento Mínimo</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Período</th>
                  <th className="p-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {leiloes.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center font-bold text-amber-400">
                          {l.playerPhoto ? (
                            <img src={l.playerPhoto} alt={l.playerName} className="w-full h-full object-cover" />
                          ) : (
                            l.playerName.charAt(0)
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{l.playerName}</p>
                          <p className="text-xs text-slate-400">{l.playerClub || 'Livre'}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-mono">
                        {l.playerPosition || 'N/A'}
                      </span>
                      {l.playerAge ? (
                        <span className="text-xs text-slate-400 ml-2">{l.playerAge} anos</span>
                      ) : null}
                    </td>

                    <td className="p-4">
                      <p className="font-semibold text-emerald-400 font-mono">
                        R$ {Number(l.initialBid).toLocaleString('pt-BR')}
                      </p>
                    </td>

                    <td className="p-4 font-mono text-slate-300">
                      R$ {Number(l.minIncrement).toLocaleString('pt-BR')}
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                          l.status === 'ABERTO'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : l.status === 'AGENDADO'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : l.status === 'ENCERRADO'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {l.status}
                      </span>
                    </td>

                    <td className="p-4 text-xs text-slate-400 font-mono">
                      <div>Fim: {new Date(l.endTime).toLocaleString('pt-BR')}</div>
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setLeilaoSelecionado(l)}
                          title="Ver lances"
                          className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Lances
                        </button>

                        {l.status === 'ABERTO' && (
                          <>
                            <button
                              id={`btn-encerrar-leilao-${l.id}`}
                              onClick={() => solicitarMudarStatus(l.id, l.playerName, 'ENCERRADO')}
                              disabled={actionLoading}
                              title="Encerrar leilão"
                              className="px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-medium transition cursor-pointer"
                            >
                              Encerrar
                            </button>
                            <button
                              id={`btn-cancelar-leilao-${l.id}`}
                              onClick={() => solicitarMudarStatus(l.id, l.playerName, 'CANCELADO')}
                              disabled={actionLoading}
                              title="Cancelar leilão"
                              className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded-lg text-xs font-medium transition cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </>
                        )}

                        {l.status !== 'ABERTO' && (
                          <button
                            id={`btn-reabrir-leilao-${l.id}`}
                            onClick={() => solicitarMudarStatus(l.id, l.playerName, 'ABERTO')}
                            disabled={actionLoading}
                            title="Reabrir leilão"
                            className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-medium transition cursor-pointer"
                          >
                            Reabrir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Criação de Leilão */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 text-white shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Gavel className="w-5 h-5 text-amber-400" />
                Criar Novo Leilão (/leiloes)
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCriarLeilao} className="space-y-4">
              {/* Seleção de Jogador */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
                  1. Selecionar Jogador
                </label>

                {jogadorSelecionado ? (
                  <div className="flex items-center justify-between p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-amber-400">
                        {jogadorSelecionado.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-white">{jogadorSelecionado.name}</p>
                        <p className="text-xs text-slate-300">
                          {jogadorSelecionado.position} • {jogadorSelecionado.age} anos • {jogadorSelecionado.clubName || 'Sem clube'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setJogadorSelecionado(null)}
                      className="text-xs text-amber-300 hover:underline font-semibold"
                    >
                      Trocar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Buscar por nome (ex: Cristiano, Abidal)..."
                        value={filtroJogador}
                        onChange={(e) => setFiltroJogador(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-xl divide-y divide-slate-800 bg-slate-950/40">
                      {loadingJogadores ? (
                        <p className="p-4 text-center text-xs text-slate-500">Carregando catálogo de atletas...</p>
                      ) : jogadoresFiltrados.length === 0 ? (
                        <p className="p-4 text-center text-xs text-slate-500">Nenhum atleta encontrado.</p>
                      ) : (
                        jogadoresFiltrados.slice(0, 30).map((p) => (
                          <div
                            key={p.id}
                            onClick={() => setJogadorSelecionado(p)}
                            className="p-2.5 hover:bg-slate-800/60 cursor-pointer flex justify-between items-center transition"
                          >
                            <div>
                              <p className="text-sm font-semibold text-white">{p.name}</p>
                              <p className="text-xs text-slate-400">
                                {p.position} • {p.age} anos • {p.clubName || 'Sem clube'}
                              </p>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-mono">
                              OVR {p.overall || 70}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Valores */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                    Lance Inicial (initialBid) R$
                  </label>
                  <input
                    id="input-initial-bid"
                    type="number"
                    min={10000}
                    step={10000}
                    value={initialBid}
                    onChange={(e) => setInitialBid(Number(e.target.value))}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                    Incremento Mínimo (minIncrement) R$
                  </label>
                  <input
                    id="input-min-increment"
                    type="number"
                    min={10000}
                    step={10000}
                    value={minIncrement}
                    onChange={(e) => setMinIncrement(Number(e.target.value))}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Prazos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                    Data / Hora Início (startTime)
                  </label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                    Data / Hora Fim (endTime)
                  </label>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Botões do Modal */}
              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  id="btn-confirmar-criar-leilao"
                  type="submit"
                  disabled={actionLoading || !jogadorSelecionado}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl transition shadow-lg"
                >
                  {actionLoading ? 'Publicando...' : 'Criar Leilão (/leiloes)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Histórico de Lances */}
      {leilaoSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 text-white shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold">Lances: {leilaoSelecionado.playerName}</h3>
                <p className="text-xs text-slate-400">
                  Subcoleção: <code className="text-amber-400 font-mono">/leiloes/{leilaoSelecionado.id}/lances</code>
                </p>
              </div>
              <button
                onClick={() => setLeilaoSelecionado(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2">
              {lancesModal.length === 0 ? (
                <p className="text-center py-6 text-sm text-slate-500">Nenhum lance registrado até o momento.</p>
              ) : (
                lancesModal.map((lance) => (
                  <div
                    key={lance.id}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex justify-between items-center"
                  >
                    <div>
                      <p className="font-semibold text-white flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-amber-400" />
                        {lance.managerName || 'Manager'}
                      </p>
                      <p className="text-xs text-slate-400 font-mono">Clube: {lance.clubId}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-emerald-400">
                        R$ {Number(lance.value).toLocaleString('pt-BR')}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {new Date(lance.createdAt).toLocaleTimeString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 text-right">
              <button
                onClick={() => setLeilaoSelecionado(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação Visual para Alteração de Status (substitui window.confirm) */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl border ${
                  confirmModal.novoStatus === 'ENCERRADO'
                    ? 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                    : confirmModal.novoStatus === 'CANCELADO'
                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}
              >
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  Confirmar {confirmModal.novoStatus === 'ENCERRADO' ? 'Encerramento' : confirmModal.novoStatus === 'CANCELADO' ? 'Cancelamento' : 'Reabertura'}
                </h3>
                <p className="text-xs text-slate-400">Ação administrativa imediata</p>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-sm text-slate-300">
              <p>
                Deseja alterar o status do leilão de <strong className="text-white">{confirmModal.nomeJogador}</strong> para{' '}
                <span className="font-semibold text-amber-400">"{confirmModal.novoStatus}"</span>?
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                id="btn-cancelar-status-modal"
                onClick={() => setConfirmModal(null)}
                disabled={actionLoading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition cursor-pointer"
              >
                Voltar
              </button>
              <button
                id="btn-confirmar-status-modal"
                onClick={executarMudarStatus}
                disabled={actionLoading}
                className={`px-4 py-2 font-semibold rounded-xl text-sm shadow-lg transition active:scale-95 flex items-center gap-2 cursor-pointer ${
                  confirmModal.novoStatus === 'ENCERRADO'
                    ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/20'
                    : confirmModal.novoStatus === 'CANCELADO'
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                }`}
              >
                {actionLoading ? 'Processando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
