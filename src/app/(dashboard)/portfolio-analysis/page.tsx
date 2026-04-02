import { PageHeader } from "@/components/layout/page-header";
import { NextSectionBanner } from "@/components/layout/next-section-banner";
import { PortfolioIntelligencePanel } from "@/components/portfolios/portfolio-intelligence-panel";
import { IncomeOpportunitiesPanel } from "@/components/portfolios/income-opportunities-panel";
import { HoldingRecommendationsPanel } from "@/components/portfolios/holding-recommendations-panel";
import { AgentAnalysisPanel } from "@/components/portfolios/agent-analysis-panel";
import { ResearchPanel } from "@/components/research/research-panel";

export default function PortfolioAnalysisPage() {
  return (
    <div>
      <PageHeader
        title="Portfolio Analysis"
        description="AI-powered intelligence, income opportunities, and holding recommendations for your investment portfolios"
      />

      {/* ── Portfolio Analysis panels ─────────────────────────────────────────── */}
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Portfolio Analysis</h2>
          <div className="flex-1 h-px bg-slate-100" />
        </div>
        <div className="space-y-6">
          <PortfolioIntelligencePanel />
          <IncomeOpportunitiesPanel />
        </div>
      </div>

      {/* ── AI Analysis panels ───────────────────────────────────────────────── */}
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">AI Analysis</h2>
          <div className="flex-1 h-px bg-slate-100" />
        </div>
        <div className="space-y-6">
          <HoldingRecommendationsPanel />
          <AgentAnalysisPanel />
        </div>
      </div>

      {/* ── Financial Research ───────────────────────────────────────────────── */}
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Financial Research</h2>
          <div className="flex-1 h-px bg-slate-100" />
        </div>
        <ResearchPanel />
      </div>

      <NextSectionBanner
        href="/estate"
        label="Estate Planning"
        description="Gross estate, tax liability, planning opportunities, and beneficiary allocations"
      />
    </div>
  );
}
