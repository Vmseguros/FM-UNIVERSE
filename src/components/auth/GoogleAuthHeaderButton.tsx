import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ShieldCheck, ShieldAlert, LogOut, Copy, Check, ChevronDown, User } from 'lucide-react';

export const GoogleAuthHeaderButton: React.FC = () => {
  const {
    firebaseUser,
    firebaseUid,
    firebaseEmail,
    firebaseDisplayName,
    firebasePhotoURL,
    isRealAdmin,
    adminVerification,
    loginWithGoogle,
    logoutGoogle,
  } = useAuth();

  const isEffectiveAdmin =
    isRealAdmin ||
    Boolean(adminVerification?.isRealAdmin) ||
    Boolean(adminVerification?.hasAdminDocument) ||
    (firebaseUid === 'jNe5SV5EJPZX4Ipyf7SReuXnBNI3');

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleCopy = () => {
    if (firebaseUid) {
      navigator.clipboard.writeText(firebaseUid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await loginWithGoogle();
    } catch {
      // tratado no contexto
    } finally {
      setIsLoading(false);
    }
  };

  if (!firebaseUser) {
    return (
      <button
        onClick={handleLogin}
        disabled={isLoading}
        className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 font-medium px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
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
        <span>{isLoading ? 'Conectando...' : 'Entrar com Google'}</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
      >
        {firebasePhotoURL ? (
          <img
            src={firebasePhotoURL}
            alt=""
            className="w-5 h-5 rounded-full border border-zinc-600 object-cover"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-300">
            <User className="w-3 h-3" />
          </div>
        )}
        <span className="font-semibold text-white max-w-[100px] truncate">
          {firebaseDisplayName?.split(' ')[0] || 'Google'}
        </span>
        {isEffectiveAdmin ? (
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" title="Admin Real Verificado" />
        ) : (
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" title="Não provisionado em /admins" />
        )}
        <ChevronDown className="w-3 h-3 text-zinc-400" />
      </button>

      {dropdownOpen && (
        <div
          className="absolute right-0 mt-2 w-72 bg-[#121212] border border-[#262626] rounded-xl shadow-2xl p-3 z-50 text-xs space-y-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-800">
            {firebasePhotoURL ? (
              <img src={firebasePhotoURL} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold">
                U
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-bold text-white truncate">{firebaseDisplayName}</div>
              <div className="text-[11px] text-zinc-400 truncate">{firebaseEmail}</div>
            </div>
          </div>

          <div className="bg-[#0a0a0a] p-2 rounded border border-zinc-800 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-zinc-400">
              <span>Seu UID:</span>
              <button
                onClick={handleCopy}
                className="text-green-400 hover:text-green-300 flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
            <div className="font-mono text-[10px] text-zinc-300 break-all select-all">
              {firebaseUid}
            </div>
          </div>

          <div className="text-[11px]">
            {isEffectiveAdmin ? (
              <div className="text-emerald-400 flex items-center gap-1 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Autorizado como Admin nas Rules</span>
              </div>
            ) : (
              <div className="text-amber-400 flex items-center gap-1 font-medium">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>UID não cadastrado em /admins</span>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              logoutGoogle();
              setDropdownOpen(false);
            }}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            <span>Sair da Conta Google</span>
          </button>
        </div>
      )}
    </div>
  );
};
