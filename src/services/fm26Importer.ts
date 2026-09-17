import {
  FM26ValidationSummary,
  FM26ParsedPlayer,
  FM26HomologationItem,
  FM26HomologationSummary,
  FM26CommitResult,
} from '../types/fm26';
import { Player } from '../types';
import { validateCSVContent } from './fm26Validator';
import { fm26HomologationService, BuildHomologationOptions } from './fm26HomologationService';
import { fm26CheckpointService } from './fm26CheckpointService';

/**
 * Serviço Orquestrador de Importação do Football Manager 2026.
 *
 * MODO SEGURO:
 * A gravação no Firestore / banco de dados somente ocorre após
 * homologação explícita e dupla confirmação do Administrador.
 */
export const fm26Importer = {
  /**
   * Serviço de gerenciamento de checkpoints de importação
   */
  checkpoint: fm26CheckpointService,

  /**
   * Lê um arquivo File do navegador de forma assíncrona e executa o pipeline de validação e normalização.
   */
  async validateFile(file: File, databaseSource?: 'FM2008' | 'FM26'): Promise<FM26ValidationSummary> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const content = (e.target?.result as string) || '';
          const summary = validateCSVContent(content, file.name, databaseSource);
          // Sobrescreve tamanho real do arquivo binário
          summary.fileSizeBytes = file.size;
          resolve(summary);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => {
        reject(new Error('Falha ao ler o arquivo selecionado no navegador.'));
      };

      // Lê com codificação UTF-8
      reader.readAsText(file, 'utf-8');
    });
  },

  /**
   * Valida diretamente um conteúdo textual CSV (útil para testes automatizados e previews).
   */
  validateText(csvText: string, fileName = 'dados_fm26.csv', databaseSource?: 'FM2008' | 'FM26'): FM26ValidationSummary {
    return validateCSVContent(csvText, fileName, databaseSource);
  },

  /**
   * Constrói a homologação comparando os registros com a base de atletas existente.
   * Aplica estritamente o checkpoint para selecionar SOMENTE o próximo lote de 200 atletas.
   */
  homologate(
    parsedPlayers: FM26ParsedPlayer[],
    existingPlayers: Player[],
    options?: BuildHomologationOptions
  ): FM26HomologationSummary {
    return fm26HomologationService.buildHomologation(parsedPlayers, existingPlayers, options);
  },

  /**
   * Grava os jogadores homologados e selecionados no banco com operação em lote.
   * Suporta checkpoint e retomada segura a partir de um índice inicial configurado.
   */
  async commitHomologation(
    selectedItems: FM26HomologationItem[],
    fileName = 'arquivo_fm26.csv',
    onProgress?: (completed: number, total: number) => void,
    options?: {
      startIndex?: number; // 1-based: índice inicial do primeiro registro a ser gravado (ex: 10011)
      endIndex?: number; // 1-based: índice final inclusivo (ex: 10210)
      maxRecords?: number; // Limite máximo de registros a processar (ex: 200)
      grandTotal?: number; // Total global de registros homologados (ex: 37867)
      onCheckpointAdvanced?: (lastProcessedIndex: number, totalRecords: number) => void;
    }
  ): Promise<FM26CommitResult> {
    return fm26HomologationService.commitHomologation(selectedItems, fileName, onProgress, options);
  },

  /**
   * Bloqueio explícito de gravação direta sem homologação prévia.
   */
  async commitToDatabase(_players: FM26ParsedPlayer[]): Promise<{ success: boolean; message: string }> {
    throw new Error(
      'AÇÃO BLOQUEADA: A gravação direta sem homologação não é permitida. Utilize o fluxo seguro de homologação e confirmação em lote.'
    );
  },
};

