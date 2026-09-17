import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrencyBRL } from '../../utils/currency';
import { Building2, Sparkles, CheckCircle2, Users, AlertCircle, Loader2, Wallet } from 'lucide-react';
import { estadioService, UPGRADE_COSTS } from '../../services/estadioService';

export const EstadioPage: React.FC = () => {
  const { managedClub, refreshClubData } = useAuth();
  
  const [capacity, setCapacity] = useState<number>(() => managedClub?.capacity || 48000);
  const [trainingLevel, setTrainingLevel] = useState<number>(() => managedClub?.trainingLevel ?? 4);
  const [youthLevel, setYouthLevel] = useState<number>(() => managedClub?.youthLevel ?? 4);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUpgrading, setIsUpgrading] = useState<boolean>(false);

  React.useEffect(() => {
    if (managedClub?.capacity) {
      setCapacity(managedClub.capacity);
    }
    if (managedClub?.trainingLevel) {
      setTrainingLevel(managedClub.trainingLevel);
    }
    if (managedClub?.youthLevel) {
      setYouthLevel(managedClub.youthLevel);
    }
  }, [managedClub?.capacity, managedClub?.trainingLevel, managedClub?.youthLevel]);

  if (!managedClub) {
    return <div className="text-center py-16 text-slate-400">Clube não carregado.</div>;
  }

  const handleUpgradeCapacity = async () => {
    if (isUpgrading) return;
    setIsUpgrading(true);
    setErrorMessage(null);
    setFeedback(null);

    try {
      const res = await estadioService.upgradeCapacity(managedClub.id);
      if (!res.success) {
        setErrorMessage(res.error || 'Não foi possível aprovar as obras de ampliação.');
      } else {
        if (res.newCapacity) setCapacity(res.newCapacity);
        setFeedback('Obras de ampliação aprovadas! +5.000 assentos adicionados à capacidade.');
        await refreshClubData();
      }
    } catch {
      setErrorMessage('Erro inesperado ao processar ampliação.');
    } finally {
      setIsUpgrading(false);
      setTimeout(() => {
        setFeedback(null);
        setErrorMessage(null);
      }, 6000);
    }
  };

  const handleUpgradeTraining = async () => {
    if (isUpgrading || trainingLevel >= 5) return;
    setIsUpgrading(true);
    setErrorMessage(null);
    setFeedback(null);

    try {
      const res = await estadioService.upgradeTrainingFacility(managedClub.id);
      if (!res.success) {
        setErrorMessage(res.error || 'Não foi possível modernizar o CT.');
      } else {
        if (res.newLevel) setTrainingLevel(res.newLevel);
        setFeedback('Centro de Treinamento modernizado para o nível máximo!');
        await refreshClubData();
      }
    } catch {
      setErrorMessage('Erro inesperado ao modernizar o CT.');
    } finally {
      setIsUpgrading(false);
      setTimeout(() => {
        setFeedback(null);
        setErrorMessage(null);
      }, 6000);
    }
  };

  const handleUpgradeYouth = async () => {
    if (isUpgrading || youthLevel >= 5) return;
    setIsUpgrading(true);
    setErrorMessage(null);
    setFeedback(null);

    try {
      const res = await estadioService.upgradeYouthFacility(managedClub.id);
      if (!res.success) {
        setErrorMessage(res.error || 'Não foi possível expandir as Categorias de Base.');
      } else {
        if (res.newLevel) setYouthLevel(res.newLevel);
        setFeedback(
          `Instalações da base ampliadas com sucesso! Novo nível: ${res.newLevel}/5. Investimento debitado do saldo do clube.`
        );
        await refreshClubData();
      }
    } catch {
      setErrorMessage('Erro inesperado ao processar a expansão da base.');
    } finally {
      setIsUpgrading(false);
      setTimeout(() => {
        setFeedback(null);
        setErrorMessage(null);
      }, 6000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Building2 className="w-6 h-6 text-emerald-400" />
          <span>Estádio & Infraestrutura do Clube</span>
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Modernize as instalações desportivas, aumente a capacidade de torcedores e desenvolva o Centro de Treinamento.
        </p>
      </div>

      {feedback && (
        <div id="feedback-success" className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {errorMessage && (
        <div id="feedback-error" className="bg-rose-500/15 border border-rose-500/30 text-rose-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Stadium Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
              Arena Oficial
            </span>
            <h2 className="text-xl font-bold text-white">{managedClub.stadiumName}</h2>
            <p className="text-xs text-slate-400">
              Gramado padrão FIFA, drenagem a vácuo e refletores de 2500 lux.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-right">
              <span className="text-[10px] text-slate-500 block uppercase">Saldo em Caixa</span>
              <span className="font-mono text-sm font-bold text-slate-300 flex items-center justify-end gap-1">
                <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                {formatCurrencyBRL(managedClub.balance ?? 0, { compact: true })}
              </span>
            </div>
            <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-right">
              <span className="text-[10px] text-slate-500 block uppercase">Capacidade Atual</span>
              <span className="font-mono text-xl font-black text-emerald-400">
                {capacity.toLocaleString()} torcedores
              </span>
            </div>
          </div>
        </div>

        {/* Upgrade Projects */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Capacity Expansion */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-white font-bold text-xs mb-1">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>Expansão de Arquibancada</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-3">
                Amplia as arquibancadas em mais 5.000 assentos para elevar a renda em dias de jogos.
              </p>
              <span className="text-xs font-mono font-bold text-emerald-400 block mb-3">
                Custo: {formatCurrencyBRL(UPGRADE_COSTS.CAPACITY, { compact: true })}
              </span>
            </div>

            <button
              id="btn-upgrade-capacity"
              onClick={handleUpgradeCapacity}
              disabled={isUpgrading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isUpgrading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                <span>Iniciar Obras (+5k)</span>
              )}
            </button>
          </div>

          {/* Training Ground */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-white font-bold text-xs mb-1">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Centro de Treinamento</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-2">
                Acelera a recuperação física dos atletas e reduz risco de lesões musculares.
              </p>
              <div className="flex justify-between text-xs text-slate-400 mb-3">
                <span>Nível Atual:</span>
                <span className="text-emerald-400 font-bold font-mono">{trainingLevel} / 5</span>
              </div>
            </div>

            <button
              id="btn-upgrade-training"
              onClick={handleUpgradeTraining}
              disabled={isUpgrading || trainingLevel >= 5}
              className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isUpgrading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processando...</span>
                </>
              ) : trainingLevel >= 5 ? (
                'Nível Máximo Atingido'
              ) : (
                `Modernizar CT (${formatCurrencyBRL(UPGRADE_COSTS.TRAINING, { compact: true })})`
              )}
            </button>
          </div>

          {/* Youth Facilities */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-white font-bold text-xs mb-1">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span>Categorias de Base</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-2">
                Aumenta a qualidade dos jovens promissores gerados nas peneiras anuais.
              </p>
              <div className="flex justify-between text-xs text-slate-400 mb-3">
                <span>Nível Atual:</span>
                <span className="text-emerald-400 font-bold font-mono">{youthLevel} / 5</span>
              </div>
            </div>

            <button
              id="btn-upgrade-youth"
              onClick={handleUpgradeYouth}
              disabled={isUpgrading || youthLevel >= 5}
              className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isUpgrading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processando...</span>
                </>
              ) : youthLevel >= 5 ? (
                'Nível Máximo Atingido'
              ) : (
                `Expandir Base (${formatCurrencyBRL(UPGRADE_COSTS.YOUTH, { compact: true })})`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
