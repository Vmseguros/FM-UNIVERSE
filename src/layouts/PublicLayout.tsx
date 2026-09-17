import React, { useState } from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Trophy,
  Users,
  Shield,
  Calendar,
  ArrowLeftRight,
  Newspaper,
  Building2,
  TrendingUp,
  Menu,
  X,
  ExternalLink,
  ChevronRight,
  Zap,
  Database,
} from 'lucide-react';
import { GoogleAuthHeaderButton } from '../components/auth/GoogleAuthHeaderButton';

export const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentPath, navigate } = useNavigation();
  const { firebaseUser, managerProfile, isManager, isRealAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getManagerRoute = () => {
    if (!firebaseUser) return '/login';
    if (isRealAdmin) return '/admin';
    if (isManager && !managerProfile?.onboardingCompleted) return '/manager/setup';
    return '/manager';
  };

  const getManagerButtonText = () => {
    if (!firebaseUser) return 'Treinador';
    if (isRealAdmin) return 'Painel Admin';
    if (isManager && !managerProfile?.onboardingCompleted) return 'Configurar Clube';
    return 'Meu Clube';
  };

  const navItems = [
    { label: 'Início', path: '/', icon: Zap },
    { label: 'Competições', path: '/competicoes', icon: Trophy },
    { label: 'Clubes', path: '/clubes', icon: Shield },
    { label: 'Jogadores', path: '/jogadores', icon: Users },
    { label: 'Jogos', path: '/jogos', icon: Calendar },
    { label: 'Transferências', path: '/transferencias', icon: ArrowLeftRight },
    { label: 'Notícias', path: '/noticias', icon: Newspaper },
    { label: 'Estádios', path: '/estadios', icon: Building2 },
    { label: 'Ranking', path: '/ranking', icon: TrendingUp },
  ];

  const handleNav = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col selection:bg-green-500 selection:text-black font-sans">
      {/* Public Navigation Header - Bento Style */}
      <header className="sticky top-0 z-30 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#262626]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div
              onClick={() => handleNav('/')}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center text-black font-bold text-xl shadow-lg transition-transform group-hover:scale-105">
                FM
              </div>
              <div>
                <span className="text-xl font-black tracking-tighter text-white flex items-center gap-1.5">
                  FM <span className="text-green-500">UNIVERSE</span>
                </span>
                <span className="block text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                  Gestão & Liga de Futebol
                </span>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive =
                  item.path === '/'
                    ? currentPath === '/'
                    : currentPath.startsWith(item.path);
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNav(item.path)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Right Action: Importar FM26, Google Auth & Go to Manager Dashboard CTA */}
            <div className="hidden sm:flex items-center gap-2.5">
              <button
                onClick={() => navigate('/admin/importar-fm26')}
                className="flex items-center gap-1.5 bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700/60 font-semibold px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer"
                title="Acessar Validador FM26 e Autenticação de Admin"
              >
                <Database className="w-3.5 h-3.5 text-purple-400" />
                <span>Importar FM26</span>
              </button>
              <GoogleAuthHeaderButton />
              <button
                onClick={() => {
                  navigate(getManagerRoute());
                }}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-black font-bold px-4 py-2 rounded-lg text-xs uppercase tracking-tight transition-colors cursor-pointer"
              >
                <span>{getManagerButtonText()}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile hamburger menu toggle */}
            <div className="flex lg:hidden items-center gap-2">
              <button
                onClick={() => navigate('/admin/importar-fm26')}
                className="bg-purple-900/80 text-purple-200 border border-purple-700 px-2 py-1.5 rounded-md text-[11px] font-semibold flex items-center gap-1"
                title="Importar FM26"
              >
                <Database className="w-3 h-3 text-purple-300" />
                <span>FM26</span>
              </button>
              <GoogleAuthHeaderButton />
              <button
                onClick={() => {
                  navigate(getManagerRoute());
                }}
                className="bg-green-600 text-black font-bold px-2.5 py-1.5 rounded-md text-xs uppercase"
              >
                {firebaseUser ? 'Clube' : 'Treinador'}
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0f0f0f] border-b border-[#262626] px-4 pt-2 pb-6 space-y-1">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/admin/importar-fm26');
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold bg-purple-950/40 text-purple-300 border border-purple-800/40 mb-2"
            >
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-purple-400" />
                <span>Importar FM26 / Login Admin</span>
              </div>
              <ChevronRight className="w-4 h-4 text-purple-500" />
            </button>
            {navItems.map((item) => {
              const isActive =
                item.path === '/'
                  ? currentPath === '/'
                  : currentPath.startsWith(item.path);
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => handleNav(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                    isActive
                      ? 'bg-green-500/10 text-green-400 font-bold border border-green-500/20'
                      : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Public Footer */}
      <footer className="bg-[#0a0a0a] border-t border-[#262626] text-zinc-500 text-xs py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="font-bold text-white text-sm">FM Universe</span>
            <span className="text-zinc-700">|</span>
            <span className="text-zinc-500">Plataforma & Universo de Gerenciamento de Futebol</span>
          </div>
          <div className="flex items-center gap-4 text-zinc-400">
            <button onClick={() => handleNav('/competicoes')} className="hover:text-green-400 cursor-pointer">
              Liga FM Universe
            </button>
            <button onClick={() => handleNav('/transferencias')} className="hover:text-green-400 cursor-pointer">
              Mercado
            </button>
            <button
              onClick={() => navigate('/admin/importar-fm26')}
              className="hover:text-purple-300 flex items-center gap-1 cursor-pointer font-medium text-purple-400"
            >
              <Database className="w-3 h-3 text-purple-400" />
              <span>Importar FM26</span>
            </button>
            <button
              onClick={() => {
                navigate('/admin');
              }}
              className="hover:text-purple-400 flex items-center gap-1 cursor-pointer"
            >
              <span>Painel Admin</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
