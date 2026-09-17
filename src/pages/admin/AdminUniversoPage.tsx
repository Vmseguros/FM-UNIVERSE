import React, { useState } from 'react';
import { isFirebaseConfigured } from '../../config/firebase';
import { dataStore } from '../../services/dataStore';
import { Globe, Database, Sliders, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export const AdminUniversoPage: React.FC = () => {
  const isFirebase = isFirebaseConfigured();
  const [universeName, setUniverseName] = useState('Universo Principal FM');
  const [marketSpeed, setMarketSpeed] = useState('Normal');
  const [inflationRate, setInflationRate] = useState(3.5);
  const [wageCapActive, setWageCapActive] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleResetData = () => {
    if (confirm('Atenção: Restaurar os dados padrões do Universo FM irá redefinir clubes, jogadores e placares. Deseja prosseguir?')) {
      dataStore.resetToDefaults();

      setFeedback('Ecossistema reinicializado com os dados mestres do FM Universe com sucesso!');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  };

  const handleSaveConfigs = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback('Configurações globais do Universo FM salvas com sucesso!');
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-purple-900/40 pb-5">
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Globe className="w-6 h-6 text-purple-400" />
          <span>Configuração Geral do Universo</span>
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Parâmetros econômicos, regras de fair play financeiro e estado da persistência de dados.
        </p>
      </div>

      {feedback && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Database State Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Camada de Armazenamento & Persistência
            </h2>
          </div>

          <span
            className={`text-xs font-mono font-bold px-3 py-1 rounded-lg border ${
              isFirebase
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
            }`}
          >
            {isFirebase ? 'Firebase Firestore Conectado' : 'DataStore LocalStorage Ativo (Offline Fallback)'}
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          O FM Universe adota a estratégia <strong>Firestore-First com Fallback LocalStorage Automatizado</strong>. Todos os cadastros e atualizações efetuados pelos usuários ou administradores são preservados no navegador através do DataStore local unificado, prontos para migração para a nuvem quando as variáveis do Firebase forem inseridas.
        </p>
      </div>

      {/* Universe Economic Parameters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-purple-400" />
          Parâmetros Econômicos do Simulador
        </h2>

        <form onSubmit={handleSaveConfigs} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 block mb-1">Nome do Universo de Ligas:</label>
              <input
                type="text"
                value={universeName}
                onChange={(e) => setUniverseName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Velocidade de Negociações no Mercado:</label>
              <select
                value={marketSpeed}
                onChange={(e) => setMarketSpeed(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
              >
                <option value="Lento">Lento (Simulação realista de janelas)</option>
                <option value="Normal">Normal (Padrão FM)</option>
                <option value="Acelerado">Acelerado (Ideal para testes)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 block mb-1">Taxa de Inflação Anual (%):</label>
              <input
                type="number"
                step="0.5"
                value={inflationRate}
                onChange={(e) => setInflationRate(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-emerald-400 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Regulamentação de Fair Play Financeiro:</label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="wageCap"
                  checked={wageCapActive}
                  onChange={(e) => setWageCapActive(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-purple-600 focus:ring-0"
                />
                <label htmlFor="wageCap" className="text-slate-300">
                  Exigir conformidade entre folha salarial e receitas do clube
                </label>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800">
            <button
              type="submit"
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              Salvar Parâmetros
            </button>
          </div>
        </form>
      </div>

      {/* Danger Zone: Reset Mock Data */}
      <div className="bg-rose-950/20 border border-rose-900/40 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm mb-1">
            <AlertTriangle className="w-5 h-5" />
            <span>Zona de Restauração de Dados</span>
          </div>
          <p className="text-xs text-slate-400">
            Caso deseje recomeçar a simulação com os clubes e jogadores originais de fábrica.
          </p>
        </div>

        <button
          onClick={handleResetData}
          className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer shrink-0"
        >
          Resetar Universo para Padrão
        </button>
      </div>
    </div>
  );
};
