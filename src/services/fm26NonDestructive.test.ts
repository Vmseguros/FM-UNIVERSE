import { Player, Club } from '../types';
import { FM26ParsedPlayer, FM26HomologationItem } from '../types/fm26';
import {
  generateCanonicalKey,
  generateDeterministicPlayerId,
  mergeExistingPlayerWithFM26,
  createNewPlayerFromFM26,
  verifyNonDestructiveIntegrity,
  executeNonDestructiveMerge,
} from './fm26ProtectionLayer';
import { fm26HomologationService } from './fm26HomologationService';
import { fm26Importer } from './fm26Importer';
import { fm26BatchService } from './fm26BatchService';

export interface ProtectionTestResult {
  passed: boolean;
  details: string[];
}

export function runNonDestructiveProtectionTests(): ProtectionTestResult {
  const details: string[] = [];
  let allOk = true;

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      allOk = false;
      details.push(`❌ FALHA: ${msg}`);
      console.error(`FALHA NO TESTE NÃO DESTRUTIVO: ${msg}`);
    } else {
      details.push(`✅ SUCESSO: ${msg}`);
    }
  }

  const mockClub: Club = {
    id: 'club-real-madrid',
    name: 'Real Madrid',
    shortName: 'RMD',
    code: 'RMD',
    badge: '/badges/real-madrid.png',
    slug: 'real-madrid',
    primaryColor: '#FFFFFF',
    secondaryColor: '#00529F',
    reputation: 95,
    transferBudget: 500000000,
    wageBudget: 25000000,
    balance: 600000000,
    stadiumId: 'stad-bernabeu',
    stadiumName: 'Santiago Bernabéu',
    capacity: 81044,
    managerName: 'Carlo Ancelotti',
    squadCount: 25,
    fansCount: 50000000,
    boardExpectation: 'Campeão da Champions League e La Liga',
    seasonTarget: 'Títulos em todas as competições',
    trophiesCount: 100,
    foundedYear: 1902,
  };

  const sampleCSV = `Nome;Clube;Idade;Posição;OVR;POT;Valor;Salário;Nacionalidade;Pé Preferido
Vinícius Júnior;Real Madrid;24;LW;89;93;R$ 750.000.000;R$ 8.500.000;Brasil;Destro
Endrick;Real Madrid;18;ST;78;92;R$ 220.000.000;R$ 2.000.000;Brasil;Canhoto
Jude Bellingham;Real Madrid;21;CAM;90;95;R$ 850.000.000;R$ 9.200.000;Inglaterra;Destro`;

  // =========================================================================
  // 1. REGRA: ID Determinístico e Estável baseado na Chave Canônica
  // =========================================================================
  {
    const key1 = generateCanonicalKey('Vinícius Júnior', 'Brasil', 'Real Madrid');
    const key2 = generateCanonicalKey('vinicius junior', 'brasil', 'real madrid');
    assert(key1 === key2, 'Regra 1: Chave canônica normaliza acentos, maiúsculas e espaços');

    const id1 = generateDeterministicPlayerId('Vinícius Júnior', 'Brasil', 'Real Madrid');
    const id2 = generateDeterministicPlayerId('Vinícius Júnior', 'Brasil', 'Real Madrid');
    assert(id1 === id2, 'Regra 1: O mesmo jogador sempre gera o mesmo ID determinístico invariante');
    assert(id1.startsWith('player-fm26-'), 'Regra 1: Prefixo padronizado player-fm26-');
  }

  // =========================================================================
  // 2. TESTE: CSV Novo → Cria Jogadores
  // =========================================================================
  const validationRes = fm26Importer.validateText(sampleCSV, 'elenco_teste.csv');
  assert(validationRes.validRecords === 3, 'Teste 2: 3 registros válidos parseados do CSV');

  const emptyBase: Player[] = [];
  const homologation1 = fm26HomologationService.buildHomologation(validationRes.allPlayers, emptyBase);

  assert(homologation1.totalNew === 3, 'Teste 2: Todos os 3 jogadores classificados como NOVO na base vazia');
  assert(homologation1.totalUpdate === 0, 'Teste 2: 0 jogadores para atualizar na base vazia');

  const batchId1 = 'batch-test-001';
  const mergeResult1 = executeNonDestructiveMerge(emptyBase, homologation1.items, batchId1, [mockClub]);

  assert(mergeResult1.newCount === 3, 'Teste 2: 3 novos jogadores adicionados');
  assert(mergeResult1.mergedPlayers.length === 3, 'Teste 2: Base resultante possui 3 jogadores');

  const vini = mergeResult1.mergedPlayers.find((p) => p.name === 'Vinícius Júnior');
  assert(vini !== undefined, 'Teste 2: Vinícius Júnior criado na base');
  assert(vini?.source === 'FM26_EXPORT', 'Teste 2: source definido como FM26_EXPORT');
  assert(vini?.database === 'FM26', 'Teste 2: database definido como FM26');
  assert(vini?.importBatchId === batchId1, 'Teste 2: importBatchId registrado');
  assert(vini?.stats.goals === 0, 'Teste 2: stats inicializado zerado com segurança');

  // =========================================================================
  // 3. TESTE: Mesmo CSV Novamente → Não Duplica (Idempotência Estrita)
  // =========================================================================
  const currentBase = mergeResult1.mergedPlayers;
  const homologation2 = fm26HomologationService.buildHomologation(validationRes.allPlayers, currentBase);

  assert(homologation2.totalNew === 0, 'Teste 3 (Idempotência): 0 novos jogadores ao reimportar o mesmo CSV');
  assert(homologation2.totalUpdate === 3, 'Teste 3 (Idempotência): Todos os 3 atletas identificados como ATUALIZAR');

  const batchId2 = 'batch-test-002';
  const mergeResult2 = executeNonDestructiveMerge(currentBase, homologation2.items, batchId2, [mockClub]);

  assert(mergeResult2.newCount === 0, 'Teste 3 (Idempotência): 0 novos criados no merge repetido');
  assert(mergeResult2.updatedCount === 3, 'Teste 3 (Idempotência): 3 atualizados');
  assert(mergeResult2.mergedPlayers.length === 3, 'Teste 3 (Idempotência): Contagem final de jogadores inalterada (3/3)');

  const viniReimported = mergeResult2.mergedPlayers.find((p) => p.name === 'Vinícius Júnior');
  assert(viniReimported?.id === vini?.id, 'Teste 3 (Idempotência): ID determinístico preservado idêntico');

  // =========================================================================
  // 4. TESTE: Jogador Correspondente → Atualiza e PRESERVA Dados do Save
  // =========================================================================
  const existingPlayerSave: Player = {
    id: 'player-save-original-999',
    name: 'Vinícius Júnior',
    fullName: 'Vinícius José Paixão de Oliveira Júnior',
    shortName: 'Vini Jr',
    age: 23,
    nationality: 'Brasil',
    nationalityCode: 'BRA',
    preferredFoot: 'Destro',
    jerseyNumber: 7,
    clubId: 'club-meu-save',
    clubName: 'Real Madrid',
    position: 'LW',
    positionCategory: 'ATACANTE',
    overall: 88,
    potential: 92,
    attributes: { pace: 95, shooting: 82, passing: 81, dribbling: 90, defending: 35, physical: 76 },
    wage: 5000000,
    marketValue: 500000000,
    contractUntil: '2029-12-31',
    contractStartDate: '2024-01-01',
    releaseClause: 1000000000,
    // ESTATÍSTICAS REAIS DO SAVE (NÃO PODEM SER ZERADAS)
    stats: {
      matches: 42,
      goals: 31,
      assists: 15,
      yellowCards: 3,
      redCards: 0,
      cleanSheets: 0,
      averageRating: 8.7,
      minutesPlayed: 3650,
    },
    starts: 40,
    substituteAppearances: 2,
    seasonStats: [
      {
        season: '2025/26',
        competitionName: 'Champions League',
        matches: 12,
        starts: 12,
        substituteAppearances: 0,
        goals: 11,
        assists: 5,
        yellowCards: 1,
        redCards: 0,
        averageRating: 8.9,
        cleanSheets: 0,
        minutesPlayed: 1080,
      },
    ],
    careerHistory: [
      { season: '2023/24', clubName: 'Real Madrid', matches: 39, goals: 24, assists: 11, averageRating: 8.5 },
    ],
    // DADOS DE ESTADO DE JOGO
    status: 'INJURED',
    isInjured: true,
    injuryDetails: { type: 'Lesão Muscular', daysRemaining: 7, severity: 'Moderada' },
    morale: 'Excelente',
    condition: 75,
    avatar: 'https://example.com/vini-custom-face.png',
    photo: 'https://example.com/vini-custom-photo.png',
  };

  const baseWithVini = [existingPlayerSave];
  const homologationVini = fm26HomologationService.buildHomologation(validationRes.allPlayers, baseWithVini);

  const viniItem = homologationVini.items.find((i) => i.parsedPlayer.name === 'Vinícius Júnior');
  assert(viniItem !== undefined, 'Teste 4: Vinícius localizado na homologação');
  assert(viniItem?.action === 'ATUALIZAR', 'Teste 4: Identificado inequívoco como ATUALIZAR');
  assert(viniItem?.id === existingPlayerSave.id, 'Teste 4: Preserva exatamente o ID original do jogador existente');

  const updatedVini = mergeExistingPlayerWithFM26(existingPlayerSave, viniItem!.parsedPlayer, 'batch-vini-update');

  // Verificações rigorosas de preservação
  assert(updatedVini.id === 'player-save-original-999', 'Teste 4: ID original rigorosamente mantido');
  assert(updatedVini.stats.goals === 31, 'Teste 4: Estatísticas de gols intactas (31 gols mantidos)');
  assert(updatedVini.stats.matches === 42, 'Teste 4: Partidas disputadas intactas (42 jogos mantidos)');
  assert(updatedVini.stats.averageRating === 8.7, 'Teste 4: Nota média preservada intacta');
  assert(updatedVini.seasonStats?.length === 1, 'Teste 4: seasonStats preservado intacto');
  assert(updatedVini.careerHistory?.length === 1, 'Teste 4: careerHistory preservado intacto');
  assert(updatedVini.isInjured === true, 'Teste 4: Lesão em andamento preservada');
  assert(updatedVini.injuryDetails?.daysRemaining === 7, 'Teste 4: Detalhes da lesão preservados');
  assert(updatedVini.clubId === 'club-meu-save', 'Teste 4: Vínculo interno de clube mantido');
  assert(updatedVini.avatar === 'https://example.com/vini-custom-face.png', 'Teste 4: Avatar customizado mantido');

  // Verificações de campos atualizados pelo FM26
  assert(updatedVini.overall === 89, 'Teste 4: overall atualizado para 89 (vindo do FM26)');
  assert(updatedVini.potential === 93, 'Teste 4: potential atualizado para 93 (vindo do FM26)');
  assert(updatedVini.marketValue === 750000000, 'Teste 4: marketValue atualizado para R$ 750M');
  assert(updatedVini.source === 'FM26_EXPORT', 'Teste 4: source marcado como FM26_EXPORT');
  assert(updatedVini.database === 'FM26', 'Teste 4: database marcado como FM26');

  // =========================================================================
  // 5. TESTE: Jogador Não Correspondente → Cria como NOVO
  // =========================================================================
  const endrickItem = homologationVini.items.find((i) => i.parsedPlayer.name === 'Endrick');
  assert(endrickItem?.action === 'NOVO', 'Teste 5: Endrick (inexistente na base) classificado como NOVO');
  assert(endrickItem?.id.startsWith('player-fm26-'), 'Teste 5: Endrick recebe ID determinístico');

  // =========================================================================
  // 6. TESTE: Jogador Existente Fora do FM26 → Permanece 100% Intacto
  // =========================================================================
  const unrelatedPlayer: Player = {
    id: 'player-custom-pele-10',
    name: 'Pelé',
    age: 30,
    nationality: 'Brasil',
    nationalityCode: 'BRA',
    preferredFoot: 'Destro',
    jerseyNumber: 10,
    clubId: 'club-santos',
    clubName: 'Santos FC',
    position: 'CF',
    positionCategory: 'ATACANTE',
    overall: 99,
    potential: 99,
    attributes: { pace: 98, shooting: 99, passing: 95, dribbling: 98, defending: 50, physical: 90 },
    wage: 10000000,
    marketValue: 1000000000,
    contractUntil: '2030-12-31',
    stats: { matches: 600, goals: 750, assists: 200, yellowCards: 0, redCards: 0, cleanSheets: 0, averageRating: 9.8, minutesPlayed: 54000 },
    status: 'FIT',
    condition: 100,
    morale: 'Excelente',
  };

  const mixedBase = [existingPlayerSave, unrelatedPlayer];
  const mixedHomologation = fm26HomologationService.buildHomologation(validationRes.allPlayers, mixedBase);
  const mixedMerge = executeNonDestructiveMerge(mixedBase, mixedHomologation.items, 'batch-mixed', [mockClub]);

  const peleResult = mixedMerge.mergedPlayers.find((p) => p.id === 'player-custom-pele-10');
  assert(peleResult !== undefined, 'Teste 6: Pelé permaneceu na base');
  assert(peleResult?.overall === 99, 'Teste 6: Pelé overall 99 intacto');
  assert(peleResult?.stats.goals === 750, 'Teste 6: Pelé 750 gols intactos');
  assert(peleResult?.clubName === 'Santos FC', 'Teste 6: Santos FC intacto');
  assert(mixedMerge.unchangedCount >= 1, 'Teste 6: Registrado pelo menos 1 atleta inalterado');

  // =========================================================================
  // 7. TESTE: Nenhum Documento é Excluído (Guarda de Integridade Não Destrutiva)
  // =========================================================================
  assert(mixedMerge.mergedPlayers.length >= mixedBase.length, 'Teste 7: Base resultante (4) >= base original (2)');

  // Tentativa simulada de deleção para comprovar que a guarda bloqueia
  const corruptedList = mixedMerge.mergedPlayers.filter((p) => p.id !== 'player-custom-pele-10');
  const integrityCheck = verifyNonDestructiveIntegrity(mixedBase, corruptedList);
  assert(integrityCheck.valid === false, 'Teste 7: Guarda não destrutiva detecta e bloqueia desaparecimento de jogador');
  assert(integrityCheck.error !== undefined && integrityCheck.error.includes('desapareceu'), 'Teste 7: Mensagem de erro de segurança disparada');

  // =========================================================================
  // 8. TESTE: Registro do Lote de Importação (fm26_import_batches/{importBatchId})
  // =========================================================================
  const generatedBatchId = fm26BatchService.generateBatchId();
  assert(generatedBatchId.startsWith('fm26_batch_'), 'Teste 8: Formato padrão fm26_batch_<timestamp>');

  return { passed: allOk, details };
}
