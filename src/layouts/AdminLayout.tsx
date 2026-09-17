import React from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import { useAuth } from '../contexts/AuthContext';
import {
  ShieldAlert,
  ShieldCheck,
  Settings,
  Shield,
  Users,
  Trophy,
  Calendar,
  Globe,
  ArrowLeft,
  Sliders,
  CheckCircle,
  Database,
  Lock,
  DollarSign,
  Gavel,
} from 'lucide-react';
import { GoogleAuthCard } from '../components/auth/GoogleAuthCard';
import { GoogleAuthHeaderButton } from '../components/auth/GoogleAuthHeaderButton';

interface AdminLayoutProps {
  children: React.ReactNode;
  isImportRoute?: boolean;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, isImportRoute: propIsImportRoute }) => {
  const { currentPath, navigate } = useNavigation();
  const { role, setRole, isRealAdmin, firebaseUid } = useAuth();

  const adminNav = [
    { label: 'Painel Geral', path: '/admin', icon: Sliders },
    { label: 'Leilões V3', path: '/admin/leiloes-v3', icon: Gavel },
    { label: 'Leilões (V2)', path: '/admin/leiloes', icon: Gavel },
    { label: 'Configuração Financeira', path: '/admin/financas', icon: DollarSign },
    { label: 'Clubes', path: '/admin/clubes', icon: Shield },
    { label: 'Jogadores', path: '/admin/jogadores', icon: Users },
    { label: 'Importar Banco FM26', path: '/admin/importar-fm26', icon: Database },
    { label: 'Campeonatos & Temporadas', path: '/admin/temporadas', icon: Trophy },
    { label: 'Jogos & Súmulas', path: '/admin/jogos', icon: Calendar },
    { label: 'Config. Universo', path: '/admin/universo', icon: Globe },
  ];

  // RBAC Access Control Gate
  // A rota /admin/importar-fm26 é SEMPRE permitida sem qualquer bloqueio ou redirecionamento,
  // mesmo sem autenticação prévia, para que o usuário visualize a tela completa, o cartão
  // de autenticação Google/Firebase, identifique a origem do Preview e use o botão "Copiar Origem".
  // Todas as operações de leitura e escrita administrativa no Firestore permanecem protegidas.
  const cleanPath = (currentPath || '')
    .split('?')[0]
    .split('#')[0]
    .replace(/^#\/?/, '/')
    .replace(/\/+$/, '') || '/';

  const isImportRoute = Boolean(
    propIsImportRoute ||
    cleanPath === '/admin/importar-fm26' ||
    cleanPath.endsWith('/importar-fm26') ||
    cleanPath.includes('importar-fm26')
  );

  const isAccessibleRoute = Boolean(
    isImportRoute ||
    cleanPath === '/admin/temporadas' ||
    cleanPath === '/admin/competicoes' ||
    cleanPath.startsWith('/admin/temporadas') ||
    cleanPath.startsWith('/admin/competicoes')
  );

  if (role !== 'ADMIN' && !isAccessibleRoute) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 bg-[#050505]">
        <div className="max-w-xl w-full space-y-4">
          <GoogleAuthCard />

          <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 text-center shadow-xl">
            <h2 className="text-base font-bold text-white mb-1.5 flex items-center justify-center gap-2">
              <Lock className="w-4 h-4 text-purple-400" />
              <span>Acesso ao Painel Administrativo</span>
            </h2>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              Para navegar e gerenciar o banco do FM Universe com segurança no Firestore, faça login com sua conta Google acima.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <button
                onClick={() => setRole('ADMIN')}
                className="w-full sm:w-auto bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700/60 font-medium py-2 px-4 rounded-lg text-xs transition-colors cursor-pointer"
              >
                Explorar Painel Visualmente (Sem Escrita)
              </button>
              <button
                onClick={() => navigate('/admin/importar-fm26')}
                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white font-medium py-2 px-4 rounded-lg text-xs transition-colors cursor-pointer"
              >
                Ir para Importação & Autenticação
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full sm:w-auto bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 px-4 rounded-lg text-xs transition-colors border border-zinc-700 cursor-pointer"
              >
                Voltar ao Portal Público
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans">
      {/* Admin Top Header */}
      <header className="bg-[#0a0a0a] border-b border-[#262626] px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-white font-bold text-sm shadow">
            ⚡
          </div>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="tracking-tight">FM Universe</span>
              <span className="bg-purple-500/20 text-purple-300 text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border border-purple-500/30">
                Painel do Administrador
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <GoogleAuthHeaderButton />

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs px-3 py-1.5 rounded-lg transition-colors border border-zinc-700 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Sair do Admin</span>
          </button>
        </div>
      </header>

      {/* Security Status Banner for Firestore */}
      {!isRealAdmin && (
        <div className="bg-amber-950/40 border-b border-amber-800/40 px-4 py-2 text-xs text-amber-300">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Modo de Leitura / Simulação:</strong> Nenhuma alteração será persistida no Firestore até que sua conta Google seja provisionada em{' '}
                <code className="bg-zinc-900 px-1 py-0.5 rounded font-mono text-[11px] text-amber-200">/admins/{'{uid}'}</code>.
              </span>
            </div>
            {firebaseUid && (
              <span className="text-[11px] text-zinc-400 font-mono">
                UID Autenticado: <span className="text-white">{firebaseUid.slice(0, 8)}...</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Admin Navigation Sub-bar */}
      <div className="bg-[#0f0f0f] border-b border-[#262626] overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-2 py-2">
          {adminNav.map((item) => {
            const isActive =
              item.path === '/admin'
                ? cleanPath === '/admin'
                : cleanPath.startsWith(item.path);
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Admin Content View */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
};
