import { estadioService, UPGRADE_COSTS } from './estadioService';
import { clubesService } from './clubesService';
import { dataStore } from './dataStore';
import { Club } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[FALHA NO TESTE]: ${message}`);
  }
}

export async function runEstadioServiceTests(): Promise<{ passed: boolean; details: string[] }> {
  const details: string[] = [];
  let passed = true;

  const log = (msg: string, ok = true) => {
    details.push(`${ok ? '✅' : '❌'} ${msg}`);
    console.log(`${ok ? '✅' : '❌'} ${msg}`);
    if (!ok) passed = false;
  };

  console.log('\n======================================================');
  console.log('🏟️ INICIANDO SUITE DE TESTES: EXPANSÃO DE ESTÁDIO/BASE');
  console.log('======================================================\n');

  try {
    // ----------------------------------------------------
    // TESTE 1: Saldo Insuficiente - Bloqueio absoluto
    // Caso real: Thales FC com R$ 4.960.000 tentando expansão de R$ 6.000.000
    // ----------------------------------------------------
    const brokeClubId = 'test-club-broke';
    const brokeClub: Club = {
      id: brokeClubId,
      name: 'Broke FC Test',
      slug: 'broke-fc-test',
      shortName: 'BFC',
      code: 'BFC',
      badge: '🛡️',
      stadiumId: 'stad-broke',
      stadiumName: 'Estádio Teste',
      capacity: 60000,
      reputation: 3,
      transferBudget: 4960000,
      wageBudget: 1000000,
      balance: 4960000, // R$ 4.960.000 (< R$ 6.000.000)
      youthLevel: 4,
      managerName: 'Teste Manager',
      squadCount: 20,
      fansCount: 15000,
      primaryColor: '#000000',
      secondaryColor: '#ffffff',
      boardExpectation: 'Manter divisão',
      seasonTarget: 'Manutenção',
      trophiesCount: 0,
      foundedYear: 2026,
    };
    await clubesService.save(brokeClub);

    const initialFinanceCount = dataStore.getFinancesByClubId(brokeClubId).length;
    const resBroke = await estadioService.upgradeYouthFacility(brokeClubId);

    const brokeClubAfter = await clubesService.getById(brokeClubId);

    assert(!resBroke.success, 'Operação com saldo insuficiente deveria ter retornado success: false');
    assert(
      resBroke.error?.includes('Saldo insuficiente') === true,
      `Mensagem de erro esperada não encontrada. Retorno: ${resBroke.error}`
    );
    assert(
      brokeClubAfter?.balance === 4960000,
      `Saldo foi alterado indevidamente! Esperado: 4960000, Atual: ${brokeClubAfter?.balance}`
    );
    assert(
      brokeClubAfter?.youthLevel === 4,
      `Nível da base foi alterado indevidamente! Esperado: 4, Atual: ${brokeClubAfter?.youthLevel}`
    );
    const financeCountAfterBroke = dataStore.getFinancesByClubId(brokeClubId).length;
    assert(
      financeCountAfterBroke === initialFinanceCount,
      'Nenhum lançamento financeiro deve ser gerado quando o saldo é insuficiente.'
    );

    log('Teste 1: Saldo insuficiente bloqueou a expansão sem alterar absolutamente nenhum dado', true);

    // ----------------------------------------------------
    // TESTE 2: Saldo Suficiente - Débito exato e expansão
    // Clube com R$ 10.000.000 tentando expansão de R$ 6.000.000
    // ----------------------------------------------------
    const richClubId = 'test-club-rich';
    const richClub: Club = {
      id: richClubId,
      name: 'Rich FC Test',
      slug: 'rich-fc-test',
      shortName: 'RFC',
      code: 'RFC',
      badge: '💎',
      stadiumId: 'stad-rich',
      stadiumName: 'Arena Milionária',
      capacity: 60000,
      reputation: 4,
      transferBudget: 10000000,
      wageBudget: 2000000,
      balance: 10000000, // R$ 10.000.000 (>= R$ 6.000.000)
      youthLevel: 4,
      managerName: 'Rich Manager',
      squadCount: 22,
      fansCount: 30000,
      primaryColor: '#10b981',
      secondaryColor: '#059669',
      boardExpectation: 'Título',
      seasonTarget: 'Campeão',
      trophiesCount: 5,
      foundedYear: 2026,
    };
    await clubesService.save(richClub);

    const resRich = await estadioService.upgradeYouthFacility(richClubId);
    assert(resRich.success, `Falha na expansão de clube com saldo suficiente: ${resRich.error}`);

    const richClubAfter = await clubesService.getById(richClubId);
    const expectedBalance = 10000000 - UPGRADE_COSTS.YOUTH; // 4.000.000

    assert(
      richClubAfter?.balance === expectedBalance,
      `Saldo não foi debitado corretamente! Esperado: ${expectedBalance}, Atual: ${richClubAfter?.balance}`
    );
    assert(
      richClubAfter?.youthLevel === 5,
      `Nível da base não aumentou! Esperado: 5, Atual: ${richClubAfter?.youthLevel}`
    );

    log('Teste 2: Saldo suficiente descontou exatamente R$ 6.000.000 e elevou o nível para 5/5', true);

    // ----------------------------------------------------
    // TESTE 3: Persistência e Lançamento Financeiro / Auditoria
    // ----------------------------------------------------
    const finances = dataStore.getFinancesByClubId(richClubId);
    assert(finances.length > 0, 'Lançamento financeiro não foi registrado no dataStore');
    const infraRecord = finances.find((f) => f.category === 'INFRAESTRUTURA');
    assert(Boolean(infraRecord), 'Registro com categoria INFRAESTRUTURA não encontrado');
    assert(
      infraRecord?.amount === UPGRADE_COSTS.YOUTH,
      `Valor do lançamento financeiro incorreto: ${infraRecord?.amount}`
    );
    assert(
      infraRecord?.type === 'EXPENSE',
      `Tipo do lançamento financeiro deveria ser EXPENSE: ${infraRecord?.type}`
    );

    assert(Boolean(richClubAfter?.lastAudit), 'Objeto de auditoria lastAudit não foi gravado no clube');
    assert(
      richClubAfter?.lastAudit?.previousBalance === 10000000,
      `Auditoria previousBalance incorreto: ${richClubAfter?.lastAudit?.previousBalance}`
    );
    assert(
      richClubAfter?.lastAudit?.newBalance === expectedBalance,
      `Auditoria newBalance incorreto: ${richClubAfter?.lastAudit?.newBalance}`
    );

    log('Teste 3: Lançamento financeiro contábil e auditoria persistidos com integridade', true);

    // ----------------------------------------------------
    // TESTE 4: Duplo Clique / Concorrência
    // Disparar duas requisições simultâneas para o mesmo clube
    // Clube possui saldo para apenas 1 expansão (R$ 8.000.000)
    // ----------------------------------------------------
    const raceClubId = 'test-club-race';
    const raceClub: Club = {
      id: raceClubId,
      name: 'Race Club Test',
      slug: 'race-club-test',
      shortName: 'RCT',
      code: 'RCT',
      badge: '⚡',
      stadiumId: 'stad-race',
      stadiumName: 'Autódromo Arena',
      capacity: 50000,
      reputation: 3,
      transferBudget: 8000000,
      wageBudget: 1500000,
      balance: 8000000, // R$ 8.000.000 (dá para 1 de 6M, mas NÃO dá para 2 de 6M)
      youthLevel: 3,
      managerName: 'Speedy',
      squadCount: 20,
      fansCount: 20000,
      primaryColor: '#ef4444',
      secondaryColor: '#991b1b',
      boardExpectation: 'Meio de tabela',
      seasonTarget: 'Meio de tabela',
      trophiesCount: 1,
      foundedYear: 2026,
    };
    await clubesService.save(raceClub);

    // Dispara duas chamadas simultaneamente
    const [resRace1, resRace2] = await Promise.all([
      estadioService.upgradeYouthFacility(raceClubId),
      estadioService.upgradeYouthFacility(raceClubId),
    ]);

    const raceClubAfter = await clubesService.getById(raceClubId);

    // Exatamente uma chamada deve ter tido sucesso e a outra deve ter sido rejeitada
    const successes = [resRace1.success, resRace2.success].filter(Boolean).length;
    assert(
      successes === 1,
      `Falha na proteção contra duplo clique! Número de sucessos simultâneos: ${successes} (esperado: exatamente 1)`
    );

    assert(
      raceClubAfter?.balance === 2000000, // 8.000.000 - 6.000.000 = 2.000.000
      `Saldo resultante do teste de concorrência incorreto! Esperado: 2000000, Atual: ${raceClubAfter?.balance}`
    );
    assert(
      raceClubAfter?.youthLevel === 4, // 3 + 1 = 4 (e não 3 + 2)
      `Nível resultante do teste de concorrência incorreto! Esperado: 4, Atual: ${raceClubAfter?.youthLevel}`
    );

    log('Teste 4: Duplo clique simultâneo protegido - exatamente 1 operação aceita e sem débito duplo', true);

    // ----------------------------------------------------
    // TESTE 5: Tentativa de ultrapassar o Nível Máximo (5/5)
    // ----------------------------------------------------
    const maxClubId = 'test-club-max';
    const maxClub: Club = {
      id: maxClubId,
      name: 'Max FC Test',
      slug: 'max-fc-test',
      shortName: 'MFC',
      code: 'MFC',
      badge: '⭐',
      stadiumId: 'stad-max',
      stadiumName: 'Estádio Campeão',
      capacity: 80000,
      reputation: 5,
      transferBudget: 50000000,
      wageBudget: 5000000,
      balance: 50000000,
      youthLevel: 5, // Já no máximo!
      managerName: 'Top Manager',
      squadCount: 25,
      fansCount: 50000,
      primaryColor: '#3b82f6',
      secondaryColor: '#1e40af',
      boardExpectation: 'Título',
      seasonTarget: 'Título',
      trophiesCount: 10,
      foundedYear: 2026,
    };
    await clubesService.save(maxClub);

    const resMax = await estadioService.upgradeYouthFacility(maxClubId);
    assert(!resMax.success, 'Expansão não deveria ser permitida para clube com nível máximo');
    assert(resMax.error?.includes('nível máximo') === true, 'Mensagem de nível máximo esperada');

    const maxClubAfter = await clubesService.getById(maxClubId);
    assert(maxClubAfter?.balance === 50000000, 'Saldo não pode ser debitado ao tentar exceder nível máximo');
    assert(maxClubAfter?.youthLevel === 5, 'Nível não pode exceder 5');

    log('Teste 5: Bloqueio estrito ao atingir o nível máximo (5/5)', true);

    // ----------------------------------------------------
    // TESTE 6: Expansão de Arquibancada - Saldo Insuficiente
    // Clube com R$ 10.000.000 tentando obra de R$ 12.000.000
    // ----------------------------------------------------
    const brokeCapClubId = 'test-cap-broke';
    const brokeCapClub: Club = {
      id: brokeCapClubId,
      name: 'Broke Cap FC',
      slug: 'broke-cap-fc',
      shortName: 'BCF',
      code: 'BCF',
      badge: '🏟️',
      stadiumId: 'stad-broke-cap',
      stadiumName: 'Arena Aperto',
      capacity: 50000,
      reputation: 3,
      transferBudget: 10000000,
      wageBudget: 1000000,
      balance: 10000000, // < 12.000.000
      youthLevel: 4,
      managerName: 'Manager Cap',
      squadCount: 20,
      fansCount: 15000,
      primaryColor: '#000000',
      secondaryColor: '#ffffff',
      boardExpectation: 'Permanência',
      seasonTarget: 'Permanência',
      trophiesCount: 0,
      foundedYear: 2026,
    };
    await clubesService.save(brokeCapClub);

    const initFinCount = dataStore.getFinancesByClubId(brokeCapClubId).length;
    const resBrokeCap = await estadioService.upgradeCapacity(brokeCapClubId);
    assert(!resBrokeCap.success, 'Expansão de arquibancada com saldo insuficiente deveria falhar');
    assert(
      resBrokeCap.error?.includes('Saldo insuficiente') === true,
      `Erro de saldo insuficiente esperado: ${resBrokeCap.error}`
    );

    const brokeCapAfter = await clubesService.getById(brokeCapClubId);
    assert(brokeCapAfter?.balance === 10000000, 'Saldo não deve ser alterado quando saldo for insuficiente');
    assert(brokeCapAfter?.capacity === 50000, 'Capacidade não deve ser alterada quando saldo for insuficiente');
    assert(
      dataStore.getFinancesByClubId(brokeCapClubId).length === initFinCount,
      'Nenhum lançamento financeiro deve ser gerado'
    );
    log('Teste 6: Saldo insuficiente (< R$ 12M) para expansão de arquibancada bloqueou com sucesso', true);

    // ----------------------------------------------------
    // TESTE 7: Expansão de Arquibancada - Saldo Suficiente (20M -> 8M, 70k -> 75k)
    // ----------------------------------------------------
    const richCapClubId = 'test-cap-rich';
    const richCapClub: Club = {
      id: richCapClubId,
      name: 'Rich Cap FC',
      slug: 'rich-cap-fc',
      shortName: 'RCF',
      code: 'RCF',
      badge: '🏟️',
      stadiumId: 'stad-rich-cap',
      stadiumName: 'Grande Arena',
      capacity: 70000,
      reputation: 5,
      transferBudget: 20000000,
      wageBudget: 2000000,
      balance: 20000000, // R$ 20.000.000
      youthLevel: 4,
      managerName: 'Manager Rich',
      squadCount: 22,
      fansCount: 45000,
      primaryColor: '#10b981',
      secondaryColor: '#059669',
      boardExpectation: 'Título',
      seasonTarget: 'Campeão',
      trophiesCount: 4,
      foundedYear: 2026,
    };
    await clubesService.save(richCapClub);

    const testIdemKey = 'idem-cap-test-12345';
    const resRichCap = await estadioService.upgradeCapacity(richCapClubId, testIdemKey);
    assert(resRichCap.success, `Expansão de arquibancada falhou: ${resRichCap.error}`);

    const richCapAfter = await clubesService.getById(richCapClubId);
    assert(
      richCapAfter?.balance === 8000000,
      `Saldo incorreto após expansão! Esperado: 8000000, Atual: ${richCapAfter?.balance}`
    );
    assert(
      richCapAfter?.capacity === 75000,
      `Capacidade incorreta após expansão! Esperado: 75000, Atual: ${richCapAfter?.capacity}`
    );
    assert(
      richCapAfter?.lastAudit?.cost === 12000000,
      `Auditoria de custo incorreta: ${richCapAfter?.lastAudit?.cost}`
    );
    assert(
      richCapAfter?.lastAudit?.newBalance === 8000000,
      `Auditoria de novo saldo incorreta: ${richCapAfter?.lastAudit?.newBalance}`
    );
    assert(
      richCapAfter?.lastAudit?.previousBalance === 20000000,
      `Auditoria de saldo anterior incorreta: ${richCapAfter?.lastAudit?.previousBalance}`
    );

    const capFinances = dataStore.getFinancesByClubId(richCapClubId);
    assert(capFinances.length === 1, `Esperado exatamente 1 lançamento financeiro, encontrados: ${capFinances.length}`);
    assert(capFinances[0].amount === 12000000, 'Valor do lançamento financeiro deve ser R$ 12.000.000');
    assert(capFinances[0].category === 'INFRAESTRUTURA', 'Categoria deve ser INFRAESTRUTURA');
    log('Teste 7: Expansão de arquibancada debitou exatamente R$ 12M (20M -> 8M) e aumentou de 70k para 75k', true);

    // ----------------------------------------------------
    // TESTE 8: Idempotência na Expansão de Arquibancada
    // Reenviar a mesma chave de idempotência não deve re-debitar nem re-expandir
    // ----------------------------------------------------
    const resIdemRepeat = await estadioService.upgradeCapacity(richCapClubId, testIdemKey);
    assert(resIdemRepeat.success, 'Chamada idempotente deve retornar sucesso sem duplicar');

    const richCapAfterRepeat = await clubesService.getById(richCapClubId);
    assert(
      richCapAfterRepeat?.balance === 8000000,
      `Saldo foi debitado novamente em chamada repetida! Atual: ${richCapAfterRepeat?.balance}`
    );
    assert(
      richCapAfterRepeat?.capacity === 75000,
      `Capacidade foi incrementada novamente em chamada repetida! Atual: ${richCapAfterRepeat?.capacity}`
    );
    log('Teste 8: Idempotência confirmada - repetição com mesma chave não gerou débito duplo nem incremento indevido', true);

    // ----------------------------------------------------
    // TESTE 9: Proteção contra Duplo Clique Simultâneo em upgradeCapacity
    // ----------------------------------------------------
    const raceCapClubId = 'test-cap-race';
    const raceCapClub: Club = {
      id: raceCapClubId,
      name: 'Race Cap FC',
      slug: 'race-cap-fc',
      shortName: 'RCF',
      code: 'RCF',
      badge: '⚡',
      stadiumId: 'stad-race-cap',
      stadiumName: 'Veloz Arena',
      capacity: 50000,
      reputation: 3,
      transferBudget: 20000000,
      wageBudget: 1500000,
      balance: 20000000,
      youthLevel: 3,
      managerName: 'Speedy 2',
      squadCount: 20,
      fansCount: 20000,
      primaryColor: '#ef4444',
      secondaryColor: '#991b1b',
      boardExpectation: 'Meio de tabela',
      seasonTarget: 'Meio de tabela',
      trophiesCount: 1,
      foundedYear: 2026,
    };
    await clubesService.save(raceCapClub);

    const [resRaceCap1, resRaceCap2] = await Promise.all([
      estadioService.upgradeCapacity(raceCapClubId),
      estadioService.upgradeCapacity(raceCapClubId),
    ]);

    const capSuccesses = [resRaceCap1.success, resRaceCap2.success].filter(Boolean).length;
    assert(
      capSuccesses === 1,
      `Falha na proteção contra duplo clique de capacidade! Sucessos simultâneos: ${capSuccesses}`
    );

    const raceCapAfter = await clubesService.getById(raceCapClubId);
    assert(
      raceCapAfter?.balance === 8000000,
      `Saldo após duplo clique deveria ser R$ 8.000.000, encontrado: ${raceCapAfter?.balance}`
    );
    assert(
      raceCapAfter?.capacity === 55000,
      `Capacidade após duplo clique deveria ter aumentado apenas +5.000 (55.000), encontrado: ${raceCapAfter?.capacity}`
    );
    log('Teste 9: Duplo clique simultâneo em upgradeCapacity protegido com sucesso', true);

    // ----------------------------------------------------
    // TESTE 10: Preparação do Thales FC para teste de concorrência/duplo clique
    // Capacidade mantida em 75.000 torcedores e saldo preparado em R$ 20.000.000
    // ----------------------------------------------------
    const thalesId = 'club-qowYWnG0EfUqrr1a5cHlu4UYmNB3';
    dataStore.reconcileThalesFC();
    const thalesClub = await clubesService.getById(thalesId);

    assert(Boolean(thalesClub), 'Thales FC não encontrado');
    assert(
      thalesClub?.capacity === 75000,
      `Capacidade do Thales FC deve ser 75.000, atual: ${thalesClub?.capacity}`
    );
    assert(
      thalesClub?.balance === 20000000,
      `Saldo do Thales FC deve ser R$ 20.000.000, atual: ${thalesClub?.balance}`
    );

    log('Teste 10: Thales FC preparado para teste de concorrência com capacidade 75.000 torcedores e saldo R$ 20.000.000', true);

    console.log('\n======================================================');
    console.log('🎉 TODOS OS TESTES DE EXPANSÃO DE ESTÁDIO PASSARAM COM SUCESSO!');
    console.log('======================================================\n');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Erro inesperado na suíte de testes: ${msg}`, false);
  }

  return { passed, details };
}

// Executar quando invocado diretamente via tsx
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('estadioService.test')) {
  runEstadioServiceTests().then((res) => {
    if (!res.passed) {
      process.exit(1);
    }
    process.exit(0);
  });
}
