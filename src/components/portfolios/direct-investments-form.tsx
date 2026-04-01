"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Pencil, Trash2, PlusCircle, X, Check, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type AssetClass = "equity" | "bond" | "alt" | "cash";

type FormState = {
  securityName: string;
  assetClass: AssetClass;
  industry: string;
  stage: string;
  ownershipPct: string;
  currentValue: string;
  costBasis: string;
  purchaseDate: string;
  expectedExitYear: string;
  notes: string;
  // Display as percent (e.g., 7 for 7%), stored as decimal (0.07)
  expectedReturnRate: number;
  ordinaryYieldRate: number;
  qualifiedYieldRate: number;
  taxExemptYieldRate: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY: FormState = {
  securityName: "",
  assetClass: "equity",
  industry: "",
  stage: "",
  ownershipPct: "",
  currentValue: "",
  costBasis: "",
  purchaseDate: "",
  expectedExitYear: "",
  notes: "",
  expectedReturnRate: 7,
  ordinaryYieldRate: 0,
  qualifiedYieldRate: 0,
  taxExemptYieldRate: 0,
};

const ASSET_CLASS_COLORS: Record<string, string> = {
  equity: "bg-blue-100 text-blue-800",
  bond: "bg-green-100 text-green-800",
  alt: "bg-purple-100 text-purple-800",
  cash: "bg-gray-100 text-gray-700",
};

const ASSET_CLASS_LABELS: Record<string, string> = {
  equity: "Equity",
  bond: "Bonds",
  alt: "Alternatives",
  cash: "Cash",
};

const STAGE_OPTIONS = [
  "Seed",
  "Series A",
  "Series B",
  "Series C",
  "Growth",
  "Late Stage",
  "Pre-IPO",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseOptionalFloat(val: string): number | undefined {
  const n = parseFloat(val);
  return isNaN(n) ? undefined : n;
}

function parseOptionalInt(val: string): number | undefined {
  const n = parseInt(val, 10);
  return isNaN(n) ? undefined : n;
}

function buildMutationPayload(form: FormState) {
  return {
    securityName: form.securityName,
    assetClass: form.assetClass,
    industry: form.industry || undefined,
    stage: form.stage || undefined,
    ownershipPct: parseOptionalFloat(form.ownershipPct),
    currentValue: parseFloat(form.currentValue) || 0,
    costBasis: parseOptionalFloat(form.costBasis),
    purchaseDate: form.purchaseDate || undefined,
    expectedExitYear: parseOptionalInt(form.expectedExitYear),
    notes: form.notes || undefined,
    expectedReturnRate: form.expectedReturnRate / 100,
    ordinaryYieldRate: form.ordinaryYieldRate / 100,
    qualifiedYieldRate: form.qualifiedYieldRate / 100,
    taxExemptYieldRate: form.taxExemptYieldRate / 100,
  };
}

// ─── Inline Form ──────────────────────────────────────────────────────────────

function DirectInvestmentForm({
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
  const [showAdvanced, setShowAdvanced] = useState(false);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const isValid = form.securityName.trim().length > 0 && parseFloat(form.currentValue) >= 0;

  return (
    <div className="space-y-5 py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Security Name — full width */}
        <FormField label="Company Name" required className="md:col-span-2">
          <Input
            value={form.securityName}
            onChange={(e) => set({ securityName: e.target.value })}
            placeholder="Acme Corp, HealthCo Inc…"
          />
        </FormField>

        {/* Asset Class */}
        <FormField label="Asset Class" required>
          <Select
            value={form.assetClass}
            onChange={(e) => set({ assetClass: e.target.value as AssetClass })}
          >
            <option value="equity">Equity</option>
            <option value="bond">Bond</option>
            <option value="alt">Alternatives</option>
            <option value="cash">Cash</option>
          </Select>
        </FormField>

        {/* Industry */}
        <FormField label="Industry" hint="e.g. SaaS, Healthcare, Fintech">
          <Input
            value={form.industry}
            onChange={(e) => set({ industry: e.target.value })}
            placeholder="SaaS, Healthcare, Fintech…"
          />
        </FormField>

        {/* Stage */}
        <FormField label="Stage">
          <Select value={form.stage} onChange={(e) => set({ stage: e.target.value })}>
            <option value="">— Unknown —</option>
            {STAGE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FormField>

        {/* Ownership % */}
        <FormField label="Ownership %" hint="Your equity stake as a percentage">
          <Input
            type="number"
            min={0}
            max={100}
            step={0.01}
            suffix="%"
            value={form.ownershipPct}
            onChange={(e) => set({ ownershipPct: e.target.value })}
            placeholder="e.g. 2.5"
          />
        </FormField>

        {/* Current Value */}
        <FormField label="Current Value" required>
          <Input
            type="number"
            min={0}
            prefix="$"
            value={form.currentValue}
            onChange={(e) => set({ currentValue: e.target.value })}
          />
        </FormField>

        {/* Cost Basis */}
        <FormField label="Cost Basis" hint="Total original cost paid">
          <Input
            type="number"
            min={0}
            prefix="$"
            value={form.costBasis}
            onChange={(e) => set({ costBasis: e.target.value })}
          />
        </FormField>

        {/* Purchase Date */}
        <FormField label="Purchase Date">
          <Input
            type="date"
            value={form.purchaseDate}
            onChange={(e) => set({ purchaseDate: e.target.value })}
          />
        </FormField>

        {/* Expected Exit Year */}
        <FormField label="Expected Exit Year" hint="Projected liquidity event year">
          <Input
            type="number"
            min={2000}
            max={2100}
            step={1}
            value={form.expectedExitYear}
            onChange={(e) => set({ expectedExitYear: e.target.value })}
            placeholder="e.g. 2028"
          />
        </FormField>

        {/* Notes — full width */}
        <FormField label="Notes" className="md:col-span-2">
          <Input
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Optional"
          />
        </FormField>
      </div>

      {/* Advanced / Simulation Settings toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
        >
          {showAdvanced ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
          Advanced / Simulation Settings
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <FormField label="Expected Return Rate" hint="Annual total return assumption">
              <Input
                type="number"
                min={0}
                max={50}
                step={0.1}
                suffix="%"
                value={form.expectedReturnRate}
                onChange={(e) =>
                  set({ expectedReturnRate: parseFloat(e.target.value) || 0 })
                }
              />
            </FormField>

            <FormField label="Ordinary Yield Rate">
              <Input
                type="number"
                min={0}
                max={15}
                step={0.1}
                suffix="%"
                value={form.ordinaryYieldRate}
                onChange={(e) =>
                  set({ ordinaryYieldRate: parseFloat(e.target.value) || 0 })
                }
              />
            </FormField>

            <FormField label="Qualified Yield Rate">
              <Input
                type="number"
                min={0}
                max={15}
                step={0.1}
                suffix="%"
                value={form.qualifiedYieldRate}
                onChange={(e) =>
                  set({ qualifiedYieldRate: parseFloat(e.target.value) || 0 })
                }
              />
            </FormField>

            <FormField label="Tax-Exempt Yield Rate">
              <Input
                type="number"
                min={0}
                max={15}
                step={0.1}
                suffix="%"
                value={form.taxExemptYieldRate}
                onChange={(e) =>
                  set({ taxExemptYieldRate: parseFloat(e.target.value) || 0 })
                }
              />
            </FormField>
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-3.5 w-3.5" /> Cancel
        </Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={!isValid} loading={isPending}>
          <Check className="h-3.5 w-3.5" /> {isPending ? "Saving…" : "Save Investment"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DirectInvestmentsForm() {
  const utils = trpc.useUtils();

  const { data = [], isLoading } = trpc.directInvestments.list.useQuery();

  const invalidate = () => utils.directInvestments.list.invalidate();

  const add = trpc.directInvestments.add.useMutation({ onSuccess: () => { invalidate(); setAdding(false); } });
  const update = trpc.directInvestments.update.useMutation({ onSuccess: () => { invalidate(); setEditingId(null); } });
  const del = trpc.directInvestments.delete.useMutation({ onSuccess: invalidate });

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Build initial form state from a stored record (decimal -> percent conversion)
  function recordToForm(rec: (typeof data)[number]): FormState {
    return {
      securityName: rec.securityName,
      assetClass: rec.assetClass as AssetClass,
      industry: rec.industry ?? "",
      stage: rec.stage ?? "",
      ownershipPct: rec.ownershipPct != null ? String(rec.ownershipPct) : "",
      currentValue: String(rec.currentValue),
      costBasis: rec.costBasis != null ? String(rec.costBasis) : "",
      purchaseDate: rec.purchaseDate ?? "",
      expectedExitYear: rec.expectedExitYear != null ? String(rec.expectedExitYear) : "",
      notes: rec.notes ?? "",
      expectedReturnRate: (rec.expectedReturnRate ?? 0.07) * 100,
      ordinaryYieldRate: (rec.ordinaryYieldRate ?? 0) * 100,
      qualifiedYieldRate: (rec.qualifiedYieldRate ?? 0) * 100,
      taxExemptYieldRate: (rec.taxExemptYieldRate ?? 0) * 100,
    };
  }

  // Summary by asset class
  const totalValue = data.reduce((s, inv) => s + inv.currentValue, 0);
  const byClass: Record<string, number> = {};
  for (const inv of data) {
    byClass[inv.assetClass] = (byClass[inv.assetClass] ?? 0) + inv.currentValue;
  }

  if (isLoading) {
    return <div className="text-slate-600 text-sm p-8 animate-pulse">Loading…</div>;
  }

  return (
    <Card>
      <CardHeader
        title="Direct Investments"
        description="Privately held company investments"
        action={
          !adding && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setAdding(true); setEditingId(null); }}
            >
              <PlusCircle className="h-3.5 w-3.5" /> Add Investment
            </Button>
          )
        }
      />

      {/* Inline add form */}
      {adding && (
        <CardBody className="border-b border-slate-200">
          <DirectInvestmentForm
            initial={EMPTY}
            onSave={(f) => add.mutate(buildMutationPayload(f))}
            onCancel={() => setAdding(false)}
            isPending={add.isPending}
          />
        </CardBody>
      )}

      {/* Summary strip */}
      {data.length > 0 && (
        <div className="px-6 py-3 border-b border-slate-200 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">
            {formatCurrency(totalValue, true)} total
          </span>
          {Object.entries(byClass)
            .sort((a, b) => b[1] - a[1])
            .map(([cls, val]) => (
              <span
                key={cls}
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${ASSET_CLASS_COLORS[cls] ?? "bg-gray-100 text-gray-700"}`}
              >
                {ASSET_CLASS_LABELS[cls] ?? cls}: {formatCurrency(val, true)}
              </span>
            ))}
        </div>
      )}

      {/* Empty state */}
      {data.length === 0 && !adding ? (
        <CardBody>
          <p className="text-sm text-slate-600">No direct investments added yet.</p>
        </CardBody>
      ) : (
        <div className="divide-y divide-slate-200">
          {data.map((inv) => (
            <div key={inv.id}>
              {editingId === inv.id ? (
                <div className="px-6 py-4">
                  <DirectInvestmentForm
                    initial={recordToForm(inv)}
                    onSave={(f) => update.mutate({ id: inv.id, ...buildMutationPayload(f) })}
                    onCancel={() => setEditingId(null)}
                    isPending={update.isPending}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between px-6 py-3 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-slate-900">
                        {inv.securityName}
                      </span>
                      {inv.stage && (
                        <span className="text-xs text-slate-600">{inv.stage}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${ASSET_CLASS_COLORS[inv.assetClass] ?? "bg-gray-100 text-gray-700"}`}
                      >
                        {ASSET_CLASS_LABELS[inv.assetClass] ?? inv.assetClass}
                      </span>
                      {inv.industry && (
                        <span className="text-xs text-slate-600">{inv.industry}</span>
                      )}
                      {inv.ownershipPct != null && (
                        <span className="text-xs text-slate-600">
                          {inv.ownershipPct}% ownership
                        </span>
                      )}
                      {inv.expectedExitYear != null && (
                        <span className="text-xs text-slate-600">
                          Exit: {inv.expectedExitYear}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ml-4 flex items-center gap-3">
                    <span className="text-sm font-semibold text-emerald-600">
                      {formatCurrency(inv.currentValue)}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(inv.id)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => del.mutate({ id: inv.id })}
                        disabled={del.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
