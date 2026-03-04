import { PageHeader } from "@/components/layout/page-header";
import { EstateDashboard } from "@/components/dashboard/estate-dashboard";
import { NextSectionBanner } from "@/components/layout/next-section-banner";

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
      <NextSectionBanner
        href="/scenarios"
        label="Scenarios"
        description="Compare up to 3 scenarios with different return, spending, and carry assumptions"
      />
    </div>
  );
}
