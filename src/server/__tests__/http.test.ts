import { describe, expect, it } from "vitest";
import { readJson } from "../http";

const post = (type: string | undefined, body = '{"a":1}') =>
  new Request("http://localhost/api/x", { method: "POST", headers: type ? { "content-type": type } : {}, body });

const code = async (p: Promise<unknown>) => p.then(() => "ok", (e: { code?: string }) => e.code);

describe("readJson (the CSRF guard for every POST)", () => {
  it("accepts application/json, with or without a charset", async () => {
    expect(await readJson(post("application/json"))).toEqual({ a: 1 });
    expect(await readJson(post("Application/JSON; charset=utf-8"))).toEqual({ a: 1 });
  });

  it("refuses the types a cross-site form or no-preflight fetch can send, even with application/json tucked in", async () => {
    for (const type of [undefined, "text/plain", "text/plain; x=application/json", "application/x-www-form-urlencoded; application/json", "multipart/form-data; boundary=application/json"]) {
      expect(await code(readJson(post(type)))).toBe("BAD_REQUEST");
    }
  });

  it("refuses bodies that aren't a JSON object", async () => {
    for (const body of ["[1]", "null", "1", "{"]) expect(await code(readJson(post("application/json", body)))).toBe("BAD_REQUEST");
  });
});
