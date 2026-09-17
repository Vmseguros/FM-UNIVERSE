import { validateCSVContent, detectDelimiter } from './fm26Validator';
import {
  normalizePlayerRow,
  parseMonetaryBRL,
  parseDateISO,
  parseHeightCm,
  parseWeightKg,
  normalizeFoot,
  normalizeRating,
  parsePositionsString,
} from './fm26Normalizer';
import {
  createNewPlayerFromFM26,
  generateDeterministicPlayerId,
  generateCanonicalKey,
  deepCleanUndefined,
} from './fm26ProtectionLayer';
import { Player } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[FALHA NO TESTE]: ${message}`);
  }
}

function checkNoUndefinedDeep(obj: any, path = ''): void {
  if (obj === null || obj === undefined) {
    if (obj === undefined) {
      throw new Error(`Encontrado 'undefined' no caminho: ${path}`);
    }
    return;
  }
  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val === undefined) {
        throw new Error(`Encontrado 'undefined' na chave: ${path ? `${path}.${key}` : key}`);
      }
      checkNoUndefinedDeep(val, path ? `${path}.${key}` : key);
    }
  }
}

export function runComprehensiveFM26ParserTests(): void {
  console.log('[FM26 COMPREHENSIVE TEST SUITE] Iniciando testes do padrão CSV...');

  // 1. TESTE: CSV Mínimo (Name, Club, Nationality, Age, Position)
  {
    const csvMin = `Name;Club;Nationality;Age;Position
Erling Haaland;Manchester City;Norway;24;ST`;
    const res = validateCSVContent(csvMin, 'minimo.csv');
    assert(res.totalPlayersFound === 1, '1. CSV Mínimo: 1 jogador reconhecido');
    assert(res.validRecords === 1, '1. CSV Mínimo: registro válido');
    const p = res.allPlayers[0];
    assert(p.name === 'Erling Haaland', '1. CSV Mínimo: Nome correto');
    assert(p.club === 'Manchester City', '1. CSV Mínimo: Clube correto');
    assert(p.nationality === 'Norway', '1. CSV Mínimo: Nacionalidade correta');
    assert(p.age === 24, '1. CSV Mínimo: Idade correta');
    assert(p.position === 'ST', '1. CSV Mínimo: Posição correta');
  }

  // 2. TESTE: CSV Completo com todos os campos da especificação
  {
    const csvFull = `UID;Name;Full Name;Club;Nationality;Second Nationality;Age;DoB;Position;Preferred Foot;Weak Foot;Squad Number;Height;Weight;Value;Wage;Expires;Release Clause;Squad Status;CA;PA;Personality;Corners;Crossing;Dribbling;Finishing;First Touch;Free Kicks;Heading;Long Shots;Long Throws;Marking;Passing;Penalty Taking;Tackling;Technique;Aggression;Anticipation;Bravery;Composure;Concentration;Decisions;Determination;Flair;Leadership;Off the Ball;Positioning;Teamwork;Vision;Work Rate;Acceleration;Agility;Balance;Jumping Reach;Natural Fitness;Pace;Stamina;Strength;Apps;Goals;Assists;Av Rat;Yellow Cards;Red Cards;Clean Sheets;Minutes
1001;Gabriel Martinelli;Gabriel Teodoro Martinelli Silva;Arsenal;Brazil;Italy;23;18/06/2001;LW, ST;Destro;3;11;178 cm;75 kg;€80.000.000;£180.000;30/06/2028;€120.000.000;Importante;165;178;Determinado;13;15;16;15;16;11;12;14;7;8;14;14;9;16;15;16;15;15;14;14;18;16;12;16;10;17;15;18;17;16;15;13;16;18;17;14;35;12;8;7.35;3;0;0;2840`;

    const res = validateCSVContent(csvFull, 'completo.csv');
    assert(res.totalPlayersFound === 1, '2. CSV Completo: 1 jogador reconhecido');
    const p = res.allPlayers[0];
    assert(p.externalId === '1001', '2. CSV Completo: UID capturado como externalId');
    assert(p.fullName === 'Gabriel Teodoro Martinelli Silva', '2. CSV Completo: Nome completo correto');
    assert(p.secondNationality === 'Italy', '2. CSV Completo: Segunda nacionalidade correta');
    assert(p.birthDate === '2001-06-18', '2. CSV Completo: Data de nascimento formatada YYYY-MM-DD');
    assert(p.height === 178, '2. CSV Completo: Altura em cm normalizada');
    assert(p.weight === 75, '2. CSV Completo: Peso em kg normalizado');
    assert(p.jerseyNumber === 11, '2. CSV Completo: Número da camisa correto');
    assert(p.secondaryPositions?.includes('ST') === true, '2. CSV Completo: Posição secundária ST detectada');
    assert(p.personality === 'Determinado', '2. CSV Completo: Personalidade capturada');
    assert(p.releaseClause !== undefined && p.releaseClause > 0, '2. CSV Completo: Multa rescisória calculada');
    assert(p.technicalAttributes?.finishing === 15, '2. CSV Completo: Atributo técnico finishing 15');
    assert(p.mentalAttributes?.determination === 18, '2. CSV Completo: Atributo mental determination 18');
    assert(p.physicalAttributes?.pace === 18, '2. CSV Completo: Atributo físico pace 18');
    assert(p.stats?.goals === 12, '2. CSV Completo: Gols 12');
    assert(p.stats?.assists === 8, '2. CSV Completo: Assistências 8');
    assert(p.stats?.averageRating === 7.35, '2. CSV Completo: Nota média 7.35');
  }

  // 3. TESTE: CSV em Português
  {
    const csvPT = `Nome;Clube;Idade;Posição;Pé Preferido;Nacionalidade;Valor de Mercado;Salário Mensal;CA;PA;Finalização;Passe;Desarme;Velocidade;Partidas;Gols
Vinicius Junior;Real Madrid;24;PE;Destro;Brasil;R$ 750.000.000;R$ 8.500.000;182;192;17;16;8;19;38;21`;
    const res = validateCSVContent(csvPT, 'export_pt.csv');
    assert(res.totalPlayersFound === 1, '3. Português: 1 jogador reconhecido');
    const p = res.allPlayers[0];
    assert(p.name === 'Vinicius Junior', '3. Português: Nome reconhecido');
    assert(p.position === 'LW', '3. Português: Posição PE mapeada para LW');
    assert(p.marketValue === 750000000, '3. Português: Valor de mercado R$ 750M');
    assert(p.wage === 8500000, '3. Português: Salário mensal R$ 8.5M');
    assert(p.technicalAttributes?.finishing === 17, '3. Português: Finalização 17');
    assert(p.technicalAttributes?.passing === 16, '3. Português: Passe 16');
    assert(p.technicalAttributes?.tackling === 8, '3. Português: Desarme 8');
    assert(p.physicalAttributes?.pace === 19, '3. Português: Velocidade 19');
    assert(p.stats?.goals === 21, '3. Português: Gols 21');
  }

  // 4. TESTE: CSV em Inglês
  {
    const csvEN = `Name;Club;Age;Position;Preferred Foot;Nationality;Market Value;Wage;CA;PA;Finishing;Passing;Tackling;Pace;Appearances;Goals
Cole Palmer;Chelsea;22;CAM;Canhoto;England;€90.000.000;£120.000;168;184;16;17;7;15;34;18`;
    const res = validateCSVContent(csvEN, 'export_en.csv');
    assert(res.totalPlayersFound === 1, '4. Inglês: 1 jogador reconhecido');
    const p = res.allPlayers[0];
    assert(p.name === 'Cole Palmer', '4. Inglês: Nome reconhecido');
    assert(p.position === 'CAM', '4. Inglês: Posição CAM');
    assert(p.nationality === 'England', '4. Inglês: Nacionalidade England');
    assert(p.stats?.goals === 18, '4. Inglês: Goals 18');
  }

  // 5. TESTE: Separador TAB (\t)
  {
    const csvTab = "Name\tClub\tNationality\tAge\tPosition\tCA\tPA\nRodri\tManchester City\tSpain\t28\tCDM\t185\t188";
    const delimiter = detectDelimiter(csvTab.split('\n')[0]);
    assert(delimiter === '\t', '5. TAB: Delimitador \\t detectado automaticamente');
    const res = validateCSVContent(csvTab, 'tab_export.tsv');
    assert(res.totalPlayersFound === 1, '5. TAB: Jogador processado via delimitador TAB');
    assert(res.allPlayers[0].name === 'Rodri', '5. TAB: Nome correto');
    assert(res.allPlayers[0].position === 'CDM', '5. TAB: Posição CDM');
  }

  // 6. TESTE: Separador Ponto e Vírgula (;)
  {
    const csvSemi = "Name;Club;Nationality;Age;Position\nDeclan Rice;Arsenal;England;25;CDM";
    const delimiter = detectDelimiter(csvSemi.split('\n')[0]);
    assert(delimiter === ';', '6. Ponto e Vírgula: Delimitador ; detectado');
    const res = validateCSVContent(csvSemi, 'semi.csv');
    assert(res.totalPlayersFound === 1, '6. Ponto e Vírgula: Jogador processado');
    assert(res.allPlayers[0].name === 'Declan Rice', '6. Ponto e Vírgula: Declan Rice');
  }

  // 7. TESTE: BOM UTF-8 (\uFEFF)
  {
    const csvBOM = "\uFEFFName;Club;Nationality;Age;Position\nAlisson;Liverpool;Brazil;32;GK";
    const res = validateCSVContent(csvBOM, 'bom_export.csv');
    assert(res.totalPlayersFound === 1, '7. BOM UTF-8: Reconhecido sem corromper o primeiro cabeçalho');
    assert(res.allPlayers[0].name === 'Alisson', '7. BOM UTF-8: Jogador Alisson');
    assert(res.allPlayers[0].position === 'GK', '7. BOM UTF-8: Posição GK');
  }

  // 8. TESTE: Campos Opcionais Ausentes
  {
    const csvOptionalMissing = `Name;Club;Nationality;Age;Position
Lamine Yamal;Barcelona;Spain;17;RW`;
    const res = validateCSVContent(csvOptionalMissing, 'opcionais_ausentes.csv');
    assert(res.totalPlayersFound === 1, '8. Opcionais Ausentes: Processado com sucesso');
    const p = res.allPlayers[0];
    assert(p.externalId === undefined, '8. Opcionais Ausentes: externalId undefined no parsed');
    assert(p.releaseClause === undefined, '8. Opcionais Ausentes: releaseClause undefined no parsed');
    assert(p.stats === undefined, '8. Opcionais Ausentes: stats undefined no parsed');
  }

  // 9. TESTE: Valores Vazios ou "-"
  {
    const csvDashes = `Name;Club;Nationality;Age;Position;Height;Weight;Release Clause;Second Nationality
Endrick;Real Madrid;Brazil;18;ST;-;N/A;—;-`;
    const res = validateCSVContent(csvDashes, 'dashes.csv');
    assert(res.totalPlayersFound === 1, '9. Valores -: Processado com sucesso');
    const p = res.allPlayers[0];
    assert(p.height === undefined, '9. Valores -: Altura "-" tratada como undefined');
    assert(p.weight === undefined, '9. Valores -: Peso "N/A" tratado como undefined');
    assert(p.releaseClause === undefined, '9. Valores -: Release clause "—" tratada como undefined');
    assert(p.secondNationality === undefined, '9. Valores -: Segunda nacionalidade "-" tratada como undefined');
  }

  // 10. TESTE: Normalização de CA / PA 1-200 para 1-99
  {
    const ca200 = 190;
    const pa200 = 198;
    const ovr99 = normalizeRating(ca200);
    const pot99 = normalizeRating(pa200);
    assert(ovr99 >= 90 && ovr99 <= 99, `10. CA/PA: CA ${ca200} convertido para ${ovr99} (faixa 90-99)`);
    assert(pot99 >= 95 && pot99 <= 99, `10. CA/PA: PA ${pa200} convertido para ${pot99} (faixa 95-99)`);
    assert(pot99 >= ovr99, '10. CA/PA: PA maior ou igual a CA');
  }

  // 11. TESTE: Atributos 1-20 e Atributos de Goleiro
  {
    const csvGK = `Name;Club;Nationality;Age;Position;Aerial Reach;Command of Area;Handling;Kicking;Reflexes
Thibaut Courtois;Real Madrid;Belgium;32;GK;18;17;19;15;19`;
    const res = validateCSVContent(csvGK, 'gk.csv');
    const p = res.allPlayers[0];
    assert(p.position === 'GK', '11. Atributos GK: Posição GK');
    assert(p.goalkeeperAttributes?.aerialReach === 18, '11. Atributos GK: aerialReach 18');
    assert(p.goalkeeperAttributes?.handling === 19, '11. Atributos GK: handling 19');
    assert(p.goalkeeperAttributes?.reflexes === 19, '11. Atributos GK: reflexes 19');
    assert(p.attributes?.defending !== undefined && p.attributes.defending >= 80, '11. Atributos GK: defending derivado dos atributos de goleiro');
  }

  // 12. TESTE: UID Presente gera externalId e prefixo determinístico com UID
  {
    const csvUID = `UID;Name;Club;Nationality;Age;Position
8704294;Luka Modric;Real Madrid;Croatia;39;CM`;
    const res = validateCSVContent(csvUID, 'uid.csv');
    const parsed = res.allPlayers[0];
    assert(parsed.externalId === '8704294', '12. UID Presente: externalId capturado');
    const player = createNewPlayerFromFM26(parsed, parsed.deduplicationKey, 'batch-test-uid');
    assert(player.id.includes('8704294'), '12. UID Presente: ID do atleta contém o UID externo determinístico');
  }

  // 13. TESTE: UID Ausente gera determinismo estável invariante
  {
    const key = generateCanonicalKey('Federico Valverde', 'Uruguay', 'Real Madrid');
    const id1 = generateDeterministicPlayerId('Federico Valverde', 'Uruguay', 'Real Madrid');
    const id2 = generateDeterministicPlayerId('Federico Valverde', 'Uruguay', 'Real Madrid');
    assert(id1 === id2, '13. UID Ausente: Reprocessamento gera exatamente o mesmo ID determinístico');
    assert(id1.startsWith('player-fm26-'), '13. UID Ausente: Prefixo estável player-fm26- atribuído');
  }

  // 14. TESTE: Garantia de que NENHUM `undefined` seja produzido em Player
  {
    const csvBare = `Name;Club;Nationality;Age;Position
Bukayo Saka;Arsenal;England;23;RW`;
    const res = validateCSVContent(csvBare, 'bare.csv');
    const parsed = res.allPlayers[0];
    const player = createNewPlayerFromFM26(parsed, parsed.deduplicationKey, 'batch-clean-test');

    // Validação recursiva estrita de ausência de 'undefined'
    checkNoUndefinedDeep(player);

    // Validação de serialização JSON (Firestore SDK rejeita undefined)
    const jsonStr = JSON.stringify(player);
    assert(!jsonStr.includes('undefined'), '14. Sem Undefined: Nenhuma ocorrência de undefined em JSON');

    // Validação dos campos obrigatórios da entidade Player
    assert(player.id.length > 0, '14. Player válido: id presente');
    assert(player.name === 'Bukayo Saka', '14. Player válido: name presente');
    assert(player.clubId.length > 0, '14. Player válido: clubId presente');
    assert(player.clubName === 'Arsenal', '14. Player válido: clubName presente');
    assert(player.nationalityCode.length === 3, '14. Player válido: nationalityCode presente');
    assert(player.stats.matches === 0, '14. Player válido: stats.matches presente');
    assert(player.stats.goals === 0, '14. Player válido: stats.goals presente');
    assert(player.status === 'FIT', '14. Player válido: status presente');
    assert(player.condition === 95, '14. Player válido: condition presente');
    assert(player.morale === 'Excelente', '14. Player válido: morale presente');
  }

  console.log('[FM26 COMPREHENSIVE TEST SUITE] ✅ TODOS OS 14 TESTES PASSARAM COM SUCESSO!');
}
