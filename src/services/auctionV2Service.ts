import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  runTransaction,
} from 'firebase/firestore';
import { getFirestoreDb, firestoreDb, isFirebaseConfigured, firebaseAuth } from '../config/firebase';
import {
  AuctionV2,
  AuctionV2Bid,
  AuctionV2Reservation,
  AuctionV2AuditLog,
  AuctionV2BudgetSummary,
  AuctionV2Status,
} from '../types/auctionV2';
import { Club, Player } from '../types';
import { clubesService } from './clubesService';
import { jogadoresService } from './jogadoresService';

/**
 * Remove valores undefined de objetos para compatibilidade estrita com Firestore.
 */
function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
      if (val !== undefined) {
        clean[key] = sanitizeForFirestore(val);
      }
    }
    return clean as unknown as T;
  }
  return data;
}

export interface CreateAuctionV2Params {
  playerId: string;
  initialPrice: number;
  minIncrement: number;
  startTime: string; // ISO
  endTime: string; // ISO
  adminId: string;
}

export interface PlaceBidV2Params {
  auctionId: string;
  managerId: string; // DEVE ser request.auth.uid
  managerName: string;
  bidAmount: number;
}

export const auctionV2Service = {
  /**
   * Obtém a instância do Firestore.
   */
  getDb() {
    const db = getFirestoreDb() || firestoreDb;
    if (!db || !isFirebaseConfigured()) {
      throw new Error('Firestore não está configurado.');
    }
    return db;
  },

  /**
   * Localiza no Firestore o clube oficial cujo documento possui managerId == managerUid.
   * Não utiliza IDs fixos ou mocks.
   */
  async findManagerClub(managerUid: string): Promise<Club | null> {
    if (!managerUid?.trim()) return null;
    const cleanUid = managerUid.trim();
    const db = this.getDb();

    // 1. Busca na coleção oficial 'clubes' com query where('managerId', '==', cleanUid)
    try {
      const q = query(collection(db, 'clubes'), where('managerId', '==', cleanUid));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        return { id: d.id, ...d.data() } as Club;
      }
    } catch (err) {
      console.warn('Falha na query por managerId em /clubes:', err);
    }

    // 2. Tenta documento com ID direto club-{cleanUid} ou {cleanUid}
    try {
      const docRefPrefix = doc(db, 'clubes', `club-${cleanUid}`);
      const snapPrefix = await getDoc(docRefPrefix);
      if (snapPrefix.exists()) {
        return { id: snapPrefix.id, ...snapPrefix.data() } as Club;
      }

      const docRefPlain = doc(db, 'clubes', cleanUid);
      const snapPlain = await getDoc(docRefPlain);
      if (snapPlain.exists()) {
        return { id: snapPlain.id, ...snapPlain.data() } as Club;
      }
    } catch (err) {
      console.warn('Falha ao buscar clube determinístico:', err);
    }

    // 3. Fallback: tenta buscar na coleção 'clubs' se existir
    try {
      const qClubs = query(collection(db, 'clubs'), where('managerId', '==', cleanUid));
      const snapClubs = await getDocs(qClubs);
      if (!snapClubs.empty) {
        const d = snapClubs.docs[0];
        return { id: d.id, ...d.data() } as Club;
      }
    } catch {
      // ignore
    }

    // 4. Último recurso seguro: delega para clubesService.getByManagerId
    return await clubesService.getByManagerId(cleanUid);
  },

  /**
   * Calcula o resumo orçamentário REAL do clube em relação ao Leilão V2:
   * - Orçamento total: club.transferBudget ou club.balance
   * - Valor reservado: soma de todas as reservas com status === 'ACTIVE' em /auctionV2Reservations
   * - Saldo disponível: total - reservado
   */
  async getClubAuctionBudget(clubId: string): Promise<AuctionV2BudgetSummary> {
    if (!clubId?.trim()) {
      return { totalBudget: 0, reservedBudget: 0, availableBudget: 0 };
    }
    const cleanClubId = clubId.trim();
    const db = this.getDb();

    // 1. Obtém dados reais do clube
    const club = await clubesService.getById(cleanClubId);
    const totalBudget = Number(club?.transferBudget) || Number(club?.balance) || 0;

    // 2. Consulta reservas ativas em /auctionV2Reservations
    let reservedBudget = 0;
    try {
      const q = query(
        collection(db, 'auctionV2Reservations'),
        where('clubId', '==', cleanClubId),
        where('status', '==', 'ACTIVE')
      );
      const snap = await getDocs(q);
      snap.forEach((d) => {
        const data = d.data();
        reservedBudget += Number(data.amount) || 0;
      });
    } catch (err) {
      console.warn('Erro ao consultar reservas ativas V2 do clube:', err);
    }

    const availableBudget = Math.max(0, totalBudget - reservedBudget);

    return {
      totalBudget,
      reservedBudget,
      availableBudget,
    };
  },

  /**
   * Lista todos os leilões V2 do Firestore.
   */
  async getAuctions(): Promise<AuctionV2[]> {
    const db = this.getDb();
    try {
      const colRef = collection(db, 'auctionV2');
      const snap = await getDocs(colRef);
      if (snap.empty) return [];

      const list: AuctionV2[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as AuctionV2);
      });

      // Ordena decrescente por data de criação
      return list.sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    } catch (err) {
      console.error('Erro ao buscar leilões V2:', err);
      return [];
    }
  },

  /**
   * Busca um leilão V2 específico por ID.
   */
  async getAuctionById(id: string): Promise<AuctionV2 | null> {
    if (!id?.trim()) return null;
    const db = this.getDb();
    try {
      const docRef = doc(db, 'auctionV2', id.trim());
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as AuctionV2;
      }
      return null;
    } catch (err) {
      console.error('Erro ao buscar leilão V2 por ID:', err);
      return null;
    }
  },

  /**
   * Lista lances de um leilão em /auctionV2Bids.
   */
  async getBidsByAuction(auctionId: string): Promise<AuctionV2Bid[]> {
    if (!auctionId?.trim()) return [];
    const db = this.getDb();
    try {
      const q = query(
        collection(db, 'auctionV2Bids'),
        where('auctionId', '==', auctionId.trim())
      );
      const snap = await getDocs(q);
      const bids: AuctionV2Bid[] = [];
      snap.forEach((d) => {
        bids.push({ id: d.id, ...d.data() } as AuctionV2Bid);
      });
      // Ordena por lance decrescente / tempo decrescente
      return bids.sort((a, b) => b.amount - a.amount);
    } catch (err) {
      console.error('Erro ao buscar lances V2:', err);
      return [];
    }
  },

  /**
   * Lista auditoria de um leilão em /auctionV2AuditLogs.
   */
  async getAuditLogs(auctionId: string): Promise<AuctionV2AuditLog[]> {
    if (!auctionId?.trim()) return [];
    const db = this.getDb();
    try {
      const q = query(
        collection(db, 'auctionV2AuditLogs'),
        where('auctionId', '==', auctionId.trim())
      );
      const snap = await getDocs(q);
      const logs: AuctionV2AuditLog[] = [];
      snap.forEach((d) => {
        logs.push({ id: d.id, ...d.data() } as AuctionV2AuditLog);
      });
      return logs.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (err) {
      console.error('Erro ao buscar auditoria V2:', err);
      return [];
    }
  },

  /**
   * 1. CRIAÇÃO DO LEILÃO (Apenas Admin)
   * Ao publicar:
   * status = "ABERTO" (ou "AGENDADO" se data de abertura for futura)
   * currentBid = initialPrice
   * currentLeaderClubId = null
   * currentLeaderManagerId = null
   * totalBids = 0
   */
  async createAuction(
    params: CreateAuctionV2Params
  ): Promise<{ success: boolean; auction?: AuctionV2; error?: string }> {
    const db = this.getDb();
    const nowIso = new Date().toISOString();

    try {
      // 1. Busca dados do jogador
      const player = await jogadoresService.getById(params.playerId);
      if (!player) {
        return { success: false, error: 'Jogador selecionado não foi encontrado.' };
      }

      const startTime = new Date(params.startTime).toISOString();
      const endTime = new Date(params.endTime).toISOString();

      if (new Date(endTime) <= new Date(startTime)) {
        return { success: false, error: 'A data de encerramento deve ser posterior à data de abertura.' };
      }

      // Determina status inicial
      const isFuture = new Date(startTime).getTime() > Date.now();
      const status: AuctionV2Status = isFuture ? 'AGENDADO' : 'ABERTO';

      const auctionId = `auc-v2-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const auctionRef = doc(db, 'auctionV2', auctionId);

      const newAuction: AuctionV2 = {
        id: auctionId,
        playerId: player.id,
        playerName: player.name,
        playerAge: player.age,
        playerClub: player.clubName || player.club || 'Livre / FM2008', // Preserva clube de origem
        playerPosition: player.position,
        playerRating: player.overall || (player as unknown as { rating?: number; currentAbility?: number }).rating || 70,
        playerPhoto: player.photo || player.avatar,
        initialPrice: params.initialPrice,
        minIncrement: params.minIncrement,
        startTime,
        endTime,
        status,
        currentBid: params.initialPrice,
        currentLeaderClubId: null,
        currentLeaderClubName: null,
        currentLeaderManagerId: null,
        currentLeaderManagerName: null,
        totalBids: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      // Garante autenticação e ID token ativos no Firebase Auth antes da escrita
      let currentUser = firebaseAuth?.currentUser || null;
      if (!currentUser && firebaseAuth) {
        if (typeof firebaseAuth.authStateReady === 'function') {
          await firebaseAuth.authStateReady();
        }
        currentUser = firebaseAuth.currentUser;
        if (!currentUser) {
          await new Promise<void>((resolve) => {
            const unsub = firebaseAuth!.onAuthStateChanged((u) => {
              currentUser = u;
              unsub();
              resolve();
            });
            setTimeout(() => {
              unsub();
              resolve();
            }, 3000);
          });
        }
      }

      if (!currentUser) {
        return {
          success: false,
          error: 'Usuário não autenticado no Firebase Auth. Efetue login novamente para publicar o leilão.',
        };
      }

      let tokenObtido = false;
      try {
        const token = await currentUser.getIdToken(true);
        tokenObtido = Boolean(token);
      } catch (tokenErr) {
        console.warn('Falha ao forçar refresh do ID Token:', tokenErr);
      }

      console.log('currentUser.uid:', currentUser.uid);
      console.log('currentUser.email:', currentUser.email);
      console.log('token obtido =', tokenObtido);

      await setDoc(auctionRef, sanitizeForFirestore(newAuction));

      // Marca o jogador como em leilão ativo
      try {
        const playerRef = doc(db, 'jogadores', player.id);
        await updateDoc(playerRef, {
          isAuctionActive: true,
          activeAuctionId: auctionId,
          auctionStatus: 'IN_AUCTION',
        });
      } catch (err) {
        console.warn('Aviso: falha ao marcar status de leilão no documento do jogador:', err);
      }

      // Registra log de auditoria
      try {
        const auditId = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        await setDoc(
          doc(db, 'auctionV2AuditLogs', auditId),
          sanitizeForFirestore({
            id: auditId,
            auctionId,
            action: 'CREATE',
            managerId: params.adminId,
            amount: params.initialPrice,
            details: `Leilão V2 criado para o jogador ${player.name} com lance inicial de R$ ${params.initialPrice.toLocaleString('pt-BR')}`,
            timestamp: nowIso,
            createdAt: nowIso,
          })
        );
      } catch (err) {
        console.warn('Aviso: falha ao registrar log de auditoria:', err);
      }

      return { success: true, auction: newAuction };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code) : 'unknown';
      return { success: false, error: `${code} | ${msg}` };
    }
  },

  /**
   * 2, 3 e 4. DAR LANCE NO LEILÃO V2 (Primeiro Lance ou Lances Seguintes)
   * Executado dentro de uma ÚNICA TRANSAÇÃO ATÔMICA no Firestore REAL.
   *
   * Regras:
   * - managerId DEVE ser o request.auth.uid
   * - Localiza o clube cujo /clubes possui managerId == request.auth.uid (esse será o clubId oficial)
   * - Se for 1º Lance (totalBids == 0):
   *     valor >= initialPrice
   *     NÃO tenta liberar reserva anterior
   * - Se forem lances seguintes (totalBids > 0):
   *     valor >= currentBid + minIncrement
   *     Se outro clube era líder:
   *       libera a reserva anterior (status = "RELEASED") SE ela existir no Firestore
   * - Valida orçamento disponível REAL
   * - Cria/atualiza reserva do novo líder (status = "ACTIVE")
   * - Atualiza líder do leilão
   * - Cria registro em /auctionV2Bids
   * - Cria auditoria em /auctionV2AuditLogs
   */
  async placeBid(
    params: PlaceBidV2Params
  ): Promise<{ success: boolean; error?: string; bid?: AuctionV2Bid; reservedAmount?: number }> {
    const db = this.getDb();
    const nowIso = new Date().toISOString();
    const { auctionId, managerId, managerName, bidAmount } = params;

    if (!managerId?.trim()) {
      return { success: false, error: 'Usuário não autenticado.' };
    }

    // 1. Localiza o clube oficial do Manager no Firestore
    const club = await this.findManagerClub(managerId);
    if (!club) {
      return {
        success: false,
        error: 'Você não possui um clube registrado no FM Universe vinculado ao seu perfil.',
      };
    }

    const clubId = club.id;
    const clubName = club.name;

    // 2. Valida orçamento disponível pré-transação
    const budgetSummary = await this.getClubAuctionBudget(clubId);

    // Verifica se este clube já possui reserva ativa neste mesmo leilão
    const currentClubReservationDocRef = doc(db, 'auctionV2Reservations', `${auctionId}_${clubId}`);
    let existingReservationAmount = 0;
    try {
      const currentResSnap = await getDoc(currentClubReservationDocRef);
      if (currentResSnap.exists() && currentResSnap.data().status === 'ACTIVE') {
        existingReservationAmount = Number(currentResSnap.data().amount) || 0;
      }
    } catch {
      // ignore
    }

    // O valor adicional exigido para dar o lance é a diferença (se já tinha reserva neste leilão)
    const additionalFundsNeeded = Math.max(0, bidAmount - existingReservationAmount);
    if (additionalFundsNeeded > budgetSummary.availableBudget) {
      return {
        success: false,
        error: `Saldo insuficiente. Orçamento disponível: R$ ${budgetSummary.availableBudget.toLocaleString('pt-BR')}, valor necessário: R$ ${additionalFundsNeeded.toLocaleString('pt-BR')}.`,
      };
    }

    // 3. Execução da TRANSAÇÃO ATÔMICA
    try {
      const bidResult = await runTransaction(db, async (tx) => {
        // ==========================================
        // FASE 1: TODAS AS LEITURAS (MANDATÓRIO NO FIRESTORE)
        // ==========================================
        const auctionRef = doc(db, 'auctionV2', auctionId);
        const auctionSnap = await tx.get(auctionRef);

        if (!auctionSnap.exists()) {
          throw new Error('Leilão V2 não encontrado.');
        }

        const auctionData = auctionSnap.data() as AuctionV2;

        // Valida status
        if (auctionData.status !== 'ABERTO') {
          throw new Error(`O leilão não está aberto para lances. Status atual: ${auctionData.status}`);
        }

        // Valida horário de término
        const nowMs = Date.now();
        if (auctionData.endTime && new Date(auctionData.endTime).getTime() < nowMs) {
          throw new Error('O tempo deste leilão já expirou.');
        }

        // Determina se é o primeiro lance
        const totalBids = Number(auctionData.totalBids) || 0;
        const prevLeaderClubId = auctionData.currentLeaderClubId || null;
        const currentBid = Number(auctionData.currentBid) || Number(auctionData.initialPrice) || 0;
        const minIncrement = Number(auctionData.minIncrement) || 0;

        const isFirstBid = totalBids === 0 || !prevLeaderClubId;

        // Validação estrita do valor do lance
        if (isFirstBid) {
          if (bidAmount < auctionData.initialPrice) {
            throw new Error(
              `O primeiro lance deve ser de no mínimo o valor inicial: R$ ${auctionData.initialPrice.toLocaleString('pt-BR')}`
            );
          }
        } else {
          const minRequired = currentBid + minIncrement;
          if (bidAmount < minRequired) {
            throw new Error(
              `O lance deve ser de no mínimo R$ ${minRequired.toLocaleString('pt-BR')} (lance atual R$ ${currentBid.toLocaleString('pt-BR')} + incremento R$ ${minIncrement.toLocaleString('pt-BR')})`
            );
          }
        }

        // Leitura da reserva anterior (se outro clube era líder)
        let prevResSnap: { exists: () => boolean; data: () => Record<string, unknown> } | null = null;
        let prevResRef: ReturnType<typeof doc> | null = null;
        if (!isFirstBid && prevLeaderClubId && prevLeaderClubId !== clubId) {
          prevResRef = doc(db, 'auctionV2Reservations', `${auctionId}_${prevLeaderClubId}`);
          prevResSnap = await tx.get(prevResRef);
        }

        // Leitura da reserva do clube atual
        const currentClubResRef = doc(db, 'auctionV2Reservations', `${auctionId}_${clubId}`);
        const currentClubResSnap = await tx.get(currentClubResRef);

        // ==========================================
        // FASE 2: TODAS AS ESCRITAS (APÓS TODAS AS LEITURAS)
        // ==========================================

        // 1. Se outro manager era líder, libera a reserva anterior SE ela existir
        if (prevResRef && prevResSnap && prevResSnap.exists()) {
          tx.update(prevResRef, {
            status: 'RELEASED',
            updatedAt: nowIso,
          });
        }

        // 2. Cria/atualiza a reserva do novo líder (status = ACTIVE)
        const reservationData: AuctionV2Reservation = {
          auctionId,
          managerId,
          clubId,
          amount: bidAmount,
          status: 'ACTIVE',
          createdAt: currentClubResSnap.exists()
            ? (currentClubResSnap.data() as AuctionV2Reservation).createdAt || nowIso
            : nowIso,
          updatedAt: nowIso,
        };
        tx.set(currentClubResRef, sanitizeForFirestore(reservationData), { merge: true });

        // 3. Atualiza o leilão com o novo líder e valor
        const auctionUpdatePayload = {
          status: 'ABERTO',
          currentBid: bidAmount,
          currentLeaderClubId: clubId,
          currentLeaderClubName: clubName,
          currentLeaderManagerId: managerId,
          currentLeaderManagerName: managerName,
          totalBids: totalBids + 1,
          updatedAt: nowIso,
        };
        tx.update(auctionRef, sanitizeForFirestore(auctionUpdatePayload));

        // 4. Cria o registro de lance em /auctionV2Bids
        const bidId = `bid-v2-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const bidRef = doc(db, 'auctionV2Bids', bidId);
        const bidData: AuctionV2Bid = {
          id: bidId,
          auctionId,
          managerId,
          managerName,
          clubId,
          clubName,
          amount: bidAmount,
          bidTime: nowIso,
          createdAt: nowIso,
        };
        tx.set(bidRef, sanitizeForFirestore(bidData));

        // 5. Registra auditoria em /auctionV2AuditLogs
        const auditId = `audit-v2-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const auditRef = doc(db, 'auctionV2AuditLogs', auditId);
        const auditData: AuctionV2AuditLog = {
          id: auditId,
          auctionId,
          action: 'BID',
          managerId,
          clubId,
          amount: bidAmount,
          previousLeaderClubId: prevLeaderClubId,
          newLeaderClubId: clubId,
          details: `Lance V2 de R$ ${bidAmount.toLocaleString('pt-BR')} realizado por ${managerName} (${clubName})`,
          timestamp: nowIso,
          createdAt: nowIso,
        };
        tx.set(auditRef, sanitizeForFirestore(auditData));

        return bidData;
      });

      return {
        success: true,
        bid: bidResult,
        reservedAmount: bidAmount,
      };
    } catch (err: unknown) {
      console.error('Erro na transação de lance V2:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao processar o lance.';
      return { success: false, error: msg };
    }
  },

  /**
   * 11. ENCERRAMENTO DO LEILÃO (Admin)
   * Ao encerrar:
   * - se não houver lances além do valor inicial (ou seja, totalBids === 0 ou sem líder), sem vencedor;
   * - se houver líder:
   *     definir winnerManagerId e winnerClubId;
   *     alterar status para ENCERRADO;
   *     transformar a reserva vencedora em CONSUMED;
   *     transferir jogador para o clube vencedor (currentClubId = winnerClubId, preservando clube de origem FM2008);
   *     registrar operação financeira (debita do saldo e orçamento do clube);
   *     impedir novos lances.
   */
  async closeAuction(
    auctionId: string,
    adminId: string
  ): Promise<{ success: boolean; auction?: AuctionV2; error?: string }> {
    const db = this.getDb();
    const nowIso = new Date().toISOString();

    try {
      const closedAuction = await runTransaction(db, async (tx) => {
        // LEITURAS
        const auctionRef = doc(db, 'auctionV2', auctionId);
        const auctionSnap = await tx.get(auctionRef);
        if (!auctionSnap.exists()) {
          throw new Error('Leilão V2 não encontrado.');
        }
        const auctionData = auctionSnap.data() as AuctionV2;

        if (auctionData.status === 'ENCERRADO') {
          return auctionData;
        }

        const totalBids = Number(auctionData.totalBids) || 0;
        const hasWinner = Boolean(auctionData.currentLeaderClubId && totalBids > 0);

        const playerRef = doc(db, 'jogadores', auctionData.playerId);
        const playerSnap = await tx.get(playerRef);

        let winnerClubRef: ReturnType<typeof doc> | null = null;
        let winnerClubSnap: { exists: () => boolean; data: () => Record<string, unknown> } | null = null;
        let winnerResRef: ReturnType<typeof doc> | null = null;
        let winnerResSnap: { exists: () => boolean; data: () => Record<string, unknown> } | null = null;

        if (hasWinner) {
          winnerClubRef = doc(db, 'clubes', auctionData.currentLeaderClubId!);
          winnerClubSnap = await tx.get(winnerClubRef);

          winnerResRef = doc(
            db,
            'auctionV2Reservations',
            `${auctionId}_${auctionData.currentLeaderClubId}`
          );
          winnerResSnap = await tx.get(winnerResRef);
        }

        // ESCRITAS
        if (hasWinner && winnerClubRef && winnerClubSnap && winnerClubSnap.exists()) {
          const winnerClub = winnerClubSnap.data() as unknown as Club;
          const winningFee = Number(auctionData.currentBid) || 0;

          // Debita do orçamento e saldo do clube
          const newTransferBudget = Math.max(0, (Number(winnerClub.transferBudget) || 0) - winningFee);
          const newBalance = Math.max(0, (Number(winnerClub.balance) || 0) - winningFee);

          tx.update(winnerClubRef, {
            transferBudget: newTransferBudget,
            balance: newBalance,
          });

          // Transforma a reserva em CONSUMED
          if (winnerResRef && winnerResSnap && winnerResSnap.exists()) {
            tx.update(winnerResRef, {
              status: 'CONSUMED',
              updatedAt: nowIso,
            });
          }

          // Transfere o jogador para o novo clube (preserva o clube de origem original FM2008)
          if (playerSnap.exists()) {
            tx.update(playerRef, {
              currentClubId: auctionData.currentLeaderClubId,
              currentClubName: auctionData.currentLeaderClubName,
              auctionStatus: 'SOLD',
              isAuctionActive: false,
              activeAuctionId: null,
            });
          }

          // Atualiza status do leilão
          const updatedAuction: Partial<AuctionV2> = {
            status: 'ENCERRADO',
            winnerManagerId: auctionData.currentLeaderManagerId,
            winnerClubId: auctionData.currentLeaderClubId,
            winnerClubName: auctionData.currentLeaderClubName,
            winnerAmount: winningFee,
            closedAt: nowIso,
            updatedAt: nowIso,
          };
          tx.update(auctionRef, sanitizeForFirestore(updatedAuction));

          // Log de auditoria
          const auditId = `audit-v2-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          tx.set(
            doc(db, 'auctionV2AuditLogs', auditId),
            sanitizeForFirestore({
              id: auditId,
              auctionId,
              action: 'CLOSE',
              managerId: adminId,
              clubId: auctionData.currentLeaderClubId,
              amount: winningFee,
              details: `Leilão encerrado com vencedor: ${auctionData.currentLeaderClubName} por R$ ${winningFee.toLocaleString('pt-BR')}`,
              timestamp: nowIso,
              createdAt: nowIso,
            })
          );

          return { ...auctionData, ...updatedAuction } as AuctionV2;
        } else {
          // Encerrado sem vencedor
          if (playerSnap.exists()) {
            tx.update(playerRef, {
              isAuctionActive: false,
              activeAuctionId: null,
              auctionStatus: 'NOT_IN_AUCTION',
            });
          }

          const updatedAuction: Partial<AuctionV2> = {
            status: 'ENCERRADO',
            winnerManagerId: null,
            winnerClubId: null,
            winnerAmount: 0,
            closedAt: nowIso,
            updatedAt: nowIso,
          };
          tx.update(auctionRef, sanitizeForFirestore(updatedAuction));

          const auditId = `audit-v2-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          tx.set(
            doc(db, 'auctionV2AuditLogs', auditId),
            sanitizeForFirestore({
              id: auditId,
              auctionId,
              action: 'CLOSE',
              managerId: adminId,
              details: 'Leilão encerrado sem lances / sem vencedor.',
              timestamp: nowIso,
              createdAt: nowIso,
            })
          );

          return { ...auctionData, ...updatedAuction } as AuctionV2;
        }
      });

      return { success: true, auction: closedAuction };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao encerrar leilão V2.';
      return { success: false, error: msg };
    }
  },

  /**
   * Cancelamento de Leilão V2 (Admin).
   * Libera reserva ativa se houver e restaura o jogador.
   */
  async cancelAuction(
    auctionId: string,
    adminId: string
  ): Promise<{ success: boolean; error?: string }> {
    const db = this.getDb();
    const nowIso = new Date().toISOString();

    try {
      await runTransaction(db, async (tx) => {
        const auctionRef = doc(db, 'auctionV2', auctionId);
        const auctionSnap = await tx.get(auctionRef);
        if (!auctionSnap.exists()) {
          throw new Error('Leilão V2 não encontrado.');
        }
        const auctionData = auctionSnap.data() as AuctionV2;

        // Se havia reserva ativa de um líder, lê antes das escritas
        let leaderResRef: ReturnType<typeof doc> | null = null;
        let leaderResSnap: { exists: () => boolean } | null = null;
        if (auctionData.currentLeaderClubId) {
          leaderResRef = doc(
            db,
            'auctionV2Reservations',
            `${auctionId}_${auctionData.currentLeaderClubId}`
          );
          leaderResSnap = await tx.get(leaderResRef);
        }

        const playerRef = doc(db, 'jogadores', auctionData.playerId);
        const playerSnap = await tx.get(playerRef);

        // ESCRITAS
        if (leaderResRef && leaderResSnap && leaderResSnap.exists()) {
          tx.update(leaderResRef, {
            status: 'RELEASED',
            updatedAt: nowIso,
          });
        }

        if (playerSnap.exists()) {
          tx.update(playerRef, {
            isAuctionActive: false,
            activeAuctionId: null,
            auctionStatus: 'NOT_IN_AUCTION',
          });
        }

        tx.update(auctionRef, {
          status: 'CANCELADO',
          updatedAt: nowIso,
        });

        const auditId = `audit-v2-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        tx.set(
          doc(db, 'auctionV2AuditLogs', auditId),
          sanitizeForFirestore({
            id: auditId,
            auctionId,
            action: 'CANCEL',
            managerId: adminId,
            details: 'Leilão V2 cancelado pela administração. Reservas liberadas.',
            timestamp: nowIso,
            createdAt: nowIso,
          })
        );
      });

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cancelar leilão V2.';
      return { success: false, error: msg };
    }
  },

  /**
   * Atualização de status administrativo (ex: ABERTO, AGENDADO).
   */
  async updateStatus(
    auctionId: string,
    newStatus: AuctionV2Status,
    adminId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (newStatus === 'ENCERRADO') {
      return this.closeAuction(auctionId, adminId);
    }
    if (newStatus === 'CANCELADO') {
      return this.cancelAuction(auctionId, adminId);
    }

    const db = this.getDb();
    const nowIso = new Date().toISOString();
    try {
      const auctionRef = doc(db, 'auctionV2', auctionId);
      await updateDoc(auctionRef, {
        status: newStatus,
        updatedAt: nowIso,
      });

      const auditId = `audit-v2-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await setDoc(
        doc(db, 'auctionV2AuditLogs', auditId),
        sanitizeForFirestore({
          id: auditId,
          auctionId,
          action: 'STATUS_CHANGE',
          managerId: adminId,
          details: `Status do leilão V2 alterado para ${newStatus}`,
          timestamp: nowIso,
          createdAt: nowIso,
        })
      );

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar status.';
      return { success: false, error: msg };
    }
  },
};
