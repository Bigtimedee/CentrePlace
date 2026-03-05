import { currentUser } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  // Auto-promote designated admin on first visit
  if (
    user.primaryEmailAddress?.emailAddress === process.env.ADMIN_EMAIL &&
    user.publicMetadata?.role !== "admin"
  ) {
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(user.id, {
      publicMetadata: { role: "admin" },
    });
    redirect("/admin");
  }

  if (user.publicMetadata?.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar />
      <main className="pl-60">
        <div className="max-w-7xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
