import { PageHeader } from "@/components/layout/page-header";
import { CashflowCenter } from "@/components/cashflow/cashflow-center";
import { NextSectionBanner } from "@/components/layout/next-section-banner";

export default function CashflowPage() {
  return (
    <div>
      <PageHeader
        title="Liquidity Timeline"
        description="Cash arrival schedule across carry, LP distributions, real estate, and income — net after estimated tax"
      />
      <div className="mt-8">
        <CashflowCenter />
      </div>
      <NextSectionBanner
        href="/portfolios"
        label="Portfolios"
        description="Taxable accounts, IRAs, 401(k)s — with asset allocation and return assumptions"
      />
    </div>
  );
}
