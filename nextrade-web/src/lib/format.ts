/**
 * Shared Indian Rupee (INR) & grammar formatting helpers.
 * Always places negative signs BEFORE the ₹ symbol (-₹78.50) and uses en-IN comma grouping.
 */

export function formatINR(
  value: number,
  options?: { signed?: boolean; decimals?: number }
): string {
  const safe = Number.isFinite(value) ? value : 0;
  const decimals = options?.decimals ?? 2;
  const sign = safe < 0 ? "-" : options?.signed && safe > 0 ? "+" : "";
  const formatted = Math.abs(safe).toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${sign}₹${formatted}`;
}

export function plural(
  count: number,
  singular: string,
  pluralForm?: string
): string {
  const word = Math.abs(count) === 1 ? singular : pluralForm ?? `${singular}s`;
  return `${count} ${word}`;
}
