// Shared filesystem locations for the admin backend.
//
// Plain .mjs (not .ts) on purpose: this file is imported both by the Astro/
// Vite app (src/server/**) and by standalone Node scripts under scripts/
// (db seeding, admin creation) that run outside Astro's build pipeline via
// plain `node scripts/*.mjs`. Keeping one untranspiled source of truth means
// the app and the CLI scripts can never disagree about where the database
// or uploads live.
import { fileURLToPath } from "node:url";
import path from "node:path";

// project root = two levels up from src/server/db/
const ROOT = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));

export const DATA_DIR = path.join(ROOT, "data");
export const DB_PATH = path.join(DATA_DIR, "freshpetals.sqlite");

export const UPLOADS_ROOT = path.join(ROOT, "uploads");
export const UPLOAD_FOLDERS = ["products", "categories", "hero", "occasions"];
