import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";

type Params = { params: Promise<{ userId: string }> };

async function requireAdmin() {
  const user = await currentUser();
  if (!user || user.publicMetadata?.role !== "admin") return null;
  return user;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { userId } = await params;
  const { banned } = await req.json();

  const clerk = await clerkClient();
  if (banned) {
    await clerk.users.banUser(userId);
  } else {
    await clerk.users.unbanUser(userId);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { userId } = await params;
  if (userId === admin.id) {
    return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });
  }

  const clerk = await clerkClient();
  await clerk.users.deleteUser(userId);
  return NextResponse.json({ ok: true });
}
