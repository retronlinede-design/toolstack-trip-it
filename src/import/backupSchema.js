export const APP_ID = "tripit";
export const SCHEMA_VERSION = 1;
export const EXPORT_TYPES = Object.freeze({ FULL_BACKUP: "full-backup", REPORT: "report" });

export const IMPORT_LIMITS = Object.freeze({
  maxFileBytes: 10 * 1024 * 1024,
  maxDepth: 20,
  maxStringLength: 100_000,
  maxVehicles: 500,
  maxTrips: 100_000,
  maxLegs: 500_000,
  maxFuelEntries: 100_000,
  maxWashEntries: 100_000,
  maxTemplates: 10_000,
});

export const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function createFullBackup({ data, profile, exportedAt = new Date().toISOString() }) {
  return {
    metadata: { appId: APP_ID, exportType: EXPORT_TYPES.FULL_BACKUP, schemaVersion: SCHEMA_VERSION, exportedAt },
    profile,
    data,
  };
}

export function createReportExport({ range, vehicle, trips, fuel, exportedAt = new Date().toISOString() }) {
  return {
    metadata: { appId: APP_ID, exportType: EXPORT_TYPES.REPORT, schemaVersion: SCHEMA_VERSION, exportedAt },
    range,
    vehicle,
    trips,
    fuel,
  };
}
