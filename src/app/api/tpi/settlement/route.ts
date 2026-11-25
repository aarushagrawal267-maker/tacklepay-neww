import { handle, readJson, requireUser } from "@/server/http";
import { tpi } from "@/server/tpi";
import { networkView } from "@/server/tpi/network";
import { closeCycle, settlementView } from "@/server/tpi/settlement";

/** GET /api/tpi/settlement — closed cycles, payments waiting to settle and reconciliation exceptions. */
export async function GET() {
  return handle(async () => {
    await requireUser();
    return settlementView(tpi());
  });
}

/**
 * POST /api/tpi/settlement — close a settlement cycle now (plan §7, "on demand from the admin page").
 * Answers the new cycle and the refreshed network view, or 409 NOTHING_TO_SETTLE / RECON_MISMATCH.
 */
export async function POST(req: Request) {
  return handle(async () => {
    await requireUser();
    // JSON only, like every other POST, so a cross-site form can't close a cycle with someone's cookie.
    await readJson(req);
    const t = tpi();
    const cycle = closeCycle(t, "manual");
    return { cycle, network: networkView(t) };
  });
}
