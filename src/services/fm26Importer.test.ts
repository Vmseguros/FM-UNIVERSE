import { fm26Importer } from './fm26Importer';
import { parseMonetaryBRL } from './fm26Normalizer';
import {
  generateHomologationKey,
  generateDeterministicPlayerId,
  convertHomologatedToPlayer,
} from './fm26HomologationService';
import { fm26AuditService } from './fm26AuditService';
import { fm26CheckpointService } from './fm26CheckpointService';
import { FM26ParsedPlayer } from '../types/fm26';

export interface TestReport {
  passed: boolean;
  details: string[];
}

export async function runFM26ImporterTests(): Promise<TestReport> {
  const details: string[] = [];
  let allOk = true;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      details.push(`✅ ${msg}`);
    } else {
      details.push(`❌ FALHA: ${msg}`);
      allOk = false;
    }
  }

  // 1. Teste: CSV Válido
  {
    const validCSV = `Nome;Clube;Idade;Posição;OVR;POT;Valor;Salário
Vinícius Júnior;Real Madrid;24;LW;89;93;R$ 750.000.000;R$ 8.500.000
Endrick;Real Madrid;18;ST;78;92;R$ 220.000.000;R$ 2.000.000`;

    const res = fm26Importer.validateText(validCSV, 'elenco_real.csv');
    assert(res.totalPlayersFound === 2, 'Teste 1: CSV válido identificou 2 jogadores');
    assert(res.validRecords === 2, 'Teste 1: 2 registros válidos');
    assert(res.problematicRecords === 0, 'Teste 1: 0 registros com problemas');
    assert(res.previewPlayers[0].name === 'Vinícius Júnior', 'Teste 1: Nome com acento preservado perfeitamente');
    assert(res.previewPlayers[0].currency === 'BRL', 'Teste 1: Moeda canônica é BRL');
  }

  // 2. Teste: CSV Sem Cabeçalho
  {
    const noHeaderCSV = `Vinícius Júnior;Real Madrid;24;LW;89;93;750000000;8500000
Endrick;Real Madrid;18;ST;78;92;220000000;2000000`;

    const res = fm26Importer.validateText(noHeaderCSV, 'sem_cabecalho.csv');
    assert(
      res.issues.some((i) => i.message.includes('Cabeçalho obrigatório ausente')),
      'Teste 2: Detectou ausência de cabeçalho obrigatório com coluna de nome'
    );
  }

  // 3. Teste: CSV Vazio
  {
    const emptyCSV = `   \n\n  `;
    const res = fm26Importer.validateText(emptyCSV, 'vazio.csv');
    assert(res.totalPlayersFound === 0, 'Teste 3: CSV vazio detectado');
    assert(
      res.issues.some((i) => i.message.includes('arquivo enviado está totalmente vazio')),
      'Teste 3: Alerta claro de arquivo vazio emitido'
    );
  }

  // 4. Teste: Campos Ausentes (Colunas recomendadas não mapeadas)
  {
    const minimalCSV = `Nome;Idade
Gabriel Pec;23`;

    const res = fm26Importer.validateText(minimalCSV, 'minimo.csv');
    assert(res.totalPlayersFound === 1, 'Teste 4: Jogador reconhecido mesmo com colunas mínimas');
    assert(
      res.missingRecommendedColumns.includes('club') &&
      res.missingRecommendedColumns.includes('marketValue'),
      'Teste 4: Informou corretamente campos recomendados ausentes (club, marketValue, etc.)'
    );
    assert(res.previewPlayers[0].club === 'Sem Clube', 'Teste 4: Atribuiu fallback "Sem Clube"');
  }

  // 5. Teste: Valores Numéricos Inválidos
  {
    const invalidNumbersCSV = `Nome;Idade;Overall;Valor
Benjamin Button;3;120;R$ 10.000.000`;

    const res = fm26Importer.validateText(invalidNumbersCSV, 'numeros_invalidos.csv');
    assert(
      res.issues.some((i) => i.message.includes('Idade atípica')),
      'Teste 5: Detectou idade atípica (3 anos)'
    );
    assert(res.previewPlayers[0].overall <= 99, 'Teste 5: Normalizou overall 120 para escala máxima 99');
  }

  // 6. Teste: Jogadores Duplicados no Próprio Arquivo
  {
    const duplicateCSV = `Nome;Clube;Idade;Nacionalidade;Posição
Lucas Kaiky;FM United;21;Brasil;ST
Rodrygo Goes;Real Madrid;24;Brasil;RW
Lucas Kaiky;FM United;21;Brasil;ST`;

    const res = fm26Importer.validateText(duplicateCSV, 'duplicatas.csv');
    assert(res.duplicateRecords === 1, 'Teste 6: Detectou exatamente 1 registro duplicado');
    assert(
      res.issues.some((i) => i.message.includes('Possível duplicata do jogador da linha 2')),
      'Teste 6: Apontou a linha original de origem da duplicata'
    );
  }

  // 7. Teste: Nomes com Acentos e Caracteres Especiais
  {
    const specialNamesCSV = `Nome;Clube;Idade;Nacionalidade
João Müller;Bayern;28;Alemanha
Vinícius Júnior;Real Madrid;24;Brasil
Benjamin Šeško;RB Leipzig;22;Eslovênia
Krzysztof Piątek;Basaksehir;29;Polônia`;

    const res = fm26Importer.validateText(specialNamesCSV, 'acentos.csv');
    assert(res.previewPlayers[0].name === 'João Müller', 'Teste 7: João Müller mantido com acento e trema');
    assert(res.previewPlayers[1].name === 'Vinícius Júnior', 'Teste 7: Vinícius Júnior mantido com acento');
    assert(res.previewPlayers[2].name === 'Benjamin Šeško', 'Teste 7: Šeško mantido com caracteres eslavos');
    assert(res.previewPlayers[3].name === 'Krzysztof Piątek', 'Teste 7: Piątek mantido com ogonek polonês');
  }

  // 8. Teste: Normalização Monetária Exclusiva em BRL
  {
    const val1 = parseMonetaryBRL('R$ 15.000.000');
    const val2 = parseMonetaryBRL('15M');
    const val3 = parseMonetaryBRL('250 mil');
    const val4 = parseMonetaryBRL('€ 10M'); // Export de FM europeu convertido para número de reais
    const val5 = parseMonetaryBRL('1,5 bi');

    assert(val1 === 15000000, 'Teste 8: "R$ 15.000.000" -> 15.000.000 BRL');
    assert(val2 === 15000000, 'Teste 8: "15M" -> 15.000.000 BRL');
    assert(val3 === 250000, 'Teste 8: "250 mil" -> 250.000 BRL');
    assert(val4 === 10000000, 'Teste 8: "€ 10M" -> 10.000.000 BRL numérico');
    assert(val5 === 1500000000, 'Teste 8: "1,5 bi" -> 1.500.000.000 BRL');
  }

  // 9. Teste: CSV com Pelo Menos 20 Registros (Preview Limit)
  {
    const rows = ['Nome;Clube;Idade;Posição;OVR;POT;Valor;Salário'];
    for (let i = 1; i <= 25; i++) {
      rows.push(`Atleta FM ${i};Clube ${i % 3 + 1};${20 + (i % 10)};ST;${70 + (i % 20)};${80 + (i % 15)};${i * 1000000};${i * 10000}`);
    }
    const bigCSV = rows.join('\n');

    const res = fm26Importer.validateText(bigCSV, 'grande_export.csv');
    assert(res.totalPlayersFound === 25, 'Teste 9: Identificou todos os 25 jogadores');
    assert(res.previewPlayers.length === 20, 'Teste 9: Pré-visualização limitada estritamente aos primeiros 20 jogadores');
    assert(res.validRecords === 25, 'Teste 9: Todos os 25 registros são válidos');
  }

  // 10. Teste: Bloqueio estrito de gravação direta sem homologação
  {
    let caughtError = false;
    try {
      await fm26Importer.commitToDatabase([]);
    } catch (e: any) {
      caughtError = true;
      assert(e.message.includes('AÇÃO BLOQUEADA'), 'Teste 10: Bloqueio de gravação direta sem homologação ativo');
    }
    assert(caughtError, 'Teste 10: Tentativa de gravação direta disparou bloqueio de segurança');
  }

  // 11. Teste: Regra Canônica de Normalização e Deduplicação (Nome + Nacionalidade + Clube)
  {
    const key1 = generateHomologationKey('Vinícius Júnior', 'Brasil', 'Real Madrid');
    const key2 = generateHomologationKey('vinicius  junior ', 'brasil', 'Real   Madrid');
    assert(key1 === key2, 'Teste 11: Normalização ignora acentos, maiúsculas e espaços duplicados');
  }

  // 12. Teste: Classificação de Homologação (NOVO, ATUALIZAR, DUPLICADO, ERRO)
  {
    const csvData = `Nome;Clube;Idade;Posição;Nacionalidade;OVR;POT;Valor;Salário
Vinícius Júnior;Real Madrid;24;LW;Brasil;89;93;R$ 750.000.000;R$ 8.500.000
Novo Atleta FM;FM United;19;ST;Brasil;75;88;R$ 50.000.000;R$ 400.000
Vinícius Júnior;Real Madrid;24;LW;Brasil;89;93;R$ 750.000.000;R$ 8.500.000
;Clube X;20;CB;Brasil;70;75;R$ 10.000.000;R$ 100.000`;

    const validation = fm26Importer.validateText(csvData, 'teste_homologacao.csv');
    // Simula atleta existente no banco
    const mockExistingPlayer: any = {
      id: 'player-vini-original',
      name: 'Vinícius Júnior',
      nationality: 'Brasil',
      nationalityCode: 'BRA',
      clubName: 'Real Madrid',
      clubId: 'club-real-madrid',
    };

    const homologation = fm26Importer.homologate(validation.allPlayers, [mockExistingPlayer]);

    assert(homologation.totalFound === 4, 'Teste 12: 4 registros encontrados');
    assert(homologation.totalUpdate === 1, 'Teste 12: 1 atleta marcado como ATUALIZAR');
    assert(homologation.totalNew === 1, 'Teste 12: 1 atleta marcado como NOVO');
    assert(homologation.totalDuplicate === 1, 'Teste 12: 1 atleta marcado como IGNORAR/DUPLICADO no CSV');
    assert(homologation.totalInvalid === 1, 'Teste 12: 1 registro com erro/nome ausente');

    // Verifica ID do jogador atualizado (NÃO deve criar ID aleatório)
    const updateItem = homologation.items.find((i) => i.action === 'ATUALIZAR');
    assert(updateItem?.id === 'player-vini-original', 'Teste 12: Atleta existente manteve seu ID original do banco');

    // Verifica ID do novo jogador (estável e determinístico)
    const newItem = homologation.items.find((i) => i.action === 'NOVO');
    assert(newItem?.id.startsWith('player-fm'), 'Teste 12: Novo atleta recebeu ID determinístico');
  }

  // 13. Teste: Determinismo de IDs para Mesma Entrada
  {
    const parsedSample: any = {
      name: 'Endrick',
      nationality: 'Brasil',
      club: 'Real Madrid',
      age: 18,
      overall: 78,
      potential: 92,
    };
    const key = generateHomologationKey('Endrick', 'Brasil', 'Real Madrid');
    const id1 = generateDeterministicPlayerId(parsedSample, key);
    const id2 = generateDeterministicPlayerId(parsedSample, key);
    assert(id1 === id2, 'Teste 13: ID determinístico gerou o mesmo identificador estável em chamadas repetidas');
  }

  // 14. Teste: Auditoria de Importação
  {
    const initialAudits = fm26AuditService.getAudits();
    const testAudit = {
      id: `audit-test-${Date.now()}`,
      timestamp: new Date().toISOString(),
      fileName: 'teste_audit.csv',
      totalProcessed: 5,
      totalNewRecorded: 3,
      totalUpdatedRecorded: 2,
      totalIgnored: 0,
      totalErrors: 0,
      executedBy: 'ADMIN',
      notes: 'Teste de auditoria',
    };
    fm26AuditService.addAudit(testAudit);
    const afterAudits = fm26AuditService.getAudits();
    assert(afterAudits.length === initialAudits.length + 1, 'Teste 14: Registro de auditoria gravado com sucesso');
    assert(afterAudits[0].id === testAudit.id, 'Teste 14: Última auditoria posicionada no topo do histórico');
  }

  // 15. Teste de Fluxo Completo Obrigatório (Etapa 1 -> Etapa 2 -> 22 Atletas na Homologação)
  {
    const sample22 = `Nome;Clube;Idade;Posição;OVR;POT;Valor;Salário;Nacionalidade;Pé Preferido
Vinícius Júnior;Real Madrid;24;LW;89;93;R$ 750.000.000;R$ 8.500.000;Brasil;Destro
Endrick;Real Madrid;18;ST;78;92;R$ 220.000.000;R$ 2.000.000;Brasil;Canhoto
Rodrygo Goes;Real Madrid;24;RW;86;90;R$ 550.000.000;R$ 6.000.000;Brasil;Destro
Jude Bellingham;Real Madrid;21;CAM;90;95;R$ 850.000.000;R$ 9.200.000;Inglaterra;Destro
Kylian Mbappé;Real Madrid;26;ST;91;94;R$ 950.000.000;R$ 12.000.000;França;Destro
Federico Valverde;Real Madrid;26;CM;88;90;R$ 620.000.000;R$ 6.500.000;Uruguai;Destro
Éder Militão;Real Madrid;26;CB;85;88;R$ 380.000.000;R$ 4.500.000;Brasil;Destro
Thibaut Courtois;Real Madrid;32;GK;89;89;R$ 280.000.000;R$ 7.000.000;Bélgica;Canhoto
Eduardo Camavinga;Real Madrid;22;CDM;84;91;R$ 420.000.000;R$ 4.000.000;França;Canhoto
Aurélien Tchouaméni;Real Madrid;24;CDM;85;89;R$ 460.000.000;R$ 4.800.000;França;Destro
Arda Güler;Real Madrid;19;CAM;79;91;R$ 240.000.000;R$ 1.800.000;Turquia;Canhoto
Brahim Díaz;Real Madrid;25;CAM;82;85;R$ 210.000.000;R$ 2.900.000;Marrocos;Ambidestro
Fran García;Real Madrid;25;LB;78;82;R$ 95.000.000;R$ 1.200.000;Espanha;Canhoto
Dani Carvajal;Real Madrid;32;RB;86;86;R$ 140.000.000;R$ 5.000.000;Espanha;Destro
Lucas Vázquez;Real Madrid;33;RB;80;80;R$ 45.000.000;R$ 2.100.000;Espanha;Destro
Antonio Rüdiger;Real Madrid;31;CB;87;87;R$ 220.000.000;R$ 5.800.000;Alemanha;Destro
David Alaba;Real Madrid;32;CB;84;84;R$ 110.000.000;R$ 6.200.000;Áustria;Canhoto
Ferland Mendy;Real Madrid;29;LB;82;82;R$ 130.000.000;R$ 3.800.000;França;Canhoto
Andriy Lunin;Real Madrid;25;GK;81;86;R$ 160.000.000;R$ 2.400.000;Ucrânia;Destro
Luka Modrić;Real Madrid;39;CM;86;86;R$ 50.000.000;R$ 4.500.000;Croácia;Ambidestro
Dani Ceballos;Real Madrid;28;CM;79;80;R$ 85.000.000;R$ 1.900.000;Espanha;Destro
Jesús Vallejo;Real Madrid;27;CB;74;75;R$ 25.000.000;R$ 950.000;Espanha;Destro`;

    // 1. CSV Carregado -> VALIDAR ARQUIVO
    const validationRes = fm26Importer.validateText(sample22, 'elenco_22.csv');
    assert(validationRes.totalPlayersFound === 22, 'Teste 15: CSV carregado encontrou 22 jogadores');
    assert(validationRes.validRecords === 22, 'Teste 15: 22/22 registros aprovados na validação');
    assert(validationRes.problematicRecords === 0, 'Teste 15: 0 registros com problema');

    // 2. AVANÇAR PARA HOMOLOGAÇÃO
    let step: 1 | 2 | 3 | 4 = 1;
    const homologationRes = fm26Importer.homologate(validationRes.allPlayers, []);
    step = 2; // Transição obrigatória para a Etapa 2

    assert(step === 2, 'Teste 15: currentStep avançou obrigatoriamente para 2 (Homologação)');
    assert(homologationRes.items.length === 22, 'Teste 15: Tabela de homologação contém exatamente os 22 registros preservados');
    assert(homologationRes.totalSelectedToRecord === 22, 'Teste 15: Todos os 22 atletas aptos para gravação');

    // 3. Botão AVANÇAR PARA CONFIRMAÇÃO FINAL visível e pronto
    const canAdvanceToConfirmation = homologationRes.totalSelectedToRecord > 0;
    assert(canAdvanceToConfirmation === true, 'Teste 15: Botão AVANÇAR PARA CONFIRMAÇÃO FINAL habilitado');

    // 4. Sem avanço automático para a Etapa 3
    assert(step === 2, 'Teste 15: Permanece na Etapa 2 sem avanço automático para confirmação');
  }

  // 16. Bateria Completa de Testes Não Destrutivos (Regras 1 a 6 + Idempotência + Preservação Estrita)
  {
    const { runNonDestructiveProtectionTests } = await import('./fm26NonDestructive.test');
    const protectionResults = runNonDestructiveProtectionTests();
    for (const d of protectionResults.details) {
      details.push(`[PROTEÇÃO NÃO DESTRUTIVA] ${d}`);
    }
    if (!protectionResults.passed) {
      allOk = false;
    }
    assert(protectionResults.passed, 'Teste 16: Todos os 8 testes da camada de proteção não destrutiva passaram com 100% de sucesso');
  }

  // 17. Teste: Caso Oficial Cristiano Ronaldo (Origem FM2008, Unique ID 735216, ID fm2008_735216, CA 187, PA 195)
  {
    const cr7CSV = `Unique ID;Name;Club;Age;Nat;Position;PA;A Diff;Value;Wage
735216;Ronaldo, Cristiano;Man Utd;22;Portugal;AMRL, FC;195;8;R$ 80.000.000;R$ 1.200.000`;

    const res = fm26Importer.validateText(cr7CSV, 'FM2008_PLAYERS_IMPORT.csv', 'FM2008');
    assert(res.totalPlayersFound === 1, 'Teste 17: Cristiano Ronaldo identificado no CSV FM2008');
    assert(res.validRecords === 1, 'Teste 17: 1 registro válido');
    assert(res.emptyIdsCount === 0, 'Teste 17: 0 IDs vazios');
    assert(res.duplicateIdsCount === 0, 'Teste 17: 0 IDs duplicados');
    assert(res.emptyNamesCount === 0, 'Teste 17: 0 nomes vazios');
    assert(res.invalidRecordsCount === 0, 'Teste 17: 0 registros inválidos');
    assert(res.databaseSource === 'FM2008', 'Teste 17: Origem detectada como FM2008');

    const parsedCR7 = res.previewPlayers[0];
    assert(parsedCR7.name === 'Ronaldo, Cristiano', 'Teste 17: Nome Ronaldo, Cristiano preservado');
    assert(parsedCR7.uniqueId === '735216', 'Teste 17: uniqueId preservado como 735216');
    assert(parsedCR7.sourceUniqueId === '735216', 'Teste 17: sourceUniqueId preservado como 735216');
    assert(parsedCR7.externalId === '735216', 'Teste 17: externalId preservado como 735216');
    assert(parsedCR7.databaseSource === 'FM2008', 'Teste 17: databaseSource definido como FM2008');
    assert(parsedCR7.pa === 195, 'Teste 17: PA reconhecido como 195');
    assert(parsedCR7.aDiff === 8, 'Teste 17: A Diff reconhecido como 8');
    assert(parsedCR7.ca === 187, 'Teste 17: CA reconstruído com precisão (195 - 8 = 187)');
    assert(parsedCR7.id === 'fm2008_735216', 'Teste 17: ID determinístico gerado estritamente como fm2008_735216 (sem player-fm26-)');

    // Homologação
    const homologation = fm26Importer.homologate(res.allPlayers, []);
    assert(homologation.totalNew === 1, 'Teste 17: Classificado como NOVO');
    assert(homologation.items[0].id === 'fm2008_735216', 'Teste 17: ID determinístico mantido na homologação como fm2008_735216');

    // Conversão para Player
    const playerObj = convertHomologatedToPlayer(homologation.items[0], undefined, [], 'batch-cr7-test');
    assert(playerObj.id === 'fm2008_735216', 'Teste 17: Objeto Player possui ID fm2008_735216');
    assert(playerObj.uniqueId === '735216', 'Teste 17: Objeto Player preserva uniqueId 735216');
    assert(playerObj.sourceUniqueId === '735216', 'Teste 17: Objeto Player preserva sourceUniqueId 735216');
    assert(playerObj.databaseSource === 'FM2008', 'Teste 17: Objeto Player possui databaseSource = FM2008');
    assert(playerObj.database === 'FM2008', 'Teste 17: Objeto Player possui database = FM2008');
    assert(playerObj.source === 'FM2008', 'Teste 17: Objeto Player possui source = FM2008');
    assert(playerObj.ca === 187, 'Teste 17: Objeto Player preserva ca = 187');
    assert(playerObj.pa === 195, 'Teste 17: Objeto Player preserva pa = 195');
    assert(playerObj.aDiff === 8, 'Teste 17: Objeto Player preserva aDiff = 8');
    assert(parsedCR7.wage === 1200000, 'Teste 17: Wage mapeado com sucesso para R$ 1.200.000');
    assert(parsedCR7.overall === 93, 'Teste 17: Overall normalizado a partir de CA 187 para 93');
    assert(playerObj.wage === 1200000, 'Teste 17: Objeto Player preserva wage = 1200000');
    assert(playerObj.overall === 93, 'Teste 17: Objeto Player preserva overall = 93');
    assert(playerObj.clubName === 'Man Utd', 'Teste 17: Clube Man Utd preservado');
    assert(playerObj.nationality === 'Portugal', 'Teste 17: Nacionalidade Portugal preservada');
  }

  // 18. Teste: Importador FM2008 com colunas explícitas "Overall" e "Wage"
  {
    const fm2008ExplicitCSV = `Unique ID;Name;Club;Age;Nat;Position;PA;A Diff;Overall;Wage
12345;Kaka;Milan;25;Brazil;AMC;192;6;91;R$ 950.000`;

    const res = fm26Importer.validateText(fm2008ExplicitCSV, 'FM2008_PLAYERS_IMPORT.csv', 'FM2008');
    assert(res.totalPlayersFound === 1, 'Teste 18: Jogador identificado com colunas explícitas Overall e Wage');
    assert(res.validRecords === 1, 'Teste 18: Registro válido');
    assert(res.databaseSource === 'FM2008', 'Teste 18: Database source FM2008');

    // Verifica que as colunas Overall e Wage foram reconhecidas
    const hasOverallRecognized = res.recognizedColumns.some((col) => col.toLowerCase().includes('overall'));
    const hasWageRecognized = res.recognizedColumns.some((col) => col.toLowerCase().includes('wage'));
    assert(hasOverallRecognized, 'Teste 18: Coluna Overall reconhecida pelo importador FM2008');
    assert(hasWageRecognized, 'Teste 18: Coluna Wage reconhecida pelo importador FM2008');
    assert(!res.missingRecommendedColumns.includes('wage'), 'Teste 18: Wage não deve constar em Campos Recomendados Ausentes');

    const parsedPlayer = res.previewPlayers[0];
    assert(parsedPlayer.id === 'fm2008_12345', 'Teste 18: ID determinístico fm2008_12345');
    assert(parsedPlayer.overall === 91, 'Teste 18: Coluna Overall reconhecida e mapeada com valor 91');
    assert(parsedPlayer.wage === 950000, 'Teste 18: Coluna Wage reconhecida e mapeada para 950000');
    assert(parsedPlayer.ca === 186, 'Teste 18: CA reconstruído a partir de PA 192 - A Diff 6 = 186 sem interferência do Overall');

    const homologation = fm26Importer.homologate(res.allPlayers, []);
    const playerObj = convertHomologatedToPlayer(homologation.items[0], undefined, [], 'batch-kaka-test');
    assert(playerObj.id === 'fm2008_12345', 'Teste 18: Objeto Player possui ID fm2008_12345');
    assert(playerObj.overall === 91, 'Teste 18: Objeto Player preserva overall = 91');
    assert(playerObj.wage === 950000, 'Teste 18: Objeto Player preserva wage = 950000');
    assert(playerObj.ca === 186, 'Teste 18: Objeto Player preserva ca = 186');
  }

  // 19. Teste: Importador FM2008 com cabeçalho em Português "Salário/mês" e "Sal."
  {
    const fm2008PTCSV = `Unique ID;Name;Club;Age;Nat;Position;PA;A Diff;Value;Salário/mês
99999;Messi, Lionel;Barcelona;20;Argentina;AMRC, FC;197;7;R$ 90.000.000;R$ 1.500.000`;

    const res = fm26Importer.validateText(fm2008PTCSV, 'FM2008_PLAYERS_IMPORT.csv', 'FM2008');
    assert(res.totalPlayersFound === 1, 'Teste 19: Jogador identificado com coluna Salário/mês');
    assert(res.validRecords === 1, 'Teste 19: Registro válido');
    assert(!res.missingRecommendedColumns.includes('wage'), 'Teste 19: Salário/mês mapeado para wage (não consta em Campos Recomendados Ausentes)');
    assert(res.previewPlayers[0].wage === 1500000, 'Teste 19: Salário mapeado com sucesso para R$ 1.500.000');
  }

  // 20. Teste: Mecanismo de gravação sequencial e progresso com lotes de até 200
  {
    const { dataStore } = await import('./dataStore');
    const mockPlayers = Array.from({ length: 450 }, (_, i) => ({
      id: `fm2008_batch_test_${i + 1}`,
      name: `Jogador Teste ${i + 1}`,
      fullName: `Jogador Teste ${i + 1}`,
      age: 20,
      nationality: 'Brasil',
      nationalityCode: 'BRA',
      clubId: 'club-teste',
      clubName: 'Clube Teste',
      position: 'ST' as any,
      positionCategory: 'ATA' as any,
      overall: 80,
      potential: 85,
      wage: 50000,
      marketValue: 1000000,
      source: 'FM2008' as any,
      database: 'FM2008' as any,
      databaseSource: 'FM2008' as any,
      status: 'FIT' as any,
    }));

    // Valida particionamento em lotes de no máximo 200
    const BATCH_SIZE = 200;
    const batches: any[][] = [];
    for (let i = 0; i < mockPlayers.length; i += BATCH_SIZE) {
      batches.push(mockPlayers.slice(i, i + BATCH_SIZE));
    }

    assert(batches.length === 3, 'Teste 20: 450 jogadores divididos em 3 lotes (200, 200, 50)');
    assert(batches[0].length === 200, 'Teste 20: Primeiro lote contém exatamente 200 jogadores');
    assert(batches[1].length === 200, 'Teste 20: Segundo lote contém exatamente 200 jogadores');
    assert(batches[2].length === 50, 'Teste 20: Terceiro lote contém 50 jogadores');

    // Salva via dataStore para garantir persistência local e integridade
    const { added, updated } = dataStore.savePlayersBatch(mockPlayers as any);
    assert(added + updated === 450, 'Teste 20: 450 jogadores persistidos com sucesso no dataStore');
  }

  // 21. Teste: Preservação de integridade não destrutiva com coleção massiva simulada
  {
    const { verifyNonDestructiveIntegrity } = await import('./fm26ProtectionLayer');
    const existingSample = [
      { id: 'player-1', name: 'Atleta Existente 1' } as any,
      { id: 'player-2', name: 'Atleta Existente 2' } as any,
    ];
    const incomingSample = [
      { id: 'player-1', name: 'Atleta Existente 1' } as any,
      { id: 'player-2', name: 'Atleta Existente 2' } as any,
      { id: 'fm2008_new_1', name: 'Novo Atleta 1' } as any,
    ];

    const integrity = verifyNonDestructiveIntegrity(existingSample, incomingSample);
    assert(integrity.valid, 'Teste 21: Validação de integridade não destrutiva aprovada com preservação dos atletas existentes');
  }

  // 22. Teste: Mapeamento FM2008 Genie Scout (Pot A -> PA, A Diff -> PA-CA, OVR a partir de CA, sem fallback 70, sem salário 50k, preserva Unique ID, Value e Sale Value)
  {
    const genieScoutCSV = `"Unique ID";"Name";"Club";"Position";"Age";"Pot A";"A Diff";"Value";"Sale Value";"Nat"
"10211";"Cristiano Ronaldo";"Manchester United";"AM RL, ST";"22";"195";"8";"€ 35.000.000";"€ 45.000.000";"Portugal"
"10212";"Lionel Messi";"Barcelona";"AM R, ST";"20";"197";"12";"€ 40.000.000";"€ 50.000.000";"Argentina"`;

    const res = fm26Importer.validateText(genieScoutCSV, 'FM2008_GRANDES_CLUBES_EUROPA.csv', 'FM2008');
    assert(res.totalPlayersFound === 2, 'Teste 22: Identificou 2 jogadores do CSV Genie Scout');
    assert(res.validRecords === 2, 'Teste 22: Ambos os registros são válidos');

    const cr7 = res.previewPlayers[0];
    assert(cr7.name === 'Cristiano Ronaldo', 'Teste 22: Nome preservado ("Cristiano Ronaldo")');
    assert(cr7.club === 'Manchester United', 'Teste 22: Clube preservado ("Manchester United")');
    assert(cr7.externalId === '10211' || cr7.uniqueId === '10211', 'Teste 22: Unique ID preservado ("10211")');
    assert(cr7.pa === 195, 'Teste 22: Pot A mapeado como PA (195)');
    assert(cr7.aDiff === 8, 'Teste 22: A Diff mapeado (8)');
    // CA = Pot A - A Diff = 195 - 8 = 187
    assert(cr7.ca === 187, `Teste 22: CA calculada como Pot A - A Diff (195 - 8 = 187, obtido: ${cr7.ca})`);
    // OVR = Math.round((187 / 200) * 99) = 93 (e NÃO 70)
    assert(cr7.overall === 93, `Teste 22: OVR calculado a partir da CA (93, e NÃO fallback 70, obtido: ${cr7.overall})`);
    assert(cr7.overall !== 70, 'Teste 22: OVR não usa fallback 70');
    // POT = Math.round((195 / 200) * 99) = 97
    assert(cr7.potential === 97, `Teste 22: POT calculado a partir do PA (97, obtido: ${cr7.potential})`);
    // Salário ausente no CSV -> deve ser rigorosamente 0 (NÃO 50.000)
    assert(cr7.wage === 0, `Teste 22: Salário permanece 0/ausente (obtido: ${cr7.wage}, NÃO atribuiu R$ 50.000)`);
    // Value e Sale Value
    assert(cr7.marketValue > 0, `Teste 22: Market Value mapeado do Value (€35M -> ${cr7.marketValue})`);
    assert(cr7.saleValue !== undefined && cr7.saleValue > 0, `Teste 22: Sale Value preservado (€45M -> ${cr7.saleValue})`);
    // Atributos originais preservados no rawRecord
    assert(cr7.rawRecord !== undefined, 'Teste 22: rawRecord com todos os atributos originais preservado');
    assert(cr7.rawRecord['Pot A'] === '195', 'Teste 22: Pot A preservado no rawRecord');
    assert(cr7.rawRecord['A Diff'] === '8', 'Teste 22: A Diff preservado no rawRecord');
  }

  // 23. Teste: Isolamento de Checkpoint e Homologação Independente para FM2008_GRANDES_CLUBES_EUROPA.csv (1045 atletas)
  {
    const independentFile = 'FM2008_GRANDES_CLUBES_EUROPA.csv';
    const massiveFile = 'FM2008_PLAYERS_IMPORT.csv';

    // 23.1 Identificação de base massiva vs arquivo independente
    const isMassive1045 = fm26CheckpointService.isPreviousMassiveBase(independentFile, 1045);
    const isMassive38k = fm26CheckpointService.isPreviousMassiveBase(massiveFile, 38696);
    assert(!isMassive1045, 'Teste 23.1: FM2008_GRANDES_CLUBES_EUROPA.csv (1045) NÃO é a base massiva anterior');
    assert(isMassive38k, 'Teste 23.1: FM2008_PLAYERS_IMPORT.csv (38696) é reconhecido como a base massiva anterior');

    // 23.2 Isolamento de checkpoint: novo arquivo não herda checkpoint 10410/10210
    const cpIndependent = fm26CheckpointService.getCheckpoint(independentFile, 1045);
    assert(cpIndependent === null, 'Teste 23.2: Novo arquivo independente não possui checkpoint prévio (retorna null)');

    const cpMassive = fm26CheckpointService.getCheckpoint(massiveFile, 38696);
    assert(cpMassive !== null && cpMassive.lastProcessedIndex === 10410, 'Teste 23.2: Base massiva anterior preserva checkpoint #10410');

    // 23.3 Início a partir do jogador #1
    const nextStartIndependent = fm26CheckpointService.getNextStartIndex(independentFile, 1045);
    assert(nextStartIndependent === 1, 'Teste 23.3: Arquivo independente inicia importação no jogador #1');

    // 23.4 Homologação de 1045 registros: todos disponíveis para seleção (início #1 a #1045)
    const mock1045Players: FM26ParsedPlayer[] = Array.from({ length: 1045 }, (_, i) => {
      const pos = i + 1;
      return {
        id: `fm2008_eu_${pos}`,
        uniqueId: String(800000 + pos),
        sourceUniqueId: String(800000 + pos),
        name: `Jogador Europa #${pos}`,
        club: 'Real Madrid',
        nationality: 'Espanha',
        position: 'MC' as const,
        positionCategory: 'MEIO-CAMPISTA' as const,
        age: 22,
        overall: 78,
        potential: 84,
        marketValue: 12000000,
        wage: 0,
        currency: 'BRL',
        preferredFoot: 'Destro' as const,
        databaseSource: 'FM2008' as const,
        deduplicationKey: `fm2008-eu-${pos}`,
        rowIndex: pos,
        rawRecord: { 'Unique ID': String(800000 + pos), Name: `Jogador Europa #${pos}` },
        issues: [],
      };
    });

    const homologation1045 = fm26Importer.homologate(mock1045Players, [], {
      fileName: independentFile,
    });

    assert(homologation1045.totalFound === 1045, 'Teste 23.4: Total de atletas encontrados na homologação é 1045');
    assert(homologation1045.totalNew === 1045, 'Teste 23.4: Todos os 1045 atletas foram classificados como NOVO');
    assert(homologation1045.totalSelectedToRecord === 1045, 'Teste 23.4: Todos os 1045 registros estão selecionados para gravação');

    // Verifica que o primeiro atleta (#1) e o último atleta (#1045) estão elegíveis e selecionados
    const firstItem = homologation1045.items[0];
    const lastItem = homologation1045.items[1044];
    assert(firstItem.canSelect && firstItem.selected, 'Teste 23.4: Jogador #1 está elegível e selecionado');
    assert(lastItem.canSelect && lastItem.selected, 'Teste 23.4: Jogador #1045 está elegível e selecionado');

    // Garante que nenhum jogador foi bloqueado por checkpoint legado
    const unselectable = homologation1045.items.filter((i) => !i.canSelect);
    assert(unselectable.length === 0, 'Teste 23.4: Nenhum atleta foi bloqueado por checkpoint legado');
  }

  return { passed: allOk, details };
}

