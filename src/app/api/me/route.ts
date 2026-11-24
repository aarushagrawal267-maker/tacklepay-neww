import type { NextRequest } from "next/server";
import { freshSnapshot, handle, readJson, requireUser, str } from "@/server/http";
import { tpi } from "@/server/tpi";
import { rename, revOf, snapshot } from "@/server/tpi/wallet";

/**
 * GET /api/me?since=<rev> — the app's sync call. Answers `{ changed: false }` when nothing moved
 * since that revision, so phones can ask every couple of seconds without re-downloading everything.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const t = tpi();
    const rev = revOf(t, user);
    if (req.nextUrl.searchParams.get("since") === rev) return { changed: false, rev };
    return { changed: true, snapshot: snapshot(t, user) };
  });
}

/** PATCH /api/me { name } */
export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    rename(tpi(), user, str(await readJson(req), "name"));
    return { snapshot: freshSnapshot(user) };
  });
}
