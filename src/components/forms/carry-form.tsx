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
  currentAccountBalance: number | null;
  notes: string;
};

type Tranche = {
  localId: string;   // client-only key for React rendering
  id?: string;       // DB id if already persisted
  year: number;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  pct: number;       // displayed as % (1–100)
};

const EMPTY: CarryFormState = {
  fundName: "",
  vintageYear: CURRENT_YEAR - 3,
  carryPct: 20,
  totalCommittedCapital: 0,
  currentTvpi: 1.0,
  expectedGrossCarry: 0,
  haircutPct: 20,
  currentAccountBalance: null,
  notes: "",
};

let localIdCounter = 0;
function nextLocalId() { return `local-${++localIdCounter}`; }

function toMutation(f: CarryFormState) {
  return {
    ...f,
    carryPct: f.carryPct / 100,
    haircutPct: f.haircutPct / 100,
    currentAccountBalance: f.currentAccountBalance,
    notes: f.notes || undefined,
  };
}

function fromRecord(r: {
  fundName: string;
  vintageYear: number;
  carryPct: number;
  totalCommittedCapital: number;
  currentTvpi: number;
  expectedGrossCarry: number;
  haircutPct: number;
  currentAccountBalance?: number | null;
  notes: string | null;
}): CarryFormState {
  return {
    fundName: r.fundName,
    vintageYear: r.vintageYear,
    carryPct: Math.round(r.carryPct * 100 * 10) / 10,
    totalCommittedCapital: r.totalCommittedCapital,
    currentTvpi: r.currentTvpi,
    expectedGrossCarry: r.expectedGrossCarry,
    haircutPct: Math.round(r.haircutPct * 100 * 10) / 10,
    currentAccountBalance: r.currentAccountBalance ?? null,
    notes: r.notes ?? "",
  };
}

function tranchesFromRecord(realizations: { id: string; year: number; quarter: string; pct: number }[]): Tranche[] {
  return realizations.map(r => ({
    localId: nextLocalId(),
    id: r.id,
    year: r.year,
    quarter: r.quarter as "Q1" | "Q2" | "Q3" | "Q4",
    pct: Math.round(r.pct * 100 * 10) / 10,
  }));
}

// ── Realization Schedule Editor ───────────────────────────────────────────────

function RealizationSchedule({
  tranches,
  onChange,
  onDelete,
}: {
  tranches: Tranche[];
  onChange: (localId: string, patch: Partial<Omit<Tranche, "localId" | "id">>) => void;
  onDelete: (localId: string) => void;
}) {
  const total = tranches.reduce((s, t) => s + t.pct, 0);
  const totalOk = Math.abs(total - 100) < 0.01;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-500 pb-0.5">
        <span>Year</span>
        <span>Quarter</span>
        <span>% of Carry</span>
        <span />
      </div>
      {tranches.length === 0 && (
        <p className="text-xs text-slate-600 italic">No tranches — carry will not be modeled in simulation.</p>
      )}
      {tranches.map(t => (
        <div key={t.localId} className="flex items-center gap-2">
          <Input
            type="number"
            min={2024}
            max={2070}
            value={t.year}
            onChange={e => onChange(t.localId, { year: parseInt(e.target.value) || t.year })}
            className="w-24"
          />
          <Select
            value={t.quarter}
            onChange={e => onChange(t.localId, { quarter: e.target.value as "Q1" | "Q2" | "Q3" | "Q4" })}
            className="w-24"
          >
            {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
          </Select>
          <Input
            type="number"
            min={1}
            max={100}
            step={5}
            suffix="%"
            value={t.pct}
            onChange={e => onChange(t.localId, { pct: parseFloat(e.target.value) || 0 })}
            className="w-28"
          />
          <button
            type="button"
            onClick={() => onDelete(t.localId)}
            className="text-slate-600 hover:text-red-400 transition-colors"
            aria-label="Remove tranche"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <div className={`text-xs font-medium mt-1 ${totalOk ? "text-emerald-600" : "text-amber-600"}`}>
        Total: {Math.round(total * 10) / 10}%
        {totalOk ? " ✓" : " — should sum to 100%"}
      </div>
    </div>
  );
}

// ── Carry Position Form ───────────────────────────────────────────────────────

function CarryPositionForm({
  initial,
  initialTranches,
  onSave,
  onCancel,
  isPending,
}: {
  initial: CarryFormState;
  initialTranches: Tranche[];
  positionId: string | null; // null = new position
  onSave: (f: CarryFormState, tranches: Tranche[]) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<CarryFormState>(initial);
  const [tranches, setTranches] = useState<Tranche[]>(initialTranches);

  const set = (patch: Partial<CarryFormState>) => setForm(f => ({ ...f, ...patch }));

  function addTranche() {
    const usedPct = tranches.reduce((s, t) => s + t.pct, 0);
    const remaining = Math.max(0, Math.round((100 - usedPct) * 10) / 10);
    setTranches(ts => [...ts, {
      localId: nextLocalId(),
      year: CURRENT_YEAR + 5,
      quarter: "Q4",
      pct: remaining > 0 ? remaining : 100,
    }]);
  }

  function updateTranche(localId: string, patch: Partial<Omit<Tranche, "localId" | "id">>) {
    setTranches(ts => ts.map(t => t.localId === localId ? { ...t, ...patch } : t));
  }

  function removeTranche(localId: string) {
    setTranches(ts => ts.filter(t => t.localId !== localId));
  }

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
          <div className="flex items-center h-9 px-3 bg-slate-50 border border-slate-200 rounded-md text-sm text-emerald-600 font-medium">
            {formatCurrency(form.expectedGrossCarry * (1 - form.haircutPct / 100))}
          </div>
        </FormField>

        <FormField label="Current Account Balance" hint="Current fund account balance (optional)">
          <Input
            type="number"
            min={0}
            prefix="$"
            placeholder="0"
            value={form.currentAccountBalance ?? ""}
            onChange={e => {
              const raw = e.target.value;
              const parsed = parseFloat(raw);
              set({ currentAccountBalance: raw === "" || isNaN(parsed) ? null : parsed });
            }}
          />
        </FormField>

        <FormField label="Notes" className="md:col-span-3">
          <Input value={form.notes} onChange={e => set({ notes: e.target.value })} placeholder="Optional" />
        </FormField>
      </div>

      {/* Realization Schedule */}
      <div className="border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Realization Schedule</span>
          <Button variant="ghost" size="sm" onClick={addTranche}>
            <PlusCircle className="h-3.5 w-3.5" /> Add Tranche
          </Button>
        </div>
        <RealizationSchedule
          tranches={tranches}
          onChange={updateTranche}
          onDelete={removeTranche}
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}><X className="h-3.5 w-3.5" /> Cancel</Button>
        <Button size="sm" onClick={() => onSave(form, tranches)} disabled={!form.fundName} loading={isPending}>
          <Check className="h-3.5 w-3.5" /> {isPending ? "Saving…" : "Save Position"}
        </Button>
      </div>
    </div>
  );
}

// ── Main CarryForm Component ──────────────────────────────────────────────────

export function CarryForm() {
  const utils = trpc.useUtils();
  const { data = [], isLoading } = trpc.carry.list.useQuery();

  const addPosition = trpc.carry.add.useMutation({
    onSuccess: () => { utils.carry.list.invalidate(); setAdding(false); },
  });
  const updatePosition = trpc.carry.update.useMutation({
    onSuccess: () => { utils.carry.list.invalidate(); setEditingId(null); },
  });
  const delPosition = trpc.carry.delete.useMutation({
    onSuccess: () => utils.carry.list.invalidate(),
  });

  const addRealization = trpc.carry.addRealization.useMutation();
  const updateRealization = trpc.carry.updateRealization.useMutation();
  const deleteRealization = trpc.carry.deleteRealization.useMutation();

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (isLoading) return <div className="text-slate-600 text-sm p-8">Loading...</div>;

  const totalNetCarry = data.reduce(
    (sum, p) => sum + p.expectedGrossCarry * (1 - p.haircutPct), 0
  );

  async function handleAddSave(f: CarryFormState, tranches: Tranche[]) {
    setSaving(true);
    try {
      const [pos] = await addPosition.mutateAsync(toMutation(f));
      await Promise.all(tranches.map(t =>
        addRealization.mutateAsync({
          carryPositionId: pos.id,
          year: t.year,
          quarter: t.quarter,
          pct: t.pct / 100,
        })
      ));
      utils.carry.list.invalidate();
      setAdding(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave(positionId: string, f: CarryFormState, tranches: Tranche[], originalTranches: Tranche[]) {
    setSaving(true);
    try {
      await updatePosition.mutateAsync({ id: positionId, ...toMutation(f) });

      // Delete removed tranches (had id but no longer in list)
      const keptIds = new Set(tranches.filter(t => t.id).map(t => t.id!));
      const toRemove = originalTranches.filter(t => t.id && !keptIds.has(t.id));
      await Promise.all(toRemove.map(t => deleteRealization.mutateAsync({ id: t.id! })));

      // Add new tranches (no id)
      const toAdd = tranches.filter(t => !t.id);
      await Promise.all(toAdd.map(t =>
        addRealization.mutateAsync({
          carryPositionId: positionId,
          year: t.year,
          quarter: t.quarter,
          pct: t.pct / 100,
        })
      ));

      // Update existing tranches that were modified
      const existingInOriginal = new Map(originalTranches.filter(t => t.id).map(t => [t.id!, t]));
      const toUpdate = tranches.filter(t => {
        if (!t.id) return false;
        const orig = existingInOriginal.get(t.id);
        return orig && (orig.year !== t.year || orig.quarter !== t.quarter || orig.pct !== t.pct);
      });
      await Promise.all(toUpdate.map(t =>
        updateRealization.mutateAsync({
          id: t.id!,
          year: t.year,
          quarter: t.quarter,
          pct: t.pct / 100,
        })
      ));

      utils.carry.list.invalidate();
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

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
          <CardBody className="border-b border-slate-200">
            <CarryPositionForm
              initial={EMPTY}
              initialTranches={[]}
              positionId={null}
              onSave={(f, tranches) => handleAddSave(f, tranches)}
              onCancel={() => setAdding(false)}
              isPending={saving}
            />
          </CardBody>
        )}

        {data.length === 0 && !adding ? (
          <CardBody><p className="text-sm text-slate-600">No carry positions added yet.</p></CardBody>
        ) : (
          <div className="divide-y divide-slate-200">
            {data.map(pos => {
              const realizationSummary = pos.realizations.length === 0
                ? "No schedule"
                : pos.realizations
                    .sort((a, b) => a.year - b.year || a.quarter.localeCompare(b.quarter))
                    .map(r => `${Math.round(r.pct * 100)}% in ${r.year} ${r.quarter}`)
                    .join(", ");

              return (
                <div key={pos.id}>
                  {editingId === pos.id ? (
                    <div className="px-6 py-4">
                      <CarryPositionForm
                        initial={fromRecord(pos)}
                        initialTranches={tranchesFromRecord(pos.realizations)}
                        positionId={pos.id}
                        onSave={(f, tranches) =>
                          handleEditSave(pos.id, f, tranches, tranchesFromRecord(pos.realizations))
                        }
                        onCancel={() => setEditingId(null)}
                        isPending={saving}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-6 py-3 hover:bg-slate-100">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-3">
                          <span className="text-sm font-medium text-slate-700">{pos.fundName}</span>
                          <span className="text-xs text-slate-600">{pos.vintageYear} vintage · {formatPct(pos.carryPct)} carry</span>
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          {formatCurrency(pos.totalCommittedCapital, true)} committed · TVPI {pos.currentTvpi.toFixed(2)}× · {realizationSummary}
                          {pos.currentAccountBalance != null && (
                            <> · Balance: {formatCurrency(pos.currentAccountBalance, true)}</>
                          )}
                        </div>
                      </div>
                      <div className="ml-4 flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-semibold text-emerald-600">{formatCurrency(pos.expectedGrossCarry * (1 - pos.haircutPct), true)}</div>
                          <div className="text-xs text-slate-600">net carry</div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditingId(pos.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="danger" size="sm" onClick={() => delPosition.mutate({ id: pos.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {data.length > 0 && (
        <div className="text-right text-sm text-slate-500">
          Total net carry: <span className="text-emerald-600 font-semibold">{formatCurrency(totalNetCarry, true)}</span>
        </div>
      )}
    </div>
  );
}
