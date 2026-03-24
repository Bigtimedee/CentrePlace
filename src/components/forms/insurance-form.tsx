"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Toggle } from "@/components/ui/toggle";
import { Pencil, Trash2, PlusCircle, X, Check, Shield } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type PolicyType = "term" | "whole_life" | "ppli";

const POLICY_TYPE_LABELS: Record<PolicyType, string> = {
  term: "Term Life",
  whole_life: "Whole Life",
  ppli: "PPLI (Private Placement Life Insurance)",
};

const POLICY_DESCRIPTIONS: Record<PolicyType, string> = {
  term: "Pure death benefit, no cash value. Expense only — premiums are a spending outflow.",
  whole_life: "Permanent insurance with tax-deferred cash value accumulation and loan capability.",
  ppli: "Tax-free investment wrapper with death benefit. Cash value can be borrowed tax-free (PPLI loan strategy).",
};

type FormState = {
  policyName: string;
  policyType: PolicyType;
  ownershipStructure: "personal" | "ilit";
  insurer: string;
  deathBenefit: number;
  annualPremium: number;
  premiumYearsRemaining: number;
  currentCashValue: number;
  assumedReturnRate: number;        // displayed as %
  outstandingLoanBalance: number;
  maxLoanPct: number;               // displayed as %
  ppliUnderlyingAllocation: string;
  isEstateTaxFunding: boolean;
};

const EMPTY: FormState = {
  policyName: "",
  policyType: "term",
  ownershipStructure: "personal",
  insurer: "",
  deathBenefit: 0,
  annualPremium: 0,
  premiumYearsRemaining: 0,
  currentCashValue: 0,
  assumedReturnRate: 5,
  outstandingLoanBalance: 0,
  maxLoanPct: 90,
  ppliUnderlyingAllocation: "",
  isEstateTaxFunding: false,
};

function toMutation(f: FormState) {
  return {
    ...f,
    insurer: f.insurer || undefined,
    assumedReturnRate: f.assumedReturnRate / 100,
    maxLoanPct: f.maxLoanPct / 100,
    ppliUnderlyingAllocation: f.ppliUnderlyingAllocation || undefined,
  };
}

function fromRecord(r: {
  policyName: string; policyType: string; ownershipStructure: string; insurer: string | null;
  deathBenefit: number; annualPremium: number; premiumYearsRemaining: number;
  currentCashValue: number | null; assumedReturnRate: number | null;
  outstandingLoanBalance: number | null; maxLoanPct: number | null;
  ppliUnderlyingAllocation: string | null; isEstateTaxFunding: boolean;
}): FormState {
  return {
    policyName: r.policyName,
    policyType: r.policyType as PolicyType,
    ownershipStructure: r.ownershipStructure as "personal" | "ilit",
    insurer: r.insurer ?? "",
    deathBenefit: r.deathBenefit,
    annualPremium: r.annualPremium,
    premiumYearsRemaining: r.premiumYearsRemaining,
    currentCashValue: r.currentCashValue ?? 0,
    assumedReturnRate: Math.round((r.assumedReturnRate ?? 0.05) * 100 * 10) / 10,
    outstandingLoanBalance: r.outstandingLoanBalance ?? 0,
    maxLoanPct: Math.round((r.maxLoanPct ?? 0.9) * 100),
    ppliUnderlyingAllocation: r.ppliUnderlyingAllocation ?? "",
    isEstateTaxFunding: r.isEstateTaxFunding,
  };
}

function PolicyForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial: FormState;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const set = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  const isPermanent = form.policyType === "whole_life" || form.policyType === "ppli";
  const isPpli = form.policyType === "ppli";

  const availableLoan = isPermanent
    ? Math.max(0, form.currentCashValue * (form.maxLoanPct / 100) - form.outstandingLoanBalance)
    : 0;

  return (
    <div className="space-y-5 py-2">
      {/* Type selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(["term", "whole_life", "ppli"] as PolicyType[]).map(type => (
          <button
            key={type}
            type="button"
            onClick={() => set({ policyType: type })}
            className={`text-left p-3 rounded-lg border transition-colors ${
              form.policyType === type
                ? "border-indigo-500 bg-indigo-50"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="text-sm font-medium text-slate-700 mb-1">{POLICY_TYPE_LABELS[type]}</div>
            <div className="text-xs text-slate-600 leading-snug">{POLICY_DESCRIPTIONS[type]}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField label="Policy Name" required className="md:col-span-2">
          <Input value={form.policyName} onChange={e => set({ policyName: e.target.value })} placeholder="Prudential Term 20" />
        </FormField>
        <FormField label="Insurer">
          <Input value={form.insurer} onChange={e => set({ insurer: e.target.value })} placeholder="Northwestern Mutual..." />
        </FormField>

        <FormField label="Ownership Structure" hint="ILIT = Irrevocable Life Insurance Trust (excluded from estate)">
          <Select value={form.ownershipStructure} onChange={e => set({ ownershipStructure: e.target.value as "personal" | "ilit" })}>
            <option value="personal">Personal (in taxable estate)</option>
            <option value="ilit">ILIT (excluded from estate)</option>
          </Select>
        </FormField>

        <FormField label="Death Benefit" required>
          <Input type="number" min={0} prefix="$" value={form.deathBenefit} onChange={e => set({ deathBenefit: parseFloat(e.target.value) || 0 })} />
        </FormField>

        <FormField label="Annual Premium">
          <Input type="number" min={0} prefix="$" value={form.annualPremium} onChange={e => set({ annualPremium: parseFloat(e.target.value) || 0 })} />
        </FormField>

        <FormField label="Premium Years Remaining" hint="Number of years until paid-up">
          <Input type="number" min={0} max={50} value={form.premiumYearsRemaining} onChange={e => set({ premiumYearsRemaining: parseInt(e.target.value) || 0 })} />
        </FormField>

        <FormField label="Estate Tax Funding">
          <Toggle
            checked={form.isEstateTaxFunding}
            onChange={v => set({ isEstateTaxFunding: v })}
            label="Earmarked to fund estate tax liability"
          />
        </FormField>
      </div>

      {/* Cash value / loan section — permanent only */}
      {isPermanent && (
        <>
          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-sm font-medium text-slate-700 mb-3">Cash Value & Loans</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Current Cash Value">
                <Input type="number" min={0} prefix="$" value={form.currentCashValue} onChange={e => set({ currentCashValue: parseFloat(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Assumed Return Rate" hint={isPpli ? "Investment return on underlying portfolio" : "Guaranteed rate + dividend"}>
                <Input type="number" min={0} max={30} step={0.25} suffix="%" value={form.assumedReturnRate} onChange={e => set({ assumedReturnRate: parseFloat(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Max Loan %" hint="Maximum loan as % of cash value">
                <Input type="number" min={0} max={100} suffix="%" value={form.maxLoanPct} onChange={e => set({ maxLoanPct: parseFloat(e.target.value) || 90 })} />
              </FormField>
              <FormField label="Outstanding Loan Balance">
                <Input type="number" min={0} prefix="$" value={form.outstandingLoanBalance} onChange={e => set({ outstandingLoanBalance: parseFloat(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Available to Borrow">
                <div className="flex items-center h-9 px-3 bg-slate-50 border border-slate-200 rounded-md text-sm text-emerald-600">
                  {formatCurrency(availableLoan)}
                </div>
              </FormField>
            </div>
          </div>

          {isPpli && (
            <div>
              <FormField label="Underlying Investment Allocation" hint="Describe the investment portfolio inside the PPLI">
                <Input
                  value={form.ppliUnderlyingAllocation}
                  onChange={e => set({ ppliUnderlyingAllocation: e.target.value })}
                  placeholder="e.g. 70% Global Equity / 20% Fixed Income / 10% Alternatives"
                />
              </FormField>
            </div>
          )}
        </>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}><X className="h-3.5 w-3.5" /> Cancel</Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={isPending || !form.policyName}>
          <Check className="h-3.5 w-3.5" /> {isPending ? "Saving…" : "Save Policy"}
        </Button>
      </div>
    </div>
  );
}

export function InsuranceForm() {
  const { data = [], isLoading, refetch } = trpc.insurance.list.useQuery();
  const add = trpc.insurance.add.useMutation({ onSuccess: () => { refetch(); setAdding(false); } });
  const update = trpc.insurance.update.useMutation({ onSuccess: () => { refetch(); setEditingId(null); } });
  const del = trpc.insurance.delete.useMutation({ onSuccess: () => refetch() });

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (isLoading) return <div className="text-slate-600 text-sm p-8">Loading...</div>;

  const totalDeathBenefit = data.reduce((s, p) => s + p.deathBenefit, 0);
  const ilitBenefit = data.filter(p => p.ownershipStructure === "ilit").reduce((s, p) => s + p.deathBenefit, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Insurance Policies"
          description="Term, whole life, and PPLI — used in withdrawal sequencing and estate planning"
          action={
            !adding && (
              <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
                <PlusCircle className="h-3.5 w-3.5" /> Add Policy
              </Button>
            )
          }
        />

        {adding && (
          <CardBody className="border-b border-slate-200">
            <PolicyForm
              initial={EMPTY}
              onSave={f => add.mutate(toMutation(f))}
              onCancel={() => setAdding(false)}
              isPending={add.isPending}
            />
          </CardBody>
        )}

        {data.length === 0 && !adding ? (
          <CardBody><p className="text-sm text-slate-600">No insurance policies added yet.</p></CardBody>
        ) : (
          <div className="divide-y divide-slate-200">
            {data.map(policy => (
              <div key={policy.id}>
                {editingId === policy.id ? (
                  <div className="px-6 py-4">
                    <PolicyForm
                      initial={fromRecord(policy)}
                      onSave={f => update.mutate({ id: policy.id, ...toMutation(f) })}
                      onCancel={() => setEditingId(null)}
                      isPending={update.isPending}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-6 py-3 hover:bg-slate-100">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-3">
                        <Shield className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                        <span className="text-sm font-medium text-slate-700">{policy.policyName}</span>
                        <span className="text-xs text-slate-600">{POLICY_TYPE_LABELS[policy.policyType]}</span>
                        {policy.ownershipStructure === "ilit" && (
                          <span className="text-xs text-indigo-600 font-medium">ILIT</span>
                        )}
                        {policy.isEstateTaxFunding && (
                          <span className="text-xs text-amber-600">estate tax</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5 ml-5">
                        {formatCurrency(policy.annualPremium)}/yr premium · {policy.premiumYearsRemaining} yrs remaining
                        {policy.currentCashValue ? ` · ${formatCurrency(policy.currentCashValue ?? 0, true)} cash value` : ""}
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-700">{formatCurrency(policy.deathBenefit, true)}</div>
                        <div className="text-xs text-slate-600">death benefit</div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(policy.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="danger" size="sm" onClick={() => del.mutate({ id: policy.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {data.length > 0 && (
        <div className="flex items-center justify-end gap-6 text-sm text-slate-500">
          <span>Total death benefit: <span className="text-slate-700 font-semibold">{formatCurrency(totalDeathBenefit, true)}</span></span>
          {ilitBenefit > 0 && (
            <span>ILIT (excluded from estate): <span className="text-indigo-600 font-semibold">{formatCurrency(ilitBenefit, true)}</span></span>
          )}
        </div>
      )}
    </div>
  );
}
