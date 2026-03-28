"use client";

import { trpc } from "@/lib/trpc";
import { AccountHoldingsPanel } from "./account-holdings-panel";

export function HoldingsPanelsList() {
  const { data: accounts = [] } = trpc.portfolios.list.useQuery();

  if (accounts.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-1 h-4 rounded-full bg-slate-300" />
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Holdings by Account</h3>
      </div>
      {accounts.map((acct) => (
        <AccountHoldingsPanel
          key={acct.id}
          accountId={acct.id}
          accountName={acct.accountName}
        />
      ))}
    </div>
  );
}
