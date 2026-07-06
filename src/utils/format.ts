export function formatNum(n: number): string {
  if (n < 1000) return String(n);
  const str = String(Math.floor(n));
  const parts: string[] = [];
  for (let i = str.length; i > 0; i -= 3) {
    parts.unshift(str.slice(Math.max(0, i - 3), i));
  }
  return parts.join("'");
}
