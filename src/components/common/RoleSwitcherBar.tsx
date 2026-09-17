import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { UserRole } from '../../types';
import { Shield, User, Award, Database, RefreshCw } from 'lucide-react';

export const RoleSwitcherBar: React.FC = () => {
  const {
    role,
    setRole,
    managedClub,
    setManagedClubId,
    allClubs,
    isFirebase,
    refreshClubData,
    firebaseUser,
    isManager,
    managerProfile,
    isRealAdmin,
    logoutManager,
  } = useAuth();
  const { navigate, activeSection } = useNavigation();

  const handleRoleChange = (newRole: UserRole) => {
    if (newRole === 'MANAGER') {
      if (!firebaseUser || !isManager) {
        navigate('/login');
      } else if (!managerProfile?.onboardingCompleted) {
        navigate('/manager/setup');
      } else {
        navigate('/manager');
      }
      return;
    }
    if (newRole === 'ADMIN') {
      navigate('/admin');
      return;
    }
    setRole('USER');
    navigate('/');
  };

  return (
    <div
      id="fmu-top-bar"
      className="bg-slate-950/90 backdrop-blur border-b border-slate-800 text-xs px-3 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2 z-40 text-slate-300"
    >
      {/* Left: Universe indicator and active mode */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 font-bold tracking-wider text-emerald-400 uppercase text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          FM Universe
        </span>

        {/* Firebase vs Mock status badge */}
        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border ${
            isFirebase
              ? 'bg-amber-950/40 text-amber-300 border-amber-800/60'
              : 'bg-slate-900 text-emerald-300 border-slate-800'
          }`}
          title={isFirebase ? 'Conectado ao Firebase Firestore' : 'Modo Mock Local com persistência ativa (Fallback oficial)'}
        >
          <Database className="w-3 h-3 text-emerald-400" />
          <span>{isFirebase ? 'Firebase Conectado' : 'Dados Mock Estruturados'}</span>
        </div>
      </div>

      {/* Center/Right: Role Switcher & Club Picker */}
      <div className="flex items-center flex-wrap gap-2 sm:gap-4">
        {/* Managed Club info for authenticated Manager (read-only, no hijacking) */}
        {isManager && managedClub && (
          <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded border border-slate-800">
            <span className="text-slate-400 hidden sm:inline text-[11px]">Seu Clube:</span>
            <span className="text-emerald-400 font-semibold text-xs">{managedClub.name}</span>
          </div>
        )}

        {/* Pending onboarding notification badge */}
        {isManager && !managerProfile?.onboardingCompleted && (
          <button
            onClick={() => navigate('/manager/setup')}
            className="bg-amber-950/40 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded text-[11px] font-medium hover:bg-amber-900/50 cursor-pointer"
          >
            Configurar Clube Pendente
          </button>
        )}

        {/* Admin only: Club selector for multi-club testing */}
        {isRealAdmin && allClubs.length > 0 && (
          <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded border border-slate-800">
            <span className="text-slate-400 hidden sm:inline text-[11px]">Testar Clube (Admin):</span>
            <select
              value={managedClub?.id || ''}
              onChange={(e) => setManagedClubId(e.target.value)}
              className="bg-transparent text-emerald-400 font-semibold focus:outline-none cursor-pointer text-xs"
            >
              {allClubs.map((club) => (
                <option key={club.id} value={club.id} className="bg-slate-900 text-slate-200">
                  {club.name} ({club.code})
                </option>
              ))}
              {managedClub && !allClubs.some((c) => c.id === managedClub.id) && (
                <option value={managedClub.id} className="bg-slate-900 text-slate-200">
                  {managedClub.name} ({managedClub.code})
                </option>
              )}
            </select>
          </div>
        )}

        {/* Roles button group */}
        <div className="flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-slate-800">
          <button
            onClick={() => handleRoleChange('USER')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all font-medium text-xs cursor-pointer ${
              activeSection === 'public'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Público</span>
          </button>

          <button
            onClick={() => handleRoleChange('MANAGER')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all font-medium text-xs cursor-pointer ${
              activeSection === 'dashboard'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>{firebaseUser && isManager ? 'Meu Clube' : 'Treinador'}</span>
          </button>

          <button
            onClick={() => handleRoleChange('ADMIN')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all font-medium text-xs cursor-pointer ${
              activeSection === 'admin'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admin</span>
          </button>
        </div>

        {/* Manager Logout button if logged in as Manager */}
        {firebaseUser && isManager && (
          <button
            onClick={async () => {
              await logoutManager();
              navigate('/login');
            }}
            className="text-xs text-rose-400 hover:text-rose-300 font-medium px-2 py-1 rounded bg-rose-950/30 border border-rose-800/40 hover:bg-rose-900/40 transition-colors cursor-pointer"
          >
            Sair
          </button>
        )}

        {/* Direct shortcut to FM26 Import & Admin Authentication */}
        <button
          onClick={() => navigate('/admin/importar-fm26')}
          className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer shadow-sm"
          title="Acessar Validador, Importador FM26 e Autenticação Admin"
        >
          <Database className="w-3.5 h-3.5" />
          <span>Importar FM26 / Login Admin</span>
        </button>

        {/* Sync refresh button */}
        <button
          onClick={() => refreshClubData()}
          title="Recarregar Dados"
          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
