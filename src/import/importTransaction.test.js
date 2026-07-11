import { describe, expect, it, vi } from "vitest";
import { applyTransactionResult, replaceDatasetTransactional, rollbackTransactional } from "./importTransaction.js";
import { validateApplicationPayload } from "./backupValidator.js";
import { clone, validApp } from "./testFixtures.js";

function storageMock(initial = {}) {
  const values = new Map(Object.entries(initial));
  const calls = [];
  return {
    values, calls,
    getItem(key) { calls.push(["get", key]); return values.get(key) ?? null; },
    setItem(key, value) { calls.push(["set", key, value]); values.set(key, value); },
    removeItem(key) { calls.push(["remove", key]); values.delete(key); },
  };
}

const run = (storage, current = validApp(), candidate = { ...validApp(), activeVehicleId: null }) => replaceDatasetTransactional({ primaryKey: "primary", currentData: current, candidate, validate: validateApplicationPayload, storage, now: new Date("2026-07-11T12:00:00.000Z") });

describe("import transaction", () => {
  it("writes and verifies the snapshot before candidate write", () => {
    const current = validApp(); const storage = storageMock({ primary: JSON.stringify(current) });
    const result = run(storage, current);
    expect(result.ok).toBe(true);
    const snapshotSet = storage.calls.findIndex(([type, key]) => type === "set" && key.includes("pre-import"));
    const primarySet = storage.calls.findIndex(([type, key]) => type === "set" && key === "primary");
    expect(snapshotSet).toBeLessThan(primarySet);
  });
  it("aborts snapshot failure without changing primary", () => {
    const current = validApp(); const raw = JSON.stringify(current); const storage = storageMock({ primary: raw });
    const originalSet = storage.setItem.bind(storage); storage.setItem = (key, value) => { if (key.includes("pre-import")) throw new Error("full"); originalSet(key, value); };
    const result = run(storage, current);
    expect(result.code).toBe("SNAPSHOT_FAILED"); expect(storage.values.get("primary")).toBe(raw);
  });
  it("restores current data after candidate write failure", () => {
    const current = validApp(); const raw = JSON.stringify(current); const storage = storageMock({ primary: raw }); let primaryWrites = 0;
    const originalSet = storage.setItem.bind(storage); storage.setItem = (key, value) => { if (key === "primary" && ++primaryWrites === 1) throw new Error("write failed"); originalSet(key, value); };
    const result = run(storage, current);
    expect(result.code).toBe("CANDIDATE_WRITE_FAILED"); expect(storage.values.get("primary")).toBe(raw);
  });
  it("restores current data after a candidate read-back mismatch", () => {
    const current = validApp(); const raw = JSON.stringify(current); const storage = storageMock({ primary: raw }); let mismatch = true;
    const originalGet = storage.getItem.bind(storage); storage.getItem = (key) => key === "primary" && mismatch ? (mismatch = false, "mismatch") : originalGet(key);
    const result = run(storage, current);
    expect(result.code).toBe("CANDIDATE_VERIFY_FAILED"); expect(storage.values.get("primary")).toBe(raw);
  });
  it("restores current data when post-write validation fails", () => {
    const current = validApp(); const raw = JSON.stringify(current); const storage = storageMock({ primary: raw }); let primaryReads = 0;
    const originalGet = storage.getItem.bind(storage); storage.getItem = (key) => key === "primary" && ++primaryReads === 2 ? JSON.stringify({ vehicles: [] }) : originalGet(key);
    const result = run(storage, current);
    expect(result.phase).toBe("post_write_validation"); expect(storage.values.get("primary")).toBe(raw);
  });
  it("returns verified data and applies it to state only on success", () => {
    const current = validApp(); const candidate = clone(current); candidate.vehicles[0].name = "Imported"; const storage = storageMock({ primary: JSON.stringify(current) });
    const result = run(storage, current, candidate); const setter = vi.fn();
    expect(result.ok).toBe(true); expect(applyTransactionResult(result, setter)).toBe(true); expect(setter).toHaveBeenCalledWith(candidate);
  });
});

describe("rollback", () => {
  it("restores pre-import data and preserves both generations", () => {
    const oldData = validApp(); const imported = clone(oldData); imported.vehicles[0].name = "Imported";
    const storage = storageMock({ primary: JSON.stringify(imported), rollback: JSON.stringify(oldData) });
    const result = rollbackTransactional({ primaryKey: "primary", rollbackKey: "rollback", currentData: imported, validate: validateApplicationPayload, storage, now: new Date("2026-07-11T12:00:00.000Z") });
    expect(result.ok).toBe(true); expect(JSON.parse(storage.values.get("primary"))).toEqual(oldData); expect(storage.values.get("rollback")).toBe(JSON.stringify(oldData)); expect(storage.values.has(result.snapshotKey)).toBe(true);
  });
  it("failure keeps the rollback source and current-generation backup", () => {
    const oldData = validApp(); const imported = clone(oldData); imported.vehicles[0].name = "Imported";
    const storage = storageMock({ primary: JSON.stringify(imported), rollback: JSON.stringify(oldData) }); let failed = false;
    const originalSet = storage.setItem.bind(storage); storage.setItem = (key, value) => { if (key === "primary" && !failed) { failed = true; throw new Error("blocked"); } originalSet(key, value); };
    const result = rollbackTransactional({ primaryKey: "primary", rollbackKey: "rollback", currentData: imported, validate: validateApplicationPayload, storage, now: new Date("2026-07-11T12:00:00.000Z") });
    expect(result.ok).toBe(false); expect(storage.values.get("rollback")).toBe(JSON.stringify(oldData)); expect([...storage.values.keys()].some((key) => key.includes("pre-rollback"))).toBe(true); expect(JSON.parse(storage.values.get("primary"))).toEqual(imported);
  });
});
