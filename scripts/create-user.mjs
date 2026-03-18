import { createClerkClient } from "@clerk/backend";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as readline from "readline/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const email = await rl.question("Email address: ");
const password = await rl.question("Password:       ");
await rl.close();

try {
  const user = await clerk.users.createUser({
    emailAddress: [email.trim()],
    password: password.trim(),
    skipPasswordChecks: false,
  });
  console.log(`\n✓ User created: ${user.id} (${email.trim()})`);
} catch (err) {
  const msg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? err?.message ?? String(err);
  console.error(`\n✗ Failed: ${msg}`);
  process.exit(1);
}
