# TPI: Tacket Payment Interface (plan)

> Status: **core built, in one process.** `src/server/tpi` has the switch state machine (write-ahead log,
> reversal, resume after restart), three participants with double-entry ledgers and clearing accounts
> (TacketPay `@tpay`, Tacket `@tacket` shops, and a Demo Bank Network for bank transfers), idempotent
> handlers, demo-PIN accounts, collect requests, an operator view at `/tpi`, and settlement cycles with
> reconciliation (§7: on demand or hourly, zero-sum rule, recon exceptions; `src/server/tpi/settlement.ts`),
> the §11 limits (per payment, per wallet and a daily top-up cap) and `/api/healthz`.
> It uses one SQLite file. **Not built yet:** separate services and databases (§8), signed messages (§4, §11),
> DEEMED/ChkTxn timeouts, signed settlement reports, and the Tacket repo's participant.
> TPI is a UPI-style payment network for **demo money**. It moves money between independent systems that
> each keep their own books, starting with two: **TacketPay** (customer wallets, this repo) and **Tacket**
> (shops and their agents, a separate repo). When a TacketPay user pays a Tacket shop, TacketPay's ledger
> goes down, Tacket's ledger goes up, and both agree on what happened, exactly once.

---

## 1. The problem TPI solves

Today the TacketPay app keeps balances on the phone. Tacket, the shop platform, needs to receive payments
for bills, udhaar and supplier dues. The two are **separate systems with separate databases**. That's the
same situation as two banks:

- A payment must **debit** the payer's system and **credit** the payee's system.
- If the credit fails after the debit succeeded, the debit must be **reversed** automatically.
- If a system is slow or down, the payment must end in a **known state**: never "money left but didn't arrive".
- Both systems must be able to **reconcile** against a neutral record.
- More participants can join later (a supplier app, another wallet) without changing the existing ones.

UPI solves this with **NPCI**, a central switch between banks and payment apps. TPI is our NPCI-shaped switch
for demo money.

```
      TacketPay app                                                 Tacket (shop app + agents)
     (payer, @tpay)                                                     (payee, @tacket)
           │                                                                    ▲
           ▼                                                                    │
  ┌──────────────────┐   ReqPay    ┌───────────────────────┐   Credit    ┌──────┴───────────┐
  │  TacketPay PSP    │───────────►│      TPI switch        │────────────►│ Tacket participant│
  │  (pay-api)        │◄───────────│  directory · routing   │◄────────────│ (in Tacket repo)  │
  │  wallet ledger    │   Debit    │  txn state · reversal  │   ValAdd    │  shop ledger      │
  └──────────────────┘   Reversal  │  settlement · recon    │             └──────────────────┘
                                   └───────────────────────┘
        own Postgres                      own Postgres                          own Postgres
```

---

## 2. Roles (UPI → TPI)

| UPI | TPI | Who plays it |
|---|---|---|
| NPCI (switch) | **TPI switch** | New service in this repo: `apps/tpi-switch` |
| Bank / PSP (issuer + app provider) | **Participant** | Any system that holds balances and speaks the TPI protocol |
| PSP app | **Front-end app** | TacketPay app (customers), Tacket app (shop owners) |
| VPA `name@okaxis` | **Handle** `name@tpay`, `shop@tacket` | The part after `@` says which participant owns it |
| UPI PIN (verified by issuer) | **Demo PIN** | Verified by the **payer's participant** before it asks to be debited |
| RRN / UTR | `rrn` (12 digits), `txnId` | Minted by the switch, shown on both sides' receipts |
| Settlement through RBI accounts | **Net settlement** | The switch nets what participants owe each other per cycle (§7) |
| UPI QR (`upi://pay`) | **TPI QR** (`tpi://pay` inside an https link) | Never `upi://`, so real UPI apps can't try to pay demo codes |

**Initial participants:**

| Participant | Handle suffix | Ledger holds | Lives in |
|---|---|---|---|
| **TacketPay** | `@tpay` | Customer wallets (demo money, Add money) | This repo: `apps/pay-api` |
| **Tacket** | `@tacket` | Shop balances (money received from bills and udhaar, paid to suppliers) | Tacket repo, via `@tacket/tpi-participant` |

*Change from today's app:* customer handles move from `name@tacket` to `name@tpay`. `@tacket` now means "a
shop on Tacket". The QR parser accepts both during the migration.

---

## 3. A payment, step by step

**Priya (TacketPay) scans Mehta Store's bill QR (Tacket) and pays ₹340.**

```
TacketPay app        TacketPay PSP           TPI switch                Tacket participant
     │  scan QR            │                       │                            │
     │  enter PIN ────────►│ verify PIN            │                            │
     │                     │── ReqPay ────────────►│ txn INITIATED, mint rrn    │
     │                     │                       │── ValAdd mehta@tacket ────►│ "Mehta Store", open
     │                     │                       │◄─────────── OK ────────────│
     │                     │◄── Debit ─────────────│ DEBIT_PENDING              │
     │                     │ wallet −34000 (hold)  │                            │
     │                     │──── Debited ─────────►│ DEBITED                    │
     │                     │                       │── Credit (ref bill#2261) ─►│ shop +34000,
     │                     │                       │                            │ bill #2261 paid
     │                     │                       │◄────────── Credited ───────│
     │                     │◄── Final: SUCCESS ────│ SUCCESS ───── Final ──────►│ emits payment_received
     │◄── receipt ─────────│                       │                            │ → Money agent
```

**When something goes wrong:**

| What fails | Switch does | End state for the user |
|---|---|---|
| Payee handle unknown or blocked (ValAdd) | Stops before any debit | "Couldn't find mehta@tacket", nothing debited |
| Payer debit fails (no balance, bad PIN, limit) | Stops | Failed, nothing moved |
| Credit fails after debit | Sends **Reversal** to the payer participant | Failed, money back in the wallet within seconds, with a "Reversed" receipt |
| Credit times out (payee slow or down) | Marks **DEEMED**; a status-check job asks the payee until it knows | "Pending": resolves to success, or to reversal, usually within minutes |
| Payer participant doesn't answer the Debit | Marks **DEEMED**; asks the payer for status | Same as above |

**Rule:** every step is written to the switch's database *before* the next call goes out. Every
participant call is **idempotent by `txnId`**: repeating a Debit, Credit or Reversal never applies it twice.
A crash at any point can therefore be resumed safely.

### Switch transaction states

```
INITIATED ─► VALIDATED ─► DEBIT_PENDING ─► DEBITED ─► CREDIT_PENDING ─► SUCCESS
     │             │              │                           │
     └─► FAILED ◄──┴──────────────┘                           ├─► REVERSAL_PENDING ─► REVERSED (final: failed)
                                                              └─► DEEMED ─(status check)─► SUCCESS | REVERSAL_PENDING
```

---

## 4. The TPI protocol

JSON over HTTPS. Every message is **signed** and has a stable `txnId` (one per payment) and a `msgId`
(one per message, for replay protection).

```json
{
  "msgId": "01J…", "txnId": "TPI-01J…", "type": "Credit", "ts": "2026-10-26T09:41:07Z",
  "from": "tpi-switch", "to": "tacket", "livemode": false,
  "body": { "payee": "mehta@tacket", "amount": 34000, "currency": "INR",
            "rrn": "604321987654", "ref": { "type": "bill", "id": "2261" }, "note": "Bill #2261" }
}
```

- **Signing.** Each participant and the switch have an Ed25519 key pair. Messages carry a detached JWS
  signature header. The switch's directory holds participants' public keys. Messages more than 2 minutes
  old, or with a seen `msgId`, are rejected.
- **Transport.** HTTPS only. Optional mTLS later. Each participant registers one base URL.

| Message | Direction | Purpose | Participant must… |
|---|---|---|---|
| `ValAdd` | switch → payee | Validate a handle; return the display name | Answer from its handle table |
| `ReqPay` | payer → switch | Start a payment (`type: PAY` or `COLLECT`) | Have verified the payer's PIN first |
| `Debit` | switch → payer | Take money from the payer | Debit idempotently by `txnId`; return final debited/failed |
| `Credit` | switch → payee | Give money to the payee, with `ref` | Credit idempotently; match `ref` (bill/udhaar) |
| `Reversal` | switch → payer | Undo a debit whose credit failed | Reverse idempotently; never fail if the debit exists |
| `ChkTxn` | either way | "What happened to this txnId?" | Return its local state for that `txnId` |
| `Final` | switch → both | Final outcome notification | Update receipts; emit app events or webhooks |
| `Collect` | switch → payer participant | A payee asks a payer to pay | Show the request in the payer's app; approval starts a `ReqPay` |
| `Refund` | payee → switch | New payment in reverse, linked to the original `rrn` | Same flow, roles swapped |
| `Heartbeat` | switch → participant | Liveness; used to fail fast instead of timing out | Respond 200 |

**Timeouts.** ValAdd 2s, Debit 5s, Credit 5s, Reversal 5s with retries for up to 24h (a reversal must
eventually land). The ChkTxn job retries DEEMED transactions at 30s, 2m, 10m and 1h, then flags them for an
operator.

**Error codes** (shared enum in `tpi-protocol`): `HANDLE_NOT_FOUND`, `HANDLE_BLOCKED`, `INSUFFICIENT_FUNDS`,
`PIN_INVALID`, `LIMIT_EXCEEDED`, `DUPLICATE_TXN`, `PARTICIPANT_DOWN`, `TIMEOUT`, `REF_NOT_PAYABLE` (bill
already paid or cancelled), `AMOUNT_MISMATCH` (QR amount ≠ paid amount).

---

## 5. QR codes and links

A TPI QR always points at the **payee's** handle. A bill QR also carries a reference, so matching is
exact.

```
https://pay.tacket.app/q?d=tpi%3A%2F%2Fpay%3Fpa%3Dmehta%40tacket%26pn%3DMehta%2BStore%26am%3D340.00%26tr%3Dbill-2261%26tn%3DBill%2B%232261
                         └── tpi://pay?pa=mehta@tacket&pn=Mehta+Store&am=340.00&tr=bill-2261&tn=Bill+#2261
```

- `pa` = payee handle, `pn` = name, `am` = amount (optional for counter QR codes), `tr` = payee's reference
  (bill, udhaar or intent), `tn` = note. The names mirror UPI's.
- The **https wrapper** means any phone camera opens a pay page. The TacketPay app also reads the inner
  `tpi://` form directly.
- **Who generates it:** the payee's participant. Tacket generates bill and udhaar QR codes; TacketPay
  generates "My QR" for people. `tpi-protocol` has the one shared builder and parser.
- The `tr` reference is echoed back to the payee in `Credit.body.ref`. The Money agent marks the bill paid
  without guessing. Counter QR codes without `tr` fall back to code-first matching, then Jev, then owner
  approval (Tacket's trust rules).

---

## 6. Inside each participant (ledgers)

Each participant keeps a **double-entry ledger in paise** with a **TPI clearing account**. That's how it
records money that left for, or arrived from, the network before settlement.

**TacketPay (payer) on Debit ₹340:**
```
priya wallet          −34000
TPI clearing (owed)   +34000      ← TacketPay owes the network ₹340 until settlement
```

**Tacket (payee) on Credit ₹340:**
```
TPI clearing (due)    −34000      ← the network owes Tacket ₹340 until settlement
mehta shop balance    +34000
```

**Reversal** posts the mirror of the Debit. **Settlement** (§7) zeroes the clearing accounts.

**Rules every participant follows** (enforced by the conformance tests in `tpi-participant`):

1. Postings are append-only and every journal sums to zero.
2. Each `txnId` is processed at most once per message type. A replay returns the stored result.
3. Balances never go negative (row lock + check constraint).
4. `ChkTxn` always answers from the participant's own durable state.
5. A Reversal for a known Debit always succeeds.

**Demo money origin.** Only TacketPay's "Add money" creates money, from its own **mint** account. Tacket
shops get money only by being paid. So all money on the network is traceable to TacketPay's mint.

---

## 7. Settlement and reconciliation

- **Cycles.** The switch closes a settlement cycle every hour in demo (daily in a real system). For each
  participant it computes a **net position**: credits received minus debits sent, over SUCCESS and REVERSED
  transactions in the cycle.
- **Settlement report.** Each participant downloads (or receives by webhook) a signed report:
  `cycleId, participant, net, txnCount, list of txnIds`. It posts a settlement journal that moves its
  clearing account to its **settlement account with TPI**.
- **Invariant:** the sum of all participants' net positions in a cycle is **exactly zero**. The switch
  refuses to close a cycle otherwise.
- **Recon.** Each participant compares the report with its own records. Any `txnId` missing on either side,
  or with a different amount or state, becomes a recon exception. The participant resolves it with
  `ChkTxn`. Exceptions show on the switch's admin page and in the Briefer's morning call.
- **Demo money stays demo.** Settlement is bookkeeping only. No bank is involved.

---

## 8. Repos and folder structure

**This repo becomes the TPI network repo:** the switch, the TacketPay participant and app, and the shared
protocol packages. **The Tacket repo stays separate.** It becomes a participant by installing one package.

```
tacketpay/                              ← this repo
├─ apps/
│  ├─ tpi-switch/                       ← NEW: the network (Fastify + TS)
│  │  └─ src/modules/
│  │     ├─ directory/                  participants, handle suffixes, public keys, base URLs, status
│  │     ├─ txns/                       ReqPay intake, state machine, orchestrator (write-ahead)
│  │     ├─ outbound/                   signed calls to participants, timeouts, retries
│  │     ├─ chktxn/                     DEEMED resolver job
│  │     ├─ settlement/                 cycles, net positions, signed reports
│  │     └─ admin/                      read-only console: live txns, exceptions, participant health
│  ├─ pay-api/                          ← NEW: TacketPay participant + app backend
│  │  └─ src/modules/
│  │     ├─ identity/                   users, sessions, demo PIN
│  │     ├─ handles/                    @tpay handles
│  │     ├─ ledger/                     wallets, mint, TPI clearing, settlement account
│  │     ├─ participant/                TPI handlers (Debit/Credit/Reversal/ChkTxn/ValAdd/Collect/Final), via tpi-participant
│  │     ├─ payments/                   app-facing pay/request/refund → ReqPay
│  │     └─ topups/                     Add money from the mint
│  └─ pay-web/                          ← today's Next.js app, moved; talks to pay-api
│     └─ src/{app, features/<feature>, shared}
├─ packages/
│  ├─ tpi-protocol/                     ← PUBLISHED: Zod message schemas, error codes, state machine,
│  │                                       QR builder/parser, JWS sign/verify. The contract.
│  ├─ tpi-participant/                  ← PUBLISHED: kit to become a participant (Fastify plugin or
│  │                                       framework-agnostic handlers, idempotency store interface,
│  │                                       conformance test suite, fake switch for local tests)
│  ├─ pay-core/                         money maths and limits (from today's src/lib), shared by pay-api + pay-web
│  ├─ ui/                               Tacket design tokens + components
│  └─ config/                           tsconfig / eslint / vitest presets
├─ infra/
│  └─ docker-compose.yml                Postgres ×2 (switch, pay-api), switch, pay-api, a "sample participant"
└─ docs/                                this plan, protocol reference (generated from tpi-protocol), DESIGN.md
```

**In the Tacket repo** (separate, not built here):

```
tacket/ (their repo)
└─ src/modules/tpi/                     uses @tacket/tpi-participant
   ├─ handlers.ts                       ValAdd: shop handles · Credit: shop ledger + match ref → payment_received
   │                                     Debit/Reversal: supplier payments · ChkTxn · Final
   ├─ ledger/                           shop balances, TPI clearing, settlement account
   └─ qr.ts                             bill/udhaar QR via tpi-protocol builder (pa=shop@tacket, tr=bill-…)
```

**Why this split:**

- **Separation like real banks.** Each participant owns its ledger and database; the switch owns only the
  transaction record. No system can change another's balances.
- **One contract.** `tpi-protocol` is the only thing both repos must agree on. It's versioned with semver
  and Changesets and published to GitHub Packages.
- **Easy onboarding.** `tpi-participant` turns "become a participant" into implementing six handlers
  against your own ledger, then running the conformance suite. It's the same path for a future supplier
  app.
- **Feature folders in the app.** Each feature's UI and hooks live together, instead of routes and
  components being spread across `src/app` and `src/components`.

### Move map for today's code (phase 0, no behaviour change)

| Today | Moves to |
|---|---|
| `src/app/**` | `apps/pay-web/src/app/**` |
| `src/components/<feature>` | `apps/pay-web/src/features/<feature>` (`addmoney` → `add-money`, `promos` → `rewards`) |
| `src/components/app/*` | `apps/pay-web/src/shared/app/` |
| `src/components/ui/*`, `scripts/build-icons.mjs` | `packages/ui/` |
| `src/lib/qr.ts` | `packages/tpi-protocol/src/qr.ts` (gains `tpi://` and `tr`) |
| `src/lib/money.ts`, `format.ts`, `ids.ts`, `rem.ts`, pure rules from `actions.ts` | `packages/pay-core/src/` |
| `src/lib/store.ts`, `hooks.ts`, `nav.ts`, `seed.ts`, `types.ts` | `apps/pay-web/src/shared/` |
| `src/lib/__tests__/*` | `packages/pay-core/test/` and `packages/tpi-protocol/test/` |

**Deploy note:** set the Vercel project's **Root Directory** to `apps/pay-web` in the same change.

---

## 9. Data each service keeps

**tpi-switch** (its own Postgres):
```
participants(id, name, handle_suffixes[], base_url, public_key, status, created_at)
txns(txn_id PK, rrn UNIQUE, type: PAY|COLLECT|REFUND, payer_handle, payee_handle, payer_pid, payee_pid,
     amount, ref JSONB, note, state, failure_code, original_rrn, created_at, updated_at)
txn_events(id, txn_id, from_state, to_state, message_type, msg_id, request JSONB, response JSONB, at)  -- full audit trail
seen_messages(msg_id PK, participant_id, at)          -- replay protection, 24h retention
settlement_cycles(id, opened_at, closed_at, status)
settlement_positions(cycle_id, participant_id, net BIGINT, txn_count)   -- SUM(net) = 0 per cycle
```

**pay-api (TacketPay participant)** (its own Postgres):
```
users, devices(pin_hash argon2id), sessions, handles(@tpay)
accounts(kind: wallet|mint|tpi_clearing|tpi_settlement), balances, journals, postings   -- double entry
participant_txns(txn_id PK, msg_type, state, journal_id, response JSONB)   -- idempotency for TPI handlers
requests (incoming Collect), receipts, audit_log
```

**Tacket participant** (in the Tacket repo's database; same shape): shop accounts, `tpi_clearing`,
`tpi_settlement`, `participant_txns`, and links from credits to bills and udhaar.

All money is `BIGINT` paise. Every row has `livemode=false` until real money exists (§12).

---

## 10. App-facing APIs (unchanged idea, now on top of TPI)

**TacketPay app → pay-api** (`/v1`, Zod-validated, `Idempotency-Key` on every POST, standard error shape
`{ "error": { "code", "message", "details" } }`):

| Endpoint | Does |
|---|---|
| `POST /v1/auth/otp`, `/verify` · `POST /v1/devices/pin` | Demo login and PIN |
| `GET /v1/me`, `/accounts`, `/transactions` | Wallet, balances, history (including pending and reversed) |
| `POST /v1/topups` | Add money from the mint (daily cap) |
| `GET /v1/resolve?handle=` | Proxied `ValAdd`: "Mehta Store ✓" before paying |
| `POST /v1/payments` | Verify PIN → `ReqPay` → poll or stream status → receipt |
| `GET /v1/requests` · `POST /v1/requests/{id}/approve | decline` | Incoming collect requests (udhaar reminders) |
| `POST /v1/requests` | A person asks another person (outgoing Collect) |

**Tacket agents → Tacket's own participant module** (inside the Tacket repo, using the kit):

| Agent tool | Does | Guardrail |
|---|---|---|
| `create_bill_qr(bill)` | Builds a TPI QR with `tr=bill-…` | Own shop only |
| `send_payment_request(customer, udhaar)` | `Collect` to the customer's handle | Rate-limited reminders |
| `pay_supplier(bill)` | `ReqPay` from the shop balance | Owner approval over the limit |
| `refund(rrn, amount)` | `Refund` | Always `approval_needed` above the owner's limit |
| `payment_status(rrn)` | `ChkTxn` | Read-only |

A successful `Credit` emits Tacket's existing `payment_received` event, with the bill or udhaar reference
already attached.

---

## 11. Security

- **Network level:** signed messages (Ed25519 JWS), timestamp and `msgId` replay checks, per-participant
  allowlist in the directory, HTTPS only. The switch accepts `ReqPay` only from the payer's own participant.
- **PIN:** verified only by the payer's participant (argon2id hash), never sent to the switch, never logged.
  The "never type your real UPI PIN" copy stays.
- **Money safety:** write-ahead state in the switch, idempotent participant handlers, row locks and
  non-negative balance constraints, the settlement zero-sum check, and per-participant recon.
- **Limits:** ₹1,00,000 per payment, ₹10,00,000 per wallet balance, a daily top-up cap, and per-shop owner
  approval limits. These are enforced by the participant that owns the account, not just the app.
- **Rate limits:** OTP, PIN attempts (lock after 5), ValAdd (stops handle enumeration), ReqPay per payer.
- **Demo guardrails:** `livemode:false` on every message and row, no `upi://` codes, real UPI codes refused,
  watermarked receipts.
- **Observability:** structured logs keyed by `txnId`/`rrn`, and switch metrics (success rate, p95 latency
  per hop, DEEMED count, reversal count, recon exceptions), `/healthz`, and participant heartbeats.

---

## 12. Real money later

TPI is a **closed demo network**. Running a real-money version of it would make Tacket a payment system
operator. That needs RBI authorisation (for example a PPI licence for wallets) and is out of scope. The
realistic path to real money:

- **Tacket (payee) side:** accept real UPI through a licensed Payment Aggregator (Razorpay, Cashfree, PhonePe
  PG). Bill QR codes become genuine `upi://` codes for the shop's merchant VPA.
- **Keep TPI as the integration shape:** the gateway is wrapped as a **"gateway participant"**. It turns the
  gateway's webhooks into TPI `Credit` / `Final` messages, so the Tacket repo's handlers, matching and agents
  don't change.
- **TacketPay wallets** stay demo-only, unless a licensing decision is made.

---

## 13. Phased delivery

| Phase | Scope | Done when |
|---|---|---|
| **0. Restructure** (½ day) | Monorepo move (§8), packages extracted, Vercel root dir | App deploys unchanged; tests and e2e green |
| **1. Protocol + switch** (4–5 days) | `tpi-protocol`, `tpi-switch` (directory, txn state machine, Debit/Credit/Reversal/ChkTxn, DEEMED job), `tpi-participant` kit + conformance suite + two in-memory sample participants | Conformance suite passes; chaos tests (kill a participant mid-payment) always end in SUCCESS or REVERSED, never lost money |
| **2. TacketPay participant** (3–4 days) | `pay-api`: auth, PIN, `@tpay` handles, ledger + mint + clearing, handlers, app endpoints; `pay-web` moves from localStorage to the API | Two phones pay each other through the switch; balances survive reloads and devices |
| **3. Tacket participant** (3 days, Tacket repo) | Install kit, shop ledger, handlers, bill QR with `tr`, `payment_received` wiring | ★ Demo: voice bill → QR → Priya pays in TacketPay → bill marked paid in Tacket → receipt message, in under 10s |
| **4. Collect, refunds, settlement** (3 days) | Collect requests (udhaar reminders), refunds, hourly settlement cycles, recon reports, switch admin console | Settlement nets to zero every cycle; a planted mismatch shows up as a recon exception |
| **5. Real money** (later) | Gateway participant (§12) | After licensing and compliance decisions |

---

## 14. Testing

- **Protocol:** schema round-trips, signature verification, replay rejection, QR build/parse (today's QR
  tests move here).
- **Conformance suite** (in `tpi-participant`): every participant must pass idempotent replays of every
  message, Reversal-after-Debit, ChkTxn for every state, no negative balances and zero-sum journals.
  The Tacket repo runs it in CI.
- **Switch chaos tests:** inject timeouts, 500s and crashes at every hop. Each payment ends SUCCESS or
  REVERSED, every DEEMED resolves, and the money total across all participants is unchanged.
- **Concurrency:** many payments from one wallet at once never overspend.
- **Settlement property:** for random transaction sets, the net positions sum to zero.
- **End to end:** today's two-phone Playwright flow over the real switch, plus the cross-repo bill → paid
  flow in nightly CI (switch and pay-api images pulled from GHCR).

---

## 15. Open questions

1. **Handle suffixes:** `@tpay` for TacketPay customers and `@tacket` for shops. OK, or other names?
2. **Who generates bill QR codes:** Tacket, through the kit's QR builder (recommended), or should TacketPay
   offer a hosted "create QR" API?
3. **Pay page without the app:** should a customer without TacketPay be able to pay from the browser? That
   needs a lightweight guest wallet on TacketPay (recommended for the judges' demo).
4. **Hosting:** switch and pay-api on Railway / Fly / Render, each with its own Postgres. Agreed?
5. **Package registry:** which GitHub org publishes `@tacket/tpi-protocol` and `@tacket/tpi-participant`?
6. **Settlement cycle length for the demo:** hourly, or on demand from the admin page so it can be shown live?
