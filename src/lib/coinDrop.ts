/**
 * Coin drop calculation.
 *
 * Rules:
 *  1. Every user's coin drop is reduced by 50% (global rebalance).
 *  2. VIP users then get a multiplier applied on top of the reduced base.
 *
 * Keep this pure — no I/O, no user lookup. Callers pass `isVip` after
 * checking the user's active subscription / VIP role.
 */

export const GLOBAL_COIN_MULTIPLIER = 0.5;
export const VIP_COIN_MULTIPLIER = 2;

export type CoinDropOptions = {
  isVip?: boolean;
  /** Override the VIP multiplier for tiered VIP plans. Defaults to VIP_COIN_MULTIPLIER. */
  vipMultiplier?: number;
};

/**
 * Given a base coin/point amount from the pre-rebalance economy, return the
 * amount the user should actually receive.
 *
 * Non-VIP: base * 0.5
 * VIP:     base * 0.5 * vipMultiplier (default 2 → net = base)
 *
 * Rounded to the nearest integer, floored at 0. Non-positive base returns 0.
 */
export function computeCoinDrop(base: number, opts: CoinDropOptions = {}): number {
  if (!Number.isFinite(base) || base <= 0) return 0;
  const vipMult = opts.isVip ? (opts.vipMultiplier ?? VIP_COIN_MULTIPLIER) : 1;
  const raw = base * GLOBAL_COIN_MULTIPLIER * vipMult;
  return Math.max(0, Math.round(raw));
}
