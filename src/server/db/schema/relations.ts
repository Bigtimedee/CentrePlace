import { relations } from "drizzle-orm";
import { userProfiles, children } from "./users";
import { incomeProfiles } from "./income";
import { expenditures, oneTimeExpenditures, plaidConnections } from "./expenditures";
import { investmentAccounts } from "./portfolios";
import { carryPositions, carryRealizations } from "./carry";
import { lpInvestments } from "./lp-investments";
import { realEstateProperties, mortgages } from "./real-estate";
import { insurancePolicies } from "./insurance";
import { realizationPolicy } from "./realization-policy";
import { accountStatements, accountHoldings } from "./holdings";
import { directInvestments } from "./direct-investments";

// ── userProfiles ─────────────────────────────────────────────────────────────
export const userProfilesRelations = relations(userProfiles, ({ many, one }) => ({
  children: many(children),
  incomeProfile: one(incomeProfiles, {
    fields: [userProfiles.id],
    references: [incomeProfiles.userId],
  }),
  expenditures: many(expenditures),
  oneTimeExpenditures: many(oneTimeExpenditures),
  plaidConnections: many(plaidConnections),
  investmentAccounts: many(investmentAccounts),
  carryPositions: many(carryPositions),
  lpInvestments: many(lpInvestments),
  realEstateProperties: many(realEstateProperties),
  insurancePolicies: many(insurancePolicies),
  realizationPolicy: one(realizationPolicy, {
    fields: [userProfiles.id],
    references: [realizationPolicy.userId],
  }),
  accountStatements: many(accountStatements),
  accountHoldings: many(accountHoldings),
  directInvestments: many(directInvestments),
}));

export const childrenRelations = relations(children, ({ one }) => ({
  user: one(userProfiles, {
    fields: [children.userId],
    references: [userProfiles.id],
  }),
}));

// ── incomeProfiles ────────────────────────────────────────────────────────────
export const incomeProfilesRelations = relations(incomeProfiles, ({ one }) => ({
  user: one(userProfiles, {
    fields: [incomeProfiles.userId],
    references: [userProfiles.id],
  }),
}));

// ── expenditures ──────────────────────────────────────────────────────────────
export const expendituresRelations = relations(expenditures, ({ one }) => ({
  user: one(userProfiles, {
    fields: [expenditures.userId],
    references: [userProfiles.id],
  }),
}));

export const oneTimeExpendituresRelations = relations(oneTimeExpenditures, ({ one }) => ({
  user: one(userProfiles, {
    fields: [oneTimeExpenditures.userId],
    references: [userProfiles.id],
  }),
}));

export const plaidConnectionsRelations = relations(plaidConnections, ({ one }) => ({
  user: one(userProfiles, {
    fields: [plaidConnections.userId],
    references: [userProfiles.id],
  }),
}));

// ── portfolios ────────────────────────────────────────────────────────────────
export const investmentAccountsRelations = relations(investmentAccounts, ({ one, many }) => ({
  user: one(userProfiles, {
    fields: [investmentAccounts.userId],
    references: [userProfiles.id],
  }),
  statements: many(accountStatements),
  holdings: many(accountHoldings),
}));

// ── holdings ──────────────────────────────────────────────────────────────────
export const accountStatementsRelations = relations(accountStatements, ({ one, many }) => ({
  user: one(userProfiles, {
    fields: [accountStatements.userId],
    references: [userProfiles.id],
  }),
  account: one(investmentAccounts, {
    fields: [accountStatements.accountId],
    references: [investmentAccounts.id],
  }),
  holdings: many(accountHoldings),
}));

export const accountHoldingsRelations = relations(accountHoldings, ({ one }) => ({
  statement: one(accountStatements, {
    fields: [accountHoldings.statementId],
    references: [accountStatements.id],
  }),
  user: one(userProfiles, {
    fields: [accountHoldings.userId],
    references: [userProfiles.id],
  }),
  account: one(investmentAccounts, {
    fields: [accountHoldings.accountId],
    references: [investmentAccounts.id],
  }),
}));

// ── carry ─────────────────────────────────────────────────────────────────────
export const carryPositionsRelations = relations(carryPositions, ({ one, many }) => ({
  user: one(userProfiles, {
    fields: [carryPositions.userId],
    references: [userProfiles.id],
  }),
  realizations: many(carryRealizations),
}));

export const carryRealizationsRelations = relations(carryRealizations, ({ one }) => ({
  carryPosition: one(carryPositions, {
    fields: [carryRealizations.carryPositionId],
    references: [carryPositions.id],
  }),
}));

// ── lp-investments ────────────────────────────────────────────────────────────
export const lpInvestmentsRelations = relations(lpInvestments, ({ one }) => ({
  user: one(userProfiles, {
    fields: [lpInvestments.userId],
    references: [userProfiles.id],
  }),
}));

// ── real-estate ───────────────────────────────────────────────────────────────
export const realEstatePropertiesRelations = relations(realEstateProperties, ({ one }) => ({
  user: one(userProfiles, {
    fields: [realEstateProperties.userId],
    references: [userProfiles.id],
  }),
  mortgage: one(mortgages, {
    fields: [realEstateProperties.id],
    references: [mortgages.propertyId],
  }),
}));

export const mortgagesRelations = relations(mortgages, ({ one }) => ({
  property: one(realEstateProperties, {
    fields: [mortgages.propertyId],
    references: [realEstateProperties.id],
  }),
}));

// ── insurance ─────────────────────────────────────────────────────────────────
export const insurancePoliciesRelations = relations(insurancePolicies, ({ one }) => ({
  user: one(userProfiles, {
    fields: [insurancePolicies.userId],
    references: [userProfiles.id],
  }),
}));

// ── realization policy ────────────────────────────────────────────────────────
export const realizationPolicyRelations = relations(realizationPolicy, ({ one }) => ({
  user: one(userProfiles, {
    fields: [realizationPolicy.userId],
    references: [userProfiles.id],
  }),
}));

// ── direct investments ────────────────────────────────────────────────────────
export const directInvestmentsRelations = relations(directInvestments, ({ one }) => ({
  user: one(userProfiles, {
    fields: [directInvestments.userId],
    references: [userProfiles.id],
  }),
  account: one(investmentAccounts, {
    fields: [directInvestments.accountId],
    references: [investmentAccounts.id],
  }),
}));
