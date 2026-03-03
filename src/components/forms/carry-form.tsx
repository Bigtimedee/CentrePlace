"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Pencil, Trash2, PlusCircle, X, Check } from "lucide-react";
import { formatCurrency, formatPct } from "@/lib/utils";
import { CURRENT_YEAR, QUARTERS } from "@/lib/constants";

type CarryFormState = {
  fundName: string;
  vintageYear: number;
  carryPct: number;          // displayed as %
  totalCommittedCapital: number;
  currentTvpi: number;
  expectedGrossCarry: number;
  haircutPct: number;        // displayed as %
  expectedRealizationYear: number;
  expectedRealizationQuarter: "Q1" | "Q2" | "Q3" | "Q4";
  notes: string;
};

const EMPTY: CarryFormState = {
  fundName: "",
  vintageYear: CURRENT_YEAR - 3,
  carryPct: 20,
  totalCommittedCapital: 0,
  currentTvpi: 1.0,
  expectedGrossCarry: 0,
  haircutPct: 20,
  expectedRealizationYear: CURRENT_YEAR + 5,
  expectedRealizationQuarter: "Q3",
  notes: "",
};

function toMutation(f: CarryFormState) {
  return {
    ...f,
    carryPct: f.carryPct / 100,
    haircutPct: f.haircutPct / 100,
    notes: f.notes || undefined,
  };
}

function fromRecord(r: { fundName: string; vintageYear: number; carryPct: number; totalCommittedCapital: number; currentTvpi: number; expectedGrossCarry: number; haircutPct: number; expectedRealizationYear: number; expectedRealizationQuarter: string; notes: string | null }): CarryFormState {
  return {
    fundName: r.fundName,
    vintageYear: r.vintageYear,
    carryPct: Math.round(r.carryPct * 100 * 10) / 10,
    totalCommittedCapital: r.totalCommittedCapital,
    currentTvpi: r.currentTvpi,
    expectedGrossCarry: r.expectedGrossCarry,
    haircutPct: Math.round(r.haircutPct * 100 * 10) / 10,
    expectedRealizationYear: r.expectedRealizationYear,
    expectedRealizationQuarter: r.expectedRealizationQuarter as "Q1" | "Q2" | "Q3" | "Q4",
    notes: r.notes ?? "",
  };
}

function CarryPositionForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial: CarryFormState;
  onSave: (f: CarryFormState) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<CarryFormState>(initial);
  const set = (patch: Partial<CarryFormState>) => setForm(f => ({ ...f, ...patch }));

  return (
    <div className="space-y-5 py-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField label="Fund Name" required className="md:col-span-2">
          <Input value={form.fundName} onChange={e => set({ fundName: e.target.value })} placeholder="Acme Capital Fund III" />
        </FormField>
        <FormField label="Vintage Year" required>
          <Input type="number" min={2000} max={2030} value={form.vintageYear} onChange={e => set({ vintageYear: parseInt(e.target.value) || form.vintageYear })} />
        </FormField>

        <FormField label="Carry %" hint="GP carried interest percentage">
          <Input type="number" min={0} max={50} step={0.5} suffix="%" value={form.carryPct} onChange={e => set({ carryPct: parseFloat(e.target.value) || 0 })} />
        </FormField>
        <FormField label="Committed Capital">
          <Input type="number" min={0} prefix="$" value={form.totalCommittedCapital} onChange={e => set({ totalCommittedCapital: parseFloat(e.target.value) || 0 })} />
        </FormField>
        <FormField label="Current TVPI" hint="Total Value / Paid-In">
          <Input type="number" min={0} max={20} step={0.05} suffix="×" value={form.currentTvpi} onChange={e => set({ currentTvpi: parseFloat(e.target.value) || 0 })} />
        </FormField>

        <FormField label="Expected Gross Carry" hint="Your estimate of total carry before haircut">
          <Input type="number" min={0} prefix="$" value={form.expectedGrossCarry} onChange={e => set({ expectedGrossCarry: parseFloat(e.target.value) || 0 })} />
        </FormField>
        <FormField label="Haircut %" hint="Reduction for clawbacks, netting, tax reserves">
          <Input type="number" min={0} max={90} step={5} suffix="%" value={form.haircutPct} onChange={e => set({ haircutPct: parseFloat(e.target.value) || 0 })} />
        </FormField>
        <FormField label="Net Carry (auto)">
          <div className="flex items-center h-9 px-3 bg-slate-800/50 border border-slate-700/50 rounded-md text-sm text-emerald-400 font-medium">
            {formatCurrency(form.expectedGrossCarry * (1 - form.haircutPct / 100))}
          </div>
        </FormField>

        <FormField label="Expected Realization Year">
          <Input type="number" min={CURRENT_YEAR} max={2070} value={form.expectedRealizationYear} onChange={e => set({ expectedRealizationYear: parseInt(e.target.value) || form.expectedRealizationYear })} />
        </FormField>
        <FormField label="Expected Quarter">
          <Select value={form.expectedRealizationQuarter} onChange={e => set({ expectedRealizationQuarter: e.target.value as "Q1"|"Q2"|"Q3"|"Q4" })}>
            {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
          </Select>
        </FormField>
        <FormField label="Notes" className="md:col-span-1">
          <Input value={form.notes} onChange={e => set({ notes: e.target.value })} placeholder="Optional" />
        </FormField>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}><X className="h-3.5 w-3.5" /> Cancel</Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={isPending || !form.fundName}>
          <Check className="h-3.5 w-3.5" /> {isPending ? "Saving…" : "Save Position"}
        </Button>
      </div>
    </div>
  );
}

export function CarryForm() {
  const { data = [], isLoading, refetch } = trpc.carry.list.useQuery();
  const add = trpc.carry.add.useMutation({ onSuccess: () => { refetch(); setAdding(false); } });
  const update = trpc.carry.update.useMutation({ onSuccess: () => { refetch(); setEditingId(null); } });
  const del = trpc.carry.delete.useMutation({ onSuccess: () => refetch() });

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (isLoading) return <div className="text-slate-500 text-sm p-8">Loading...</div>;

  const totalNetCarry = data.reduce(
    (sum, p) => sum + p.expectedGrossCarry * (1 - p.haircutPct), 0
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="GP Carry Positions"
          description="All fund carry expected to be realized"
          action={
            !adding && (
              <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
                <PlusCircle className="h-3.5 w-3.5" /> Add Position
              </Button>
            )
          }
        />

        {adding && (
          <CardBody className="border-b border-slate-800">
            <CarryPositionForm
              initial={EMPTY}
              onSave={f => add.mutate(toMutation(f))}
              onCancel={() => setAdding(false)}
              isPending={add.isPending}
            />
          </CardBody>
        )}

        {data.length === 0 && !adding ? (
          <CardBody><p className="text-sm text-slate-500">No carry positions added yet.</p></CardBody>
        ) : (
          <div className="divide-y divide-slate-800">
            {data.map(pos => (
              <div key={pos.id}>
                {editingId === pos.id ? (
                  <div className="px-6 py-4">
                    <CarryPositionForm
                      initial={fromRecord(pos)}
                      onSave={f => update.mutate({ id: pos.id, ...toMutation(f) })}
                      onCancel={() => setEditingId(null)}
                      isPending={update.isPending}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-6 py-3 hover:bg-slate-800/30">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-3">
                        <span className="text-sm font-medium text-slate-200">{pos.fundName}</span>
                        <span className="text-xs text-slate-500">{pos.vintageYear} vintage · {formatPct(pos.carryPct)} carry</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {formatCurrency(pos.totalCommittedCapital, true)} committed · TVPI {pos.currentTvpi.toFixed(2)}× · Realization {pos.expectedRealizationYear} {pos.expectedRealizationQuarter}
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-emerald-400">{formatCurrency(pos.expectedGrossCarry * (1 - pos.haircutPct), true)}</div>
                        <div className="text-xs text-slate-500">net carry</div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(pos.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="danger" size="sm" onClick={() => del.mutate({ id: pos.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
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
        <div className="text-right text-sm text-slate-400">
          Total net carry: <span className="text-emerald-400 font-semibold">{formatCurrency(totalNetCarry, true)}</span>
        </div>
      )}
    </div>
  );
}
