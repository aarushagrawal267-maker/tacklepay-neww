// Glue between Route Handlers and the TPI network: sessions, JSON bodies and the error shape
// `{ "error": { "code", "message" } }` that the app understands.
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { TPI_ERROR_COPY } from "@/lib/tpi";
import { tpi } from "./tpi";
import { TpiError } from "./tpi/db";
import { userForSession } from "./tpi/identity";
import { userById, type UserRow } from "./tpi/records";
import { snapshot } from "./tpi/wallet";

const SESSION_COOKIE = "tp_session";
const NO_STORE = { "Cache-Control": "no-store" };

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/**
 * True when another site may show the app in an iframe (TPI_FRAME_ANCESTORS, see next.config.ts), as the
 * Hugging Face Space page does for the public demo. Browsers never send a SameSite=Lax cookie inside a
 * cross-site iframe, so sign-in would not stick there; the session cookie is then SameSite=None,
 * https-only and Partitioned (kept separately for each embedding site). CSRF stays blocked by `readJson`.
 */
const embeddable = () => /(^|\s)https:\/\//.test(process.env.TPI_FRAME_ANCESTORS ?? "");

export async function setSession(req: NextRequest, token: string) {
  const embedded = embeddable();
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: embedded ? "none" : "lax",
    // Plain http on a LAN is fine for a demo; over https the cookie is https-only.
    secure: embedded || req.nextUrl.protocol === "https:",
    ...(embedded ? { partitioned: true } : {}),
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearSession() {
  const jar = await cookies();
  // A partitioned cookie is only removed by a Set-Cookie that is partitioned too.
  if (embeddable()) jar.delete({ name: SESSION_COOKIE, path: "/", httpOnly: true, sameSite: "none", secure: true, partitioned: true });
  else jar.delete(SESSION_COOKIE);
}

export async function requireUser(): Promise<UserRow> {
  const user = userForSession(tpi(), await sessionToken());
  if (!user) throw new TpiError("UNAUTHORIZED", 401);
  return user;
}

/** The person's books after a change, re-read so the revision is current. */
export function freshSnapshot(user: UserRow) {
  const t = tpi();
  return snapshot(t, userById(t, user.id)!);
}

/**
 * Reads a JSON body, and is also the CSRF guard: only a real `application/json` request gets through.
 * Another site can send that only after a CORS preflight, which this server never grants. Compare the
 * whole media type: a "contains" check would let through `text/plain; x=application/json`, which a
 * browser sends cross-site with no preflight.
 */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const type = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (type !== "application/json") throw new TpiError("BAD_REQUEST");
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new TpiError("BAD_REQUEST");
  return body as Record<string, unknown>;
}

export function str(body: Record<string, unknown>, key: string): string;
export function str(body: Record<string, unknown>, key: string, optional: true): string | undefined;
export function str(body: Record<string, unknown>, key: string, optional = false): string | undefined {
  const v = body[key];
  if (v === undefined || v === null || v === "") {
    if (optional) return undefined;
    throw new TpiError("BAD_REQUEST");
  }
  if (typeof v !== "string") throw new TpiError("BAD_REQUEST");
  return v;
}

export function int(body: Record<string, unknown>, key: string): number {
  const v = body[key];
  if (typeof v !== "number" || !Number.isSafeInteger(v)) throw new TpiError("INVALID_AMOUNT");
  return v;
}

export async function handle(fn: () => unknown): Promise<Response> {
  try {
    const out = await fn();
    return out instanceof Response ? out : NextResponse.json(out ?? { ok: true }, { headers: NO_STORE });
  } catch (err) {
    // Let Next.js's own control-flow errors through (e.g. the build stopping a prerender at `cookies()`).
    unstable_rethrow(err);
    if (err instanceof TpiError) {
      return NextResponse.json({ error: { code: err.code, message: TPI_ERROR_COPY[err.code] } }, { status: err.status, headers: NO_STORE });
    }
    console.error("[tpi]", err);
    return NextResponse.json({ error: { code: "INTERNAL", message: TPI_ERROR_COPY.INTERNAL } }, { status: 500, headers: NO_STORE });
  }
}
