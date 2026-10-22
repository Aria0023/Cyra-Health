/* The configured encrypted cloud backup (owner decision D3; local-first L4): the cloud transport from
   lib/backup.js, wired to Cyra's server through lib/api.js and behind three gates, all closed today:
     1. plan.can("cloudBackup") — the entitlement (lib/plan.js); false on the free plan, the only plan;
     2. FEATURES.cloudBackup — the build flag (lib/features.js, VITE_FEATURES); off by default;
     3. the backend's backup module listed in backend/config/app.json — not listed in production.
   It also needs a server at all (hasServer()). While any gate is closed every call rejects with
   code CLOUD_OFF before any request.

   Deliberately imported by NOTHING in this slice: there is no screen and no caller, so this file is
   tree-shaken out of every bundle. The first slice allowed to import it is the one that ships the
   cloud-backup UI, and that same commit must change the privacy sentences docs/PRIVACY-AUDIT.md lists
   under "Local-first L4" (the ones that say Cyra never receives the backup file), add the device-only
   key that keeps the backup's id and write token (proposed: cloudBackupRef, DEVICE_ONLY, never in a
   backup), and give the backup module persistent storage (docs/ARCHITECTURE.md). */
import { apiFetch, hasServer } from "./api.js";
import { FEATURES } from "./features.js";
import { can } from "./plan.js";
import { cloudTransport } from "./backup.js";

export const cloudBackup = cloudTransport({ request: apiFetch, enabled: hasServer(), gate: () => FEATURES.cloudBackup && can("cloudBackup") });
