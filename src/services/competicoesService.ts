import { Competition } from '../types';
import { isFirebaseConfigured, firestoreDb } from '../config/firebase';
import { dataStore } from './dataStore';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';

export const competicoesService = {
  async getAll(): Promise<Competition[]> {
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const colRef = collection(firestoreDb, 'competicoes');
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Competition));
        }
      } catch (err) {
        console.warn('Falha na consulta Firestore para competicoes. Usando fallback.', err);
      }
    }
    return dataStore.getCompetitions();
  },

  async getById(id: string): Promise<Competition | null> {
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const docRef = doc(firestoreDb, 'competicoes', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return { id: snap.id, ...snap.data() } as Competition;
        }
      } catch (err) {
        console.warn('Falha ao buscar competicao no Firestore.', err);
      }
    }
    return dataStore.getCompetitionById(id) || null;
  },

  async save(comp: Competition): Promise<void> {
    dataStore.saveCompetition(comp);
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const docRef = doc(firestoreDb, 'competicoes', comp.id);
        await setDoc(docRef, comp, { merge: true });
      } catch (err) {
        console.warn('Falha ao persistir competição no Firestore.', err);
      }
    }
  },

  async update(id: string, partial: Partial<Competition>): Promise<void> {
    const existing = await this.getById(id);
    if (existing) {
      await this.save({ ...existing, ...partial });
    }
  },
};
