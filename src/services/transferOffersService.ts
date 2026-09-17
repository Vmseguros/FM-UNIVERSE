import { TransferOffer, Player, Club, Transfer, News, FinanceRecord } from '../types';
import { formatCurrencyBRL } from '../utils/currency';
import { isFirebaseConfigured, firestoreDb } from '../config/firebase';
import { dataStore } from './dataStore';
import { clubesService } from './clubesService';
import { jogadoresService } from './jogadoresService';
import { transferenciasService } from './transferenciasService';
import { notificacoesService } from './notificacoesService';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  runTransaction,
} from 'firebase/firestore';

// Proteção contra concorrência e duplo clique em memória
const activeProcessingOffers = new Set<string>();

export interface SellerClubResolution {
  sellerClub: Club | null;
  error?: string;
  isAmbiguous?: boolean;
}

/**
 * Resolve o clube proprietário nas propostas usando exclusivamente os clubes existentes na coleção clubes.
 * Regras mandatórias:
 * 1. Primeiro tentar currentClubId / clubId com os clubes existentes na coleção;
 * 2. Quando estiver vazio ou não encontrado por ID, resolver pelo nome do clube importado
 *    SOMENTE se houver correspondência inequívoca (exatamente 1 clube correspondente);
 * 3. NÃO criar clubes automaticamente e NÃO alterar o campo original Club do FM2008;
 * 4. Se não existir clube correspondente no FM Universe, bloquear a proposta e informar
 *    claramente que o jogador ainda não possui clube proprietário cadastrado no universo.
 */
export async function resolveSellerClub(
  player: {
    id: string;
    name: string;
    clubId?: string;
    currentClubId?: string;
    clubName?: string;
    currentClubName?: string;
    club?: string;
  },
  cachedClubs?: Club[]
): Promise<SellerClubResolution> {
  const allClubs = cachedClubs && cachedClubs.length > 0 ? cachedClubs : await clubesService.getAll();

  const normalizeStr = (str?: string) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();

  // 1. Primeiro tentar currentClubId / clubId
  const candidateIds = [player.currentClubId, player.clubId].filter(Boolean) as string[];
  for (const rawId of candidateIds) {
    const cleanId = rawId.trim();
    if (!cleanId) continue;
    const directMatch = allClubs.find(
      (c) =>
        c.id === cleanId ||
        c.id === `club-${cleanId}` ||
        c.id === cleanId.replace(/^club-/, '') ||
        (c.slug && c.slug.toLowerCase() === cleanId.toLowerCase()) ||
        (c.slug && c.slug.toLowerCase() === cleanId.replace(/^club-/, '').toLowerCase())
    );
    if (directMatch) {
      return { sellerClub: directMatch };
    }
  }

  // 2. Quando estiver vazio ou sem correspondência por ID, resolver pelo nome do clube importado
  // SOMENTE se houver correspondência inequívoca com um clube existente
  const importedClubName = (player.currentClubName || player.clubName || player.club || '').trim();
  if (importedClubName) {
    const normImported = normalizeStr(importedClubName);
    if (normImported) {
      const matchingClubs = allClubs.filter((c) => {
        const normName = normalizeStr(c.name);
        const normShort = normalizeStr(c.shortName);
        const normSlug = normalizeStr(c.slug);
        return (
          normName === normImported ||
          normShort === normImported ||
          normSlug === normImported
        );
      });

      if (matchingClubs.length === 1) {
        return { sellerClub: matchingClubs[0] };
      }

      if (matchingClubs.length > 1) {
        return {
          sellerClub: null,
          isAmbiguous: true,
          error: `Identificação ambígua: múltiplos clubes encontrados no FM Universe para "${importedClubName}". A proposta não pôde ser direcionada.`,
        };
      }
    }
  }

  // 3. Se não existir clube correspondente no FM Universe, bloquear a proposta
  const displayClub = importedClubName || 'clube de origem';
  return {
    sellerClub: null,
    error: `O jogador ainda não possui clube proprietário cadastrado no universo (${displayClub}). Não é possível realizar propostas oficiais de transferência até que o clube esteja registrado no FM Universe.`,
  };
}

export interface CreateOfferParams {
  playerId: string;
  buyerClubId: string;
  amount: number;
  userId?: string;
}

export const transferOffersService = {
  /**
   * Cria e persiste uma nova proposta de transferência no Firestore / local.
   * Valida saldo do comprador, dados do jogador e clubes envolvidos.
   */
  async createOffer(params: {
    playerId: string;
    buyerClubId: string;
    amount: number;
    userId?: string;
  }): Promise<{ success: boolean; offer?: TransferOffer; error?: string }> {
    const { playerId, buyerClubId, amount, userId } = params;

    // 1. Validação básica de valor
    if (!amount || amount <= 0 || isNaN(amount)) {
      return { success: false, error: 'O valor da proposta deve ser maior que zero.' };
    }

    // 2. Busca do atleta
    const player = await jogadoresService.getById(playerId);
    if (!player) {
      return { success: false, error: 'Jogador selecionado não foi encontrado.' };
    }

    // 3. Resolução rigorosa do clube proprietário usando apenas clubes existentes na coleção
    const sellerResolution = await resolveSellerClub(player);
    if (!sellerResolution.sellerClub) {
      return {
        success: false,
        error: sellerResolution.error || 'O jogador ainda não possui clube proprietário cadastrado no universo.',
      };
    }
    const sellerClub = sellerResolution.sellerClub;

    // 4. Validação de clube proprietário (não pode ser o próprio comprador)
    if (sellerClub.id === buyerClubId) {
      return { success: false, error: 'Não é permitido realizar uma proposta por um atleta do próprio clube.' };
    }

    // 5. Busca e validação do clube comprador
    const buyerClub = await clubesService.getById(buyerClubId);
    if (!buyerClub) {
      return { success: false, error: 'Clube comprador não encontrado.' };
    }

    // 5. Validação rigorosa de saldo / orçamento
    if (amount > buyerClub.transferBudget || amount > buyerClub.balance) {
      return {
        success: false,
        error: `Orçamento insuficiente! Seu clube possui ${formatCurrencyBRL(buyerClub.transferBudget, { compact: true })} para transferências.`,
      };
    }

    // 6. Evitar propostas duplicadas pendentes para o mesmo atleta pelo mesmo clube
    const existingOffers = await this.getOffersSent(buyerClubId);
    const hasPending = existingOffers.some(
      (o) => o.playerId === playerId && o.status === 'PENDING'
    );
    if (hasPending) {
      return {
        success: false,
        error: 'Já existe uma proposta oficial pendente deste clube para este atleta.',
      };
    }

    // 7. Construção da proposta
    const nowIso = new Date().toISOString();
    const offerId = `offer-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const offer: TransferOffer = {
      id: offerId,
      playerId: player.id,
      playerName: player.name,
      playerSnapshot: {
        id: player.id,
        name: player.name,
        position: player.position,
        positionCategory: player.positionCategory,
        age: player.age,
        overall: player.overall,
        potential: player.potential,
        marketValue: player.marketValue,
        wage: player.wage,
        clubId: player.clubId,
        clubName: player.clubName,
      },
      buyerClubId: buyerClub.id,
      buyerClubName: buyerClub.name,
      sellerClubId: sellerClub.id,
      sellerClubName: sellerClub.name,
      toClubId: sellerClub.id,
      toClubName: sellerClub.name,
      fromClubId: buyerClub.id,
      fromClubName: buyerClub.name,
      amount: Math.round(amount),
      proposedFee: Math.round(amount),
      status: 'PENDING',
      createdAt: nowIso,
      updatedAt: nowIso,
      createdByUserId: userId || 'user-manager-1',
      createdBy: userId || 'user-manager-1',
    };
    (offer as any).toClub = sellerClub.name;
    (offer as any).fromClub = buyerClub.name;

    // 8. Persistência local imediata
    dataStore.addTransferOffer(offer);

    // 9. Persistência no Firestore se configurado
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const offerRef = doc(firestoreDb, 'transferOffers', offer.id);
        await setDoc(offerRef, offer);
      } catch (err) {
        console.warn('⚠️ Falha ao salvar proposta no Firestore. Salva em storage local.', err);
      }
    }

    // 10. Notificação oficial para o clube vendedor
    await notificacoesService.create({
      type: 'TRANSFER_OFFER_RECEIVED',
      clubId: sellerClub.id,
      offerId: offer.id,
      title: `Nova proposta por ${player.name}`,
      message: `O ${buyerClub.name} enviou uma oferta oficial de ${formatCurrencyBRL(amount, { compact: true })} pelo jogador ${player.name}.`,
    });

    return { success: true, offer };
  },

  /**
   * Obtém todas as propostas enviadas pelo clube comprador.
   */
  async getOffersSent(buyerClubId: string): Promise<TransferOffer[]> {
    const map = new Map<string, TransferOffer>();
    const allClubs = dataStore.getClubs();
    const targetClub = allClubs.find(
      (c) => c.id === buyerClubId || c.name.toLowerCase() === buyerClubId.toLowerCase()
    );
    const targetId = targetClub?.id || buyerClubId;
    const targetName = targetClub?.name || buyerClubId;

    const matchesSent = (data: TransferOffer) => {
      const anyData = data as any;
      const isSent =
        data.buyerClubId === targetId ||
        data.buyerClubName?.toLowerCase() === targetName.toLowerCase() ||
        data.fromClubId === targetId ||
        anyData.fromClub === targetId ||
        anyData.fromClub?.toLowerCase() === targetName.toLowerCase() ||
        (data.toClubId === targetId && data.sellerClubId !== targetId);

      const isSeller = data.sellerClubId === targetId;
      return isSent && !isSeller;
    };

    // 1. Busca no Firestore
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const colRef = collection(firestoreDb, 'transferOffers');
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          snap.docs.forEach((d) => {
            const data = { id: d.id, ...d.data() } as TransferOffer;
            if (matchesSent(data)) {
              map.set(data.id, data);
            }
          });
        }
      } catch (err) {
        console.warn('Falha ao consultar transferOffers no Firestore.', err);
      }
    }

    // 2. Mescla com local dataStore preservando o estado mais recente
    const local = dataStore.getTransferOffers();
    local.forEach((o) => {
      if (matchesSent(o)) {
        const existing = map.get(o.id);
        if (!existing) {
          map.set(o.id, o);
        } else {
          // Se o local estiver COMPLETED ou tiver timestamp mais recente, priorizar
          if (o.status === 'COMPLETED' || o.status === 'ACCEPTED' || o.status === 'REJECTED') {
            map.set(o.id, { ...existing, ...o });
          } else if (new Date(o.updatedAt || 0).getTime() > new Date(existing.updatedAt || 0).getTime()) {
            map.set(o.id, { ...existing, ...o });
          }
        }
      }
    });

    const list = Array.from(map.values());
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  },

  /**
   * Obtém todas as propostas recebidas pelo clube proprietário do jogador.
   * Conforme especificação, atende tanto sellerClubId quanto toClubId/toClub.
   */
  async getOffersReceived(sellerClubId: string): Promise<TransferOffer[]> {
    const map = new Map<string, TransferOffer>();
    const allClubs = dataStore.getClubs();
    const targetClub = allClubs.find(
      (c) => c.id === sellerClubId || c.name.toLowerCase() === sellerClubId.toLowerCase()
    );
    const targetId = targetClub?.id || sellerClubId;
    const targetName = targetClub?.name || sellerClubId;

    const matchesReceived = (data: TransferOffer) => {
      const anyData = data as any;
      const isReceived =
        data.sellerClubId === targetId ||
        data.sellerClubName?.toLowerCase() === targetName.toLowerCase() ||
        data.toClubId === targetId ||
        anyData.toClub === targetId ||
        anyData.toClub?.toLowerCase() === targetName.toLowerCase() ||
        anyData.toClubName?.toLowerCase() === targetName.toLowerCase() ||
        (data.fromClubId === targetId && data.buyerClubId !== targetId);

      const isBuyer = data.buyerClubId === targetId;
      return isReceived && !isBuyer;
    };

    // 1. Busca no Firestore
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const colRef = collection(firestoreDb, 'transferOffers');
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          snap.docs.forEach((d) => {
            const data = { id: d.id, ...d.data() } as TransferOffer;
            if (matchesReceived(data)) {
              map.set(data.id, data);
            }
          });
        }
      } catch (err) {
        console.warn('Falha ao consultar transferOffers recebidas no Firestore.', err);
      }
    }

    // 2. Mescla com local dataStore preservando o estado mais recente e status COMPLETED
    const local = dataStore.getTransferOffers();
    local.forEach((o) => {
      if (matchesReceived(o)) {
        const existing = map.get(o.id);
        if (!existing) {
          map.set(o.id, o);
        } else {
          // Se o local estiver COMPLETED ou tiver timestamp mais recente, priorizar
          if (o.status === 'COMPLETED' || o.status === 'ACCEPTED' || o.status === 'REJECTED') {
            map.set(o.id, { ...existing, ...o });
          } else if (new Date(o.updatedAt || 0).getTime() > new Date(existing.updatedAt || 0).getTime()) {
            map.set(o.id, { ...existing, ...o });
          }
        }
      }
    });

    const list = Array.from(map.values());
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  },

  /**
   * Busca uma proposta específica por ID garantindo a versão mais atualizada.
   */
  async getOfferById(offerId: string): Promise<TransferOffer | null> {
    const local = dataStore.getTransferOfferById(offerId);
    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const docRef = doc(firestoreDb, 'transferOffers', offerId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const remote = { id: snap.id, ...snap.data() } as TransferOffer;
          if (!local) return remote;
          if (local.status === 'COMPLETED' || local.status === 'ACCEPTED') {
            return { ...remote, ...local };
          }
          if (new Date(local.updatedAt || 0).getTime() > new Date(remote.updatedAt || 0).getTime()) {
            return { ...remote, ...local };
          }
          return remote;
        }
      } catch (err) {
        console.warn('Falha ao buscar proposta no Firestore.', err);
      }
    }
    return local || null;
  },

  /**
   * Aceita uma proposta de transferência de forma atômica, consistente e IDEMPOTENTE:
   * 1. Prevenção estrita contra concorrência e duplo clique.
   * 2. Idempotência: Se a proposta já foi concluída, reconhece e retorna sucesso sem duplicar pagamentos.
   * 3. Idempotência: Se a transferência do atleta já foi gravada no histórico, atualiza a proposta para COMPLETED sem movimentação financeira adicional.
   * 4. Valida se o atleta ainda pertence ao vendedor.
   * 5. Valida se o comprador possui saldo e orçamento suficientes.
   * 6. Executa débito do comprador e crédito do vendedor exatamente uma vez.
   * 7. Altera o clube do atleta exclusivamente para o comprador.
   * 8. Atualiza o status da proposta para COMPLETED de forma durável.
   * 9. Registra histórico oficial de transferência (COMPLETED) exatamente uma vez.
   * 10. Registra lançamentos contábeis, notícia e notificações sem duplicidade.
   */
  async acceptOffer(offerId: string): Promise<{ success: boolean; error?: string; alreadyProcessed?: boolean }> {
    // Prevenção contra duplo clique / concorrência
    if (activeProcessingOffers.has(offerId)) {
      return { success: false, error: 'Esta proposta já está sendo processada no momento.' };
    }

    activeProcessingOffers.add(offerId);

    try {
      // 1. Obter a proposta
      const offer = await this.getOfferById(offerId);
      if (!offer) {
        return { success: false, error: 'Proposta de transferência não encontrada.' };
      }

      // 2. Obter dados atuais do comprador e vendedor com resolução resiliente
      const buyerId = offer.buyerClubId || offer.fromClubId || (offer as any).buyerId || (offer as any).fromClub;
      let buyerClub = buyerId ? await clubesService.getById(buyerId) : null;
      if (!buyerClub && offer.buyerClubName) {
        const allClubs = await clubesService.getAll();
        buyerClub = allClubs.find((c) => c.name.toLowerCase() === offer.buyerClubName.toLowerCase() || c.id === buyerId) || null;
      }
      if (!buyerClub) {
        return { success: false, error: 'Clube comprador interessado não encontrado no sistema.' };
      }

      const sellerId = offer.sellerClubId || offer.toClubId || (offer as any).sellerId || (offer as any).toClub;
      let sellerClub = sellerId ? await clubesService.getById(sellerId) : null;
      if (!sellerClub && offer.sellerClubName) {
        const allClubs = await clubesService.getAll();
        sellerClub = allClubs.find((c) => c.name.toLowerCase() === offer.sellerClubName.toLowerCase() || c.id === sellerId) || null;
      }
      if (!sellerClub) {
        return { success: false, error: 'Clube vendedor atual não encontrado no sistema.' };
      }

      // 3. Obter dados atuais do jogador
      const player = await jogadoresService.getById(offer.playerId);
      if (!player) {
        return { success: false, error: 'O atleta referente à proposta não foi encontrado.' };
      }

      const nowIso = new Date().toISOString();
      const todayDate = nowIso.split('T')[0];
      const transferFee =
        ((offer.status as string) === 'NEGOCIAÇÃO' || (offer.status as string) === 'NEGOTIATION') &&
        offer.counterOfferAmount
          ? offer.counterOfferAmount
          : (offer.amount || offer.proposedFee || 0);

      // 4. IDEMPOTÊNCIA - Caso A: Proposta já marcada como COMPLETED ou ACCEPTED
      if (offer.status === 'COMPLETED' || offer.status === 'ACCEPTED') {
        // Garantir integridade do vínculo do atleta com o clube comprador
        if (player.clubId !== buyerClub.id) {
          player.clubId = buyerClub.id;
          player.clubName = buyerClub.name;
          await jogadoresService.save(player);
        }
        return { success: true, alreadyProcessed: true };
      }

      // Propostas canceladas ou rejeitadas não podem ser aceitas
      if (offer.status === 'REJECTED' || offer.status === 'CANCELLED') {
        return {
          success: false,
          error: `Esta proposta não pode ser aceita pois já foi cancelada ou rejeitada (status: ${offer.status}).`,
        };
      }

      // 5. IDEMPOTÊNCIA - Caso B: Transferência já registrada no histórico oficial ou atleta já no comprador
      const existingTransfers = await transferenciasService.getAll();
      const alreadyTransferred = existingTransfers.some(
        (t) =>
          (Boolean(t.offerId) && t.offerId === offer.id) ||
          (t.playerId === player.id && t.toClubId === buyerClub.id && t.fromClubId === sellerClub.id)
      );

      if (alreadyTransferred || player.clubId === buyerClub.id) {
        // A transferência e movimentação financeira já ocorreram anteriormente!
        // Sincronizar apenas o status da proposta para COMPLETED e salvar sem duplicar transações
        offer.status = 'COMPLETED';
        offer.updatedAt = nowIso;
        dataStore.updateTransferOffer(offer.id, {
          status: 'COMPLETED',
          updatedAt: nowIso,
        });
        dataStore.saveTransferOffer(offer);

        if (isFirebaseConfigured() && firestoreDb) {
          try {
            const offerRef = doc(firestoreDb, 'transferOffers', offer.id);
            await updateDoc(offerRef, { status: 'COMPLETED', updatedAt: nowIso });
          } catch (e) {
            console.warn('Erro ao atualizar status da proposta no Firestore:', e);
          }
        }

        if (player.clubId !== buyerClub.id) {
          player.clubId = buyerClub.id;
          player.clubName = buyerClub.name;
          await jogadoresService.save(player);
        }

        return { success: true, alreadyProcessed: true };
      }

      // 6. Integridade: verificar se o atleta ainda pertence ao clube vendedor
      if (player.clubId !== sellerClub.id) {
        return {
          success: false,
          error: `Transferência cancelada: o atleta ${player.name} já não pertence mais ao ${sellerClub.name} (atualmente no ${player.clubName}).`,
        };
      }

      // 7. Integridade financeira: verificar saldo e orçamento do comprador
      if (transferFee <= 0) {
        return { success: false, error: 'Valor da proposta de transferência inválido.' };
      }
      if ((buyerClub.transferBudget || 0) < transferFee) {
        return {
          success: false,
          error: `O ${buyerClub.name} não possui orçamento de transferências suficiente (necessário ${formatCurrencyBRL(transferFee, { compact: true })}, disponível: ${formatCurrencyBRL(buyerClub.transferBudget || 0, { compact: true })}).`,
        };
      }
      if ((buyerClub.balance || 0) < transferFee) {
        return {
          success: false,
          error: `O ${buyerClub.name} não possui saldo em caixa suficiente (necessário ${formatCurrencyBRL(transferFee, { compact: true })}, disponível: ${formatCurrencyBRL(buyerClub.balance || 0, { compact: true })}).`,
        };
      }

      // 8. Transação Firestore quando Firebase estiver configurado
      if (isFirebaseConfigured() && firestoreDb) {
        try {
          await runTransaction(firestoreDb, async (transaction) => {
            const offerRef = doc(firestoreDb, 'transferOffers', offer.id);
            const playerRef = doc(firestoreDb, 'jogadores', player.id);
            const buyerRef = doc(firestoreDb, 'clubes', buyerClub.id);
            const sellerRef = doc(firestoreDb, 'clubes', sellerClub.id);

            const txOfferSnap = await transaction.get(offerRef);
            if (!txOfferSnap.exists() || txOfferSnap.data().status !== 'PENDING') {
              throw new Error('Proposta não está mais pendente.');
            }

            const txPlayerSnap = await transaction.get(playerRef);
            if (!txPlayerSnap.exists() || txPlayerSnap.data().clubId !== sellerClub.id) {
              throw new Error('Jogador não pertence mais ao clube vendedor.');
            }

            const txBuyerSnap = await transaction.get(buyerRef);
            if (!txBuyerSnap.exists()) {
              throw new Error('Clube comprador não encontrado.');
            }
            const buyerData = txBuyerSnap.data();
            if ((buyerData.transferBudget || 0) < transferFee) {
              throw new Error('Saldo insuficiente do comprador na transação.');
            }

            // Atualizações atômicas
            transaction.update(offerRef, {
              status: 'COMPLETED',
              updatedAt: nowIso,
            });

            transaction.update(playerRef, {
              clubId: buyerClub.id,
              clubName: buyerClub.name,
            });

            transaction.update(buyerRef, {
              transferBudget: (buyerData.transferBudget || 0) - transferFee,
              balance: (buyerData.balance || 0) - transferFee,
            });

            const txSellerSnap = await transaction.get(sellerRef);
            const sellerData = txSellerSnap.exists() ? txSellerSnap.data() : {};
            transaction.update(sellerRef, {
              transferBudget: (sellerData.transferBudget || 0) + transferFee,
              balance: (sellerData.balance || 0) + transferFee,
            });
          });
        } catch (err: unknown) {
          console.warn('Transação Firestore falhou ou está offline. Prosseguindo com sincronização local.', err);
        }
      }

      // 9. Atualização de estado local consistente e atômica
      // 9.1 Débito do comprador
      buyerClub.transferBudget = Math.max(0, (buyerClub.transferBudget || 0) - transferFee);
      buyerClub.balance = (buyerClub.balance || 0) - transferFee;
      await clubesService.save(buyerClub);

      // 9.2 Crédito do vendedor
      sellerClub.transferBudget = (sellerClub.transferBudget || 0) + transferFee;
      sellerClub.balance = (sellerClub.balance || 0) + transferFee;
      await clubesService.save(sellerClub);

      // 9.3 Transferência do vínculo do atleta
      player.clubId = buyerClub.id;
      player.clubName = buyerClub.name;
      await jogadoresService.save(player);

      // 9.4 Atualização da proposta
      offer.status = 'COMPLETED';
      offer.amount = transferFee;
      offer.updatedAt = nowIso;
      dataStore.updateTransferOffer(offer.id, {
        status: 'COMPLETED',
        amount: transferFee,
        updatedAt: nowIso,
      });
      dataStore.saveTransferOffer(offer);

      if (isFirebaseConfigured() && firestoreDb) {
        try {
          const offerRef = doc(firestoreDb, 'transferOffers', offer.id);
          await updateDoc(offerRef, { status: 'COMPLETED', amount: transferFee, updatedAt: nowIso });
        } catch (e) {
          console.warn('Erro ao atualizar proposta no Firestore:', e);
        }
      }

      // 9.5 Registrar histórico oficial de transferências exatamente uma vez
      const completedTransfer: Transfer = {
        id: `tr-${Date.now()}`,
        playerId: player.id,
        playerName: player.name,
        playerAge: player.age,
        playerPosition: player.position,
        fromClubId: sellerClub.id,
        fromClubName: sellerClub.name,
        toClubId: buyerClub.id,
        toClubName: buyerClub.name,
        fee: transferFee,
        amount: transferFee,
        offerId: offer.id,
        date: todayDate,
        season: '2025/2026',
        type: 'TRANSFER',
        status: 'COMPLETED',
        createdAt: nowIso,
      };
      await transferenciasService.add(completedTransfer);

      // 9.6 Registrar notícia na imprensa do FM Universe exatamente uma vez
      const newsItem: News = {
        id: `news-${Date.now()}`,
        title: `${player.name} é o novo reforço do ${buyerClub.name}!`,
        summary: `Transferência confirmada no valor de ${formatCurrencyBRL(transferFee, { compact: true })}. Atleta deixa o ${sellerClub.name}.`,
        content: `Em negociação direta concluída nesta data, o ${buyerClub.name} acertou a aquisição definitiva do atleta ${player.name} junto ao ${sellerClub.name}. A operação movimentou ${formatCurrencyBRL(transferFee, { compact: true })} e o atleta já se apresenta à nova comissão técnica.`,
        category: 'TRANSFERENCIAS',
        clubId: buyerClub.id,
        date: todayDate,
        author: 'Central do Mercado FM',
        readTimeMinutes: 2,
      };
      dataStore.addNews(newsItem);

      // 9.7 Registrar lançamentos contábeis em Finanças
      const buyerRecord: FinanceRecord = {
        id: `fin-b-${Date.now()}`,
        date: todayDate,
        type: 'EXPENSE',
        category: 'TRANSFER_FEE',
        description: `Contratação de ${player.name} (${sellerClub.name})`,
        amount: transferFee,
      };
      const sellerRecord: FinanceRecord = {
        id: `fin-s-${Date.now()}`,
        date: todayDate,
        type: 'INCOME',
        category: 'TRANSFER_FEE',
        description: `Venda de ${player.name} (${buyerClub.name})`,
        amount: transferFee,
      };
      dataStore.addFinanceRecord(buyerRecord);
      dataStore.addFinanceRecord(sellerRecord);

      // 9.8 Notificações oficiais para ambos os clubes
      await notificacoesService.create({
        type: 'TRANSFER_OFFER_ACCEPTED',
        clubId: buyerClub.id,
        offerId: offer.id,
        title: `Proposta aceita: ${player.name}`,
        message: `O ${sellerClub.name} aceitou sua proposta de ${formatCurrencyBRL(transferFee, { compact: true })} por ${player.name}. O atleta agora faz parte do seu elenco!`,
      });

      await notificacoesService.create({
        type: 'TRANSFER_OFFER_ACCEPTED',
        clubId: sellerClub.id,
        offerId: offer.id,
        title: `Transferência concluída: ${player.name}`,
        message: `Você aceitou a proposta do ${buyerClub.name} por ${player.name}. ${formatCurrencyBRL(transferFee, { compact: true })} foram creditados aos cofres do clube.`,
      });

      return { success: true };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao processar aceite da proposta.';
      return { success: false, error: msg };
    } finally {
      activeProcessingOffers.delete(offerId);
    }
  },

  /**
   * Registra uma contraproposta oficial:
   * 1. NÃO conclui a transferência.
   * 2. NÃO movimenta dinheiro (saldo/orçamento intactos).
   * 3. Altera o status da proposta para "NEGOCIAÇÃO".
   * 4. Registra o valor da contraproposta (counterOfferAmount).
   * 5. O clube que fez a proposta deve conseguir visualizar a contraproposta em "Propostas Enviadas".
   * 6. O clube comprador poderá responder com: Aceitar, Negociar novamente, Recusar.
   */
  async negotiateOffer(params: {
    offerId: string;
    counterOfferAmount: number;
    proposedBy: 'SELLER' | 'BUYER';
    note?: string;
  }): Promise<{ success: boolean; error?: string; offer?: TransferOffer }> {
    const { offerId, counterOfferAmount, proposedBy, note } = params;

    if (activeProcessingOffers.has(offerId)) {
      return { success: false, error: 'Esta proposta já está sendo processada no momento.' };
    }

    if (!counterOfferAmount || counterOfferAmount <= 0 || isNaN(counterOfferAmount)) {
      return { success: false, error: 'O valor da contraproposta deve ser maior que zero.' };
    }

    activeProcessingOffers.add(offerId);

    try {
      const offer = await this.getOfferById(offerId);
      if (!offer) {
        return { success: false, error: 'Proposta não encontrada.' };
      }

      if (
        offer.status !== 'PENDING' &&
        (offer.status as string) !== 'NEGOCIAÇÃO' &&
        (offer.status as string) !== 'NEGOTIATION'
      ) {
        return {
          success: false,
          error: `Não é possível negociar uma proposta já finalizada (status: ${offer.status}).`,
        };
      }

      // Se for o comprador negociando novamente, validar orçamento
      if (proposedBy === 'BUYER') {
        const buyer = await clubesService.getById(offer.buyerClubId);
        if (buyer && (counterOfferAmount > buyer.transferBudget || counterOfferAmount > buyer.balance)) {
          return {
            success: false,
            error: `Orçamento insuficiente! Seu limite é de ${formatCurrencyBRL(buyer.transferBudget, { compact: true })}.`,
          };
        }
      }

      const nowIso = new Date().toISOString();
      const roundedAmount = Math.round(counterOfferAmount);

      const updates: Partial<TransferOffer> = {
        status: 'NEGOCIAÇÃO',
        counterOfferAmount: roundedAmount,
        lastOfferBy: proposedBy,
        updatedAt: nowIso,
        responseNote:
          note ||
          (proposedBy === 'SELLER'
            ? `Contraproposta do vendedor: ${formatCurrencyBRL(roundedAmount, { compact: true })}`
            : `Nova contraproposta do comprador: ${formatCurrencyBRL(roundedAmount, { compact: true })}`),
      };

      // 1. Atualizar no dataStore local de forma atômica
      dataStore.updateTransferOffer(offer.id, updates);
      const updatedOffer: TransferOffer = {
        ...offer,
        ...updates,
      };
      dataStore.saveTransferOffer(updatedOffer);

      // 2. Persistência no Firestore se configurado
      if (isFirebaseConfigured() && firestoreDb) {
        try {
          const docRef = doc(firestoreDb, 'transferOffers', offer.id);
          await updateDoc(docRef, updates);
        } catch (err) {
          console.warn('⚠️ Falha ao salvar contraproposta no Firestore. Salva em storage local.', err);
        }
      }

      // 3. Notificação oficial para a outra parte
      const targetClubId = proposedBy === 'SELLER' ? offer.buyerClubId : offer.sellerClubId;
      const originClubName = proposedBy === 'SELLER' ? offer.sellerClubName : offer.buyerClubName;

      await notificacoesService.create({
        type: 'TRANSFER_OFFER_RECEIVED',
        clubId: targetClubId,
        offerId: offer.id,
        title: `Contraproposta por ${offer.playerName}`,
        message: `O ${originClubName} enviou uma contraproposta oficial de ${formatCurrencyBRL(roundedAmount, { compact: true })} por ${offer.playerName}.`,
      });

      return { success: true, offer: updatedOffer };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao registrar contraproposta.';
      return { success: false, error: msg };
    } finally {
      activeProcessingOffers.delete(offerId);
    }
  },

  /**
   * Recusa uma proposta de transferência:
   * 1. Verifica se está pendente ou em negociação.
   * 2. Atualiza o status para REJECTED.
   * 3. Cria notificação para o clube interessado.
   * 4. Nenhum dinheiro é movimentado e o atleta permanece no clube vendedor.
   */
  async rejectOffer(offerId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    if (activeProcessingOffers.has(offerId)) {
      return { success: false, error: 'Esta proposta já está sendo processada no momento.' };
    }

    activeProcessingOffers.add(offerId);

    try {
      const offer = await this.getOfferById(offerId);
      if (!offer) {
        return { success: false, error: 'Proposta não encontrada.' };
      }

      if (
        offer.status !== 'PENDING' &&
        (offer.status as string) !== 'NEGOCIAÇÃO' &&
        (offer.status as string) !== 'NEGOTIATION'
      ) {
        return {
          success: false,
          error: `Esta proposta já foi finalizada anteriormente (status: ${offer.status}).`,
        };
      }

      const nowIso = new Date().toISOString();

      // Atualização no dataStore local
      dataStore.updateTransferOffer(offer.id, {
        status: 'REJECTED',
        updatedAt: nowIso,
        responseNote: reason || 'Proposta recusada pela diretoria.',
      });

      // Atualização no Firestore se configurado
      if (isFirebaseConfigured() && firestoreDb) {
        try {
          const docRef = doc(firestoreDb, 'transferOffers', offer.id);
          await updateDoc(docRef, {
            status: 'REJECTED',
            updatedAt: nowIso,
            responseNote: reason || 'Proposta recusada pela diretoria.',
          });
        } catch (err) {
          console.warn('Erro ao atualizar rejeição no Firestore:', err);
        }
      }

      // Notificação para o clube comprador
      const rejectedFee = offer.counterOfferAmount || offer.amount;
      await notificacoesService.create({
        type: 'TRANSFER_OFFER_REJECTED',
        clubId: offer.buyerClubId,
        offerId: offer.id,
        title: `Proposta recusada: ${offer.playerName}`,
        message: `A negociação oficial por ${offer.playerName} (${formatCurrencyBRL(rejectedFee, { compact: true })}) foi recusada e encerrada.`,
      });

      return { success: true };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao recusar proposta.';
      return { success: false, error: msg };
    } finally {
      activeProcessingOffers.delete(offerId);
    }
  },

  /**
   * Cancela uma proposta de transferência enviada (pelo comprador).
   */
  async cancelOffer(offerId: string): Promise<{ success: boolean; error?: string }> {
    const offer = await this.getOfferById(offerId);
    if (!offer) {
      return { success: false, error: 'Proposta não encontrada.' };
    }

    if (offer.status !== 'PENDING') {
      return { success: false, error: 'Apenas propostas pendentes podem ser canceladas.' };
    }

    const nowIso = new Date().toISOString();
    dataStore.updateTransferOffer(offer.id, {
      status: 'CANCELLED',
      updatedAt: nowIso,
    });

    if (isFirebaseConfigured() && firestoreDb) {
      try {
        const docRef = doc(firestoreDb, 'transferOffers', offer.id);
        await updateDoc(docRef, { status: 'CANCELLED', updatedAt: nowIso });
      } catch (err) {
        console.warn('Erro ao cancelar proposta no Firestore:', err);
      }
    }

    return { success: true };
  },
};
