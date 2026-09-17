import { Player } from '../types';

/**
 * Normaliza strings para comparação e deduplicação:
 * - Converte para minúsculas
 * - Remove acentos / diacríticos
 * - Remove pontuações e caracteres especiais
 * - Colapsa múltiplos espaços em branco
 */
export function normalizeString(str?: string | null): string {
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
 * Gera uma chave determinística de deduplicação para o jogador:
 * 
 * 1. PRIORIDADE MÁXIMA (externalId do FM26):
 *    Se o jogador possui `externalId` (UID do Football Manager), a chave é baseada
 *    nesse identificador global único.
 * 
 * 2. FALLBACK COMPOSTO (Quando não há externalId):
 *    Combina:
 *    - Nome canônico normalizado (prioriza fullName, fallback para name)
 *    - Data de nascimento (ou idade se data de nascimento não existir)
 *    - Código de nacionalidade normalizado
 * 
 * 3. FALLBACK DE ID INTERNO:
 *    Se nada mais estiver presente, utiliza o id interno do FM Universe.
 */
export function generatePlayerDeduplicationKey(player: Partial<Player>): string {
  // 1. External ID (UID do Football Manager 26)
  if (player.externalId && player.externalId.trim()) {
    return `fmu_ext_${player.externalId.trim().toLowerCase()}`;
  }

  // 2. Fallback de dados canônicos
  const primaryName = normalizeString(player.fullName || player.name || player.shortName);
  const birthIdentifier = player.birthDate
    ? player.birthDate.trim()
    : player.age !== undefined
    ? `age_${player.age}`
    : 'unknown_birth';
  const nationality = normalizeString(player.nationalityCode || player.nationality || 'unknown_nat');

  if (primaryName) {
    const slugName = primaryName.replace(/\s+/g, '_');
    return `fmu_bio_${slugName}_${birthIdentifier}_${nationality}`;
  }

  // 3. Fallback de ID interno
  if (player.id) {
    return `fmu_id_${player.id}`;
  }

  return `fmu_temp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Verifica se dois jogadores são potencialmente o mesmo atleta,
 * evitando duplicações no banco de dados.
 */
export function arePlayersDuplicates(
  candidate: Partial<Player>,
  existing: Partial<Player>
): boolean {
  // Verificação direta por ID interno
  if (candidate.id && existing.id && candidate.id === existing.id) {
    return true;
  }

  // Verificação por externalId (UID do FM)
  if (candidate.externalId && existing.externalId) {
    return candidate.externalId.trim().toLowerCase() === existing.externalId.trim().toLowerCase();
  }

  // Verificação por chave determinística pré-calculada
  if (
    candidate.deduplicationKey &&
    existing.deduplicationKey &&
    candidate.deduplicationKey === existing.deduplicationKey
  ) {
    return true;
  }

  // Verificação calculando a chave biométrica
  const keyCandidate = generatePlayerDeduplicationKey(candidate);
  const keyExisting = generatePlayerDeduplicationKey(existing);

  if (keyCandidate === keyExisting) {
    return true;
  }

  // Validação secundária para nomes idênticos e mesma data de nascimento/idade + nacionalidade
  const candName = normalizeString(candidate.fullName || candidate.name);
  const existName = normalizeString(existing.fullName || existing.name);

  if (candName && candName === existName) {
    const sameNat =
      normalizeString(candidate.nationalityCode) === normalizeString(existing.nationalityCode) ||
      normalizeString(candidate.nationality) === normalizeString(existing.nationality);

    const sameBirth =
      (candidate.birthDate && candidate.birthDate === existing.birthDate) ||
      (candidate.age !== undefined && existing.age !== undefined && Math.abs(candidate.age - existing.age) <= 1);

    if (sameNat && sameBirth) {
      return true;
    }
  }

  return false;
}

/**
 * Localiza um jogador duplicado existente dentro de uma lista de atletas.
 */
export function findDuplicatePlayer(
  candidate: Partial<Player>,
  existingPlayers: Player[]
): Player | undefined {
  const candidateKey = candidate.deduplicationKey || generatePlayerDeduplicationKey(candidate);

  // 1. Busca rápida por Map de deduplicationKey / externalId / id
  for (const p of existingPlayers) {
    if (candidate.id && p.id === candidate.id) return p;
    if (candidate.externalId && p.externalId && candidate.externalId.trim().toLowerCase() === p.externalId.trim().toLowerCase()) {
      return p;
    }
    const pKey = p.deduplicationKey || generatePlayerDeduplicationKey(p);
    if (candidateKey === pKey) return p;
  }

  // 2. Fallback de verificação profunda
  return existingPlayers.find((p) => arePlayersDuplicates(candidate, p));
}
