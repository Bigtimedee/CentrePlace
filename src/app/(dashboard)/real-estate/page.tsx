import { PageHeader } from "@/components/layout/page-header";
import { RealEstateForm } from "@/components/forms/real-estate-form";

export default function RealEstatePage() {
  return (
    <div>
      <PageHeader title="Real Estate" description="Properties with full amortization, rental income, and sale projections" />
      <div className="mt-8">
        <RealEstateForm />
      </div>
    </div>
  );
}
