import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  User,
  Mail,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  LogIn,
  UserPlus,
  LogOut,
  Trophy,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { parseAuthErrorMessage } from '../../services/authService';

export const LoginPage: React.FC = () => {
  const {
    firebaseUser,
    isRealAdmin,
    managerProfile,
    loginManagerWithEmail,
    registerManagerWithEmail,
    logoutManager,
    loginWithGoogle,
    authError: contextAuthError,
  } = useAuth();
  const { navigate } = useNavigation();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showAdminSection, setShowAdminSection] = useState(false);

  // Se o usuário já estiver conectado, exibe card com status e opções de navegação
  if (firebaseUser) {
    const isCompleted = managerProfile?.onboardingCompleted;
    const destRoute = isRealAdmin
      ? '/admin'
      : isCompleted
      ? '/manager'
      : '/manager/setup';

    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl text-center backdrop-blur-md"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4 text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight mb-2">
            Sessão Ativa
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            Você está conectado como{' '}
            <span className="text-emerald-400 font-semibold">
              {firebaseUser.displayName || managerProfile?.name || firebaseUser.email}
            </span>
          </p>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-6 text-left space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>E-mail:</span>
              <span className="text-slate-200 font-mono">{firebaseUser.email}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Papel:</span>
              <span className="text-emerald-400 font-bold">
                {isRealAdmin ? 'ADMINISTRADOR' : 'MANAGER'}
              </span>
            </div>
            {!isRealAdmin && (
              <div className="flex justify-between text-xs text-slate-400">
                <span>Status do Clube:</span>
                <span className={isCompleted ? 'text-emerald-400' : 'text-amber-400'}>
                  {isCompleted ? 'Clube Vinculado' : 'Onboarding Pendente'}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate(destRoute)}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
            >
              <span>{isCompleted || isRealAdmin ? 'Acessar Painel' : 'Completar Criação do Clube'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={async () => {
                await logoutManager();
                setSuccessMessage('Sessão encerrada com sucesso.');
              }}
              className="w-full py-3 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair da Conta</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setLocalError('Por favor, informe seu e-mail.');
      return;
    }
    if (!password) {
      setLocalError('Por favor, informe sua senha.');
      return;
    }

    setIsLoading(true);
    try {
      const profile = await loginManagerWithEmail(cleanEmail, password);
      setSuccessMessage('Login efetuado com sucesso! Redirecionando...');
      setTimeout(() => {
        if (!profile.onboardingCompleted || !profile.clubId) {
          navigate('/manager/setup');
        } else {
          navigate('/manager');
        }
      }, 400);
    } catch (err: unknown) {
      setLocalError(parseAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName || cleanName.length < 3) {
      setLocalError('Informe seu nome completo de treinador (mínimo 3 caracteres).');
      return;
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setLocalError('Informe um endereço de e-mail válido.');
      return;
    }
    if (password.length < 6) {
      setLocalError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('A confirmação de senha não confere com a senha digitada.');
      return;
    }

    setIsLoading(true);
    try {
      await registerManagerWithEmail(cleanName, cleanEmail, password);
      setSuccessMessage('Conta de treinador criada com sucesso! Vamos iniciar o setup do seu clube.');
      setTimeout(() => {
        navigate('/manager/setup');
      }, 500);
    } catch (err: unknown) {
      setLocalError(parseAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminGoogleLogin = async () => {
    setLocalError(null);
    try {
      await loginWithGoogle();
      navigate('/admin');
    } catch (err: unknown) {
      setLocalError(parseAuthErrorMessage(err));
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-md"
      >
        {/* Header do Box */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 mb-3 shadow-inner">
            <Trophy className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wider">
            FM Universe
          </h1>
          <h2 className="text-base font-bold text-emerald-400 mt-1">
            {mode === 'login' ? 'Login do Manager' : 'Criar Conta de Manager'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {mode === 'login'
              ? 'Acesse a gestão oficial do seu clube de futebol'
              : 'Cadastre-se para assumir o comando técnico de um clube'}
          </p>
        </div>

        {/* Abas Entrar / Criar Conta */}
        <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800/80 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setLocalError(null);
              setSuccessMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'login'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Entrar</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setLocalError(null);
              setSuccessMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'register'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Criar Conta</span>
          </button>
        </div>

        {/* Mensagens de Alerta e Erro */}
        <AnimatePresence mode="wait">
          {(localError || contextAuthError) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <div className="flex-1">{localError || contextAuthError}</div>
            </motion.div>
          )}

          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <div className="flex-1">{successMessage}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Formulário de Login */}
        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                E-mail do Manager
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="seu.email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Activity className="w-4 h-4 animate-spin" />
                  <span>ENTRANDO...</span>
                </>
              ) : (
                <>
                  <span>ENTRAR</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setLocalError(null);
                  setSuccessMessage(null);
                }}
                className="text-xs text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
              >
                Não tem uma conta? <strong className="text-emerald-400 underline ml-1">Criar minha conta</strong>
              </button>
            </div>
          </form>
        ) : (
          /* Formulário de Cadastro */
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                Nome do Treinador / Manager
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="Ex: Alex Ferguson"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="seu.email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                Senha (mínimo 6 caracteres)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                Confirmar Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Activity className="w-4 h-4 animate-spin" />
                  <span>CRIANDO MINHA CONTA...</span>
                </>
              ) : (
                <>
                  <span>CRIAR MINHA CONTA</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setLocalError(null);
                  setSuccessMessage(null);
                }}
                className="text-xs text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
              >
                Já tem uma conta? <strong className="text-emerald-400 underline ml-1">Fazer Login</strong>
              </button>
            </div>
          </form>
        )}

        {/* Separador e Área do Administrador */}
        <div className="mt-8 pt-6 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => setShowAdminSection(!showAdminSection)}
            className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>Área Administrativa (Acesso Master com Google)</span>
          </button>

          {showAdminSection && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 text-center"
            >
              <p className="text-xs text-slate-400 mb-3">
                Administradores verificados continuam com acesso via login Google corporativo.
              </p>
              <button
                type="button"
                onClick={handleAdminGoogleLogin}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Shield className="w-4 h-4 text-purple-400" />
                <span>Entrar como Admin com Google</span>
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
