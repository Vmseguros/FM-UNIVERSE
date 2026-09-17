import { FM26ValidationSummary, FM26ValidationIssue, FM26ParsedPlayer } from '../types/fm26';
import { mapCanonicalField, normalizePlayerRow, cleanText } from './fm26Normalizer';

/**
 * Detecta o delimitador CSV mais provável (ponto-e-vírgula ';' ou vírgula ',')
 */
export function detectDelimiter(headerLine: string): string {
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;
  const tabCount = (headerLine.match(/\t/g) || []).length;

  if (tabCount > semicolonCount && tabCount > commaCount) return '\t';
  if (semicolonCount >= commaCount) return ';';
  return ',';
}

/**
 * Parser de linha CSV simples e seguro que respeita aspas.
 */
export function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // pula a aspa dupla escapada
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Colunas mínimas obrigatórias para importação válida no padrão FM26.
 */
export const MANDATORY_CANONICAL_FIELDS = [
  'name',
  'club',
  'nationality',
  'age',
  'position',
];

/**
 * Colunas recomendadas para um import ideal do FM26.
 */
const RECOMMENDED_CANONICAL_FIELDS = [
  'name',
  'club',
  'nationality',
  'position',
  'age',
  'overall',
  'marketValue',
  'wage',
];

/**
 * Valida o conteúdo de um arquivo CSV de exportação do FM26.
 */
export function validateCSVContent(
  csvContent: string,
  fileName = 'arquivo.csv',
  databaseSource?: 'FM2008' | 'FM26'
): FM26ValidationSummary {
  const issues: FM26ValidationIssue[] = [];

  const upperFileName = fileName.toUpperCase();
  let isFM2008 =
    databaseSource === 'FM2008' ||
    (databaseSource !== 'FM26' && (
      upperFileName.includes('FM2008') ||
      upperFileName.includes('2008') ||
      upperFileName.includes('GENIE')
    ));

  const isCSVExtension =
    fileName.toLowerCase().endsWith('.csv') ||
    fileName.toLowerCase().endsWith('.txt');

  if (!isCSVExtension) {
    issues.push({
      row: 0,
      message: 'O arquivo não possui extensão .csv ou .txt padrão.',
      severity: 'warning',
    });
  }

  // Remove BOM UTF-8 se presente (\uFEFF)
  const cleanCsvContent = (csvContent || '').replace(/^\uFEFF/, '');

  const rawLines = cleanCsvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Verificação de arquivo vazio
  if (rawLines.length === 0) {
    return {
      fileName,
      fileSizeBytes: new Blob([csvContent]).size,
      delimiterDetected: ';',
      totalRows: 0,
      totalPlayersFound: 0,
      validRecords: 0,
      problematicRecords: 0,
      duplicateRecords: 0,
      emptyIdsCount: 0,
      duplicateIdsCount: 0,
      emptyNamesCount: 0,
      invalidRecordsCount: 0,
      recognizedColumns: [],
      unrecognizedColumns: [],
      missingRecommendedColumns: RECOMMENDED_CANONICAL_FIELDS,
      issues: [
        {
          row: 0,
          message: 'O arquivo enviado está totalmente vazio.',
          severity: 'error',
        },
      ],
      previewPlayers: [],
      allPlayers: [],
      canImport: false,
      isReadyForFutureImport: false,
    };
  }

  // 1. Cabeçalho
  const headerLine = rawLines[0];
  const delimiter = detectDelimiter(headerLine);
  const rawHeaders = parseCSVLine(headerLine, delimiter);

  if (rawHeaders.length <= 1 && !headerLine.includes(delimiter)) {
    issues.push({
      row: 1,
      message:
        'Não foi possível identificar as colunas no cabeçalho. Verifique o separador (vírgula ou ponto-e-vírgula).',
      severity: 'error',
    });
  }

  const recognizedColumns: string[] = [];
  const unrecognizedColumns: string[] = [];
  const canonicalMappedSet = new Set<string>();

  rawHeaders.forEach((rawH) => {
    const canonical = mapCanonicalField(rawH);
    if (canonical) {
      recognizedColumns.push(`${rawH} (${canonical})`);
      canonicalMappedSet.add(canonical);
      if (canonical === 'wageWeekly' || canonical === 'wageAnnual') {
        canonicalMappedSet.add('wage');
      }
    } else {
      unrecognizedColumns.push(rawH);
    }
  });

  if (!isFM2008 && databaseSource !== 'FM26') {
    if (canonicalMappedSet.has('aDiff') || canonicalMappedSet.has('pa') || canonicalMappedSet.has('saleValue')) {
      isFM2008 = true;
    }
  }
  const resolvedSource: 'FM2008' | 'FM26' = isFM2008 ? 'FM2008' : 'FM26';

  // Em FM2008, se CA ou (PA e A Diff) estiverem presentes, a capacidade global (Overall) está coberta
  if (isFM2008 && (canonicalMappedSet.has('ca') || (canonicalMappedSet.has('pa') && canonicalMappedSet.has('aDiff')))) {
    canonicalMappedSet.add('overall');
  }

  // Identifica colunas recomendadas ausentes (no FM2008 Genie Scout, salário não é esperado no CSV)
  const missingRecommendedColumns = RECOMMENDED_CANONICAL_FIELDS.filter((field) => {
    if (isFM2008 && field === 'wage') return false;
    return !canonicalMappedSet.has(field);
  });

  // Verificação de cabeçalho mínimo (precisa ter pelo menos coluna de nome)
  const hasNameColumn = canonicalMappedSet.has('name') || canonicalMappedSet.has('fullName');
  if (!hasNameColumn) {
    issues.push({
      row: 1,
      field: 'name',
      message:
        'Cabeçalho obrigatório ausente: nenhuma coluna identificada como Nome do jogador ("Name", "Nome", "Player Name").',
      severity: 'error',
    });
  }

  // 2. Processamento das Linhas de Dados
  const dataLines = rawLines.slice(1);
  const players: FM26ParsedPlayer[] = [];
  const seenDuplicateKeys = new Map<string, number>(); // key -> row
  const seenUniqueIds = new Map<string, number>(); // externalId -> row
  let problematicRecordsCount = 0;
  let duplicateRecordsCount = 0;
  let emptyIdsCount = 0;
  let duplicateIdsCount = 0;
  let emptyNamesCount = 0;

  dataLines.forEach((line, idx) => {
    const rowNumber = idx + 2; // Linha 1 é o cabeçalho
    if (!line.trim()) return; // Ignora linha vazia

    const cells = parseCSVLine(line, delimiter);
    const rawRecord: Record<string, string> = {};

    rawHeaders.forEach((h, hIdx) => {
      rawRecord[h] = cells[hIdx] !== undefined ? cells[hIdx] : '';
    });

    const { player, issues: rowIssues } = normalizePlayerRow(rawRecord, rowNumber, resolvedSource);

    let hasErrors = false;

    // Checa se o Unique ID / External ID está vazio ou duplicado
    if (!player.externalId || !player.externalId.trim()) {
      emptyIdsCount++;
    } else {
      const cleanId = player.externalId.trim();
      if (seenUniqueIds.has(cleanId)) {
        duplicateIdsCount++;
      } else {
        seenUniqueIds.set(cleanId, rowNumber);
      }
    }

    // Checa se o nome veio vazio
    if (!cleanText(player.name) || player.name.startsWith('Jogador Linha ')) {
      emptyNamesCount++;
      issues.push({
        row: rowNumber,
        field: 'name',
        message: 'Registro sem nome ou com nome em branco.',
        severity: 'error',
      });
      hasErrors = true;
    }

    // Checa valores numéricos suspeitos
    if (player.age < 14 || player.age > 50) {
      issues.push({
        row: rowNumber,
        player: player.name,
        field: 'age',
        message: `Idade atípica: ${player.age} anos.`,
        severity: 'warning',
      });
    }

    if (player.overall < 10 || player.overall > 99) {
      issues.push({
        row: rowNumber,
        player: player.name,
        field: 'overall',
        message: `Overall fora da faixa esperada (1-99): ${player.overall}.`,
        severity: 'warning',
      });
    }

    // Registra avisos da normalização (limitando a lista de issues detalhadas para evitar lag na UI com 38k registros)
    if (issues.length < 150) {
      rowIssues.forEach((msg) => {
        if (issues.length < 150) {
          issues.push({
            row: rowNumber,
            player: player.name,
            message: msg,
            severity: 'warning',
          });
        }
      });
    }

    // Detecção de duplicados no próprio arquivo
    if (seenDuplicateKeys.has(player.deduplicationKey)) {
      const firstRow = seenDuplicateKeys.get(player.deduplicationKey);
      duplicateRecordsCount++;
      if (issues.length < 150) {
        issues.push({
          row: rowNumber,
          player: player.name,
          message: `Possível duplicata do jogador da linha ${firstRow} (mesmo identificador/chave).`,
          severity: 'warning',
        });
      }
    } else {
      seenDuplicateKeys.set(player.deduplicationKey, rowNumber);
    }

    if (hasErrors) {
      problematicRecordsCount++;
    }

    players.push(player);
  });

  const totalPlayersFound = players.length;
  const validRecords = Math.max(0, totalPlayersFound - problematicRecordsCount);
  const previewPlayers = players.slice(0, 20);

  const canImport = hasNameColumn && totalPlayersFound > 0 && problematicRecordsCount === 0;
  const isReadyForFutureImport = hasNameColumn && totalPlayersFound > 0;

  return {
    fileName,
    fileSizeBytes: new Blob([csvContent]).size,
    delimiterDetected: delimiter === '\t' ? 'TAB' : delimiter,
    totalRows: rawLines.length,
    totalPlayersFound,
    validRecords,
    problematicRecords: problematicRecordsCount,
    duplicateRecords: duplicateRecordsCount,
    emptyIdsCount,
    duplicateIdsCount,
    emptyNamesCount,
    invalidRecordsCount: problematicRecordsCount,
    recognizedColumns,
    unrecognizedColumns,
    missingRecommendedColumns,
    issues,
    previewPlayers,
    allPlayers: players,
    databaseSource: resolvedSource,
    canImport,
    isReadyForFutureImport,
  };
}
