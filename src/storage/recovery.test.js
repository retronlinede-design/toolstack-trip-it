import { describe, expect, it } from "vitest";
import { preserveRecoveryRaw, replaceCorruptWithEmpty } from "./recovery.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  };
}

describe("corrupt-data recovery", () => {
  it("preserves corrupt raw data exactly without overwriting the primary", () => {
    const raw = '{"trips":[1,2]';
    const storage = memoryStorage({ "toolstack.tripit.v1": raw });
    const result = preserveRecoveryRaw("toolstack.tripit.v1", raw, storage, new Date("2026-07-11T12:00:00.000Z"));
    expect(result.ok).toBe(true);
    expect(storage.getItem(result.recoveryKey)).toBe(raw);
    expect(storage.getItem("toolstack.tripit.v1")).toBe(raw);
  });

  it("does not create a new primary dataset as part of preservation", () => {
    const storage = memoryStorage();
    preserveRecoveryRaw("toolstack.tripit.v1", "broken", storage);
    expect(storage.getItem("toolstack.tripit.v1")).toBeNull();
  });

  it("requires explicit confirmation before creating a new dataset", () => {
    const storage = memoryStorage({ "toolstack.tripit.v1": "broken" });
    const denied = replaceCorruptWithEmpty({
      primaryKey: "toolstack.tripit.v1",
      raw: "broken",
      emptyData: { vehicles: [] },
      confirm: () => false,
      storage,
    });
    expect(denied.status).toBe("cancelled");
    expect(storage.getItem("toolstack.tripit.v1")).toBe("broken");

    const accepted = replaceCorruptWithEmpty({
      primaryKey: "toolstack.tripit.v1",
      raw: "broken",
      emptyData: { vehicles: [] },
      confirm: () => true,
      storage,
      now: new Date("2026-07-11T12:00:00.000Z"),
    });
    expect(accepted.ok).toBe(true);
    expect(storage.getItem("toolstack.tripit.v1")).toBe('{"vehicles":[]}');
    expect(storage.getItem(accepted.preservation.recoveryKey)).toBe("broken");
  });
});
