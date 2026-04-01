"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Pencil, Trash2, PlusCircle, X, Check, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type FormState = {
  coinName: string;
  symbol: string;
  quantityCoins: string;
  pricePerCoin: string;
  currentValue: string;
  costBasis: string;
  expectedAppreciationRate: string;
  expectedSaleYear: string;
  saleFraction: string;
  notes: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY: FormState = {
  coinName: "",
  symbol: "",
  quantityCoins: "",
  pricePerCoin: "",
  currentValue: "",
  costBasis: "",
  expectedAppreciationRate: "15",
  expectedSaleYear: "",
  saleFraction: "100",
  notes: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fromRecord(rec: {
  coinName: string;
  symbol?: string | null;
  quantityCoins: number;
  pricePerCoin?: number | null;
  currentValue: number;
  costBasis?: number | null;
  expectedAppreciationRate: number;
  expectedSaleYear?: number | null;
  saleFraction?: number | null;
  notes?: string | null;
}): FormState {
  return {
    coinName: rec.coinName,
    symbol: rec.symbol ?? "",
    quantityCoins: String(rec.quantityCoins),
    pricePerCoin: rec.pricePerCoin != null ? String(rec.pricePerCoin) : "",
    currentValue: String(rec.currentValue),
    costBasis: rec.costBasis != null ? String(rec.costBasis) : "",
    expectedAppreciationRate: String(rec.expectedAppreciationRate * 100),
    expectedSaleYear: rec.expectedSaleYear != null ? String(rec.expectedSaleYear) : "",
    saleFraction: rec.saleFraction != null ? String(rec.saleFraction * 100) : "100",
    notes: rec.notes ?? "",
  };
}

function toMutation(form: FormState) {
  const qty = parseFloat(form.quantityCoins);
  const ppc = parseFloat(form.pricePerCoin);
  const cvRaw = parseFloat(form.currentValue);

  // Derive currentValue from qty * price when currentValue left blank
  let currentValue: number;
  if (!isNaN(qty) && !isNaN(ppc) && form.currentValue.trim() === "") {
    currentValue = qty * ppc;
  } else {
    currentValue = isNaN(cvRaw) ? 0 : cvRaw;
  }

  const expectedSaleYear = parseInt(form.expectedSaleYear, 10);
  const hasExpectedSaleYear = !isNaN(expectedSaleYear);

  return {
    coinName: form.coinName.trim(),
    symbol: form.symbol.trim() || null,
    quantityCoins: isNaN(qty) ? 0 : qty,
    pricePerCoin: isNaN(ppc) ? null : ppc,
    currentValue,
    costBasis: (() => { const n = parseFloat(form.costBasis); return isNaN(n) ? null : n; })(),
    expectedAppreciationRate: parseFloat(form.expectedAppreciationRate) / 100,
    expectedSaleYear: hasExpectedSaleYear ? expectedSaleYear : null,
    saleFraction: hasExpectedSaleYear
      ? parseFloat(form.saleFraction) / 100
      : null,
    notes: form.notes.trim() || null,
  };
}

// ─── Inline Form ──────────────────────────────────────────────────────────────

function CryptoHoldingForm({
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

  // When pricePerCoin blurs and currentValue is empty, auto-populate
  const handlePriceBlur = () => {
    if (form.currentValue.trim() === "") {
      const qty = parseFloat(form.quantityCoins);
      const ppc = parseFloat(form.pricePerCoin);
      if (!isNaN(qty) && !isNaN(ppc)) {
        set({ currentValue: String(qty * ppc) });
      }
    }
  };

  const isValid =
    form.coinName.trim().length > 0 &&
    !isNaN(parseFloat(form.currentValue)) &&
    parseFloat(form.currentValue) >= 0;

  return (
    <div className="space-y-5 py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Coin Name — full width */}
        <FormField label="Coin Name" required className="md:col-span-2">
          <Input
            value={form.coinName}
            onChange={(e) => set({ coinName: e.target.value })}
            placeholder="Bitcoin, Ethereum, Solana…"
          />
        </FormField>

        {/* Symbol */}
        <FormField label="Symbol (optional)">
          <Input
            value={form.symbol}
            onChange={(e) => set({ symbol: e.target.value })}
            placeholder="BTC, ETH, SOL…"
          />
        </FormField>

        {/* Quantity */}
        <FormField label="Quantity Owned">
          <Input
            type="number"
            min={0}
            step={0.0001}
            value={form.quantityCoins}
            onChange={(e) => set({ quantityCoins: e.target.value })}
            placeholder="e.g. 0.5"
          />
        </FormField>

        {/* Price per Coin */}
        <FormField label="Price per Coin (optional)">
          <Input
            type="number"
            min={0}
            prefix="$"
            value={form.pricePerCoin}
            onChange={(e) => set({ pricePerCoin: e.target.value })}
            onBlur={handlePriceBlur}
            placeholder="e.g. 65000"
          />
        </FormField>

        {/* Current Value */}
        <FormField label="Current Value (USD)" required>
          <Input
            type="number"
            min={0}
            prefix="$"
            value={form.currentValue}
            onChange={(e) => set({ currentValue: e.target.value })}
          />
        </FormField>

        {/* Cost Basis */}
        <FormField label="Cost Basis (optional)" hint="Total original cost paid">
          <Input
            type="number"
            min={0}
            prefix="$"
            value={form.costBasis}
            onChange={(e) => set({ costBasis: e.target.value })}
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
            <FormField label="Expected Annual Appreciation">
              <Input
                type="number"
                min={0}
                max={200}
                step={0.5}
                suffix="%"
                value={form.expectedAppreciationRate}
                onChange={(e) => set({ expectedAppreciationRate: e.target.value })}
              />
            </FormField>

            <FormField label="Expected Sale Year (optional)">
              <Input
                type="number"
                min={2024}
                max={2100}
                step={1}
                value={form.expectedSaleYear}
                onChange={(e) => set({ expectedSaleYear: e.target.value })}
                placeholder="e.g. 2030"
              />
            </FormField>

            {form.expectedSaleYear.trim() !== "" && (
              <FormField label="% to Sell That Year">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  suffix="%"
                  value={form.saleFraction}
                  onChange={(e) => set({ saleFraction: e.target.value })}
                />
              </FormField>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-3.5 w-3.5" /> Cancel
        </Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={!isValid} loading={isPending}>
          <Check className="h-3.5 w-3.5" /> {isPending ? "Saving…" : "Save Holding"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CryptoHoldingsForm() {
  const utils = trpc.useUtils();

  const { data = [], isLoading } = trpc.crypto.list.useQuery();

  const invalidate = () => utils.crypto.list.invalidate();

  const add = trpc.crypto.add.useMutation({ onSuccess: () => { invalidate(); setAdding(false); } });
  const update = trpc.crypto.update.useMutation({ onSuccess: () => { invalidate(); setEditingId(null); } });
  const del = trpc.crypto.delete.useMutation({ onSuccess: invalidate });

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const totalValue = data.reduce((s, h) => s + h.currentValue, 0);

  if (isLoading) {
    return <div className="text-slate-600 text-sm p-8 animate-pulse">Loading…</div>;
  }

  return (
    <Card>
      <CardHeader
        title="Crypto Holdings"
        description="Cryptocurrency positions with appreciation and sale assumptions"
        action={
          !adding && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setAdding(true); setEditingId(null); }}
            >
              <PlusCircle className="h-3.5 w-3.5" /> Add Holding
            </Button>
          )
        }
      />

      {/* Inline add form */}
      {adding && (
        <CardBody className="border-b border-slate-200">
          <CryptoHoldingForm
            initial={EMPTY}
            onSave={(f) => add.mutate(toMutation(f))}
            onCancel={() => setAdding(false)}
            isPending={add.isPending}
          />
        </CardBody>
      )}

      {/* Summary strip */}
      {data.length > 0 && (
        <div className="px-6 py-3 border-b border-slate-200 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">
            {data.length} {data.length === 1 ? "holding" : "holdings"} · {formatCurrency(totalValue, true)} total
          </span>
        </div>
      )}

      {/* Empty state */}
      {data.length === 0 && !adding ? (
        <CardBody>
          <p className="text-sm text-slate-600">No crypto holdings added yet.</p>
        </CardBody>
      ) : (
        <div className="divide-y divide-slate-200">
          {data.map((holding) => (
            <div key={holding.id}>
              {editingId === holding.id ? (
                <div className="px-6 py-4">
                  <CryptoHoldingForm
                    initial={fromRecord(holding)}
                    onSave={(f) => update.mutate({ id: holding.id, ...toMutation(f) })}
                    onCancel={() => setEditingId(null)}
                    isPending={update.isPending}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between px-6 py-3 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-slate-900">
                        {holding.symbol
                          ? `${holding.coinName} (${holding.symbol})`
                          : holding.coinName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {holding.quantityCoins > 0 && (
                        <span className="text-xs text-slate-600">
                          {holding.quantityCoins} coins
                        </span>
                      )}
                      {holding.expectedSaleYear != null && (
                        <span className="text-xs text-slate-600">
                          Sale: {holding.expectedSaleYear}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ml-4 flex items-center gap-3">
                    <span className="text-sm font-semibold text-emerald-600">
                      {formatCurrency(holding.currentValue)}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(holding.id)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => del.mutate({ id: holding.id })}
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
