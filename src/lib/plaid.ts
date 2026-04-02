import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const ALLOWED_PLAID_ENVS = ["sandbox", "development", "production"] as const;
type PlaidEnv = typeof ALLOWED_PLAID_ENVS[number];

const rawEnv = process.env.PLAID_ENV ?? "sandbox";
const env: PlaidEnv = (ALLOWED_PLAID_ENVS as readonly string[]).includes(rawEnv)
  ? (rawEnv as PlaidEnv)
  : "sandbox";

const clientId = process.env.PLAID_CLIENT_ID;
const secret = process.env.PLAID_SECRET;

if (!clientId || !secret) {
  throw new Error(
    "Missing required Plaid credentials: PLAID_CLIENT_ID and PLAID_SECRET must be set.",
  );
}

const config = new Configuration({
  basePath: PlaidEnvironments[env],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": clientId,
      "PLAID-SECRET": secret,
    },
  },
});

export const plaidClient = new PlaidApi(config);
