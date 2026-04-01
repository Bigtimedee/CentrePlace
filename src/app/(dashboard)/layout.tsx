import { Sidebar } from "@/components/layout/sidebar";
import { UsernameGate } from "@/components/layout/username-gate";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main className="pl-0 md:pl-60 pt-14 md:pt-0">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <UsernameGate>
            {children}
          </UsernameGate>
        </div>
      </main>
    </div>
  );
}
