/**
 * Centralized Currency Utility for FM Universe
 * Standard: Brazilian Real (R$ / BRL)
 *
 * Rules:
 * 1. Global Currency is Real Brasileiro (R$).
 * 2. No foreign currencies (€, EUR, USD, $) exist in the system.
 * 3. Formats numbers using standard Brazilian locale (pt-BR):
 *    - Full: R$ 95,00 | R$ 1.500,00 | R$ 10.000.000,00
 *    - Compact: R$ 250,00 mil | R$ 10,00 mi | R$ 1,50 bi
 */

export const CURRENCY = 'BRL';
export const CURRENCY_SYMBOL = 'R$';

export interface FormatCurrencyOptions {
  /**
   * If true, displays large numbers in compact format (e.g. R$ 10,00 mi, R$ 250,00 mil)
   */
  compact?: boolean;
  /**
   * Number of decimal places.
   * - Default for full: 2 (e.g., R$ 1.500,00)
   * - Default for compact: 1 or 2 depending on configuration
   */
  decimals?: number;
  /**
   * Whether to include the 'R$ ' prefix. Default is true.
   */
  showSymbol?: boolean;
}

/**
 * Formats a monetary value to Brazilian Real (R$).
 *
 * Examples:
 * formatCurrencyBRL(95) => "R$ 95,00"
 * formatCurrencyBRL(1500) => "R$ 1.500,00"
 * formatCurrencyBRL(10000000, { compact: true }) => "R$ 10,00 mi"
 * formatCurrencyBRL(250000, { compact: true }) => "R$ 250,00 mil"
 * formatCurrencyBRL(45000000, { compact: true, decimals: 1 }) => "R$ 45,0 mi"
 */
export function formatCurrencyBRL(
  value: number | undefined | null,
  options?: boolean | FormatCurrencyOptions
): string {
  const numericValue = typeof value === 'number' && !isNaN(value) ? value : 0;
  const opts: FormatCurrencyOptions =
    typeof options === 'boolean' ? { compact: options } : options || {};

  const { compact = false, decimals, showSymbol = true } = opts;
  const symbolPrefix = showSymbol ? `${CURRENCY_SYMBOL} ` : '';

  if (compact) {
    const absVal = Math.abs(numericValue);
    const sign = numericValue < 0 ? '-' : '';

    if (absVal >= 1_000_000_000) {
      const dec = decimals !== undefined ? decimals : 2;
      const formattedNum = (absVal / 1_000_000_000).toLocaleString('pt-BR', {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      });
      return `${sign}${symbolPrefix}${formattedNum} bi`;
    }

    if (absVal >= 1_000_000) {
      const dec = decimals !== undefined ? decimals : 1;
      const formattedNum = (absVal / 1_000_000).toLocaleString('pt-BR', {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      });
      return `${sign}${symbolPrefix}${formattedNum} mi`;
    }

    if (absVal >= 100_000) {
      const dec = decimals !== undefined ? decimals : 0;
      const formattedNum = (absVal / 1_000).toLocaleString('pt-BR', {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      });
      return `${sign}${symbolPrefix}${formattedNum} mil`;
    }

    if (absVal >= 1_000 && decimals === 0) {
      const formattedNum = (absVal / 1_000).toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      return `${sign}${symbolPrefix}${formattedNum} mil`;
    }
  }

  // Full BRL formatting
  const dec = decimals !== undefined ? decimals : 2;
  const formatted = numericValue.toLocaleString('pt-BR', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });

  return `${symbolPrefix}${formatted}`;
}

/**
 * Shortcut for full standard BRL currency formatting
 * e.g. formatBRL(1500) => "R$ 1.500,00"
 */
export function formatBRL(value: number | undefined | null, decimals = 2): string {
  return formatCurrencyBRL(value, { compact: false, decimals });
}

/**
 * Shortcut for compact BRL currency formatting
 * e.g. formatBRLCompact(10000000) => "R$ 10,0 mi"
 * e.g. formatBRLCompact(250000, 0) => "R$ 250 mil"
 */
export function formatBRLCompact(value: number | undefined | null, decimals = 1): string {
  return formatCurrencyBRL(value, { compact: true, decimals });
}

/**
 * Parses a string input into a valid clean numeric currency value in BRL.
 */
export function parseCurrencyInput(input: string | number | undefined | null): number {
  if (typeof input === 'number') {
    return isNaN(input) ? 0 : input;
  }
  if (!input) return 0;

  // Remove currency symbol, spaces, and clean formatting
  const cleaned = input
    .toString()
    .replace(/R\$/g, '')
    .trim()
    .replace(/\./g, '')
    .replace(/,/g, '.');

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}
