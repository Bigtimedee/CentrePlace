"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Pencil, Trash2, PlusCircle, X, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { CURRENT_YEAR, QUARTERS } from "@/lib/constants";
import type { LPDistribution } from "@/server/db/schema/lp-investments";

type FormState = {
  fundName: string;
  vintageYear: number;
  commitmentAmount: number;
  currentNav: number;
  expectedDistributions: LPDistribution[];
  notes: string;
};

type DistRow = {
  year: number;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  amount: number;
  taxCharacter: "ltcg" | "ordinary" | "return_of_capital";
};

const EMPTY: FormState = {
  fundName: "",
  vintageYear: CURRENT_YEAR - 3,
  commitmentAmount: 0,
  currentNav: 0,
  expectedDistributions: [],
  notes: "",
};

function LPFundForm({
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
  const [newDist, setNewDist] = useState<DistRow>({
    year: CURRENT_YEAR + 3,
    quarter: "Q2",
    amount: 0,
    taxCharacter: "ltcg",
  });
  const set = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  function addDist() {
    if (!newDist.amount) return;
    set({ expectedDistributions: [...form.expectedDistributions, newDist] });
    setNewDist(d => ({ ...d, amount: 0 }));
  }

  function removeDist(i: number) {
    set({ expectedDistributions: form.expectedDistributions.filter((_, idx) => idx !== i) });
  }

  const totalDists = form.expectedDistributions.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="space-y-5 py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Fund Name" required className="md:col-span-2">
          <Input value={form.fundName} onChange={e => set({ fundName: e.target.value })} placeholder="ABC Venture Fund II" />
        </FormField>
        <FormField label="Vintage Year" required>
          <Input type="number" min={2000} max={2030} value={form.vintageYear} onChange={e => set({ vintageYear: parseInt(e.target.value) || form.vintageYear })} />
        </FormField>
        <FormField label="Commitment Amount">
          <Input type="number" min={0} prefix="$" value={form.commitmentAmount} onChange={e => set({ commitmentAmount: parseFloat(e.target.value) || 0 })} />
        </FormField>
        <FormField label="Current NAV">
          <Input type="number" min={0} prefix="$" value={form.currentNav} onChange={e => set({ currentNav: parseFloat(e.target.value) || 0 })} />
        </FormField>
        <FormField label="Notes">
          <Input value={form.notes} onChange={e => set({ notes: e.target.value })} placeholder="Optional" />
        </FormField>
      </div>

      {/* Distribution schedule */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-sm font-medium text-slate-300">Expected Distributions</h4>
            {totalDists > 0 && (
              <p className="text-xs text-slate-600 mt-0.5">Total: {formatCurrency(totalDists, true)}</p>
            )}
          </div>
        </div>

        {form.expectedDistributions.length > 0 && (
          <div className="mb-3 rounded-md border border-slate-700 divide-y divide-slate-700 text-xs">
            <div className="grid grid-cols-5 px-3 py-2 text-slate-600 font-medium">
              <span>Year</span><span>Qtr</span><span>Amount</span><span>Tax type</span><span></span>
            </div>
            {form.expectedDistributions.map((d, i) => (
              <div key={i} className="grid grid-cols-5 px-3 py-2 text-slate-300 items-center">
                <span>{d.year}</span>
                <span>{d.quarter}</span>
                <span>{formatCurrency(d.amount, true)}</span>
                <span className="capitalize">{d.taxCharacter.replace(/_/g, " ")}</span>
                <button type="button" onClick={() => removeDist(i)} className="text-red-400 hover:text-red-300 justify-self-end">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add distribution row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
          <FormField label="Year">
            <Input type="number" min={CURRENT_YEAR} max={2070} value={newDist.year} onChange={e => setNewDist(d => ({ ...d, year: parseInt(e.target.value) || d.year }))} />
          </FormField>
          <FormField label="Quarter">
            <Select value={newDist.quarter} onChange={e => setNewDist(d => ({ ...d, quarter: e.target.value as "Q1"|"Q2"|"Q3"|"Q4" }))}>
              {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
            </Select>
          </FormField>
          <FormField label="Amount">
            <Input type="number" min={0} prefix="$" value={newDist.amount || ""} onChange={e => setNewDist(d => ({ ...d, amount: parseFloat(e.target.value) || 0 }))} />
          </FormField>
          <FormField label="Tax Character">
            <Select value={newDist.taxCharacter} onChange={e => setNewDist(d => ({ ...d, taxCharacter: e.target.value as DistRow["taxCharacter"] }))}>
              <option value="ltcg">Long-term gain</option>
              <option value="ordinary">Ordinary income</option>
              <option value="return_of_capital">Return of capital</option>
            </Select>
          </FormField>
          <div className="flex items-end">
            <Button variant="secondary" size="sm" onClick={addDist} disabled={!newDist.amount} className="w-full">
              <PlusCircle className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}><X className="h-3.5 w-3.5" /> Cancel</Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={isPending || !form.fundName}>
          <Check className="h-3.5 w-3.5" /> {isPending ? "Saving…" : "Save Fund"}
        </Button>
      </div>
    </div>
  );
}

export function LPInvestmentsForm() {
  const { data = [], isLoading, refetch } = trpc.lpInvestments.list.useQuery();
  const add = trpc.lpInvestments.add.useMutation({ onSuccess: () => { refetch(); setAdding(false); } });
  const update = trpc.lpInvestments.update.useMutation({ onSuccess: () => { refetch(); setEditingId(null); } });
  const del = trpc.lpInvestments.delete.useMutation({ onSuccess: () => refetch() });

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (isLoading) return <div className="text-slate-600 text-sm p-8">Loading...</div>;

  return (
    <Card>
      <CardHeader
        title="LP Fund Investments"
        description="LP commitments with expected distribution schedules"
        action={
          !adding && (
            <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
              <PlusCircle className="h-3.5 w-3.5" /> Add Fund
            </Button>
          )
        }
      />

      {adding && (
        <CardBody className="border-b border-slate-800">
          <LPFundForm
            initial={EMPTY}
            onSave={f => add.mutate({ ...f, notes: f.notes || undefined })}
            onCancel={() => setAdding(false)}
            isPending={add.isPending}
          />
        </CardBody>
      )}

      {data.length === 0 && !adding ? (
        <CardBody><p className="text-sm text-slate-600">No LP investments added yet.</p></CardBody>
      ) : (
        <div className="divide-y divide-slate-800">
          {data.map(fund => (
            <div key={fund.id}>
              {editingId === fund.id ? (
                <div className="px-6 py-4">
                  <LPFundForm
                    initial={{ ...fund, notes: fund.notes ?? "", expectedDistributions: (fund.expectedDistributions ?? []) as LPDistribution[] }}
                    onSave={f => update.mutate({ id: fund.id, ...f, notes: f.notes || undefined })}
                    onCancel={() => setEditingId(null)}
                    isPending={update.isPending}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between px-6 py-3 hover:bg-slate-800/30">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3">
                      <span className="text-sm font-medium text-slate-200">{fund.fundName}</span>
                      <span className="text-xs text-slate-600">{fund.vintageYear} vintage</span>
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      {formatCurrency(fund.commitmentAmount, true)} committed · NAV {formatCurrency(fund.currentNav, true)} · {((fund.expectedDistributions ?? []) as LPDistribution[]).length} distribution events
                    </div>
                  </div>
                  <div className="ml-4 flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-semibold text-emerald-400">
                        {formatCurrency(((fund.expectedDistributions ?? []) as LPDistribution[]).reduce((s, d) => s + d.amount, 0), true)}
                      </div>
                      <div className="text-xs text-slate-600">total distributions</div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(fund.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="danger" size="sm" onClick={() => del.mutate({ id: fund.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
