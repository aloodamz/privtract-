/**
 * Priv-Tract Utility Helpers
 */

/**
 * Token configuration specifications for the frontend dashboard.
 */
export const TOKEN_CONFIG = {
  SOL:  { decimals: 9, color: '#9945FF', balanceKey: 'sol_balance',  symbol: '◎',  network: 'solana' },
  USDC: { decimals: 6, color: '#2775CA', balanceKey: 'usdc_balance', symbol: '💵', network: 'solana' },
  BONK: { decimals: 5, color: '#F5A623', balanceKey: 'bonk_balance', symbol: '🔥', network: 'solana' },
};

/**
 * Format cryptographic identifiers or Base58 addresses consistently.
 * @param {string|number} str - Address or transaction hash.
 * @returns {string} Shortened string.
 */
export function formatIdentifier(str) {
  if (!str) return "";
  const s = String(str);
  if (s.startsWith("sha256:") || s.startsWith("blake3:")) {
    const parts = s.split(":");
    return `${parts[0]}:${parts[1].slice(0, 6)}...${parts[1].slice(-4)}`;
  }
  if (s.length > 20) {
    return `${s.slice(0, 6)}...${s.slice(-4)}`;
  }
  return s;
}

/**
 * Compute the safe percentage of a value against a maximum cap.
 * Prevents division-by-zero errors.
 * @param {number|string} value - Current value.
 * @param {number|string} cap - Maximum limit.
 * @returns {number} Percentage between 0 and 100.
 */
export function pct(value, cap) {
  const n = Number(value);
  const d = Number(cap);
  return d === 0 ? 0 : Math.min((n / d) * 100, 100);
}

/**
 * Format high-precision token amounts (lamports/wei) to localized units.
 * Supports SOL and ETH divisions.
 * @param {string|number} amount - Input amount in minor denomination.
 * @param {string} networkMode - 'solana' or 'ethereum'.
 * @returns {string} Formatted localized string.
 */
export function fmt(amount, networkMode) {
  if (!amount) return "0";
  try {
    const val = BigInt(amount);
    const divisor = networkMode === "solana" ? 1_000_000_000n : 1_000_000_000_000_000_000n;
    const decimals = networkMode === "solana" ? 9 : 18;
    const whole = val / divisor;
    const remainder = val % divisor;
    const fracStr = remainder.toString().padStart(decimals, "0").replace(/0+$/, "");
    return fracStr ? `${whole.toLocaleString()}.${fracStr}` : whole.toLocaleString();
  } catch {
    return String(amount);
  }
}
