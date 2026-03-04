import { PageHeader } from "@/components/layout/page-header";
import { RealEstateForm } from "@/components/forms/real-estate-form";
import { NextSectionBanner } from "@/components/layout/next-section-banner";

export default function RealEstatePage() {
  return (
    <div>
      <PageHeader title="Real Estate" description="Properties with full amortization, rental income, and sale projections" />
      <div className="mt-8">
        <RealEstateForm />
      </div>
      <NextSectionBanner
        href="/insurance"
        label="Insurance"
        description="Term, whole life, and PPLI — used in withdrawal sequencing and estate planning"
      />
    </div>
  );
}
