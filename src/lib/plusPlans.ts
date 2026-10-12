// Why? Plus plans on the website (Paddle). App-store prices come from the
// stores via RevenueCat instead. Keep these in step with Paddle's prices
// (external IDs plus_monthly / plus_yearly). See docs/WHY_PLUS.md.
export const WEB_PLUS_PLANS = [
  { id: "monthly", paddlePriceId: "plus_monthly", priceString: "$3.99", period: "month" },
  { id: "annual", paddlePriceId: "plus_yearly", priceString: "$29.99", period: "year" },
] as const;

export const PLUS_TRIAL_LABEL = "7-day free trial";

export const PLUS_PERKS = [
  "100 “But… Why?” deep dives an hour (free: 30)",
  "Plus-only animated avatars and themes",
  "Plus badge and a status bubble on your profile",
  "Supports new facts, topics and features",
];

/** Apple's standard licence agreement, linked from the subscription terms. */
export const APPLE_EULA_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
