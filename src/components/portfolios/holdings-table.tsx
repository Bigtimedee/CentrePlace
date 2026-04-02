"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Pencil, Trash2, Check, X, Plus, RefreshCw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Holding {
  id: string;
  ticker: string | null;
  securityName: string;
  assetClass: string;
  securitySubType: string | null;
  shares: number | null;
  pricePerShare: number | null;
  marketValue: number;
  costBasis: string | null;
  currentPrice: string | null;
  currentValue: string | null;
  priceRefreshedAt: Date | null | string;
}

interface Props {
  accountId: string;
  holdings: Holding[];
  onRefetch: () => void;
  accountType?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return (n >= 0 ? "+" : "") + (n * 100).toFixed(2) + "%";
}

function getValue(h: Holding): number {
  if (h.currentValue != null) return parseFloat(h.currentValue);
  return h.marketValue;
}

function getPrice(h: Holding): number | null {
  if (h.currentPrice != null) return parseFloat(h.currentPrice);
  return h.pricePerShare ?? null;
}

function roiPct(h: Holding): number | null {
  const basis = h.costBasis != null ? parseFloat(h.costBasis) : null;
  if (!basis || basis === 0) return null;
  return (getValue(h) - basis) / basis;
}

function roiDollar(h: Holding): number | null {
  const basis = h.costBasis != null ? parseFloat(h.costBasis) : null;
  if (basis == null) return null;
  return getValue(h) - basis;
}

// ─── Tax placement chip ───────────────────────────────────────────────────────

function TaxPlacementChip({
  assetClass,
  securitySubType,
  accountType,
}: {
  assetClass: string;
  securitySubType: string | null;
  accountType?: string | null;
}) {
  if (!accountType) return null;

  const isTaxAdvantaged =
    accountType === "traditional_ira" ||
    accountType === "roth_ira" ||
    accountType === "traditional_401k" ||
    accountType === "roth_401k" ||
    accountType === "sep_ira" ||
    accountType === "solo_401k";

  const isTraditional =
    accountType === "traditional_ira" ||
    accountType === "traditional_401k" ||
    accountType === "sep_ira" ||
    accountType === "solo_401k";

  let message: string | null = null;

  if (securitySubType === "muni_bond" && isTaxAdvantaged) {
    message = "Consider moving to Taxable — muni tax exemption is wasted in tax-advantaged";
  } else if (assetClass === "bond" && accountType === "taxable" && securitySubType !== "muni_bond") {
    message = "Consider moving to IRA — bond income taxed as ordinary";
  } else if (assetClass === "alt" && accountType === "taxable") {
    message = "Consider moving to IRA — REIT dividends are ordinary income";
  } else if (assetClass === "equity" && isTraditional) {
    message = "Consider moving to Taxable — converts LTCG to ordinary income";
  }

  if (!message) return null;

  return (
    <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      <svg className="h-3 w-3 flex-shrink-0" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      {message}
    </span>
  );
}

// ─── Inline edit row ─────────────────────────────────────────────────────────

interface EditState {
  ticker: string;
  securityName: string;
  shares: string;
  costBasis: string;
}

function EditRow({
  holding,
  currentPrice,
  onSave,
  onCancel,
}: {
  holding: Holding;
  currentPrice: number | null;
  onSave: (data: EditState) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<EditState>({
    ticker: holding.ticker ?? "",
    securityName: holding.securityName,
    shares: holding.shares != null ? String(holding.shares) : "",
    costBasis: holding.costBasis ?? "",
  });

  const set = (key: keyof EditState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const sharesNum = parseFloat(form.shares);
  const previewValue = !isNaN(sharesNum) && currentPrice != null ? sharesNum * currentPrice : null;
  const costBasisNum = parseFloat(form.costBasis);
  const previewRoiPct = previewValue != null && !isNaN(costBasisNum) && costBasisNum > 0
    ? (previewValue - costBasisNum) / costBasisNum : null;
  const previewRoiDollar = previewValue != null && !isNaN(costBasisNum)
    ? previewValue - costBasisNum : null;

  return (
    <tr className="bg-[#FFF3D8]">
      <td className="px-3 py-2">
        <input
          value={form.ticker}
          onChange={set("ticker")}
          placeholder="TICKER"
          className="w-24 rounded border border-[#D4B896] px-2 py-1 text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={form.securityName}
          onChange={set("securityName")}
          className="w-full min-w-[180px] rounded border border-[#D4B896] px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={form.costBasis}
          onChange={set("costBasis")}
          type="number"
          placeholder="optional"
          className="w-28 rounded border border-[#D4B896] px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={form.shares}
          onChange={set("shares")}
          type="number"
          placeholder="—"
          className="w-24 rounded border border-[#D4B896] px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
      </td>
      {/* Today's Value — live preview based on shares × stored price */}
      <td className="px-3 py-2 text-right text-xs font-medium text-slate-700">
        {previewValue != null ? fmtMoney(previewValue) : <span className="text-slate-400">—</span>}
      </td>
      {/* ROI % */}
      <td className="px-3 py-2 text-right text-xs">
        {previewRoiPct != null ? (
          <span className={previewRoiPct >= 0 ? "text-green-700" : "text-red-600"}>{fmtPct(previewRoiPct)}</span>
        ) : <span className="text-slate-400">—</span>}
      </td>
      {/* ROI $ */}
      <td className="px-3 py-2 text-right text-xs">
        {previewRoiDollar != null ? (
          <span className={previewRoiDollar >= 0 ? "text-green-700" : "text-red-600"}>{fmtMoney(previewRoiDollar)}</span>
        ) : <span className="text-slate-400">—</span>}
      </td>
      {/* Price/Share — stored price used for preview */}
      <td className="px-3 py-2 text-right text-xs text-slate-500">
        {currentPrice != null ? fmtMoney(currentPrice) : <span className="text-slate-400">—</span>}
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1 justify-end">
          <button
            onClick={() => onSave(form)}
            className="rounded p-1 text-green-600 hover:bg-green-100"
            title="Save"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onCancel}
            className="rounded p-1 text-slate-400 hover:bg-slate-100"
            title="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Add row ─────────────────────────────────────────────────────────────────

function AddRow({
  accountId,
  onSaved,
  onCancel,
}: {
  accountId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    ticker: "",
    securityName: "",
    assetClass: "equity",
    shares: "",
    pricePerShare: "",
    marketValue: "",
    costBasis: "",
  });

  const addMutation = trpc.portfolios.addHolding.useMutation({ onSuccess: onSaved });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = () => {
    const marketValue = parseFloat(form.marketValue);
    if (!form.securityName.trim() || isNaN(marketValue)) return;
    addMutation.mutate({
      accountId,
      ticker: form.ticker.trim().toUpperCase() || null,
      securityName: form.securityName.trim(),
      assetClass: form.assetClass,
      shares: form.shares ? parseFloat(form.shares) : null,
      pricePerShare: form.pricePerShare ? parseFloat(form.pricePerShare) : null,
      marketValue,
      costBasis: form.costBasis ? parseFloat(form.costBasis) : null,
    });
  };

  return (
    <tr className="bg-green-50">
      <td className="px-3 py-2">
        <input
          value={form.ticker}
          onChange={set("ticker")}
          placeholder="TICKER"
          className="w-24 rounded border border-green-200 px-2 py-1 text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-green-400"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-2 items-center">
          <input
            value={form.securityName}
            onChange={set("securityName")}
            placeholder="Security name *"
            className="w-44 rounded border border-green-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
          />
          <select
            value={form.assetClass}
            onChange={set("assetClass")}
            className="rounded border border-green-200 px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-400"
          >
            <option value="equity">Equity</option>
            <option value="bond">Bond</option>
            <option value="alt">Alt</option>
            <option value="cash">Cash</option>
          </select>
        </div>
      </td>
      <td className="px-3 py-2">
        <input
          value={form.costBasis}
          onChange={set("costBasis")}
          type="number"
          placeholder="optional"
          className="w-28 rounded border border-green-200 px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-green-400"
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={form.shares}
          onChange={set("shares")}
          type="number"
          placeholder="—"
          className="w-24 rounded border border-green-200 px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-green-400"
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={form.marketValue}
          onChange={set("marketValue")}
          type="number"
          placeholder="0.00 *"
          className="w-28 rounded border border-green-200 px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-green-400"
        />
      </td>
      <td className="px-3 py-2 text-right text-xs text-slate-400" colSpan={3}>—</td>
      <td className="px-3 py-2">
        <div className="flex gap-1 justify-end">
          <button
            onClick={handleSave}
            disabled={addMutation.isPending}
            className="rounded p-1 text-green-600 hover:bg-green-100 disabled:opacity-40"
            title="Add"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onCancel}
            className="rounded p-1 text-slate-400 hover:bg-slate-100"
            title="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main table ───────────────────────────────────────────────────────────────

export function HoldingsTable({ accountId, holdings, onRefetch, accountType }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refreshMutation = trpc.portfolios.refreshAccountPrices.useMutation({
    onSuccess: () => { setRefreshing(false); onRefetch(); },
    onError: () => setRefreshing(false),
  });
  const updateMutation = trpc.portfolios.updateHolding.useMutation({
    onSuccess: () => { setEditingId(null); onRefetch(); refreshMutation.mutate({ accountId }); },
  });
  const deleteMutation = trpc.portfolios.deleteHolding.useMutation({
    onSuccess: onRefetch,
  });

  const handleSaveEdit = (id: string, form: EditState) => {
    updateMutation.mutate({
      id,
      ticker: form.ticker.trim().toUpperCase() || null,
      securityName: form.securityName.trim(),
      shares: form.shares ? parseFloat(form.shares) : null,
      costBasis: form.costBasis ? parseFloat(form.costBasis) : null,
    });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    refreshMutation.mutate({ accountId });
  };

  const totalValue = holdings.reduce((sum, h) => sum + getValue(h), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[#C8A45A] hover:bg-[#FFF3D8] font-medium"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Holding
        </button>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh Prices
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-slate-50 text-left">
              <th className="px-3 py-2 font-medium text-slate-600 whitespace-nowrap">Ticker</th>
              <th className="px-3 py-2 font-medium text-slate-600">Investment Name</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-right whitespace-nowrap">Cost Basis</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-right whitespace-nowrap"># Shares</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-right whitespace-nowrap">Today's Value</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-right whitespace-nowrap">ROI %</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-right whitespace-nowrap">ROI $</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-right whitespace-nowrap">Price/Share</th>
              <th className="px-3 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {holdings.map((h) =>
              editingId === h.id ? (
                <EditRow
                  key={h.id}
                  holding={h}
                  currentPrice={getPrice(h)}
                  onSave={(form) => handleSaveEdit(h.id, form)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <HoldingRow
                  key={h.id}
                  holding={h}
                  onEdit={() => setEditingId(h.id)}
                  onDelete={() => deleteMutation.mutate({ id: h.id })}
                  deleting={deleteMutation.isPending && deleteMutation.variables?.id === h.id}
                  accountType={accountType}
                />
              )
            )}

            {adding && (
              <AddRow
                accountId={accountId}
                onSaved={() => { setAdding(false); onRefetch(); }}
                onCancel={() => setAdding(false)}
              />
            )}

            {holdings.length > 0 && (
              <tr className="bg-slate-50 font-semibold">
                <td className="px-3 py-2 text-slate-700" colSpan={4}>Total</td>
                <td className="px-3 py-2 text-right text-slate-800">{fmtMoney(totalValue)}</td>
                <td className="px-3 py-2 text-right">
                  {(() => {
                    const totalBasis = holdings.reduce((s, h) => {
                      const b = h.costBasis != null ? parseFloat(h.costBasis) : null;
                      return b != null ? s + b : s;
                    }, 0);
                    const hasBasis = holdings.some((h) => h.costBasis != null);
                    if (!hasBasis || totalBasis === 0) return <span className="text-slate-400">—</span>;
                    const pct = (totalValue - totalBasis) / totalBasis;
                    return (
                      <span className={pct >= 0 ? "text-green-700" : "text-red-600"}>
                        {fmtPct(pct)}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-3 py-2 text-right">
                  {(() => {
                    const totalBasis = holdings.reduce((s, h) => {
                      const b = h.costBasis != null ? parseFloat(h.costBasis) : null;
                      return b != null ? s + b : s;
                    }, 0);
                    const hasBasis = holdings.some((h) => h.costBasis != null);
                    if (!hasBasis) return <span className="text-slate-400">—</span>;
                    const diff = totalValue - totalBasis;
                    return (
                      <span className={diff >= 0 ? "text-green-700" : "text-red-600"}>
                        {fmtMoney(diff)}
                      </span>
                    );
                  })()}
                </td>
                <td colSpan={2} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Read-only data row ───────────────────────────────────────────────────────

function HoldingRow({
  holding: h,
  onEdit,
  onDelete,
  deleting,
  accountType,
}: {
  holding: Holding;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
  accountType?: string | null;
}) {
  const value = getValue(h);
  const price = getPrice(h);
  const roi = roiPct(h);
  const roiD = roiDollar(h);

  return (
    <tr className="hover:bg-slate-50 group">
      <td className="px-3 py-2 font-mono font-medium text-slate-800 whitespace-nowrap">
        {h.ticker ?? <span className="text-slate-400">—</span>}
      </td>
      <td className="px-3 py-2 text-slate-700 max-w-[220px]">
        <span className="line-clamp-2">{h.securityName}</span>
        <TaxPlacementChip
          assetClass={h.assetClass}
          securitySubType={h.securitySubType}
          accountType={accountType}
        />
      </td>
      <td className="px-3 py-2 text-right text-slate-600">
        {h.costBasis != null ? fmtMoney(parseFloat(h.costBasis)) : (
          <span className="text-slate-300 italic">add</span>
        )}
      </td>
      <td className="px-3 py-2 text-right text-slate-700">
        {h.shares != null ? fmt(h.shares, h.shares % 1 === 0 ? 0 : 4) : "—"}
      </td>
      <td className="px-3 py-2 text-right font-medium text-slate-800">
        {fmtMoney(value)}
        {h.priceRefreshedAt && (
          <span className="ml-1 text-slate-300" title={`Refreshed ${new Date(h.priceRefreshedAt).toLocaleString()}`}>●</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {roi != null ? (
          <span className={roi >= 0 ? "text-green-700 font-medium" : "text-red-600 font-medium"}>
            {fmtPct(roi)}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {roiD != null ? (
          <span className={roiD >= 0 ? "text-green-700" : "text-red-600"}>
            {fmtMoney(roiD)}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-right text-slate-500">
        {price != null ? fmtMoney(price) : "—"}
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="rounded p-1 text-slate-400 hover:text-[#C8A45A] hover:bg-[#FFF3D8]"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="rounded p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
