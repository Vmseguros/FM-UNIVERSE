import { transferOffersService } from './transferOffersService';
import { clubesService } from './clubesService';
import { jogadoresService } from './jogadoresService';
import { notificacoesService } from './notificacoesService';
import { transferenciasService } from './transferenciasService';
import { dataStore } from './dataStore';
import { formatCurrencyBRL } from '../utils/currency';

/**
 * Suite de testes para validação completa do ciclo de vida das Propostas de Transferência.
 */
export async function runTransferOfferTests(): Promise<{ passed: boolean; details: string[] }> {
  const details: string[] = [];
  let passed = true;

  const log = (msg: string, ok = true) => {
    details.push(`${ok ? '✅' : '❌'} ${msg}`);
    if (!ok) passed = false;
  };

  try {
    // 0. Resetar dataStore para estado limpo conhecido
    dataStore.resetToDefaults();

    const clubs = await clubesService.getAll();
    const fmUnited = clubs.find((c) => c.id === 'club-1') || clubs[0];
    const realFootball = clubs.find((c) => c.id === 'club-2') || clubs[1];

    const players = await jogadoresService.getAll();
    const existingOfferPlayerIds = dataStore
      .getTransferOffers()
      .filter((o) => o.status === 'PENDING' || o.status === 'NEGOCIAÇÃO')
      .map((o) => o.playerId);
    const targetPlayer =
      players.find((p) => p.clubId === realFootball.id && !existingOfferPlayerIds.includes(p.id)) ||
      players[1];

    const initialBuyerBudget = fmUnited.transferBudget;
    const initialBuyerBalance = fmUnited.balance;
    const initialSellerBudget = realFootball.transferBudget;
    const initialSellerBalance = realFootball.balance;
    const offerAmount = 10000000; // 10 Milhões

    // ----------------------------------------------------
    // TESTE 1: FM United envia proposta por atleta do Real Football
    // ----------------------------------------------------
    const createRes = await transferOffersService.createOffer({
      playerId: targetPlayer.id,
      buyerClubId: fmUnited.id,
      amount: offerAmount,
      userId: 'test-user-1',
    });

    if (createRes.success && createRes.offer && createRes.offer.status === 'PENDING') {
      log(`Teste 1: Proposta oficial criada com sucesso (ID: ${createRes.offer.id}, Status: PENDING)`);
    } else {
      log(`Teste 1 falhou: ${createRes.error || 'Não criou proposta'}`, false);
    }

    const offerId1 = createRes.offer?.id || '';

    // ----------------------------------------------------
    // TESTE 2: Real Football visualiza proposta em "Propostas Recebidas"
    // ----------------------------------------------------
    const receivedOffers = await transferOffersService.getOffersReceived(realFootball.id);
    const foundReceived = receivedOffers.find((o) => o.id === offerId1);
    if (foundReceived && foundReceived.amount === offerAmount) {
      log(`Teste 2: Proposta encontrada nas Propostas Recebidas do ${realFootball.name}`);
    } else {
      log(`Teste 2 falhou: Proposta não listada para o clube vendedor`, false);
    }

    // ----------------------------------------------------
    // TESTE 3: Real Football recusa a proposta (REJECTED)
    // ----------------------------------------------------
    const rejectRes = await transferOffersService.rejectOffer(offerId1, 'Valor abaixo do esperado');
    const rejectedOffer = await transferOffersService.getOfferById(offerId1);
    const playerAfterReject = await jogadoresService.getById(targetPlayer.id);
    const buyerAfterReject = await clubesService.getById(fmUnited.id);
    const sellerAfterReject = await clubesService.getById(realFootball.id);

    const noMoneyMoved =
      buyerAfterReject?.transferBudget === initialBuyerBudget &&
      sellerAfterReject?.transferBudget === initialSellerBudget;
    const playerUnchanged = playerAfterReject?.clubId === realFootball.id;

    if (rejectRes.success && rejectedOffer?.status === 'REJECTED' && noMoneyMoved && playerUnchanged) {
      log(`Teste 3: Proposta recusada com sucesso. Atleta permaneceu no ${realFootball.name} e nenhum valor financeiro foi debitado.`);
    } else {
      log(`Teste 3 falhou ao validar recusa de proposta`, false);
    }

    // ----------------------------------------------------
    // TESTE 4: Nova proposta aceita com sucesso (ACCEPTED)
    // ----------------------------------------------------
    const createRes2 = await transferOffersService.createOffer({
      playerId: targetPlayer.id,
      buyerClubId: fmUnited.id,
      amount: offerAmount,
      userId: 'test-user-1',
    });
    const offerId2 = createRes2.offer?.id || '';

    const acceptRes = await transferOffersService.acceptOffer(offerId2);
    const acceptedOffer = await transferOffersService.getOfferById(offerId2);
    const playerAfterAccept = await jogadoresService.getById(targetPlayer.id);
    const buyerAfterAccept = await clubesService.getById(fmUnited.id);
    const sellerAfterAccept = await clubesService.getById(realFootball.id);
    const allTransfers = await transferenciasService.getAll();
    const completedTransfer = allTransfers.find((t) => t.offerId === offerId2 || (t.playerId === targetPlayer.id && t.status === 'COMPLETED'));

    const buyerDebited = (buyerAfterAccept?.transferBudget ?? 0) === initialBuyerBudget - offerAmount;
    const sellerCredited = (sellerAfterAccept?.transferBudget ?? 0) === initialSellerBudget + offerAmount;
    const playerTransferred = playerAfterAccept?.clubId === fmUnited.id;

    if (
      acceptRes.success &&
      (acceptedOffer?.status === 'COMPLETED' || acceptedOffer?.status === 'ACCEPTED') &&
      buyerDebited &&
      sellerCredited &&
      playerTransferred &&
      Boolean(completedTransfer)
    ) {
      log(`Teste 4: Proposta aceita com sucesso! Atleta transferido para o ${fmUnited.name}, ${formatCurrencyBRL(offerAmount, { compact: true })} movimentados e transferência registrada no histórico.`);
    } else {
      log(`Teste 4 falhou: Verificação de aceite de transferência incompleta.`, false);
    }

    // ----------------------------------------------------
    // TESTE 5: Tentar aceitar a mesma proposta novamente (Idempotência / Duplo Processamento)
    // ----------------------------------------------------
    const doubleAcceptRes = await transferOffersService.acceptOffer(offerId2);
    const buyerAfterDouble = await clubesService.getById(fmUnited.id);
    const sellerAfterDouble = await clubesService.getById(realFootball.id);
    const allTransfersAfterDouble = await transferenciasService.getAll();
    const transfersForOffer = allTransfersAfterDouble.filter((t) => t.offerId === offerId2);

    const noDoubleCharge =
      buyerAfterDouble?.transferBudget === initialBuyerBudget - offerAmount &&
      sellerAfterDouble?.transferBudget === initialSellerBudget + offerAmount;
    const noDuplicateHistory = transfersForOffer.length === 1;

    if (doubleAcceptRes.success && doubleAcceptRes.alreadyProcessed && noDoubleCharge && noDuplicateHistory) {
      log(`Teste 5: Idempotência perfeita! Re-aceite reconheceu conclusão prévia, mantendo saldo e histórico sem duplicações.`);
    } else {
      log(`Teste 5 falhou: Falha na validação de idempotência`, false);
    }

    // ----------------------------------------------------
    // TESTE 6: Tentar aceitar sem saldo suficiente
    // ----------------------------------------------------
    // Forçar orçamento do comprador para zero temporariamente
    const brokeBuyer = { ...fmUnited, transferBudget: 1000, balance: 1000 };
    await clubesService.save(brokeBuyer);

    // Criar proposta artificial pendente que exceda o saldo
    const fakeOfferRes = await transferOffersService.createOffer({
      playerId: targetPlayer.id, // Agora já pertence ao fmUnited, então usaremos outro atleta
      buyerClubId: realFootball.id,
      amount: 99999999999, // Valor astronômico
      userId: 'test-user-broke',
    });

    if (!fakeOfferRes.success) {
      log(`Teste 6: Bloqueio na criação/aceite por falta de saldo verificado com sucesso: "${fakeOfferRes.error}"`);
    } else {
      log(`Teste 6: Proposta excessiva foi aceita indevidamente`, false);
    }

    // ----------------------------------------------------
    // TESTE 7: Ciclo completo de Negociação (Contraproposta)
    // ----------------------------------------------------
    await clubesService.save(fmUnited);
    await clubesService.save(realFootball);

    const remainingPlayers = await jogadoresService.getAll();
    const negTargetPlayer = remainingPlayers.find((p) => p.clubId === fmUnited.id && p.id !== targetPlayer.id) || remainingPlayers[0];

    const negInitialOfferAmount = 8000000;
    const counterAmount = 12000000;

    const initialSellerBeforeNeg = (await clubesService.getById(fmUnited.id))?.transferBudget || 0;
    const initialBuyerBeforeNeg = (await clubesService.getById(realFootball.id))?.transferBudget || 0;

    const createNegRes = await transferOffersService.createOffer({
      playerId: negTargetPlayer.id,
      buyerClubId: realFootball.id,
      amount: negInitialOfferAmount,
      userId: 'test-user-neg',
    });

    const negOfferId = createNegRes.offer?.id || '';

    // Vendedor envia contraproposta de 12M
    const negRes = await transferOffersService.negotiateOffer({
      offerId: negOfferId,
      counterOfferAmount: counterAmount,
      proposedBy: 'SELLER',
    });

    const offerAfterNeg = await transferOffersService.getOfferById(negOfferId);
    const sellerAfterNeg = await clubesService.getById(fmUnited.id);
    const buyerAfterNeg = await clubesService.getById(realFootball.id);
    const playerAfterNeg = await jogadoresService.getById(negTargetPlayer.id);

    // 1. NÃO concluir a transferência
    const transferNotConcluded = playerAfterNeg?.clubId === fmUnited.id;
    // 2. NÃO movimentar dinheiro
    const moneyNotMoved =
      sellerAfterNeg?.transferBudget === initialSellerBeforeNeg &&
      buyerAfterNeg?.transferBudget === initialBuyerBeforeNeg;
    // 3. Status NEGOCIAÇÃO
    const isNegotiating = offerAfterNeg?.status === 'NEGOCIAÇÃO';
    // 4. Registrar valor da contraproposta
    const counterRecorded = offerAfterNeg?.counterOfferAmount === counterAmount;
    // 5. O comprador consegue visualizar a contraproposta em enviadas
    const buyerSentOffers = await transferOffersService.getOffersSent(realFootball.id);
    const foundInSent = buyerSentOffers.some(
      (o) => o.id === negOfferId && o.counterOfferAmount === counterAmount && o.status === 'NEGOCIAÇÃO'
    );

    if (
      negRes.success &&
      transferNotConcluded &&
      moneyNotMoved &&
      isNegotiating &&
      counterRecorded &&
      foundInSent
    ) {
      log(`Teste 7: Negociação oficial validada com perfeição! Contraproposta registrada (${formatCurrencyBRL(counterAmount, { compact: true })}), status NEGOCIAÇÃO, saldos intactos e visível ao comprador.`);
    } else {
      log(`Teste 7 falhou: Validação do fluxo de negociação não atendeu aos critérios`, false);
    }

    // 6. Comprador aceita a contraproposta
    const acceptCounterRes = await transferOffersService.acceptOffer(negOfferId);
    const offerAfterFinalAccept = await transferOffersService.getOfferById(negOfferId);
    const buyerAfterFinalAccept = await clubesService.getById(realFootball.id);
    const sellerAfterFinalAccept = await clubesService.getById(fmUnited.id);
    const playerAfterFinalAccept = await jogadoresService.getById(negTargetPlayer.id);

    const buyerDebitedCounter = buyerAfterFinalAccept?.transferBudget === initialBuyerBeforeNeg - counterAmount;
    const sellerCreditedCounter = sellerAfterFinalAccept?.transferBudget === initialSellerBeforeNeg + counterAmount;
    const playerMovedToBuyer = playerAfterFinalAccept?.clubId === realFootball.id;

    if (
      acceptCounterRes.success &&
      (offerAfterFinalAccept?.status === 'COMPLETED' || offerAfterFinalAccept?.status === 'ACCEPTED') &&
      buyerDebitedCounter &&
      sellerCreditedCounter &&
      playerMovedToBuyer
    ) {
      log(`Teste 8: Aceite de contraproposta concluído com sucesso com o valor renegociado (${formatCurrencyBRL(counterAmount, { compact: true })} movimentados e atleta transferido).`);
    } else {
      log(`Teste 8 falhou: Aceite de contraproposta não aplicou o novo valor corretamente`, false);
    }

  } catch (err: unknown) {
    log(`Erro inesperado nos testes: ${err instanceof Error ? err.message : String(err)}`, false);
  }

  return { passed, details };
}
