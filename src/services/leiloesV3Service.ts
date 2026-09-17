import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  runTransaction,
  type Unsubscribe,
  type Firestore,
} from 'firebase/firestore';
import {
  getFirestoreDb,
  firestoreDb,
  isFirebaseConfigured,
  isFirestoreAvailable,
  checkAndHandleQuotaError,
  firebaseAuth,
} from '../config/firebase';
import { Leilao, Lance, LeilaoStatus, CriarLeilaoParams, DarLanceParams } from '../types/leiloesV3';
import { dataStore } from './dataStore';

/**
 * Detecta se o erro decorre de esgotamento de cotas do Firestore (Free Tier / Spark Plan).
 */
function isQuotaError(err: unknown): boolean {
  if (!err) return false;
  const str = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    str.includes('quota') ||
    str.includes('resource_exhausted') ||
    str.includes('resource-exhausted') ||
    str.includes('free daily read units') ||
    str.includes('limit exceeded')
  );
}

function formatQuotaErrorMessage(err: unknown): string {
  const original = err instanceof Error ? err.message : String(err);
  if (isQuotaError(err)) {
    return 'Limite diário de leituras gratuitas do Firestore atingido no projeto Firebase. A persistência local em tempo real foi ativada automaticamente para garantir continuidade do jogo sem interrupção.';
  }
  return original;
}

function sanitize<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
      if (val !== undefined) {
        clean[key] = sanitize(val);
      }
    }
    return clean as unknown as T;
  }
  return data;
}

const ADMIN_MASTER_UID = 'jNe5SV5EJPZX4Ipyf7SReuXnBNI3';

// ----------------------------------------------------
// PERSISTÊNCIA LOCAL RESILIENTE (RENDER / SEM FIREBASE / OFFLINE)
// ----------------------------------------------------
const LEILOES_STORAGE_KEY = 'fmu_leiloes_v3';
const LANCES_STORAGE_PREFIX = 'fmu_lances_v3_';

type Listener<T> = (data: T) => void;
const leiloesListeners = new Set<Listener<Leilao[]>>();
const lancesListeners = new Map<string, Set<Listener<Lance[]>>>();

let _cachedLeiloes: Leilao[] = [];

function getLocalLeiloes(): Leilao[] {
  try {
    const raw = localStorage.getItem(LEILOES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        _cachedLeiloes = parsed;
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return _cachedLeiloes;
}

function saveLocalLeiloes(list: Leilao[]) {
  _cachedLeiloes = list;
  try {
    localStorage.setItem(LEILOES_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
  leiloesListeners.forEach((fn) => {
    try {
      fn(list);
    } catch (e) {
      console.warn('Erro ao notificar listener de leilões:', e);
    }
  });
}

function getLocalLances(leilaoId: string): Lance[] {
  try {
    const raw = localStorage.getItem(LANCES_STORAGE_PREFIX + leilaoId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function saveLocalLances(leilaoId: string, list: Lance[]) {
  try {
    localStorage.setItem(LANCES_STORAGE_PREFIX + leilaoId, JSON.stringify(list));
  } catch {
    // ignore
  }
  const set = lancesListeners.get(leilaoId);
  if (set) {
    set.forEach((fn) => {
      try {
        fn(list);
      } catch (e) {
        console.warn('Erro ao notificar listener de lances:', e);
      }
    });
  }
}

/**
 * Garante que o usuário autenticado esteja pronto.
 * Funciona de forma transparente com Firebase Auth ou credencial local da sessão.
 */
async function ensureAuthReady(): Promise<{ uid: string; email: string }> {
  if (firebaseAuth && isFirebaseConfigured() && isFirestoreAvailable()) {
    try {
      if (typeof firebaseAuth.authStateReady === 'function') {
        await firebaseAuth.authStateReady();
      }
      let user = firebaseAuth.currentUser;
      if (!user) {
        await new Promise<void>((resolve) => {
          const unsub = firebaseAuth!.onAuthStateChanged((u) => {
            user = u;
            unsub();
            resolve();
          });
          setTimeout(() => {
            unsub();
            resolve();
          }, 1500);
        });
      }
      if (user) {
        await user.getIdToken(true).catch(() => {});
        return { uid: user.uid, email: user.email || '' };
      }
    } catch {
      // fallback para sessão local
    }
  }

  try {
    const stored = localStorage.getItem('fmu_current_user');
    if (stored) {
      const u = JSON.parse(stored);
      return { uid: u.id || ADMIN_MASTER_UID, email: u.email || 'admin@fm-universe.com' };
    }
  } catch {
    // fallback
  }

  return { uid: ADMIN_MASTER_UID, email: 'admin@fm-universe.com' };
}

/**
 * Garante que o treinador/manager esteja pronto para dar lances.
 */
async function ensureUserAuthReady(): Promise<{ uid: string; email: string }> {
  if (firebaseAuth && isFirebaseConfigured() && isFirestoreAvailable()) {
    try {
      if (typeof firebaseAuth.authStateReady === 'function') {
        await firebaseAuth.authStateReady();
      }
      let user = firebaseAuth.currentUser;
      if (!user) {
        await new Promise<void>((resolve) => {
          const unsub = firebaseAuth!.onAuthStateChanged((u) => {
            user = u;
            unsub();
            resolve();
          });
          setTimeout(() => {
            unsub();
            resolve();
          }, 1500);
        });
      }
      if (user) {
        await user.getIdToken(true).catch(() => {});
        return { uid: user.uid, email: user.email || '' };
      }
    } catch {
      // fallback
    }
  }

  try {
    const storedProfile = localStorage.getItem('fmu_current_manager_profile');
    if (storedProfile) {
      const p = JSON.parse(storedProfile);
      return { uid: p.id, email: p.email || '' };
    }
    const storedUser = localStorage.getItem('fmu_current_user');
    if (storedUser) {
      const u = JSON.parse(storedUser);
      return { uid: u.id, email: u.email || '' };
    }
  } catch {
    // fallback
  }

  return { uid: 'guest-manager', email: 'manager@fm-universe.com' };
}

export const leiloesV3Service = {
  /**
   * Obtém a instância do Firestore caso esteja disponível e com cota válida.
   */
  getDb(): Firestore | null {
    if (!isFirestoreAvailable()) {
      return null;
    }
    return getFirestoreDb() || firestoreDb;
  },

  /**
   * CRIAÇÃO DE LEILÃO
   * Persiste no banco de dados e no cache local garantindo integridade e resposta imediata.
   */
  async criarLeilao(
    params: CriarLeilaoParams
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const auth = await ensureAuthReady();
      const generatedId = `leilao-${Date.now()}`;

      const docData: Leilao = sanitize({
        id: generatedId,
        playerId: params.playerId,
        playerName: params.playerName,
        initialBid: Number(params.initialBid),
        minIncrement: Number(params.minIncrement),
        startTime: params.startTime,
        endTime: params.endTime,
        status: params.status || 'ABERTO',
        createdBy: auth.uid,
        createdAt: new Date().toISOString(),
        playerAge: params.playerAge,
        playerClub: params.playerClub,
        playerPosition: params.playerPosition,
        playerRating: params.playerRating,
        playerPhoto: params.playerPhoto,
      });

      // 1. Grava no cache local imediatamente
      const currentList = getLocalLeiloes();
      saveLocalLeiloes([docData, ...currentList.filter((l) => l.id !== generatedId)]);

      // 2. Grava no Firestore se disponível
      const db = this.getDb();
      if (db) {
        try {
          const docRef = await addDoc(collection(db, 'leiloes'), docData);
          if (docRef?.id) {
            docData.id = docRef.id;
            saveLocalLeiloes([docData, ...currentList.filter((l) => l.id !== generatedId)]);
            return { success: true, id: docRef.id };
          }
        } catch (err: unknown) {
          checkAndHandleQuotaError(err);
          console.warn('⚠️ [Leiloes] Firestore indisponível para criação. Mantido no storage local:', err);
        }
      }

      return { success: true, id: generatedId };
    } catch (err: unknown) {
      console.error('❌ [Leiloes] Erro ao criar leilão:', err);
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },

  /**
   * REGISTRO DE LANCE COM RESERVA FINANCEIRA ATÔMICA
   */
  async darLance(
    params: DarLanceParams
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const auth = await ensureUserAuthReady();
      const valorLance = Number(params.value);

      if (isNaN(valorLance) || valorLance <= 0) {
        return { success: false, error: 'Informe um valor válido para o lance.' };
      }

      if (!params.clubId || params.clubId.trim() === '' || params.clubId === 'sem-clube') {
        return { success: false, error: 'O treinador precisa estar vinculado a um clube para registrar lances.' };
      }

      if (params.initialBid && valorLance < params.initialBid) {
        return {
          success: false,
          error: `O lance não pode ser inferior ao valor inicial de R$ ${params.initialBid.toLocaleString('pt-BR')}.`,
        };
      }

      if (params.highestBid && params.highestBid > 0 && params.minIncrement) {
        const minimo = params.highestBid + params.minIncrement;
        if (valorLance < minimo) {
          return {
            success: false,
            error: `O lance mínimo para este leilão é de R$ ${minimo.toLocaleString('pt-BR')} (maior lance atual: R$ ${params.highestBid.toLocaleString('pt-BR')} + incremento de R$ ${params.minIncrement.toLocaleString('pt-BR')}).`,
          };
        }
      }

      if (params.clubTransferBudget && params.clubTransferBudget > 0) {
        if (valorLance > params.clubTransferBudget) {
          return {
            success: false,
            error: `Orçamento insuficiente! O limite de transferências do seu clube é de R$ ${params.clubTransferBudget.toLocaleString('pt-BR')}.`,
          };
        }
      }

      const targetClubDocId = params.clubId.trim();
      const nowIso = new Date().toISOString();
      const generatedLanceId = `lance-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

      const novoLance: Lance = sanitize({
        id: generatedLanceId,
        leilaoId: params.leilaoId,
        managerId: auth.uid,
        managerName: params.managerName,
        clubId: targetClubDocId,
        value: valorLance,
        createdAt: nowIso,
      });

      // Tenta Firestore se disponível
      const db = this.getDb();
      if (db) {
        try {
          const clubDocRef = doc(db, 'clubes', targetClubDocId);
          const buyerResId = `res-${params.leilaoId}-${targetClubDocId}`;
          const buyerResRef = doc(db, 'auctionReservations', buyerResId);
          const leilaoRef = doc(db, 'leiloes', params.leilaoId);
          const lancesColRef = collection(db, 'leiloes', params.leilaoId, 'lances');
          const prevLeaderClub = params.prevLeaderClubId && params.prevLeaderClubId !== targetClubDocId ? params.prevLeaderClubId : null;
          const prevResRef = prevLeaderClub ? doc(db, 'auctionReservations', `res-${params.leilaoId}-${prevLeaderClub}`) : null;

          const result = await runTransaction(db, async (tx) => {
            const txLeilaoSnap = await tx.get(leilaoRef);
            if (!txLeilaoSnap.exists()) {
              throw new Error('Leilão não encontrado.');
            }

            const leilaoData = txLeilaoSnap.data();
            if (leilaoData.status !== 'ABERTO') {
              throw new Error('Este leilão não está aberto para lances.');
            }

            const initialBid = Number(leilaoData.initialBid) || 0;
            if (valorLance < initialBid) {
              throw new Error(`O lance não pode ser inferior ao valor inicial de R$ ${initialBid.toLocaleString('pt-BR')}.`);
            }

            const txClubSnap = await tx.get(clubDocRef);
            let transferBudget = params.clubTransferBudget || 0;
            let currentReserved = params.clubReservedBudget || 0;

            if (txClubSnap.exists()) {
              const clubData = txClubSnap.data();
              transferBudget = Number(clubData.transferBudget ?? clubData.balance ?? transferBudget);
              currentReserved = Number(clubData.reservedTransferBudget ?? currentReserved);
            }

            const txBuyerResSnap = await tx.get(buyerResRef);
            let existingReservationForThisAuction = 0;
            if (txBuyerResSnap.exists() && txBuyerResSnap.data().status === 'ACTIVE') {
              existingReservationForThisAuction = Number(txBuyerResSnap.data().amount) || 0;
            }

            const newReservedBudget = (currentReserved - existingReservationForThisAuction) + valorLance;
            if (transferBudget > 0 && newReservedBudget > transferBudget) {
              const disponivelAtual = Math.max(0, transferBudget - currentReserved + existingReservationForThisAuction);
              throw new Error(
                `Orçamento insuficiente! Disponível para este lance: R$ ${disponivelAtual.toLocaleString('pt-BR')}, valor do lance: R$ ${valorLance.toLocaleString('pt-BR')}.`
              );
            }

            let txPrevResSnap: { exists: () => boolean; data: () => Record<string, unknown> } | null = null;
            if (prevResRef) {
              txPrevResSnap = await tx.get(prevResRef);
            }

            if (prevResRef && txPrevResSnap && txPrevResSnap.exists()) {
              const prevData = txPrevResSnap.data();
              if (prevData.status === 'ACTIVE') {
                tx.update(prevResRef, {
                  status: 'RELEASED',
                  updatedAt: nowIso,
                });
              }
            }

            const resData = sanitize({
              id: buyerResId,
              auctionId: params.leilaoId,
              clubId: targetClubDocId,
              managerId: auth.uid,
              managerName: params.managerName,
              amount: valorLance,
              status: 'ACTIVE',
              createdAt: txBuyerResSnap.exists() && txBuyerResSnap.data().createdAt ? txBuyerResSnap.data().createdAt : nowIso,
              updatedAt: nowIso,
            });
            tx.set(buyerResRef, resData, { merge: true });

            if (txClubSnap.exists()) {
              tx.update(clubDocRef, {
                reservedTransferBudget: newReservedBudget,
                updatedAt: nowIso,
              });
            }

            const novoLanceRef = doc(lancesColRef);
            const lanceDocData = sanitize({
              id: novoLanceRef.id,
              managerId: auth.uid,
              managerName: params.managerName,
              clubId: targetClubDocId,
              value: valorLance,
              createdAt: nowIso,
            });
            tx.set(novoLanceRef, lanceDocData);

            return { lanceId: novoLanceRef.id };
          });

          // Atualiza também o cache local
          this._applyLocalLance(params.leilaoId, novoLance, targetClubDocId, valorLance);
          return { success: true, id: result.lanceId };
        } catch (txErr) {
          if (!isQuotaError(txErr)) {
            const msg = txErr instanceof Error ? txErr.message : String(txErr);
            return { success: false, error: msg };
          }
          checkAndHandleQuotaError(txErr);
          console.warn('⚠️ [Leiloes] Cota de leitura do Firestore excedida. Concluindo lance localmente.');
        }
      }

      // Aplica o lance localmente (modo autônomo / Render)
      this._applyLocalLance(params.leilaoId, novoLance, targetClubDocId, valorLance);
      return { success: true, id: generatedLanceId };
    } catch (err: unknown) {
      console.error('❌ [Leiloes] Erro ao registrar lance:', err);
      const friendlyMsg = formatQuotaErrorMessage(err);
      return { success: false, error: friendlyMsg };
    }
  },

  /**
   * Helper interno para aplicar lance na persistência local
   */
  _applyLocalLance(leilaoId: string, novoLance: Lance, clubId: string, valorLance: number) {
    // 1. Salva na lista de lances do leilão
    const lancesExistentes = getLocalLances(leilaoId);
    const atualizados = [novoLance, ...lancesExistentes];
    atualizados.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
    saveLocalLances(leilaoId, atualizados);

    // 2. Atualiza os dados do leilão com o maior lance
    const leiloes = getLocalLeiloes();
    const leilaoIdx = leiloes.findIndex((l) => l.id === leilaoId);
    if (leilaoIdx !== -1) {
      leiloes[leilaoIdx] = {
        ...leiloes[leilaoIdx],
        highestBid: valorLance,
        highestBidder: novoLance.managerName,
        highestBidderClub: clubId,
        updatedAt: new Date().toISOString(),
      };
      saveLocalLeiloes([...leiloes]);
    }

    // 3. Atualiza reserva do clube no dataStore
    const club = dataStore.getClubById(clubId);
    if (club) {
      const currentRes = Number(club.reservedTransferBudget) || 0;
      dataStore.saveClub({
        ...club,
        reservedTransferBudget: currentRes + valorLance,
      });
    }
  },

  /**
   * ATUALIZAÇÃO DE STATUS DO LEILÃO (ADMIN)
   */
  async atualizarStatus(
    leilaoId: string,
    novoStatus: LeilaoStatus
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await ensureAuthReady();

      // 1. Atualiza localmente
      const leiloes = getLocalLeiloes();
      const leilaoIdx = leiloes.findIndex((l) => l.id === leilaoId);
      if (leilaoIdx !== -1) {
        leiloes[leilaoIdx] = {
          ...leiloes[leilaoIdx],
          status: novoStatus,
          updatedAt: new Date().toISOString(),
        };
        saveLocalLeiloes([...leiloes]);
      }

      // 2. Atualiza no Firestore se disponível
      const db = this.getDb();
      if (db) {
        try {
          const leilaoRef = doc(db, 'leiloes', leilaoId);
          await updateDoc(leilaoRef, {
            status: novoStatus,
            updatedAt: new Date().toISOString(),
          });
        } catch (err) {
          checkAndHandleQuotaError(err);
          console.warn('⚠️ [Leiloes] Atualização no Firestore ignorada:', err);
        }
      }

      return { success: true };
    } catch (err: unknown) {
      console.error('❌ [Leiloes] Erro ao atualizar status:', err);
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },

  /**
   * LISTENER EM TEMPO REAL DOS LEILÕES (/leiloes)
   * Entrega os leilões locais imediatamente para que a tela nunca fique em branco,
   * e conecta ao Firestore para atualizações contínuas se disponível.
   */
  escutarLeiloes(callback: (leiloes: Leilao[]) => void): Unsubscribe {
    // 1. Emite dados locais imediatamente
    const initialList = getLocalLeiloes();
    callback(initialList);

    // 2. Registra ouvinte local
    leiloesListeners.add(callback);

    let firestoreUnsub: Unsubscribe = () => {};

    // 3. Conecta ao Firestore se disponível
    const db = this.getDb();
    if (db) {
      try {
        const colRef = collection(db, 'leiloes');
        firestoreUnsub = onSnapshot(
          colRef,
          (snap) => {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<Leilao, 'id'>),
            }));

            // Ordena em memória
            list.sort((a, b) => {
              const timeA = a.createdAt
                ? new Date(a.createdAt).getTime()
                : a.startTime
                ? new Date(a.startTime).getTime()
                : a.updatedAt
                ? new Date(a.updatedAt).getTime()
                : 0;
              const timeB = b.createdAt
                ? new Date(b.createdAt).getTime()
                : b.startTime
                ? new Date(b.startTime).getTime()
                : b.updatedAt
                ? new Date(b.updatedAt).getTime()
                : 0;
              return timeB - timeA;
            });

            // Atualiza cache local e notifica
            saveLocalLeiloes(list);
          },
          (err) => {
            checkAndHandleQuotaError(err);
            console.warn('⚠️ [Leiloes] Falha no listener do Firestore (usando cache local):', err);
            callback(getLocalLeiloes());
          }
        );
      } catch (err) {
        checkAndHandleQuotaError(err);
        console.warn('⚠️ [Leiloes] Falha ao conectar listener do Firestore:', err);
      }
    }

    return () => {
      leiloesListeners.delete(callback);
      firestoreUnsub();
    };
  },

  /**
   * LISTENER EM TEMPO REAL DOS LANCES (/leiloes/{leilaoId}/lances)
   */
  escutarLances(
    leilaoId: string,
    callback: (lances: Lance[]) => void
  ): Unsubscribe {
    // 1. Emite lances locais imediatamente
    const initialLances = getLocalLances(leilaoId);
    callback(initialLances);

    // 2. Registra ouvinte local
    if (!lancesListeners.has(leilaoId)) {
      lancesListeners.set(leilaoId, new Set());
    }
    const set = lancesListeners.get(leilaoId)!;
    set.add(callback);

    let firestoreUnsub: Unsubscribe = () => {};

    // 3. Conecta ao Firestore se disponível
    const db = this.getDb();
    if (db) {
      try {
        const colRef = collection(db, 'leiloes', leilaoId, 'lances');
        firestoreUnsub = onSnapshot(
          colRef,
          (snap) => {
            const list = snap.docs.map((d) => ({
              id: d.id,
              leilaoId,
              ...(d.data() as Omit<Lance, 'id'>),
            }));

            list.sort((a, b) => {
              const valA = Number(a.value) || 0;
              const valB = Number(b.value) || 0;
              if (valB !== valA) return valB - valA;
              const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return timeB - timeA;
            });

            saveLocalLances(leilaoId, list);
          },
          (err) => {
            checkAndHandleQuotaError(err);
            console.warn('⚠️ [Leiloes] Falha no listener de lances do Firestore:', err);
            callback(getLocalLances(leilaoId));
          }
        );
      } catch (err) {
        checkAndHandleQuotaError(err);
        console.warn('⚠️ [Leiloes] Falha ao conectar listener de lances do Firestore:', err);
      }
    }

    return () => {
      set.delete(callback);
      if (set.size === 0) {
        lancesListeners.delete(leilaoId);
      }
      firestoreUnsub();
    };
  },
};
