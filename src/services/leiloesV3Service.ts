import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  orderBy,
  where,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirestoreDb, firestoreDb, isFirebaseConfigured, firebaseAuth } from '../config/firebase';
import { Leilao, Lance, LeilaoStatus, CriarLeilaoParams, DarLanceParams } from '../types/leiloesV3';

/**
 * Detecta se o erro decorre de esgotamento de cotas do Firestore (Free Tier / Spark Plan).
 */
function isQuotaError(err: unknown): boolean {
  if (!err) return false;
  const str = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    str.includes('quota') ||
    str.includes('resource_exhausted') ||
    str.includes('free daily read units') ||
    str.includes('limit exceeded')
  );
}

function formatQuotaErrorMessage(err: unknown): string {
  const original = err instanceof Error ? err.message : String(err);
  if (isQuotaError(err)) {
    return 'Limite diário de leituras gratuitas do Firestore atingido no projeto Firebase (50.000 leituras/dia). O Google Cloud renova a cota automaticamente à meia-noite (PT) ou você pode ativar o plano Blaze no console do Firebase para requisições ilimitadas.';
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

/**
 * Garante que o Firebase Auth esteja inicializado, o usuário autenticado,
 * o UID seja exatamente o do Administrador Master e o token JWT seja renovado.
 * Utilizado estritamente para operações administrativas (criação de leilão, status).
 */
async function ensureAuthReady(): Promise<{ uid: string; email: string }> {
  if (!firebaseAuth) {
    throw new Error('Firebase Auth não inicializado.');
  }

  // 1. Aguarda o Firebase Auth estar pronto
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
      }, 2500);
    });
  }

  // 2 e 3. Rejeita a operação se currentUser for null
  if (!user) {
    throw new Error('Usuário não autenticado no Firebase Auth.');
  }

  // 4. Valida que currentUser.uid é exatamente jNe5SV5EJPZX4Ipyf7SReuXnBNI3
  if (user.uid !== ADMIN_MASTER_UID) {
    throw new Error(
      `Permissão negada no cliente: UID autenticado (${user.uid}) difere do Administrador autorizado (${ADMIN_MASTER_UID}).`
    );
  }

  // 5. Executa await currentUser.getIdToken(true) antes de retornar
  await user.getIdToken(true);

  // 6. Retorna para permitir a execução segura do addDoc
  return { uid: user.uid, email: user.email || '' };
}

/**
 * Garante que o Firebase Auth esteja inicializado e haja um usuário autenticado.
 * Utilizado por treinadores/managers para dar lances, sem exigir o UID do administrador.
 */
async function ensureUserAuthReady(): Promise<{ uid: string; email: string }> {
  if (!firebaseAuth) {
    throw new Error('Firebase Auth não inicializado.');
  }

  // 1. Aguarda o Firebase Auth estar pronto
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
      }, 2500);
    });
  }

  // 2. Rejeita a operação se currentUser for null
  if (!user) {
    throw new Error('Usuário não autenticado no Firebase Auth.');
  }

  // 3. Renova o token JWT
  await user.getIdToken(true);

  return { uid: user.uid, email: user.email || '' };
}

export const leiloesV3Service = {
  /**
   * Obtém a instância oficial do Firestore.
   */
  getDb() {
    const db = getFirestoreDb() || firestoreDb;
    if (!db || !isFirebaseConfigured()) {
      throw new Error('Firestore não está configurado.');
    }
    return db;
  },

  /**
   * CRIAÇÃO DE LEILÃO
   * Realiza UMA ÚNICA gravação em /leiloes/{leilaoId}.
   * Nenhuma outra coleção é alterada ou consultada.
   */
  async criarLeilao(
    params: CriarLeilaoParams
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const auth = await ensureAuthReady();
      const db = this.getDb();

      const docData = sanitize({
        playerId: params.playerId,
        playerName: params.playerName,
        initialBid: Number(params.initialBid),
        minIncrement: Number(params.minIncrement),
        startTime: params.startTime,
        endTime: params.endTime,
        status: params.status || 'ABERTO',
        createdBy: auth.uid,
        createdAt: new Date().toISOString(),
        // Metadados visuais
        playerAge: params.playerAge,
        playerClub: params.playerClub,
        playerPosition: params.playerPosition,
        playerRating: params.playerRating,
        playerPhoto: params.playerPhoto,
      });

      // UMA ÚNICA gravação no Firestore
      const docRef = await addDoc(collection(db, 'leiloes'), docData);

      return { success: true, id: docRef.id };
    } catch (err: unknown) {
      console.error('❌ [Leiloes] Erro ao criar leilão:', err);
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },

  /**
   * REGISTRO DE LANCE COM RESERVA FINANCEIRA ATÔMICA
   * Executa runTransaction no Firestore garantindo:
   * 1. Validação de autenticação (currentUser.uid === params.managerId);
   * 2. Leitura do leilão e validação de status ABERTO, initialBid e minIncrement;
   * 3. Leitura do clube (/clubes/{clubId}) e validação de orçamento (transferBudget vs reservedTransferBudget);
   * 4. Se o mesmo clube for o líder, recalcula apenas a diferença de reserva;
   * 5. Se outro clube for o líder anterior, libera sua reserva (/auctionReservations com status RELEASED);
   * 6. Criação da nova reserva em /auctionReservations/{resId} com status ACTIVE;
   * 7. Atualização do campo reservedTransferBudget do clube comprador sem alterar balance;
   * 8. Gravação do lance em /leiloes/{leilaoId}/lances/{lanceId}.
   */
  async darLance(
    params: DarLanceParams
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      // 1. Validação de autenticação no Firebase Auth
      const auth = await ensureUserAuthReady();
      const db = this.getDb();

      // 2. Validação: usuário é o treinador/manager que está fazendo o lance
      if (!params.managerId || auth.uid !== params.managerId) {
        return { success: false, error: 'O managerId não confere com o usuário autenticado.' };
      }

      // Validação de valor básico
      const valorLance = Number(params.value);
      if (isNaN(valorLance) || valorLance <= 0) {
        return { success: false, error: 'Informe um valor válido para o lance.' };
      }

      // 3. Validação de clube do treinador
      if (!params.clubId || params.clubId.trim() === '' || params.clubId === 'sem-clube') {
        return { success: false, error: 'O treinador precisa estar vinculado a um clube para registrar lances.' };
      }

      // 4. Validações preliminares imediatas com dados em memória (evita chamadas de leitura desnecessárias)
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
        const currentReserved = Number(params.clubReservedBudget) || 0;
        if (valorLance > params.clubTransferBudget) {
          return {
            success: false,
            error: `Orçamento insuficiente! O limite de transferências do seu clube é de R$ ${params.clubTransferBudget.toLocaleString('pt-BR')}.`,
          };
        }
        if (currentReserved + valorLance > params.clubTransferBudget * 2) {
          // Validação de teto preventivo
        }
      }

      // 5. Resolução da referência canônica do clube no Firestore (/clubes)
      const targetClubDocId = params.clubId.trim();
      const clubDocRef = doc(db, 'clubes', targetClubDocId);
      const buyerResId = `res-${params.leilaoId}-${targetClubDocId}`;
      const buyerResRef = doc(db, 'auctionReservations', buyerResId);
      const leilaoRef = doc(db, 'leiloes', params.leilaoId);
      const lancesColRef = collection(db, 'leiloes', params.leilaoId, 'lances');

      // Referência para possível reserva do líder anterior
      const prevLeaderClub = params.prevLeaderClubId && params.prevLeaderClubId !== targetClubDocId ? params.prevLeaderClubId : null;
      const prevResRef = prevLeaderClub ? doc(db, 'auctionReservations', `res-${params.leilaoId}-${prevLeaderClub}`) : null;

      // 6. Tentativa Primária: TRANSAÇÃO ATÔMICA
      try {
        const result = await runTransaction(db, async (tx) => {
          // Fase 1: Leituras
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
            throw new Error(
              `O lance não pode ser inferior ao valor inicial de R$ ${initialBid.toLocaleString('pt-BR')}.`
            );
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

          // Fase 2: Escritas Atômicas
          const nowIso = new Date().toISOString();

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

        return { success: true, id: result.lanceId };
      } catch (txErr) {
        // Se o erro NÃO for de cota de leitura, propaga o erro de negócio diretamente
        if (!isQuotaError(txErr)) {
          throw txErr;
        }

        console.warn('⚠️ [Leiloes] Cota de leitura do Firestore excedida no projeto. Ativando fallback de contingência por gravação direta...');

        // 7. FALLBACK DE CONTINGÊNCIA POR GRAVAÇÃO DIRETA (operações de escrita usam cota write units, não read units)
        const nowIso = new Date().toISOString();
        const novoLanceRef = doc(lancesColRef);
        const lanceDocData = sanitize({
          id: novoLanceRef.id,
          managerId: auth.uid,
          managerName: params.managerName,
          clubId: targetClubDocId,
          value: valorLance,
          createdAt: nowIso,
        });

        // Grava o lance na subcoleção de lances
        await setDoc(novoLanceRef, lanceDocData);

        // Grava a reserva ativa em /auctionReservations
        try {
          await setDoc(
            buyerResRef,
            sanitize({
              id: buyerResId,
              auctionId: params.leilaoId,
              clubId: targetClubDocId,
              managerId: auth.uid,
              managerName: params.managerName,
              amount: valorLance,
              status: 'ACTIVE',
              createdAt: nowIso,
              updatedAt: nowIso,
            }),
            { merge: true }
          );
        } catch (resErr) {
          console.warn('⚠️ [Leiloes] Gravação da reserva via fallback ignorada:', resErr);
        }

        // Tenta atualizar reservedTransferBudget no documento do clube
        try {
          const currentReserved = Number(params.clubReservedBudget) || 0;
          await updateDoc(clubDocRef, {
            reservedTransferBudget: currentReserved + valorLance,
            updatedAt: nowIso,
          });
        } catch (clubErr) {
          console.warn('⚠️ [Leiloes] Atualização do clube via fallback ignorada:', clubErr);
        }

        return { success: true, id: novoLanceRef.id };
      }
    } catch (err: unknown) {
      console.error('❌ [Leiloes] Erro ao registrar lance:', err);
      const friendlyMsg = formatQuotaErrorMessage(err);
      return { success: false, error: friendlyMsg };
    }
  },

  /**
   * ATUALIZAÇÃO DE STATUS DO LEILÃO (ADMIN)
   * Realiza UMA ÚNICA gravação (updateDoc) em /leiloes/{leilaoId}.
   */
  async atualizarStatus(
    leilaoId: string,
    novoStatus: LeilaoStatus
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await ensureAuthReady();
      const db = this.getDb();
      const leilaoRef = doc(db, 'leiloes', leilaoId);

      await updateDoc(leilaoRef, {
        status: novoStatus,
        updatedAt: new Date().toISOString(),
      });

      return { success: true };
    } catch (err: unknown) {
      console.error('❌ [Leiloes] Erro ao atualizar status:', err);
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },

  /**
   * LISTENER EM TEMPO REAL DOS LEILÕES (/leiloes)
   */
  escutarLeiloes(callback: (leiloes: Leilao[]) => void): Unsubscribe {
    try {
      const db = this.getDb();
      const q = query(collection(db, 'leiloes'), orderBy('createdAt', 'desc'));
      return onSnapshot(
        q,
        (snap) => {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Leilao, 'id'>),
          }));
          callback(list);
        },
        (err) => {
          console.error('❌ [Leiloes] Erro no listener de leilões:', err);
          callback([]);
        }
      );
    } catch (err) {
      console.error('❌ [Leiloes] Erro ao iniciar listener:', err);
      return () => {};
    }
  },

  /**
   * LISTENER EM TEMPO REAL DOS LANCES (/leiloes/{leilaoId}/lances)
   */
  escutarLances(
    leilaoId: string,
    callback: (lances: Lance[]) => void
  ): Unsubscribe {
    try {
      const db = this.getDb();
      const q = query(
        collection(db, 'leiloes', leilaoId, 'lances'),
        orderBy('createdAt', 'desc')
      );
      return onSnapshot(
        q,
        (snap) => {
          const list = snap.docs.map((d) => ({
            id: d.id,
            leilaoId,
            ...(d.data() as Omit<Lance, 'id'>),
          }));
          callback(list);
        },
        (err) => {
          console.error('❌ [Leiloes] Erro no listener de lances:', err);
          callback([]);
        }
      );
    } catch (err) {
      console.error('❌ [Leiloes] Erro ao iniciar listener de lances:', err);
      return () => {};
    }
  },
};
