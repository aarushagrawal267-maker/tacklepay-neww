// The running TPI network for this server process.
import path from "node:path";
import { openTpi, type Tpi } from "./db";
import { bootstrap } from "./network";
import { resumePending } from "./switch";

const g = globalThis as typeof globalThis & { __tpi?: Tpi };

/**
 * Opens `data/tpi.db` (or TPI_DB_PATH) once per process, registers the participants and shops,
 * and finishes any payment a restart interrupted. Balances survive restarts because they live in that file.
 */
export function tpi(): Tpi {
  if (!g.__tpi) {
    const t = openTpi(process.env.TPI_DB_PATH || path.join(process.cwd(), "data", "tpi.db"));
    bootstrap(t);
    resumePending(t);
    g.__tpi = t;
  }
  return g.__tpi;
}
