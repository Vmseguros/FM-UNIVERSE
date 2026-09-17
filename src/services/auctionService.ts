import {
  Auction,
  AuctionBid,
  AuctionReservation,
  AuctionAuditLog,
  AuctionStatus,
  AuctionBudgetSummary,
  Player,
  Club,
} from '../types';
import { isFirebaseConfigured, firestoreDb, getFirestoreDb } from '../config/firebase';
import { dataStore } from './dataStore';
import { jogadoresService, sanitizeForFirestore } from './jogadoresService';
import { clubesService } from './clubesService';
import { transferenciasService } from './transferenciasService';
import { notificacoesService } from './notificacoesService';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';

export interface CreateAuctionParams {
  playerId: string;
  initialPrice: number;
  minIncrement: number;
  scheduledOpenDate: string; // ISO string
  scheduledCloseDate: string; // ISO string
  status?: AuctionStatus;
  adminId: string;
}

export interface PlaceBidParams {
  auctionId: string;
  managerId: string;
  managerName: string;
  clubId: string;
  clubName: string;
  amount: number;
}

export const auctionService = {
  _testMode: false,

  /**
   * Ativa ou desativa modo de teste isolado em memória (garantia de ZERO gravações no Firestore).
   */
  setTestMode(enabled: boolean): void {
    this._testMode = enabled;
  },

  isTestMode(): boolean {
    return this._testMode || process.env.NODE_ENV === 'test';
  },

  /**
   * Cria um novo leilão para um atleta existente.
   * Valida unicidade de leilão ativo, integridade de datas e valores mínimos.
   */
  async createAuction(
    params: CreateAuctionParams
  ): Promise<{ success: boolean; auction?: Auction; error?: string }> {
    const {
      playerId,
      initialPrice,
      minIncrement,
      scheduledOpenDate,
      scheduledCloseDate,
      status = 'RASCUNHO',
      adminId,
    } = params;

    // 1. Validação de parâmetros financeiros
    if (isNaN(initialPrice) || initialPrice < 0) {
      return { success: false, error: 'O lance inicial deve ser maior ou igual a zero.' };
    }
    if (isNaN(minIncrement) || minIncrement <= 0) {
      return { success: false, error: 'O incremento mínimo deve ser maior que zero.' };
    }

    // 2. Validação de datas
    const openTime = new Date(scheduledOpenDate).getTime();
    const closeTime = new Date(scheduledCloseDate).getTime();
    if (isNaN(openTime) || isNaN(closeTime)) {
      return { success: false, error: 'Datas de abertura e encerramento inválidas.' };
    }
    if (closeTime <= openTime) {
      return { success: false, error: 'A data de encerramento deve ser posterior à data de abertura.' };
    }

    // 3. Validação do atleta existente
    const player = this.isTestMode()
      ? dataStore.getPlayers().find((p) => p.id === playerId)
      : await jogadoresService.getById(playerId);
    if (!player) {
      return { success: false, error: 'Jogador selecionado não encontrado no sistema.' };
    }

    // 4. Verificação de jogador indisponível ou já em leilão ativo
    // O jogador começa disponível para leilão quando não possui currentClubId no FM Universe
    if (player.currentClubId) {
      return { success: false, error: 'Este jogador já possui clube proprietário no FM Universe e não está disponível para leilão.' };
    }

    if (player.auctionStatus === 'SOLD') {
      return { success: false, error: 'Este jogador já foi arrematado e não está mais disponível para leilão.' };
    }

    // Verifica se já existe um leilão ABERTO ou AGENDADO para este jogador
    const existingAuctions = await this.getAuctions();
    const hasActiveAuction = existingAuctions.some(
      (a) =>
        a.playerId === playerId &&
        (a.status === 'ABERTO' || a.status === 'AGENDADO' || (a.status === 'RASCUNHO' && a.id !== params.playerId))
    );
    if (hasActiveAuction || player.isAuctionActive) {
      return {
        success: false,
        error: 'Um jogador só pode participar de um leilão ativo por vez.',
      };
    }

    // 5. Construção do modelo do leilão
    const nowIso = new Date().toISOString();
    const auctionId = `auction-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Preserva clube original do FM2008 no campo playerOriginalClubName (imutável)
    const originalClubName = player.clubName || player.club || (player.rawFMData && player.rawFMData['Club']) || 'Sem Clube';
    const playerUniqueId = player.uniqueId || player.externalId || player.sourceUniqueId || (player.rawFMData && player.rawFMData['Unique ID']) || player.id;

    const auction: Auction = {
      id: auctionId,
      playerId: player.id,
      playerName: player.name || player.fullName || 'Jogador',
      playerAge: player.age,
      playerPosition: player.position,
      playerPositionCategory: player.positionCategory,
      playerNationality: player.nationality,
      playerNationalityCode: player.nationalityCode,
      playerOverall: player.overall,
      playerPotential: player.potential,
      playerMarketValue: player.marketValue,
      playerOriginalClubName: originalClubName,
      playerClubOriginal: originalClubName,
      playerOriginalClubId: player.clubId,
      playerUniqueId,
      playerPhoto: player.photo || player.avatar,
      initialPrice,
      minIncrement,
      currentBid: 0,
      currentLeaderManagerId: null,
      currentLeaderManagerName: null,
      currentLeaderClubId: null,
      currentLeaderClubName: null,
      status,
      scheduledOpenDate,
      scheduledCloseDate,
      openedAt: status === 'ABERTO' ? nowIso : undefined,
      winnerManagerId: null,
      winnerClubId: null,
      winningBid: null,
      totalBids: 0,
      createdByAdminId: adminId || 'admin',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // 6. Atualização do jogador para vincular ao leilão
    player.isAuctionActive = status === 'ABERTO' || status === 'AGENDADO';
    player.activeAuctionId = auctionId;
    player.auctionStatus = player.isAuctionActive ? 'IN_AUCTION' : 'AVAILABLE';

    // 7. Registro de auditoria
    const auditLog: AuctionAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      auctionId,
      action: status === 'ABERTO' ? 'OPENED' : status === 'AGENDADO' ? 'SCHEDULED' : 'CREATED',
      performedBy: adminId || 'admin',
      performerRole: 'ADMIN',
      details: {
        playerId: player.id,
        playerName: player.name,
        initialPrice,
        minIncrement,
        status,
      },
      timestamp: nowIso,
    };

    // 8. Persistência local (dataStore)
    dataStore.saveAuction(auction);
    dataStore.savePlayer(player);
    dataStore.saveAuctionAuditLog(auditLog);

    // 9. Persistência Firestore (se disponível e não estiver em modo de teste isolado)
    const db = getFirestoreDb() || firestoreDb;
    if (!this.isTestMode() && isFirebaseConfigured() && db) {
      try {
        const batch = writeBatch(db);
        const auctionRef = doc(db, 'auctions', auctionId);
        const playerRef = doc(db, 'jogadores', player.id);
        const auditRef = doc(db, 'auctionAuditLogs', auditLog.id);

        batch.set(auctionRef, sanitizeForFirestore(auction));
        batch.update(playerRef, {
          isAuctionActive: player.isAuctionActive,
          activeAuctionId: auctionId,
          auctionStatus: player.auctionStatus,
        });
        batch.set(auditRef, sanitizeForFirestore(auditLog));

        await batch.commit();
      } catch (err) {
        console.warn('Falha na persistência Firestore do novo leilão. Sincronizado localmente.', err);
      }
    }

    return { success: true, auction };
  },

  /**
   * Atualiza status do leilão (Admin).
   */
  async updateAuctionStatus(
    auctionId: string,
    targetStatus: AuctionStatus,
    adminId: string
  ): Promise<{ success: boolean; auction?: Auction; error?: string }> {
    const auction = await this.getAuctionById(auctionId);
    if (!auction) {
      return { success: false, error: 'Leilão não encontrado.' };
    }

    if (targetStatus === 'ENCERRADO') {
      return this.closeAuction(auctionId, adminId, 'Encerramento manual solicitado pelo Administrador.');
    }

    const nowIso = new Date().toISOString();
    const prevStatus = auction.status;
    auction.status = targetStatus;
    auction.updatedAt = nowIso;

    if (targetStatus === 'ABERTO') {
      auction.openedAt = nowIso;
    } else if (targetStatus === 'CANCELADO') {
      auction.cancelledAt = nowIso;
    }

    // Se cancelado, libera reservas do líder e desbloqueia jogador
    const player = await jogadoresService.getById(auction.playerId);
    if (targetStatus === 'CANCELADO') {
      if (player) {
        player.isAuctionActive = false;
        player.activeAuctionId = undefined;
        player.auctionStatus = 'AVAILABLE';
        dataStore.savePlayer(player);
      }

      // Libera reserva ativa do líder atual, se houver
      if (auction.currentLeaderClubId && auction.currentBid > 0) {
        await this.releaseClubReservation(auction.id, auction.currentLeaderClubId, auction.currentBid);
      }
    } else if (targetStatus === 'ABERTO' || targetStatus === 'AGENDADO') {
      if (player) {
        player.isAuctionActive = true;
        player.activeAuctionId = auction.id;
        player.auctionStatus = 'IN_AUCTION';
        dataStore.savePlayer(player);
      }
    }

    const auditLog: AuctionAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      auctionId,
      action: targetStatus === 'ABERTO' ? 'OPENED' : targetStatus === 'CANCELADO' ? 'CANCELLED' : 'SCHEDULED',
      performedBy: adminId || 'admin',
      performerRole: 'ADMIN',
      details: { previousStatus: prevStatus, newStatus: targetStatus },
      timestamp: nowIso,
    };

    dataStore.saveAuction(auction);
    dataStore.saveAuctionAuditLog(auditLog);

    const db = getFirestoreDb() || firestoreDb;
    if (!this.isTestMode() && isFirebaseConfigured() && db) {
      try {
        const batch = writeBatch(db);
        const auctionRef = doc(db, 'auctions', auctionId);
        const auditRef = doc(db, 'auctionAuditLogs', auditLog.id);

        batch.update(auctionRef, sanitizeForFirestore({
          status: auction.status,
          updatedAt: auction.updatedAt,
          openedAt: auction.openedAt,
          cancelledAt: auction.cancelledAt,
        }));
        batch.set(auditRef, sanitizeForFirestore(auditLog));

        if (player) {
          const playerRef = doc(db, 'jogadores', player.id);
          batch.update(playerRef, {
            isAuctionActive: player.isAuctionActive,
            activeAuctionId: player.activeAuctionId || null,
            auctionStatus: player.auctionStatus,
          });
        }

        await batch.commit();
      } catch (err) {
        console.warn('Falha ao atualizar status no Firestore.', err);
      }
    }

    return { success: true, auction };
  },

  /**
   * Operação ATÔMICA de Lance com Concorrência e Gestão de Reserva de Orçamento.
   * Utiliza runTransaction do Firestore para prevenir condições de corrida entre múltiplos Managers.
   */
  async placeBid(
    params: PlaceBidParams
  ): Promise<{ success: boolean; bid?: AuctionBid; auction?: Auction; error?: string }> {
    const { auctionId, managerId, managerName, clubId, clubName, amount } = params;

    if (!amount || amount <= 0 || isNaN(amount)) {
      return { success: false, error: 'O valor do lance deve ser maior que zero.' };
    }

    if (!managerId) {
      return { success: false, error: 'Manager não autenticado para dar lances.' };
    }

    if (!clubId) {
      return { success: false, error: 'Manager não possui um clube vinculado válido.' };
    }

    const now = Date.now();
    const nowIso = new Date().toISOString();
    const db = getFirestoreDb() || firestoreDb;

    // Se Firebase estiver configurado e não estiver em modo de teste, executa via runTransaction do Firestore
    if (!this.isTestMode() && isFirebaseConfigured() && db) {
      try {
        const result = await runTransaction(db, async (tx) => {
          const auctionRef = doc(db, 'auctions', auctionId);
          const auctionSnap = await tx.get(auctionRef);

          if (!auctionSnap.exists()) {
            throw new Error('Leilão não encontrado.');
          }

          const auctionData = auctionSnap.data() as Auction;

          // 1. Validações de status e tempo do leilão
          if (auctionData.status !== 'ABERTO') {
            throw new Error(`Não é possível dar lance: o leilão está com status ${auctionData.status}.`);
          }

          const closeTime = new Date(auctionData.scheduledCloseDate).getTime();
          if (now >= closeTime) {
            throw new Error('Este leilão já atingiu o horário limite de encerramento.');
          }

          // 2. Validação do valor mínimo do lance
          const currentBid = Number(auctionData.currentBid) || 0;
          const minIncrement = Number(auctionData.minIncrement) || 0;
          const initialPrice = Number(auctionData.initialPrice) || 0;
          const totalBids = Number(auctionData.totalBids) || 0;

          const minRequiredBid = totalBids === 0 ? initialPrice : currentBid + minIncrement;
          if (amount < minRequiredBid) {
            throw new Error(
              `Lance inválido! O valor mínimo aceito é de R$ ${minRequiredBid.toLocaleString('pt-BR')} (atual: R$ ${currentBid.toLocaleString('pt-BR')}, incremento: R$ ${minIncrement.toLocaleString('pt-BR')}).`
            );
          }

          // Não permite dar lance menor ou igual ao seu próprio lance atual líder
          if (auctionData.currentLeaderManagerId === managerId && amount <= currentBid) {
            throw new Error('Você já é o líder deste leilão com este mesmo valor de lance.');
          }

          // 3. Validação do jogador
          const playerRef = doc(db, 'jogadores', auctionData.playerId);
          const playerSnap = await tx.get(playerRef);
          if (!playerSnap.exists()) {
            throw new Error('Jogador não encontrado no sistema.');
          }
          const playerData = playerSnap.data() as Player;
          if (playerData.auctionStatus === 'SOLD') {
            throw new Error('Jogador já arrematado.');
          }

          // 4. Validação rigorosa de Orçamento e Reserva do Clube Comprador
          const bidderClubRef = doc(db, 'clubes', clubId);
          const bidderClubSnap = await tx.get(bidderClubRef);
          if (!bidderClubSnap.exists()) {
            throw new Error('Clube do Manager não encontrado.');
          }
          const bidderClub = bidderClubSnap.data() as Club;

          const totalTransferBudget = Number(bidderClub.transferBudget) || Number(bidderClub.balance) || 0;
          const currentReserved = Number(bidderClub.reservedTransferBudget) || 0;

          // Se o mesmo clube já era o líder anterior neste mesmo leilão, calcula apenas a diferença incremental
          const isSameClubLeader = auctionData.currentLeaderClubId === clubId;
          const previousReservationForThisAuction = isSameClubLeader ? currentBid : 0;

          const availableBudget = totalTransferBudget - (currentReserved - previousReservationForThisAuction);
          if (amount > availableBudget) {
            throw new Error(
              `Orçamento insuficiente! Disponível: R$ ${Math.max(0, availableBudget).toLocaleString('pt-BR')}, Lance: R$ ${amount.toLocaleString('pt-BR')}.`
            );
          }

          // Identificação estrita do primeiro lance vs lances subsequentes
          const prevLeaderClubId = auctionData.currentLeaderClubId || null;
          const prevLeaderManagerId =
            auctionData.currentLeaderManagerId || (auctionData as unknown as { currentLeaderId?: string }).currentLeaderId || null;

          // No primeiro lance: quando totalBids é 0, ou currentLeaderId/currentLeaderClubId não existem,
          // NÃO executar nenhuma operação de liberação de reserva anterior.
          const isFirstBid =
            totalBids === 0 ||
            !prevLeaderClubId ||
            !prevLeaderManagerId;

          const hasPreviousLeaderToRelease =
            !isFirstBid &&
            Boolean(prevLeaderClubId) &&
            prevLeaderClubId !== clubId &&
            currentBid > 0;

          // No Firestore transactions, todas as leituras (tx.get) devem ocorrer antes de qualquer escrita.
          // Só busca a reserva anterior se for um lance seguinte e houver líder anterior de outro clube.
          let prevResRef: ReturnType<typeof doc> | null = null;
          let prevResExists = false;
          if (hasPreviousLeaderToRelease && prevLeaderClubId) {
            const prevResId = `res-${auctionId}-${prevLeaderClubId}`;
            prevResRef = doc(db, 'auctionReservations', prevResId);
            const prevResSnap = await tx.get(prevResRef);
            prevResExists = prevResSnap.exists();
          }

          // 5. Liberação da reserva do líder anterior (somente em lances seguintes E se o documento existir)
          // No primeiro lance, NENHUMA operação de liberação é executada.
          // Nunca tenta criar uma reserva RELEASED para um documento inexistente.
          if (hasPreviousLeaderToRelease && prevResRef && prevResExists) {
            tx.update(prevResRef, {
              status: 'RELEASED',
              updatedAt: nowIso,
            });

            // Log de liberação do líder superado
            const outbidLogRef = doc(db, 'auctionAuditLogs', `audit-${Date.now()}-outbid`);
            tx.set(
              outbidLogRef,
              sanitizeForFirestore({
                id: `audit-${Date.now()}-outbid`,
                auctionId,
                action: 'OUTBID_RELEASED',
                performedBy: managerId,
                performerRole: 'MANAGER',
                details: {
                  previousLeaderClubId: prevLeaderClubId,
                  previousLeaderManagerId: prevLeaderManagerId,
                  releasedAmount: currentBid,
                  newBid: amount,
                },
                timestamp: nowIso,
              })
            );
          }

          // 6. Registra/atualiza reserva do novo líder na coleção dedicada /auctionReservations
          const newResId = `res-${auctionId}-${clubId}`;
          const newResRef = doc(db, 'auctionReservations', newResId);
          tx.set(
            newResRef,
            sanitizeForFirestore({
              id: newResId,
              auctionId,
              managerId,
              clubId,
              amount,
              status: 'ACTIVE',
              createdAt: nowIso,
              updatedAt: nowIso,
            })
          );

          // 7. Atualiza dados do Leilão com o novo líder, clube e valor
          const updatedAuction: Partial<Auction> & { currentLeaderId?: string } = {
            status: 'ABERTO',
            currentBid: amount,
            currentLeaderManagerId: managerId,
            currentLeaderId: managerId,
            currentLeaderManagerName: managerName,
            currentLeaderClubId: clubId,
            currentLeaderClubName: clubName,
            totalBids: totalBids + 1,
            updatedAt: nowIso,
          };
          tx.update(auctionRef, sanitizeForFirestore(updatedAuction));

          // 8. Registra o Lance no histórico
          const bidId = `bid-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const newBid: AuctionBid = {
            id: bidId,
            auctionId,
            playerId: auctionData.playerId,
            managerId,
            managerName,
            clubId,
            clubName,
            amount,
            previousBidAmount: currentBid,
            timestamp: nowIso,
            status: 'VALID',
          };
          const bidRef = doc(db, 'auctionBids', bidId);
          tx.set(bidRef, sanitizeForFirestore(newBid));

          // 9. Registra log de auditoria do lance
          const bidAuditRef = doc(db, 'auctionAuditLogs', `audit-${Date.now()}-bid`);
          tx.set(
            bidAuditRef,
            sanitizeForFirestore({
              id: `audit-${Date.now()}-bid`,
              auctionId,
              action: 'BID_PLACED',
              performedBy: managerId,
              performerRole: 'MANAGER',
              details: {
                bidId,
                amount,
                previousBid: currentBid,
                clubId,
                clubName,
                managerName,
              },
              timestamp: nowIso,
            })
          );

          return {
            bid: newBid,
            auction: { ...auctionData, ...updatedAuction },
          };
        });

        // Sincroniza estado local no dataStore
        if (result.bid && result.auction) {
          dataStore.saveAuctionBid(result.bid);
          dataStore.saveAuction(result.auction as Auction);
          const club = dataStore.getClubs().find((c) => c.id === clubId);
          if (club) {
            club.reservedTransferBudget = (club.reservedTransferBudget || 0) + amount;
            dataStore.saveClub(club);
          }
        }

        return { success: true, bid: result.bid, auction: result.auction as Auction };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erro ao processar lance atômico.';
        console.warn('Transação atômica do lance retornou erro:', errorMsg);
        return { success: false, error: errorMsg };
      }
    }

    // ==========================================
    // FALLBACK ATÔMICO LOCAL / TESTES EM MEMÓRIA
    // ==========================================
    return this.placeBidLocal(params);
  },

  /**
   * Implementação local da transação de lance (para testes isolados sem rede e fallback).
   */
  placeBidLocal(
    params: PlaceBidParams
  ): { success: boolean; bid?: AuctionBid; auction?: Auction; error?: string } {
    const { auctionId, managerId, managerName, clubId, clubName, amount } = params;
    const now = Date.now();
    const nowIso = new Date().toISOString();

    const auction = dataStore.getAuctionById(auctionId);
    if (!auction) {
      return { success: false, error: 'Leilão não encontrado.' };
    }

    if (auction.status !== 'ABERTO') {
      return { success: false, error: `Não é possível dar lance: o leilão está ${auction.status}.` };
    }

    const closeTime = new Date(auction.scheduledCloseDate).getTime();
    if (now >= closeTime) {
      return { success: false, error: 'Este leilão já atingiu o horário limite de encerramento.' };
    }

    const currentBid = Number(auction.currentBid) || 0;
    const minIncrement = Number(auction.minIncrement) || 0;
    const initialPrice = Number(auction.initialPrice) || 0;
    const totalBids = Number(auction.totalBids) || 0;

    const minRequiredBid = totalBids === 0 ? initialPrice : currentBid + minIncrement;
    if (amount < minRequiredBid) {
      return {
        success: false,
        error: `Lance inválido! O valor mínimo aceito é de R$ ${minRequiredBid.toLocaleString('pt-BR')} (atual: R$ ${currentBid.toLocaleString('pt-BR')}, incremento: R$ ${minIncrement.toLocaleString('pt-BR')}).`,
      };
    }

    if (auction.currentLeaderManagerId === managerId && amount <= currentBid) {
      return { success: false, error: 'Você já é o líder deste leilão com este mesmo valor de lance.' };
    }

    const player = dataStore.getPlayers().find((p) => p.id === auction.playerId);
    if (!player) {
      return { success: false, error: 'Jogador não encontrado no sistema.' };
    }
    if (player.auctionStatus === 'SOLD') {
      return { success: false, error: 'Jogador já arrematado.' };
    }

    const bidderClub = dataStore.getClubs().find((c) => c.id === clubId);
    if (!bidderClub) {
      return { success: false, error: 'Clube do Manager não encontrado.' };
    }

    const totalTransferBudget = Number(bidderClub.transferBudget) || 0;
    const currentReserved = Number(bidderClub.reservedTransferBudget) || 0;
    const isSameClubLeader = auction.currentLeaderClubId === clubId;
    const previousReservationForThisAuction = isSameClubLeader ? currentBid : 0;

    const availableBudget = totalTransferBudget - (currentReserved - previousReservationForThisAuction);
    if (amount > availableBudget) {
      return {
        success: false,
        error: `Orçamento insuficiente! Saldo disponível: R$ ${Math.max(0, availableBudget).toLocaleString('pt-BR')}.`,
      };
    }

    // Libera reserva do líder anterior (somente em lances seguintes)
    const prevLeaderClubId = auction.currentLeaderClubId || null;
    const prevLeaderManagerId = auction.currentLeaderManagerId || (auction as unknown as { currentLeaderId?: string }).currentLeaderId || null;
    const isFirstBid = totalBids === 0 || !prevLeaderClubId || !prevLeaderManagerId;

    if (!isFirstBid && prevLeaderClubId && prevLeaderClubId !== clubId && currentBid > 0) {
      const prevClub = dataStore.getClubs().find((c) => c.id === prevLeaderClubId);
      if (prevClub) {
        prevClub.reservedTransferBudget = Math.max(0, (prevClub.reservedTransferBudget || 0) - currentBid);
        dataStore.saveClub(prevClub);
      }

      dataStore.saveAuctionReservation({
        id: `res-${auctionId}-${prevLeaderClubId}`,
        auctionId,
        managerId: prevLeaderManagerId || '',
        clubId: prevLeaderClubId,
        amount: currentBid,
        status: 'RELEASED',
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      dataStore.saveAuctionAuditLog({
        id: `audit-${Date.now()}-outbid`,
        auctionId,
        action: 'OUTBID_RELEASED',
        performedBy: managerId,
        performerRole: 'MANAGER',
        details: {
          previousLeaderClubId: prevLeaderClubId,
          previousLeaderManagerId: prevLeaderManagerId,
          releasedAmount: currentBid,
          newBid: amount,
        },
        timestamp: nowIso,
      });
    }

    // Atualiza reserva do ofertante
    bidderClub.reservedTransferBudget = isSameClubLeader
      ? currentReserved - previousReservationForThisAuction + amount
      : currentReserved + amount;
    dataStore.saveClub(bidderClub);

    dataStore.saveAuctionReservation({
      id: `res-${auctionId}-${clubId}`,
      auctionId,
      managerId,
      clubId,
      amount,
      status: 'ACTIVE',
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    // Atualiza leilão
    auction.currentBid = amount;
    auction.currentLeaderManagerId = managerId;
    auction.currentLeaderManagerName = managerName;
    auction.currentLeaderClubId = clubId;
    auction.currentLeaderClubName = clubName;
    auction.totalBids = totalBids + 1;
    auction.updatedAt = nowIso;
    dataStore.saveAuction(auction);

    const newBid: AuctionBid = {
      id: `bid-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      auctionId,
      playerId: auction.playerId,
      managerId,
      managerName,
      clubId,
      clubName,
      amount,
      previousBidAmount: currentBid,
      timestamp: nowIso,
      status: 'VALID',
    };
    dataStore.saveAuctionBid(newBid);

    dataStore.saveAuctionAuditLog({
      id: `audit-${Date.now()}-bid`,
      auctionId,
      action: 'BID_PLACED',
      performedBy: managerId,
      performerRole: 'MANAGER',
      details: { amount, previousBid: currentBid, clubName, managerName },
      timestamp: nowIso,
    });

    return { success: true, bid: newBid, auction };
  },

  /**
   * Operação ATÔMICA de Encerramento de Leilão (com ou sem vencedor).
   */
  async closeAuction(
    auctionId: string,
    performedBy: string,
    reason?: string
  ): Promise<{ success: boolean; auction?: Auction; error?: string }> {
    const nowIso = new Date().toISOString();
    const db = getFirestoreDb() || firestoreDb;

    if (!this.isTestMode() && isFirebaseConfigured() && db) {
      try {
        const result = await runTransaction(db, async (tx) => {
          const auctionRef = doc(db, 'auctions', auctionId);
          const auctionSnap = await tx.get(auctionRef);
          if (!auctionSnap.exists()) {
            throw new Error('Leilão não encontrado.');
          }
          const auction = auctionSnap.data() as Auction;

          if (auction.status === 'ENCERRADO') {
            return auction; // Já encerrado
          }

          const hasWinner = Boolean(auction.currentLeaderClubId && auction.currentBid > 0);
          const playerRef = doc(db, 'jogadores', auction.playerId);
          const playerSnap = await tx.get(playerRef);

          if (hasWinner) {
            // ==========================================
            // CENÁRIO COM VENCEDOR
            // ==========================================
            const winnerClubRef = doc(db, 'clubes', auction.currentLeaderClubId!);
            const winnerClubSnap = await tx.get(winnerClubRef);
            if (!winnerClubSnap.exists()) {
              throw new Error('Clube vencedor não encontrado na transação.');
            }
            const winnerClub = winnerClubSnap.data() as Club;
            const winningFee = Number(auction.currentBid) || 0;

            // Débito definitivo do saldo, transferBudget e remoção da reserva
            const currentTransferBudget = Number(winnerClub.transferBudget) || 0;
            const currentBalance = Number(winnerClub.balance) || 0;
            const currentReserved = Number(winnerClub.reservedTransferBudget) || 0;

            const newTransferBudget = Math.max(0, currentTransferBudget - winningFee);
            const newBalance = Math.max(0, currentBalance - winningFee);
            const newReserved = Math.max(0, currentReserved - winningFee);

            tx.update(winnerClubRef, {
              transferBudget: newTransferBudget,
              balance: newBalance,
              reservedTransferBudget: newReserved,
            });

            // Atualiza jogador: currentClubId recebe o clube vencedor, mantendo clubName do FM2008
            if (playerSnap.exists()) {
              tx.update(playerRef, {
                currentClubId: auction.currentLeaderClubId,
                currentClubName: auction.currentLeaderClubName,
                auctionStatus: 'SOLD',
                isAuctionActive: false,
                activeAuctionId: null,
              });
            }

            // Consome a reserva
            const resRef = doc(db, 'auctionReservations', `res-${auctionId}-${auction.currentLeaderClubId}`);
            tx.set(
              resRef,
              sanitizeForFirestore({
                id: `res-${auctionId}-${auction.currentLeaderClubId}`,
                auctionId,
                managerId: auction.currentLeaderManagerId,
                clubId: auction.currentLeaderClubId,
                amount: winningFee,
                status: 'CONSUMED',
                updatedAt: nowIso,
              }),
              { merge: true }
            );

            // Atualiza status do leilão
            const updatedAuction: Partial<Auction> = {
              status: 'ENCERRADO',
              winnerManagerId: auction.currentLeaderManagerId,
              winnerClubId: auction.currentLeaderClubId,
              winningBid: winningFee,
              closedAt: nowIso,
              updatedAt: nowIso,
            };
            tx.update(auctionRef, updatedAuction);

            // Registra auditoria
            const auditRef = doc(db, 'auctionAuditLogs', `audit-${Date.now()}-close`);
            tx.set(
              auditRef,
              sanitizeForFirestore({
                id: `audit-${Date.now()}-close`,
                auctionId,
                action: 'WINNER_DECLARED',
                performedBy,
                performerRole: 'ADMIN',
                details: {
                  winnerManagerId: auction.currentLeaderManagerId,
                  winnerClubId: auction.currentLeaderClubId,
                  winningBid: winningFee,
                  reason,
                },
                timestamp: nowIso,
              })
            );

            return { ...auction, ...updatedAuction };
          } else {
            // ==========================================
            // CENÁRIO SEM VENCEDOR (SEM LANCES)
            // ==========================================
            if (playerSnap.exists()) {
              tx.update(playerRef, {
                auctionStatus: 'AVAILABLE',
                isAuctionActive: false,
                activeAuctionId: null,
              });
            }

            const updatedAuction: Partial<Auction> = {
              status: 'ENCERRADO',
              winnerManagerId: null,
              winnerClubId: null,
              winningBid: null,
              closedAt: nowIso,
              updatedAt: nowIso,
            };
            tx.update(auctionRef, updatedAuction);

            const auditRef = doc(db, 'auctionAuditLogs', `audit-${Date.now()}-nosale`);
            tx.set(
              auditRef,
              sanitizeForFirestore({
                id: `audit-${Date.now()}-nosale`,
                auctionId,
                action: 'NO_SALE',
                performedBy,
                performerRole: 'ADMIN',
                details: { reason: reason || 'Leilão encerrado sem lances válidos.' },
                timestamp: nowIso,
              })
            );

            return { ...auction, ...updatedAuction };
          }
        });

        // Sincroniza localmente
        dataStore.saveAuction(result as Auction);
        if (result.winnerClubId) {
          const p = dataStore.getPlayers().find((item) => item.id === result.playerId);
          if (p) {
            p.currentClubId = result.winnerClubId;
            p.currentClubName = result.currentLeaderClubName || '';
            p.auctionStatus = 'SOLD';
            p.isAuctionActive = false;
            p.activeAuctionId = undefined;
            dataStore.savePlayer(p);
          }
        }

        return { success: true, auction: result as Auction };
      } catch (err) {
        console.warn('Transação de encerramento no Firestore falhou. Usando fallback local.', err);
      }
    }

    // Fallback local em memória
    return this.closeAuctionLocal(auctionId, performedBy, reason);
  },

  /**
   * Implementação local de encerramento para testes isolados e fallback.
   */
  closeAuctionLocal(
    auctionId: string,
    performedBy: string,
    reason?: string
  ): { success: boolean; auction?: Auction; error?: string } {
    const nowIso = new Date().toISOString();
    const auction = dataStore.getAuctionById(auctionId);
    if (!auction) {
      return { success: false, error: 'Leilão não encontrado.' };
    }

    const hasWinner = Boolean(auction.currentLeaderClubId && auction.currentBid > 0);
    const player = dataStore.getPlayers().find((p) => p.id === auction.playerId);

    if (hasWinner) {
      const winnerClub = dataStore.getClubs().find((c) => c.id === auction.currentLeaderClubId);
      const winningFee = Number(auction.currentBid) || 0;

      if (winnerClub) {
        winnerClub.transferBudget = Math.max(0, (winnerClub.transferBudget || 0) - winningFee);
        winnerClub.balance = Math.max(0, (winnerClub.balance || 0) - winningFee);
        winnerClub.reservedTransferBudget = Math.max(0, (winnerClub.reservedTransferBudget || 0) - winningFee);
        dataStore.saveClub(winnerClub);
      }

      if (player) {
        player.currentClubId = auction.currentLeaderClubId!;
        player.currentClubName = auction.currentLeaderClubName || '';
        player.auctionStatus = 'SOLD';
        player.isAuctionActive = false;
        player.activeAuctionId = undefined;
        dataStore.savePlayer(player);
      }

      dataStore.saveAuctionReservation({
        id: `res-${auctionId}-${auction.currentLeaderClubId}`,
        auctionId,
        managerId: auction.currentLeaderManagerId || '',
        clubId: auction.currentLeaderClubId!,
        amount: winningFee,
        status: 'CONSUMED',
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      auction.status = 'ENCERRADO';
      auction.winnerManagerId = auction.currentLeaderManagerId;
      auction.winnerClubId = auction.currentLeaderClubId;
      auction.winningBid = winningFee;
      auction.closedAt = nowIso;
      auction.updatedAt = nowIso;
      dataStore.saveAuction(auction);

      dataStore.saveAuctionAuditLog({
        id: `audit-${Date.now()}-close`,
        auctionId,
        action: 'WINNER_DECLARED',
        performedBy,
        performerRole: 'ADMIN',
        details: {
          winnerManagerId: auction.winnerManagerId,
          winnerClubId: auction.winnerClubId,
          winningBid: winningFee,
          reason,
        },
        timestamp: nowIso,
      });
    } else {
      if (player) {
        player.auctionStatus = 'AVAILABLE';
        player.isAuctionActive = false;
        player.activeAuctionId = undefined;
        dataStore.savePlayer(player);
      }

      auction.status = 'ENCERRADO';
      auction.winnerManagerId = null;
      auction.winnerClubId = null;
      auction.winningBid = null;
      auction.closedAt = nowIso;
      auction.updatedAt = nowIso;
      dataStore.saveAuction(auction);

      dataStore.saveAuctionAuditLog({
        id: `audit-${Date.now()}-nosale`,
        auctionId,
        action: 'NO_SALE',
        performedBy,
        performerRole: 'ADMIN',
        details: { reason: reason || 'Sem lances registrados.' },
        timestamp: nowIso,
      });
    }

    return { success: true, auction };
  },

  /**
   * Helper para liberar reserva de clube ao ser superado ou em cancelamento.
   */
  async releaseClubReservation(auctionId: string, clubId: string, amount: number): Promise<void> {
    const club = await clubesService.getById(clubId);
    if (club) {
      club.reservedTransferBudget = Math.max(0, (club.reservedTransferBudget || 0) - amount);
      dataStore.saveClub(club);

      const db = getFirestoreDb() || firestoreDb;
      if (!this.isTestMode() && isFirebaseConfigured() && db) {
        try {
          const clubRef = doc(db, 'clubes', clubId);
          await updateDoc(clubRef, {
            reservedTransferBudget: club.reservedTransferBudget,
          });
        } catch {
          // ignore
        }
      }
    }
  },

  /**
   * Retorna resumo financeiro do Clube em relação a Leilões:
   * Orçamento total, valor reservado em lances e saldo disponível.
   */
  async getClubAuctionBudget(clubId: string): Promise<AuctionBudgetSummary> {
    const club = await clubesService.getById(clubId);
    const total = Number(club?.transferBudget) || Number(club?.balance) || 0;
    let reserved = Number(club?.reservedTransferBudget) || 0;

    const db = getFirestoreDb() || firestoreDb;
    if (!this.isTestMode() && isFirebaseConfigured() && db) {
      try {
        const resQuery = query(
          collection(db, 'auctionReservations'),
          where('clubId', '==', clubId),
          where('status', '==', 'ACTIVE')
        );
        const resSnap = await getDocs(resQuery);
        let activeReservationsSum = 0;
        resSnap.forEach((d) => {
          activeReservationsSum += Number(d.data().amount) || 0;
        });
        reserved = activeReservationsSum;
      } catch (err) {
        // Fallback para valor do clube em caso de offline
      }
    }

    const available = Math.max(0, total - reserved);

    return {
      totalTransferBudget: total,
      reservedBudget: reserved,
      availableBudget: available,
    };
  },

  /**
   * Retorna todos os leilões com auto-verificação de encerramento por horário.
   */
  async getAuctions(filter?: {
    status?: AuctionStatus;
    playerId?: string;
  }): Promise<Auction[]> {
    let list: Auction[] = [];
    const db = getFirestoreDb() || firestoreDb;

    if (!this.isTestMode() && isFirebaseConfigured() && db) {
      try {
        const colRef = collection(db, 'auctions');
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          const fromDb = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Auction));
          const localMap = new Map<string, Auction>();
          dataStore.getAuctions().forEach((a) => localMap.set(a.id, a));
          fromDb.forEach((a) => localMap.set(a.id, a));
          list = Array.from(localMap.values());
        }
      } catch (err) {
        console.warn('Falha na busca de leilões via Firestore. Usando dataStore local.', err);
      }
    }

    if (list.length === 0) {
      list = dataStore.getAuctions();
    }

    // Auto-encerramento se o prazo de um leilão ABERTO expirou
    const now = Date.now();
    for (const a of list) {
      if (a.status === 'ABERTO' && a.scheduledCloseDate) {
        const closeTime = new Date(a.scheduledCloseDate).getTime();
        if (now >= closeTime) {
          await this.closeAuction(a.id, 'SYSTEM_AUTO_CLOSE', 'Encerramento automático por expiração do cronômetro.');
          a.status = 'ENCERRADO';
        }
      }
    }

    // Ordenação cronológica: Abertos primeiro, depois mais recentes
    list.sort((a, b) => {
      if (a.status === 'ABERTO' && b.status !== 'ABERTO') return -1;
      if (b.status === 'ABERTO' && a.status !== 'ABERTO') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    if (filter) {
      if (filter.status) {
        list = list.filter((a) => a.status === filter.status);
      }
      if (filter.playerId) {
        list = list.filter((a) => a.playerId === filter.playerId);
      }
    }

    return list;
  },

  /**
   * Retorna leilão por ID.
   */
  async getAuctionById(id: string): Promise<Auction | null> {
    const cleanId = id?.trim();
    if (!cleanId) return null;

    const db = getFirestoreDb() || firestoreDb;
    if (!this.isTestMode() && isFirebaseConfigured() && db) {
      try {
        const docRef = doc(db, 'auctions', cleanId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const item = { id: snap.id, ...snap.data() } as Auction;
          dataStore.saveAuction(item);
          return item;
        }
      } catch (err) {
        console.warn('Falha ao buscar leilão no Firestore.', err);
      }
    }

    return dataStore.getAuctionById(cleanId) || null;
  },

  /**
   * Retorna histórico de lances de um leilão.
   */
  async getBidsByAuction(auctionId: string): Promise<AuctionBid[]> {
    const db = getFirestoreDb() || firestoreDb;
    if (!this.isTestMode() && isFirebaseConfigured() && db) {
      try {
        const colRef = collection(db, 'auctionBids');
        const q = query(colRef, where('auctionId', '==', auctionId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const fromDb = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuctionBid));
          fromDb.forEach((b) => dataStore.saveAuctionBid(b));
          return fromDb.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
      } catch (err) {
        console.warn('Falha ao buscar lances no Firestore.', err);
      }
    }
    return dataStore.getAuctionBids(auctionId);
  },

  /**
   * Retorna logs de auditoria de um leilão.
   */
  async getAuditLogs(auctionId: string): Promise<AuctionAuditLog[]> {
    const db = getFirestoreDb() || firestoreDb;
    if (!this.isTestMode() && isFirebaseConfigured() && db) {
      try {
        const colRef = collection(db, 'auctionAuditLogs');
        const q = query(colRef, where('auctionId', '==', auctionId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const fromDb = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuctionAuditLog));
          return fromDb.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
      } catch (err) {
        console.warn('Falha ao buscar logs de auditoria no Firestore.', err);
      }
    }
    return dataStore.getAuctionAuditLogs(auctionId);
  },
};
