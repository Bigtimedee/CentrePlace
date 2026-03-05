import { clerkClient } from "@clerk/nextjs/server";
import { UserTable } from "@/components/admin/user-table";
import { InviteUserForm } from "@/components/admin/invite-user-form";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const clerk = await clerkClient();
  const { data: users } = await clerk.users.getUserList({
    limit: 200,
    orderBy: "-created_at",
  });

  const rows = users.map((u) => ({
    id: u.id,
    email: u.emailAddresses[0]?.emailAddress ?? "",
    firstName: u.firstName ?? "",
    lastName: u.lastName ?? "",
    banned: u.banned,
    createdAt: u.createdAt,
    role: (u.publicMetadata?.role as string | undefined) ?? null,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 mb-1">Users</h1>
          <p className="text-slate-400 text-sm">{rows.length} account{rows.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="mb-8">
        <InviteUserForm />
      </div>

      <UserTable users={rows} />
    </div>
  );
}
