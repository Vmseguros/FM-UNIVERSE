import { CompetitionParticipant, Club } from '../types';
import { isFirebaseConfigured, firestoreDb } from '../config/firebase';
import { dataStore } from './dataStore';
import { collection, getDocs, doc, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { clubesService } from './clubesService';

export const initialCompetitionParticipants: CompetitionParticipant[] = [
  {
    id: 'comp-1_club-qowYWnG0EfUqrr1a5cHlu4UYmNB3',
    clubId: 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3',
    clubeId: 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3',
    clubName: 'Thales FC',
    competitionId: 'comp-1',
    competicaoId: 'comp-1',
    seasonId: 's-2025',
    temporadaId: 's-2025',
    status: 'HOMOLOGADO',
    joinedAt: '2025-08-01T10:00:00Z',
  },
  {
    id: 'comp-1_club-1',
    clubId: 'club-1',
    clubeId: 'club-1',
    clubName: 'FM United',
    competitionId: 'comp-1',
    competicaoId: 'comp-1',
    seasonId: 's-2025',
    temporadaId: 's-2025',
    status: 'HOMOLOGADO',
    joinedAt: '2025-08-01T10:00:00Z',
  },
  {
    id: 'comp-1_club-2',
    clubId: 'club-2',
    clubeId: 'club-2',
    clubName: 'Real Football',
    competitionId: 'comp-1',
    competicaoId: 'comp-1',
    seasonId: 's-2025',
    temporadaId: 's-2025',
    status: 'HOMOLOGADO',
    joinedAt: '2025-08-01T10:00:00Z',
  },
  {
    id: 'comp-1_club-3',
    clubId: 'club-3',
    clubeId: 'club-3',
    clubName: 'Inter Tech',
    competitionId: 'comp-1',
    competicaoId: 'comp-1',
    seasonId: 's-2025',
    temporadaId: 's-2025',
    status: 'HOMOLOGADO',
    joinedAt: '2025-08-01T10:00:00Z',
  },
  {
    id: 'comp-1_club-4',
    clubId: 'club-4',
    clubeId: 'club-4',
    clubName: 'Porto Real',
    competitionId: 'comp-1',
    competicaoId: 'comp-1',
    seasonId: 's-2025',
    temporadaId: 's-2025',
    status: 'HOMOLOGADO',
    joinedAt: '2025-08-01T10:00:00Z',
  },
  {
    id: 'comp-1_club-5',
    clubId: 'club-5',
    clubeId: 'club-5',
    clubName: 'Santos Stars',
    competitionId: 'comp-1',
    competicaoId: 'comp-1',
    seasonId: 's-2025',
    temporadaId: 's-2025',
    status: 'HOMOLOGADO',
    joinedAt: '2025-08-01T10:00:00Z',
  },
];

export const participantesService = {
  async getAll(competitionId?: string): Promise<CompetitionParticipant[]> {
    let list: CompetitionParticipant[] = [];

    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const colRef = collection(firestoreDb, 'participantes');
        const q = competitionId
          ? query(colRef, where('competitionId', '==', competitionId))
          : colRef;
        const snap = await getDocs(q);
        if (!snap.empty) {
          list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CompetitionParticipant));
        }
      } catch (err) {
        console.warn('Falha na consulta Firestore para participantes. Usando fallback.', err);
      }
    }

    if (list.length === 0) {
      list = dataStore.getCompetitionParticipants(competitionId);
    }

    // Se ainda vazio, garante os participantes padrão da Liga FM Universe (incluindo Thales FC)
    if (list.length === 0 && (!competitionId || competitionId === 'comp-1')) {
      for (const p of initialCompetitionParticipants) {
        dataStore.saveCompetitionParticipant(p);
      }
      list = [...initialCompetitionParticipants];
    }

    // Garante que o Thales FC esteja sempre presente na Liga FM Universe
    if (!list.some((p) => (p.competitionId === 'comp-1' || !p.competitionId) && p.clubId === 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3')) {
      const thalesParticipant: CompetitionParticipant = {
        id: 'comp-1_club-qowYWnG0EfUqrr1a5cHlu4UYmNB3',
        clubId: 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3',
        clubeId: 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3',
        clubName: 'Thales FC',
        competitionId: 'comp-1',
        competicaoId: 'comp-1',
        seasonId: 's-2025',
        temporadaId: 's-2025',
        status: 'HOMOLOGADO',
        joinedAt: '2025-08-01T10:00:00Z',
      };
      dataStore.saveCompetitionParticipant(thalesParticipant);
      list.push(thalesParticipant);
    }

    return competitionId ? list.filter((p) => p.competitionId === competitionId) : list;
  },

  async getByCompetition(competitionId: string): Promise<CompetitionParticipant[]> {
    return this.getAll(competitionId);
  },

  async isClubParticipant(competitionId: string, clubId: string): Promise<boolean> {
    const list = await this.getByCompetition(competitionId);
    return list.some((p) => p.clubId === clubId || p.clubeId === clubId);
  },

  async getClubsByCompetition(competitionId: string): Promise<Club[]> {
    const participants = await this.getByCompetition(competitionId);
    const allClubs = await clubesService.getAll();
    const clubMap = new Map<string, Club>();
    allClubs.forEach((c) => clubMap.set(c.id, c));

    return participants
      .map((p) => clubMap.get(p.clubId))
      .filter((c): c is Club => c !== undefined);
  },

  async addParticipant(params: {
    competitionId: string;
    clubId: string;
    seasonId?: string;
    clubName?: string;
  }): Promise<CompetitionParticipant> {
    const existing = await this.getByCompetition(params.competitionId);
    const found = existing.find((p) => p.clubId === params.clubId);
    if (found) {
      return found;
    }

    let clubName = params.clubName;
    if (!clubName) {
      const club = await clubesService.getById(params.clubId);
      clubName = club?.name || 'Clube Participante';
    }

    const participant: CompetitionParticipant = {
      id: `${params.competitionId}_${params.clubId}`,
      clubId: params.clubId,
      clubeId: params.clubId,
      clubName,
      competitionId: params.competitionId,
      competicaoId: params.competitionId,
      seasonId: params.seasonId || 's-2025',
      temporadaId: params.seasonId || 's-2025',
      status: 'CONFIRMADO',
      joinedAt: new Date().toISOString(),
    };

    dataStore.saveCompetitionParticipant(participant);

    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const docRef = doc(firestoreDb, 'participantes', participant.id);
        await setDoc(docRef, participant, { merge: true });
      } catch (err) {
        console.warn('Falha ao persistir participante no Firestore.', err);
      }
    }

    return participant;
  },

  async removeParticipant(competitionId: string, clubId: string): Promise<void> {
    const id = `${competitionId}_${clubId}`;
    dataStore.deleteCompetitionParticipant(id);

    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const docRef = doc(firestoreDb, 'participantes', id);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn('Falha ao remover participante no Firestore.', err);
      }
    }
  },

  async homologateParticipants(competitionId: string): Promise<void> {
    const list = await this.getByCompetition(competitionId);
    for (const p of list) {
      p.status = 'HOMOLOGADO';
      dataStore.saveCompetitionParticipant(p);
      if (isFirebaseConfigured() && firestoreDb) {
        try {
          const docRef = doc(firestoreDb, 'participantes', p.id);
          await setDoc(docRef, { status: 'HOMOLOGADO' }, { merge: true });
        } catch {
          // ignore
        }
      }
    }
  },

  async setParticipantsForCompetition(
    competitionId: string,
    clubIds: string[],
    seasonId: string = 's-2026'
  ): Promise<CompetitionParticipant[]> {
    const existing = await this.getByCompetition(competitionId);
    const existingClubIds = new Set(existing.map((p) => p.clubId));
    const targetClubIds = new Set(clubIds);

    // Remove os que não estão na lista
    for (const p of existing) {
      if (!targetClubIds.has(p.clubId)) {
        await this.removeParticipant(competitionId, p.clubId);
      }
    }

    // Adiciona os novos
    for (const clubId of clubIds) {
      if (!existingClubIds.has(clubId)) {
        await this.addParticipant({ competitionId, clubId, seasonId });
      }
    }

    return this.getByCompetition(competitionId);
  },
};
