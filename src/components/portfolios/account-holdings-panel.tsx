"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { StatementUploadButton, UploadResult } from "./statement-upload-button";
import { HoldingsReviewModal } from "./holdings-review-modal";
import { HoldingsBreakdownChart } from "./holdings-breakdown-chart";
import { HoldingsTable } from "./holdings-table";

interface Props {
  accountId: string;
  accountName: string;
  accounts: { id: string; accountName: string; accountType: string }[];
}

export function AccountHoldingsPanel({ accountId, accountName, accounts }: Props) {
  const [pending, setPending] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: statements, refetch } = trpc.portfolios.getHoldings.useQuery({ accountId });

  const latestStatement = statements?.[0];
  const holdings = latestStatement?.holdings ?? [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">{accountName} — Holdings</h3>
        <StatementUploadButton
          accountId={accountId}
          onUploadComplete={(result) => { setError(null); setPending(result); }}
          onError={setError}
        />
      </div>

      {error && (
        <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {holdings.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-400 italic">
            No holdings imported yet. Upload a statement or add holdings manually.
          </p>
          <HoldingsTable accountId={accountId} holdings={[]} onRefetch={refetch} />
        </div>
      ) : (
        <>
          <HoldingsBreakdownChart holdings={holdings} />
          <div className="mt-4">
            <HoldingsTable
              accountId={accountId}
              holdings={holdings}
              onRefetch={refetch}
            />
          </div>
          {latestStatement?.statementDate && (
            <p className="mt-3 text-xs text-gray-400">
              Statement date: {latestStatement.statementDate}
              {latestStatement.brokerageName ? ` · ${latestStatement.brokerageName}` : ""}
            </p>
          )}
        </>
      )}

      {pending && (
        <HoldingsReviewModal
          statementId={pending.statementId}
          brokerageName={pending.brokerageName}
          statementDate={pending.statementDate}
          holdings={pending.holdings}
          accounts={accounts}
          onConfirmed={() => { setPending(null); refetch(); }}
          onClose={() => { setPending(null); refetch(); }}
        />
      )}
    </div>
  );
}
