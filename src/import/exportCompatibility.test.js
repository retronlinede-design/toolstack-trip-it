import { describe, expect, it } from "vitest";
import { createFullBackup, createReportExport } from "./backupSchema.js";
import { prepareBackupImport } from "./backupValidator.js";
import { clone, validApp } from "./testFixtures.js";

describe("export compatibility", () => {
  it("marks full backups as restorable", () => expect(createFullBackup({ data: validApp() }).metadata.exportType).toBe("full-backup"));
  it("marks report JSON as non-restorable", () => expect(createReportExport({ range: {}, vehicle: {}, trips: [], fuel: [] }).metadata.exportType).toBe("report"));
  it("round-trips every operational field", () => {
    const data = validApp();
    data.tripsByVehicle.v1[0].driver = "Retro"; data.tripsByVehicle.v1[0].passengers = ["Ambassador", "Security Officer"];
    const backup = createFullBackup({ data, profile: { language: "DE" }, exportedAt: "2026-07-11T12:00:00.000Z" });
    const result = prepareBackupImport({ text: JSON.stringify(backup), size: JSON.stringify(backup).length, normalize: clone });
    expect(result.ok).toBe(true); expect(result.candidate).toEqual(data); expect(result.profile).toEqual({ language: "DE" });
  });
  it("preserves trip people in report JSON", () => { const trip = { id: "t", driver: "Retro", passengers: ["Ambassador"] }; expect(createReportExport({ range: {}, vehicle: {}, trips: [trip], fuel: [] }).trips[0]).toEqual(trip); });
});
