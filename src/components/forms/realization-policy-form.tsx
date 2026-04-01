"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { AlertCircle } from "lucide-react";

type PolicyForm = {
  equityPct: number;               // displayed as %
  equityAppreciationRate: number;  // displayed as %
  equityQualifiedYieldRate: number;
  taxableFixedIncomePct: number;
  taxableFixedIncomeRate: number;
  taxExemptFixedIncomePct: number;
  taxExemptFixedIncomeRate: number;
  realEstatePct: number;
  reAppreciationRate: number;
  reGrossYieldRate: number;
  reCarryingCostRate: number;
};

const DEFAULTS: PolicyForm = {
  equityPct: 50,
  equityAppreciationRate: 5.5,
  equityQualifiedYieldRate: 1.5,
  taxableFixedIncomePct: 20,
  taxableFixedIncomeRate: 4,
  taxExemptFixedIncomePct: 10,
  taxExemptFixedIncomeRate: 3,
  realEstatePct: 20,
  reAppreciationRate: 4,
  reGrossYieldRate: 6,
  reCarryingCostRate: 2,
};

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

export function RealizationPolicyForm() {
  const { data: policy, isLoading, refetch } = trpc.realizationPolicy.get.useQuery();
  const upsert = trpc.realizationPolicy.upsert.useMutation({ onSuccess: () => { refetch(); toast.success("Policy saved"); } });
  const del = trpc.realizationPolicy.delete.useMutation({ onSuccess: () => refetch() });

  const [enabled, setEnabled] = useState(false);
  const [form, setForm] = useState<PolicyForm>(DEFAULTS);
  const set = (patch: Partial<PolicyForm>) => setForm(f => ({ ...f, ...patch }));

  useEffect(() => {
    if (policy) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const allocSum = form.equityPct + form.taxableFixedIncomePct + form.taxExemptFixedIncomePct + form.realEstatePct;
  const cashPct = Math.max(0, 100 - allocSum);
  const allocOk = allocSum <= 100.01;

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader
        title="Carry / LP Reinvestment Policy"
        description="How carry and LP proceeds are reinvested — if not set, proceeds go into the general investment pool"
        action={
          enabled ? (
            <Button variant="danger" size="sm" onClick={() => del.mutate()} disabled={del.isPending}>
              {del.isPending ? "Removing…" : "Remove Policy"}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setEnabled(true)}>
              Set Policy
            </Button>
          )
        }
      />

      {!enabled && (
        <CardBody>
          <p className="text-sm text-slate-600">
            No reinvestment policy set. Carry and LP proceeds will be added to your general investment pool.
          </p>
        </CardBody>
      )}

      {enabled && (
        <CardBody>
          <div className="space-y-6">
            {/* Allocation summary */}
            <div className="flex items-center gap-2 text-xs">
              {!allocOk && (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertCircle className="h-3 w-3" /> Allocation sum {allocSum.toFixed(1)}% exceeds 100%
                </span>
              )}
              {allocOk && (
                <span className="text-slate-600">
                  Cash remainder: {cashPct.toFixed(1)}% (0% return)
                </span>
              )}
            </div>

            {/* Equity */}
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-3">Equity (e.g. S&P 500)</h4>
              <div className="grid grid-cols-3 gap-4">
                <FormField label="Allocation">
                  <Input type="number" min={0} max={100} step={1} suffix="%" value={form.equityPct}
                    onChange={e => set({ equityPct: parseFloat(e.target.value) || 0 })} />
                </FormField>
                <FormField label="Appreciation rate" hint="Capital appreciation only">
                  <Input type="number" min={0} max={30} step={0.25} suffix="%" value={form.equityAppreciationRate}
                    onChange={e => set({ equityAppreciationRate: parseFloat(e.target.value) || 0 })} />
                </FormField>
                <FormField label="Qualified dividend yield" hint="Taxed at LTCG rates">
                  <Input type="number" min={0} max={15} step={0.1} suffix="%" value={form.equityQualifiedYieldRate}
                    onChange={e => set({ equityQualifiedYieldRate: parseFloat(e.target.value) || 0 })} />
                </FormField>
              </div>
            </div>

            {/* Taxable fixed income */}
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-3">Taxable Fixed Income (e.g. corporate/treasury bonds)</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Allocation">
                  <Input type="number" min={0} max={100} step={1} suffix="%" value={form.taxableFixedIncomePct}
                    onChange={e => set({ taxableFixedIncomePct: parseFloat(e.target.value) || 0 })} />
                </FormField>
                <FormField label="Yield rate" hint="Ordinary income — fully taxable">
                  <Input type="number" min={0} max={20} step={0.25} suffix="%" value={form.taxableFixedIncomeRate}
                    onChange={e => set({ taxableFixedIncomeRate: parseFloat(e.target.value) || 0 })} />
                </FormField>
              </div>
            </div>

            {/* Tax-exempt fixed income */}
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-3">Tax-Exempt Fixed Income (e.g. municipal bonds)</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Allocation">
                  <Input type="number" min={0} max={100} step={1} suffix="%" value={form.taxExemptFixedIncomePct}
                    onChange={e => set({ taxExemptFixedIncomePct: parseFloat(e.target.value) || 0 })} />
                </FormField>
                <FormField label="Yield rate" hint="Tax-free income — no federal tax">
                  <Input type="number" min={0} max={15} step={0.1} suffix="%" value={form.taxExemptFixedIncomeRate}
                    onChange={e => set({ taxExemptFixedIncomeRate: parseFloat(e.target.value) || 0 })} />
                </FormField>
              </div>
            </div>

            {/* Real estate */}
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-3">Real Estate / Hard Assets</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FormField label="Allocation">
                  <Input type="number" min={0} max={100} step={1} suffix="%" value={form.realEstatePct}
                    onChange={e => set({ realEstatePct: parseFloat(e.target.value) || 0 })} />
                </FormField>
                <FormField label="Appreciation" hint="Annual price appreciation">
                  <Input type="number" min={0} max={20} step={0.25} suffix="%" value={form.reAppreciationRate}
                    onChange={e => set({ reAppreciationRate: parseFloat(e.target.value) || 0 })} />
                </FormField>
                <FormField label="Gross yield" hint="Gross rental-like yield">
                  <Input type="number" min={0} max={20} step={0.25} suffix="%" value={form.reGrossYieldRate}
                    onChange={e => set({ reGrossYieldRate: parseFloat(e.target.value) || 0 })} />
                </FormField>
                <FormField label="Carrying cost" hint="Taxes, insurance, maintenance">
                  <Input type="number" min={0} max={10} step={0.1} suffix="%" value={form.reCarryingCostRate}
                    onChange={e => set({ reCarryingCostRate: parseFloat(e.target.value) || 0 })} />
                </FormField>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => upsert.mutate(toMutation(form))} disabled={upsert.isPending || !allocOk}>
                {upsert.isPending ? "Saving…" : "Save Policy"}
              </Button>
            </div>
          </div>
        </CardBody>
      )}
    </Card>
  );
}
