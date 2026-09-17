import { Club } from '../types';
import { isFirebaseConfigured, firestoreDb, getFirestoreDb } from '../config/firebase';
import { dataStore } from './dataStore';
import { collection, getDocs, doc, getDoc, setDoc, query, where } from 'firebase/firestore';

function ensureClubPreparation(club: Club): Club {
  if (club.id === 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3') {
    return {
      ...club,
      balance: typeof club.balance === 'number' ? club.balance : 20000000,
      capacity: club.capacity || 75000,
    };
  }
  return club;
}

export const clubesService = {
  async getAll(): Promise<Club[]> {
    const db = getFirestoreDb() || firestoreDb;
    if (isFirebaseConfigured() && db) {
      try {
        const colRef = collection(db, 'clubes');
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          const firestoreClubs = snap.docs.map((d) => ensureClubPreparation({ id: d.id, ...d.data() } as Club));
          const localClubs = dataStore.getClubs().map(ensureClubPreparation);
          const mergedMap = new Map<string, Club>();
          localClubs.forEach((c) => mergedMap.set(c.id, c));
          firestoreClubs.forEach((c) => {
            mergedMap.set(c.id, c);
            try {
              dataStore.saveClub(c);
            } catch {
              // ignore
            }
          });
          return Array.from(mergedMap.values());
        }
      } catch (err) {
        console.warn('Falha na consulta Firestore para clubes. Usando fallback.', err);
      }
    }
    return dataStore.getClubs().map(ensureClubPreparation);
  },

  async getBySlug(slug: string): Promise<Club | null> {
    const db = getFirestoreDb() || firestoreDb;
    if (isFirebaseConfigured() && db) {
      try {
        const clubs = await this.getAll();
        const found = clubs.find((c) => c.slug.toLowerCase() === slug.toLowerCase());
        if (found) return found;
      } catch (err) {
        console.warn('Falha ao buscar clube por slug via Firestore.', err);
      }
    }
    return dataStore.getClubBySlug(slug) || null;
  },

  async getById(id: string): Promise<Club | null> {
    const cleanId = id?.trim();
    if (!cleanId) return null;

    const db = getFirestoreDb() || firestoreDb;
    if (isFirebaseConfigured() && db) {
      try {
        // 1. Tenta pelo ID exato
        let docRef = doc(db, 'clubes', cleanId);
        let snap = await getDoc(docRef);
        if (snap.exists()) {
          const club = ensureClubPreparation({ id: snap.id, ...snap.data() } as Club);
          try { dataStore.saveClub(club); } catch { /* ignore */ }
          return club;
        }

        // 2. Se não tiver prefixo 'club-', tenta com 'club-'
        if (!cleanId.startsWith('club-')) {
          docRef = doc(db, 'clubes', `club-${cleanId}`);
          snap = await getDoc(docRef);
          if (snap.exists()) {
            const club = ensureClubPreparation({ id: snap.id, ...snap.data() } as Club);
            try { dataStore.saveClub(club); } catch { /* ignore */ }
            return club;
          }
        } else {
          // 3. Se tiver prefixo 'club-', tenta sem 'club-'
          const withoutPrefix = cleanId.replace(/^club-/, '');
          docRef = doc(db, 'clubes', withoutPrefix);
          snap = await getDoc(docRef);
          if (snap.exists()) {
            const club = ensureClubPreparation({ id: snap.id, ...snap.data() } as Club);
            try { dataStore.saveClub(club); } catch { /* ignore */ }
            return club;
          }
        }
      } catch (err) {
        console.warn('Falha ao buscar clube por ID via Firestore.', err);
      }
    }
    const local = dataStore.getClubById(cleanId);
    if (local) return ensureClubPreparation(local);

    // Fallback em getAll por ID, slug ou nome
    const all = await this.getAll();
    const cleanSlug = cleanId.replace(/^club-/, '').toLowerCase();
    const matched =
      all.find((c) => c.id === cleanId) ||
      all.find((c) => c.slug?.toLowerCase() === cleanSlug) ||
      all.find((c) => c.name?.toLowerCase() === cleanId.toLowerCase()) ||
      null;

    if (matched) {
      const prepared = ensureClubPreparation(matched);
      try { dataStore.saveClub(prepared); } catch { /* ignore */ }
      return prepared;
    }

    return null;
  },

  async getByName(name: string): Promise<Club | null> {
    const cleanName = name?.trim();
    if (!cleanName) return null;
    const all = await this.getAll();
    return (
      all.find(
        (c) =>
          c.name.toLowerCase() === cleanName.toLowerCase() ||
          c.slug?.toLowerCase() === cleanName.toLowerCase() ||
          c.shortName?.toLowerCase() === cleanName.toLowerCase()
      ) || null
    );
  },

  /**
   * Localiza o clube vinculado exclusivamente a um Manager pelo seu UID/managerId.
   */
  async getByManagerId(managerId: string): Promise<Club | null> {
    const cleanUid = managerId?.trim();
    if (!cleanUid) return null;

    const db = getFirestoreDb() || firestoreDb;

    // 1. Tenta direto pelo ID determinístico: club-{uid}
    const deterministicId = `club-${cleanUid}`;
    const direct = await this.getById(deterministicId);
    if (direct) return direct;

    // 2. Tenta direto pelo próprio cleanUid (caso o documento não use prefixo)
    const directUid = await this.getById(cleanUid);
    if (directUid) return directUid;

    // 3. Consulta Firestore com query where('managerId', '==', cleanUid)
    if (isFirebaseConfigured() && db) {
      try {
        const colRef = collection(db, 'clubes');
        const q = query(colRef, where('managerId', '==', cleanUid));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          const docSnap = qSnap.docs[0];
          const club = ensureClubPreparation({ id: docSnap.id, ...docSnap.data() } as Club);
          try { dataStore.saveClub(club); } catch { /* ignore */ }
          return club;
        }
      } catch (err) {
        console.warn('Falha ao consultar clube por managerId via Firestore.', err);
      }
    }

    // 4. Busca na coleção completa (Firestore + local)
    const all = await this.getAll();
    const found = all.find(
      (c) => c.managerId === cleanUid || c.id === deterministicId || c.id === cleanUid
    );
    if (found) {
      const prepared = ensureClubPreparation(found);
      try { dataStore.saveClub(prepared); } catch { /* ignore */ }
      return prepared;
    }

    // 5. Fallback no dataStore
    const fallback =
      dataStore
        .getClubs()
        .find((c) => c.managerId === cleanUid || c.id === deterministicId || c.id === cleanUid) || null;
    return fallback ? ensureClubPreparation(fallback) : null;
  },

  async save(club: Club): Promise<void> {
    try { dataStore.saveClub(club); } catch { /* ignore */ }
    const db = getFirestoreDb() || firestoreDb;
    if (isFirebaseConfigured() && db) {
      try {
        const docRef = doc(db, 'clubes', club.id);
        await setDoc(docRef, club, { merge: true });
      } catch (err) {
        console.warn('Falha ao persistir clube no Firestore.', err);
      }
    }
  },

  async create(clubData: Omit<Club, 'id'>): Promise<Club> {
    const newClub: Club = {
      id: `club-${Date.now()}`,
      ...clubData,
    };
    await this.save(newClub);
    return newClub;
  },

  /**
   * Cria um clube com vínculo determinístico ao UID do Manager e estrutura compatível com o FM Universe.
   */
  async createManagerClub(
    uid: string,
    managerName: string,
    clubData: {
      name: string;
      code?: string;
      logoUrl?: string;
      homeKitUrl?: string;
      awayKitUrl?: string;
      stadiumName: string;
      stadiumImageUrl?: string;
      primaryColor?: string;
      secondaryColor?: string;
      capacity?: number;
    }
  ): Promise<Club> {
    const cleanUid = uid.trim();
    if (!cleanUid) throw new Error('UID do manager é obrigatório.');

    // ID determinístico baseado no UID para unicidade e consistência
    const deterministicId = `club-${cleanUid}`;
    const slug = clubData.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || `clube-${cleanUid.slice(0, 8)}`;

    const code = (
      clubData.code?.trim() ||
      clubData.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() ||
      'CLB'
    ).slice(0, 3);

    const now = new Date().toISOString();

    const newClub: Club = {
      id: deterministicId,
      name: clubData.name.trim(),
      slug,
      shortName: clubData.name.slice(0, 16),
      code,
      badge: clubData.logoUrl || '',
      logoUrl: clubData.logoUrl || '',
      homeKitUrl: clubData.homeKitUrl || '',
      awayKitUrl: clubData.awayKitUrl || '',
      stadiumId: `stadium-${cleanUid}`,
      stadiumName: clubData.stadiumName.trim(),
      stadiumImageUrl: clubData.stadiumImageUrl || '',
      capacity: clubData.capacity || 42000,
      reputation: 3,
      transferBudget: 45000000,
      wageBudget: 4500000,
      balance: 45000000,
      managerId: cleanUid,
      managerName: managerName || 'Treinador',
      squadCount: 0,
      fansCount: 30000,
      primaryColor: clubData.primaryColor || '#10b981',
      secondaryColor: clubData.secondaryColor || '#059669',
      boardExpectation: 'Consolidar a equipe na divisão',
      seasonTarget: 'Primeira metade da tabela',
      trophiesCount: 0,
      foundedYear: new Date().getFullYear(),
      createdAt: now,
      updatedAt: now,
    };

    await this.save(newClub);
    return newClub;
  },

  async update(id: string, partial: Partial<Club>): Promise<void> {
    const existing = await this.getById(id);
    if (existing) {
      await this.save({ ...existing, ...partial });
    }
  },

  async delete(id: string): Promise<void> {
    dataStore.deleteClub(id);
  },
};
