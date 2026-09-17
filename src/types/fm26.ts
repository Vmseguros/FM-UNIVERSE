import {
  PlayerPosition,
  PositionCategory,
  PlayerTechnicalAttributes,
  PlayerMentalAttributes,
  PlayerPhysicalAttributes,
  PlayerGoalkeeperAttributes,
  PlayerStats,
} from '../types';

export interface FM26ParsedPlayer {
  id: string; // documentId gerado (fm2008_{uniqueId} para FM2008, player-fm26-{id} para FM26)
  externalId?: string;
  uniqueId?: string; // Unique ID original (ex: 735216)
  sourceUniqueId?: string; // Identificador da fonte preservado
  databaseSource?: 'FM2008' | 'FM26' | string; // Origem explícita
  name: string;
  fullName?: string;
  age: number;
  birthDate?: string;
  nationality: string;
  secondNationality?: string;
  club: string;
  clubId?: string;
  position: PlayerPosition;
  positionCategory: PositionCategory;
  secondaryPositions?: PlayerPosition[];
  preferredFoot: 'Destro' | 'Canhoto' | 'Ambidestro';
  weakFoot?: number;
  overall: number; // 1 - 99
  potential: number; // 1 - 99
  ca?: number; // Current Ability FM (1 - 200)
  pa?: number; // Potential Ability FM (1 - 200)
  aDiff?: number; // PA - CA diff
  marketValue: number; // Em R$ BRL
  saleValue?: number; // Sale Value (FM Genie Scout) em R$ BRL
  wage: number; // Mensal em R$ BRL (0 se ausente)
  currency: string; // Exclusivamente 'BRL'
  contractUntil?: string;
  releaseClause?: number;
  squadStatus?: string;
  personality?: string;
  height?: number; // cm
  weight?: number; // kg
  jerseyNumber?: number;
  internationalCaps?: number;
  internationalGoals?: number;
  status?: string;
  reputation?: number;
  condition?: number;
  morale?: string;
  // Atributos normalizados (1-99)
  attributes?: {
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defending: number;
    physical: number;
  };
  // Atributos detalhados do FM26 (1-20)
  technicalAttributes?: PlayerTechnicalAttributes;
  mentalAttributes?: PlayerMentalAttributes;
  physicalAttributes?: PlayerPhysicalAttributes;
  goalkeeperAttributes?: PlayerGoalkeeperAttributes;
  // Estatísticas da temporada
  stats?: PlayerStats;
  // Metadados de importação
  deduplicationKey: string;
  rowIndex: number;
  rawRecord: Record<string, string>;
  issues: string[];
}

export interface FM26ValidationIssue {
  row: number;
  player?: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface FM26ValidationSummary {
  fileName: string;
  fileSizeBytes: number;
  delimiterDetected: string;
  totalRows: number;
  totalPlayersFound: number;
  validRecords: number;
  problematicRecords: number;
  duplicateRecords: number;
  emptyIdsCount: number; // IDs vazios
  duplicateIdsCount: number; // IDs duplicados
  emptyNamesCount: number; // Nomes vazios
  invalidRecordsCount: number; // Registros inválidos
  recognizedColumns: string[];
  unrecognizedColumns: string[];
  missingRecommendedColumns: string[];
  issues: FM26ValidationIssue[];
  previewPlayers: FM26ParsedPlayer[];
  allPlayers: FM26ParsedPlayer[];
  databaseSource?: 'FM2008' | 'FM26';
  canImport: boolean;
  isReadyForFutureImport: boolean;
}

export type FM26HomologationAction = 'NOVO' | 'ATUALIZAR' | 'IGNORAR/DUPLICADO' | 'ERRO';

export interface FM26HomologationItem {
  id: string; // ID final que será usado (se existente, preserva o id; se novo, id determinístico)
  parsedPlayer: FM26ParsedPlayer;
  existingPlayerId?: string;
  existingPlayerName?: string;
  action: FM26HomologationAction;
  reason: string;
  comparisonKey: string;
  selected: boolean;
  canSelect: boolean;
  issues: string[];
}

export interface FM26HomologationSummary {
  totalFound: number;
  totalValid: number;
  totalInvalid: number;
  totalNew: number;
  totalUpdate: number;
  totalProtected: number;
  totalDuplicate: number;
  totalSelectedToRecord: number;
  items: FM26HomologationItem[];
}

export interface FM26ImportBatchRecord {
  id: string; // importBatchId: fm26_import_batches/{importBatchId}
  timestamp: string; // ISO data/hora
  fileName: string;
  totalRecords: number;
  newCount: number;
  updatedCount: number;
  ignoredCount: number;
  errorCount: number;
  status: 'COMPLETED' | 'FAILED' | 'ROLLED_BACK' | 'PENDING';
  executedBy: string;
  notes?: string;
  errors?: string[];
}

export interface FM26ImportAuditRecord {
  id: string;
  timestamp: string;
  fileName: string;
  totalProcessed: number;
  totalNewRecorded: number;
  totalUpdatedRecorded: number;
  totalIgnored: number;
  totalErrors: number;
  executedBy: string;
  notes?: string;
  errorsList?: string[];
  importBatchId?: string;
}

export interface FM26CommitResult {
  success: boolean;
  totalRead?: number; // Total de registros lidos no CSV
  totalValid?: number; // Total de registros válidos
  totalInvalid?: number; // Total de registros inválidos
  totalNew?: number; // Total de atletas novos
  totalExisting?: number; // Total de atletas já existentes
  totalProtected?: number; // Total de atletas protegidos
  totalImported?: number; // Total de atletas gravados/importados
  totalIgnored?: number; // Total ignorado (duplicatas ou não selecionados)
  totalErrors?: number; // Total com erro
  totalProcessed: number;
  totalRecorded: number;
  newCount: number;
  updatedCount: number;
  errors: string[];
  problematicUniqueIds?: string[]; // Unique IDs que apresentaram erros
  processingTimeMs?: number; // Tempo de processamento em ms
  auditId: string;
  importBatchId?: string;
  resumedFromIndex?: number; // Índice 1-based a partir do qual a gravação foi iniciada (ex: 10011)
  lastConfirmedCheckpoint?: number; // Último índice 1-based confirmado com sucesso (ex: 10210)
  firstProcessedId?: string; // Primeiro ID do lote processado (ex: fm2008_10011 ou similar)
  lastProcessedId?: string; // Último ID do lote processado (ex: fm2008_10210 ou similar)
}
