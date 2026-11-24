import { handle, requireUser } from "@/server/http";
import { tpi } from "@/server/tpi";
import { networkView } from "@/server/tpi/network";

/** GET /api/tpi/network — the switch's console: participants, totals and recent payments with their trail. */
export async function GET() {
  return handle(async () => {
    await requireUser();
    return networkView(tpi());
  });
}
