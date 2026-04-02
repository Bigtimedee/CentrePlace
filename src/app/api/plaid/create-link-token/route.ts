import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { plaidClient } from "@/lib/plaid";
import { Products, CountryCode } from "plaid";

export const runtime = "nodejs";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only include redirect_uri when explicitly configured — required for OAuth institutions
  // but must be registered in the Plaid Dashboard; omitting it works for all non-OAuth flows.
  const oauthRedirectUri = process.env.PLAID_OAUTH_REDIRECT_URI;

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "GPRetire",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
      ...(oauthRedirectUri ? { redirect_uri: oauthRedirectUri } : {}),
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error("[create-link-token] Plaid error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to create Plaid link token" }, { status: 500 });
  }
}
