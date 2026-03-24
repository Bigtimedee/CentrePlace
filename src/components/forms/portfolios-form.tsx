"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Pencil, Trash2, PlusCircle, X, Check, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type AccountType = "taxable" | "traditional_ira" | "roth_ira" | "traditional_401k" | "roth_401k" | "sep_ira" | "solo_401k";

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  taxable: "Taxable",
  traditional_ira: "Traditional IRA",
  roth_ira: "Roth IRA",
  traditional_401k: "Traditional 401(k)",
  roth_401k: "Roth 401(k)",
  sep_ira: "SEP-IRA",
  solo_401k: "Solo 401(k)",
};

type FormState = {
  accountName: string;
  accountType: AccountType;
  currentBalance: number;
  equityPct: number;    // displayed as %
  bondPct: number;
  altPct: number;
  equityReturnRate: number;   // displayed as %
  bondReturnRate: number;
  altReturnRate: number;
  annualContribution: number;
  ordinaryYieldRate: number;  // displayed as %
  qualifiedYieldRate: number;
  taxExemptYieldRate: number;
};

const EMPTY: FormState = {
  accountName: "",
  accountType: "taxable",
  currentBalance: 0,
  equityPct: 70,
  bondPct: 20,
  altPct: 10,
  equityReturnRate: 8,
  bondReturnRate: 4,
  altReturnRate: 7,
  annualContribution: 0,
  ordinaryYieldRate: 0,
  qualifiedYieldRate: 0,
  taxExemptYieldRate: 0,
};

function toMutation(f: FormState) {
  return {
    ...f,
    equityPct: f.equityPct / 100,
    bondPct: f.bondPct / 100,
    altPct: f.altPct / 100,
    equityReturnRate: f.equityReturnRate / 100,
    bondReturnRate: f.bondReturnRate / 100,
    altReturnRate: f.altReturnRate / 100,
    ordinaryYieldRate: f.ordinaryYieldRate / 100,
    qualifiedYieldRate: f.qualifiedYieldRate / 100,
    taxExemptYieldRate: f.taxExemptYieldRate / 100,
  };
}

function AccountForm({
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

  const allocationSum = form.equityPct + form.bondPct + form.altPct;
  const allocationOk = Math.abs(allocationSum - 100) < 0.1;
  const blendedReturn =
    (form.equityPct / 100) * form.equityReturnRate +
    (form.bondPct / 100) * form.bondReturnRate +
    (form.altPct / 100) * form.altReturnRate;
  const totalYield = form.ordinaryYieldRate + form.qualifiedYieldRate + form.taxExemptYieldRate;
  const appreciationDisplay = Math.max(0, blendedReturn - totalYield);

  return (
    <div className="space-y-5 py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Account Name" required className="md:col-span-2">
          <Input value={form.accountName} onChange={e => set({ accountName: e.target.value })} placeholder="Schwab Taxable, Fidelity 401k..." />
        </FormField>
        <FormField label="Account Type" required>
          <Select value={form.accountType} onChange={e => set({ accountType: e.target.value as AccountType })}>
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Current Balance">
          <Input type="number" min={0} prefix="$" value={form.currentBalance} onChange={e => set({ currentBalance: parseFloat(e.target.value) || 0 })} />
        </FormField>
        <FormField label="Annual Contribution" hint="Pre-FI contributions per year">
          <Input type="number" min={0} prefix="$" value={form.annualContribution} onChange={e => set({ annualContribution: parseFloat(e.target.value) || 0 })} />
        </FormField>
      </div>

      {/* Asset Allocation */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-slate-700">Asset Allocation</h4>
          <div className="flex items-center gap-2">
            {!allocationOk && (
              <span className="flex items-center gap-1 text-xs text-amber-600">
                <AlertCircle className="h-3 w-3" /> Sum = {allocationSum.toFixed(1)}% (must be 100%)
              </span>
            )}
            {allocationOk && (
              <span className="text-xs text-slate-600">
                Blended return: {blendedReturn.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-3">
            <FormField label="Equity">
              <Input type="number" min={0} max={100} suffix="%" value={form.equityPct} onChange={e => set({ equityPct: parseFloat(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Return rate">
              <Input type="number" min={0} max={50} step={0.5} suffix="%" value={form.equityReturnRate} onChange={e => set({ equityReturnRate: parseFloat(e.target.value) || 0 })} />
            </FormField>
          </div>
          <div className="space-y-3">
            <FormField label="Bonds">
              <Input type="number" min={0} max={100} suffix="%" value={form.bondPct} onChange={e => set({ bondPct: parseFloat(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Return rate">
              <Input type="number" min={0} max={50} step={0.5} suffix="%" value={form.bondReturnRate} onChange={e => set({ bondReturnRate: parseFloat(e.target.value) || 0 })} />
            </FormField>
          </div>
          <div className="space-y-3">
            <FormField label="Alternatives">
              <Input type="number" min={0} max={100} suffix="%" value={form.altPct} onChange={e => set({ altPct: parseFloat(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Return rate">
              <Input type="number" min={0} max={50} step={0.5} suffix="%" value={form.altReturnRate} onChange={e => set({ altReturnRate: parseFloat(e.target.value) || 0 })} />
            </FormField>
          </div>
        </div>
      </div>

      {/* Income Yield Decomposition */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-slate-700">Income Yield</h4>
          <span className="text-xs text-slate-600">
            Appreciation rate: {appreciationDisplay.toFixed(2)}% (blended − yield)
          </span>
        </div>
        <p className="text-xs text-slate-600 mb-3">
          Annual yield as % of balance. Leave all at 0 for tax-deferred accounts (IRA, 401k). Yield splits taxable income from capital appreciation.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Ordinary yield" hint="Bond interest, non-qual dividends">
            <Input type="number" min={0} max={15} step={0.1} suffix="%" value={form.ordinaryYieldRate} onChange={e => set({ ordinaryYieldRate: parseFloat(e.target.value) || 0 })} />
          </FormField>
          <FormField label="Qualified yield" hint="Qualified dividends (LTCG rates)">
            <Input type="number" min={0} max={15} step={0.1} suffix="%" value={form.qualifiedYieldRate} onChange={e => set({ qualifiedYieldRate: parseFloat(e.target.value) || 0 })} />
          </FormField>
          <FormField label="Tax-exempt yield" hint="Muni bond interest (not taxed)">
            <Input type="number" min={0} max={15} step={0.1} suffix="%" value={form.taxExemptYieldRate} onChange={e => set({ taxExemptYieldRate: parseFloat(e.target.value) || 0 })} />
          </FormField>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}><X className="h-3.5 w-3.5" /> Cancel</Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={isPending || !form.accountName || !allocationOk}>
          <Check className="h-3.5 w-3.5" /> {isPending ? "Saving…" : "Save Account"}
        </Button>
      </div>
    </div>
  );
}

function fromRecord(r: {
  accountName: string; accountType: string; currentBalance: number;
  equityPct: number; bondPct: number; altPct: number;
  equityReturnRate: number; bondReturnRate: number; altReturnRate: number;
  annualContribution: number;
  ordinaryYieldRate: number; qualifiedYieldRate: number; taxExemptYieldRate: number;
}): FormState {
  return {
    accountName: r.accountName,
    accountType: r.accountType as AccountType,
    currentBalance: r.currentBalance,
    equityPct: Math.round(r.equityPct * 100 * 10) / 10,
    bondPct: Math.round(r.bondPct * 100 * 10) / 10,
    altPct: Math.round(r.altPct * 100 * 10) / 10,
    equityReturnRate: Math.round(r.equityReturnRate * 100 * 10) / 10,
    bondReturnRate: Math.round(r.bondReturnRate * 100 * 10) / 10,
    altReturnRate: Math.round(r.altReturnRate * 100 * 10) / 10,
    annualContribution: r.annualContribution,
    ordinaryYieldRate: Math.round(r.ordinaryYieldRate * 100 * 10) / 10,
    qualifiedYieldRate: Math.round(r.qualifiedYieldRate * 100 * 10) / 10,
    taxExemptYieldRate: Math.round(r.taxExemptYieldRate * 100 * 10) / 10,
  };
}

export function PortfoliosForm() {
  const { data = [], isLoading, refetch } = trpc.portfolios.list.useQuery();
  const add = trpc.portfolios.add.useMutation({ onSuccess: () => { refetch(); setAdding(false); } });
  const update = trpc.portfolios.update.useMutation({ onSuccess: () => { refetch(); setEditingId(null); } });
  const del = trpc.portfolios.delete.useMutation({ onSuccess: () => refetch() });

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (isLoading) return <div className="text-slate-600 text-sm p-8">Loading...</div>;

  const totalBalance = data.reduce((s, a) => s + a.currentBalance, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Investment Accounts"
          description="Taxable accounts, IRAs, 401(k)s, and other portfolios"
          action={
            !adding && (
              <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
                <PlusCircle className="h-3.5 w-3.5" /> Add Account
              </Button>
            )
          }
        />

        {adding && (
          <CardBody className="border-b border-slate-200">
            <AccountForm
              initial={EMPTY}
              onSave={f => add.mutate(toMutation(f))}
              onCancel={() => setAdding(false)}
              isPending={add.isPending}
            />
          </CardBody>
        )}

        {data.length === 0 && !adding ? (
          <CardBody><p className="text-sm text-slate-600">No investment accounts added yet.</p></CardBody>
        ) : (
          <div className="divide-y divide-slate-200">
            {data.map(acct => (
              <div key={acct.id}>
                {editingId === acct.id ? (
                  <div className="px-6 py-4">
                    <AccountForm
                      initial={fromRecord(acct)}
                      onSave={f => update.mutate({ id: acct.id, ...toMutation(f) })}
                      onCancel={() => setEditingId(null)}
                      isPending={update.isPending}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-6 py-3 hover:bg-slate-100">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-3">
                        <span className="text-sm font-medium text-slate-900">{acct.accountName}</span>
                        <span className="text-xs text-slate-600">{ACCOUNT_TYPE_LABELS[acct.accountType]}</span>
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {Math.round(acct.equityPct * 100)}% eq / {Math.round(acct.bondPct * 100)}% bd / {Math.round(acct.altPct * 100)}% alt
                        {acct.annualContribution > 0 && ` · +${formatCurrency(acct.annualContribution, true)}/yr`}
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-900">{formatCurrency(acct.currentBalance, true)}</div>
                        <div className="text-xs text-slate-600">balance</div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(acct.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="danger" size="sm" onClick={() => del.mutate({ id: acct.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
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
        <div className="text-right text-sm text-slate-600">
          Total portfolio value: <span className="text-slate-900 font-semibold">{formatCurrency(totalBalance, true)}</span>
        </div>
      )}
    </div>
  );
}
