import { PageHeader } from "@/components/layout/page-header";
import { EstateDashboard } from "@/components/dashboard/estate-dashboard";

export default function EstatePage() {
  return (
    <div>
      <PageHeader
        title="Estate Planning"
        description="Gross estate, tax liability, planning opportunities, and beneficiary allocations"
      />
      <div className="mt-8">
        <EstateDashboard />
      </div>
    </div>
  );
}
