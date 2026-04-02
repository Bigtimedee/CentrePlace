import { createTRPCRouter } from "../index";
import { profileRouter } from "./profile";
import { incomeRouter } from "./income";
import { carryRouter } from "./carry";
import { lpInvestmentsRouter } from "./lp-investments";
import { portfoliosRouter } from "./portfolios";
import { realEstateRouter } from "./real-estate";
import { insuranceRouter } from "./insurance";
import { expendituresRouter } from "./expenditures";
import { simulationRouter } from "./simulation";
import { estateRouter } from "./estate";
import { scenariosRouter } from "./scenarios";
import { taxRouter } from "./tax";
import { cashflowRouter } from "./cashflow";
import { planRouter } from "./plan";
import { realizationPolicyRouter } from "./realization-policy";
import { directInvestmentsRouter } from "./direct-investments";
import { cryptoRouter } from "./crypto";
import { equityCompensationRouter } from "./equity-compensation";
import { agentAnalysisRouter } from "./agent-analysis";
import { legislationRouter } from "./legislation";

export const appRouter = createTRPCRouter({
  profile: profileRouter,
  income: incomeRouter,
  carry: carryRouter,
  lpInvestments: lpInvestmentsRouter,
  portfolios: portfoliosRouter,
  realEstate: realEstateRouter,
  insurance: insuranceRouter,
  expenditures: expendituresRouter,
  simulation: simulationRouter,
  estate: estateRouter,
  scenarios: scenariosRouter,
  tax: taxRouter,
  cashflow: cashflowRouter,
  plan: planRouter,
  realizationPolicy: realizationPolicyRouter,
  directInvestments: directInvestmentsRouter,
  crypto: cryptoRouter,
  equityCompensation: equityCompensationRouter,
  agentAnalysis: agentAnalysisRouter,
  legislation: legislationRouter,
});

export type AppRouter = typeof appRouter;
