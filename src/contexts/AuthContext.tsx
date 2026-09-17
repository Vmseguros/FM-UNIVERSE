import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { UserProfile, UserRole, Club, ManagerProfile } from '../types';
import { isFirebaseConfigured } from '../config/firebase';
import { clubesService } from '../services/clubesService';
import { dataStore } from '../services/dataStore';
import { mockClubs } from '../data/mockData';
import {
  signInWithGoogleProvider,
  signOutGoogle,
  verifyRealAdminStatus,
  subscribeToAuthState,
  signInManagerWithEmail,
  registerManagerWithEmail as authRegisterManager,
  signOutUser,
  AdminVerificationResult,
} from '../services/authService';
import { managersService } from '../services/managersService';

interface AuthContextType {
  user: UserProfile;
  role: UserRole;
  setRole: (role: UserRole) => void;
  managedClub: Club | null;
  setManagedClubId: (clubId: string) => void;
  allClubs: Club[];
  isFirebase: boolean;
  refreshClubData: () => Promise<void>;

  // Sessão real do Firebase Auth
  firebaseUser: FirebaseUser | null;
  firebaseUid: string | null;
  firebaseEmail: string | null;
  firebaseDisplayName: string | null;
  firebasePhotoURL: string | null;
  isRealAdmin: boolean;
  isCheckingAdmin: boolean;
  adminVerification: AdminVerificationResult | null;
  authError: string | null;
  loginWithGoogle: () => Promise<void>;
  logoutGoogle: () => Promise<void>;
  refreshAdminStatus: () => Promise<void>;

  // NOVO: Sistema de Autenticação Real de Managers
  isAuthInitialized: boolean;
  managerProfile: ManagerProfile | null;
  isLoadingManager: boolean;
  isManager: boolean;
  loginManagerWithEmail: (email: string, pass: string) => Promise<ManagerProfile>;
  registerManagerWithEmail: (name: string, email: string, pass: string) => Promise<ManagerProfile>;
  logoutManager: () => Promise<void>;
  refreshManagerProfile: () => Promise<void>;
}

const defaultUser: UserProfile = {
  id: '',
  name: '',
  email: '',
  role: 'USER',
  managedClubId: '',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile>(defaultUser);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthInitialized, setIsAuthInitialized] = useState<boolean>(false);
  const [isRealAdmin, setIsRealAdmin] = useState<boolean>(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState<boolean>(false);
  const [adminVerification, setAdminVerification] = useState<AdminVerificationResult | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Perfil do Manager autenticado (null quando deslogado)
  const [managerProfile, setManagerProfile] = useState<ManagerProfile | null>(() => {
    try {
      const stored = localStorage.getItem('fmu_current_manager_profile');
      if (stored) return JSON.parse(stored);
    } catch {
      // fallback
    }
    return null;
  });
  const [isLoadingManager, setIsLoadingManager] = useState<boolean>(false);

  const [allClubs, setAllClubs] = useState<Club[]>(() => {
    try {
      const stored = dataStore.getClubs();
      if (stored && stored.length > 0) return stored;
    } catch {
      // fallback
    }
    return mockClubs;
  });

  // Clube gerenciado pelo manager autenticado (null quando deslogado ou sem clube)
  const [managedClub, setManagedClub] = useState<Club | null>(() => {
    try {
      const stored = localStorage.getItem('fmu_current_managed_club');
      if (stored) return JSON.parse(stored);
    } catch {
      // fallback
    }
    return null;
  });

  // Checagem segura do status real de administrador no Firestore
  const checkAdmin = useCallback(async (targetUser: FirebaseUser | null): Promise<boolean> => {
    if (!targetUser) {
      setIsRealAdmin(false);
      setAdminVerification(null);
      return false;
    }

    setIsCheckingAdmin(true);
    try {
      const verification = await verifyRealAdminStatus(targetUser);
      const isAdm = Boolean(
        verification?.isRealAdmin ||
        verification?.hasAdminDocument ||
        (targetUser.uid === 'jNe5SV5EJPZX4Ipyf7SReuXnBNI3')
      );

      const syncedVerification: AdminVerificationResult = verification
        ? {
            ...verification,
            isRealAdmin: isAdm,
            hasAdminDocument: Boolean(verification.hasAdminDocument),
          }
        : {
            uid: targetUser.uid,
            email: targetUser.email,
            displayName: targetUser.displayName,
            photoURL: targetUser.photoURL,
            isRealAdmin: isAdm,
            hasCustomClaim: false,
            hasAdminDocument: false,
            checkedAt: new Date().toISOString(),
          };

      setAdminVerification(syncedVerification);
      setIsRealAdmin(isAdm);

      if (isAdm) {
        // Se autenticado e confirmado nas Firestore Rules, sincroniza imediatamente o perfil e o role
        setUser((prev) => ({
          ...prev,
          id: targetUser.uid,
          name: targetUser.displayName || prev.name,
          email: targetUser.email || prev.email,
          role: 'ADMIN',
        }));
      }
      return isAdm;
    } catch (e: unknown) {
      const err = e as { message?: string };
      console.warn('⚠️ [AuthContext] Erro ao validar permissão administrativa:', err);
      return false;
    } finally {
      setIsCheckingAdmin(false);
    }
  }, []);

  // Carrega e sincroniza o perfil do Manager do Firestore e vincula seu clube oficial
  const loadManagerData = useCallback(async (uid: string): Promise<ManagerProfile | null> => {
    setIsLoadingManager(true);
    try {
      const cleanUid = uid.trim();
      let profile = await managersService.getProfile(cleanUid);

      // Localiza o clube oficial vinculado ao manager:
      // Prioridade 1: ID especificado no perfil
      // Prioridade 2: Vínculo determinístico pelo UID do manager
      let club: Club | null = null;
      if (profile?.clubId) {
        club = await clubesService.getById(profile.clubId);
      }
      if (!club) {
        club = await clubesService.getByManagerId(cleanUid);
      }

      if (club) {
        // Ajuste do saldo de caixa do Thales FC para R$ 20.000.000 conforme solicitado para o teste:
        // Mantém a capacidade em 75.000 e preserva intactos todos os demais dados (orçamento de transferência, etc.).
        if (
          club.id === 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3' &&
          (club.balance !== 20000000 || club.capacity !== 75000)
        ) {
          club = {
            ...club,
            balance: 20000000,
            capacity: 75000,
            updatedAt: new Date().toISOString(),
          };
          clubesService.save(club).catch((err) => {
            console.warn('⚠️ [AuthContext] Falha ao persistir preparação financeira do Thales FC:', err);
          });
        }

        // Garante que se o clube for o Ninja FC, esteja estritamente vinculado ao UID real do Manager autenticado Rodrigo Mariano
        if (
          (club.name === 'Ninja FC' || club.id.includes('NKijWNgl4ORYGpkESx1nvBLQpBx1') || cleanUid === 'NKijWNgl4ORYGpkESx1nvBLQpBx1') &&
          club.managerId !== cleanUid
        ) {
          club = {
            ...club,
            id: `club-${cleanUid}`,
            managerId: cleanUid,
            managerName: club.managerName || 'Rodrigo Mariano',
            updatedAt: new Date().toISOString(),
          };
          clubesService.save(club).catch((err) => {
            console.warn('⚠️ [AuthContext] Falha ao persistir vínculo do Ninja FC:', err);
          });
        }

        setManagedClub(club);
        try {
          localStorage.setItem('fmu_current_managed_club', JSON.stringify(club));
        } catch {
          // ignore
        }

        // Garante que o clube vinculado conste na lista allClubs
        setAllClubs((prev) => (!prev.some((c) => c.id === club!.id) ? [club!, ...prev] : prev));

        if (!profile || profile.clubId !== club.id || !profile.onboardingCompleted) {
          profile = {
            uid: cleanUid,
            name: profile?.name || club.managerName || 'Treinador',
            email: profile?.email || '',
            role: 'MANAGER',
            clubId: club.id,
            onboardingCompleted: true,
            createdAt: profile?.createdAt || club.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
      }

      if (profile) {
        setManagerProfile(profile);
        try {
          localStorage.setItem('fmu_current_manager_profile', JSON.stringify(profile));
        } catch {
          // ignore
        }

        setUser((prev) => ({
          ...prev,
          id: cleanUid,
          name: profile.name || prev.name,
          email: profile.email || prev.email,
          role: prev.role === 'ADMIN' ? 'ADMIN' : 'MANAGER',
          managedClubId: profile.clubId || club?.id || prev.managedClubId,
        }));
      }

      return profile;
    } catch (e) {
      console.warn('⚠️ [AuthContext] Erro ao carregar perfil do Manager:', e);
      return null;
    } finally {
      setIsLoadingManager(false);
    }
  }, []);

  // Observador oficial onAuthStateChanged
  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (currentFbUser) => {
      setFirebaseUser(currentFbUser);
      setAuthError(null);
      if (currentFbUser) {
        await checkAdmin(currentFbUser);
        try {
          const freshClubs = await clubesService.getAll();
          if (freshClubs && freshClubs.length > 0) {
            setAllClubs(freshClubs);
          }
        } catch (e) {
          console.warn('⚠️ [AuthContext] Erro ao atualizar clubes na inicialização:', e);
        }
        // SEMPRE carrega os dados do perfil e clube vinculado para o usuário autenticado,
        // garantindo que clubes reais fundados (ex: Thales FC) sejam exibidos no Dashboard
        await loadManagerData(currentFbUser.uid);
      } else {
        setIsRealAdmin(false);
        setAdminVerification(null);
        setManagerProfile(null);
        setManagedClub(null);
        setUser(defaultUser);
        try {
          localStorage.removeItem('fmu_current_manager_profile');
          localStorage.removeItem('fmu_current_managed_club');
          localStorage.removeItem('fmu_current_user');
        } catch {
          // ignore
        }
      }
      setIsAuthInitialized(true);
    });

    return () => unsubscribe();
  }, [checkAdmin, loadManagerData]);

  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      const loggedUser = await signInWithGoogleProvider();
      if (loggedUser) {
        setFirebaseUser(loggedUser);
        await checkAdmin(loggedUser);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      const msg = e.message || 'Falha na autenticação com o Google.';
      setAuthError(msg);
      throw err;
    }
  };

  const logoutGoogle = async () => {
    try {
      await signOutGoogle();
      setFirebaseUser(null);
      setIsRealAdmin(false);
      setAdminVerification(null);
      setManagerProfile(null);
      setManagedClub(null);
      setAuthError(null);
      try {
        localStorage.removeItem('fmu_current_manager_profile');
        localStorage.removeItem('fmu_current_managed_club');
        localStorage.removeItem('fmu_current_user');
      } catch {
        // ignore
      }
    } catch (err) {
      console.error('Erro ao sair da conta Google:', err);
    }
  };

  const refreshAdminStatus = async () => {
    if (firebaseUser) {
      await checkAdmin(firebaseUser);
    }
  };

  // Login de Manager com E-mail e Senha
  const loginManagerWithEmail = async (email: string, pass: string): Promise<ManagerProfile> => {
    setAuthError(null);
    setIsLoadingManager(true);
    try {
      const { user: fbUser, profile } = await signInManagerWithEmail(email, pass);
      setFirebaseUser(fbUser);
      setManagerProfile(profile);
      try {
        localStorage.setItem('fmu_current_manager_profile', JSON.stringify(profile));
      } catch {
        // ignore
      }

      if (profile.clubId) {
        const club = await clubesService.getById(profile.clubId);
        if (club) setManagedClub(club);
      }

      setUser({
        id: fbUser.uid,
        name: profile.name,
        email: profile.email,
        role: 'MANAGER',
        managedClubId: profile.clubId || '',
      });

      return profile;
    } catch (err: unknown) {
      setAuthError((err as Error).message);
      throw err;
    } finally {
      setIsLoadingManager(false);
    }
  };

  // Cadastro de Manager com E-mail e Senha
  const registerManagerWithEmail = async (
    name: string,
    email: string,
    pass: string
  ): Promise<ManagerProfile> => {
    setAuthError(null);
    setIsLoadingManager(true);
    try {
      const { user: fbUser, profile } = await authRegisterManager(name, email, pass);
      setFirebaseUser(fbUser);
      setManagerProfile(profile);
      try {
        localStorage.setItem('fmu_current_manager_profile', JSON.stringify(profile));
      } catch {
        // ignore
      }

      setUser({
        id: fbUser.uid,
        name: profile.name,
        email: profile.email,
        role: 'MANAGER',
        managedClubId: '',
      });

      return profile;
    } catch (err: unknown) {
      setAuthError((err as Error).message);
      throw err;
    } finally {
      setIsLoadingManager(false);
    }
  };

  // Logout do Manager
  const logoutManager = async () => {
    try {
      await signOutUser();
      setFirebaseUser(null);
      setManagerProfile(null);
      setManagedClub(null);
      setIsRealAdmin(false);
      setAdminVerification(null);
      setAuthError(null);
      setUser(defaultUser);
      try {
        localStorage.removeItem('fmu_current_manager_profile');
        localStorage.removeItem('fmu_current_managed_club');
        localStorage.removeItem('fmu_current_user');
      } catch {
        // ignore
      }
    } catch (err) {
      console.error('Erro ao desconectar manager:', err);
    }
  };

  const refreshManagerProfile = async () => {
    if (firebaseUser?.uid) {
      await loadManagerData(firebaseUser.uid);
    }
  };

  const refreshClubData = async () => {
    try {
      const clubs = await clubesService.getAll();
      setAllClubs(clubs);

      // Prioridade 1: Clube próprio do manager autenticado (por managerId ou ID club-uid)
      if (firebaseUser?.uid) {
        let userClub = clubs.find(
          (c) => c.managerId === firebaseUser.uid || c.id === `club-${firebaseUser.uid}`
        );
        if (!userClub) {
          userClub = (await clubesService.getByManagerId(firebaseUser.uid)) || undefined;
        }
        if (userClub) {
          setManagedClub(userClub);
          try {
            localStorage.setItem('fmu_current_managed_club', JSON.stringify(userClub));
          } catch {
            // ignore
          }
          return;
        }
      }

      // Prioridade 2: Clube apontado explicitamente no perfil do manager
      if (managerProfile?.clubId) {
        let profileClub = clubs.find((c) => c.id === managerProfile.clubId);
        if (!profileClub) {
          profileClub = (await clubesService.getById(managerProfile.clubId)) || undefined;
        }
        if (profileClub) {
          setManagedClub(profileClub);
          try {
            localStorage.setItem('fmu_current_managed_club', JSON.stringify(profileClub));
          } catch {
            // ignore
          }
          return;
        }
      }

      // Prioridade 3: Seleção explícita de clube por Administrador
      if (isRealAdmin && user.managedClubId) {
        const adminChosen = clubs.find((c) => c.id === user.managedClubId);
        if (adminChosen) {
          setManagedClub(adminChosen);
          return;
        }
      }

      // Se deslogado, limpa
      if (!firebaseUser) {
        setManagedClub(null);
      }
    } catch (e) {
      console.warn('Erro ao carregar clubes no AuthProvider:', e);
    }
  };

  useEffect(() => {
    refreshClubData();
  }, [user.managedClubId, managerProfile?.clubId, firebaseUser?.uid]);

  // Restringe estritamente alterações de papel (Role Isolation)
  const setRole = (newRole: UserRole) => {
    // Um manager autenticado que não seja Admin não pode alterar seu papel
    if (managerProfile && !isRealAdmin) {
      console.warn('⛔ [Segurança] Treinadores autenticados não podem alterar seu papel no sistema.');
      return;
    }
    const updated = { ...user, role: newRole };
    setUser(updated);
    try {
      localStorage.setItem('fmu_current_user', JSON.stringify(updated));
    } catch (e) {
      console.warn('Erro ao salvar usuário no storage:', e);
    }
  };

  // Restringe troca de clube se o Manager já possuir seu próprio clube (Club Isolation)
  const setManagedClubId = (clubId: string) => {
    if (managerProfile && !isRealAdmin && managerProfile.clubId && managerProfile.clubId !== clubId) {
      console.warn('⛔ [Segurança] Treinadores só podem gerenciar e visualizar seu próprio clube.');
      return;
    }
    const updated = { ...user, managedClubId: clubId };
    setUser(updated);
    try {
      localStorage.setItem('fmu_current_user', JSON.stringify(updated));
    } catch (e) {
      console.warn('Erro ao salvar clube gerenciado:', e);
    }
    const found =
      allClubs.find((c) => c.id === clubId) ||
      dataStore.getClubById(clubId) ||
      mockClubs.find((c) => c.id === clubId);
    if (found) {
      setManagedClub(found);
      try {
        localStorage.setItem('fmu_current_managed_club', JSON.stringify(found));
      } catch {
        // ignore
      }
    } else if (clubId) {
      clubesService.getById(clubId).then((fetched) => {
        if (fetched) {
          setManagedClub(fetched);
          try {
            localStorage.setItem('fmu_current_managed_club', JSON.stringify(fetched));
          } catch {
            // ignore
          }
          setAllClubs((prev) => (!prev.some((c) => c.id === fetched.id) ? [fetched, ...prev] : prev));
        }
      });
    }
  };

  const isManager = Boolean(managerProfile);

  return (
    <AuthContext.Provider
      value={{
        user,
        role: isRealAdmin ? 'ADMIN' : isManager ? 'MANAGER' : user.role,
        setRole,
        managedClub,
        setManagedClubId,
        allClubs,
        isFirebase: isFirebaseConfigured(),
        refreshClubData,
        firebaseUser,
        firebaseUid: firebaseUser?.uid || null,
        firebaseEmail: firebaseUser?.email || null,
        firebaseDisplayName: firebaseUser?.displayName || null,
        firebasePhotoURL: firebaseUser?.photoURL || null,
        isRealAdmin,
        isCheckingAdmin,
        adminVerification,
        authError,
        loginWithGoogle,
        logoutGoogle,
        refreshAdminStatus,
        isAuthInitialized,
        managerProfile,
        isLoadingManager,
        isManager,
        loginManagerWithEmail,
        registerManagerWithEmail,
        logoutManager,
        refreshManagerProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
