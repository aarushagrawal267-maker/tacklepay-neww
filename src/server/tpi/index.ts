// The running TPI network for this server process.
import path from "node:path";
import { openTpi, type Tpi } from "./db";
import { bootstrap } from "./network";
import { settleIfDue } from "./settlement";
import { resumePending } from "./switch";

const g = globalThis as typeof globalThis & { __tpi?: Tpi; __tpiSettleTimer?: ReturnType<typeof setInterval> };

/** Longest delay a Node timer accepts (about 24.8 days). Anything longer fires after 1 ms instead. */
const MAX_TIMER_MIN = (2 ** 31 - 1) / 60_000;

/** Minutes between automatic settlement cycles (plan §7: hourly in the demo). `0` turns the timer off. */
function settleEveryMinutes(): number {
  const raw = process.env.TPI_SETTLE_EVERY_MIN;
  const n = raw === undefined || raw === "" ? 60 : Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_TIMER_MIN) : 0;
}

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
    // No timers while `next build` prerenders pages; only a running server settles.
    const minutes = settleEveryMinutes();
    if (minutes > 0 && process.env.NEXT_PHASE !== "phase-production-build" && !g.__tpiSettleTimer) {
      g.__tpiSettleTimer = setInterval(() => {
        const out = settleIfDue(t);
        if (typeof out !== "string") console.log(`[tpi] settlement cycle ${out.id} closed: ${out.txnCount} payments`);
        else if (out === "RECON_MISMATCH") console.warn("[tpi] settlement refused: reconciliation exceptions (see Settings → TPI network)");
      }, Math.floor(minutes * 60_000));
      g.__tpiSettleTimer.unref?.();
    }
  }
  return g.__tpi;
}
