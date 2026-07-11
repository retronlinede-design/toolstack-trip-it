import { describe, expect, it } from "vitest";
import { readJson, readRaw, writeVerified } from "./storage.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  };
}

describe("storage reading", () => {
  it("distinguishes missing keys", () => expect(readJson("data", memoryStorage())).toMatchObject({ ok: true, status: "missing" }));
  it("returns parsed valid data", () => expect(readJson("data", memoryStorage({ data: '{"ok":true}' }))).toMatchObject({ ok: true, status: "valid", value: { ok: true } }));
  it("returns corrupt data with the exact raw value", () => expect(readJson("data", memoryStorage({ data: '{broken' }))).toMatchObject({ ok: false, status: "corrupt", raw: "{broken" }));
  it("reports a throwing getter", () => expect(readRaw("data", { getItem() { throw new Error("blocked"); } })).toMatchObject({ ok: false, status: "read_failed" }));
  it("reports unavailable storage", () => expect(readRaw("data", null)).toMatchObject({ ok: false, status: "unavailable" }));
});

describe("verified writing", () => {
  it("writes and verifies an exact match", () => expect(writeVerified("data", "value", memoryStorage())).toMatchObject({ ok: true, status: "verified" }));
  it("reports write exceptions", () => expect(writeVerified("data", "value", { setItem() { throw new Error("full"); } })).toMatchObject({ ok: false, status: "write_failed" }));
  it("detects a silent failed write", () => expect(writeVerified("data", "value", { setItem() {}, getItem() { return null; } })).toMatchObject({ ok: false, status: "verification_failed" }));
  it("detects a different read-back value", () => expect(writeVerified("data", "value", { setItem() {}, getItem() { return "other"; } })).toMatchObject({ ok: false, status: "verification_failed", actual: "other" }));
  it("reports unavailable read-back", () => expect(writeVerified("data", "value", { setItem() {}, getItem() { throw new Error("blocked"); } })).toMatchObject({ ok: false, status: "readback_failed" }));
});
