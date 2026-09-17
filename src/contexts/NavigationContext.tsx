import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface RouteMatch {
  pattern: string;
  keys: string[];
}

const matchRoute = (pattern: string, path: string): Record<string, string> | null => {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      const key = patternParts[i].substring(1);
      params[key] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i].toLowerCase() !== pathParts[i].toLowerCase()) {
      return null;
    }
  }
  return params;
};

interface NavigationContextType {
  currentPath: string;
  navigate: (path: string) => void;
  params: Record<string, string>;
  activeSection: 'public' | 'dashboard' | 'admin';
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const parsePathFromLocation = (): string => {
    if (typeof window === 'undefined') return '/';
    try {
      // 1. Suporte a query param ?path= ou ?route= (muito útil em iframes)
      const searchParams = new URLSearchParams(window.location.search);
      const queryRoute = searchParams.get('route') || searchParams.get('path');
      if (queryRoute) {
        let clean = queryRoute.trim();
        if (clean.startsWith('#/')) clean = clean.slice(1);
        if (!clean.startsWith('/')) clean = `/${clean}`;
        return clean.split('?')[0].replace(/\/+$/, '') || '/';
      }

      // 2. Suporte a Hash (#/admin/importar-fm26 ou #admin/importar-fm26)
      if (window.location.hash) {
        let hashClean = window.location.hash.replace(/^#\/?/, '/').trim();
        hashClean = hashClean.split('?')[0].replace(/\/+$/, '') || '/';
        if (hashClean && hashClean !== '/') {
          return hashClean;
        }
      }

      // 3. Suporte a Pathname padrão
      const pathname = window.location.pathname;
      if (pathname && pathname !== '/' && !pathname.includes('index.html')) {
        return pathname.split('?')[0].replace(/\/+$/, '') || '/admin/temporadas';
      }
    } catch {
      // fallback seguro
    }
    return '/admin/temporadas';
  };

  const [currentPath, setCurrentPath] = useState<string>(parsePathFromLocation);

  const navigate = useCallback((to: string) => {
    let cleanPath = to.trim();
    if (cleanPath.startsWith('#/')) cleanPath = cleanPath.slice(1);
    if (!cleanPath.startsWith('/')) cleanPath = `/${cleanPath}`;
    cleanPath = cleanPath.split('?')[0].replace(/\/+$/, '') || '/admin/temporadas';

    setCurrentPath(cleanPath);
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState({}, '', cleanPath);
      } catch {
        // pushState fallback
      }
      try {
        if (window.location.hash !== `#${cleanPath}`) {
          window.location.hash = cleanPath;
        }
      } catch {
        // ignore
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    // Se estiver na raiz, direciona imediatamente para /admin/temporadas para exibição no Preview
    if (typeof window !== 'undefined') {
      const current = window.location.hash || window.location.pathname;
      if (!current || current === '/' || current === '#' || current === '#/' || current.includes('index.html')) {
        navigate('/admin/temporadas');
      }
    }

    const handlePopState = () => {
      const detected = parsePathFromLocation();
      setCurrentPath(detected);
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, [navigate]);

  // Compute params based on known route patterns
  const patterns = [
    '/clubes/:slug',
    '/clubes/:id',
    '/jogadores/:id',
    '/competicoes/:id',
    '/jogos/:id',
  ];

  let params: Record<string, string> = {};
  for (const pat of patterns) {
    const matched = matchRoute(pat, currentPath);
    if (matched) {
      params = matched;
      break;
    }
  }

  const activeSection: 'public' | 'dashboard' | 'admin' = currentPath.startsWith('/admin')
    ? 'admin'
    : currentPath.startsWith('/dashboard')
    ? 'dashboard'
    : 'public';

  return (
    <NavigationContext.Provider value={{ currentPath, navigate, params, activeSection }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation deve ser utilizado dentro de um NavigationProvider');
  }
  return context;
};
