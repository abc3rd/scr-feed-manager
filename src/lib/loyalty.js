// Shared loyalty tier configuration used by the cart and loyalty progress UI.
export const TIER_DISCOUNTS = {
  bronze: 0,
  silver: 0.05,
  gold: 0.10,
  platinum: 0.15,
};

// Lifetime-points thresholds that define each tier. Ordered ascending.
export const TIER_THRESHOLDS = [
  { tier: 'bronze', min: 0, discount: 0 },
  { tier: 'silver', min: 500, discount: 0.05 },
  { tier: 'gold', min: 2000, discount: 0.10 },
  { tier: 'platinum', min: 5000, discount: 0.15 },
];

// Returns progress info for a customer's lifetime points toward the next tier.
export function getTierProgress(lifetimePoints = 0) {
  const points = Math.max(0, Number(lifetimePoints) || 0);
  const tiers = TIER_THRESHOLDS;
  let currentIndex = 0;
  for (let i = 0; i < tiers.length; i++) {
    if (points >= tiers[i].min) currentIndex = i;
  }
  const current = tiers[currentIndex];
  const next = currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;

  if (!next) {
    return { tier: current.tier, current: current, next: null, progress: 100, pointsRemaining: 0, atTop: true };
  }
  const span = next.min - current.min;
  const into = points - current.min;
  const progress = Math.min(100, Math.round((into / span) * 100));
  return { tier: current.tier, current, next, progress, pointsRemaining: next.min - points, atTop: false };
}