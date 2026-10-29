/* The configured encrypted cloud backup (owner decision D3; local-first L4 scaffold; calm R9 the optional account).
   Three gates, all closed in the default production build:
     1. FEATURES.cloudBackup — the build flag (lib/features.js, VITE_FEATURES); off by default;
     2. a server — hasServer() (VITE_API_BASE), and the backend's backup module listed in its config
        (config/app-dev.json lists it; config/app.json, production, does not);
     3. plan.can("cloudBackup") — the entitlement (lib/plan.js): Pro (and the proDev QA unlock), never the free plan.
   ACCOUNTS_HERE (gates 1 and 2) decides whether the account UI exists at all; while it is false nothing in the app
   mentions an account beyond "No account needed", and no account request is ever made. The transports themselves are
   fail-closed: every call rejects with code CLOUD_OFF before any request unless all three gates are open (the plan is
   passed in by App.jsx, which knows planFor()).
   cloudBackup (the L4 id + token transport) stays exported for the scaffold's tests; the app uses cloudAccounts. */
import { apiFetch, hasServer } from "./api.js";
import { FEATURES } from "./features.js";
import { can, PLAN } from "./plan.js";
import { cloudTransport } from "./backup.js";
import { accountTransport } from "./account.js";
import { accountsInBuild } from "./disclosures.js";

/** This build offers the optional account (the cloudBackup flag and a server). */
export const ACCOUNTS_HERE = accountsInBuild(FEATURES, hasServer());
export const cloudBackup = cloudTransport({ request: apiFetch, enabled: hasServer(), gate: () => FEATURES.cloudBackup && can("cloudBackup") });
/** The account transport for a plan (lib/plan.js planFor()). */
export const cloudAccountsFor = (plan = PLAN) => accountTransport({ request: apiFetch, enabled: ACCOUNTS_HERE, gate: () => FEATURES.cloudBackup && can("cloudBackup", plan) });
