import { clerkClient } from "@clerk/nextjs/server";
import { UserTable } from "@/components/admin/user-table";
import { InviteUserForm } from "@/components/admin/invite-user-form";
import { InvitationTable } from "@/components/admin/invitation-table";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const clerk = await clerkClient();
  const [{ data: users }, { data: invitations }] = await Promise.all([
    clerk.users.getUserList({ limit: 200, orderBy: "-created_at" }),
    clerk.invitations.getInvitationList({ status: "pending", limit: 200 }),
  ]);

  const rows = users.map((u) => ({
    id: u.id,
    email: u.emailAddresses[0]?.emailAddress ?? "",
    firstName: u.firstName ?? "",
    lastName: u.lastName ?? "",
    banned: u.banned,
    createdAt: u.createdAt,
    role: (u.publicMetadata?.role as string | undefined) ?? null,
  }));

  const inviteRows = invitations.map((inv) => ({
    id: inv.id,
    email: inv.emailAddress,
    createdAt: inv.createdAt,
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

      {inviteRows.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-slate-100 mb-1">Pending Invitations</h2>
          <p className="text-slate-400 text-sm mb-4">{inviteRows.length} pending</p>
          <InvitationTable invitations={inviteRows} />
        </div>
      )}
    </div>
  );
}
