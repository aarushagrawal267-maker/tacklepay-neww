// TacketPay accounts: sign up, sign in, sessions and the demo PIN.
// The PIN is checked only here, by the payer's own participant — it never reaches the switch.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { MAX_BALANCE_PAISE } from "@/lib/money";
import { colorFor, DEMO_BANK, STARTING_BALANCE } from "@/lib/seed";
import { atomic, sql, TpiError, type Tpi } from "./db";
import { openAccount, post, systemAccount } from "./ledger";
import { insertActivity, userById, type UserRow } from "./records";

const PIN_RE = /^\d{4}$/;
const MAX_PIN_FAILS = 5;
const LOCK_MS = 5 * 60_000;
const MAX_LOCK_MS = 24 * 60 * 60_000;

/**
 * Every fifth wrong PIN in a row locks the PIN, and each lock lasts twice as long as the one before
 * (5 min, 10 min, 20 min ... up to 24 hours). A flat 5-minute lock would let anyone who knows a phone
 * number try about 1,440 PINs a day at sign-in and find a 4-digit PIN within days; this way it takes years.
 */
export function pinLockMs(fails: number): number {
  const locks = Math.floor(fails / MAX_PIN_FAILS);
  return locks < 1 ? 0 : Math.min(LOCK_MS * 2 ** Math.min(locks - 1, 20), MAX_LOCK_MS);
}
const WELCOME_CARDS = 3;

function hashPin(pin: string, salt: string): string {
  return scryptSync(pin, salt, 32).toString("hex");
}

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const ten = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(ten) ? ten : null;
}

export function formatPhone(digits: string): string {
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

function freeHandle(t: Tpi, name: string, phone: string): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 24) || "friend";
  const taken = (h: string) => !!sql(t, "SELECT 1 FROM users WHERE handle = ?").get(h);
  for (const candidate of [base, `${base}.${phone.slice(-4)}`, `${base}.${phone}`]) {
    if (!taken(`${candidate}@tpay`)) return `${candidate}@tpay`;
  }
  return `${base}.${t.id().slice(0, 6)}@tpay`;
}

/** Opens a TacketPay account: a wallet, ₹10,000 from the mint, a few scratch cards, and a session. */
export function signUp(t: Tpi, input: { name: string; phone: string; pin: string }): { user: UserRow; token: string } {
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 40);
  if (!name) throw new TpiError("NAME_REQUIRED");
  const phone = normalizePhone(input.phone);
  if (!phone) throw new TpiError("PHONE_INVALID");
  if (!PIN_RE.test(input.pin)) throw new TpiError("PIN_FORMAT");
  if (sql(t, "SELECT 1 FROM users WHERE phone = ?").get(phone)) throw new TpiError("PHONE_TAKEN", 409);

  const user = atomic(t, () => {
    const id = t.id();
    const salt = randomBytes(16).toString("hex");
    const handle = freeHandle(t, name, phone);
    sql(
      t,
      `INSERT INTO users (id, name, phone, handle, color, pin_hash, pin_salt, referral_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, name, phone, handle, colorFor(handle), hashPin(input.pin, salt), salt, t.id().slice(0, 6).toUpperCase(), t.now());
    const wallet = openAccount(t, {
      id: `tpay:w:${t.id()}`,
      participant: "tpay",
      kind: "wallet",
      owner: id,
      bank: DEMO_BANK,
      last4: phone.slice(-4),
      type: "Savings account",
      primary: true,
      cap: MAX_BALANCE_PAISE,
    });
    post(t, {
      participant: "tpay",
      kind: "welcome",
      memo: "Starting balance",
      lines: [
        { account: systemAccount("tpay", "mint"), amount: -STARTING_BALANCE },
        { account: wallet, amount: STARTING_BALANCE },
      ],
    });
    insertActivity(t, {
      userId: id,
      accountId: wallet,
      direction: "credit",
      amount: STARTING_BALANCE,
      method: "welcome",
      status: "success",
      counterpartyName: "TacketPay demo money",
      counterpartyHandle: "mint@tpay",
      note: "Starting balance — not real money",
      rrn: t.rrn(),
    });
    for (let i = 0; i < WELCOME_CARDS; i++) {
      const value = i === 1 ? null : (5 + Math.floor(t.random() * 26)) * 100;
      sql(t, "INSERT INTO rewards (id, user_id, amount, scratched, reason, at) VALUES (?, ?, ?, 0, ?, ?)").run(
        `r${t.id()}`,
        id,
        value,
        "Welcome to TacketPay",
        t.now(),
      );
    }
    return userById(t, id)!;
  });
  return { user, token: createSession(t, user.id) };
}

/** Throws PIN_LOCKED or PIN_INVALID. Five wrong PINs in a row lock it; see `pinLockMs` for how long. */
export function verifyPin(t: Tpi, user: UserRow, pin: string) {
  // Re-read the PIN state: `user` was loaded before the request body was awaited, so parallel requests
  // would all see the same old count and never reach the lockout. From here on this runs without yielding.
  const row = sql(t, "SELECT pin_hash, pin_salt, pin_fails, pin_locked_until FROM users WHERE id = ?").get(user.id) as
    | Pick<UserRow, "pin_hash" | "pin_salt" | "pin_fails" | "pin_locked_until">
    | undefined;
  if (!row) throw new TpiError("UNAUTHORIZED", 401);
  if (row.pin_locked_until > t.now()) throw new TpiError("PIN_LOCKED", 423);
  const expected = Buffer.from(row.pin_hash, "hex");
  const given = Buffer.from(hashPin(PIN_RE.test(pin) ? pin : "", row.pin_salt), "hex");
  if (PIN_RE.test(pin) && timingSafeEqual(expected, given)) {
    if (row.pin_fails) sql(t, "UPDATE users SET pin_fails = 0 WHERE id = ?").run(user.id);
    return;
  }
  // The count is kept across locks (only a correct PIN clears it), so each new lock is longer.
  const fails = row.pin_fails + 1;
  const lockMs = fails % MAX_PIN_FAILS === 0 ? pinLockMs(fails) : 0;
  sql(t, "UPDATE users SET pin_fails = ?, pin_locked_until = ? WHERE id = ?").run(fails, lockMs ? t.now() + lockMs : 0, user.id);
  throw new TpiError(lockMs ? "PIN_LOCKED" : "PIN_INVALID", lockMs ? 423 : 400);
}

export function signIn(t: Tpi, input: { phone: string; pin: string }): { user: UserRow; token: string } {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new TpiError("PHONE_INVALID");
  const user = sql(t, "SELECT * FROM users WHERE phone = ?").get(phone) as UserRow | undefined;
  if (!user) throw new TpiError("ACCOUNT_NOT_FOUND", 404);
  verifyPin(t, user, input.pin);
  return { user, token: createSession(t, user.id) };
}

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

function createSession(t: Tpi, userId: string): string {
  const token = randomBytes(32).toString("base64url");
  sql(t, "INSERT INTO sessions (token_hash, user_id, created_at, last_seen) VALUES (?, ?, ?, ?)").run(tokenHash(token), userId, t.now(), t.now());
  return token;
}

export function userForSession(t: Tpi, token: string | undefined): UserRow | undefined {
  if (!token) return undefined;
  const row = sql(t, "SELECT user_id FROM sessions WHERE token_hash = ?").get(tokenHash(token)) as { user_id: string } | undefined;
  return row ? userById(t, row.user_id) : undefined;
}

export function signOut(t: Tpi, token: string | undefined) {
  if (token) sql(t, "DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
}
