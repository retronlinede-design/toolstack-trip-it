import { describe, expect, it, vi } from "vitest";
import { validApp, clone } from "../import/testFixtures.js";
import { validateApplicationPayload } from "../import/backupValidator.js";
import { classifyStartupValue, initializeStartup, shouldPersistApp } from "./startup.js";

const PRIMARY = "toolstack.tripit.v1";
const LEGACY = "toolstack_tripit_v1";

function memoryStorage(initial = {}, overrides = {}) {
  const values = new Map(Object.entries(initial));
  const calls = [];
  return {
    values,
    calls,
    getItem(key) { calls.push(["get", key]); return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { calls.push(["set", key, value]); values.set(key, value); },
    removeItem(key) { calls.push(["remove", key]); values.delete(key); },
    ...overrides,
  };
}

const empty = () => ({ vehicles: [], activeVehicleId: null, activeTripByVehicle: {}, tripsByVehicle: {}, fuelByVehicle: {}, washByVehicle: {}, drivers: [], ui: { month: "2026-07" }, templates: [] });

function normalizeLegacy(value) {
  if (Array.isArray(value.trips) && !Array.isArray(value.vehicles)) {
    const legs = value.trips.map((trip, index) => ({
      id: trip.id || `l${index}`,
      startPlace: trip.from || trip.start || "",
      endPlace: trip.to || trip.end || "",
      odoStart: trip.odoStart ?? trip.odometerStart ?? null,
      odoEnd: trip.odoEnd ?? trip.odometerEnd ?? null,
      km: trip.distance ?? 0,
      note: trip.notes || trip.purpose || "",
      endTag: trip.tag || "",
      driver: trip.driver || "",
      passengers: trip.passengers || [],
    }));
    return { ...empty(), vehicles: [{ id: "imported", name: "Imported vehicle" }], activeVehicleId: "imported", activeTripByVehicle: { imported: null }, tripsByVehicle: { imported: [{ id: "t1", vehicleId: "imported", startDate: value.trips[0]?.date || "2026-07-01", status: "finished", legs }] }, fuelByVehicle: { imported: [] }, washByVehicle: { imported: [] } };
  }
  const result = { ...empty(), ...clone(value) };
  result.drivers = (Array.isArray(result.drivers) ? result.drivers : []).map((driver, index) => typeof driver === "string" ? { id: `driver-${index}`, fullName: driver } : { ...driver, id: driver.id || `driver-${index}`, fullName: driver.fullName || driver.name || driver.displayName });
  for (const vehicle of result.vehicles || []) {
    result.activeTripByVehicle[vehicle.id] ??= null;
    result.tripsByVehicle[vehicle.id] ??= [];
    result.fuelByVehicle[vehicle.id] ??= [];
    result.washByVehicle[vehicle.id] ??= [];
  }
  if (value.legsByVehicle) {
    result.tripsByVehicle = {};
    for (const vehicle of result.vehicles) result.tripsByVehicle[vehicle.id] = (value.legsByVehicle[vehicle.id]?.length ? [{ id: `trip-${vehicle.id}`, vehicleId: vehicle.id, startDate: value.legsByVehicle[vehicle.id][0].startDate, status: "finished", legs: value.legsByVehicle[vehicle.id].map((leg) => ({ ...leg, driver: leg.driver || "", passengers: leg.passengers || [], note: leg.note || leg.purpose || "", endTag: leg.endTag || leg.tag || "" })) }] : []);
  }
  for (const trips of Object.values(result.tripsByVehicle)) for (const trip of trips) {
    const people = { driver: trip.driver || "", passengers: trip.passengers || [] };
    trip.legs = (trip.legs || []).map((leg) => ({ ...leg, driver: leg.driver || people.driver, passengers: leg.passengers?.length ? leg.passengers : people.passengers }));
    delete trip.driver; delete trip.passengers;
  }
  return result;
}

const options = (storage, overrides = {}) => ({ primaryKey: PRIMARY, legacyKey: LEGACY, emptyApp: empty, normalize: normalizeLegacy, migrateLegacy: (value) => value, validate: validateApplicationPayload, storage, ...overrides });

describe("startup classification", () => {
  it("accepts strict current data, including unknown fields", () => {
    const data = { ...validApp(), futureField: { retained: true } };
    expect(classifyStartupValue(data, validateApplicationPayload).kind).toBe("current");
  });

  it("recognizes only explicit flat-trip and legsByVehicle legacy shapes", () => {
    expect(classifyStartupValue({ trips: [{ date: "2020-01-01", from: "A", to: "B" }] }, validateApplicationPayload)).toMatchObject({ kind: "legacy", legacyKind: "flat-trips" });
    expect(classifyStartupValue({ vehicles: [{ id: "v1", name: "Car" }], legsByVehicle: { v1: [] } }, validateApplicationPayload)).toMatchObject({ kind: "legacy", legacyKind: "legs-by-vehicle" });
    expect(classifyStartupValue({ trips: [{ arbitrary: true }] }, validateApplicationPayload).kind).toBe("invalid");
  });

  it.each([
    ["missing required containers", { vehicles: [] }],
    ["malformed collection", { vehicles: [], tripsByVehicle: [] }],
    ["orphan collection", { vehicles: [{ id: "v1", name: "Car" }], fuelByVehicle: { other: [] } }],
    ["ambiguous old and new trips", { vehicles: [{ id: "v1", name: "Car" }], legsByVehicle: { v1: [] }, tripsByVehicle: { v1: [{}] } }],
  ])("blocks %s", (_label, value) => expect(classifyStartupValue(value, validateApplicationPayload).kind).toBe("invalid"));

  it("rejects explicit backup/future envelopes as unsupported", () => expect(classifyStartupValue({ metadata: { schemaVersion: 99 }, data: validApp() }, validateApplicationPayload).kind).toBe("unsupported"));

  it.each([
    ["duplicate IDs", (() => { const data = validApp(); data.vehicles.push({ id: "v1", name: "Duplicate" }); return data; })()],
    ["invalid date", (() => { const data = validApp(); data.tripsByVehicle.v1[0].startDate = "bad"; return data; })()],
    ["invalid numeric", (() => { const data = validApp(); data.fuelByVehicle.v1[0].liters = "bad"; return data; })()],
    ["invalid people", (() => { const data = validApp(); data.tripsByVehicle.v1[0].legs[0].passengers = "bad"; return data; })()],
  ])("does not treat %s as legacy", (_label, value) => expect(classifyStartupValue(value, validateApplicationPayload).kind).toBe("invalid"));
});

describe("safe startup transactions", () => {
  it("loads valid current primary without writing or stripping unknown fields", () => {
    const data = { ...validApp(), futureField: { retained: true } };
    const raw = JSON.stringify(data, null, 2);
    const storage = memoryStorage({ [PRIMARY]: raw });
    const result = initializeStartup(options(storage));
    expect(result).toMatchObject({ status: "ready", source: "primary" });
    expect(result.app.futureField).toEqual({ retained: true });
    expect(storage.values.get(PRIMARY)).toBe(raw);
    expect(storage.calls.filter(([type]) => type === "set")).toHaveLength(0);
  });

  it("blocks and preserves parseable invalid data without overwriting primary", () => {
    const raw = JSON.stringify({ vehicles: [], fuelByVehicle: [] });
    const storage = memoryStorage({ [PRIMARY]: raw });
    const result = initializeStartup(options(storage));
    expect(result).toMatchObject({ status: "blocked", gate: { kind: "startup-invalid", preservation: { ok: true } } });
    expect(storage.values.get(PRIMARY)).toBe(raw);
    expect(storage.values.get(result.gate.preservation.recoveryKey)).toBe(raw);
  });

  it("preserves exact primary raw before migrating legacy aliases and people", () => {
    const legacy = { trips: [{ id: "old", date: "2020-01-01", from: "A", to: "B", odometerStart: 10, odometerEnd: 14, distance: 4, purpose: "Duty", tag: "Home", driver: "Retro", passengers: ["P"] }] };
    const raw = JSON.stringify(legacy, null, 2);
    const storage = memoryStorage({ [PRIMARY]: raw });
    const result = initializeStartup(options(storage));
    expect(result.status).toBe("ready");
    expect(storage.values.get(result.preservation.recoveryKey)).toBe(raw);
    const leg = result.app.tripsByVehicle.imported[0].legs[0];
    expect(leg).toMatchObject({ startPlace: "A", endPlace: "B", odoStart: 10, odoEnd: 14, km: 4, note: "Duty", endTag: "Home", driver: "Retro", passengers: ["P"] });
    const recoveryWrite = storage.calls.findIndex(([type, key]) => type === "set" && key === result.preservation.recoveryKey);
    const primaryWrite = storage.calls.findIndex(([type, key]) => type === "set" && key === PRIMARY);
    expect(recoveryWrite).toBeLessThan(primaryWrite);
  });

  it("migrates legsByVehicle and legacy driver profile forms", () => {
    const legacy = { vehicles: [{ id: "v1", name: "Car" }], legsByVehicle: { v1: [{ id: "l1", startDate: "2020-01-01", odoStart: 1, odoEnd: 2, km: 1, tag: "Work" }] }, drivers: ["Retro"] };
    const storage = memoryStorage({ [PRIMARY]: JSON.stringify(legacy) });
    const result = initializeStartup(options(storage));
    expect(result.status).toBe("ready");
    expect(result.app.tripsByVehicle.v1[0].legs[0].endTag).toBe("Work");
    expect(result.app.drivers[0].fullName).toBe("Retro");
  });

  it("migrates current-shaped old-key data and removes the old key last", () => {
    const raw = JSON.stringify(validApp());
    const storage = memoryStorage({ [LEGACY]: raw });
    const result = initializeStartup(options(storage));
    expect(result).toMatchObject({ status: "ready", source: "migrated-legacy-key" });
    expect(storage.values.has(LEGACY)).toBe(false);
    expect(storage.values.get(result.preservation.recoveryKey)).toBe(raw);
    const removeIndex = storage.calls.findIndex(([type, key]) => type === "remove" && key === LEGACY);
    const lastPrimaryRead = storage.calls.map(([type, key], index) => type === "get" && key === PRIMARY ? index : -1).filter((index) => index >= 0).at(-1);
    expect(removeIndex).toBeGreaterThan(lastPrimaryRead);
  });

  it("never writes an invalid normalized candidate", () => {
    const raw = JSON.stringify({ trips: [{ date: "2020-01-01", from: "A" }] });
    const storage = memoryStorage({ [PRIMARY]: raw });
    const result = initializeStartup(options(storage, { normalize: () => ({ vehicles: [] }) }));
    expect(result).toMatchObject({ status: "blocked", gate: { phase: "candidate_validation" } });
    expect(storage.values.get(PRIMARY)).toBe(raw);
    expect(storage.calls.filter(([type, key]) => type === "set" && key === PRIMARY)).toHaveLength(0);
  });

  it("does not overwrite when preservation fails", () => {
    const raw = JSON.stringify({ trips: [{ date: "2020-01-01", from: "A" }] });
    const storage = memoryStorage({ [PRIMARY]: raw });
    storage.setItem = vi.fn((key, value) => { if (key.includes(".recovery.")) throw new Error("full"); storage.values.set(key, value); });
    const result = initializeStartup(options(storage));
    expect(result).toMatchObject({ status: "blocked", gate: { phase: "preserve_source" } });
    expect(storage.values.get(PRIMARY)).toBe(raw);
  });

  it("handles serialization failure without overwriting source", () => {
    const raw = JSON.stringify({ trips: [{ date: "2020-01-01", from: "A" }] });
    const storage = memoryStorage({ [PRIMARY]: raw });
    const result = initializeStartup(options(storage, { normalize: () => ({ ...empty(), impossible: 1n }), validate: (value) => value.trips ? { ok: false, errors: [{ code: "INVALID_SCHEMA", path: "data.vehicles" }] } : { ok: true } }));
    expect(result).toMatchObject({ status: "blocked", gate: { phase: "serialize" } });
    expect(storage.values.get(PRIMARY)).toBe(raw);
  });

  it("restores exact primary raw after candidate write failure", () => {
    const raw = JSON.stringify({ trips: [{ date: "2020-01-01", from: "A" }] }, null, 2);
    const storage = memoryStorage({ [PRIMARY]: raw });
    let primaryWrites = 0;
    storage.setItem = (key, value) => { storage.calls.push(["set", key, value]); if (key === PRIMARY && ++primaryWrites === 1) throw new Error("write failed"); storage.values.set(key, value); };
    const result = initializeStartup(options(storage));
    expect(result).toMatchObject({ status: "blocked", gate: { phase: "write_candidate", restoration: { ok: true } } });
    expect(storage.values.get(PRIMARY)).toBe(raw);
  });

  it("surfaces restoration failure", () => {
    const raw = JSON.stringify({ trips: [{ date: "2020-01-01", from: "A" }] });
    const storage = memoryStorage({ [PRIMARY]: raw });
    storage.setItem = (key, value) => { if (key === PRIMARY) throw new Error("blocked"); storage.values.set(key, value); };
    const result = initializeStartup(options(storage));
    expect(result.gate.restoration.ok).toBe(false);
    expect(result.status).toBe("blocked");
  });

  it("restores exact source when post-write readback validation fails", () => {
    const raw = JSON.stringify({ trips: [{ date: "2020-01-01", from: "A" }] }, null, 2);
    const storage = memoryStorage({ [PRIMARY]: raw });
    const originalGet = storage.getItem.bind(storage);
    let primaryReadsAfterWrite = 0;
    let candidateWritten = false;
    storage.setItem = (key, value) => { storage.calls.push(["set", key, value]); storage.values.set(key, value); if (key === PRIMARY && value !== raw) candidateWritten = true; };
    storage.getItem = (key) => {
      storage.calls.push(["get", key]);
      if (key === PRIMARY && candidateWritten && ++primaryReadsAfterWrite === 2) return JSON.stringify({ vehicles: [] });
      return originalGet(key);
    };
    const result = initializeStartup(options(storage));
    expect(result).toMatchObject({ status: "blocked", gate: { phase: "validate_readback", restoration: { ok: true } } });
    expect(storage.values.get(PRIMARY)).toBe(raw);
  });

  it("blocks on readback mismatch and restores the exact source", () => {
    const raw = JSON.stringify({ trips: [{ date: "2020-01-01", from: "A" }] });
    const storage = memoryStorage({ [PRIMARY]: raw });
    const originalGet = storage.getItem.bind(storage);
    let returnMismatch = false;
    storage.setItem = (key, value) => { storage.calls.push(["set", key, value]); storage.values.set(key, value); if (key === PRIMARY && value !== raw) returnMismatch = true; };
    storage.getItem = (key) => {
      storage.calls.push(["get", key]);
      if (key === PRIMARY && returnMismatch) { returnMismatch = false; return "different"; }
      return originalGet(key);
    };
    const result = initializeStartup(options(storage));
    expect(result).toMatchObject({ status: "blocked", gate: { phase: "write_candidate", restoration: { ok: true } } });
    expect(storage.values.get(PRIMARY)).toBe(raw);
  });

  it("keeps old key when destination writing fails and is safe to repeat", () => {
    const raw = JSON.stringify(validApp());
    const storage = memoryStorage({ [LEGACY]: raw });
    storage.setItem = (key, value) => { if (key === PRIMARY) throw new Error("blocked"); storage.values.set(key, value); };
    const first = initializeStartup(options(storage));
    const second = initializeStartup(options(storage));
    expect(first.status).toBe("blocked");
    expect(second.status).toBe("blocked");
    expect(storage.values.get(LEGACY)).toBe(raw);
  });

  it("never removes the old key when final removal fails", () => {
    const raw = JSON.stringify(validApp());
    const storage = memoryStorage({ [LEGACY]: raw });
    storage.removeItem = (key) => { storage.calls.push(["remove", key]); throw new Error("blocked"); };
    const result = initializeStartup(options(storage));
    expect(result).toMatchObject({ status: "blocked", gate: { phase: "remove_legacy" } });
    expect(storage.values.get(LEGACY)).toBe(raw);
  });
});

describe("normal persistence gate", () => {
  it("suppresses hydration and blocked writes but permits a genuine mutation", () => {
    const hydrated = validApp();
    expect(shouldPersistApp({ ready: false, app: hydrated, hydratedApp: null })).toBe(false);
    expect(shouldPersistApp({ ready: true, app: hydrated, hydratedApp: hydrated })).toBe(false);
    expect(shouldPersistApp({ ready: true, app: { ...hydrated, activeVehicleId: null }, hydratedApp: hydrated })).toBe(true);
  });
});
