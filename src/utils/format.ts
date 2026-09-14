export function formatNum(n: number): string {
  if (n < 1000) return String(n);
  const str = String(Math.floor(n));
  const parts: string[] = [];
  for (let i = str.length; i > 0; i -= 3) {
    parts.unshift(str.slice(Math.max(0, i - 3), i));
  }
  return parts.join("'");
}

export function formatNumFull(n: number): string {
  if (n < 1000) return String(n);
  const str = String(Math.floor(n));
  const parts: string[] = [];
  for (let i = str.length; i > 0; i -= 3) {
    parts.unshift(str.slice(Math.max(0, i - 3), i));
  }
  return parts.join(' ');
}

export function formatCompact(n: number): string {
  let i18n: { language?: string } | undefined;
  try { i18n = require('../i18n').default; } catch {}
  const uk = i18n?.language === 'uk';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(n % 1_000_000_000 === 0 ? 0 : 1) + (uk ? 'г' : 'g');
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + (uk ? 'м' : 'm');
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + (uk ? 'к' : 'k');
  return String(n);
}
