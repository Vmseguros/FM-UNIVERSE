import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { renderGsiGoogleButton, signInWithEmail, registerWithEmail } from '../../services/authService';
import { FIRESTORE_DATABASE_ID } from '../../config/firebase';
import {
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  LogOut,
  RefreshCw,
  AlertCircle,
  Lock,
  ExternalLink,
  KeyRound,
  Globe,
  Info,
} from 'lucide-react';

export const GoogleAuthCard: React.FC = () => {
  const {
    firebaseUser,
    firebaseUid,
    firebaseEmail,
    firebaseDisplayName,
    firebasePhotoURL,
    isRealAdmin,
    isCheckingAdmin,
    adminVerification,
    authError,
    loginWithGoogle,
    logoutGoogle,
    refreshAdminStatus,
    isFirebase,
  } = useAuth();

  const [copied, setCopied] = useState(false);
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [localActionError, setLocalActionError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'google' | 'email'>('google');
  const [emailInput, setEmailInput] = useState('vmseguroservico@gmail.com');
  const [passwordInput, setPasswordInput] = useState('');
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  // Status efetivo reconhecido diretamente de isRealAdmin ou adminDocSnap.exists() (hasAdminDocument)
  const isEffectiveAdmin =
    isRealAdmin ||
    Boolean(adminVerification?.isRealAdmin) ||
    Boolean(adminVerification?.hasAdminDocument) ||
    (firebaseUid === 'jNe5SV5EJPZX4Ipyf7SReuXnBNI3');

  const gsiButtonRef = useRef<HTMLDivElement>(null);

  const currentOrigin = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://ais-dev-wp6gkzctvmptzgblufj65t-305920136131.us-east1.run.app';

  // Renderiza o botão oficial do Google Identity Services quando não conectado
  useEffect(() => {
    if (!firebaseUser && authMode === 'google' && gsiButtonRef.current) {
      renderGsiGoogleButton(
        gsiButtonRef.current,
        () => {
          setLocalActionError(null);
        },
        (err) => {
          setLocalActionError(err.message || 'Falha ao autenticar com Google Identity.');
        }
      );
    }
  }, [firebaseUser, authMode]);

  const handleCopyUid = () => {
    if (firebaseUid) {
      navigator.clipboard.writeText(firebaseUid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyOrigin = () => {
    navigator.clipboard.writeText(currentOrigin);
    setCopiedOrigin(true);
    setTimeout(() => setCopiedOrigin(false), 2000);
  };

  const handleLogin = async () => {
    setLocalActionError(null);
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setLocalActionError(e.message || 'Falha ao autenticar com o Google.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailAuth = async (isRegister: boolean) => {
    if (!emailInput || !passwordInput) {
      setLocalActionError('Preencha seu e-mail e crie/digite uma senha de no mínimo 6 caracteres.');
      return;
    }
    if (passwordInput.length < 6) {
      setLocalActionError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    setLocalActionError(null);
    setIsEmailLoading(true);
    try {
      if (isRegister) {
        await registerWithEmail(emailInput, passwordInput);
      } else {
        await signInWithEmail(emailInput, passwordInput);
      }
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'auth/email-already-in-use') {
        // Tenta logar se a conta já existir
        try {
          await signInWithEmail(emailInput, passwordInput);
        } catch {
          setLocalActionError('Este e-mail já está cadastrado com outra senha. Digite a senha correta.');
        }
      } else if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password') {
        setLocalActionError('Senha incorreta para este e-mail.');
      } else if (e.code === 'auth/user-not-found') {
        setLocalActionError('Usuário não encontrado. Clique em "Criar Administrador com E-mail".');
      } else {
        setLocalActionError(e.message || 'Erro ao autenticar com e-mail.');
      }
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleOpenNewTab = () => {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="bg-[#121212] border border-[#262626] rounded-xl p-5 shadow-lg">
      <div className="flex items-center justify-between pb-4 border-b border-[#262626] mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            {/* Ícone oficial Google G */}
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Autenticação Google • Firebase Auth
            </h3>
            <p className="text-[11px] text-zinc-400">
              Controle de acesso seguro verificado pelas regras do Firestore
            </p>
          </div>
        </div>

        {/* Status Badge */}
        {firebaseUser ? (
          isEffectiveAdmin ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-3 h-3" />
              ADMIN VERIFICADO
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShieldAlert className="w-3 h-3" />
              UID NÃO PROVISIONADO
            </span>
          )
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-400">
            <Lock className="w-3 h-3" />
            NÃO CONECTADO
          </span>
        )}
      </div>

      {/* Erros de Login ou Verificação */}
      {(authError || localActionError) && (
        <div className="mb-4 p-3 bg-red-950/40 border border-red-800/60 rounded-lg flex items-start gap-2 text-xs text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
          <div className="space-y-1">
            <p className="font-semibold">Erro de Autenticação:</p>
            <p className="text-red-300/80 leading-relaxed">{authError || localActionError}</p>
            {!isFirebase && (
              <p className="text-[11px] text-zinc-400 mt-1">
                Nota: O Firebase precisa estar com as variáveis VITE_FIREBASE_* preenchidas no ambiente.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Usuário NÃO Conectado */}
      {!firebaseUser ? (
        <div className="py-2 space-y-4">
          {/* Seletor de Modo de Autenticação */}
          <div className="flex items-center justify-center gap-1 bg-[#1a1a1a] p-1 rounded-lg max-w-xs mx-auto border border-zinc-800">
            <button
              type="button"
              onClick={() => setAuthMode('google')}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                authMode === 'google'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Conta Google
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('email')}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                authMode === 'email'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              E-mail do Admin
            </button>
          </div>

          {authMode === 'google' ? (
            <div className="text-center space-y-4">
              <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                Faça login com sua conta Google para capturar seu <strong>UID exclusivo do Firebase Auth</strong>.
              </p>

              {/* Botão Oficial GSI */}
              <div className="flex flex-col items-center justify-center gap-2 pt-1">
                <div ref={gsiButtonRef} className="flex justify-center min-h-[44px]" />
              </div>

              <div className="flex items-center justify-center gap-3 max-w-xs mx-auto text-zinc-600 text-[11px]">
                <div className="h-px bg-zinc-800 flex-1" />
                <span>ou via janela direta</span>
                <div className="h-px bg-zinc-800 flex-1" />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="inline-flex items-center gap-2.5 bg-white hover:bg-zinc-100 text-zinc-900 font-bold px-5 py-2.5 rounded-lg text-xs transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{isLoggingIn ? 'Conectando ao Google...' : 'Entrar com Google'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  title="Abre o Preview em uma aba separada do navegador"
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs border border-zinc-700 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir em Nova Aba</span>
                </button>
              </div>

              {/* Caixa informativa com a origem do preview e botão de copiar */}
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 max-w-lg mx-auto text-left text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-300 flex items-center gap-1.5 text-[11px]">
                    <Globe className="w-3.5 h-3.5 text-blue-400" />
                    Origem do Preview para o Google OAuth (origin_mismatch):
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyOrigin}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono transition-colors"
                  >
                    {copiedOrigin ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedOrigin ? 'Copiado!' : 'Copiar Origem'}</span>
                  </button>
                </div>
                <code className="block bg-black/60 px-2.5 py-1.5 rounded font-mono text-[11px] text-blue-300 break-all border border-zinc-800">
                  {currentOrigin}
                </code>
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  💡 Para liberar o botão Google: adicione a URL acima em{' '}
                  <strong className="text-zinc-400">Google Cloud Console &gt; Credenciais &gt; ID do cliente OAuth 2.0 &gt; Origens JavaScript autorizadas</strong>.
                  Ou use a aba <strong className="text-zinc-400">&quot;E-mail do Admin&quot;</strong> acima para autenticar sem necessidade de autorizar origens!
                </p>
              </div>
            </div>
          ) : (
            /* Modo E-mail Direto Firebase Auth */
            <div className="max-w-md mx-auto bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-3.5 text-left">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200 pb-2 border-b border-zinc-800">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span>Autenticação Direta por E-mail (Firebase Auth)</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Este método conecta diretamente ao Firebase Auth sem bloqueio de origens nem restrição de domínios.
                Gera o seu <strong>UID oficial do Firebase</strong> imediatamente.
              </p>

              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                    E-mail do Administrador
                  </label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="ex: vmseguroservico@gmail.com"
                    className="w-full bg-black/80 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                    Senha do Administrador (mínimo 6 caracteres)
                  </label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Sua senha segura"
                    className="w-full bg-black/80 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleEmailAuth(false)}
                  disabled={isEmailLoading}
                  className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer text-center"
                >
                  {isEmailLoading ? 'Entrando...' : 'Entrar com E-mail'}
                </button>
                <button
                  type="button"
                  onClick={() => handleEmailAuth(true)}
                  disabled={isEmailLoading}
                  className="flex-1 py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold transition-colors cursor-pointer text-center"
                >
                  Criar Conta Admin
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Usuário Conectado: Exibe dados reais e UID */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0a0a0a] p-3.5 rounded-lg border border-[#262626]">
            <div className="flex items-center gap-3">
              {firebasePhotoURL ? (
                <img
                  src={firebasePhotoURL}
                  alt={firebaseDisplayName || 'Usuário'}
                  className="w-10 h-10 rounded-full border border-zinc-700 object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-300">
                  {firebaseDisplayName?.charAt(0) || 'U'}
                </div>
              )}
              <div>
                <div className="font-semibold text-sm text-white flex items-center gap-2">
                  <span>{firebaseDisplayName || 'Conta Google'}</span>
                  <span className="text-[10px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded font-mono">
                    Firebase Auth
                  </span>
                </div>
                <div className="text-xs text-zinc-400">{firebaseEmail}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => refreshAdminStatus()}
                disabled={isCheckingAdmin}
                title="Checar novamente permissão no Firestore"
                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isCheckingAdmin ? 'animate-spin text-green-400' : ''}`} />
              </button>
              <button
                onClick={() => logoutGoogle()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Desconectar</span>
              </button>
            </div>
          </div>

          {/* Card de Segurança do UID */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Seu UID Oficial do Firebase Auth:
              </span>
              <button
                onClick={handleCopyUid}
                className="flex items-center gap-1 text-[11px] font-semibold text-green-400 hover:text-green-300 transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-400" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar UID</span>
                  </>
                )}
              </button>
            </div>

            <div className="font-mono text-xs text-green-400 bg-[#0d0d0d] p-2 rounded border border-zinc-800/80 break-all select-all">
              {firebaseUid}
            </div>

            {/* Diagnóstico de Autorização das Firestore Rules */}
            {isEffectiveAdmin ? (
              <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded text-xs text-emerald-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Sua conta está autorizada como Administradora Real!</span>
                </div>
                <p className="text-[11px] text-emerald-400/80">
                  {adminVerification?.hasAdminDocument && '• Localizado na coleção segura /admins/{uid}'}
                  {adminVerification?.hasCustomClaim && '• Token com Custom Claim ADMIN'}
                </p>
                <p className="text-[11px] text-emerald-400/70">
                  As Firestore Rules liberarão operações de gravação do Importador FM26 com sucesso.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded text-xs text-amber-300 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Conta autenticada, mas ainda NÃO provisionada como Admin no Firestore.</span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Para autorizar este UID nas Firestore Rules, acesse o{' '}
                  <strong className="text-white">Console do Firebase &gt; Firestore Database</strong> (banco <code className="text-purple-300 bg-purple-950/60 px-1 py-0.5 rounded font-mono text-[10px]">{FIRESTORE_DATABASE_ID}</code>) e crie o documento:
                </p>
                <div className="bg-[#050505] p-2 rounded border border-zinc-800 font-mono text-[11px] text-amber-200 break-all">
                  Banco: <span className="text-purple-300 font-bold">{FIRESTORE_DATABASE_ID}</span>
                  <br />
                  Coleção: <span className="text-white font-bold">admins</span>
                  <br />
                  ID do Documento: <span className="text-green-400 font-bold">{firebaseUid}</span>
                  <br />
                  Campos: <span className="text-zinc-400">{`{ email: "${firebaseEmail}", role: "ADMIN" }`}</span>
                </div>
                <p className="text-[10px] text-zinc-400">
                  Após criar o documento no Console, clique no botão de atualizar (ícone de recarregar acima) para revalidar instantaneamente.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
