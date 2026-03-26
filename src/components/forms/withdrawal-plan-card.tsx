"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { formatCurrency, formatPct } from "@/lib/utils";
import { AlertCircle, ArrowRight, Banknote, TrendingDown } from "lucide-react";
import type { WithdrawalSourceType } from "@/server/simulation/engine/withdrawal-optimizer";

// ── Source type styling ────────────────────────────────────────────────────────

const SOURCE_META: Record<
  WithdrawalSourceType,
  { label: string; color: string; bg: string; badge: string }
> = {
  rmd:           { label: "RMD",         color: "text-amber-600",   bg: "bg-amber-50",   badge: "border-amber-200" },
  ppli_loan:     { label: "PPLI Loan",   color: "text-emerald-600", bg: "bg-emerald-50", badge: "border-emerald-200" },
  wl_loan:       { label: "WL Loan",     color: "text-emerald-600", bg: "bg-emerald-50", badge: "border-emerald-200" },
  taxable_0pct:  { label: "Taxable 0%",  color: "text-sky-600",     bg: "bg-sky-50",     badge: "border-sky-200" },
  roth:          { label: "Roth",        color: "text-violet-600",  bg: "bg-violet-50",  badge: "border-violet-200" },
  taxable_15pct: { label: "Taxable 15%", color: "text-yellow-600",  bg: "bg-yellow-50",  badge: "border-yellow-200" },
  traditional:   { label: "Traditional", color: "text-rose-600",    bg: "bg-rose-50",    badge: "border-rose-200" },
};

function SourceBadge({ type }: { type: WithdrawalSourceType }) {
  const m = SOURCE_META[type];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${m.color} ${m.bg} ${m.badge}`}>
      {m.label}
    </span>
  );
}

function TaxBadge({ rate }: { rate: number }) {
  if (rate === 0) {
    return <span className="text-xs text-emerald-600 font-medium">Tax-free</span>;
  }
  return <span className="text-xs text-slate-500">{formatPct(rate)} effective</span>;
}

export function WithdrawalPlanCard() {
  const { data: plan, isLoading, error } = trpc.simulation.withdrawalPlan.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader title="Withdrawal Strategy" description="Optimal sequencing for your retirement income" />
        <CardBody>
          <div className="h-24 flex items-center justify-center text-slate-600 text-sm">Computing…</div>
        </CardBody>
      </Card>
    );
  }

  if (error || !plan) {
    return (
      <Card>
        <CardHeader title="Withdrawal Strategy" description="Optimal sequencing for your retirement income" />
        <CardBody>
          <div className="flex items-center gap-2 text-amber-600 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            Complete your profile and expenditures to see withdrawal recommendations.
          </div>
        </CardBody>
      </Card>
    );
  }

  if (plan.steps.length === 0) {
    return (
      <Card>
        <CardHeader title="Withdrawal Strategy" description="Optimal sequencing for your retirement income" />
        <CardBody>
          <p className="text-sm text-slate-600">
            No accounts added yet. Add investment accounts, insurance policies, and expenditures to see your
            optimized withdrawal plan.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Withdrawal Strategy"
        description="Tax-optimized sequencing: PPLI → WL → Roth → Taxable → Traditional"
      />

      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y divide-slate-200 sm:divide-y-0 sm:divide-x border-b border-slate-200">
        <div className="px-5 py-3">
          <p className="text-xs text-slate-600">Annual need</p>
          <p className="text-sm font-semibold text-slate-900 mt-0.5">
            {formatCurrency(plan.metNeed + plan.unmetNeed)}
          </p>
        </div>
        <div className="px-5 py-3">
          <p className="text-xs text-slate-600">Total tax</p>
          <p className="text-sm font-semibold text-rose-600 mt-0.5">{formatCurrency(plan.totalTax)}</p>
          <p className="text-xs text-slate-600">{formatPct(plan.effectiveTaxRate)} rate</p>
        </div>
        <div className="px-5 py-3">
          <p className="text-xs text-slate-600">Tax savings</p>
          <p className="text-sm font-semibold text-emerald-600 mt-0.5">
            {plan.taxSavings > 0 ? `+${formatCurrency(plan.taxSavings)}` : formatCurrency(0)}
          </p>
          <p className="text-xs text-slate-600">vs all-traditional</p>
        </div>
      </div>

      {/* Waterfall steps */}
      <div className="divide-y divide-slate-200">
        {plan.steps.map((step, i) => {
          const isLast = i === plan.steps.length - 1;
          return (
            <div key={`${step.accountId}-${step.rank}`} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-100">
              {/* Rank connector */}
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                <div className="w-6 h-6 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-xs text-slate-500">
                  {step.rank}
                </div>
                {!isLast && <div className="w-px h-3 bg-slate-200" />}
              </div>

              {/* Source */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <SourceBadge type={step.sourceType} />
                  <span className="text-sm text-slate-700 truncate">{step.label}</span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 truncate">{step.notes}</p>
              </div>

              {/* Amounts */}
              <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 text-right">
                <div>
                  <p className="text-sm font-medium text-slate-700">{formatCurrency(step.grossAmount)}</p>
                  <TaxBadge rate={step.taxCost > 0 ? step.taxCost / step.grossAmount : 0} />
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{formatCurrency(step.netAmount)}</p>
                  <p className="text-xs text-slate-600">net</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Banknote className="h-3.5 w-3.5" />
          Cost basis assumed 50% for taxable accounts · RMD age 73+
        </div>
        {plan.rmdAmount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600">
            <AlertCircle className="h-3.5 w-3.5" />
            RMD required: {formatCurrency(plan.rmdAmount)}
          </div>
        )}
        {plan.unmetNeed > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-rose-600">
            <TrendingDown className="h-3.5 w-3.5" />
            Unmet: {formatCurrency(plan.unmetNeed)} — add more accounts
          </div>
        )}
      </div>
    </Card>
  );
}
