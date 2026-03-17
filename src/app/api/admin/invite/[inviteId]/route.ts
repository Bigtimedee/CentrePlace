import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  const user = await currentUser();
  if (!user || user.publicMetadata?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { inviteId } = await params;
  const clerk = await clerkClient();
  try {
    await clerk.invitations.revokeInvitation(inviteId);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const clerkErr = err as { clerkError?: boolean; errors?: { longMessage?: string; message?: string }[]; status?: number };
    if (clerkErr.clerkError && clerkErr.errors?.length) {
      const msg = clerkErr.errors[0].longMessage ?? clerkErr.errors[0].message ?? "Failed to revoke invitation.";
      return NextResponse.json({ error: msg }, { status: clerkErr.status ?? 400 });
    }
    const msg = err instanceof Error ? err.message : "Failed to revoke invitation.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
