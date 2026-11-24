#!/usr/bin/env node
// End-to-end smoke test over HTTP against a running TacketPay server (default http://localhost:3000).
//
//   npm run dev            # or: npm run build && npm start
//   npm run smoke          # in a second terminal; SMOKE_URL=http://host:port npm run smoke for another server
//
// It signs in (or signs up) two demo accounts, Diya (98765 43210, PIN 1234) and Aarush (91234 56789,
// PIN 4321), pays ₹25 from Diya to Aarush over TPI, checks both balances moved, closes a settlement
// cycle and checks /api/healthz. It uses demo money only, and leaves the two demo accounts in the
// database, which is handy before a presentation. Exits non-zero on the first failure.

const BASE = (process.env.SMOKE_URL || "http://localhost:3000").replace(/\/$/, "");

class Client {
  cookie = "";
  async call(path, body, method) {
    const res = await fetch(BASE + path, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(this.cookie ? { cookie: this.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0];
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }
}

function check(cond, msg) {
  if (!cond) {
    console.error(`FAIL  ${msg}`);
    process.exit(1);
  }
  console.log(`ok    ${msg}`);
}

async function account(name, phone, pin) {
  const c = new Client();
  let r = await c.call("/api/auth/signin", { phone, pin });
  if (r.status !== 200) r = await c.call("/api/auth/signup", { name, phone, pin });
  check(r.status === 200 && r.data?.snapshot?.me?.handle, `${name} signed in as ${r.data?.snapshot?.me?.handle ?? r.data?.error?.code}`);
  return { c, snap: r.data.snapshot };
}

const total = (snap) => snap.accounts.reduce((s, a) => s + a.balance, 0);

try {
  const health = await new Client().call("/api/healthz");
  check(health.status === 200 && health.data?.ok === true, "GET /api/healthz is healthy and the books balance");

  const diya = await account("Diya", "9876543210", "1234");
  const aarush = await account("Aarush", "9123456789", "4321");
  const before = { diya: total(diya.snap), aarush: total(aarush.snap) };

  const pay = await diya.c.call("/api/wallet/pay", {
    payeeHandle: aarush.snap.me.handle,
    amount: 25_00,
    note: "Smoke test",
    method: "contact",
    pin: "1234",
    idemKey: `smoke-${Date.now()}`,
  });
  check(pay.status === 200 && pay.data?.payment?.state === "SUCCESS", `Diya paid Aarush ₹25 over TPI (RRN ${pay.data?.payment?.rrn ?? pay.data?.error?.code})`);
  check(total(pay.data.snapshot) === before.diya - 25_00, "Diya's balance went down by ₹25");

  const me = await aarush.c.call("/api/me");
  check(total(me.data.snapshot) === before.aarush + 25_00, "Aarush's balance went up by ₹25 (seen through /api/me sync)");

  const settle = await diya.c.call("/api/tpi/settlement", {});
  check(settle.status === 200 && settle.data?.cycle?.positions.reduce((s, p) => s + p.net, 0) === 0, `Settlement cycle ${settle.data?.cycle?.id} closed and nets to zero`);
  check(settle.data.network.settlement.exceptions.length === 0, "Reconciliation found no exceptions");
  check(settle.data.network.totals.ledgerSum === 0, "Network books sum to zero");

  const anon = await new Client().call("/api/me");
  check(anon.status === 401, "Signed-out requests are refused with 401");
  console.log("\nSmoke test passed.");
} catch (err) {
  console.error(`FAIL  could not reach ${BASE}: ${err.message}. Start the server first (npm run dev).`);
  process.exit(1);
}
