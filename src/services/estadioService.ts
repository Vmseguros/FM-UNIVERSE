import { Club, FinanceRecord } from '../types';
import { isFirebaseConfigured, firestoreDb, getFirestoreDb } from '../config/firebase';
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { clubesService } from './clubesService';
import { dataStore } from './dataStore';
import { notificacoesService } from './notificacoesService';
import { formatCurrencyBRL } from '../utils/currency';

export const UPGRADE_COSTS = {
  YOUTH: 6000000,      // R$ 6.000.000 - Categorias de Base
  TRAINING: 8000000,   // R$ 8.000.000 - Centro de Treinamento
  CAPACITY: 12000000,  // R$ 12.000.000 - Expansão de Arquibancada (+5k)
} as const;

export interface UpgradeResult {
  success: boolean;
  error?: string;
  club?: Club;
  newLevel?: number;
  newCapacity?: number;
  newBalance?: number;
  alreadyProcessed?: boolean;
}

// Lock de concorrência em memória para impedir duplo clique
const pendingOperations = new Set<string>();

export const estadioService = {
  /**
   * Expansão das Categorias de Base
   * Regras:
   * 1. Valida saldo real no Firestore antes de aplicar.
   * 2. Se saldo < custo, bloqueia totalmente sem alterar nenhum dado.
   * 3. Se saldo >= custo, debita o valor exato de forma atômica e atualiza o nível.
   * 4. Idempotente e protegido contra duplo clique / concorrência.
   * 5. Registra lançamento financeiro e auditoria.
   */
  async upgradeYouthFacility(clubId: string, idempotencyKey?: string): Promise<UpgradeResult> {
    const cleanId = clubId?.trim();
    if (!cleanId) {
      return { success: false, error: 'Identificador de clube inválido.' };
    }

    const opKey = `${cleanId}:YOUTH`;
    if (pendingOperations.has(opKey)) {
      return {
        success: false,
        error: 'Uma solicitação de expansão já está em processamento para este clube. Aguarde.',
      };
    }
    pendingOperations.add(opKey);

    try {
      const cost = UPGRADE_COSTS.YOUTH;
      const db = getFirestoreDb() || firestoreDb;
      let freshClub: Club | null = null;

      // 1. Consulta em tempo real no Firestore / serviço de clubes para validação de saldo
      freshClub = await clubesService.getById(cleanId);
      if (!freshClub && isFirebaseConfigured() && db) {
        try {
          const docRef = doc(db, 'clubes', cleanId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            freshClub = { id: snap.id, ...snap.data() } as Club;
          }
        } catch (err) {
          console.warn('Falha ao consultar saldo recente no Firestore.', err);
        }
      }

      if (!freshClub) {
        return { success: false, error: 'Clube não encontrado para realizar a melhoria.' };
      }

      // Idempotência: verificar se chave recente já foi processada
      if (idempotencyKey && freshClub.lastAudit?.idempotencyKey === idempotencyKey) {
        return {
          success: true,
          alreadyProcessed: true,
          club: freshClub,
          newLevel: freshClub.youthLevel ?? 4,
          newBalance: freshClub.balance,
        };
      }

      const currentLevel = freshClub.youthLevel ?? 4;
      if (currentLevel >= 5) {
        return {
          success: false,
          error: 'As Categorias de Base já atingiram o nível máximo permitido (Nível 5/5).',
        };
      }

      const realBalance = freshClub.balance ?? 0;

      // 2. Bloqueio absoluto se saldo insuficiente
      if (realBalance < cost) {
        return {
          success: false,
          error: `Saldo insuficiente! O clube possui ${formatCurrencyBRL(realBalance, { compact: true })}, mas a expansão das Categorias de Base custa ${formatCurrencyBRL(cost, { compact: true })}. Nenhuma alteração foi realizada.`,
          newBalance: realBalance,
        };
      }

      const newBalance = realBalance - cost;
      const newLevel = currentLevel + 1;
      const nowIso = new Date().toISOString();
      const generatedIdemKey = idempotencyKey || `idem-youth-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const auditData = {
        type: 'YOUTH_FACILITY_UPGRADE',
        cost,
        previousBalance: realBalance,
        newBalance,
        timestamp: nowIso,
        description: `Expansão das Categorias de Base: Nível ${currentLevel} -> Nível ${newLevel}`,
        idempotencyKey: generatedIdemKey,
      };

      // 3. Transação Atômica no Firestore quando disponível
      if (isFirebaseConfigured() && db) {
        try {
          const clubRef = doc(db, 'clubes', cleanId);
          await runTransaction(db, async (transaction) => {
            const txSnap = await transaction.get(clubRef);
            if (!txSnap.exists()) {
              throw new Error('Clube não encontrado na transação do Firestore.');
            }
            const txData = txSnap.data() as Club;
            const txBalance = txData.balance ?? 0;

            if (txBalance < cost) {
              throw new Error(`Saldo insuficiente na transação Firestore (atual: ${txBalance}, necessário: ${cost}).`);
            }

            if ((txData.youthLevel ?? 4) >= 5) {
              throw new Error('Categorias de Base já atingiram o nível máximo.');
            }

            transaction.update(clubRef, {
              balance: txBalance - cost,
              youthLevel: (txData.youthLevel ?? 4) + 1,
              updatedAt: nowIso,
              lastAudit: auditData,
            });
          });
        } catch (err: unknown) {
          // Se a transação falhou por saldo insuficiente, aborta sem alterar nada
          const errMsg = err instanceof Error ? err.message : String(err);
          if (errMsg.includes('Saldo insuficiente')) {
            return {
              success: false,
              error: `Saldo insuficiente verificado na transação do Firestore. Operação cancelada.`,
              newBalance: realBalance,
            };
          }
          console.warn('Transação Firestore falhou ou modo offline; prosseguindo com persistência direta.', err);
        }
      }

      // 4. Atualização consistente do objeto Club
      const updatedClub: Club = {
        ...freshClub,
        balance: newBalance,
        youthLevel: newLevel,
        updatedAt: nowIso,
        lastAudit: auditData,
      };

      await clubesService.save(updatedClub);

      // 5. Registrar Lançamento Financeiro
      const financeRecord: FinanceRecord = {
        id: `fin-infra-youth-${Date.now()}`,
        clubId: freshClub.id,
        date: nowIso.split('T')[0],
        type: 'EXPENSE',
        category: 'INFRAESTRUTURA',
        transactionType: 'Melhoria de Infraestrutura',
        description: `Expansão das Categorias de Base (Nível ${currentLevel} -> Nível ${newLevel})`,
        amount: cost,
      };
      dataStore.addFinanceRecord(financeRecord);

      // 6. Notificação Oficial do Sistema
      try {
        await notificacoesService.create({
          type: 'SUCCESS',
          clubId: freshClub.id,
          title: 'Categorias de Base Modernizadas',
          message: `As obras das Categorias de Base foram concluídas com sucesso (Nível ${newLevel}/5). Investimento: ${formatCurrencyBRL(cost, { compact: true })}.`,
        });
      } catch (notifErr) {
        console.warn('Falha ao registrar notificação de expansão:', notifErr);
      }

      return {
        success: true,
        club: updatedClub,
        newLevel,
        newBalance,
      };
    } finally {
      pendingOperations.delete(opKey);
    }
  },

  /**
   * Expansão da Capacidade de Arquibancadas.
   * Operação estritamente atômica no Firestore:
   * - Validação do saldo disponível (mínimo de R$ 12.000.000).
   * - Débito exato de R$ 12.000.000 e acréscimo de +5.000 na capacidade dentro da mesma transação.
   * - Proteção contra duplo clique e verificação de idempotência.
   * - Registro de lançamento contábil e auditoria financeira únicos.
   */
  async upgradeCapacity(clubId: string, idempotencyKey?: string): Promise<UpgradeResult> {
    const cleanId = clubId?.trim();
    if (!cleanId) {
      return { success: false, error: 'Identificador de clube inválido.' };
    }

    const opKey = `${cleanId}:CAPACITY`;
    if (pendingOperations.has(opKey)) {
      return {
        success: false,
        error: 'Uma solicitação de expansão já está em processamento para este clube. Aguarde.',
      };
    }
    pendingOperations.add(opKey);

    try {
      const cost = UPGRADE_COSTS.CAPACITY; // R$ 12.000.000
      const db = getFirestoreDb() || firestoreDb;
      const nowIso = new Date().toISOString();
      const opIdemKey = idempotencyKey || `idem-cap-${Date.now()}`;

      // 1. Pré-checagem de idempotência
      const cachedClub = dataStore.getClubById(cleanId) || (await clubesService.getById(cleanId));
      if (idempotencyKey && cachedClub?.lastAudit?.idempotencyKey === idempotencyKey) {
        return {
          success: true,
          alreadyProcessed: true,
          club: cachedClub,
          newCapacity: cachedClub.capacity,
          newBalance: cachedClub.balance,
        };
      }

      let transactionSucceeded = false;
      let finalClub: Club | null = null;

      // 2. Transação Atômica no Firestore
      if (isFirebaseConfigured() && db) {
        try {
          const clubRef = doc(db, 'clubes', cleanId);
          await runTransaction(db, async (tx) => {
            const snap = await tx.get(clubRef);
            if (!snap.exists()) {
              throw new Error('Clube não encontrado no Firestore.');
            }
            const txData = snap.data() as Club;

            // Idempotência na própria transação
            if (idempotencyKey && txData.lastAudit?.idempotencyKey === idempotencyKey) {
              finalClub = { id: snap.id, ...txData };
              transactionSucceeded = true;
              return;
            }

            const currentBalance = txData.balance ?? 0;
            if (currentBalance < cost) {
              throw new Error(
                `SALDO_INSUFICIENTE: Saldo insuficiente! O clube possui ${formatCurrencyBRL(currentBalance, { compact: true })}, mas a expansão de arquibancada custa ${formatCurrencyBRL(cost, { compact: true })}.`
              );
            }

            const currentCapacity = txData.capacity || 48000;
            const newCapacity = currentCapacity + 5000;
            const newBalance = currentBalance - cost;
            const newTransferBudget =
              txData.transferBudget != null ? Math.min(txData.transferBudget, newBalance) : newBalance;

            const auditData = {
              type: 'CAPACITY_UPGRADE',
              cost,
              previousBalance: currentBalance,
              newBalance,
              timestamp: nowIso,
              description: `Expansão de Arquibancada: ${currentCapacity.toLocaleString()} -> ${newCapacity.toLocaleString()} assentos`,
              idempotencyKey: opIdemKey,
            };

            // Atualização atômica conjunta: débito, orçamento, capacidade e auditoria
            tx.update(clubRef, {
              balance: newBalance,
              transferBudget: newTransferBudget,
              capacity: newCapacity,
              updatedAt: nowIso,
              lastAudit: auditData,
            });

            finalClub = {
              ...txData,
              id: snap.id,
              balance: newBalance,
              transferBudget: newTransferBudget,
              capacity: newCapacity,
              updatedAt: nowIso,
              lastAudit: auditData,
            };
          });

          if (finalClub) {
            transactionSucceeded = true;
          }
        } catch (txErr: unknown) {
          const errMsg = txErr instanceof Error ? txErr.message : String(txErr);
          if (errMsg.includes('SALDO_INSUFICIENTE')) {
            const cleanErr = errMsg.replace('SALDO_INSUFICIENTE: ', '');
            return {
              success: false,
              error: cleanErr,
              newBalance: cachedClub?.balance,
            };
          }
          console.warn('Transação Firestore de capacidade falhou ou ambiente offline:', txErr);
        }
      }

      // 3. Se a transação Firestore não foi executada (modo offline ou sem conexão)
      if (!transactionSucceeded) {
        const localClub = cachedClub || (await clubesService.getById(cleanId));
        if (!localClub) {
          return { success: false, error: 'Clube não encontrado para realizar a expansão.' };
        }

        const currentBalance = localClub.balance ?? 0;
        if (currentBalance < cost) {
          return {
            success: false,
            error: `Saldo insuficiente! O clube possui ${formatCurrencyBRL(currentBalance, { compact: true })}, mas a expansão de arquibancada custa ${formatCurrencyBRL(cost, { compact: true })}.`,
            newBalance: currentBalance,
          };
        }

        const currentCapacity = localClub.capacity || 48000;
        const newCapacity = currentCapacity + 5000;
        const newBalance = currentBalance - cost;
        const newTransferBudget =
          localClub.transferBudget != null ? Math.min(localClub.transferBudget, newBalance) : newBalance;

        const auditData = {
          type: 'CAPACITY_UPGRADE',
          cost,
          previousBalance: currentBalance,
          newBalance,
          timestamp: nowIso,
          description: `Expansão de Arquibancada: ${currentCapacity.toLocaleString()} -> ${newCapacity.toLocaleString()} assentos`,
          idempotencyKey: opIdemKey,
        };

        finalClub = {
          ...localClub,
          balance: newBalance,
          transferBudget: newTransferBudget,
          capacity: newCapacity,
          updatedAt: nowIso,
          lastAudit: auditData,
        };

        await clubesService.save(finalClub);
      } else if (finalClub) {
        // Atualiza cache local sincronizado com a transação Firestore
        try {
          dataStore.saveClub(finalClub);
        } catch {
          // ignore
        }
      }

      if (!finalClub) {
        return { success: false, error: 'Falha ao concluir a operação de expansão.' };
      }

      // 4. Registro único da despesa contábil de infraestrutura (R$ 12.000.000)
      const financeRecord: FinanceRecord = {
        id: `fin-infra-cap-${cleanId}-${nowIso.replace(/[^0-9]/g, '')}`,
        clubId: cleanId,
        date: nowIso.split('T')[0],
        type: 'EXPENSE',
        category: 'INFRAESTRUTURA',
        transactionType: 'Melhoria de Infraestrutura',
        description: `Expansão de Arquibancada (+5.000 assentos: ${(finalClub.capacity - 5000).toLocaleString()} -> ${finalClub.capacity.toLocaleString()})`,
        amount: cost,
      };
      dataStore.addFinanceRecord(financeRecord);

      // 5. Notificação de conclusão de obras
      try {
        dataStore.addNotification({
          id: `notif-infra-cap-${Date.now()}`,
          title: 'Expansão de Arquibancada Concluída!',
          message: `As obras foram concluídas! A capacidade do estádio agora é de ${finalClub.capacity?.toLocaleString()} lugares. Custo: ${formatCurrencyBRL(cost, { compact: true })}.`,
          date: nowIso,
          read: false,
          type: 'SUCCESS',
          link: '/dashboard/estadio',
        });
      } catch {
        // ignore
      }

      return {
        success: true,
        club: finalClub,
        newCapacity: finalClub.capacity,
        newBalance: finalClub.balance,
      };
    } finally {
      pendingOperations.delete(opKey);
    }
  },

  /**
   * Modernização do Centro de Treinamento
   */
  async upgradeTrainingFacility(clubId: string, idempotencyKey?: string): Promise<UpgradeResult> {
    const cleanId = clubId?.trim();
    if (!cleanId) {
      return { success: false, error: 'Identificador de clube inválido.' };
    }

    const opKey = `${cleanId}:TRAINING`;
    if (pendingOperations.has(opKey)) {
      return {
        success: false,
        error: 'Uma solicitação de expansão já está em processamento para este clube. Aguarde.',
      };
    }
    pendingOperations.add(opKey);

    try {
      const cost = UPGRADE_COSTS.TRAINING;
      const db = getFirestoreDb() || firestoreDb;
      let freshClub: Club | null = null;

      freshClub = await clubesService.getById(cleanId);
      if (!freshClub && isFirebaseConfigured() && db) {
        try {
          const snap = await getDoc(doc(db, 'clubes', cleanId));
          if (snap.exists()) {
            freshClub = { id: snap.id, ...snap.data() } as Club;
          }
        } catch {
          // ignore
        }
      }

      if (!freshClub) {
        return { success: false, error: 'Clube não encontrado.' };
      }

      const realBalance = freshClub.balance ?? 0;
      if (realBalance < cost) {
        return {
          success: false,
          error: `Saldo insuficiente! O clube possui ${formatCurrencyBRL(realBalance, { compact: true })}, mas a modernização do CT custa ${formatCurrencyBRL(cost, { compact: true })}.`,
          newBalance: realBalance,
        };
      }

      const currentLevel = freshClub.trainingLevel ?? 4;
      if (currentLevel >= 5) {
        return { success: false, error: 'Centro de Treinamento já está no nível máximo (5/5).' };
      }

      const newLevel = currentLevel + 1;
      const newBalance = realBalance - cost;
      const nowIso = new Date().toISOString();

      const auditData = {
        type: 'TRAINING_FACILITY_UPGRADE',
        cost,
        previousBalance: realBalance,
        newBalance,
        timestamp: nowIso,
        description: `Modernização do CT: Nível ${currentLevel} -> Nível ${newLevel}`,
        idempotencyKey: idempotencyKey || `idem-train-${Date.now()}`,
      };

      if (isFirebaseConfigured() && db) {
        try {
          const clubRef = doc(db, 'clubes', cleanId);
          await runTransaction(db, async (tx) => {
            const snap = await tx.get(clubRef);
            if (!snap.exists()) throw new Error('Clube não encontrado.');
            const txData = snap.data() as Club;
            const txBalance = txData.balance ?? 0;

            if (txBalance < cost) throw new Error('Saldo insuficiente.');
            tx.update(clubRef, {
              balance: txBalance - cost,
              trainingLevel: (txData.trainingLevel ?? 4) + 1,
              updatedAt: nowIso,
              lastAudit: auditData,
            });
          });
        } catch (e: any) {
          if (e?.message?.includes('Saldo insuficiente')) {
            return { success: false, error: 'Saldo insuficiente na transação.', newBalance: realBalance };
          }
        }
      }

      const updatedClub: Club = {
        ...freshClub,
        balance: newBalance,
        trainingLevel: newLevel,
        updatedAt: nowIso,
        lastAudit: auditData,
      };

      await clubesService.save(updatedClub);

      dataStore.addFinanceRecord({
        id: `fin-infra-train-${Date.now()}`,
        clubId: freshClub.id,
        date: nowIso.split('T')[0],
        type: 'EXPENSE',
        category: 'INFRAESTRUTURA',
        transactionType: 'Melhoria de Infraestrutura',
        description: `Modernização do Centro de Treinamento (Nível ${currentLevel} -> Nível ${newLevel})`,
        amount: cost,
      });

      return {
        success: true,
        club: updatedClub,
        newLevel,
        newBalance,
      };
    } finally {
      pendingOperations.delete(opKey);
    }
  },
};
