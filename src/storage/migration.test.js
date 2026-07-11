import { describe, expect, it } from "vitest";
import { migrateLegacyTransactional } from "./migration.js";

function memoryStorage(initial = {}, overrides = {}) {
  const values = new Map(Object.entries(initial));
  const calls = [];
  return {
    getItem(key) { calls.push(["get", key]); return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { calls.push(["set", key]); values.set(key, value); },
    removeItem(key) { calls.push(["remove", key]); values.delete(key); },
    values,
    calls,
    ...overrides,
  };
}

const options = (storage) => ({
  legacyKey: "legacy",
  destinationKey: "primary",
  storage,
  transform: (value) => ({ vehicles: value.vehicles || [], tripsByVehicle: value.tripsByVehicle || {} }),
  validate: (value) => Array.isArray(value?.vehicles) && !!value?.tripsByVehicle,
  now: new Date("2026-07-11T12:00:00.000Z"),
});

describe("transactional legacy migration", () => {
  it("verifies destination and backup before deleting the source", () => {
    const storage = memoryStorage({ legacy: '{"vehicles":[]}' });
    const result = migrateLegacyTransactional(options(storage));
    expect(result.status).toBe("migrated");
    expect(storage.getItem("legacy")).toBeNull();
    expect(storage.getItem(result.backupKey)).toBe('{"vehicles":[]}');
    const removeIndex = storage.calls.findIndex(([type]) => type === "remove");
    expect(storage.calls.findIndex(([type, key]) => type === "set" && key === result.backupKey)).toBeLessThan(removeIndex);
  });

  it("leaves legacy intact when destination writing fails", () => {
    const storage = memoryStorage({ legacy: '{"vehicles":[]}' });
    storage.setItem = () => { throw new Error("full"); };
    expect(migrateLegacyTransactional(options(storage)).ok).toBe(false);
    expect(storage.values.get("legacy")).toBe('{"vehicles":[]}');
  });

  it("leaves legacy intact when destination read-back fails", () => {
    const storage = memoryStorage({ legacy: '{"vehicles":[]}' });
    let primaryWritten = false;
    storage.setItem = (key, value) => { storage.values.set(key, value); if (key === "primary") primaryWritten = true; };
    storage.getItem = (key) => { if (key === "primary" && primaryWritten) throw new Error("blocked"); return storage.values.get(key) ?? null; };
    expect(migrateLegacyTransactional(options(storage)).ok).toBe(false);
    expect(storage.values.has("legacy")).toBe(true);
  });

  it("leaves legacy intact when the parsed destination is invalid", () => {
    const storage = memoryStorage({ legacy: '{"vehicles":[]}' });
    let primaryReads = 0;
    const originalGet = storage.getItem.bind(storage);
    storage.getItem = (key) => key === "primary" && ++primaryReads === 2 ? "null" : originalGet(key);
    const result = migrateLegacyTransactional(options(storage));
    expect(result.status).toBe("invalid_destination");
    expect(storage.values.has("legacy")).toBe(true);
  });

  it("a repeated completed migration does not duplicate or destroy records", () => {
    const storage = memoryStorage({ legacy: '{"vehicles":[{"id":"v1"}]}' });
    const first = migrateLegacyTransactional(options(storage));
    const primary = storage.getItem("primary");
    const second = migrateLegacyTransactional(options(storage));
    expect(first.ok).toBe(true);
    expect(second.status).toBe("no_legacy");
    expect(storage.getItem("primary")).toBe(primary);
  });
});
