import { PageHeader } from "@/components/layout/page-header";
import { CarryForm } from "@/components/forms/carry-form";
import { NextSectionBanner } from "@/components/layout/next-section-banner";

export default function CarryPage() {
  return (
    <div>
      <PageHeader title="Carry Positions" description="GP carried interest across all funds — net of haircut and tax" />
      <div className="mt-8">
        <CarryForm />
      </div>
      <NextSectionBanner
        href="/lp-investments"
        label="LP Investments"
        description="Limited partner positions with expected distribution schedules"
      />
    </div>
  );
}
