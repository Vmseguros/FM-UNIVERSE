import { Player, Club } from '../types';
import {
  FM26ParsedPlayer,
  FM26HomologationItem,
  FM26HomologationSummary,
  FM26CommitResult,
  FM26ImportAuditRecord,
} from '../types/fm26';
import { cleanText } from './fm26Normalizer';
import { jogadoresService } from './jogadoresService';
import { clubesService } from './clubesService';
import { fm26AuditService } from './fm26AuditService';
import { fm26BatchService } from './fm26BatchService';
import { fm26CheckpointService } from './fm26CheckpointService';
import {
  normalizeForCanonicalKey,
  generateCanonicalKey,
  generateDeterministicPlayerId as generateStablePlayerId,
  mergeExistingPlayerWithFM26,
  createNewPlayerFromFM26,
  verifyNonDestructiveIntegrity,
} from './fm26ProtectionLayer';

/**
 * Normaliza strings para comparação e deduplicação estrita.
 */
export function normalizeForComparison(str?: string | null): string {
  return normalizeForCanonicalKey(str);
}

/**
 * REGRA 1 DA IMPORTAÇÃO: Chave Canônica Inequívoca
 * Nome normalizado + Nacionalidade normalizada + Clube normalizado
 */
export function generateHomologationKey(
  name: string,
  nationality: string,
  club: string
): string {
  return generateCanonicalKey(name, nationality, club);
}

/**
 * REGRA 1 DA IMPORTAÇÃO: ID determinístico e estável para novos atletas.
 * Reprocessar o mesmo atleta gera sempre o mesmo ID invariante.
 */
export function generateDeterministicPlayerId(
  parsed: FM26ParsedPlayer,
  key: string
): string {
  const dbSource = parsed.databaseSource || (parsed.id?.startsWith('fm2008_') ? 'FM2008' : 'FM26');
  const rawUid = parsed.uniqueId || parsed.sourceUniqueId || parsed.externalId || (dbSource === 'FM2008' && parsed.id?.startsWith('fm2008_') ? parsed.id.replace('fm2008_', '') : undefined);
  if (dbSource === 'FM2008' && rawUid) {
    return `fm2008_${String(rawUid).trim()}`;
  }
  return generateStablePlayerId(parsed.name, parsed.nationality, parsed.club, rawUid, dbSource);
}

/**
 * Converte um item homologado para a entidade canônica Player do FM Universe,
 * aplicando estritamente as regras de preservação e atualização não destrutiva.
 */
export function convertHomologatedToPlayer(
  item: FM26HomologationItem,
  existingPlayer?: Player,
  allClubs: Club[] = [],
  batchId = 'batch-fm26-manual'
): Player {
  const parsed = item.parsedPlayer || (item as unknown as FM26ParsedPlayer);
  if (existingPlayer) {
    // REGRA 5: Preservação estrita de IDs, estatísticas, histórico, contratos e dados internos
    return mergeExistingPlayerWithFM26(existingPlayer, parsed, batchId);
  }

  // REGRA 4: Criação segura de novo atleta com ID determinístico e source/database="FM26"
  return createNewPlayerFromFM26(parsed, item.comparisonKey || (parsed as any)?.comparisonKey || '', batchId, allClubs);
}

export interface BuildHomologationOptions {
  checkpoint?: number;
  startIndex?: number;
  endIndex?: number;
  batchSize?: number;
  fileName?: string;
  totalRecords?: number;
}

export const fm26HomologationService = {
  /**
   * Ajusta dinamicamente a seleção de itens de uma homologação existente para um lote específico de 200.
   * REGRAS DE OURO:
   * 1. Nunca seleciona todos os jogadores do CSV.
   * 2. Com checkpoint = 10.210, seleciona exclusivamente as posições 10.211 até 10.410 (200 jogadores).
   * 3. Jogadores 1 até 10.210 ficam estritamente fora da seleção (canSelect: false, selected: false).
   * 4. Jogadores 10.411 em diante também ficam fora da seleção (canSelect: false, selected: false).
   */
  applyBatchRangeSelection(
    homologation: FM26HomologationSummary,
    startIndex: number,
    batchSize: number = 200
  ): FM26HomologationSummary {
    const endIndex = startIndex + batchSize - 1;
    let totalNew = 0;
    let totalUpdate = 0;

    const updatedItems = homologation.items.map((item, idx) => {
      const position = idx + 1; // 1-based index no arquivo
      if (item.action === 'ERRO' || item.action === 'IGNORAR/DUPLICADO') {
        return { ...item, selected: false, canSelect: false };
      }
      if (item.action === 'ATUALIZAR') {
        totalUpdate++;
        return { ...item, selected: false, canSelect: false };
      }
      // Ação: NOVO
      totalNew++;
      const isInBatch = position >= startIndex && position <= endIndex;
      const isBefore = position < startIndex;

      if (isInBatch) {
        return {
          ...item,
          selected: true,
          canSelect: true,
          reason: `Novo atleta identificado (#${position}). Selecionado para este lote de gravação (#${startIndex} a #${endIndex}).`,
        };
      }

      return {
        ...item,
        selected: false,
        canSelect: false,
        reason: isBefore
          ? `Fora da seleção: Atleta anterior ao checkpoint (posições 1 a ${startIndex - 1} já gravadas/processadas).`
          : `Fora da seleção: Atleta posterior ao lote atual (posições após #${endIndex} reservadas para os próximos lotes).`,
      };
    });

    const totalSelectedToRecord = updatedItems.filter((i) => i.selected && i.canSelect).length;

    return {
      ...homologation,
      totalNew,
      totalUpdate,
      totalProtected: totalUpdate,
      totalSelectedToRecord,
      items: updatedItems,
    };
  },

  /**
   * Garante que todos os atletas elegíveis (ação NOVO) de um arquivo independente
   * estejam disponíveis para seleção (canSelect: true) e marcados (selected: true).
   */
  ensureAllEligibleSelected(homologation: FM26HomologationSummary): FM26HomologationSummary {
    const totalCount = homologation.items.length;
    let totalNew = 0;
    let totalUpdate = 0;

    const updatedItems = homologation.items.map((item, idx) => {
      const position = idx + 1;
      if (item.action === 'ERRO' || item.action === 'IGNORAR/DUPLICADO') {
        return { ...item, selected: false, canSelect: false };
      }
      if (item.action === 'ATUALIZAR') {
        totalUpdate++;
        return { ...item, selected: false, canSelect: false };
      }
      totalNew++;
      return {
        ...item,
        selected: true,
        canSelect: true,
        reason: `Novo atleta identificado (#${position}). Disponível para homologação e seleção (#1 a #${totalCount}).`,
      };
    });

    const totalSelectedToRecord = updatedItems.filter((i) => i.selected && i.canSelect).length;

    return {
      ...homologation,
      totalNew,
      totalUpdate,
      totalProtected: totalUpdate,
      totalSelectedToRecord,
      items: updatedItems,
    };
  },

  /**
   * Constrói a homologação cruzando os registros do CSV com a base do banco.
   * Aplica estritamente o checkpoint para selecionar SOMENTE o próximo lote de 200 atletas.
   */
  buildHomologation(
    parsedPlayers: FM26ParsedPlayer[],
    existingPlayers: Player[],
    options?: BuildHomologationOptions
  ): FM26HomologationSummary {
    // 1. Mapeia jogadores existentes por chave de homologação, por externalId e por ID direto
    const existingMap = new Map<string, Player>();
    const existingByExtId = new Map<string, Player>();
    const existingById = new Map<string, Player>();

    for (const p of existingPlayers) {
      if (p.id) {
        existingById.set(p.id.toLowerCase(), p);
      }
      const key = generateHomologationKey(
        p.name || p.fullName || '',
        p.nationality || p.nationalityCode || '',
        p.clubName || ''
      );
      existingMap.set(key, p);

      if (p.fullName && p.fullName !== p.name) {
        const altKey = generateHomologationKey(
          p.fullName,
          p.nationality || p.nationalityCode || '',
          p.clubName || ''
        );
        existingMap.set(altKey, p);
      }

      if (p.externalId && p.externalId.trim()) {
        existingByExtId.set(p.externalId.trim().toLowerCase(), p);
      }
    }

    // Determina o intervalo do lote baseado no checkpoint e no arquivo
    const totalCount = parsedPlayers.length;
    const fileName = options?.fileName || '';
    const isMassive = fm26CheckpointService.isPreviousMassiveBase(fileName, totalCount);

    let effectiveCheckpoint = options?.checkpoint;

    if (effectiveCheckpoint === undefined) {
      if (fileName) {
        const cp = fm26CheckpointService.getCheckpoint(fileName, totalCount);
        if (cp && cp.lastProcessedIndex > 0) {
          effectiveCheckpoint = cp.lastProcessedIndex;
        }
      }
      if (effectiveCheckpoint === undefined) {
        if (isMassive) {
          effectiveCheckpoint = 10410; // Checkpoint de produção FM2008 base massiva
        } else {
          effectiveCheckpoint = 0; // Novo arquivo independente inicia rigorosamente do jogador #1
        }
      }
    }

    const batchSize = options?.batchSize;
    let batchStartIndex: number;
    if (options?.startIndex && options.startIndex > 0) {
      batchStartIndex = options.startIndex;
    } else if (effectiveCheckpoint > 0) {
      batchStartIndex = effectiveCheckpoint + 1;
    } else {
      batchStartIndex = 1;
    }

    let batchEndIndex: number;
    if (options?.endIndex && options.endIndex >= batchStartIndex) {
      batchEndIndex = options.endIndex;
    } else if (batchSize && batchSize > 0) {
      batchEndIndex = Math.min(totalCount, batchStartIndex + batchSize - 1);
    } else if (isMassive) {
      // Base massiva de 38.696 jogadores usa lote estrito de 200
      batchEndIndex = Math.min(totalCount, batchStartIndex + 199);
    } else {
      // Arquivos independentes (ex: 1.045 atletas): todos os registros disponíveis para seleção
      batchEndIndex = totalCount;
    }

    // 2. Classificação de cada registro do CSV
    const seenInCSV = new Map<string, number>(); // key -> row
    const items: FM26HomologationItem[] = [];

    let totalNew = 0;
    let totalUpdate = 0;
    let totalDuplicate = 0;
    let totalInvalid = 0;

    for (let i = 0; i < parsedPlayers.length; i++) {
      const parsed = parsedPlayers[i];
      const position = i + 1; // 1-based index no CSV

      const isInvalid =
        !cleanText(parsed.name) ||
        parsed.name.startsWith('Jogador Linha ') ||
        parsed.age < 12 ||
        parsed.overall < 1;

      if (isInvalid) {
        totalInvalid++;
        items.push({
          id: `invalid-${parsed.rowIndex}`,
          parsedPlayer: parsed,
          action: 'ERRO',
          reason: 'Registro com dados inválidos ou nome em branco.',
          comparisonKey: '',
          selected: false,
          canSelect: false,
          issues: ['Nome em branco ou atributos corrompidos.'],
        });
        continue;
      }

      const key = generateHomologationKey(parsed.name, parsed.nationality, parsed.club);

      // Duplicado no próprio CSV
      if (seenInCSV.has(key)) {
        const origRow = seenInCSV.get(key)!;
        totalDuplicate++;
        items.push({
          id: `dup-${parsed.rowIndex}`,
          parsedPlayer: parsed,
          action: 'IGNORAR/DUPLICADO',
          reason: `Duplicata interna do atleta da linha ${origRow} do CSV.`,
          comparisonKey: key,
          selected: false,
          canSelect: false,
          issues: [`Mesmo nome, clube e nacionalidade da linha ${origRow}.`],
        });
        continue;
      }

      seenInCSV.set(key, parsed.rowIndex);

      // Checa se já existe no banco de dados por externalId, ID determinístico ou chave canônica
      const deterministicId = parsed.id && (parsed.id.startsWith('fm2008_') || parsed.id.startsWith('player-fm26-'))
        ? parsed.id
        : generateDeterministicPlayerId(parsed, key);

      const isFM2008 = parsed.databaseSource === 'FM2008' || deterministicId.startsWith('fm2008_');
      let existing: Player | undefined;

      if (isFM2008) {
        // Origem FM2008: busca exclusivamente registros FM2008 por ID determinístico ou UID original
        const candidate =
          existingById.get(deterministicId.toLowerCase()) ||
          (parsed.externalId ? existingByExtId.get(parsed.externalId.trim().toLowerCase()) : undefined);

        // Se o registro encontrado pertencer a outra origem (ex: FM26), NÃO mescla
        if (candidate && (candidate.id.startsWith('fm2008_') || candidate.databaseSource === 'FM2008')) {
          existing = candidate;
        }
      } else {
        // Origem FM26: preserva integridade e lógica do FM26
        existing =
          (parsed.externalId ? existingByExtId.get(parsed.externalId.trim().toLowerCase()) : undefined) ||
          existingById.get(deterministicId.toLowerCase()) ||
          existingMap.get(key);
      }

      if (existing) {
        totalUpdate++;
        items.push({
          id: existing.id, // Preserva exatamente o ID existente
          parsedPlayer: parsed,
          existingPlayerId: existing.id,
          existingPlayerName: existing.name,
          action: 'ATUALIZAR',
          reason: `Atleta já existente no banco (ID: ${existing.id}). Preservado intacto sem alteração.`,
          comparisonKey: key,
          selected: false,
          canSelect: false,
          issues: ['Atleta já existente no banco de dados. Preservado 100% intacto sem alteração.'],
        });
      } else {
        totalNew++;
        // Aplica a regra de seleção estrita por lote
        const isInBatch = position >= batchStartIndex && position <= batchEndIndex;
        const isBeforeBatch = position < batchStartIndex;

        if (isInBatch) {
          items.push({
            id: deterministicId, // ID estável e determinístico
            parsedPlayer: parsed,
            action: 'NOVO',
            reason: isMassive
              ? `Novo atleta identificado (#${position}). Selecionado para este lote de gravação (#${batchStartIndex} a #${batchEndIndex}).`
              : `Novo atleta identificado (#${position}). Disponível para homologação e seleção (#1 a #${totalCount}).`,
            comparisonKey: key,
            selected: true,
            canSelect: true,
            issues: [],
          });
        } else if (isBeforeBatch) {
          items.push({
            id: deterministicId,
            parsedPlayer: parsed,
            action: 'NOVO',
            reason: `Fora da seleção: Atleta anterior ao checkpoint (posições 1 a ${batchStartIndex - 1} já confirmadas).`,
            comparisonKey: key,
            selected: false,
            canSelect: false,
            issues: [],
          });
        } else {
          items.push({
            id: deterministicId,
            parsedPlayer: parsed,
            action: 'NOVO',
            reason: `Fora da seleção: Atleta posterior ao lote atual (posições após #${batchEndIndex} reservadas para próximos lotes).`,
            comparisonKey: key,
            selected: false,
            canSelect: false,
            issues: [],
          });
        }
      }
    }

    const totalSelectedToRecord = items.filter((i) => i.selected && i.canSelect).length;

    return {
      totalFound: parsedPlayers.length,
      totalValid: parsedPlayers.length - totalInvalid,
      totalInvalid,
      totalNew,
      totalUpdate,
      totalProtected: totalUpdate,
      totalDuplicate,
      totalSelectedToRecord,
      items,
    };
  },

  /**
   * Grava os jogadores selecionados no Firestore e no dataStore de forma segura e em lote,
   * garantindo a integridade não destrutiva, idempotência e o registro do lote de importação.
   * Suporta checkpoint e retomada segura a partir de um índice inicial configurado (ex: jogador 10211).
   */
  async commitHomologation(
    selectedItems: FM26HomologationItem[],
    fileName = 'arquivo_fm26.csv',
    onProgress?: (completed: number, total: number) => void,
    options?: {
      startIndex?: number; // 1-based: índice inicial do primeiro registro a ser gravado (ex: 10211)
      endIndex?: number; // 1-based: índice final inclusivo (ex: 10410)
      maxRecords?: number; // Limite máximo de registros a processar neste teste (ex: 200)
      grandTotal?: number; // Total global de registros homologados (ex: 37867)
      onCheckpointAdvanced?: (lastProcessedIndex: number, totalRecords: number) => void;
    }
  ): Promise<FM26CommitResult> {
    const startTime = Date.now();
    const grandTotal = options?.grandTotal && options.grandTotal > 0
      ? options.grandTotal
      : selectedItems.length;

    // Se houver startIndex definido (ex: 10211), fatia a lista a partir do índice 0-based correspondente (10210)
    const rawStartIndex = options?.startIndex && options.startIndex > 1 ? options.startIndex : 1;
    const sliceZeroBasedIndex = Math.max(0, rawStartIndex - 1);

    // Se selectedItems já vier filtrado exatamente com os 200 itens selecionados do lote:
    const isAlreadyFilteredBatch = selectedItems.length <= (options?.maxRecords || 200) && rawStartIndex > selectedItems.length;

    let itemsToProcess: FM26HomologationItem[];
    if (isAlreadyFilteredBatch) {
      itemsToProcess = selectedItems;
    } else {
      let sliceEndZeroBasedIndex = selectedItems.length;
      if (options?.endIndex && options.endIndex >= rawStartIndex) {
        sliceEndZeroBasedIndex = Math.min(selectedItems.length, options.endIndex);
      } else if (options?.maxRecords && options.maxRecords > 0) {
        sliceEndZeroBasedIndex = Math.min(selectedItems.length, sliceZeroBasedIndex + options.maxRecords);
      }
      itemsToProcess = selectedItems.slice(sliceZeroBasedIndex, sliceEndZeroBasedIndex);
    }

    const baseOffset = rawStartIndex - 1; // Quantidade de registros anteriores já gravados (ex: 10210)

    const validSelected = itemsToProcess.filter(
      (item) => item.selected && item.canSelect && (item.action === 'NOVO' || item.action === 'ATUALIZAR')
    );

    if (validSelected.length === 0) {
      throw new Error('Nenhum registro elegível selecionado para gravação a partir do ponto configurado.');
    }

    // 1. Gera ID único do lote de importação: fm26_import_batches/{importBatchId}
    const importBatchId = fm26BatchService.generateBatchId();

    const [allClubs, allExistingPlayers] = await Promise.all([
      clubesService.getAll(),
      jogadoresService.getAll(),
    ]);

    const existingMapById = new Map<string, Player>();
    allExistingPlayers.forEach((p) => existingMapById.set(p.id, p));

    // 2. Converte os itens aplicando a regra estrita de preservação:
    // Sem apagar, substituir ou alterar jogadores já existentes!
    const newItemsOnly = validSelected.filter((item) => {
      if (item.existingPlayerId && existingMapById.has(item.existingPlayerId)) {
        return false;
      }
      if (existingMapById.has(item.id)) {
        return false;
      }
      return item.action === 'NOVO';
    });

    if (newItemsOnly.length === 0) {
      return {
        success: true,
        totalRead: itemsToProcess.length,
        totalValid: validSelected.length,
        totalInvalid: 0,
        totalNew: 0,
        totalExisting: validSelected.length,
        totalProtected: validSelected.length,
        totalImported: 0,
        totalIgnored: itemsToProcess.length - validSelected.length,
        totalErrors: 0,
        totalProcessed: validSelected.length,
        totalRecorded: 0,
        newCount: 0,
        updatedCount: 0,
        errors: [],
        processingTimeMs: Date.now() - startTime,
        auditId: `audit-none-${Date.now()}`,
        importBatchId,
        resumedFromIndex: rawStartIndex,
        lastConfirmedCheckpoint: baseOffset,
      };
    }

    const playersToPersist: Player[] = newItemsOnly.map((item) => {
      return convertHomologatedToPlayer(item, undefined, allClubs, importBatchId);
    });

    // 3. Simula e valida a integridade não destrutiva (otimização O(N) com Map para coleções massivas)
    const simulatedMap = new Map<string, Player>();
    for (const ex of allExistingPlayers) {
      simulatedMap.set(ex.id, ex);
    }
    for (const p of playersToPersist) {
      simulatedMap.set(p.id, p);
    }
    const simulatedResult = Array.from(simulatedMap.values());

    const integrity = verifyNonDestructiveIntegrity(allExistingPlayers, simulatedResult);
    if (!integrity.valid) {
      throw new Error(integrity.error || 'Falha de integridade: a gravação violaria o banco existente.');
    }

    let lastConfirmedCheckpoint = baseOffset;

    // 4. Grava em lote via jogadoresService (com Firestore writeBatch e dataStore)
    // O callback onBatchCommitted é invocado estritamente após a confirmação do Firestore para avançar o checkpoint
    const result = await jogadoresService.saveBatch(
      playersToPersist,
      onProgress,
      {
        baseOffset,
        grandTotal,
        onBatchCommitted: (_chunk, cumulativeCompleted) => {
          lastConfirmedCheckpoint = cumulativeCompleted;
          fm26CheckpointService.saveCheckpoint(
            fileName,
            grandTotal,
            cumulativeCompleted,
            importBatchId,
            cumulativeCompleted >= grandTotal ? 'COMPLETED' : 'IN_PROGRESS'
          );
          if (options?.onCheckpointAdvanced) {
            options.onCheckpointAdvanced(cumulativeCompleted, grandTotal);
          }
        },
      }
    );

    // REGRA CRÍTICA: Contagem de sucesso reflete estritamente o que foi confirmado pelo Firestore
    const eligibleNew = validSelected.filter((i) => i.action === 'NOVO').length;
    const eligibleUpdate = validSelected.filter((i) => i.action === 'ATUALIZAR').length;

    let newCount = 0;
    let updatedCount = 0;
    if (result.success) {
      newCount = eligibleNew;
      updatedCount = eligibleUpdate;
    } else if (result.recorded > 0) {
      // Gravação parcial confirmada pelo Firestore
      const ratio = result.recorded / validSelected.length;
      newCount = Math.min(eligibleNew, Math.round(eligibleNew * ratio));
      updatedCount = Math.max(0, result.recorded - newCount);
    } else {
      // Se o batch falhou, nada foi gravado no Firestore
      newCount = 0;
      updatedCount = 0;
    }

    const ignoredCount = itemsToProcess.filter((i) => i.action === 'IGNORAR/DUPLICADO').length;
    const errorCount = itemsToProcess.filter((i) => i.action === 'ERRO').length + result.errors.length;

    // Se completou todos os itens até o final, atualiza checkpoint como COMPLETED
    if (result.success && lastConfirmedCheckpoint >= grandTotal) {
      fm26CheckpointService.saveCheckpoint(fileName, grandTotal, grandTotal, importBatchId, 'COMPLETED');
    }

    // 5. Registra o lote em fm26_import_batches/{importBatchId}
    await fm26BatchService.saveBatchRecord({
      id: importBatchId,
      timestamp: new Date().toISOString(),
      fileName,
      totalRecords: result.recorded,
      newCount,
      updatedCount,
      ignoredCount,
      errorCount,
      status: result.success ? 'COMPLETED' : 'FAILED',
      executedBy: 'ADMIN',
      notes: result.success
        ? `Lote FM2008 retomado no índice ${rawStartIndex} processado com sucesso (${newCount} novos, ${updatedCount} atualizados gravados no Firestore).`
        : `Falha na gravação do lote FM26 no Firestore (retomado de ${rawStartIndex}): ${result.errors.join('; ') || 'Nenhum registro gravado'}`,
      errors: result.errors,
    });

    // 6. Registra auditoria completa vinculada ao lote
    const auditId = `audit-${Date.now()}`;
    const auditRecord: FM26ImportAuditRecord = {
      id: auditId,
      timestamp: new Date().toISOString(),
      fileName,
      totalProcessed: validSelected.length,
      totalNewRecorded: newCount,
      totalUpdatedRecorded: updatedCount,
      totalIgnored: ignoredCount,
      totalErrors: errorCount,
      executedBy: 'ADMIN',
      notes: result.success
        ? `Importação retomada no índice ${rawStartIndex} concluída (${newCount} novos, ${updatedCount} atualizados).`
        : `Importação retomada no índice ${rawStartIndex} com falha na gravação do Firestore (${result.errors.length} erro(s)).`,
      errorsList: result.errors,
      importBatchId,
    };

    fm26AuditService.addAudit(auditRecord);

    const processingTimeMs = Date.now() - startTime;

    const firstProcessedId = playersToPersist[0]?.id || validSelected[0]?.id;
    const lastProcessedId = playersToPersist[playersToPersist.length - 1]?.id || validSelected[validSelected.length - 1]?.id;

    return {
      success: result.success,
      totalRead: itemsToProcess.length,
      totalValid: validSelected.length,
      totalInvalid: itemsToProcess.filter((i) => i.action === 'ERRO').length,
      totalNew: eligibleNew,
      totalExisting: itemsToProcess.filter((i) => i.action === 'ATUALIZAR').length,
      totalProtected: itemsToProcess.filter((i) => i.action === 'ATUALIZAR').length,
      totalImported: result.recorded,
      totalIgnored: ignoredCount,
      totalErrors: errorCount,
      totalProcessed: validSelected.length,
      totalRecorded: result.recorded,
      newCount,
      updatedCount,
      errors: result.errors,
      processingTimeMs,
      auditId,
      importBatchId,
      resumedFromIndex: rawStartIndex,
      lastConfirmedCheckpoint,
      firstProcessedId,
      lastProcessedId,
    };
  },
};
