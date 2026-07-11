import { describe, expect, it } from "vitest";
import { createFullBackup, createReportExport } from "./backupSchema.js";
import { identifyBackup, prepareBackupImport, requiresEmptyReplacementConfirmation, validateApplicationPayload } from "./backupValidator.js";
import { clone, validApp } from "./testFixtures.js";

const prepare = (value, options = {}) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return prepareBackupImport({ text, size: options.size ?? text.length, normalize: options.normalize || ((data) => clone(data)), limits: options.limits });
};

describe("backup identification", () => {
  it("rejects malformed JSON with a specific code", () => expect(prepare("{broken").code).toBe("INVALID_JSON"));
  it("accepts a current full backup", () => expect(identifyBackup(createFullBackup({ data: validApp(), profile: {} }))).toMatchObject({ ok: true, kind: "current" }));
  it("rejects a current report as non-restorable", () => expect(identifyBackup(createReportExport({ range: {}, vehicle: {}, trips: [], fuel: [] }))).toMatchObject({ ok: false, code: "REPORT_NOT_RESTORABLE" }));
  it("rejects a wrong-app export", () => { const backup = createFullBackup({ data: validApp() }); backup.metadata.appId = "other"; expect(identifyBackup(backup).code).toBe("WRONG_APP"); });
  it("rejects unknown JSON", () => expect(identifyBackup({ vehicles: [] }).code).toBe("UNKNOWN_EXPORT_TYPE"));
  it("rejects future schema versions", () => { const backup = createFullBackup({ data: validApp() }); backup.metadata.schemaVersion = 99; expect(identifyBackup(backup).code).toBe("UNSUPPORTED_VERSION"); });
  it("detects a valid legacy wrapper", () => expect(identifyBackup({ exportedAt: "2025-01-01T00:00:00.000Z", profile: {}, data: validApp() })).toMatchObject({ ok: true, kind: "legacy", migrationRequired: true }));
  it("detects a complete raw legacy application", () => expect(identifyBackup(validApp())).toMatchObject({ ok: true, kind: "legacy" }));
  it("rejects a legacy report-like object", () => expect(identifyBackup({ range: {}, vehicle: {}, trips: [], fuel: [] }).code).toBe("REPORT_NOT_RESTORABLE"));
});

describe("backup schema validation", () => {
  it("accepts a valid current backup", () => expect(prepare(createFullBackup({ data: validApp(), profile: {} })).ok).toBe(true));
  it("accepts legacy trips without people fields", () => { const data = validApp(); delete data.tripsByVehicle.v1[0].driver; delete data.tripsByVehicle.v1[0].passengers; expect(validateApplicationPayload(data).ok).toBe(true); });
  it("accepts valid leg people and rejects malformed or excessive values", () => { const valid = validApp(); valid.tripsByVehicle.v1[0].legs[0].driver = "Retro"; valid.tripsByVehicle.v1[0].legs[0].passengers = ["A"]; expect(validateApplicationPayload(valid).ok).toBe(true); const data = validApp(); data.tripsByVehicle.v1[0].legs[0].passengers = "Passenger"; expect(validateApplicationPayload(data).ok).toBe(false); const long = validApp(); long.tripsByVehicle.v1[0].legs[0].driver = "x".repeat(151); expect(validateApplicationPayload(long).ok).toBe(false); const many = validApp(); many.tripsByVehicle.v1[0].legs[0].passengers = Array.from({ length: 51 }, (_, i) => `P${i}`); expect(validateApplicationPayload(many).ok).toBe(false); });
  it("normalizes a valid legacy backup and reports migration", () => {
    const result = prepare({ exportedAt: "2025-01-01T00:00:00.000Z", profile: {}, data: validApp() }, { normalize: (data) => ({ ...clone(data), migrated: true }) });
    expect(result.ok).toBe(true);
    expect(result.classification.label).toBe("Legacy Trip-It backup");
    expect(result.candidate.migrated).toBe(true);
    expect(result.warnings).toContain("Legacy backup will be migrated to schema version 1.");
  });
  it("rejects duplicate vehicle IDs", () => { const data = validApp(); data.vehicles.push({ id: "v1", name: "Other" }); expect(validateApplicationPayload(data).code).toBe("DUPLICATE_ID"); });
  it("rejects duplicate trip IDs", () => { const data = validApp(); data.tripsByVehicle.v1.push(clone(data.tripsByVehicle.v1[0])); expect(validateApplicationPayload(data).code).toBe("DUPLICATE_ID"); });
  it("rejects duplicate leg IDs within a trip", () => { const data = validApp(); data.tripsByVehicle.v1[0].legs.push(clone(data.tripsByVehicle.v1[0].legs[0])); expect(validateApplicationPayload(data).code).toBe("DUPLICATE_ID"); });
  it("rejects unknown vehicle references", () => { const data = validApp(); data.tripsByVehicle.unknown = []; expect(validateApplicationPayload(data).code).toBe("UNKNOWN_VEHICLE_REFERENCE"); });
  it("rejects malformed collections", () => { const data = validApp(); data.fuelByVehicle.v1 = {}; expect(validateApplicationPayload(data).ok).toBe(false); });
  it("rejects invalid numeric values", () => { const data = validApp(); data.tripsByVehicle.v1[0].legs[0].km = "not-a-number"; expect(validateApplicationPayload(data).ok).toBe(false); });
  it("rejects prototype-pollution keys", () => {
    const json = JSON.stringify(createFullBackup({ data: validApp() })).replace('"ui":{"month":"2026-07"}', '"ui":{"month":"2026-07","__proto__":{"polluted":true}}');
    expect(prepare(json).ok).toBe(false);
  });
  it("rejects oversized files before parsing", () => expect(prepare("{}", { size: 101, limits: { maxFileBytes: 100 } }).code).toBe("FILE_TOO_LARGE"));
  it("rejects excessive record counts", () => { const data = validApp(); expect(validateApplicationPayload(data, { limits: { maxVehicles: 0 } }).ok).toBe(false); });
  it("rejects excessive nesting", () => { const data = validApp(); data.templates[0].data = { a: { b: { c: true } } }; expect(validateApplicationPayload(data, { limits: { maxDepth: 3 } }).ok).toBe(false); });
  it("rejects excessive string length", () => { const data = validApp(); data.vehicles[0].name = "123456"; expect(validateApplicationPayload(data, { limits: { maxStringLength: 5 } }).ok).toBe(false); });
});

describe("preview data", () => {
  it("calculates all counts", () => expect(validateApplicationPayload(validApp()).counts).toEqual({ vehicles: 1, completedTrips: 1, activeTrips: 1, legs: 2, fuelEntries: 1, washEntries: 1, templates: 1 }));
  it("requires extra confirmation for empty over nonempty", () => {
    const populated = { vehicles: 1, completedTrips: 0, activeTrips: 0, legs: 0, fuelEntries: 0, washEntries: 0, templates: 0 };
    const empty = { vehicles: 0, completedTrips: 0, activeTrips: 0, legs: 0, fuelEntries: 0, washEntries: 0, templates: 0 };
    expect(requiresEmptyReplacementConfirmation(populated, empty)).toBe(true);
    expect(requiresEmptyReplacementConfirmation(empty, empty)).toBe(false);
  });
});
