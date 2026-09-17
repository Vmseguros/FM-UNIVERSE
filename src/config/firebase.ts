import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore, memoryLocalCache, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import appletConfig from '../../firebase-applet-config.json';

export interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

/**
 * Remove resquícios comuns de cópia/cola de blocos JSON ou objetos JS das variáveis de ambiente,
 * como aspas externas (' " `), vírgulas finais e espaços em branco.
 */
export function sanitizeEnvValue(val: unknown): string {
  if (typeof val !== 'string') return '';
  let cleaned = val.trim();
  // Remove vírgulas ou pontos-e-vírgulas residuais no final
  cleaned = cleaned.replace(/[,;\s]+$/, '');
  // Remove aspas simples, duplas ou crases no início e no final
  cleaned = cleaned.replace(/^["'`\s]+|["'`\s]+$/g, '');
  // Segunda passada para casos de aspas e vírgulas aninhadas como `"abc",`
  cleaned = cleaned.replace(/[,;\s]+$/, '');
  cleaned = cleaned.replace(/^["'`\s]+|["'`\s]+$/g, '');
  return cleaned.trim();
}

const rawEnv = (import.meta as unknown as { env?: Record<string, string> }).env || {};

const envDbId = sanitizeEnvValue(rawEnv.VITE_FIREBASE_DATABASE_ID) || appletConfig.databaseId || '';
export const FIRESTORE_DATABASE_ID =
  (envDbId || 'ai-studio-84437356-1902-4dcb-b21c-77f56f80077a').trim();

export const firebaseConfig: FirebaseConfig = {
  apiKey: sanitizeEnvValue(rawEnv.VITE_FIREBASE_API_KEY) || appletConfig.apiKey || '',
  authDomain: sanitizeEnvValue(rawEnv.VITE_FIREBASE_AUTH_DOMAIN) || appletConfig.authDomain || '',
  projectId: sanitizeEnvValue(rawEnv.VITE_FIREBASE_PROJECT_ID) || appletConfig.projectId || '',
  storageBucket: sanitizeEnvValue(rawEnv.VITE_FIREBASE_STORAGE_BUCKET) || appletConfig.storageBucket || '',
  messagingSenderId: sanitizeEnvValue(rawEnv.VITE_FIREBASE_MESSAGING_SENDER_ID) || appletConfig.messagingSenderId || '',
  appId: sanitizeEnvValue(rawEnv.VITE_FIREBASE_APP_ID) || appletConfig.appId || '',
};

/**
 * Cria ou recupera a instância correta do Firestore de acordo com o databaseId configurado.
 * Utiliza memoryLocalCache() para evitar acúmulo de mutações persistentes no IndexedDB
 * e experimentalAutoDetectLongPolling para prevenir esgotamento da stream de escrita em proxies.
 */
function createFirestoreInstance(appInstance: FirebaseApp): Firestore {
  const isDefault =
    !FIRESTORE_DATABASE_ID ||
    FIRESTORE_DATABASE_ID === '(default)' ||
    FIRESTORE_DATABASE_ID === 'default';
  const targetDbId = isDefault ? undefined : FIRESTORE_DATABASE_ID;

  try {
    return initializeFirestore(
      appInstance,
      {
        localCache: memoryLocalCache(),
        experimentalAutoDetectLongPolling: true,
      },
      targetDbId
    );
  } catch {
    return isDefault ? getFirestore(appInstance) : getFirestore(appInstance, targetDbId);
  }
}

let quotaExhausted = false;

/**
 * Registra que a cota do Firebase Firestore foi esgotada (resource-exhausted).
 * Alterna dinamicamente a aplicação para a persistência local (dataStore),
 * impedindo travamento de tela e erros de gravação.
 */
export function markFirebaseQuotaExhausted(): void {
  if (!quotaExhausted) {
    quotaExhausted = true;
    console.warn('⚠️ [FM Universe] Cota diária do Firebase Firestore esgotada ou offline. Alternando para modo de persistência local autônomo.');
  }
}

export function isFirebaseQuotaExhausted(): boolean {
  return quotaExhausted;
}

export function checkAndHandleQuotaError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const code = (err as { code?: string })?.code?.toLowerCase() || '';
  if (
    code.includes('resource-exhausted') ||
    msg.includes('resource-exhausted') ||
    msg.includes('quota limit exceeded') ||
    msg.includes('quota exceeded') ||
    msg.includes('free daily read units per project')
  ) {
    markFirebaseQuotaExhausted();
    return true;
  }
  return false;
}

/**
 * Checa se o Firebase está configurado adequadamente via variáveis de ambiente.
 * Quando ausente ou desabilitado, a plataforma FM Universe executa no modo Fallback Mock de alta fidelidade.
 */
export const isFirebaseConfigured = (): boolean => {
  if (rawEnv.VITE_DISABLE_FIREBASE === 'true') return false;
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.apiKey.length > 10 &&
    !firebaseConfig.apiKey.includes('"') &&
    !firebaseConfig.apiKey.includes(',')
  );
};

export const isFirestoreAvailable = (): boolean => {
  return isFirebaseConfigured() && !quotaExhausted;
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;

export function getFirebaseStorage(): FirebaseStorage | null {
  if (!isFirebaseConfigured()) return null;
  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  if (!storage) {
    try {
      storage = getStorage(app);
      // Evita loops de retry indefinidos caso o bucket não esteja provisionado ou CORS indisponível
      storage.maxUploadRetryTime = 4000;
      storage.maxOperationRetryTime = 4000;
    } catch (e) {
      console.warn('⚠️ [FM Universe] Falha ao inicializar Firebase Storage:', e);
    }
  }
  return storage;
}

export function getFirestoreDb(): Firestore | null {
  if (!isFirestoreAvailable()) return null;
  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  if (!db) {
    db = createFirestoreInstance(app);
  }
  return db;
}

if (isFirebaseConfigured()) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = createFirestoreInstance(app);
    auth = getAuth(app);
    try {
      storage = getStorage(app);
    } catch {
      // storage opcional se bucket não provisionado
    }
    console.info('🔥 [FM Universe] Firebase inicializado com sucesso no banco:', FIRESTORE_DATABASE_ID);
  } catch (error) {
    console.warn('⚠️ [FM Universe] Falha ao inicializar Firebase. Alternando para modo fallback mock.', error);
    app = null;
    db = null;
    auth = null;
    storage = null;
  }
} else {
  // Executando em fallback local mock
  // console.info('⚽ [FM Universe] Operando em modo Mock Local (Firebase não configurado).');
}

export { app as firebaseApp, db as firestoreDb, auth as firebaseAuth, storage as firebaseStorage };
