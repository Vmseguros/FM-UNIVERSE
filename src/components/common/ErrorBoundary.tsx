import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends (Component as any) {
  constructor(props: Props) {
    super(props);
    (this as any).state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary capturou erro de renderização:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    const { hasError, error } = (this as any).state;
    const { fallbackTitle, children } = (this as any).props;

    if (hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-slate-950 text-slate-100">
          <div className="max-w-md w-full bg-slate-900 border border-red-500/40 rounded-2xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">
                {fallbackTitle || 'Ops! Algo deu errado ao carregar esta visualização'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Ocorreu uma falha inesperada na renderização. Seus dados continuam preservados com segurança.
              </p>
            </div>

            {error && (
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-left">
                <p className="text-[11px] font-mono text-red-400 break-words">
                  {error.message || String(error)}
                </p>
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors shadow"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Recarregar Página
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                Início
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}
