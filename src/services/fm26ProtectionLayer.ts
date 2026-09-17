import { Player, Club, PlayerPosition, PositionCategory, PlayerStats } from '../types';
import { FM26ParsedPlayer, FM26HomologationItem } from '../types/fm26';

/**
 * Normaliza strings para comparação inequívoca e geração de chaves canônicas:
 * - Converte para minúsculas
 * - Remove acentos diacríticos
 * - Remove pontuações e símbolos
 * - Colapsa espaços em branco
 */
export function normalizeForCanonicalKey(str?: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * REGRA 1 DA IMPORTAÇÃO: Chave Canônica Inequívoca
 * Nome normalizado + Nacionalidade normalizada + Clube normalizado
 */
export function generateCanonicalKey(
  name: string,
  nationality: string,
  club: string
): string {
  const normName = normalizeForCanonicalKey(name);
  const normNat = normalizeForCanonicalKey(nationality);
  const normClub = normalizeForCanonicalKey(club);
  return `${normName}|${normNat}|${normClub}`;
}

/**
 * REGRA 1 DA IMPORTAÇÃO: ID Determinístico e Estável
 * Baseado na chave canônica inequívoca.
 * Reprocessar o mesmo jogador gera SEMPRE o mesmo ID imutável.
 */
export function generateDeterministicPlayerId(
  name: string,
  nationality: string,
  club: string,
  externalId?: string,
  databaseSource: 'FM2008' | 'FM26' | string = 'FM26'
): string {
  // Para a origem FM2008, o identificador obrigatório deve ser estritamente: fm2008_{uniqueId}
  // Nunca utilizar prefixo player-fm26- para FM2008.
  if (databaseSource === 'FM2008') {
    if (externalId && String(externalId).trim()) {
      const cleanExt = String(externalId).trim().replace(/[^a-zA-Z0-9_-]/g, '');
      if (cleanExt.length > 0) {
        return `fm2008_${cleanExt}`;
      }
    }
    const cleanName = normalizeForCanonicalKey(name).replace(/\s+/g, '-').slice(0, 30) || 'atleta';
    const key = generateCanonicalKey(name, nationality, club);
    let hash = 5381;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 33) ^ key.charCodeAt(i);
      hash |= 0;
    }
    const positiveHash = Math.abs(hash).toString(36);
    return `fm2008_${cleanName}_${positiveHash}`;
  }

  // Padrão FM26 (100% preservado)
  if (externalId && String(externalId).trim()) {
    const cleanExt = String(externalId).trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (cleanExt.length > 0) {
      return `player-fm26-${cleanExt}`;
    }
  }

  const key = generateCanonicalKey(name, nationality, club);
  const cleanName = normalizeForCanonicalKey(name).replace(/\s+/g, '-').slice(0, 30) || 'atleta';

  // Algoritmo determinístico DJB2 para hash de 32-bit invariante
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 33) ^ key.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash).toString(36);

  return `player-fm26-${cleanName}-${positiveHash}`;
}

/**
 * REGRA 5 DA IMPORTAÇÃO: Preservação Estrita e Atualização Não Destrutiva
 * Atualiza SOMENTE campos esportivos/técnicos vindos do FM26.
 * PRESERVA OBRIGATORIAMENTE:
 * - ID original do jogador
 * - Histórico completo (carreira, valores, histórico de clubes)
 * - Estatísticas completas (jogos, gols, assistências, cartões, notas, minutos)
 * - Vínculos de contrato e clubes internos já estabelecidos no save do FM Universe
 * - Estado de jogo (condição, moral, lesões, suspensões, forma recente)
 * - Fotos e avatares personalizados existentes
 */
export function mergeExistingPlayerWithFM26(
  existing: Player,
  parsed: FM26ParsedPlayer,
  batchId: string
): Player {
  const attributes = {
    pace: parsed.attributes?.pace ?? existing.attributes?.pace ?? parsed.overall,
    shooting: parsed.attributes?.shooting ?? existing.attributes?.shooting ?? Math.max(40, parsed.overall - 5),
    passing: parsed.attributes?.passing ?? existing.attributes?.passing ?? Math.max(40, parsed.overall - 3),
    dribbling: parsed.attributes?.dribbling ?? existing.attributes?.dribbling ?? Math.max(40, parsed.overall - 4),
    defending: parsed.attributes?.defending ?? existing.attributes?.defending ?? Math.max(30, parsed.overall - 10),
    physical: parsed.attributes?.physical ?? existing.attributes?.physical ?? Math.max(40, parsed.overall - 2),
  };

  const player: Player = {
    // 1. DADOS DE IDENTIFICAÇÃO PRESERVADOS
    id: existing.id, // OBRIGATÓRIO: O ID original NUNCA muda
    name: existing.name || parsed.name,
    fullName: existing.fullName || parsed.fullName || parsed.name,
    shortName: existing.shortName || parsed.name,
    knownAs: existing.knownAs || existing.name,
    jerseyNumber: existing.jerseyNumber || parsed.jerseyNumber || 10,
    nationality: existing.nationality || parsed.nationality || 'Brasil',
    nationalityCode: existing.nationalityCode || parsed.nationality?.substring(0, 3).toUpperCase() || 'BRA',

    // 2. VÍNCULO E CONTRATO PRESERVADOS
    clubId: existing.clubId, // Preserva o clube associado no save do FM Universe
    clubName: existing.clubName, // Preserva o nome do clube interno
    squadStatus: existing.squadStatus || 'Titular',
    contractUntil: existing.contractUntil || parsed.contractUntil || '2028-12-31',

    // 3. ESTATÍSTICAS E HISTÓRICO 100% PRESERVADOS (NUNCA ZERAR DADOS DO SAVE)
    stats: existing.stats, // Estatísticas atuais intactas
    starts: existing.starts,
    substituteAppearances: existing.substituteAppearances,

    // 4. ESTADO DE JOGO PRESERVADO
    status: existing.status || 'FIT',
    morale: existing.morale || 'Excelente',
    condition: existing.condition ?? 95,
    fatigue: existing.fatigue ?? 0,

    // 5. CAMPOS ATUALIZADOS A PARTIR DO FM26
    age: parsed.age > 0 ? parsed.age : existing.age,
    overall: parsed.overall > 0 ? parsed.overall : existing.overall,
    potential: parsed.potential > 0 ? parsed.potential : existing.potential,
    position: (parsed.position || existing.position) as PlayerPosition,
    positionCategory: (parsed.positionCategory || existing.positionCategory) as PositionCategory,
    secondaryPositions:
      parsed.secondaryPositions && parsed.secondaryPositions.length > 0
        ? parsed.secondaryPositions
        : existing.secondaryPositions || [],
    preferredFoot: parsed.preferredFoot || existing.preferredFoot || 'Destro',
    attributes,
    wage: parsed.wage > 0 ? parsed.wage : existing.wage,
    marketValue: parsed.marketValue > 0 ? parsed.marketValue : existing.marketValue,

    // 6. METADADOS E RASTREABILIDADE
    source: (existing.source as any) || (parsed.databaseSource === 'FM2008' ? 'FM2008' : 'FM26_EXPORT'),
    database: existing.database || (parsed.databaseSource === 'FM2008' ? 'FM2008' : 'FM26'),
    databaseSource: (existing.databaseSource as any) || (parsed.databaseSource === 'FM2008' ? 'FM2008' : 'FM26'),
    uniqueId: existing.uniqueId || parsed.uniqueId || parsed.externalId,
    sourceUniqueId: existing.sourceUniqueId || parsed.sourceUniqueId || parsed.externalId,
    importedAt: new Date().toISOString(),
    importBatchId: batchId,
    deduplicationKey: generateCanonicalKey(existing.name, existing.nationality, existing.clubName),
  };

  // Omitir birthDate completamente quando não estiver presente no existente nem no CSV
  const resolvedBirthDate = existing.birthDate || parsed.birthDate;
  if (resolvedBirthDate && typeof resolvedBirthDate === 'string' && resolvedBirthDate.trim()) {
    player.birthDate = resolvedBirthDate.trim();
  }

  if (existing.avatar) player.avatar = existing.avatar;
  if (existing.photo) player.photo = existing.photo;
  const resolvedSecondNat = existing.secondNationality || parsed.secondNationality;
  if (resolvedSecondNat && typeof resolvedSecondNat === 'string' && resolvedSecondNat.trim()) {
    player.secondNationality = resolvedSecondNat.trim();
  }
  if (existing.previousClub) player.previousClub = existing.previousClub;
  if (existing.previousClubId) player.previousClubId = existing.previousClubId;
  if (existing.contractStartDate) player.contractStartDate = existing.contractStartDate;
  if (existing.releaseClause !== undefined) player.releaseClause = existing.releaseClause;
  if (existing.seasonStats && existing.seasonStats.length > 0) player.seasonStats = [...existing.seasonStats];
  if (existing.careerHistory && existing.careerHistory.length > 0) player.careerHistory = [...existing.careerHistory];
  if (existing.valueHistory && existing.valueHistory.length > 0) player.valueHistory = [...existing.valueHistory];
  if (existing.previousClubs && existing.previousClubs.length > 0) player.previousClubs = [...existing.previousClubs];
  if (existing.isInjured !== undefined) player.isInjured = existing.isInjured;
  if (existing.injuryDetails) player.injuryDetails = existing.injuryDetails;
  if (existing.isSuspended !== undefined) player.isSuspended = existing.isSuspended;
  if (existing.suspensionDetails) player.suspensionDetails = existing.suspensionDetails;
  if (existing.recentForm && existing.recentForm.length > 0) player.recentForm = [...existing.recentForm];

  const resolvedExtId = parsed.externalId || existing.externalId;
  if (resolvedExtId && typeof resolvedExtId === 'string' && resolvedExtId.trim()) {
    player.externalId = resolvedExtId.trim();
  }

  if (parsed.technicalAttributes) player.technicalAttributes = parsed.technicalAttributes;
  if (parsed.mentalAttributes) player.mentalAttributes = parsed.mentalAttributes;
  if (parsed.physicalAttributes) player.physicalAttributes = parsed.physicalAttributes;
  if (parsed.goalkeeperAttributes) player.goalkeeperAttributes = parsed.goalkeeperAttributes;
  if (parsed.height) player.height = parsed.height;
  if (parsed.weight) player.weight = parsed.weight;
  if (parsed.weakFoot) player.weakFoot = parsed.weakFoot;
  if (parsed.personality) player.personality = parsed.personality;
  if (parsed.squadStatus) player.squadStatus = parsed.squadStatus;
  if (parsed.releaseClause) player.releaseClause = parsed.releaseClause;
  if (parsed.ca !== undefined) player.ca = parsed.ca;
  if (parsed.pa !== undefined) player.pa = parsed.pa;
  if (parsed.aDiff !== undefined) player.aDiff = parsed.aDiff;
  if (parsed.saleValue !== undefined) player.saleValue = parsed.saleValue;
  if (parsed.rawRecord) player.rawFMData = deepCleanUndefined(parsed.rawRecord);

  return deepCleanUndefined(player);
}

/**
 * Função utilitária recursiva para garantir que nenhuma chave com undefined
 * seja enviada ao Firestore, mesmo em objetos aninhados.
 */
export function deepCleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(deepCleanUndefined) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        cleaned[key] = deepCleanUndefined(val);
      }
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * REGRA 4 DA IMPORTAÇÃO: Criação Segura de Novo Jogador
 * Atribui ID determinístico e estável, marca source/database como "FM26",
 * e preenche valores seguros em harmonia com o FM Universe.
 */
export function createNewPlayerFromFM26(
  parsed: FM26ParsedPlayer,
  canonicalKey: string,
  batchId: string,
  allClubs: Club[] = []
): Player {
  const isFM2008 = parsed?.databaseSource === 'FM2008' || parsed?.id?.startsWith('fm2008_');
  const databaseSource: 'FM2008' | 'FM26' = isFM2008 ? 'FM2008' : 'FM26';
  const rawUid = parsed?.uniqueId || parsed?.sourceUniqueId || parsed?.externalId || (isFM2008 && parsed?.id?.startsWith('fm2008_') ? parsed.id.replace('fm2008_', '') : undefined);

  let deterministicId: string;
  if (isFM2008) {
    deterministicId = rawUid ? `fm2008_${rawUid}` : (parsed?.id || generateDeterministicPlayerId(parsed?.name || '', parsed?.nationality || '', parsed?.club || '', rawUid, 'FM2008'));
  } else {
    deterministicId = parsed?.id || generateDeterministicPlayerId(
      parsed?.name || '',
      parsed?.nationality || '',
      parsed?.club || '',
      parsed?.externalId,
      'FM26'
    );
  }

  const normClub = normalizeForCanonicalKey(parsed.club);
  const matchedClub = allClubs.find(
    (c) =>
      normalizeForCanonicalKey(c.name) === normClub ||
      normalizeForCanonicalKey(c.shortName) === normClub ||
      normalizeForCanonicalKey(c.slug) === normClub
  );

  const clubId = matchedClub ? matchedClub.id : `club-${normClub.replace(/\s+/g, '-') || 'sem-clube'}`;
  const clubName = matchedClub ? matchedClub.name : (parsed.club || 'Sem Clube');

  const defaultStats: PlayerStats = {
    matches: 0,
    goals: 0,
    assists: 0,
    averageRating: Number(((parsed.overall / 10) * 0.7 + 2.5).toFixed(1)),
    yellowCards: 0,
    redCards: 0,
    cleanSheets: 0,
    minutesPlayed: 0,
  };

  const attributes = {
    pace: parsed.attributes?.pace ?? parsed.overall,
    shooting: parsed.attributes?.shooting ?? Math.max(40, parsed.overall - 5),
    passing: parsed.attributes?.passing ?? Math.max(40, parsed.overall - 3),
    dribbling: parsed.attributes?.dribbling ?? Math.max(40, parsed.overall - 4),
    defending: parsed.attributes?.defending ?? Math.max(30, parsed.overall - 10),
    physical: parsed.attributes?.physical ?? Math.max(40, parsed.overall - 2),
  };

  const player: Player = {
    id: deterministicId,
    name: parsed.name,
    fullName: parsed.fullName || parsed.name,
    shortName: parsed.name,
    knownAs: parsed.name,
    age: parsed.age,
    nationality: parsed.nationality || 'Brasil',
    nationalityCode: parsed.nationality?.substring(0, 3).toUpperCase() || 'BRA',
    preferredFoot: parsed.preferredFoot || 'Destro',
    jerseyNumber: parsed.jerseyNumber || (parsed.overall > 85 ? 10 : 18),
    clubId,
    clubName,
    squadStatus: parsed.squadStatus || 'Titular',
    position: parsed.position as PlayerPosition,
    positionCategory: parsed.positionCategory as PositionCategory,
    secondaryPositions: parsed.secondaryPositions || [],
    overall: parsed.overall,
    potential: parsed.potential,
    attributes,
    wage: parsed.wage,
    marketValue: parsed.marketValue,
    contractUntil: parsed.contractUntil || '2028-12-31',
    stats: parsed.stats || defaultStats,
    status: 'FIT',
    condition: parsed.condition ?? 95,
    morale: 'Excelente',
    source: isFM2008 ? 'FM2008' : 'FM26_EXPORT',
    database: databaseSource,
    databaseSource: databaseSource,
    uniqueId: rawUid ? String(rawUid).trim() : undefined,
    sourceUniqueId: rawUid ? String(rawUid).trim() : undefined,
    externalId: rawUid ? String(rawUid).trim() : (parsed.externalId ? String(parsed.externalId).trim() : undefined),
    importedAt: new Date().toISOString(),
    importBatchId: batchId,
    deduplicationKey: canonicalKey,
  };

  // Omitir birthDate completamente se não estiver presente no CSV
  if (parsed.birthDate && typeof parsed.birthDate === 'string' && parsed.birthDate.trim()) {
    player.birthDate = parsed.birthDate.trim();
  }

  if (parsed.secondNationality && typeof parsed.secondNationality === 'string' && parsed.secondNationality.trim()) {
    player.secondNationality = parsed.secondNationality.trim();
  }

  if (parsed.externalId && typeof parsed.externalId === 'string' && parsed.externalId.trim()) {
    player.externalId = parsed.externalId.trim();
  }

  if (parsed.technicalAttributes) player.technicalAttributes = parsed.technicalAttributes;
  if (parsed.mentalAttributes) player.mentalAttributes = parsed.mentalAttributes;
  if (parsed.physicalAttributes) player.physicalAttributes = parsed.physicalAttributes;
  if (parsed.goalkeeperAttributes) player.goalkeeperAttributes = parsed.goalkeeperAttributes;
  if (parsed.height) player.height = parsed.height;
  if (parsed.weight) player.weight = parsed.weight;
  if (parsed.weakFoot) player.weakFoot = parsed.weakFoot;
  if (parsed.personality) player.personality = parsed.personality;
  if (parsed.releaseClause) player.releaseClause = parsed.releaseClause;
  if (parsed.ca !== undefined) player.ca = parsed.ca;
  if (parsed.pa !== undefined) player.pa = parsed.pa;
  if (parsed.aDiff !== undefined) player.aDiff = parsed.aDiff;
  if (parsed.saleValue !== undefined) player.saleValue = parsed.saleValue;
  if (parsed.rawRecord) player.rawFMData = deepCleanUndefined(parsed.rawRecord);

  return deepCleanUndefined(player);
}

/**
 * GUARDA DE PROTEÇÃO NÃO DESTRUTIVA
 * Verifica pré-condições e pós-condições matemáticas:
 * - Nenhum jogador existente foi deletado
 * - A contagem pós-importação é >= contagem pré-importação
 * - Todos os IDs existentes estão presentes no resultado
 */
export function verifyNonDestructiveIntegrity(
  originalPlayers: Player[],
  resultPlayers: Player[]
): { valid: boolean; error?: string } {
  if (resultPlayers.length < originalPlayers.length) {
    return {
      valid: false,
      error: `Violação não destrutiva detectada: a coleção resultante possui ${resultPlayers.length} jogadores, menor que os ${originalPlayers.length} originais.`,
    };
  }

  const resultSet = new Set(resultPlayers.map((p) => p.id));
  for (const original of originalPlayers) {
    if (!resultSet.has(original.id)) {
      return {
        valid: false,
        error: `Violação não destrutiva detectada: o jogador existente "${original.name}" (ID: ${original.id}) desapareceu da coleção. Operação abortada.`,
      };
    }
  }

  return { valid: true };
}

/**
 * EXECUTOR NÃO DESTRUTIVO E IDEMPOTENTE
 * Aplica as regras de importação garantindo que:
 * - Jogadores com chave canônica correspondente são atualizados (preservando dados internos)
 * - Jogadores sem correspondência são criados como novos com ID determinístico
 * - Jogadores existentes que não estão no CSV permanecem 100% intactos
 * - Executar o mesmo CSV repetidas vezes não duplica registros
 */
export function executeNonDestructiveMerge(
  existingPlayers: Player[],
  homologatedItems: FM26HomologationItem[],
  batchId: string,
  allClubs: Club[] = []
): {
  mergedPlayers: Player[];
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
} {
  // Mapeia jogadores existentes por chave canônica e por ID
  const existingByCanonicalKey = new Map<string, Player>();
  const existingById = new Map<string, Player>();

  for (const p of existingPlayers) {
    existingById.set(p.id, p);
    const key = generateCanonicalKey(
      p.name,
      p.nationality || p.nationalityCode || '',
      p.clubName || ''
    );
    existingByCanonicalKey.set(key, p);

    if (p.fullName && p.fullName !== p.name) {
      const fullKey = generateCanonicalKey(
        p.fullName,
        p.nationality || p.nationalityCode || '',
        p.clubName || ''
      );
      existingByCanonicalKey.set(fullKey, p);
    }
  }

  const updatedIds = new Set<string>();
  const newPlayersToAdd: Player[] = [];
  let updatedCount = 0;

  const validItems = homologatedItems.filter(
    (item) => (item.action === 'NOVO' && item.selected && item.canSelect) || item.action === 'ATUALIZAR'
  );

  for (const item of validItems) {
    const key = generateCanonicalKey(
      item.parsedPlayer.name,
      item.parsedPlayer.nationality,
      item.parsedPlayer.club
    );

    // Correspondência inequívoca pela chave canônica ou pelo ID do item existente
    const existing =
      (item.existingPlayerId ? existingById.get(item.existingPlayerId) : undefined) ||
      existingByCanonicalKey.get(key);

    if (existing) {
      // REGRA 5: ATUALIZAR preservando campos internos
      const merged = mergeExistingPlayerWithFM26(existing, item.parsedPlayer, batchId);
      existingById.set(existing.id, merged);
      updatedIds.add(existing.id);
      updatedCount++;
    } else {
      // REGRA 4: NOVO jogador com ID determinístico
      const newPlayer = createNewPlayerFromFM26(item.parsedPlayer, key, batchId, allClubs);
      // Evita duplicatas internas dentro da mesma lista
      if (!existingById.has(newPlayer.id)) {
        newPlayersToAdd.push(newPlayer);
        existingById.set(newPlayer.id, newPlayer);
        existingByCanonicalKey.set(key, newPlayer);
      }
    }
  }

  // Monta a lista final completa preservando todos os jogadores existentes
  const mergedPlayers: Player[] = [];
  for (const [id, player] of existingById.entries()) {
    mergedPlayers.push(player);
  }

  const newCount = newPlayersToAdd.length;
  const unchangedCount = existingPlayers.length - updatedIds.size;

  // Validação estrita não destrutiva
  const integrity = verifyNonDestructiveIntegrity(existingPlayers, mergedPlayers);
  if (!integrity.valid) {
    throw new Error(integrity.error);
  }

  return {
    mergedPlayers,
    newCount,
    updatedCount,
    unchangedCount,
  };
}
