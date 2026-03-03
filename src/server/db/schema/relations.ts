import { relations } from "drizzle-orm";
import { userProfiles, children } from "./users";
import { incomeProfiles } from "./income";
import { expenditures, oneTimeExpenditures, plaidConnections } from "./expenditures";
import { investmentAccounts } from "./portfolios";
import { carryPositions } from "./carry";
import { lpInvestments } from "./lp-investments";
import { realEstateProperties, mortgages } from "./real-estate";
import { insurancePolicies } from "./insurance";

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
export const investmentAccountsRelations = relations(investmentAccounts, ({ one }) => ({
  user: one(userProfiles, {
    fields: [investmentAccounts.userId],
    references: [userProfiles.id],
  }),
}));

// ── carry ─────────────────────────────────────────────────────────────────────
export const carryPositionsRelations = relations(carryPositions, ({ one }) => ({
  user: one(userProfiles, {
    fields: [carryPositions.userId],
    references: [userProfiles.id],
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
