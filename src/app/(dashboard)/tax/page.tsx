import { PageHeader } from "@/components/layout/page-header";
import { TaxCenter } from "@/components/tax/tax-center";

export default function TaxPage() {
  return (
    <div>
      <PageHeader
        title="Tax Planning"
        description="Projected tax liability, bracket analysis, and carry timing optimization"
      />
      <div className="mt-8">
        <TaxCenter />
      </div>
    </div>
  );
}
