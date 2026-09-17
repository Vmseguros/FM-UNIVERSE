import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { AppRouter } from './AppRouter';
import { RoleSwitcherBar } from './components/common/RoleSwitcherBar';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary fallbackTitle="Falha no aplicativo">
      <AuthProvider>
        <NavigationProvider>
          <div className="flex flex-col min-h-screen">
            <RoleSwitcherBar />
            <div className="flex-1">
              <ErrorBoundary fallbackTitle="Erro ao carregar a rota">
                <AppRouter />
              </ErrorBoundary>
            </div>
          </div>
        </NavigationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

