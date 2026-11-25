import type { NextRequest } from "next/server";
import { clearSession, handle, readJson, sessionToken, setSession, str } from "@/server/http";
import { tpi } from "@/server/tpi";
import { TpiError } from "@/server/tpi/db";
import { signIn, signOut, signUp } from "@/server/tpi/identity";
import { snapshot } from "@/server/tpi/wallet";

/** POST /api/auth/signup { name, phone, pin } · /signin { phone, pin } · /signout */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/auth/[action]">) {
  return handle(async () => {
    const { action } = await ctx.params;
    const t = tpi();
    // Every POST must be JSON, signout included: another site can't send that without a CORS preflight,
    // which this server never grants, so a cross-site form can't sign someone out.
    const body = await readJson(req);
    if (action === "signout") {
      signOut(t, await sessionToken());
      await clearSession();
      return { ok: true };
    }
    let session;
    if (action === "signup") session = signUp(t, { name: str(body, "name"), phone: str(body, "phone"), pin: str(body, "pin") });
    else if (action === "signin") session = signIn(t, { phone: str(body, "phone"), pin: str(body, "pin") });
    else throw new TpiError("NOT_FOUND", 404);
    await setSession(req, session.token);
    return { snapshot: snapshot(t, session.user) };
  });
}
