"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Pencil, Trash2, PlusCircle, X, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { CURRENT_YEAR, QUARTERS } from "@/lib/constants";

const CATEGORY_LABELS: Record<string, string> = {
  housing: "Housing",
  transportation: "Transportation",
  food: "Food & Dining",
  healthcare: "Healthcare",
  travel: "Travel",
  education: "Education",
  entertainment: "Entertainment",
  clothing: "Clothing",
  personal_care: "Personal Care",
  charitable: "Charitable Giving",
  other: "Other",
};

// ─── Recurring Expenditure ───────────────────────────────────────────────────

type RecurringForm = {
  description: string;
  annualAmount: number;
  growthRate: number;    // displayed as %
  category: string;
};

const EMPTY_RECURRING: RecurringForm = {
  description: "",
  annualAmount: 0,
  growthRate: 3,
  category: "other",
};

function RecurringRowForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial: RecurringForm;
  onSave: (f: RecurringForm) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<RecurringForm>(initial);
  const set = (p: Partial<RecurringForm>) => setForm(f => ({ ...f, ...p }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end py-2">
      <FormField label="Description" className="md:col-span-1">
        <Input value={form.description} onChange={e => set({ description: e.target.value })} placeholder="Mortgage, groceries…" />
      </FormField>
      <FormField label="Annual Amount">
        <Input type="number" min={0} prefix="$" value={form.annualAmount} onChange={e => set({ annualAmount: parseFloat(e.target.value) || 0 })} />
      </FormField>
      <FormField label="Growth Rate" hint="Annual inflation assumption">
        <Input type="number" min={0} max={20} step={0.5} suffix="%" value={form.growthRate} onChange={e => set({ growthRate: parseFloat(e.target.value) || 0 })} />
      </FormField>
      <FormField label="Category">
        <Select value={form.category} onChange={e => set({ category: e.target.value })}>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </FormField>
      <div className="flex gap-2 md:col-span-4 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}><X className="h-3.5 w-3.5" /> Cancel</Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={!form.description || !form.annualAmount} loading={isPending}>
          <Check className="h-3.5 w-3.5" /> {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ─── One-Time Expenditure ────────────────────────────────────────────────────

type OneTimeForm = {
  description: string;
  amount: number;
  projectedYear: number;
  projectedQuarter: "Q1" | "Q2" | "Q3" | "Q4";
  category: string;
};

const EMPTY_ONETIME: OneTimeForm = {
  description: "",
  amount: 0,
  projectedYear: CURRENT_YEAR + 2,
  projectedQuarter: "Q2",
  category: "other",
};

function OneTimeRowForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial: OneTimeForm;
  onSave: (f: OneTimeForm) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<OneTimeForm>(initial);
  const set = (p: Partial<OneTimeForm>) => setForm(f => ({ ...f, ...p }));

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end py-2">
      <FormField label="Description" className="md:col-span-1">
        <Input value={form.description} onChange={e => set({ description: e.target.value })} placeholder="New car, wedding…" />
      </FormField>
      <FormField label="Amount">
        <Input type="number" min={0} prefix="$" value={form.amount} onChange={e => set({ amount: parseFloat(e.target.value) || 0 })} />
      </FormField>
      <FormField label="Year">
        <Input type="number" min={CURRENT_YEAR} max={2070} value={form.projectedYear} onChange={e => set({ projectedYear: parseInt(e.target.value) || form.projectedYear })} />
      </FormField>
      <FormField label="Quarter">
        <Select value={form.projectedQuarter} onChange={e => set({ projectedQuarter: e.target.value as "Q1"|"Q2"|"Q3"|"Q4" })}>
          {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
        </Select>
      </FormField>
      <FormField label="Category">
        <Select value={form.category} onChange={e => set({ category: e.target.value })}>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </FormField>
      <div className="flex gap-2 col-span-2 md:col-span-5 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}><X className="h-3.5 w-3.5" /> Cancel</Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={!form.description || !form.amount} loading={isPending}>
          <Check className="h-3.5 w-3.5" /> {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ExpendituresForm() {
  const { data: recurring = [], isLoading: rLoading, refetch: rRefetch } = trpc.expenditures.listRecurring.useQuery();
  const { data: oneTime = [], isLoading: oLoading, refetch: oRefetch } = trpc.expenditures.listOneTime.useQuery();

  const addRecurring = trpc.expenditures.addRecurring.useMutation({ onSuccess: () => { rRefetch(); setAddingRecurring(false); } });
  const updateRecurring = trpc.expenditures.updateRecurring.useMutation({ onSuccess: () => { rRefetch(); setEditingRecurringId(null); } });
  const deleteRecurring = trpc.expenditures.deleteRecurring.useMutation({ onSuccess: () => rRefetch() });

  const addOneTime = trpc.expenditures.addOneTime.useMutation({ onSuccess: () => { oRefetch(); setAddingOneTime(false); } });
  const updateOneTimeMutation = trpc.expenditures.updateOneTime.useMutation({ onSuccess: () => { oRefetch(); setEditingOneTimeId(null); } });
  const deleteOneTime = trpc.expenditures.deleteOneTime.useMutation({ onSuccess: () => oRefetch() });

  const [addingRecurring, setAddingRecurring] = useState(false);
  const [editingRecurringId, setEditingRecurringId] = useState<string | null>(null);
  const [addingOneTime, setAddingOneTime] = useState(false);
  const [editingOneTimeId, setEditingOneTimeId] = useState<string | null>(null);

  const totalRecurring = recurring.reduce((s, e) => s + e.annualAmount, 0);
  const totalOneTime = oneTime.reduce((s, e) => s + e.amount, 0);

  if (rLoading || oLoading) return <div className="text-slate-600 text-sm p-8">Loading...</div>;

  return (
    <div className="space-y-6">

      {/* Plaid import — now lives on the Portfolios page */}
      <div className="rounded-xl border border-border bg-muted/20 px-5 py-3 text-sm text-muted-foreground">
        To import expenses from your bank, go to the <strong>Investment Portfolios</strong> page and use the One-Time Bank Import panel.
      </div>

      {/* Recurring expenditures */}
      <Card>
        <CardHeader
          title="Recurring Annual Expenses"
          description="Ongoing spending modeled through retirement with per-item growth rates"
          action={
            !addingRecurring && (
              <Button variant="secondary" size="sm" onClick={() => setAddingRecurring(true)}>
                <PlusCircle className="h-3.5 w-3.5" /> Add Expense
              </Button>
            )
          }
        />

        {addingRecurring && (
          <CardBody className="border-b border-slate-200">
            <RecurringRowForm
              initial={EMPTY_RECURRING}
              onSave={f => addRecurring.mutate({ ...f, growthRate: f.growthRate / 100 })}
              onCancel={() => setAddingRecurring(false)}
              isPending={addRecurring.isPending}
            />
          </CardBody>
        )}

        {recurring.length === 0 && !addingRecurring ? (
          <CardBody><EmptyState message="No recurring expenses added yet." /></CardBody>
        ) : (
          <>
            {recurring.length > 0 && (
              <div className="divide-y divide-slate-200">
                {recurring.map(exp => (
                  <div key={exp.id}>
                    {editingRecurringId === exp.id ? (
                      <div className="px-6 py-3">
                        <RecurringRowForm
                          initial={{
                            description: exp.description,
                            annualAmount: exp.annualAmount,
                            growthRate: Math.round(exp.growthRate * 100 * 10) / 10,
                            category: exp.category,
                          }}
                          onSave={f => updateRecurring.mutate({ id: exp.id, ...f, growthRate: f.growthRate / 100 })}
                          onCancel={() => setEditingRecurringId(null)}
                          isPending={updateRecurring.isPending}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between px-6 py-2.5 hover:bg-slate-100">
                        <div className="min-w-0 flex-1">
                          <span className="text-sm text-slate-700">{exp.description}</span>
                          <span className="text-xs text-slate-600 ml-3">{CATEGORY_LABELS[exp.category]} · {(exp.growthRate * 100).toFixed(1)}%/yr growth</span>
                          {exp.isPlaidSynced && <span className="text-xs text-indigo-600 ml-2">Plaid</span>}
                        </div>
                        <div className="ml-4 flex items-center gap-4">
                          <span className="text-sm font-semibold text-slate-700">{formatCurrency(exp.annualAmount)}</span>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setEditingRecurringId(exp.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="danger" size="sm" onClick={() => deleteRecurring.mutate({ id: exp.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {recurring.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-200 flex justify-end">
            <span className="text-sm text-slate-500">
              Total annual recurring: <span className="text-slate-700 font-semibold">{formatCurrency(totalRecurring)}</span>
            </span>
          </div>
        )}
      </Card>

      {/* One-time expenditures */}
      <Card>
        <CardHeader
          title="One-Time Future Expenses"
          description="Projected future spending events (home purchase, tuition, weddings, etc.)"
          action={
            !addingOneTime && (
              <Button variant="secondary" size="sm" onClick={() => setAddingOneTime(true)}>
                <PlusCircle className="h-3.5 w-3.5" /> Add Event
              </Button>
            )
          }
        />

        {addingOneTime && (
          <CardBody className="border-b border-slate-200">
            <OneTimeRowForm
              initial={EMPTY_ONETIME}
              onSave={f => addOneTime.mutate({ ...f, isChildEducation: false })}
              onCancel={() => setAddingOneTime(false)}
              isPending={addOneTime.isPending}
            />
          </CardBody>
        )}

        {oneTime.length === 0 && !addingOneTime ? (
          <CardBody><EmptyState message="No one-time expenses added yet." /></CardBody>
        ) : (
          <>
            {oneTime.length > 0 && (
              <div className="divide-y divide-slate-200">
                {oneTime.map(exp => (
                  <div key={exp.id}>
                    {editingOneTimeId === exp.id ? (
                      <div className="px-6 py-3">
                        <OneTimeRowForm
                          initial={{
                            description: exp.description,
                            amount: exp.amount,
                            projectedYear: exp.projectedYear,
                            projectedQuarter: exp.projectedQuarter as "Q1"|"Q2"|"Q3"|"Q4",
                            category: exp.category,
                          }}
                          onSave={f => updateOneTimeMutation.mutate({ id: exp.id, ...f })}
                          onCancel={() => setEditingOneTimeId(null)}
                          isPending={updateOneTimeMutation.isPending}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between px-6 py-2.5 hover:bg-slate-100">
                        <div className="min-w-0 flex-1">
                          <span className="text-sm text-slate-700">{exp.description}</span>
                          <span className="text-xs text-slate-600 ml-3">{CATEGORY_LABELS[exp.category]} · {exp.projectedYear} {exp.projectedQuarter}</span>
                        </div>
                        <div className="ml-4 flex items-center gap-4">
                          <span className="text-sm font-semibold text-slate-700">{formatCurrency(exp.amount)}</span>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setEditingOneTimeId(exp.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="danger" size="sm" onClick={() => deleteOneTime.mutate({ id: exp.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {oneTime.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-200 flex justify-end">
            <span className="text-sm text-slate-500">
              Total future events: <span className="text-slate-700 font-semibold">{formatCurrency(totalOneTime, true)}</span>
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}
