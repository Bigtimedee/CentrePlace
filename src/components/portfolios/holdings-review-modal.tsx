"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { X, CheckCircle } from "lucide-react";

interface Holding {
  id: string;
  ticker?: string | null;
  securityName: string;
  assetClass: string;
  shares?: number | null;
  pricePerShare?: number | null;
  marketValue: number;
  percentOfAccount?: number | null;
}

interface Props {
  statementId: string;
  brokerageName?: string | null;
  statementDate?: string | null;
  holdings: Holding[];
  accounts: { id: string; accountName: string; accountType: string }[];
  onConfirmed: () => void;
  onClose: () => void;
}

const ASSET_CLASS_COLORS: Record<string, string> = {
  equity: "bg-[#FFF3D8] text-[#C8A45A]",
  bond: "bg-green-100 text-green-800",
  alt: "bg-purple-100 text-purple-800",
  cash: "bg-gray-100 text-gray-700",
};

export function HoldingsReviewModal({
  statementId,
  brokerageName,
  statementDate,
  holdings,
  accounts,
  onConfirmed,
  onClose,
}: Props) {
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? "");
  const confirm = trpc.portfolios.confirmHoldings.useMutation({ onSuccess: onConfirmed });
  const deleteStmt = trpc.portfolios.deleteStatement.useMutation({ onSuccess: onClose });

  const totalValue = holdings.reduce((s, h) => s + h.marketValue, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0E1623]/70 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Review Parsed Holdings</h2>
            {brokerageName && <p className="text-sm text-gray-500 mt-0.5">{brokerageName}</p>}
            {statementDate && <p className="text-xs text-gray-400">Statement date: {statementDate}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Holdings table */}
        <div className="overflow-auto flex-1 p-6">
          <p className="text-sm text-gray-600 mb-3">
            Found <strong>{holdings.length}</strong> holdings totalling{" "}
            <strong>${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="pb-2 pr-3">Security</th>
                <th className="pb-2 pr-3">Ticker</th>
                <th className="pb-2 pr-3">Class</th>
                <th className="pb-2 pr-3 text-right">Shares</th>
                <th className="pb-2 text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr key={h.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2 pr-3 font-medium text-gray-800 truncate max-w-[200px]">
                    {h.securityName}
                  </td>
                  <td className="py-2 pr-3 text-gray-500">{h.ticker ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ASSET_CLASS_COLORS[h.assetClass] ?? "bg-gray-100"}`}>
                      {h.assetClass}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right text-gray-600">
                    {h.shares != null ? h.shares.toLocaleString() : "—"}
                  </td>
                  <td className="py-2 text-right font-medium text-gray-800">
                    ${h.marketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Link to account:</label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8A45A]"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => deleteStmt.mutate({ statementId })}
              disabled={deleteStmt.isPending}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Discard
            </button>
            <button
              onClick={() => confirm.mutate({ statementId, accountId: selectedAccountId })}
              disabled={confirm.isPending || !selectedAccountId}
              className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-[#1A0F28] disabled:opacity-60 hover:opacity-90"
              style={{ background: "#C8A45A" }}
            >
              <CheckCircle className="h-4 w-4" />
              {confirm.isPending ? "Saving…" : "Confirm & Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
