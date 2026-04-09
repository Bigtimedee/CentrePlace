"use client";

import { useState, useCallback, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link2, Trash2, RefreshCw, Building2, ShieldCheck, CheckCircle2, AlertCircle, FlaskConical } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlaidConnection {
  id: string;
  institutionName: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  syncMode: "oneshot" | "persistent";
}

type SyncPhase = "idle" | "reviewing" | "syncing" | "done" | "error";

interface SyncState {
  phase: SyncPhase;
  targetConnectionId: string | null;
  result: {
    expenditures: { created: number; skipped: number } | null;
    accounts: { created: number; skipped: number } | null;
  } | null;
  errorMessage: string | null;
}

const IDLE_SYNC_STATE: SyncState = {
  phase: "idle",
  targetConnectionId: null,
  result: null,
  errorMessage: null,
};

// ─── Plaid Link wrapper ───────────────────────────────────────────────────────

const PLAID_TOKEN_KEY = "plaid_link_token";

function PlaidLinkButton({ onSuccess }: { onSuccess: () => void }) {
  // Detect OAuth return: Plaid appends oauth_state_id to the redirect URI
  const isOAuthReturn =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("oauth_state_id");

  const [linkToken, setLinkToken] = useState<string | null>(() => {
    if (isOAuthReturn && typeof window !== "undefined") {
      return sessionStorage.getItem(PLAID_TOKEN_KEY);
    }
    return null;
  });
  const [fetching, setFetching] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    setFetching(true);
    setTokenError(null);
    try {
      const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
      if (!res.ok) {
        console.error("[PlaidLinkButton] create-link-token failed:", res.status);
        setTokenError("Unable to start bank connection. Please try again.");
        return;
      }
      const data = (await res.json()) as { link_token: string };
      sessionStorage.setItem(PLAID_TOKEN_KEY, data.link_token);
      setLinkToken(data.link_token);
    } catch {
      setTokenError("Network error. Please check your connection and try again.");
    } finally {
      setFetching(false);
    }
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    receivedRedirectUri: isOAuthReturn ? window.location.href : undefined,
    onSuccess: async (public_token, metadata) => {
      sessionStorage.removeItem(PLAID_TOKEN_KEY);
      try {
        const res = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            public_token,
            institution_name: metadata.institution?.name,
          }),
        });
        if (!res.ok) {
          console.error("[PlaidLinkButton] exchange-token failed:", res.status);
          setTokenError("Failed to save bank connection. Please try again.");
          return;
        }
        onSuccess();
      } catch {
        setTokenError("Network error while saving connection. Please try again.");
      }
    },
    onExit: () => {
      sessionStorage.removeItem(PLAID_TOKEN_KEY);
      setLinkToken(null);
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
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleClick} disabled={fetching} size="sm" className="gap-2">
        <Link2 className="h-4 w-4" />
        {fetching ? "Loading…" : "Connect Account"}
      </Button>
      {tokenError && (
        <p className="text-xs text-destructive">{tokenError}</p>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function PlaidConnectionPanel() {
  const [connections, setConnections] = useState<PlaidConnection[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>(IDLE_SYNC_STATE);

  const loadConnections = useCallback(async () => {
    const res = await fetch("/api/plaid/connections");
    const data = (await res.json()) as { connections: PlaidConnection[] };
    setConnections(data.connections ?? []);
  }, []);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  // ── Disconnect (legacy persistent connections, or discard without extracting) ──
  const handleDisconnect = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/plaid/connections?id=${id}`, { method: "DELETE" });
      await loadConnections();
    } finally {
      setDeletingId(null);
    }
  };

  // ── One-shot flow ──
  const handleReview = (id: string) => {
    setSyncState({ phase: "reviewing", targetConnectionId: id, result: null, errorMessage: null });
  };

  const handleExtractAndDisconnect = async () => {
    const id = syncState.targetConnectionId;
    if (!id) return;
    setSyncState((s) => ({ ...s, phase: "syncing" }));
    try {
      const res = await fetch("/api/plaid/sync-and-disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: id }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        expenditures?: { created: number; skipped: number };
        accounts?: { created: number; skipped: number };
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setSyncState((s) => ({
          ...s,
          phase: "error",
          errorMessage: data.error ?? "Something went wrong.",
        }));
      } else {
        setSyncState({
          phase: "done",
          targetConnectionId: null,
          result: {
            expenditures: data.expenditures ?? null,
            accounts: data.accounts ?? null,
          },
          errorMessage: null,
        });
      }
    } catch {
      setSyncState((s) => ({
        ...s,
        phase: "error",
        errorMessage: "Network error. Please try again.",
      }));
    } finally {
      await loadConnections();
    }
  };

  const handleDiscardAndDisconnect = async () => {
    const id = syncState.targetConnectionId;
    if (!id) return;
    setSyncState((s) => ({ ...s, phase: "syncing" }));
    try {
      await fetch(`/api/plaid/connections?id=${id}`, { method: "DELETE" });
    } finally {
      await loadConnections();
      setSyncState(IDLE_SYNC_STATE);
    }
  };

  const handleSuccess = async () => {
    await loadConnections();
  };

  const oneshotConnections = connections.filter((c) => c.syncMode === "oneshot");
  const persistentConnections = connections.filter((c) => c.syncMode === "persistent");

  // ── Syncing overlay ──
  if (syncState.phase === "syncing") {
    return (
      <Card>
        <CardBody>
          <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
            <RefreshCw className="h-8 w-8 text-[#C8A45A] animate-spin" />
            <div>
              <p className="text-sm font-medium text-foreground">Extracting data and disconnecting…</p>
              <p className="text-xs text-muted-foreground mt-1">
                This takes about 5 seconds. Do not close this page.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  // ── Done state ──
  if (syncState.phase === "done") {
    const exp = syncState.result?.expenditures;
    const acc = syncState.result?.accounts;
    return (
      <Card>
        <CardBody>
          <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-sm font-semibold text-foreground">Data extracted successfully</p>
              <p className="text-xs text-muted-foreground mt-1">Your bank connection has been removed.</p>
            </div>
            {(exp ?? acc) && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                {exp && (
                  <p>
                    Expenses: {exp.created} added, {exp.skipped} already present
                  </p>
                )}
                {acc && (
                  <p>
                    Accounts: {acc.created} added, {acc.skipped} already present
                  </p>
                )}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSyncState(IDLE_SYNC_STATE)}
            >
              Done
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  // ── Error state ──
  if (syncState.phase === "error") {
    return (
      <Card>
        <CardBody>
          <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-foreground">Something went wrong</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your bank connection may have been removed. Check your connections below.
              </p>
              {syncState.errorMessage && (
                <p className="text-xs text-destructive mt-1">{syncState.errorMessage}</p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSyncState(IDLE_SYNC_STATE)}>
              Dismiss
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  // ── Reviewing state: show confirm dialog ──
  if (syncState.phase === "reviewing" && syncState.targetConnectionId) {
    const conn = connections.find((c) => c.id === syncState.targetConnectionId);
    return (
      <Card>
        <CardHeader
          title="Review before importing"
          description={`${conn?.institutionName ?? "This institution"} · You can review your accounts before any data is saved.`}
        />
        <CardBody>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              GPRetire will read your spending history and investment accounts, build your financial
              profile, then immediately revoke access. No transaction details, account numbers, or
              credentials will be stored.
            </p>
            <div className="flex gap-2">
              <Button onClick={handleExtractAndDisconnect} size="sm" className="gap-2">
                Extract Data &amp; Disconnect
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDiscardAndDisconnect}
                className="gap-2 text-destructive hover:text-destructive"
              >
                Discard &amp; Disconnect
              </Button>
            </div>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setSyncState(IDLE_SYNC_STATE)}
            >
              ← Cancel
            </button>
          </div>
        </CardBody>
      </Card>
    );
  }

  // ── Idle state: main panel ──
  return (
    <Card>
      <CardHeader
        title="One-Time Bank Import"
        action={<PlaidLinkButton onSuccess={handleSuccess} />}
      />

      {connections.length === 0 ? (
        <CardBody>
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
              <ShieldCheck className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Your data is never stored</p>
                <p className="text-sm text-muted-foreground">
                  Connect your bank, credit card, or brokerage accounts to automatically import your
                  spending history and account balances. GPRetire reads your data once, builds your
                  financial profile from it, then immediately revokes access and deletes the
                  connection. No account numbers, transaction details, or credentials are ever stored.
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              You can review your accounts before any data is saved.
            </p>

            {process.env.NEXT_PUBLIC_PLAID_ENV === "sandbox" && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <FlaskConical className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 mb-1">Sandbox mode — use test credentials</p>
                  <p className="text-sm text-amber-700">
                    When prompted for a phone number, enter{" "}
                    <strong className="font-semibold">+1 (415) 555-0123</strong> and use OTP{" "}
                    <strong className="font-semibold">123456</strong>. For institution login, use username{" "}
                    <strong className="font-semibold">user_good</strong> and password{" "}
                    <strong className="font-semibold">pass_good</strong>.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardBody>
      ) : (
        <CardBody className="space-y-4">
          {/* One-shot connections (new flow) */}
          {oneshotConnections.map((conn) => (
            <div key={conn.id} className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-muted/40">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">
                    {conn.institutionName ?? "Connected Institution"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleReview(conn.id)}
                    className="h-7 px-3 text-xs gap-1"
                  >
                    Extract Data &amp; Disconnect
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDisconnect(conn.id)}
                    disabled={deletingId === conn.id}
                    className="text-destructive hover:text-destructive gap-1 h-7 px-2 text-xs"
                  >
                    {deletingId === conn.id ? "Removing…" : "Discard"}
                  </Button>
                </div>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Ready to import. Click <strong>Extract Data &amp; Disconnect</strong> to read your
                  data and immediately revoke access.
                </p>
              </div>
            </div>
          ))}

          {/* Legacy persistent connections */}
          {persistentConnections.map((conn) => (
            <div key={conn.id} className="border rounded-lg overflow-hidden">
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
            </div>
          ))}
        </CardBody>
      )}
    </Card>
  );
}
