import { FM26ImportAuditRecord } from '../types/fm26';

const AUDIT_STORAGE_KEY = 'fmu_fm26_import_audits';

let memoryAudits: FM26ImportAuditRecord[] = [];

export const fm26AuditService = {
  getAudits(): FM26ImportAuditRecord[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(AUDIT_STORAGE_KEY);
        if (stored) {
          return JSON.parse(stored) as FM26ImportAuditRecord[];
        }
      }
    } catch {
      // Ignora erro e usa fallback em memória
    }
    return memoryAudits;
  },

  addAudit(record: FM26ImportAuditRecord): void {
    const current = this.getAudits();
    const updated = [record, ...current].slice(0, 50); // Mantém os últimos 50 registros
    memoryAudits = updated;

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('Falha ao persistir registro de auditoria no localStorage:', e);
    }
  },

  clearAudits(): void {
    memoryAudits = [];
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(AUDIT_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Falha ao limpar histórico de auditoria:', e);
    }
  },
};
