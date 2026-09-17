import React from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, ArrowLeft, LogOut, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';

export const AdminAccessDeniedPage: React.FC = () => {
  const { firebaseUser, managerProfile, logoutManager } = useAuth();
  const { navigate } = useNavigation();

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-slate-900/90 border border-red-500/30 rounded-3xl p-8 shadow-2xl text-center backdrop-blur-md"
      >
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4 text-red-400">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider mb-2">
          <Lock className="w-3.5 h-3.5" />
          <span>Acesso Administrativo Restrito</span>
        </div>

        <h1 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
          Área Exclusiva de Administradores
        </h1>

        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Olá, <strong className="text-slate-200">{managerProfile?.name || firebaseUser?.displayName || 'Treinador'}</strong>.
          Sua conta possui papel de <strong className="text-emerald-400">MANAGER</strong> e não tem permissões para visualizar ou alterar configurações globais do sistema.
        </p>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 mb-6 text-left text-xs space-y-2 text-slate-400">
          <p>
            • Como treinador, você pode gerenciar seu próprio clube, táticas, partidas e finanças no painel de Manager.
          </p>
          <p>
            • Apenas administradores oficiais verificados com credenciais autorizadas têm acesso a esta área.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate('/manager')}
            className="w-full sm:w-auto py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Meu Clube</span>
          </button>

          <button
            onClick={async () => {
              await logoutManager();
              navigate('/login');
            }}
            className="w-full sm:w-auto py-3 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Trocar de Conta</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
