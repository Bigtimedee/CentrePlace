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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "GPRetire",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
      redirect_uri: `${appUrl}/portfolios`,
    });

    return NextResponse.json({
      link_token: response.data.link_token,
      plaid_env: process.env.PLAID_ENV ?? "sandbox",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[create-link-token] Plaid error:", message);
    return NextResponse.json(
      { error: "Failed to create Plaid link token", detail: message },
      { status: 500 }
    );
  }
}
