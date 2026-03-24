export type AllocationTarget = { equity: number; bond: number; alt: number };

export type AllocationGap = {
  assetClass: "equity" | "bond" | "alt";
  current: number;      // fraction 0-1
  recommended: number;  // fraction 0-1
  gap: number;          // recommended - current (positive = underweight)
};

export type AllocationRecommendation = {
  profile: "aggressive" | "moderate" | "conservative" | "fi_achieved";
  target: AllocationTarget;
  current: AllocationTarget;
  gaps: AllocationGap[];
  reasoning: string;
};

interface RecommendationInput {
  birthYear: number;
  currentYear: number;
  fiDateYear?: number | null; // undefined/null = FI not yet achieved
  isFI?: boolean;
  accounts: Array<{
    equityPct: number;
    bondPct: number;
    altPct: number;
    currentBalance: number;
  }>;
}

// Glide path profiles:
// aggressive (age < 40): 80% equity / 15% bond / 5% alt
// moderate (age 40-55 AND > 5 years to FI): 65% equity / 25% bond / 10% alt
// conservative (age > 55 OR <= 5 years to FI): 50% equity / 35% bond / 15% alt
// fi_achieved (isFI = true): 40% equity / 45% bond / 15% alt

export function computeAllocationRecommendation(input: RecommendationInput): AllocationRecommendation {
  const age = input.currentYear - input.birthYear;
  const yearsToFI = input.fiDateYear ? input.fiDateYear - input.currentYear : null;

  let profile: AllocationRecommendation["profile"];
  let target: AllocationTarget;
  let reasoning: string;

  if (input.isFI) {
    profile = "fi_achieved";
    target = { equity: 0.40, bond: 0.45, alt: 0.15 };
    reasoning = "You have achieved financial independence. This allocation prioritizes capital preservation and reliable income generation with a 40/45/15 equity/bond/alt mix, supporting sustainable withdrawals while maintaining modest growth.";
  } else if (age > 55 || (yearsToFI !== null && yearsToFI <= 5)) {
    profile = "conservative";
    target = { equity: 0.50, bond: 0.35, alt: 0.15 };
    const reason = age > 55 ? `at age ${age}` : `with FI approximately ${yearsToFI} year${yearsToFI === 1 ? "" : "s"} away`;
    reasoning = `${reason.charAt(0).toUpperCase() + reason.slice(1)}, capital preservation becomes critical. A 50/35/15 equity/bond/alt mix reduces sequence-of-returns risk while maintaining enough growth to reach your target.`;
  } else if (age >= 40) {
    profile = "moderate";
    target = { equity: 0.65, bond: 0.25, alt: 0.10 };
    reasoning = `At age ${age} with FI still ${yearsToFI ?? "several"} years away, a 65/25/10 equity/bond/alt balance captures continued growth while building a defensive bond buffer as you approach your target date.`;
  } else {
    profile = "aggressive";
    target = { equity: 0.80, bond: 0.15, alt: 0.05 };
    reasoning = `At age ${age} with a long runway to FI, a growth-oriented 80/15/5 equity/bond/alt allocation maximizes compounding. The small bond and alternatives sleeve provides modest diversification without sacrificing return potential.`;
  }

  // Dollar-weighted current allocation
  const totalBalance = input.accounts.reduce((s, a) => s + a.currentBalance, 0);
  const current: AllocationTarget = { equity: 0, bond: 0, alt: 0 };
  if (totalBalance > 0) {
    for (const a of input.accounts) {
      const w = a.currentBalance / totalBalance;
      current.equity += a.equityPct * w;
      current.bond += a.bondPct * w;
      current.alt += a.altPct * w;
    }
  }

  const gaps: AllocationGap[] = (["equity", "bond", "alt"] as const).map(ac => ({
    assetClass: ac,
    current: current[ac],
    recommended: target[ac],
    gap: target[ac] - current[ac],
  }));

  return { profile, target, current, gaps, reasoning };
}
