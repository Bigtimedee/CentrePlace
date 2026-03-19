"use client";

import { useState, useCallback, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link2, Trash2, RefreshCw, Building2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlaidConnection {
  id: string;
  institutionName: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
}

interface PlaidAccount {
  connection_id: string;
  institution_name: string | null;
  account_id: string;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  balance_current: number | null;
  balance_available: number | null;
  iso_currency_code: string | null;
}

// ─── Plaid Link wrapper ───────────────────────────────────────────────────────

function PlaidLinkButton({ onSuccess }: { onSuccess: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  const fetchToken = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
      const data = await res.json() as { link_token: string };
      setLinkToken(data.link_token);
    } finally {
      setFetching(false);
    }
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: async (public_token, metadata) => {
      await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_token,
          institution_name: metadata.institution?.name,
        }),
      });
      onSuccess();
    },
  });

  const handleClick = async () => {
    if (!linkToken) {
      await fetchToken();
    }
  };

  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  return (
    <Button
      onClick={handleClick}
      disabled={fetching}
      size="sm"
      className="gap-2"
    >
      <Link2 className="h-4 w-4" />
      {fetching ? "Loading…" : "Connect Account"}
    </Button>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function PlaidConnectionPanel() {
  const [connections, setConnections] = useState<PlaidConnection[]>([]);
  const [accounts, setAccounts] = useState<PlaidAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    const res = await fetch("/api/plaid/connections");
    const data = await res.json() as { connections: PlaidConnection[] };
    setConnections(data.connections ?? []);
  }, []);

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch("/api/plaid/accounts");
      const data = await res.json() as { accounts: PlaidAccount[] };
      setAccounts(data.accounts ?? []);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    if (connections.length > 0) {
      void loadAccounts();
    } else {
      setAccounts([]);
    }
  }, [connections, loadAccounts]);

  const handleDisconnect = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/plaid/connections?id=${id}`, { method: "DELETE" });
      await loadConnections();
    } finally {
      setDeletingId(null);
    }
  };

  const handleSuccess = async () => {
    await loadConnections();
  };

  // Group accounts by connection_id
  const accountsByConnection = accounts.reduce<Record<string, PlaidAccount[]>>((acc, acct) => {
    if (!acc[acct.connection_id]) acc[acct.connection_id] = [];
    acc[acct.connection_id].push(acct);
    return acc;
  }, {});

  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance_current ?? 0), 0);

  return (
    <Card>
      <CardHeader
        title="Connected Bank & Credit Card Accounts"
        description={
          accounts.length > 0
            ? `${accounts.length} account${accounts.length !== 1 ? "s" : ""} · ${formatCurrency(totalBalance)} total`
            : undefined
        }
        action={
          <div className="flex items-center gap-2">
            {connections.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={loadAccounts}
                disabled={loadingAccounts}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loadingAccounts ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            )}
            <PlaidLinkButton onSuccess={handleSuccess} />
          </div>
        }
      />

      {connections.length === 0 ? (
        <CardBody>
          <p className="text-sm text-muted-foreground text-center py-6">
            No accounts connected. Click <strong>Connect Account</strong> to link a bank or credit card.
          </p>
        </CardBody>
      ) : (
        <CardBody className="space-y-4">
          {connections.map((conn) => {
            const connAccounts = accountsByConnection[conn.id] ?? [];
            return (
              <div key={conn.id} className="border rounded-lg overflow-hidden">
                {/* Institution header */}
                <div className="flex items-center justify-between px-4 py-3 bg-muted/40">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">
                      {conn.institutionName ?? "Connected Institution"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDisconnect(conn.id)}
                    disabled={deletingId === conn.id}
                    className="text-destructive hover:text-destructive gap-1 h-7 px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deletingId === conn.id ? "Removing…" : "Disconnect"}
                  </Button>
                </div>

                {/* Accounts list */}
                {loadingAccounts ? (
                  <div className="px-4 py-3 text-sm text-muted-foreground">Loading accounts…</div>
                ) : connAccounts.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-muted-foreground">No accounts found.</div>
                ) : (
                  <div className="divide-y">
                    {connAccounts.map((acct) => (
                      <div key={acct.account_id} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">{acct.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {acct.type}{acct.subtype ? ` · ${acct.subtype}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            {acct.balance_current != null
                              ? formatCurrency(acct.balance_current)
                              : "—"}
                          </p>
                          {acct.balance_available != null &&
                            acct.balance_available !== acct.balance_current && (
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(acct.balance_available)} available
                              </p>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardBody>
      )}
    </Card>
  );
}
