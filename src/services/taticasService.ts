import { TacticSetup } from '../types';
import { isFirebaseConfigured, firestoreDb } from '../config/firebase';
import { dataStore } from './dataStore';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const taticasService = {
  /**
   * Obtém a tática persistida de um clube específico.
   * Prioriza Firestore caso configurado; caso contrário, utiliza fallback resiliente no dataStore.
   */
  async getByClubId(clubId: string): Promise<TacticSetup | null> {
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const docRef = doc(firestoreDb, 'taticas', clubId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data() as TacticSetup;
          // Sincroniza cache local com o documento do Firestore
          dataStore.saveTactic(data, clubId);
          return data;
        }
      } catch (err) {
        console.warn(`[FM Universe] Falha ao consultar tática do clube ${clubId} no Firestore. Alternando para dados locais.`, err);
      }
    }

    const localTactic = dataStore.getTactic(clubId);
    return localTactic || null;
  },

  /**
   * Salva a tática do clube tanto no Firestore quanto no dataStore local em uma única operação consistente.
   */
  async save(clubId: string, tactic: TacticSetup): Promise<void> {
    // 1. Persistência local imediata
    dataStore.saveTactic(tactic, clubId);

    // 2. Persistência no Firestore
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const docRef = doc(firestoreDb, 'taticas', clubId);
        await setDoc(docRef, tactic, { merge: true });
      } catch (err) {
        console.error(`[FM Universe] Erro ao salvar tática do clube ${clubId} no Firestore:`, err);
        throw err;
      }
    }
  },
};
