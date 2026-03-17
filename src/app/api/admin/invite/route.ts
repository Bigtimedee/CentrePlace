import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user || user.publicMetadata?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const origin = req.nextUrl.origin;
  const clerk = await clerkClient();
  try {
    await clerk.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: `${origin}/sign-up`,
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const clerkErr = err as { clerkError?: boolean; errors?: { longMessage?: string; message?: string }[]; status?: number };
    if (clerkErr.clerkError && clerkErr.errors?.length) {
      const msg = clerkErr.errors[0].longMessage ?? clerkErr.errors[0].message ?? "Failed to create invitation.";
      return NextResponse.json({ error: msg }, { status: clerkErr.status ?? 400 });
    }
    const msg = err instanceof Error ? err.message : "Failed to create invitation.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
