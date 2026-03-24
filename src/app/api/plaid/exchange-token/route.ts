import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { plaidClient } from "@/lib/plaid";
import { db } from "@/server/db";
import { plaidConnections } from "@/server/db/schema";
import { CountryCode } from "plaid";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { public_token, institution_name } = await req.json() as {
    public_token: string;
    institution_name?: string;
  };

  if (!public_token) {
    return NextResponse.json({ error: "Missing public_token" }, { status: 400 });
  }

  // Exchange public token for access token
  const exchangeResponse = await plaidClient.itemPublicTokenExchange({ public_token });
  const { access_token, item_id } = exchangeResponse.data;

  // Resolve institution name if not supplied by client metadata
  let resolvedName = institution_name ?? null;
  if (!resolvedName) {
    try {
      const itemResponse = await plaidClient.itemGet({ access_token });
      const institutionId = itemResponse.data.item.institution_id;
      if (institutionId) {
        const instResponse = await plaidClient.institutionsGetById({
          institution_id: institutionId,
          country_codes: [CountryCode.Us],
        });
        resolvedName = instResponse.data.institution.name;
      }
    } catch {
      // Non-fatal — institution name is cosmetic
    }
  }

  const [connection] = await db
    .insert(plaidConnections)
    .values({
      userId,
      accessToken: access_token,
      itemId: item_id,
      institutionName: resolvedName,
      syncMode: "oneshot",
    })
    .returning();

  return NextResponse.json({ connection_id: connection.id, institution_name: resolvedName });
}
