import { FM26ImportBatchRecord } from '../types/fm26';
import { isFirebaseConfigured, firestoreDb, getFirestoreDb } from '../config/firebase';
import { doc, setDoc, getDocs, collection } from 'firebase/firestore';

const BATCH_STORAGE_KEY = 'fmu_fm26_import_batches';

let memoryBatches: FM26ImportBatchRecord[] = [];

export const fm26BatchService = {
  /**
   * Gera um ID de lote único e rastreável: fm26_batch_<timestamp>_<random>
   */
  generateBatchId(): string {
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `fm26_batch_${timestamp}_${randomSuffix}`;
  },

  /**
   * Retorna a lista de lotes de importação gravados.
   */
  async getBatches(): Promise<FM26ImportBatchRecord[]> {
    const db = getFirestoreDb() || firestoreDb;
    if (isFirebaseConfigured() && db) {
      try {
        const colRef = collection(db, 'fm26_import_batches');
        const snap = await getDocs(colRef);
        if (!snap.empty) {
          const list: FM26ImportBatchRecord[] = [];
          snap.forEach((d) => list.push(d.data() as FM26ImportBatchRecord));
          list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          return list;
        }
      } catch (err) {
        console.warn('Falha ao buscar lotes no Firestore. Usando fallback local.', err);
      }
    }

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(BATCH_STORAGE_KEY);
        if (stored) {
          return JSON.parse(stored) as FM26ImportBatchRecord[];
        }
      }
    } catch {
      // Usa fallback de memória
    }

    return memoryBatches;
  },

  /**
   * Registra um lote de importação (fm26_import_batches/{importBatchId})
   * de forma não destrutiva e segura.
   */
  async saveBatchRecord(batch: FM26ImportBatchRecord): Promise<void> {
    // 1. Armazenamento em memória e localStorage
    const current = await this.getBatches();
    const existingIndex = current.findIndex((b) => b.id === batch.id);
    let updated: FM26ImportBatchRecord[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = batch;
    } else {
      updated = [batch, ...current].slice(0, 100);
    }
    memoryBatches = updated;

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('Falha ao salvar lote no localStorage:', e);
    }

    // 2. Gravação no Firestore na coleção fm26_import_batches/{importBatchId}
    const db = getFirestoreDb() || firestoreDb;
    if (isFirebaseConfigured() && db) {
      const MAX_ATTEMPTS = 5;
      let saved = false;

      const isRetriableError = (err: any): boolean => {
        if (!err) return false;
        const msg = String(err.message || '').toLowerCase();
        const code = String(err.code || '').toLowerCase();
        return (
          code.includes('resource-exhausted') ||
          code.includes('unavailable') ||
          code.includes('aborted') ||
          code.includes('deadline-exceeded') ||
          msg.includes('write stream exhausted') ||
          msg.includes('resource-exhausted') ||
          msg.includes('resource_exhausted') ||
          msg.includes('maximum allowed queued writes') ||
          msg.includes('overloading the backend') ||
          msg.includes('unavailable') ||
          msg.includes('aborted') ||
          msg.includes('deadline exceeded') ||
          msg.includes('quota exceeded') ||
          msg.includes('rate limit')
        );
      };

      for (let attempt = 1; attempt <= MAX_ATTEMPTS && !saved; attempt++) {
        try {
          const docRef = doc(db, 'fm26_import_batches', batch.id);
          const cleanBatch = JSON.parse(JSON.stringify(batch));
          await setDoc(docRef, cleanBatch, { merge: true });
          saved = true;
          console.info('✅ [fm26BatchService] Lote persistido com sucesso no Firestore:', batch.id);
        } catch (err: any) {
          const retriable = isRetriableError(err);
          if (retriable && attempt < MAX_ATTEMPTS) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 250, 10000);
            console.warn(
              `⚠️ [fm26BatchService] Tentativa ${attempt} falhou ao persistir lote (${err?.code || err?.message}). Aguardando ${Math.round(delay)}ms...`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          } else {
            console.warn('⚠️ [fm26BatchService] Falha ao persistir lote no Firestore (fm26_import_batches):', {
              batchId: batch.id,
              code: err?.code,
              message: err?.message,
              attempt,
            });
            // Não relança para preservar os registros já comitados no dataStore/memória
            break;
          }
        }
      }
    }
  },
};
