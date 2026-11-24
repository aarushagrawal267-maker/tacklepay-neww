import { NextResponse } from "next/server";
import { connection } from "next/server";
import { tpi } from "@/server/tpi";
import { ledgerSum } from "@/server/tpi/ledger";

/**
 * GET /api/healthz — liveness for a host's health check (plan §11). Opens the TPI database and checks that
 * the books still sum to zero. 200 when healthy, 503 otherwise. Shares no personal data.
 */
export async function GET() {
  await connection();
  try {
    const sum = ledgerSum(tpi());
    const ok = sum === 0;
    return NextResponse.json({ ok, db: "ok", booksBalanced: ok, livemode: false }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[healthz]", err);
    return NextResponse.json({ ok: false, db: "error", livemode: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
