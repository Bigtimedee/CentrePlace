"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { AlertCircle, Lock, Sparkles } from "lucide-react";
import {
  allocationTargetToPolicyForm as _allocationTargetToPolicyForm,
  REINVESTMENT_RATE_DEFAULTS,
  type PolicyForm,
} from "@/server/portfolios/reinvestment-policy-utils";

export { allocationTargetToPolicyForm } from "@/server/portfolios/reinvestment-policy-utils";

// ── Types ────────────────────────────────────────────────────────────────────

type PolicyMode = "self-directed" | "recommended";

// ── Constants ────────────────────────────────────────────────────────────────

const RATE_DEFAULTS = REINVESTMENT_RATE_DEFAULTS;

const SELF_DIRECTED_DEFAULTS: PolicyForm = {
  equityPct: 50,
  taxableFixedIncomePct: 20,
  taxExemptFixedIncomePct: 10,
  realEstatePct: 20,
  ...RATE_DEFAULTS,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toMutation(f: PolicyForm) {
  return {
    equityPct: f.equityPct / 100,
    equityAppreciationRate: f.equityAppreciationRate / 100,
    equityQualifiedYieldRate: f.equityQualifiedYieldRate / 100,
    taxableFixedIncomePct: f.taxableFixedIncomePct / 100,
    taxableFixedIncomeRate: f.taxableFixedIncomeRate / 100,
    taxExemptFixedIncomePct: f.taxExemptFixedIncomePct / 100,
    taxExemptFixedIncomeRate: f.taxExemptFixedIncomeRate / 100,
    realEstatePct: f.realEstatePct / 100,
    reAppreciationRate: f.reAppreciationRate / 100,
    reGrossYieldRate: f.reGrossYieldRate / 100,
    reCarryingCostRate: f.reCarryingCostRate / 100,
  };
}

function pct(n: number) {
  return Math.round(n * 100 * 10) / 10;
}

// Alias for internal use (component seeds form from recommendation)
const allocationTargetToPolicyForm = _allocationTargetToPolicyForm;

// ── Sub-components ────────────────────────────────────────────────────────────

function ReadOnlyPct({ value }: { value: number }) {
  return (
    <div className="flex rounded-md border border-slate-200 bg-slate-50 overflow-hidden">
      <div className="flex flex-col justify-center flex-1 px-3 py-2">
        <span className="text-sm font-semibold text-slate-900 leading-none">
          {value.toFixed(1)}%
        </span>
        <span className="text-xs text-slate-500 mt-0.5">From profile</span>
      </div>
      <div className="flex items-center px-3 bg-slate-100 border-l border-slate-200">
        <Lock className="h-3 w-3 text-slate-400" />
      </div>
    </div>
  );
}

function AllocationSkeleton() {
  return <div className="h-9 w-full rounded-md bg-slate-200 animate-pulse" />;
}

// ── Main component ────────────────────────────────────────────────────────────

export function ReinvestmentPolicyPanel() {
  const { data: policy, isLoading, refetch } = trpc.realizationPolicy.get.useQuery();
  const upsert = trpc.realizationPolicy.upsert.useMutation({ onSuccess: () => { refetch(); toast.success("Policy saved"); } });
  const del = trpc.realizationPolicy.delete.useMutation({
    onSuccess: () => {
      setMode("self-directed");
      void refetch();
    },
  });

  const [mode, setMode] = useState<PolicyMode>("self-directed");
  const [enabled, setEnabled] = useState(false);
  const [form, setForm] = useState<PolicyForm>(SELF_DIRECTED_DEFAULTS);
  const set = (patch: Partial<PolicyForm>) => setForm(f => ({ ...f, ...patch }));

  const { data: recommendation, isLoading: recLoading } =
    trpc.portfolios.getAllocationRecommendation.useQuery(
      { fiDateYear: null, isFI: false },
      { enabled: mode === "recommended" && enabled }
    );

  // Hydrate from DB
  useEffect(() => {
    if (policy) {
      setEnabled(true);
      setForm({
        equityPct: pct(policy.equityPct),
        equityAppreciationRate: pct(policy.equityAppreciationRate),
        equityQualifiedYieldRate: pct(policy.equityQualifiedYieldRate),
        taxableFixedIncomePct: pct(policy.taxableFixedIncomePct),
        taxableFixedIncomeRate: pct(policy.taxableFixedIncomeRate),
        taxExemptFixedIncomePct: pct(policy.taxExemptFixedIncomePct),
        taxExemptFixedIncomeRate: pct(policy.taxExemptFixedIncomeRate),
        realEstatePct: pct(policy.realEstatePct),
        reAppreciationRate: pct(policy.reAppreciationRate),
        reGrossYieldRate: pct(policy.reGrossYieldRate),
        reCarryingCostRate: pct(policy.reCarryingCostRate),
      });
    } else if (!isLoading) {
      setEnabled(false);
    }
  }, [policy, isLoading]);

  // Seed form from recommendation
  useEffect(() => {
    if (mode === "recommended" && recommendation) {
      setForm(allocationTargetToPolicyForm(recommendation.target));
      setEnabled(true);
    }
  }, [mode, recommendation]);

  const allocSum =
    form.equityPct + form.taxableFixedIncomePct + form.taxExemptFixedIncomePct + form.realEstatePct;
  const cashPct = Math.max(0, 100 - allocSum);
  const allocOk = allocSum <= 100.01;

  const profileLabel: Record<string, string> = {
    aggressive: "Aggressive (80% equity / 15% bonds / 5% alternatives)",
    moderate: "Moderate (65% equity / 25% bonds / 10% alternatives)",
    conservative: "Conservative (50% equity / 35% bonds / 15% alternatives)",
    fi_achieved: "FI Achieved (40% equity / 45% bonds / 15% alternatives)",
  };

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader
        title="Carry / LP Reinvestment Policy"
        description="How carry and LP proceeds are reinvested — if not set, proceeds go into the general investment pool"
        action={
          <div className="flex items-center gap-2">
            {enabled && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => del.mutate()}
                loading={del.isPending}
              >
                {del.isPending ? "Removing…" : "Remove Policy"}
              </Button>
            )}

            {enabled && (
              <div
                className="flex items-center bg-slate-100 border border-slate-200 rounded-full p-0.5"
                role="radiogroup"
                aria-label="Reinvestment mode"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "self-directed"}
                  onClick={() => setMode("self-directed")}
                  className={[
                    "px-3 py-1 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
                    mode === "self-directed"
                      ? "bg-[#C8A45A] text-[#1A0F28] shadow-sm"
                      : "bg-transparent text-slate-600 hover:text-slate-900",
                  ].join(" ")}
                >
                  Self-Directed
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "recommended"}
                  onClick={() => setMode("recommended")}
                  className={[
                    "px-3 py-1 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
                    mode === "recommended"
                      ? "bg-[#C8A45A] text-[#1A0F28] shadow-sm"
                      : "bg-transparent text-slate-600 hover:text-slate-900",
                  ].join(" ")}
                >
                  Recommended
                </button>
              </div>
            )}

            {!enabled && (
              <Button variant="secondary" size="sm" onClick={() => setEnabled(true)}>
                Set Policy
              </Button>
            )}
          </div>
        }
      />

      {!enabled && (
        <CardBody>
          <p className="text-sm text-muted-foreground">
            No reinvestment policy set. Carry and LP proceeds will be added to your general
            investment pool.
          </p>
        </CardBody>
      )}

      {enabled && (
        <CardBody>
          <div className="space-y-6">
            {/* Recommended mode banner */}
            {mode === "recommended" && (
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
                <Sparkles className="h-4 w-4 text-[#C8A45A] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Allocation-guided percentages
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    The allocation percentages below are derived from your portfolio profile.
                    Adjust the return rate assumptions, then save.
                    {recommendation?.profile && (
                      <span className="ml-1 inline-flex items-center rounded-full bg-[#FFF3D8] border border-[#D4B896] px-2 py-0.5 text-xs font-medium text-[#C8A45A]">
                        {profileLabel[recommendation.profile] ?? recommendation.profile}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Recommended mode fallback */}
            {mode === "recommended" && !recLoading && !recommendation && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">
                  Your allocation profile isn&apos;t available yet. Add investment accounts and
                  complete your profile to use Recommended mode.
                </p>
              </div>
            )}

            {/* Allocation summary */}
            <div className="flex items-center gap-2 text-xs">
              {!allocOk && (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertCircle className="h-3 w-3" /> Allocation sum {allocSum.toFixed(1)}%
                  exceeds 100%
                </span>
              )}
              {allocOk && (
                <span className="text-muted-foreground">
                  Cash remainder: {cashPct.toFixed(1)}% (0% return)
                </span>
              )}
            </div>

            {/* Equity */}
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">
                Equity (e.g. S&amp;P 500)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField label="Allocation">
                  {recLoading ? (
                    <AllocationSkeleton />
                  ) : mode === "recommended" ? (
                    <ReadOnlyPct value={form.equityPct} />
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      suffix="%"
                      value={form.equityPct}
                      onChange={e => set({ equityPct: parseFloat(e.target.value) || 0 })}
                    />
                  )}
                </FormField>
                <FormField label="Appreciation rate" hint="Capital appreciation only">
                  <Input
                    type="number"
                    min={0}
                    max={30}
                    step={0.25}
                    suffix="%"
                    value={form.equityAppreciationRate}
                    onChange={e => set({ equityAppreciationRate: parseFloat(e.target.value) || 0 })}
                  />
                </FormField>
                <FormField label="Qualified dividend yield" hint="Taxed at LTCG rates">
                  <Input
                    type="number"
                    min={0}
                    max={15}
                    step={0.1}
                    suffix="%"
                    value={form.equityQualifiedYieldRate}
                    onChange={e =>
                      set({ equityQualifiedYieldRate: parseFloat(e.target.value) || 0 })
                    }
                  />
                </FormField>
              </div>
            </div>

            {/* Taxable fixed income */}
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">
                Taxable Fixed Income (e.g. corporate/treasury bonds)
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Allocation">
                  {recLoading ? (
                    <AllocationSkeleton />
                  ) : mode === "recommended" ? (
                    <ReadOnlyPct value={form.taxableFixedIncomePct} />
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      suffix="%"
                      value={form.taxableFixedIncomePct}
                      onChange={e =>
                        set({ taxableFixedIncomePct: parseFloat(e.target.value) || 0 })
                      }
                    />
                  )}
                </FormField>
                <FormField label="Yield rate" hint="Ordinary income — fully taxable">
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    step={0.25}
                    suffix="%"
                    value={form.taxableFixedIncomeRate}
                    onChange={e =>
                      set({ taxableFixedIncomeRate: parseFloat(e.target.value) || 0 })
                    }
                  />
                </FormField>
              </div>
            </div>

            {/* Tax-exempt fixed income */}
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">
                Tax-Exempt Fixed Income (e.g. municipal bonds)
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Allocation">
                  {recLoading ? (
                    <AllocationSkeleton />
                  ) : mode === "recommended" ? (
                    <ReadOnlyPct value={form.taxExemptFixedIncomePct} />
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      suffix="%"
                      value={form.taxExemptFixedIncomePct}
                      onChange={e =>
                        set({ taxExemptFixedIncomePct: parseFloat(e.target.value) || 0 })
                      }
                    />
                  )}
                </FormField>
                <FormField label="Yield rate" hint="Tax-free income — no federal tax">
                  <Input
                    type="number"
                    min={0}
                    max={15}
                    step={0.1}
                    suffix="%"
                    value={form.taxExemptFixedIncomeRate}
                    onChange={e =>
                      set({ taxExemptFixedIncomeRate: parseFloat(e.target.value) || 0 })
                    }
                  />
                </FormField>
              </div>
            </div>

            {/* Real estate */}
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">
                Real Estate / Hard Assets
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FormField label="Allocation">
                  {recLoading ? (
                    <AllocationSkeleton />
                  ) : mode === "recommended" ? (
                    <ReadOnlyPct value={form.realEstatePct} />
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      suffix="%"
                      value={form.realEstatePct}
                      onChange={e => set({ realEstatePct: parseFloat(e.target.value) || 0 })}
                    />
                  )}
                </FormField>
                <FormField label="Appreciation" hint="Annual price appreciation">
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    step={0.25}
                    suffix="%"
                    value={form.reAppreciationRate}
                    onChange={e => set({ reAppreciationRate: parseFloat(e.target.value) || 0 })}
                  />
                </FormField>
                <FormField label="Gross yield" hint="Gross rental-like yield">
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    step={0.25}
                    suffix="%"
                    value={form.reGrossYieldRate}
                    onChange={e => set({ reGrossYieldRate: parseFloat(e.target.value) || 0 })}
                  />
                </FormField>
                <FormField label="Carrying cost" hint="Taxes, insurance, maintenance">
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    suffix="%"
                    value={form.reCarryingCostRate}
                    onChange={e => set({ reCarryingCostRate: parseFloat(e.target.value) || 0 })}
                  />
                </FormField>
              </div>
            </div>

            {/* Save */}
            <div className="flex flex-col items-end gap-1">
              <Button
                onClick={() => upsert.mutate(toMutation(form))}
                disabled={!allocOk}
                loading={upsert.isPending}
              >
                {upsert.isPending ? "Saving…" : "Save Policy"}
              </Button>
              {mode === "recommended" && (
                <p className="text-xs text-muted-foreground">Rate fields are editable</p>
              )}
            </div>
          </div>
        </CardBody>
      )}
    </Card>
  );
}
