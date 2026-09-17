import { Transfer } from '../types';
import { isFirebaseConfigured, firestoreDb } from '../config/firebase';
import { dataStore } from './dataStore';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';

export const transferenciasService = {
  async getAll(): Promise<Transfer[]> {
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const colRef = collection(firestoreDb, 'transferencias');
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transfer));
        }
      } catch (err) {
        console.warn('Falha na consulta Firestore para transferencias.', err);
      }
    }
    return dataStore.getTransfers();
  },

  async add(transfer: Transfer): Promise<void> {
    dataStore.addTransfer(transfer);
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const docRef = doc(firestoreDb, 'transferencias', transfer.id);
        await setDoc(docRef, transfer);
      } catch (err) {
        console.warn('Falha ao persistir transferência no Firestore.', err);
      }
    }
  },

  async create(data: Partial<Transfer> & { playerId: string; playerName: string }): Promise<Transfer> {
    const newTransfer: Transfer = {
      id: `tr-${Date.now()}`,
      playerId: data.playerId,
      playerName: data.playerName,
      playerAge: data.playerAge ?? 25,
      playerPosition: data.playerPosition ?? 'ST',
      fromClubId: data.fromClubId ?? '',
      fromClubName: data.fromClubName ?? 'Livre',
      toClubId: data.toClubId ?? '',
      toClubName: data.toClubName ?? '',
      fee: data.fee ?? 0,
      date: data.date ?? new Date().toISOString().split('T')[0],
      type: data.type ?? (data.fee ? 'TRANSFER' : 'FREE'),
      status: data.status ?? 'RUMOR',
    };
    await this.add(newTransfer);
    return newTransfer;
  },
};
