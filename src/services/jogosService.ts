import { Match } from '../types';
import { isFirebaseConfigured, firestoreDb } from '../config/firebase';
import { dataStore } from './dataStore';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';

export const jogosService = {
  async getAll(): Promise<Match[]> {
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const colRef = collection(firestoreDb, 'jogos');
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Match));
        }
      } catch (err) {
        console.warn('Falha na consulta Firestore para jogos. Usando fallback.', err);
      }
    }
    return dataStore.getMatches();
  },

  async getById(id: string): Promise<Match | null> {
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const docRef = doc(firestoreDb, 'jogos', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return { id: snap.id, ...snap.data() } as Match;
        }
      } catch (err) {
        console.warn('Falha ao buscar jogo no Firestore.', err);
      }
    }
    return dataStore.getMatchById(id) || null;
  },

  async getByClubId(clubId: string): Promise<Match[]> {
    const all = await this.getAll();
    return all.filter((m) => m.homeClubId === clubId || m.awayClubId === clubId);
  },

  /**
   * Obtém a próxima partida obrigatória pendente para um clube.
   * Seleciona a partida oficial SCHEDULED mais antiga respeitando a ordem das rodadas e cronologia.
   */
  async getNextPendingMatchForClub(clubId: string): Promise<{
    match: Match | null;
    isPending: boolean;
    isOverdue: boolean;
    pendingRoundNumber: number | null;
  }> {
    const clubMatches = await this.getByClubId(clubId);
    const scheduled = clubMatches
      .filter((m) => m.status === 'SCHEDULED')
      .sort((a, b) => (a.round - b.round) || a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));

    const match = scheduled[0] || null;
    const CURRENT_SEASON_DATE = '2026-09-10';
    const isPending = Boolean(match);
    const isOverdue = Boolean(match && match.date < CURRENT_SEASON_DATE);
    const pendingRoundNumber = match ? match.round : null;

    return {
      match,
      isPending,
      isOverdue,
      pendingRoundNumber,
    };
  },

  async save(match: Match): Promise<void> {
    dataStore.saveMatch(match);
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const docRef = doc(firestoreDb, 'jogos', match.id);
        await setDoc(docRef, match, { merge: true });
      } catch (err) {
        console.warn('Falha ao persistir jogo no Firestore.', err);
      }
    }
  },

  async create(matchData: Omit<Match, 'id'>): Promise<Match> {
    const newMatch: Match = {
      id: `match-${Date.now()}`,
      ...matchData,
    };
    await this.save(newMatch);
    return newMatch;
  },

  async update(id: string, partial: Partial<Match>): Promise<void> {
    const existing = await this.getById(id);
    if (existing) {
      await this.save({ ...existing, ...partial });
    }
  },

  async delete(id: string): Promise<void> {
    dataStore.deleteMatch(id);
  },

  async replaceMatchesForCompetition(competitionId: string, newMatches: Match[]): Promise<void> {
    dataStore.replaceMatchesForCompetition(competitionId, newMatches);
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        for (const m of newMatches) {
          const docRef = doc(firestoreDb, 'jogos', m.id);
          await setDoc(docRef, m, { merge: true });
        }
      } catch (err) {
        console.warn('Falha ao persistir jogos no Firestore.', err);
      }
    }
  },
};
