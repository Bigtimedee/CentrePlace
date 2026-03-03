import { PageHeader } from "@/components/layout/page-header";
import { ForecastCenter } from "@/components/forecast/forecast-center";

export default function ForecastPage() {
  return (
    <div>
      <PageHeader
        title="Probability Forecast"
        description="500 Monte Carlo simulations show the range of FI outcomes under market uncertainty"
      />
      <div className="mt-8">
        <ForecastCenter />
      </div>
    </div>
  );
}
