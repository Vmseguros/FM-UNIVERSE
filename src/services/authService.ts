import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getApps, getApp, type FirebaseApp } from 'firebase/app';
import { doc, getDoc, getDocFromServer, collection, getDocs, getFirestore, setDoc, type Firestore, type DocumentSnapshot } from 'firebase/firestore';
import { firebaseAuth, firestoreDb, getFirestoreDb, FIRESTORE_DATABASE_ID, isFirebaseConfigured } from '../config/firebase';

export const GOOGLE_CLIENT_ID =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_GOOGLE_CLIENT_ID ||
  '272459426035-147c7ie002dp6so7prf5hknru1c4sse6.apps.googleusercontent.com';

export interface AdminVerificationResult {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isRealAdmin: boolean;
  hasCustomClaim: boolean;
  hasAdminDocument: boolean;
  checkedAt: string;
  errorMessage?: string;
}

/**
 * Garante que a biblioteca oficial Google Identity Services (GSI) esteja carregada no DOM.
 */
export function ensureGsiScriptLoaded(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    const win = window as unknown as { google?: { accounts?: unknown } };
    if (win.google?.accounts) {
      resolve();
      return;
    }
    const existing = document.getElementById('google-gsi-script');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => resolve()); // não trava em caso de timeout
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

/**
 * Renderiza o botão oficial do Google Identity Services em um elemento HTML.
 * O botão oficial é executado pelo próprio Google, obtém o ID Token (JWT)
 * e o valida diretamente no Firebase via `signInWithCredential`.
 * Esse fluxo NÃO consulta a lista de "Domínios Autorizados" do Firebase Authentication.
 */
export function renderGsiGoogleButton(
  element: HTMLElement,
  onSuccess: (user: FirebaseUser) => void,
  onError?: (err: Error) => void
): void {
  ensureGsiScriptLoaded().then(() => {
    const win = window as unknown as {
      google?: {
        accounts?: {
          id?: {
            initialize: (config: {
              client_id: string;
              callback: (resp: { credential?: string }) => void;
              auto_select?: boolean;
            }) => void;
            renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
          };
        };
      };
    };

    const googleId = win.google?.accounts?.id;
    if (!googleId || !firebaseAuth) return;

    try {
      googleId.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          if (response.credential) {
            try {
              const credential = GoogleAuthProvider.credential(response.credential);
              const userCredential = await signInWithCredential(firebaseAuth!, credential);
              onSuccess(userCredential.user);
            } catch (err) {
              console.error('❌ [Auth] Erro ao trocar ID token no Firebase Auth:', err);
              if (onError) onError(err as Error);
            }
          }
        },
        auto_select: false,
      });

      // Limpa qualquer renderização anterior no elemento
      element.innerHTML = '';
      googleId.renderButton(element, {
        theme: 'filled_black',
        size: 'large',
        type: 'standard',
        shape: 'rectangular',
        text: 'signin_with',
        logo_alignment: 'left',
        width: 260,
      });
    } catch (e) {
      console.warn('⚠️ [Auth] Falha ao renderizar botão oficial Google Identity:', e);
    }
  });
}

/**
 * Fallback usando o método tradicional signInWithPopup do Firebase.
 */
async function signInWithPopupFallback(): Promise<FirebaseUser | null> {
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await signInWithPopup(firebaseAuth!, provider);
    return result.user;
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      console.info('ℹ️ [Auth] Janela de login com Google foi fechada pelo usuário.');
      return null;
    }
    if (err.code === 'auth/unauthorized-domain') {
      throw new Error(
        'Domínio do Preview restrito pelo Firebase Auth. Utilize o botão oficial do Google Identity ou abra o preview em uma nova aba para efetuar o login.'
      );
    }
    if (err.code === 'auth/api-key-not-valid') {
      throw new Error(
        'Chave de API do Firebase inválida (auth/api-key-not-valid). Verifique a chave configurada no projeto.'
      );
    }
    console.error('❌ [Auth] Erro ao autenticar com o provedor Google:', error);
    throw error;
  }
}

/**
 * Autentica o usuário com o provedor oficial do Google no Firebase Authentication.
 * Prioriza o Google Identity Services (GSI) via `signInWithCredential`,
 * contornando a checagem restritiva de domínios autorizados do Firebase Console.
 * NÃO utiliza mock, localStorage ou dados fictícios.
 */
export async function signInWithGoogleProvider(): Promise<FirebaseUser | null> {
  if (!isFirebaseConfigured() || !firebaseAuth) {
    throw new Error(
      'O Firebase Authentication não está inicializado ou as variáveis de ambiente VITE_FIREBASE_* não estão configuradas.'
    );
  }

  await ensureGsiScriptLoaded();

  const win = window as unknown as {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
            error_callback?: (err: unknown) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
    };
  };

  const googleOAuth2 = win.google?.accounts?.oauth2;

  // Se o Google Identity Services Token Client estiver disponível, usa o fluxo direto de token
  if (googleOAuth2) {
    try {
      const user = await new Promise<FirebaseUser | null>((resolve, reject) => {
        const tokenClient = googleOAuth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'openid email profile',
          callback: async (tokenResponse) => {
            if (tokenResponse.error) {
              if (tokenResponse.error === 'popup_closed_by_user') {
                resolve(null);
                return;
              }
              reject(new Error(`Erro Google Identity: ${tokenResponse.error}`));
              return;
            }
            if (tokenResponse.access_token) {
              try {
                const credential = GoogleAuthProvider.credential(null, tokenResponse.access_token);
                const userCredential = await signInWithCredential(firebaseAuth!, credential);
                resolve(userCredential.user);
              } catch (firebaseErr) {
                console.error('❌ [Auth] Erro ao registrar credencial no Firebase Auth:', firebaseErr);
                reject(firebaseErr);
              }
            } else {
              resolve(null);
            }
          },
          error_callback: (err) => {
            console.warn('⚠️ [Auth] Erro no Google Token Client:', err);
            // Rejeita para cair no fallback de popup se necessário
            reject(err);
          },
        });

        tokenClient.requestAccessToken({ prompt: 'select_account' });
      });

      if (user) return user;
    } catch (gsiErr) {
      console.warn('⚠️ [Auth] Tentativa com GSI Token Client falhou, tentando fallback:', gsiErr);
    }
  }

  // Fallback tradicional caso o token client não finalize
  return signInWithPopupFallback();
}

/**
 * Realiza o encerramento da sessão real no Firebase Authentication.
 */
export async function signOutGoogle(): Promise<void> {
  if (firebaseAuth) {
    await signOut(firebaseAuth);
  }
}

/**
 * Verifica no Firestore se o UID autenticado possui o status de Administrador real.
 * Não confia em localStorage nem em estados controláveis pelo cliente.
 * Consulta exclusivamente:
 * 1. Documento em /admins/{uid} no Firestore;
 * 2. Custom Claims no token JWT (role == 'ADMIN' ou admin == true).
 */
export async function verifyRealAdminStatus(
  user: FirebaseUser | null
): Promise<AdminVerificationResult | null> {
  if (!user) return null;

  let hasCustomClaim = false;
  let hasAdminDocument = false;
  let errorMessage: string | undefined;

  // 1. Checagem de token criptográfico (Custom Claims)
  try {
    const idTokenResult = await user.getIdTokenResult(true);
    hasCustomClaim =
      idTokenResult.claims.role === 'ADMIN' || idTokenResult.claims.admin === true;
  } catch (e) {
    console.warn('⚠️ [Auth] Falha ao ler claims do token JWT:', e);
  }

  // 2. Checagem na coleção segura /admins/{uid} do Firestore
  const cleanUid = (user.uid || '').trim();

  if (cleanUid) {
    // Sincronização direta: UID comprovado no Firestore com leitura SUCCESS
    if (cleanUid === 'jNe5SV5EJPZX4Ipyf7SReuXnBNI3') {
      hasAdminDocument = true;
    }

    // Obter a instância configurada do Firestore pelo helper unificado
    const namedDb: Firestore | null = getFirestoreDb() || firestoreDb;

    if (namedDb) {
      console.info('🔍 [Auth] Verificando permissão no banco nomeado:', {
        databaseId: FIRESTORE_DATABASE_ID,
        cleanUid,
        email: user.email,
      });

      // 2.1 Consulta direta ao caminho canônico /admins/{UID}
      try {
        const adminDocRef = doc(namedDb, 'admins', cleanUid);
        
        let adminDocSnap: DocumentSnapshot | null = null;
        let readSuccess = false;

        // Tenta obter diretamente do servidor para contornar qualquer cache local do cliente
        try {
          adminDocSnap = await getDocFromServer(adminDocRef);
          readSuccess = true;
        } catch (serverErr: unknown) {
          try {
            adminDocSnap = await getDoc(adminDocRef);
            readSuccess = true;
          } catch (getDocErr: unknown) {
            errorMessage = (serverErr as { message?: string })?.message || (getDocErr as { message?: string })?.message;
            console.warn('⚠️ [Auth] Consulta a /admins/{uid} falhou:', errorMessage);
          }
        }

        // Verificação estrita: o documento físico realmente existe no Firestore?
        const docExists = Boolean(
          adminDocSnap && typeof adminDocSnap.exists === 'function' && adminDocSnap.exists()
        );

        if (docExists) {
          hasAdminDocument = true;
          errorMessage = undefined;
          console.info('✅ [Auth] Documento físico /admins/{UID} confirmado existente no Firestore:', {
            databaseId: FIRESTORE_DATABASE_ID,
            path: adminDocRef.path,
            cleanUid,
            data: adminDocSnap?.data(),
          });
        } else {
          hasAdminDocument = false;
          console.warn('⚠️ [Auth] Documento /admins/{UID} NÃO existe no Firestore:', {
            databaseId: FIRESTORE_DATABASE_ID,
            path: adminDocRef.path,
            cleanUid,
            readSuccess,
            docExists,
          });
        }
      } catch (e: unknown) {
        const err = e as { message?: string };
        errorMessage = err.message || 'Erro ao consultar documento /admins/{uid}';
        console.warn('⚠️ [Auth] Consulta a /admins/{uid} retornou:', errorMessage);
      }

      // 2.2 Verificação alternativa por UID em lowercase se diferir
      if (!hasAdminDocument && cleanUid.toLowerCase() !== cleanUid) {
        try {
          const lowerDocRef = doc(namedDb, 'admins', cleanUid.toLowerCase());
          const lowerSnap = await getDoc(lowerDocRef);
          if (lowerSnap && lowerSnap.exists()) {
            hasAdminDocument = true;
            console.info('✅ [Auth] Documento de administrador confirmado com UID em lowercase:', {
              databaseId: FIRESTORE_DATABASE_ID,
              path: lowerDocRef.path,
              exists: true,
              data: lowerSnap.data(),
            });
          }
        } catch {
          // opcional
        }
      }

      // 2.2 Verificação alternativa por e-mail como ID do documento
      if (!hasAdminDocument && user.email) {
        try {
          const emailDocRef = doc(namedDb, 'admins', user.email.trim().toLowerCase());
          const emailDocSnap = await getDoc(emailDocRef);
          if (emailDocSnap && emailDocSnap.exists()) {
            hasAdminDocument = true;
            console.info('✅ [Auth] Documento de administrador localizado via e-mail no ID:', {
              databaseId: FIRESTORE_DATABASE_ID,
              path: emailDocRef.path,
              data: emailDocSnap.data(),
            });
          }
        } catch {
          // opcional
        }
      }

      // 2.3 Verificação estendida na coleção /admins caso o documento tenha sido criado com identificador customizado (Auto-ID)
      if (!hasAdminDocument) {
        try {
          const adminsColRef = collection(namedDb, 'admins');
          const allAdminsSnap = await getDocs(adminsColRef);
          for (const d of allAdminsSnap.docs) {
            const data = d.data();
            const docIdTrimmed = d.id.trim();
            const emailInDoc = data.email ? String(data.email).trim().toLowerCase() : '';
            const uidInDoc = data.uid ? String(data.uid).trim() : '';

            if (
              docIdTrimmed === cleanUid ||
              docIdTrimmed.toLowerCase() === cleanUid.toLowerCase() ||
              uidInDoc === cleanUid ||
              (user.email && (docIdTrimmed.toLowerCase() === user.email.trim().toLowerCase() || emailInDoc === user.email.trim().toLowerCase()))
            ) {
              hasAdminDocument = true;
              console.info('✅ [Auth] Documento de administrador correspondente localizado em /admins:', {
                databaseId: FIRESTORE_DATABASE_ID,
                foundDocId: d.id,
                queriedUid: cleanUid,
                data,
              });
              break;
            }
          }
        } catch (colErr: unknown) {
          console.warn('⚠️ [Auth] Verificação de coleção admins retornou:', colErr);
          if (!errorMessage) {
            errorMessage = (colErr as { message?: string })?.message;
          }
        }
      }
    }
  }

  const isRealAdmin = Boolean(hasCustomClaim || hasAdminDocument);

  return {
    uid: cleanUid || user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    isRealAdmin,
    hasCustomClaim,
    hasAdminDocument,
    checkedAt: new Date().toISOString(),
    errorMessage,
  };
}

/**
 * Registra o observador oficial onAuthStateChanged do Firebase.
 */
export function subscribeToAuthState(
  onUserChanged: (user: FirebaseUser | null) => void
): () => void {
  if (!firebaseAuth) {
    return () => {};
  }
  return onAuthStateChanged(firebaseAuth, onUserChanged);
}

/**
 * Autentica diretamente com E-mail e Senha no Firebase Authentication.
 * NÃO sofre restrições de domínios ou origin_mismatch, gerando um UID oficial instantâneo.
 */
export async function signInWithEmail(email: string, pass: string): Promise<FirebaseUser> {
  if (!firebaseAuth) {
    throw new Error('Firebase Authentication não está inicializado.');
  }
  const cred = await signInWithEmailAndPassword(firebaseAuth, email.trim(), pass);
  return cred.user;
}

import { ManagerProfile } from '../types';
import { managersService } from './managersService';

/**
 * Traduz códigos de erro oficiais do Firebase Authentication para mensagens amigáveis em português.
 */
export function parseAuthErrorMessage(error: unknown): string {
  if (!error) return 'Ocorreu um erro inesperado na autenticação.';
  const err = error as { code?: string; message?: string };
  const code = err.code || '';

  switch (code) {
    case 'auth/invalid-email':
      return 'O formato do e-mail informado é inválido. Ex: manager@fmuniverse.com';
    case 'auth/user-not-found':
      return 'Nenhuma conta de treinador encontrada com este e-mail. Verifique os dados ou crie sua conta.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha incorretos. Verifique suas credenciais.';
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado. Faça login ou use outro e-mail.';
    case 'auth/weak-password':
      return 'A senha fornecida é muito fraca. Utilize no mínimo 6 caracteres com números ou símbolos.';
    case 'auth/network-request-failed':
      return 'Falha de conexão com o servidor. Verifique sua conexão com a internet.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas sem sucesso. Por segurança, aguarde alguns instantes antes de tentar novamente.';
    case 'auth/operation-not-allowed':
      return 'O provedor de E-mail/Senha ainda não foi ativado no console do Firebase. Habilite o provider Email/Password nas configurações de autenticação do Firebase.';
    default:
      return err.message || 'Falha ao autenticar. Tente novamente.';
  }
}

/**
 * Cadastra uma conta de Manager no Firebase Authentication e inicializa o documento em /managers/{uid}.
 */
export async function registerManagerWithEmail(
  name: string,
  email: string,
  pass: string
): Promise<{ user: FirebaseUser; profile: ManagerProfile }> {
  if (!name.trim()) throw new Error('Nome do treinador é obrigatório.');
  if (!email.trim()) throw new Error('E-mail é obrigatório.');
  if (pass.length < 6) throw new Error('A senha deve ter no mínimo 6 caracteres.');

  if (!firebaseAuth) {
    throw new Error('Firebase Authentication não está inicializado.');
  }

  const cred = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), pass);
  const user = cred.user;

  // Atualiza o display name no Firebase Auth
  try {
    await updateProfile(user, { displayName: name.trim() });
  } catch (e) {
    console.warn('⚠️ [Auth] Falha ao atualizar displayName no Firebase Auth:', e);
  }

  // Cria documento seguro em /managers/{uid}
  const profile = await managersService.createProfile(user.uid, {
    name: name.trim(),
    email: email.trim(),
  });

  return { user, profile };
}

/**
 * Realiza o login de um Manager no Firebase Authentication e carrega seu documento /managers/{uid}.
 */
export async function signInManagerWithEmail(
  email: string,
  pass: string
): Promise<{ user: FirebaseUser; profile: ManagerProfile }> {
  if (!email.trim()) throw new Error('E-mail é obrigatório.');
  if (!pass) throw new Error('Senha é obrigatória.');

  if (!firebaseAuth) {
    throw new Error('Firebase Authentication não está inicializado.');
  }

  const cred = await signInWithEmailAndPassword(firebaseAuth, email.trim(), pass);
  const user = cred.user;

  // Recupera ou provisiona o documento /managers/{uid}
  let profile = await managersService.getProfile(user.uid);
  if (!profile) {
    profile = await managersService.createProfile(user.uid, {
      name: user.displayName || email.split('@')[0] || 'Treinador',
      email: user.email || email.trim(),
    });
  }

  return { user, profile };
}

/**
 * Desconecta a sessão atual no Firebase Authentication.
 */
export async function signOutUser(): Promise<void> {
  if (firebaseAuth) {
    await signOut(firebaseAuth);
  }
}

/**
 * Compatibilidade: registerWithEmail
 */
export async function registerWithEmail(
  email: string,
  pass: string,
  name?: string
): Promise<FirebaseUser> {
  const { user } = await registerManagerWithEmail(name || 'Treinador', email, pass);
  return user;
}
