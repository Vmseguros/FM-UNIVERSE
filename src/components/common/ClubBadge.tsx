import React, { useState } from 'react';
import { Club } from '../../types';
import { Shield } from 'lucide-react';

interface ClubBadgeProps {
  club?: Partial<Club> | null;
  badge?: string;
  logoUrl?: string;
  name?: string;
  code?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-14 h-14 text-2xl',
  xl: 'w-20 h-20 text-4xl',
};

const iconSizes = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
  xl: 'w-10 h-10',
};

/**
 * Detecta de forma segura se a string fornecida representa uma imagem (Data URL, URL HTTP ou Blob)
 * e NUNCA deve ser renderizada como texto cru na DOM.
 */
export function isBadgeImage(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/') ||
    trimmed.includes(';base64,')
  ) {
    return true;
  }
  // Se for uma string muito longa (> 20 caracteres), com certeza é um ID, token ou URL malformatada, não um emoji/sigla
  return trimmed.length > 20;
}

export const ClubBadge: React.FC<ClubBadgeProps> = ({
  club,
  badge: propBadge,
  logoUrl: propLogoUrl,
  name: propName,
  code: propCode,
  className = '',
  size = 'md',
}) => {
  const [imgError, setImgError] = useState(false);

  const rawLogo = propLogoUrl || club?.logoUrl || '';
  const rawBadge = propBadge || club?.badge || '';
  const clubName = propName || club?.name || 'Clube';
  const clubCode = propCode || club?.code || clubName.slice(0, 3).toUpperCase();

  // Determina se temos uma fonte de imagem válida
  let imageSource = '';
  if (rawLogo && isBadgeImage(rawLogo)) {
    imageSource = rawLogo;
  } else if (rawBadge && isBadgeImage(rawBadge)) {
    imageSource = rawBadge;
  }

  const containerSizeClass = sizeClasses[size] || sizeClasses.md;
  const iconSizeClass = iconSizes[size] || iconSizes.md;

  // 1. Se tem imagem válida e não falhou no carregamento, renderiza elemento <img>
  if (imageSource && !imgError) {
    return (
      <div
        className={`relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-zinc-900/90 border border-zinc-800 shrink-0 select-none ${containerSizeClass} ${className}`}
      >
        <img
          src={imageSource}
          alt={`Escudo do ${clubName}`}
          className="w-full h-full object-contain p-1"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // 2. Se badge é um emoji curto ou símbolo legível (máximo 6 caracteres e NÃO é imagem/URL)
  const isCleanEmojiOrSymbol =
    rawBadge &&
    !isBadgeImage(rawBadge) &&
    rawBadge.length <= 6 &&
    !rawBadge.includes(':') &&
    !rawBadge.includes('/');

  if (isCleanEmojiOrSymbol) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 shrink-0 select-none ${containerSizeClass} ${className}`}
      >
        <span>{rawBadge}</span>
      </div>
    );
  }

  // 3. Fallback limpo: Exibe a sigla do clube com visual moderno e tipografia estilizada
  return (
    <div
      className={`inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/60 font-black tracking-wider text-emerald-400 shrink-0 select-none ${containerSizeClass} ${className}`}
      title={clubName}
    >
      {clubCode ? (
        <span className="text-[0.65em] font-mono leading-none">{clubCode.slice(0, 3)}</span>
      ) : (
        <Shield className={`${iconSizeClass} text-emerald-400/80`} />
      )}
    </div>
  );
};
