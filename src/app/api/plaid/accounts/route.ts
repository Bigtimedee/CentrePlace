import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { plaidConnections } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { plaidClient } from "@/lib/plaid";

export const runtime = "nodejs";

export interface PlaidAccount {
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

// GET /api/plaid/accounts — fetch live balances for all connected institutions
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await db
    .select()
    .from(plaidConnections)
    .where(eq(plaidConnections.userId, userId));

  const accounts: PlaidAccount[] = [];

  await Promise.allSettled(
    connections.map(async (conn) => {
      const response = await plaidClient.accountsGet({ access_token: conn.accessToken });
      for (const acct of response.data.accounts) {
        accounts.push({
          connection_id: conn.id,
          institution_name: conn.institutionName,
          account_id: acct.account_id,
          name: acct.name,
          official_name: acct.official_name ?? null,
          type: acct.type,
          subtype: acct.subtype ?? null,
          balance_current: acct.balances.current ?? null,
          balance_available: acct.balances.available ?? null,
          iso_currency_code: acct.balances.iso_currency_code ?? null,
        });
      }
    })
  );

  return NextResponse.json({ accounts });
}
