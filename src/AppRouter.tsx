import React from 'react';
import { useNavigation } from './contexts/NavigationContext';
import { useAuth } from './contexts/AuthContext';

// Layouts
import { PublicLayout } from './layouts/PublicLayout';
import { DashboardLayout } from './layouts/DashboardLayout';
import { AdminLayout } from './layouts/AdminLayout';

// Auth & Setup Pages
import { LoginPage } from './pages/auth/LoginPage';
import { ManagerSetupPage } from './pages/manager/ManagerSetupPage';
import { AdminAccessDeniedPage } from './pages/admin/AdminAccessDeniedPage';

// Public Pages
import { HomePage } from './pages/public/HomePage';
import { ClubesPage } from './pages/public/ClubesPage';
import { ClubeDetalhePage } from './pages/public/ClubeDetalhePage';
import { JogadoresPage } from './pages/public/JogadoresPage';
import { JogadorDetalhePage } from './pages/public/JogadorDetalhePage';
import { CompeticoesPage } from './pages/public/CompeticoesPage';
import { CompeticaoDetalhePage } from './pages/public/CompeticaoDetalhePage';
import { JogosPage } from './pages/public/JogosPage';
import { JogoDetalhePage } from './pages/public/JogoDetalhePage';
import { TransferenciasPage } from './pages/public/TransferenciasPage';
import { EstadiosPage } from './pages/public/EstadiosPage';
import { RankingPage } from './pages/public/RankingPage';
import { NoticiasPage } from './pages/public/NoticiasPage';

// Manager Dashboard Pages
import { DashboardOverviewPage } from './pages/dashboard/DashboardOverviewPage';
import { ElencoPage } from './pages/dashboard/ElencoPage';
import { TaticaPage } from './pages/dashboard/TaticaPage';
import { FinancasPage } from './pages/dashboard/FinancasPage';
import { EstadioPage } from './pages/dashboard/EstadioPage';
import { ComissaoPage } from './pages/dashboard/ComissaoPage';
import { MercadoPage } from './pages/dashboard/MercadoPage';
import { LeiloesPage } from './pages/dashboard/LeiloesPage';
import { HistoricoPage } from './pages/dashboard/HistoricoPage';

// Admin Pages
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { AdminFinancasPage } from './pages/admin/AdminFinancasPage';
import { AdminClubesPage } from './pages/admin/AdminClubesPage';
import { AdminJogadoresPage } from './pages/admin/AdminJogadoresPage';
import { AdminLeiloesPage } from './pages/admin/AdminLeiloesPage';
import { AdminLeiloesV3Page } from './pages/admin/AdminLeiloesV3Page';
import { ManagerLeiloesV3Page } from './pages/dashboard/ManagerLeiloesV3Page';
import { AdminCampeonatosTemporadasPage } from './pages/admin/AdminCampeonatosTemporadasPage';
import { AdminCompeticoesPage } from './pages/admin/AdminCompeticoesPage';
import { AdminTemporadasPage } from './pages/admin/AdminTemporadasPage';
import { AdminJogosPage } from './pages/admin/AdminJogosPage';
import { AdminUniversoPage } from './pages/admin/AdminUniversoPage';
import { AdminImportarFM26Page } from './pages/admin/AdminImportarFM26Page';

export const AppRouter: React.FC = () => {
  const { currentPath } = useNavigation();
  const { firebaseUser, isRealAdmin, isManager, managerProfile, isAuthInitialized } = useAuth();

  // Clean path robusto (suporta query string, hash, trailing slashes)
  const normalizedPath = (currentPath || '')
    .split('?')[0]
    .split('#')[0]
    .replace(/^#\/?/, '/')
    .replace(/\/+$/, '') || '/';

  // Aguarda a resolução da sessão do Firebase Auth antes de tomar decisões de redirecionamento de rotas protegidas
  if (!isAuthInitialized && (normalizedPath.startsWith('/manager') || normalizedPath.startsWith('/dashboard'))) {
    return (
      <PublicLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-xs text-slate-400 font-medium tracking-wide">Carregando autenticação...</p>
        </div>
      </PublicLayout>
    );
  }

  // 0. Rotas de Autenticação e Onboarding do Manager
  if (normalizedPath === '/login') {
    return (
      <PublicLayout>
        <LoginPage />
      </PublicLayout>
    );
  }

  if (normalizedPath === '/manager/setup') {
    // Se não estiver autenticado, vai para o login primeiro
    if (!firebaseUser) {
      return (
        <PublicLayout>
          <LoginPage />
        </PublicLayout>
      );
    }
    // Se já tiver completado o onboarding, vai para o painel do manager
    if (isManager && managerProfile?.onboardingCompleted) {
      return (
        <DashboardLayout>
          <DashboardOverviewPage />
        </DashboardLayout>
      );
    }
    return (
      <PublicLayout>
        <ManagerSetupPage />
      </PublicLayout>
    );
  }

  // REGRA ABSOLUTA OBRIGATÓRIA:
  // A rota /admin/importar-fm26 renderiza obrigatoriamente a página AdminImportarFM26Page mesmo quando
  // o usuário não estiver autenticado, exibindo o cartão de autenticação Google/Firebase e o botão "Copiar Origem".
  if (
    normalizedPath === '/admin/importar-fm26' ||
    normalizedPath.endsWith('/importar-fm26') ||
    normalizedPath.includes('importar-fm26')
  ) {
    // Se for um treinador comum autenticado tentando acessar área administrativa, bloqueia
    if (firebaseUser && isManager && !isRealAdmin) {
      return (
        <AdminLayout>
          <AdminAccessDeniedPage />
        </AdminLayout>
      );
    }

    return (
      <AdminLayout isImportRoute={true}>
        <AdminImportarFM26Page />
      </AdminLayout>
    );
  }

  // 1. Admin Section
  if (normalizedPath.startsWith('/admin')) {
    const isSeasonAdminRoute =
      normalizedPath === '/admin/temporadas' ||
      normalizedPath === '/admin/competicoes' ||
      normalizedPath.startsWith('/admin/temporadas') ||
      normalizedPath.startsWith('/admin/competicoes');

    // Bloqueio rigoroso de isolamento: treinadores não podem acessar áreas sensíveis sem credenciais de admin,
    // mas a tela oficial de Campeonatos e Temporadas é permitida para visualização e auditoria
    if (firebaseUser && isManager && !isRealAdmin && !isSeasonAdminRoute) {
      return (
        <AdminLayout>
          <AdminAccessDeniedPage />
        </AdminLayout>
      );
    }

    let adminContent = <AdminOverviewPage />;

    if (normalizedPath === '/admin/financas') {
      adminContent = <AdminFinancasPage />;
    } else if (normalizedPath === '/admin/leiloes-v3') {
      adminContent = <AdminLeiloesV3Page />;
    } else if (normalizedPath === '/admin/leiloes') {
      adminContent = <AdminLeiloesPage />;
    } else if (normalizedPath === '/admin/clubes') {
      adminContent = <AdminClubesPage />;
    } else if (normalizedPath === '/admin/jogadores') {
      adminContent = <AdminJogadoresPage />;
    } else if (normalizedPath === '/admin/competicoes' || normalizedPath === '/admin/temporadas') {
      adminContent = <AdminCampeonatosTemporadasPage />;
    } else if (normalizedPath === '/admin/jogos') {
      adminContent = <AdminJogosPage />;
    } else if (normalizedPath === '/admin/universo') {
      adminContent = <AdminUniversoPage />;
    }

    return <AdminLayout>{adminContent}</AdminLayout>;
  }

  // 2. Manager Dashboard Section (suporta tanto /dashboard quanto /manager)
  if (normalizedPath.startsWith('/dashboard') || normalizedPath.startsWith('/manager')) {
    // Proteção de rota Manager: exige autenticação real
    if (!firebaseUser) {
      return (
        <PublicLayout>
          <LoginPage />
        </PublicLayout>
      );
    }

    // Se for um manager autenticado que ainda não completou o onboarding, redireciona para setup
    if (isManager && (!managerProfile || !managerProfile.onboardingCompleted)) {
      return (
        <PublicLayout>
          <ManagerSetupPage />
        </PublicLayout>
      );
    }

    // Normaliza rota para comparação (ex: /manager/elenco ou /dashboard/elenco)
    const subRoute = normalizedPath.replace(/^\/(dashboard|manager)/, '');

    let dashboardContent = <DashboardOverviewPage />;

    if (subRoute === '/elenco') {
      dashboardContent = <ElencoPage />;
    } else if (subRoute === '/tatica') {
      dashboardContent = <TaticaPage />;
    } else if (subRoute === '/financas') {
      dashboardContent = <FinancasPage />;
    } else if (subRoute === '/estadio') {
      dashboardContent = <EstadioPage />;
    } else if (subRoute === '/comissao') {
      dashboardContent = <ComissaoPage />;
    } else if (subRoute === '/mercado') {
      dashboardContent = <MercadoPage />;
    } else if (subRoute === '/leiloes-v3') {
      dashboardContent = <ManagerLeiloesV3Page />;
    } else if (subRoute === '/leiloes') {
      dashboardContent = <LeiloesPage />;
    } else if (subRoute === '/historico') {
      dashboardContent = <HistoricoPage />;
    }

    return <DashboardLayout>{dashboardContent}</DashboardLayout>;
  }

  // 3. Public Section
  let publicContent = <HomePage />;

  if (normalizedPath === '/clubes') {
    publicContent = <ClubesPage />;
  } else if (normalizedPath.startsWith('/clubes/')) {
    publicContent = <ClubeDetalhePage />;
  } else if (normalizedPath === '/jogadores') {
    publicContent = <JogadoresPage />;
  } else if (normalizedPath.startsWith('/jogadores/')) {
    publicContent = <JogadorDetalhePage />;
  } else if (normalizedPath === '/competicoes') {
    publicContent = <CompeticoesPage />;
  } else if (normalizedPath.startsWith('/competicoes/')) {
    publicContent = <CompeticaoDetalhePage />;
  } else if (normalizedPath === '/jogos') {
    publicContent = <JogosPage />;
  } else if (normalizedPath.startsWith('/jogos/')) {
    publicContent = <JogoDetalhePage />;
  } else if (normalizedPath === '/transferencias') {
    publicContent = <TransferenciasPage />;
  } else if (normalizedPath === '/estadios') {
    publicContent = <EstadiosPage />;
  } else if (normalizedPath === '/ranking') {
    publicContent = <RankingPage />;
  } else if (normalizedPath === '/noticias') {
    publicContent = <NoticiasPage />;
  }

  return <PublicLayout>{publicContent}</PublicLayout>;
};
