import { Season } from '../types';
import { isFirebaseConfigured, firestoreDb } from '../config/firebase';
import { dataStore } from './dataStore';
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

export const temporadasService = {
  async getAll(): Promise<Season[]> {
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const colRef = collection(firestoreDb, 'temporadas');
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          const fromDb = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Season));
          const local = dataStore.getSeasons();
          const map = new Map<string, Season>();
          fromDb.forEach((s) => map.set(s.id, s));
          local.forEach((s) => {
            if (!map.has(s.id)) map.set(s.id, s);
          });
          return Array.from(map.values());
        }
      } catch (err) {
        console.warn('Falha na consulta Firestore para temporadas. Usando fallback.', err);
      }
    }
    return dataStore.getSeasons();
  },

  async getById(id: string): Promise<Season | undefined> {
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const docRef = doc(firestoreDb, 'temporadas', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return { id: snap.id, ...snap.data() } as Season;
        }
      } catch (err) {
        console.warn('Falha ao buscar temporada no Firestore.', err);
      }
    }
    const all = dataStore.getSeasons();
    return all.find((s) => s.id === id);
  },

  async save(season: Season): Promise<void> {
    dataStore.saveSeason(season);
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const docRef = doc(firestoreDb, 'temporadas', season.id);
        await setDoc(docRef, season, { merge: true });
      } catch (err) {
        console.warn('Falha ao persistir temporada no Firestore.', err);
      }
    }
  },

  async update(id: string, partial: Partial<Season>): Promise<void> {
    const s = await this.getById(id);
    if (s) {
      const updated = { ...s, ...partial };
      await this.save(updated);
    }
  },

  async delete(id: string): Promise<void> {
    dataStore.deleteSeason(id);
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const docRef = doc(firestoreDb, 'temporadas', id);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn('Falha ao excluir temporada do Firestore.', err);
      }
    }
  },

  async homologateSeason(seasonId: string, adminName: string = 'Admin FM Universe'): Promise<void> {
    const season = await this.getById(seasonId);
    if (!season) {
      throw new Error(`Temporada "${seasonId}" não encontrada.`);
    }

    const all = await this.getAll();
    for (const other of all) {
      if (other.id !== seasonId && other.isCurrent) {
        await this.save({ ...other, isCurrent: false });
      }
    }

    const updated: Season = {
      ...season,
      status: 'HOMOLOGADA',
      isCurrent: true,
      homologatedAt: new Date().toISOString(),
      homologatedBy: adminName,
    };
    await this.save(updated);
  },

  async revertSeasonToDraft(seasonId: string): Promise<void> {
    const season = await this.getById(seasonId);
    if (!season) return;

    const updated: Season = {
      ...season,
      status: 'RASCUNHO',
      homologatedAt: undefined,
      homologatedBy: undefined,
    };
    await this.save(updated);
  },
};
