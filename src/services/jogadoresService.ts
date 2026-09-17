import { Player, PlayerQueryOptions, PaginatedResult } from '../types';
import { isFirebaseConfigured, firestoreDb, getFirestoreDb, firebaseAuth, FIRESTORE_DATABASE_ID } from '../config/firebase';
import { dataStore } from './dataStore';
import { transferenciasService } from './transferenciasService';
import { collection, getDocs, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

/**
 * Sanitiza recursivamente qualquer objeto ou array antes de enviar ao Firestore,
 * removendo estritamente qualquer campo com valor `undefined`.
 * O Firestore rejeita completamente chamadas a WriteBatch.set com Unsupported field value: undefined.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleanObj[key] = sanitizeForFirestore(value);
      }
    }
    return cleanObj as T;
  }
  return data;
}

/**
 * Normaliza um objeto Player recuperado do Firestore para garantir integridade
 * de campos obrigatórios (stats, attributes, defaults) e prevenir quebras de UI.
 */
function normalizePlayerRecord(raw: any, id: string): Player {
  const p = { ...raw, id: raw.id || id };

  // Garantir valores padrão para campos numéricos e identificadores
  p.jerseyNumber = p.jerseyNumber ?? 0;
  p.overall = typeof p.overall === 'number' ? p.overall : 70;
  p.potential = typeof p.potential === 'number' ? p.potential : (p.overall || 70);
  p.age = typeof p.age === 'number' ? p.age : 22;
  p.marketValue = typeof p.marketValue === 'number' ? p.marketValue : 1000000;
  p.wage = typeof p.wage === 'number' ? p.wage : 10000;
  p.nationalityCode = p.nationalityCode || 'BRA';
  p.position = p.position || 'MC';
  p.positionCategory = p.positionCategory || 'MID';
  p.name = p.name || 'Jogador';
  p.fullName = p.fullName || p.name;
  p.clubName = p.clubName || 'Sem Clube';
  p.clubId = p.clubId || 'free-agent';
  p.contractUntil = p.contractUntil || '2026-12-31';
  p.morale = p.morale || 'Muito Boa';
  p.condition = typeof p.condition === 'number' ? p.condition : 95;

  // Garantir integridade de stats
  p.stats = {
    matches: typeof p.stats?.matches === 'number' ? p.stats.matches : 0,
    goals: typeof p.stats?.goals === 'number' ? p.stats.goals : 0,
    assists: typeof p.stats?.assists === 'number' ? p.stats.assists : 0,
    averageRating: typeof p.stats?.averageRating === 'number' ? p.stats.averageRating : 6.5,
    minutesPlayed: typeof p.stats?.minutesPlayed === 'number' ? p.stats.minutesPlayed : 0,
    yellowCards: typeof p.stats?.yellowCards === 'number' ? p.stats.yellowCards : 0,
    redCards: typeof p.stats?.redCards === 'number' ? p.stats.redCards : 0,
    cleanSheets: typeof p.stats?.cleanSheets === 'number' ? p.stats.cleanSheets : 0,
  };

  // Garantir integridade de attributes
  p.attributes = {
    pace: typeof p.attributes?.pace === 'number' ? p.attributes.pace : 70,
    shooting: typeof p.attributes?.shooting === 'number' ? p.attributes.shooting : 65,
    passing: typeof p.attributes?.passing === 'number' ? p.attributes.passing : 70,
    dribbling: typeof p.attributes?.dribbling === 'number' ? p.attributes.dribbling : 70,
    defending: typeof p.attributes?.defending === 'number' ? p.attributes.defending : 60,
    physical: typeof p.attributes?.physical === 'number' ? p.attributes.physical : 70,
  };

  return p as Player;
}

/**
 * Obtém o mapa consolidado de transferências concluídas (via histórico oficial e propostas aceitas).
 * Garante que jogadores transferidos tenham seu clube atual refletido imediatamente nas consultas,
 * mesmo quando a coleção base de jogadores não tiver sido regravada ou quando a página for recarregada (F5).
 */
async function getCompletedTransfersMap(): Promise<Map<string, { toClubId: string; toClubName: string; timestamp: number }>> {
  const result = new Map<string, { toClubId: string; toClubName: string; timestamp: number }>();

  // 1. Consulta histórico de transferências concluídas (Firestore / local)
  try {
    const transfers = await transferenciasService.getAll();
    for (const t of transfers) {
      if (t.status === 'COMPLETED' && t.playerId && t.toClubId) {
        const time = t.createdAt ? new Date(t.createdAt).getTime() : (t.date ? new Date(t.date).getTime() : 0);
        const existing = result.get(t.playerId);
        if (!existing || time >= existing.timestamp) {
          result.set(t.playerId, {
            toClubId: t.toClubId,
            toClubName: t.toClubName || '',
            timestamp: time,
          });
        }
      }
    }
  } catch (err) {
    console.warn('Falha ao consultar transferências para sincronização do elenco:', err);
  }

  // 2. Consulta propostas com status COMPLETED (Firestore / local)
  try {
    const db = getFirestoreDb() || firestoreDb;
    if (isFirebaseConfigured() && db) {
      const colRef = collection(db, 'transferOffers');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        snap.forEach((d) => {
          const data = d.data();
          if (data.status === 'COMPLETED' && data.playerId && (data.buyerClubId || data.toClubId)) {
            const time = data.updatedAt ? new Date(data.updatedAt).getTime() : (data.createdAt ? new Date(data.createdAt).getTime() : 0);
            const existing = result.get(data.playerId);
            const targetClubId = data.buyerClubId || data.toClubId;
            const targetClubName = data.buyerClubName || data.toClubName || '';
            if (!existing || time >= existing.timestamp) {
              result.set(data.playerId, {
                toClubId: targetClubId,
                toClubName: targetClubName,
                timestamp: time,
              });
            }
          }
        });
      }
    } else {
      const localOffers = dataStore.getTransferOffers();
      for (const o of localOffers) {
        if (o.status === 'COMPLETED' && o.playerId && o.buyerClubId) {
          const time = o.updatedAt ? new Date(o.updatedAt).getTime() : (o.createdAt ? new Date(o.createdAt).getTime() : 0);
          const existing = result.get(o.playerId);
          if (!existing || time >= existing.timestamp) {
            result.set(o.playerId, {
              toClubId: o.buyerClubId,
              toClubName: o.buyerClubName || '',
              timestamp: time,
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('Falha ao consultar propostas concluídas para sincronização do elenco:', err);
  }

  return result;
}

function applyTransfersToPlayers(players: Player[], transferMap: Map<string, { toClubId: string; toClubName: string }>): Player[] {
  if (transferMap.size === 0) return players;
  return players.map((p) => {
    const transfer = transferMap.get(p.id);
    if (transfer) {
      return {
        ...p,
        clubId: transfer.toClubId,
        clubName: transfer.toClubName || p.clubName,
      };
    }
    return p;
  });
}

let cachedPlayers: Player[] | null = null;
let lastFetchTimestamp = 0;
const CACHE_TTL = 30000; // 30s de cache em memória para evitar leituras repetitivas do Firestore

export const jogadoresService = {
  invalidateCache() {
    cachedPlayers = null;
    lastFetchTimestamp = 0;
  },

  async getAll(forceRefresh = false): Promise<Player[]> {
    if (!forceRefresh && cachedPlayers && Date.now() - lastFetchTimestamp < CACHE_TTL) {
      return cachedPlayers;
    }

    let players: Player[] = [];
    const db = getFirestoreDb() || firestoreDb;
    if (isFirebaseConfigured() && db) {
      try {
        const colRef = collection(db, 'jogadores');
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          players = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as any))
            // Ignora documentos temporários de teste ou auditoria
            .filter((p) => p && p.auditTestRecord !== true && !String(p.id).startsWith('teste-homologacao-'))
            .map((p) => normalizePlayerRecord(p, p.id));
        }
      } catch (err) {
        console.warn('Falha na consulta Firestore para jogadores. Usando fallback.', err);
      }
    }

    if (players.length === 0) {
      players = dataStore.getPlayers();
    }

    // Aplica transferências concluídas para manter propriedade do atleta atualizada
    const completedMap = await getCompletedTransfersMap();
    const reconciledPlayers = applyTransfersToPlayers(players, completedMap);

    // Sincroniza o catálogo local completo no dataStore para paginação e busca sem limite de 300
    if (reconciledPlayers.length > 0) {
      dataStore.setPlayers(reconciledPlayers);
    }

    cachedPlayers = reconciledPlayers;
    lastFetchTimestamp = Date.now();

    return reconciledPlayers;
  },

  /**
   * Consulta paginada escalável para suportar milhares de jogadores (FM26/FM2008).
   */
  async getPaginated(options: PlayerQueryOptions = {}): Promise<PaginatedResult<Player>> {
    // Garante sincronização se a base local estiver vazia ou se não houver cache ativo
    if (dataStore.getPlayers().length === 0 || !cachedPlayers) {
      await this.getAll();
    }
    return dataStore.queryPlayers(options);
  },

  async getById(id: string): Promise<Player | null> {
    const all = await this.getAll();
    const found = all.find((p) => p.id === id);
    if (found) return found;

    const db = getFirestoreDb() || firestoreDb;
    if (isFirebaseConfigured() && db) {
      try {
        const docRef = doc(db, 'jogadores', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const raw = { id: snap.id, ...snap.data() } as any;
          if (raw.auditTestRecord === true) return null;
          const player = normalizePlayerRecord(raw, snap.id);
          const completedMap = await getCompletedTransfersMap();
          const transfer = completedMap.get(player.id);
          if (transfer) {
            player.clubId = transfer.toClubId;
            player.clubName = transfer.toClubName || player.clubName;
          }
          return player;
        }
      } catch (err) {
        console.warn('Falha ao buscar jogador no Firestore.', err);
      }
    }
    const local = dataStore.getPlayerById(id);
    return local ? normalizePlayerRecord(local, local.id) : null;
  },

  async getByExternalId(externalId: string): Promise<Player | null> {
    return dataStore.getPlayerByExternalId(externalId) || null;
  },

  async getByDeduplicationKey(key: string): Promise<Player | null> {
    return dataStore.getPlayerByDeduplicationKey(key) || null;
  },

  async getByClubId(clubId: string): Promise<Player[]> {
    const all = await this.getAll();
    const cleanId = (clubId || '').trim();
    if (!cleanId) return [];

    const club = dataStore.getClubById(cleanId);
    const targetSlug = club?.slug?.toLowerCase();
    const targetName = club?.name?.toLowerCase();

    return all.filter((p) => {
      if (p.clubId === cleanId) return true;
      if (club && p.clubId === club.id) return true;
      if (p.clubId && cleanId && p.clubId.replace(/^club-/, '') === cleanId.replace(/^club-/, '')) return true;
      if (targetSlug && p.clubId?.toLowerCase() === targetSlug) return true;
      if (targetName && p.clubName?.toLowerCase() === targetName) return true;
      return false;
    });
  },

  async save(player: Player): Promise<void> {
    const cleanPlayer = sanitizeForFirestore(player);
    dataStore.savePlayer(cleanPlayer);
    const db = getFirestoreDb() || firestoreDb;
    if (isFirebaseConfigured() && db) {
      try {
        const docRef = doc(db, 'jogadores', cleanPlayer.id);
        await setDoc(docRef, cleanPlayer, { merge: true });
      } catch (err) {
        console.warn('Falha ao persistir jogador no Firestore.', err);
      }
    }
  },

  /**
   * Executa um teste real e controlado de escrita de UM único documento na coleção /jogadores.
   * Não afeta os 22 jogadores do elenco de exemplo e retorna o resultado exato do commit do Firestore.
   * Valida previamente a existência e integridade da sessão do Firebase Auth (currentUser e ID token).
   */
  async testControlledRealWrite(customId?: string): Promise<{
    success: boolean;
    docId: string;
    code?: string;
    error?: string;
    timestamp: string;
    authUid?: string | null;
    authEmail?: string | null;
    databaseId?: string;
  }> {
    const db = getFirestoreDb() || firestoreDb;
    const testDocId = customId || `teste-homologacao-controlado-${Date.now()}`;
    const timestamp = new Date().toISOString();

    if (!isFirebaseConfigured() || !db) {
      return {
        success: false,
        docId: testDocId,
        code: 'firebase-not-configured',
        error: 'Instância do Firestore não está inicializada ou configurada no ambiente.',
        timestamp,
        databaseId: FIRESTORE_DATABASE_ID,
      };
    }

    // 1. Verificação explícita da sessão ativa no Firebase Auth
    const auth = firebaseAuth || (db.app ? getAuth(db.app) : null);
    const currentUser = auth?.currentUser;

    if (!currentUser) {
      return {
        success: false,
        docId: testDocId,
        code: 'auth/unauthenticated',
        error: 'Nenhum usuário autenticado no Firebase Auth (currentUser é nulo). Faça login com a conta de Administrador antes de executar o teste de escrita.',
        timestamp,
        authUid: null,
        authEmail: null,
        databaseId: FIRESTORE_DATABASE_ID,
      };
    }

    const authUid = currentUser.uid;
    const authEmail = currentUser.email || 'sem-email';

    // 2. Garante que o token JWT do Firebase Auth está renovado e válido antes do envio
    try {
      await currentUser.getIdToken(true);
    } catch (tokenErr) {
      console.warn('⚠️ [FM Universe] Não foi possível forçar refresh do token ID antes do teste:', tokenErr);
    }

    const testPayload = sanitizeForFirestore({
      id: testDocId,
      name: 'Jogador Teste Temporário Auditoria',
      nickname: 'Teste Audit',
      club: 'Auditoria FM Universe',
      clubId: 'club-audit-test',
      position: 'MEI',
      secondaryPositions: ['MC'],
      positionCategory: 'MEIO-CAMPO',
      overall: 78,
      age: 21,
      salary: 25000,
      marketValue: 500000,
      nationality: 'Brasil',
      status: 'ATIVO',
      contractUntil: '2027-12-31',
      stats: {
        pace: 75,
        shooting: 72,
        passing: 80,
        dribbling: 79,
        defending: 55,
        physical: 68,
      },
      auditTestRecord: true,
      testedAt: timestamp,
    });

    try {
      const docRef = doc(db, 'jogadores', testDocId);
      // Realiza escrita real via setDoc com merge: true
      await setDoc(docRef, testPayload, { merge: true });
      return {
        success: true,
        docId: testDocId,
        timestamp,
        authUid,
        authEmail,
        databaseId: FIRESTORE_DATABASE_ID,
      };
    } catch (err: any) {
      console.error('❌ [FM Universe] Falha na escrita do teste controlado:', {
        code: err?.code,
        message: err?.message,
        authUid,
        authEmail,
        databaseId: FIRESTORE_DATABASE_ID,
      });
      return {
        success: false,
        docId: testDocId,
        code: err?.code || 'unknown',
        error: `${err?.message || 'Falha ao gravar documento de teste no Firestore.'} (UID: ${authUid}, Email: ${authEmail}, Banco: ${FIRESTORE_DATABASE_ID})`,
        timestamp,
        authUid,
        authEmail,
        databaseId: FIRESTORE_DATABASE_ID,
      };
    }
  },

  /**
   * Grava uma lista de jogadores em lote (Batch).
   * - Sanitiza estritamente os objetos removendo qualquer campo undefined (como birthDate).
   * - Se o Firestore estiver configurado, grava em lotes de até 400 documentos com writeBatch().
   * - REGRA CRÍTICA: Não conta jogadores como gravados caso o batch do Firestore falhe.
   *   Apenas chunks com commit confirmado pelo Firestore são contabilizados e salvos no dataStore local.
   * - Emite progresso caso callback seja fornecido.
   */
  async saveBatch(
    players: Player[],
    onProgress?: (completed: number, total: number) => void,
    options?: {
      baseOffset?: number; // Deslocamento inicial de itens já processados (ex: 10010)
      grandTotal?: number; // Total global da importação (ex: 37867)
      onBatchCommitted?: (committedChunk: Player[], cumulativeCompleted: number) => void; // Chamado estritamente após confirmação real do lote
    }
  ): Promise<{ success: boolean; recorded: number; errors: string[] }> {
    const errors: string[] = [];
    let recorded = 0;
    const baseOffset = Math.max(0, options?.baseOffset || 0);
    const totalToReport = options?.grandTotal && options.grandTotal > 0
      ? options.grandTotal
      : baseOffset + players.length;

    // 1. Sanitização rigorosa contra undefined em todos os campos dos objetos
    const sanitizedPlayers = players.map((p) => sanitizeForFirestore(p));

    // 2. Persistência em lote no Firestore (se configurado)
    const targetDb = getFirestoreDb() || firestoreDb;
    if (isFirebaseConfigured() && targetDb) {
      // Gravação SEQUENCIAL em lotes de no máximo 200 jogadores.
      // Nunca executa lotes simultaneamente e aguarda confirmação antes do próximo.
      const BATCH_SIZE = 200;
      const MAX_ATTEMPTS = 5;

      const isRetriableFirestoreError = (err: any): boolean => {
        if (!err) return false;
        const msg = String(err.message || '').toLowerCase();
        const code = String(err.code || '').toLowerCase();
        return (
          code.includes('resource-exhausted') ||
          code.includes('unavailable') ||
          code.includes('aborted') ||
          code.includes('deadline-exceeded') ||
          msg.includes('write stream exhausted') ||
          msg.includes('resource-exhausted') ||
          msg.includes('resource_exhausted') ||
          msg.includes('maximum allowed queued writes') ||
          msg.includes('overloading the backend') ||
          msg.includes('unavailable') ||
          msg.includes('aborted') ||
          msg.includes('deadline exceeded') ||
          msg.includes('quota exceeded') ||
          msg.includes('rate limit')
        );
      };

      const totalBatches = Math.ceil(sanitizedPlayers.length / BATCH_SIZE);

      for (let i = 0; i < sanitizedPlayers.length; i += BATCH_SIZE) {
        const chunk = sanitizedPlayers.slice(i, i + BATCH_SIZE);
        const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
        let committed = false;
        let lastErr: any = null;

        let attemptsUsed = 0;
        // Execução sequencial com até 5 tentativas e backoff exponencial para cada lote
        for (let attempt = 1; attempt <= MAX_ATTEMPTS && !committed; attempt++) {
          attemptsUsed = attempt;
          try {
            const batch = writeBatch(targetDb);
            for (const player of chunk) {
              const docRef = doc(targetDb, 'jogadores', player.id);
              batch.set(docRef, player, { merge: true });
            }
            await batch.commit();
            committed = true;
          } catch (err: any) {
            lastErr = err;
            const retriable = isRetriableFirestoreError(err);

            if (retriable && attempt < MAX_ATTEMPTS) {
              // Backoff exponencial: ~1s, ~2s, ~4s, ~8s + jitter
              const backoffMs = Math.min(
                1000 * Math.pow(2, attempt - 1) + Math.random() * 250,
                10000
              );
              console.warn(
                `⚠️ [jogadoresService] Lote ${batchIndex}/${totalBatches} falhou na tentativa ${attempt}/${MAX_ATTEMPTS} (${err?.code || err?.message}). Aguardando ${Math.round(backoffMs)}ms para tentar novamente...`
              );
              await new Promise((resolve) => setTimeout(resolve, backoffMs));
            } else {
              // Erro não retentável (ex: permissão) ou esgotamento de 5 tentativas
              break;
            }
          }
        }

        if (committed) {
          // Salva os dados confirmados no dataStore local e incrementa total gravado
          dataStore.savePlayersBatch(chunk);
          recorded += chunk.length;

          // Invoca callback de lote confirmado para avançar checkpoint
          if (options?.onBatchCommitted) {
            try {
              options.onBatchCommitted(chunk, baseOffset + recorded);
            } catch (e) {
              console.warn('⚠️ Erro no callback onBatchCommitted do checkpoint:', e);
            }
          }

          // Atualiza o progresso na interface após cada lote confirmado
          if (onProgress) {
            onProgress(baseOffset + recorded, totalToReport);
          }

          // Pacing cooperativo de 150ms entre lotes para manter o stream do Firestore limpo
          await new Promise((resolve) => setTimeout(resolve, 150));
        } else {
          // Falha definitiva do lote após esgotamento de tentativas ou erro fatal não retentável
          const errDetail = lastErr?.message || lastErr?.code || 'Erro desconhecido no writeBatch';
          console.error(
            `❌ [jogadoresService] Lote ${batchIndex}/${totalBatches} (${chunk.length} jogadores) falhou após ${attemptsUsed} tentativa(s):`,
            lastErr
          );
          errors.push(`Lote ${batchIndex}/${totalBatches} (${i + 1}-${i + chunk.length}): ${errDetail}`);

          // Interrompe o processamento preservando estritamente os jogadores já gravados nos lotes anteriores
          errors.push(
            `Gravação interrompida no lote ${batchIndex}. Os ${recorded} jogadores gravados com sucesso nos lotes anteriores foram preservados.`
          );
          break;
        }
      }
    } else {
      // Fallback para ambiente local/desenvolvimento sem Firebase
      try {
        const { added, updated } = dataStore.savePlayersBatch(sanitizedPlayers);
        recorded = added + updated;
        if (options?.onBatchCommitted) {
          options.onBatchCommitted(sanitizedPlayers, baseOffset + recorded);
        }
      } catch (e: any) {
        console.error('Falha ao salvar lote no dataStore local:', e);
        errors.push(`Erro no armazenamento local: ${e?.message || 'Falha de gravação'}`);
      }

      if (onProgress) {
        onProgress(baseOffset + recorded, totalToReport);
      }
    }

    return {
      success: errors.length === 0 && recorded > 0,
      recorded,
      errors,
    };
  },

  async create(playerData: Omit<Player, 'id'>): Promise<Player> {
    const newPlayer: Player = {
      id: `player-${Date.now()}`,
      ...playerData,
    };
    await this.save(newPlayer);
    return newPlayer;
  },

  async update(id: string, partial: Partial<Player>): Promise<void> {
    const existing = await this.getById(id);
    if (existing) {
      await this.save({ ...existing, ...partial });
    }
  },

  async delete(id: string): Promise<void> {
    dataStore.deletePlayer(id);
  },
};
