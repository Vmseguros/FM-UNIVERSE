import { doc, getDoc, setDoc, updateDoc, getDocFromServer } from 'firebase/firestore';
import { getFirestoreDb, firestoreDb, isFirebaseConfigured } from '../config/firebase';
import { ManagerProfile } from '../types';
import { clubesService } from './clubesService';

const MANAGERS_COLLECTION = 'managers';
const LOCAL_MANAGERS_KEY = 'fmu_managers_cache';

function getLocalManagers(): Record<string, ManagerProfile> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(LOCAL_MANAGERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalManager(profile: ManagerProfile): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const current = getLocalManagers();
    current[profile.uid] = profile;
    localStorage.setItem(LOCAL_MANAGERS_KEY, JSON.stringify(current));
  } catch (e) {
    console.warn('⚠️ [managersService] Falha ao salvar no cache local:', e);
  }
}

export const managersService = {
  /**
   * Obtém o perfil do Manager autenticado diretamente do Firestore (/managers/{uid}).
   */
  async getProfile(uid: string): Promise<ManagerProfile | null> {
    const cleanUid = uid?.trim();
    if (!cleanUid) return null;

    const db = getFirestoreDb() || firestoreDb;
    let profile: ManagerProfile | null = null;

    if (isFirebaseConfigured() && db) {
      try {
        const docRef = doc(db, MANAGERS_COLLECTION, cleanUid);
        let snap;
        try {
          snap = await getDocFromServer(docRef);
        } catch {
          snap = await getDoc(docRef);
        }

        if (snap && snap.exists()) {
          const data = snap.data() as Partial<ManagerProfile>;
          profile = {
            uid: cleanUid,
            name: data.name || 'Treinador',
            email: data.email || '',
            role: 'MANAGER', // Força papel imutável no backend
            clubId: data.clubId || null,
            onboardingCompleted: Boolean(data.onboardingCompleted),
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
          };
        }
      } catch (err) {
        console.warn(`⚠️ [managersService] Erro ao consultar /managers/${cleanUid}:`, err);
      }
    }

    // Fallback no cache local
    if (!profile) {
      const local = getLocalManagers();
      profile = local[cleanUid] || null;
    }

    // VÍNCULO DETERMINÍSTICO COM CLUBE OFICIAL:
    // Se o perfil não tiver clubId definido ou se onboarding ainda não constar como completo,
    // verifica se existe algum clube já fundado por este managerId (/clubes onde managerId == cleanUid ou id == club-cleanUid)
    if (!profile || !profile.clubId || !profile.onboardingCompleted) {
      try {
        const linkedClub = await clubesService.getByManagerId(cleanUid);
        if (linkedClub) {
          if (!profile) {
            profile = {
              uid: cleanUid,
              name: linkedClub.managerName || 'Treinador',
              email: '',
              role: 'MANAGER',
              clubId: linkedClub.id,
              onboardingCompleted: true,
              createdAt: linkedClub.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
          } else {
            profile = {
              ...profile,
              clubId: linkedClub.id,
              onboardingCompleted: true,
              updatedAt: new Date().toISOString(),
            };
          }
          saveLocalManager(profile);
        }
      } catch (e) {
        console.warn('⚠️ [managersService] Erro ao sincronizar vínculo automático com clube:', e);
      }
    }

    if (profile) {
      saveLocalManager(profile);
    }
    return profile;
  },

  /**
   * Cria o documento inicial do Manager em /managers/{uid}.
   * O role é fixado estritamente como "MANAGER" e não pode ser escolhido pelo usuário.
   */
  async createProfile(
    uid: string,
    data: { name: string; email: string }
  ): Promise<ManagerProfile> {
    const cleanUid = uid.trim();
    if (!cleanUid) throw new Error('UID inválido.');

    const now = new Date().toISOString();
    const profile: ManagerProfile = {
      uid: cleanUid,
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      role: 'MANAGER', // Garantia estrita: nunca aceita role do frontend
      clubId: null,
      onboardingCompleted: false,
      createdAt: now,
      updatedAt: now,
    };

    const db = getFirestoreDb() || firestoreDb;

    if (isFirebaseConfigured() && db) {
      try {
        const docRef = doc(db, MANAGERS_COLLECTION, cleanUid);
        await setDoc(docRef, profile, { merge: true });
        console.info(`✅ [managersService] Perfil /managers/${cleanUid} criado com sucesso no Firestore.`);
      } catch (err) {
        console.warn(`⚠️ [managersService] Erro ao salvar /managers/${cleanUid} no Firestore:`, err);
      }
    }

    saveLocalManager(profile);
    return profile;
  },

  /**
   * Finaliza o processo de primeiro acesso (onboarding) vinculando o clube criado ao Manager.
   */
  async completeOnboarding(uid: string, clubId: string): Promise<ManagerProfile> {
    const cleanUid = uid.trim();
    const cleanClubId = clubId.trim();

    if (!cleanUid || !cleanClubId) {
      throw new Error('UID e ClubID são obrigatórios para finalizar o onboarding.');
    }

    const now = new Date().toISOString();
    const db = getFirestoreDb() || firestoreDb;

    let existing = await this.getProfile(cleanUid);
    if (!existing) {
      existing = {
        uid: cleanUid,
        name: 'Treinador',
        email: '',
        role: 'MANAGER',
        clubId: cleanClubId,
        onboardingCompleted: true,
        createdAt: now,
        updatedAt: now,
      };
    } else {
      existing = {
        ...existing,
        clubId: cleanClubId,
        onboardingCompleted: true,
        updatedAt: now,
      };
    }

    if (isFirebaseConfigured() && db) {
      try {
        const docRef = doc(db, MANAGERS_COLLECTION, cleanUid);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          // Garante documento inicial compatível com regra 'allow create' (onboardingCompleted == false)
          await setDoc(docRef, {
            uid: cleanUid,
            name: existing.name || 'Treinador',
            role: 'MANAGER',
            clubId: null,
            onboardingCompleted: false,
            createdAt: now,
            updatedAt: now,
          });
        }
        await setDoc(
          docRef,
          {
            uid: cleanUid,
            name: existing.name || 'Treinador',
            role: 'MANAGER',
            clubId: cleanClubId,
            onboardingCompleted: true,
            updatedAt: now,
          },
          { merge: true }
        );
        console.info(`✅ [managersService] Onboarding concluído para ${cleanUid} com clube ${cleanClubId}`);
      } catch (err) {
        console.warn(`⚠️ [managersService] Erro ao atualizar onboarding no Firestore:`, err);
      }
    }

    saveLocalManager(existing);
    return existing;
  },

  /**
   * Atualiza dados permitidos do manager (não permite alteração de role).
   */
  async updateProfile(uid: string, partial: Partial<ManagerProfile>): Promise<ManagerProfile | null> {
    const cleanUid = uid.trim();
    const existing = await this.getProfile(cleanUid);
    if (!existing) return null;

    // Remove qualquer tentativa de alteração de role ou uid
    const safeData: Partial<ManagerProfile> = { ...partial };
    delete safeData.role;
    delete safeData.uid;

    const updated: ManagerProfile = {
      ...existing,
      ...safeData,
      role: 'MANAGER', // Garantia constante
      updatedAt: new Date().toISOString(),
    };

    const db = getFirestoreDb() || firestoreDb;
    if (isFirebaseConfigured() && db) {
      try {
        const docRef = doc(db, MANAGERS_COLLECTION, cleanUid);
        await updateDoc(docRef, { ...safeData, updatedAt: updated.updatedAt });
      } catch (err) {
        console.warn('⚠️ [managersService] Erro ao atualizar perfil no Firestore:', err);
      }
    }

    saveLocalManager(updated);
    return updated;
  },
};
