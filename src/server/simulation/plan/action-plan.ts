// ─────────────────────────────────────────────────────────────────────────────
// Annual Action Plan — Synthesis Engine
//
// Pure function: synthesizes SimulationResult + tax data + estate + liquidity
// into a ranked, dollar-quantified ActionItem list for the current year.
// ─────────────────────────────────────────────────────────────────────────────

import type { SimulationResult, SimulationInput, QuarterResult } from "../engine/types";
import type { EstateCalculationResult } from "../estate/calculator";
import type { EstateRecommendation } from "../estate/recommendations";
import type { LiquidityTimelineResult } from "../cashflow/types";
import type { ActionItem, ActionCategory, ActionUrgency, AnnualActionPlanResult } from "./types";
import { getMarginalOrdinaryRate } from "../tax/federal-income";

// ── 2026 bracket thresholds (mirrors federal-income.ts) ──────────────────────
const STD_DED = { single: 8_300, married_filing_jointly: 16_600 } as const;
const ORDINARY_25_THRESHOLD = { single: 103_350, married_filing_jointly: 206_700 } as const;
const LTCG_ZERO_THRESHOLD = { single: 48_350, married_filing_jointly: 96_700 } as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fc(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

const URGENCY_ORDER: Record<ActionUrgency, number> = {
  do_this_year: 0,
  plan_now: 1,
  monitor: 2,
};

// ── Main synthesis function ───────────────────────────────────────────────────

export function computeActionPlan(
  planYear: number,
  simInput: SimulationInput,
  simResult: SimulationResult,
  currentYearQ4: QuarterResult,
  estate: EstateCalculationResult & { recommendations: EstateRecommendation[] },
  liquidity: LiquidityTimelineResult,
): AnnualActionPlanResult {
  const items: ActionItem[] = [];
  const filingStatus = simInput.profile.filingStatus;
  const currentAge = simResult.currentAge;

  // ── Compute bracket headroom from current-year Q4 data ────────────────────
  const stdDed = STD_DED[filingStatus];
  const taxableOrdinary = Math.max(0, currentYearQ4.annualOrdinaryIncome - stdDed);
  const stackedForLtcg = taxableOrdinary + currentYearQ4.annualLtcgIncome;
  const ordinary25Top = ORDINARY_25_THRESHOLD[filingStatus];
  const ltcgZeroTop = LTCG_ZERO_THRESHOLD[filingStatus];
  const rothCapacity = Math.max(0, ordinary25Top - taxableOrdinary);
  const ltcgZeroHeadroom = Math.max(0, ltcgZeroTop - stackedForLtcg);
  const marginalOrdinary = getMarginalOrdinaryRate(taxableOrdinary, filingStatus, planYear);

  // ── FI status ─────────────────────────────────────────────────────────────
  const { summary, fiDate, fiAge } = simResult;
  const isFI = summary.gapToFI <= 0;
  const yearsToFI = fiDate ? fiDate.year - planYear : null;
  const pctFunded = summary.requiredCapitalToday > 0
    ? Math.min(1, summary.totalCapitalToday / summary.requiredCapitalToday)
    : 1;

  // ── Rule 1: LTCG 0% Bracket Harvesting ───────────────────────────────────
  if (ltcgZeroHeadroom > 20_000) {
    const taxAvoided = ltcgZeroHeadroom * 0.20;
    items.push({
      id: "ltcg-harvest",
      title: "Harvest long-term gains in the 0% LTCG bracket",
      rationale: `You have ${fc(ltcgZeroHeadroom)} of room in the 0% federal long-term capital gains bracket this year before stacked income crosses the ${fc(ltcgZeroTop)} threshold. Realizing gains up to this limit generates zero federal capital gains tax.`,
      action: "Identify appreciated positions in taxable brokerage accounts and sell up to the 0% LTCG ceiling before December 31. Repurchase immediately to reset cost basis — there is no wash-sale rule for gains.",
      category: "tax_optimization",
      urgency: "do_this_year",
      dollarImpact: taxAvoided,
      dollarImpactLabel: "capital gains tax avoided",
      deepLinkHref: "/tax",
      deepLinkLabel: "View Tax Planning",
      supportingFigures: [
        { label: "0% LTCG headroom", value: fc(ltcgZeroHeadroom) },
        { label: "Fed. LTCG rate avoided", value: "20%" },
        { label: "Est. tax saved", value: fc(taxAvoided) },
      ],
    });
  }

  // ── Rule 2: Roth Conversion Window ────────────────────────────────────────
  if (rothCapacity > 10_000 && marginalOrdinary <= 0.25) {
    const conversionTaxCost = rothCapacity * marginalOrdinary;
    items.push({
      id: "roth-conversion",
      title: "Convert to Roth before the 25% ordinary income bracket",
      rationale: `You can convert up to ${fc(rothCapacity)} of traditional IRA or 401(k) assets to Roth this year at your current ${Math.round(marginalOrdinary * 100)}% marginal rate. Converting now at ${Math.round(marginalOrdinary * 100)}% avoids future ordinary tax on RMDs that would otherwise hit at higher rates.`,
      action: "Initiate a Roth conversion with your custodian before December 31. The converted amount is taxable ordinary income in the year of conversion. Coordinate with your CPA on exact amount to stay below the 25% bracket.",
      category: "tax_optimization",
      urgency: "do_this_year",
      dollarImpact: conversionTaxCost,
      dollarImpactLabel: "tax cost to convert (invest now, save later)",
      deepLinkHref: "/tax",
      deepLinkLabel: "View Roth Ladder",
      supportingFigures: [
        { label: "Conversion capacity", value: fc(rothCapacity) },
        { label: "Current marginal rate", value: `${Math.round(marginalOrdinary * 100)}%` },
        { label: "Tax cost this year", value: fc(conversionTaxCost) },
      ],
    });
  }

  // ── Rule 3: Carry Realization Tax Prep ────────────────────────────────────
  // For each carry position, find the nearest upcoming tranche for classification.
  for (const c of simInput.carry) {
    const netCarry = c.expectedGrossCarry * (1 - c.haircutPct);
    if (netCarry < 50_000) continue;

    // Find the soonest upcoming tranche
    const upcomingTranches = c.realizationSchedule
      .filter(t => t.year >= planYear)
      .sort((a, b) => a.year - b.year || a.quarter.localeCompare(b.quarter));
    if (upcomingTranches.length === 0) continue;

    const nearestTranche = upcomingTranches[0];
    const yearsAway = nearestTranche.year - planYear;
    if (yearsAway > 2) continue;

    const estimatedTax = netCarry * 0.238;
    const realizationLabel = `${nearestTranche.quarter} ${nearestTranche.year}`;
    const isNear = yearsAway <= 1;

    if (isNear) {
      items.push({
        id: `carry-prep-${c.id}`,
        title: `Prepare estimated tax payments for ${c.fundName} carry`,
        rationale: `Your carry from ${c.fundName} (${fc(netCarry)} net) is scheduled to realize starting in ${realizationLabel}. Federal LTCG + NIIT of approximately ${fc(estimatedTax)} will be due within 90 days of realization.`,
        action: `Ensure your Q${nearestTranche.year === planYear ? "4" : "1"} estimated tax payment covers this realization. Consider whether Qualified Opportunity Zone reinvestment is appropriate to defer gain.`,
        category: "carry_timing",
        urgency: nearestTranche.year === planYear ? "do_this_year" : "plan_now",
        dollarImpact: estimatedTax,
        dollarImpactLabel: "est. tax to prepare for",
        deepLinkHref: "/cashflow",
        deepLinkLabel: "View Liquidity Timeline",
        supportingFigures: [
          { label: "Gross carry", value: fc(c.expectedGrossCarry) },
          { label: "Net after haircut", value: fc(netCarry) },
          { label: "Est. LTCG + NIIT", value: fc(estimatedTax) },
          { label: "First realization", value: realizationLabel },
        ],
      });
    } else {
      items.push({
        id: `carry-prep-${c.id}`,
        title: `Plan for ${c.fundName} carry realization in ${nearestTranche.year}`,
        rationale: `${c.fundName} carry of ${fc(netCarry)} net is scheduled for ${realizationLabel}. Begin planning now: review QOZ eligibility, ILIT coverage, and estimated payment schedule.`,
        action: "Discuss with your CPA and attorney now to structure the realization optimally — QOZ reinvestment must be done within 180 days of the gain event.",
        category: "carry_timing",
        urgency: "plan_now",
        dollarImpact: estimatedTax,
        dollarImpactLabel: "est. tax to prepare for",
        deepLinkHref: "/cashflow",
        deepLinkLabel: "View Liquidity Timeline",
        supportingFigures: [
          { label: "Net carry", value: fc(netCarry) },
          { label: "Est. LTCG + NIIT", value: fc(estimatedTax) },
          { label: "First realization", value: realizationLabel },
        ],
      });
    }
  }

  // ── Rule 4: Top estate recommendations (up to 3) ─────────────────────────
  const topRecsToShow = estate.recommendations.slice(0, 3);
  for (const rec of topRecsToShow) {
    const urgency: ActionUrgency =
      rec.priority === "high" ? "do_this_year" :
      rec.priority === "medium" ? "plan_now" : "monitor";
    const category: ActionCategory =
      rec.category === "insurance" ? "estate_planning" :
      rec.category === "gifting" ? "estate_planning" :
      rec.category === "trust" ? "estate_planning" :
      rec.category === "portability" ? "estate_planning" :
      rec.category === "charitable" ? "estate_planning" :
      rec.category === "opportunity_zone" ? "liquidity_planning" :
      "estate_planning";
    items.push({
      id: `estate-${rec.id}`,
      title: rec.title,
      rationale: rec.description,
      action: rec.actionRequired,
      category,
      urgency,
      dollarImpact: rec.estimatedTaxSavings,
      dollarImpactLabel: "estate tax saved",
      deepLinkHref: "/estate",
      deepLinkLabel: "View Estate Plan",
      supportingFigures: rec.supportingFigures,
    });
  }

  // ── Rule 5: LP distribution tax planning (current year) ──────────────────
  const thisYearLPEvents = liquidity.events.filter(
    e => e.source === "lp_distribution" && e.year === planYear,
  );
  const totalLPThisYear = thisYearLPEvents.reduce((s, e) => s + e.grossAmount, 0);
  const totalLPTaxThisYear = thisYearLPEvents.reduce((s, e) => s + e.estimatedTax, 0);

  if (totalLPThisYear > 50_000) {
    const fundNames = [...new Set(thisYearLPEvents.map(e => e.label))].join(", ");
    const hasOrdinary = thisYearLPEvents.some(e => e.taxCharacter === "ordinary");
    const urgency: ActionUrgency = thisYearLPEvents.some(e => {
      const qIdx = ["Q1", "Q2"].indexOf(e.quarter);
      return qIdx >= 0;
    }) ? "do_this_year" : "plan_now";

    items.push({
      id: "lp-dist-tax",
      title: `Plan for LP distributions hitting this year`,
      rationale: `${fc(totalLPThisYear)} in LP distributions are expected this year from ${fundNames}. ${hasOrdinary ? "Some distributions carry ordinary income character, which stacks on top of W-2 income and increases your effective tax rate." : "These distributions are primarily LTCG character."} Review your bracket headroom before they arrive.`,
      action: "Confirm distribution amounts and tax characters with your LP fund managers. Increase estimated Q3 or Q4 payments if these distributions push you above your prior-year safe harbor.",
      category: "lp_distribution",
      urgency,
      dollarImpact: totalLPTaxThisYear,
      dollarImpactLabel: "est. tax on LP distributions",
      deepLinkHref: "/cashflow",
      deepLinkLabel: "View Liquidity Timeline",
      supportingFigures: [
        { label: "Total LP distributions", value: fc(totalLPThisYear) },
        { label: "Est. tax", value: fc(totalLPTaxThisYear) },
        { label: "Sources", value: fundNames.substring(0, 40) + (fundNames.length > 40 ? "…" : "") },
      ],
    });
  }

  // ── Rule 6: Insurance coverage gap ───────────────────────────────────────
  const estateFundingCoverage = simInput.insurance
    .filter(p => p.isEstateTaxFunding && p.ownershipStructure === "ilit")
    .reduce((s, p) => s + Math.max(0, p.deathBenefit - p.outstandingLoanBalance), 0);

  if (estate.totalEstateTax > 0 && estateFundingCoverage < estate.totalEstateTax * 0.9) {
    const gap = estate.totalEstateTax - estateFundingCoverage;
    // Only fire if not already covered by an estate recommendation about ILIT
    const alreadyCoveredByEstate = estate.recommendations.some(r => r.id === "ilit-conversion");
    if (!alreadyCoveredByEstate) {
      items.push({
        id: "insurance-gap",
        title: "Close the estate tax funding gap with additional ILIT coverage",
        rationale: `Your projected estate tax of ${fc(estate.totalEstateTax)} exceeds your ILIT-owned estate-funding insurance coverage of ${fc(estateFundingCoverage)} by ${fc(gap)}. Without adequate coverage, heirs may be forced to liquidate assets to pay the estate tax bill.`,
        action: `Work with a life insurance specialist to add an ILIT-owned policy sized to cover the ${fc(gap)} gap. Term life is least expensive; whole life or PPLI provides additional planning flexibility.`,
        category: "insurance_review",
        urgency: "plan_now",
        dollarImpact: gap,
        dollarImpactLabel: "estate tax unfunded",
        deepLinkHref: "/estate",
        deepLinkLabel: "View Estate Plan",
        supportingFigures: [
          { label: "Est. estate tax", value: fc(estate.totalEstateTax) },
          { label: "ILIT coverage", value: fc(estateFundingCoverage) },
          { label: "Funding gap", value: fc(gap) },
        ],
      });
    }
  }

  // ── Rule 7: FI proximity milestone ────────────────────────────────────────
  if (!isFI && yearsToFI !== null && yearsToFI <= 3) {
    const urgency: ActionUrgency = yearsToFI <= 1 ? "do_this_year" : "plan_now";
    items.push({
      id: "fi-proximity",
      title: `Finalize your FI transition plan — ${yearsToFI <= 1 ? "within this year" : `${yearsToFI} years away`}`,
      rationale: `You are projected to reach financial independence in ${fiDate?.quarter} ${fiDate?.year} at age ${fiAge}. Now is the time to confirm your withdrawal sequence, ensure adequate health insurance bridge coverage, and complete any remaining estate planning before earned income ends.`,
      action: "Review your withdrawal optimizer, confirm insurance coverage continues post-employment, and schedule an estate planning review with your attorney. Consider whether any remaining carry positions need restructuring before FI.",
      category: "fi_acceleration",
      urgency,
      dollarImpact: 0,
      dollarImpactLabel: "",
      deepLinkHref: "/dashboard",
      deepLinkLabel: "View FI Dashboard",
      supportingFigures: [
        { label: "Projected FI date", value: `${fiDate?.quarter} ${fiDate?.year}` },
        { label: "FI age", value: `${fiAge}` },
        { label: "Years away", value: `${yearsToFI}` },
        { label: "% funded", value: `${Math.round(pctFunded * 100)}%` },
      ],
    });
  } else if (isFI) {
    items.push({
      id: "fi-achieved",
      title: "You've achieved FI — optimize your post-FI income structure",
      rationale: "Your portfolio has crossed the financial independence threshold. The priority now shifts from accumulation to tax-efficient distribution: sequencing withdrawals, managing RMDs, and preserving the estate.",
      action: "Review your withdrawal plan annually. Consider whether Roth conversions are still advantageous given RMD rules. Ensure estate documents are current.",
      category: "fi_acceleration",
      urgency: "monitor",
      dollarImpact: 0,
      dollarImpactLabel: "",
      deepLinkHref: "/dashboard",
      deepLinkLabel: "View FI Dashboard",
    });
  }

  // ── Deduplicate by ID (in case estate recs overlap with other rules) ───────
  const seen = new Set<string>();
  const deduplicated = items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  // ── Sort: urgency tier first, then dollarImpact descending ────────────────
  deduplicated.sort((a, b) => {
    const urgencyDiff = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;
    return b.dollarImpact - a.dollarImpact;
  });

  const totalImpact = deduplicated.reduce((s, i) => s + i.dollarImpact, 0);
  const doThisYearCount = deduplicated.filter(i => i.urgency === "do_this_year").length;
  const topItem = deduplicated.find(i => i.urgency === "do_this_year") ?? deduplicated[0];

  return {
    planYear,
    currentAge,
    items: deduplicated,
    totalQuantifiedDollarImpact: totalImpact,
    doThisYearCount,
    topCategory: topItem?.category ?? null,
    fiStatus: { isFI, yearsToFI, gapToFI: summary.gapToFI, pctFunded },
  };
}
