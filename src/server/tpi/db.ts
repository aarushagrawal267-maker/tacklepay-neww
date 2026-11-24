// Storage for the TPI network. One SQLite file holds every participant's books and the
// switch's transaction log, partitioned by participant the way separate banks would be.
// Node's built-in SQLite is synchronous, so each step below is atomic inside this process,
// and `BEGIN IMMEDIATE` keeps it atomic across processes too.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import { randomBytes, randomInt } from "node:crypto";
import type { TpiErrorCode } from "@/lib/tpi";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  handle TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  pin_fails INTEGER NOT NULL DEFAULT 0,
  pin_locked_until INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT NOT NULL,
  rev INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS merchants (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  icon TEXT,
  color TEXT NOT NULL,
  subtitle TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

-- Double-entry ledgers. System accounts (mint, clearing) may go negative; nothing else can.
CREATE TABLE IF NOT EXISTS ledger_accounts (
  id TEXT PRIMARY KEY,
  participant TEXT NOT NULL,
  kind TEXT NOT NULL,
  owner TEXT,
  bank TEXT,
  last4 TEXT,
  acct_type TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  balance INTEGER NOT NULL DEFAULT 0,
  cap INTEGER,
  system INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  CHECK (system = 1 OR balance >= 0)
);
CREATE INDEX IF NOT EXISTS ledger_accounts_owner ON ledger_accounts(participant, owner);
CREATE TABLE IF NOT EXISTS journals (
  id TEXT PRIMARY KEY,
  participant TEXT NOT NULL,
  txn_id TEXT,
  kind TEXT NOT NULL,
  memo TEXT,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS journals_txn ON journals(txn_id);
CREATE TABLE IF NOT EXISTS postings (
  journal_id TEXT NOT NULL REFERENCES journals(id),
  account_id TEXT NOT NULL REFERENCES ledger_accounts(id),
  amount INTEGER NOT NULL
);
-- Idempotency: each participant handles a (txn, message type) at most once and replays the stored answer.
CREATE TABLE IF NOT EXISTS participant_msgs (
  participant TEXT NOT NULL,
  txn_id TEXT NOT NULL,
  msg_type TEXT NOT NULL,
  ok INTEGER NOT NULL,
  code TEXT,
  at INTEGER NOT NULL,
  PRIMARY KEY (participant, txn_id, msg_type)
);

-- The switch's write-ahead transaction log.
CREATE TABLE IF NOT EXISTS tpi_txns (
  txn_id TEXT PRIMARY KEY,
  rrn TEXT NOT NULL UNIQUE,
  payer_handle TEXT NOT NULL,
  payer_name TEXT NOT NULL,
  payer_pid TEXT NOT NULL,
  payer_account TEXT NOT NULL,
  payee_handle TEXT NOT NULL,
  payee_hint TEXT,
  payee_name TEXT,
  payee_pid TEXT,
  amount INTEGER NOT NULL,
  note TEXT,
  method TEXT NOT NULL,
  ref_type TEXT,
  ref_id TEXT,
  state TEXT NOT NULL,
  failure_code TEXT,
  idem_key TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tpi_txns_state ON tpi_txns(state);
CREATE TABLE IF NOT EXISTS tpi_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  txn_id TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT NOT NULL,
  msg TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tpi_events_txn ON tpi_events(txn_id);

-- TacketPay app data (the "pay-api" side): history rows, chats, requests, rewards, linked bills.
CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL,
  counterparty_name TEXT NOT NULL,
  counterparty_handle TEXT NOT NULL,
  counterparty_id TEXT,
  note TEXT,
  txn_id TEXT,
  rrn TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS activity_user ON activity(user_id, at);
CREATE INDEX IF NOT EXISTS activity_txn ON activity(txn_id);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  from_handle TEXT NOT NULL,
  to_handle TEXT NOT NULL,
  kind TEXT NOT NULL,
  text TEXT,
  amount INTEGER,
  note TEXT,
  status TEXT,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_from ON messages(from_handle);
CREATE INDEX IF NOT EXISTS messages_to ON messages(to_handle);
CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER,
  scratched INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS linked_bills (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  label TEXT,
  due_amount INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  label TEXT NOT NULL,
  last4 TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;

export class TpiError extends Error {
  constructor(
    readonly code: TpiErrorCode,
    readonly status = 400,
  ) {
    super(code);
  }
}

/** The database plus clock and randomness, injected so tests can pin them down. */
export interface Tpi {
  db: DatabaseSync;
  now: () => number;
  /** Random id for rows: 12 chars of [a-z0-9]. */
  id: () => string;
  /** 12-digit retrieval reference number, like a UPI RRN. */
  rrn: () => string;
  /** Uniform in [0, 1). */
  random: () => number;
  statements: Map<string, StatementSync>;
}

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

function randomId(): string {
  const bytes = randomBytes(12);
  let out = "";
  for (const b of bytes) out += ID_ALPHABET[b % ID_ALPHABET.length];
  return out;
}

function randomRrn(): string {
  let out = String(randomInt(1, 10));
  for (let i = 0; i < 11; i++) out += String(randomInt(0, 10));
  return out;
}

export function openTpi(file: string, overrides: Partial<Omit<Tpi, "db" | "statements">> = {}): Tpi {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  return {
    db,
    now: Date.now,
    id: randomId,
    rrn: randomRrn,
    random: Math.random,
    statements: new Map(),
    ...overrides,
  };
}

/** Prepared statements are cached per database. */
export function sql(t: Tpi, text: string): StatementSync {
  let stmt = t.statements.get(text);
  if (!stmt) {
    stmt = t.db.prepare(text);
    t.statements.set(text, stmt);
  }
  return stmt;
}

let savepoints = 0;

/** Runs `fn` atomically. Inside another transaction it uses a savepoint, so a failure undoes only its own writes. */
export function atomic<T>(t: Tpi, fn: () => T): T {
  const nested = t.db.isTransaction;
  const sp = `sp${++savepoints}`;
  t.db.exec(nested ? `SAVEPOINT ${sp}` : "BEGIN IMMEDIATE");
  try {
    const out = fn();
    t.db.exec(nested ? `RELEASE ${sp}` : "COMMIT");
    return out;
  } catch (err) {
    t.db.exec(nested ? `ROLLBACK TO ${sp}; RELEASE ${sp}` : "ROLLBACK");
    throw err;
  }
}

/** Marks a person's data as changed so their open apps pick it up on the next sync. */
export function touch(t: Tpi, userId: string) {
  sql(t, "UPDATE users SET rev = rev + 1 WHERE id = ?").run(userId);
}
