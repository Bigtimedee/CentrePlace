"use client";

import { trpc } from "@/lib/trpc";
import { HoldingsBreakdownChart } from "./holdings-breakdown-chart";
import { HoldingsTable } from "./holdings-table";

interface Props {
  accountId: string;
  accountName: string;
}

export function AccountHoldingsPanel({ accountId, accountName }: Props) {
  const { data: statements, refetch } = trpc.portfolios.getHoldings.useQuery({ accountId });

  const latestStatement = statements?.[0];
  const holdings = latestStatement?.holdings ?? [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-800">{accountName} — Holdings</h3>
      </div>

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
    </div>
  );
}
