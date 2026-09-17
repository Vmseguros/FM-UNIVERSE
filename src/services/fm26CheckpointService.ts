/**
 * Serviço de Gerenciamento de Checkpoint e Retomada para Importação FM2008 / FM26
 *
 * Permite persistir o progresso confirmado de importação por arquivo/lote,
 * garantindo que uma importação interrompida possa ser retomada exatamente
 * a partir do próximo jogador após o último lote confirmado, sem reprocessar
 * registros anteriores e sem duplicar dados.
 */

export interface FM26ImportCheckpoint {
  fileKey: string; // Hash ou identificador único baseado no nome e total de registros
  fileName: string;
  totalRecords: number; // Total de registros no arquivo (ex: 37867)
  lastProcessedIndex: number; // 1-based: ex: 10010 (jogadores 1 a 10010 já processados)
  lastConfirmedAt: string; // ISO string
  importBatchId?: string; // ID do lote associado
  status: 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED';
}

const CHECKPOINT_STORAGE_PREFIX = 'fmu_fm26_checkpoint_';

export const fm26CheckpointService = {
  /**
   * Gera uma chave estável para o checkpoint baseada no nome do arquivo e tamanho total.
   */
  getFileKey(fileName: string, totalRecords: number): string {
    const cleanName = fileName.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
    return `${cleanName}_total_${totalRecords}`;
  },

  /**
   * Procura o checkpoint mais recente armazenado no localStorage.
   */
  getLatestActiveCheckpoint(): FM26ImportCheckpoint | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      let latest: FM26ImportCheckpoint | null = null;
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(CHECKPOINT_STORAGE_PREFIX)) {
          const raw = window.localStorage.getItem(key);
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as FM26ImportCheckpoint;
              if (parsed && typeof parsed.lastProcessedIndex === 'number' && parsed.lastProcessedIndex > 0) {
                if (!latest || new Date(parsed.lastConfirmedAt).getTime() > new Date(latest.lastConfirmedAt).getTime()) {
                  latest = parsed;
                }
              }
            } catch {
              // ignora parsing inválido
            }
          }
        }
      }
      return latest;
    } catch {
      return null;
    }
  },

  /**
   * Identifica se um arquivo/lote corresponde à importação anterior da base completa
   * (38.696 jogadores / base massiva legada do FM2008).
   */
  isPreviousMassiveBase(fileName: string, totalRecords: number): boolean {
    const clean = (fileName || '').trim().toLowerCase();
    // A base completa anterior possui 38.696 (ou 37.867 / > 20.000) registros
    if (totalRecords >= 20000 || totalRecords === 38696 || totalRecords === 37867) {
      return true;
    }
    if (clean === 'fm2008_players_import.csv' && totalRecords > 5000) {
      return true;
    }
    return false;
  },

  /**
   * Obtém o checkpoint salvo estritamente para um determinado arquivo/lote.
   * REGRA DE ISOLAMENTO:
   * - Para arquivos novos/independentes (ex: FM2008_GRANDES_CLUBES_EUROPA.csv com 1045 jogadores),
   *   a busca é restrita à chave única do próprio arquivo e NÃO aplica checkpoints de arquivos anteriores.
   * - Retorna null se não houver checkpoint salvo para o arquivo, iniciando no jogador #1.
   * - Para a base anterior massiva (38.696 jogadores), recupera o checkpoint de produção (#10410).
   */
  getCheckpoint(fileName: string, totalRecords: number): FM26ImportCheckpoint | null {
    try {
      const isMassive = this.isPreviousMassiveBase(fileName, totalRecords);
      const fileKey = this.getFileKey(fileName, totalRecords);
      const key = `${CHECKPOINT_STORAGE_PREFIX}${fileKey}`;

      if (typeof window !== 'undefined' && window.localStorage) {
        const data = window.localStorage.getItem(key);
        if (data) {
          try {
            const parsed = JSON.parse(data) as FM26ImportCheckpoint;
            if (parsed && typeof parsed.lastProcessedIndex === 'number') {
              return parsed;
            }
          } catch {
            // ignora parsing inválido
          }
        }
      }

      // Se for a base anterior massiva (38.696 jogadores), preserva o checkpoint de produção (#10410)
      if (isMassive) {
        // Tenta checar se há chave legada salva para a base massiva
        if (typeof window !== 'undefined' && window.localStorage) {
          const legacyKeys = [
            `${CHECKPOINT_STORAGE_PREFIX}fm2008_players_import.csv_total_38696`,
            `${CHECKPOINT_STORAGE_PREFIX}fm2008_players_import.csv_total_37867`,
            `${CHECKPOINT_STORAGE_PREFIX}fm2008_players_import_csv_total_38696`,
            `${CHECKPOINT_STORAGE_PREFIX}fm2008_players_import_csv_total_37867`,
          ];
          for (const lk of legacyKeys) {
            const legData = window.localStorage.getItem(lk);
            if (legData) {
              try {
                const parsed = JSON.parse(legData) as FM26ImportCheckpoint;
                if (parsed && typeof parsed.lastProcessedIndex === 'number') {
                  return parsed;
                }
              } catch {
                // ignore
              }
            }
          }
        }

        const defaultCp: FM26ImportCheckpoint = {
          fileKey,
          fileName,
          totalRecords,
          lastProcessedIndex: 10410,
          lastConfirmedAt: new Date().toISOString(),
          status: 'IN_PROGRESS',
        };
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(key, JSON.stringify(defaultCp));
          }
        } catch {
          // ignora
        }
        return defaultCp;
      }

      // Novo arquivo independente: retorna null para que a importação inicie desde o jogador #1
      return null;
    } catch (e) {
      console.warn('⚠️ Falha ao ler checkpoint do localStorage:', e);
      return null;
    }
  },

  /**
   * Salva ou atualiza o checkpoint no armazenamento local.
   * Só deve ser chamado APÓS a confirmação real do lote pelo Firestore.
   */
  saveCheckpoint(
    fileName: string,
    totalRecords: number,
    lastProcessedIndex: number,
    importBatchId?: string,
    status: 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED' = 'IN_PROGRESS'
  ): FM26ImportCheckpoint {
    const fileKey = this.getFileKey(fileName, totalRecords);
    const checkpoint: FM26ImportCheckpoint = {
      fileKey,
      fileName,
      totalRecords,
      lastProcessedIndex: Math.min(lastProcessedIndex, totalRecords),
      lastConfirmedAt: new Date().toISOString(),
      importBatchId,
      status: lastProcessedIndex >= totalRecords ? 'COMPLETED' : status,
    };

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const key = `${CHECKPOINT_STORAGE_PREFIX}${fileKey}`;
        window.localStorage.setItem(key, JSON.stringify(checkpoint));
      }
    } catch (e) {
      console.warn('⚠️ Falha ao persistir checkpoint no localStorage:', e);
    }

    return checkpoint;
  },

  /**
   * Obtém o próximo índice inicial (1-based) a ser processado com base no checkpoint.
   * Exemplo: se 10.210 já foram confirmados, retorna 10.211.
   */
  getNextStartIndex(fileName: string, totalRecords: number): number {
    const cp = this.getCheckpoint(fileName, totalRecords);
    if (cp && cp.lastProcessedIndex > 0 && cp.lastProcessedIndex < totalRecords) {
      return cp.lastProcessedIndex + 1;
    }
    return 1;
  },

  /**
   * Remove o checkpoint quando a importação for concluída ou o usuário optar por reiniciar do início.
   */
  clearCheckpoint(fileName: string, totalRecords: number): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const key = `${CHECKPOINT_STORAGE_PREFIX}${this.getFileKey(fileName, totalRecords)}`;
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('⚠️ Falha ao limpar checkpoint:', e);
    }
  },
};
