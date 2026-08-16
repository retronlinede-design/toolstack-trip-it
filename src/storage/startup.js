import { readJson, readRaw, removeKey, writeVerified } from "./storage.js";
import { preserveRecoveryRaw } from "./recovery.js";

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const plainObject = (value) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const MAP_FIELDS = ["activeTripByVehicle", "tripsByVehicle", "fuelByVehicle", "washByVehicle"];
const ARRAY_FIELDS = ["vehicles", "drivers", "templates"];
const LEGACY_MARKERS = ["activeVehicleId", ...MAP_FIELDS, "ui", "templates", "drivers"];
const FLAT_TRIP_FIELDS = new Set(["date", "from", "to", "start", "end", "distance", "odoStart", "odoEnd", "odometerStart", "odometerEnd", "purpose", "notes"]);
const DEFAULTABLE_ERROR_PATHS = [
  /^data\.(vehicles|activeVehicleId|activeTripByVehicle|tripsByVehicle|fuelByVehicle|washByVehicle|ui|templates)$/,
  /^data\.vehicles\[\d+\]\.(id|name)$/,
  /^data\.(tripsByVehicle|activeTripByVehicle)\..+?(?:\[\d+\])?\.legs$/,
  /^data\.(fuelByVehicle|washByVehicle)\..+?\[\d+\]\.id$/,
  /^data\.drivers\[\d+\](?:\.(id|fullName))?$/,
  /^data\.templates\[\d+\]\.(id|type|data)$/,
];

const cloneJsonValue = (value) => JSON.parse(JSON.stringify(value));

function issue(code, message, details = {}) {
  return { code, message, ...details };
}

function validateLegacyContainers(value) {
  for (const field of ARRAY_FIELDS) {
    if (own(value, field) && !Array.isArray(value[field])) return issue("MALFORMED_LEGACY", `${field} must be an array.`);
  }
  for (const field of MAP_FIELDS) {
    if (own(value, field) && !plainObject(value[field])) return issue("MALFORMED_LEGACY", `${field} must be an object.`);
  }
  if (own(value, "legsByVehicle") && !plainObject(value.legsByVehicle)) return issue("MALFORMED_LEGACY", "legsByVehicle must be an object.");
  if (own(value, "ui") && !plainObject(value.ui)) return issue("MALFORMED_LEGACY", "ui must be an object.");

  const vehicles = Array.isArray(value.vehicles) ? value.vehicles : [];
  if (vehicles.some((vehicle) => !plainObject(vehicle))) return issue("MALFORMED_LEGACY", "Every vehicle must be an object.");
  const ids = vehicles.map((vehicle) => vehicle.id).filter((id) => typeof id === "string" && id.trim());
  if (new Set(ids).size !== ids.length) return issue("DUPLICATE_ID", "Legacy vehicles contain duplicate IDs.");
  const vehicleIds = new Set(ids);

  for (const field of [...MAP_FIELDS, "legsByVehicle"]) {
    if (!plainObject(value[field])) continue;
    for (const [vehicleId, collection] of Object.entries(value[field])) {
      if (!vehicleIds.has(vehicleId)) return issue("UNKNOWN_VEHICLE_REFERENCE", `${field}.${vehicleId} references an unknown vehicle.`);
      if (field === "activeTripByVehicle") {
        if (collection !== null && !plainObject(collection)) return issue("MALFORMED_LEGACY", `${field}.${vehicleId} must be a trip object or null.`);
      } else if (!Array.isArray(collection)) {
        return issue("MALFORMED_LEGACY", `${field}.${vehicleId} must be an array.`);
      }
    }
  }
  return null;
}

function hasOnlyDefaultableErrors(validation) {
  return Array.isArray(validation?.errors) && validation.errors.length > 0
    && validation.errors.every((error) => error.code === "INVALID_SCHEMA" && DEFAULTABLE_ERROR_PATHS.some((pattern) => pattern.test(error.path)));
}

export function classifyStartupValue(value, validate) {
  if (!plainObject(value)) return { kind: "invalid", reason: issue("INVALID_ROOT", "Stored Trip-It data must be an object.") };

  if (plainObject(value.metadata) || own(value, "schemaVersion") || (own(value, "data") && plainObject(value.data))) {
    return { kind: "unsupported", reason: issue("UNSUPPORTED_ENVELOPE", "A backup envelope or explicitly versioned object cannot be used as operational storage.") };
  }

  const currentValidation = validate(value);
  if (currentValidation.ok) return { kind: "current", validation: currentValidation };

  if (Array.isArray(value.trips) && !own(value, "vehicles") && !own(value, "legsByVehicle") && !own(value, "tripsByVehicle")) {
    const recognizable = value.trips.every((trip) => plainObject(trip) && (value.trips.length === 0 || Object.keys(trip).some((key) => FLAT_TRIP_FIELDS.has(key))));
    return recognizable
      ? { kind: "legacy", legacyKind: "flat-trips", sourceValidation: currentValidation }
      : { kind: "invalid", reason: issue("AMBIGUOUS_LEGACY", "The flat trips collection is not a recognized Trip-It legacy shape."), validation: currentValidation };
  }

  const hasVehicles = Array.isArray(value.vehicles);
  const hasLegsByVehicle = plainObject(value.legsByVehicle);
  const hasCurrentMarkers = LEGACY_MARKERS.some((field) => own(value, field));
  if (hasVehicles && (hasLegsByVehicle || hasCurrentMarkers)) {
    const legacyError = validateLegacyContainers(value);
    if (legacyError) return { kind: "invalid", reason: legacyError, validation: currentValidation };
    if (hasLegsByVehicle && plainObject(value.tripsByVehicle) && Object.keys(value.tripsByVehicle).length > 0) {
      return { kind: "invalid", reason: issue("AMBIGUOUS_LEGACY", "Data contains both populated tripsByVehicle and legacy legsByVehicle collections."), validation: currentValidation };
    }
    if (!hasLegsByVehicle && !hasOnlyDefaultableErrors(currentValidation)) {
      return { kind: "invalid", reason: issue("INVALID_OPERATIONAL_DATA", "Operational data contains errors that are not part of a supported legacy defaulting rule."), validation: currentValidation };
    }
    return { kind: "legacy", legacyKind: hasLegsByVehicle ? "legs-by-vehicle" : "defaultable-operational", sourceValidation: currentValidation };
  }

  return { kind: "invalid", reason: issue("UNRECOGNIZED_DATA", "Stored data is neither a valid current dataset nor a recognized Trip-It legacy shape."), validation: currentValidation };
}

function blocked(kind, raw, classification, preservation, extra = {}) {
  return { status: "blocked", gate: { kind, raw, classification, preservation, ...extra } };
}

function preserveBlocked(primaryKey, raw, classification, storage, kind = "startup-invalid") {
  const preservation = preserveRecoveryRaw(primaryKey, raw, storage);
  return blocked(kind, raw, classification, preservation);
}

function normalizeAndValidate(value, normalize, migrateLegacy, validate) {
  let candidate;
  try {
    const cloned = cloneJsonValue(value);
    candidate = normalize(migrateLegacy(cloned));
  } catch (error) {
    return { ok: false, phase: "normalize", error };
  }
  const validation = validate(candidate);
  return validation.ok ? { ok: true, candidate, validation } : { ok: false, phase: "candidate_validation", validation };
}

function restorePrimary(primaryKey, originalRaw, storage) {
  return writeVerified(primaryKey, originalRaw, storage);
}

function migratePrimary({ primaryKey, raw, value, classification, normalize, migrateLegacy, validate, storage }) {
  const preservation = preserveRecoveryRaw(primaryKey, raw, storage);
  if (!preservation.ok) return blocked("startup-migration", raw, classification, preservation, { phase: "preserve_source" });

  const planned = normalizeAndValidate(value, normalize, migrateLegacy, validate);
  if (!planned.ok) return blocked("startup-migration", raw, classification, preservation, planned);

  let serialized;
  try { serialized = JSON.stringify(planned.candidate); }
  catch (error) { return blocked("startup-migration", raw, classification, preservation, { phase: "serialize", error }); }

  const written = writeVerified(primaryKey, serialized, storage);
  if (!written.ok) {
    const restoration = restorePrimary(primaryKey, raw, storage);
    return blocked("startup-migration", raw, classification, preservation, { phase: "write_candidate", storageResult: written, restoration });
  }
  const readBack = readJson(primaryKey, storage);
  const readBackValidation = readBack.ok && readBack.status === "valid" ? validate(readBack.value) : null;
  if (!readBack.ok || readBack.status !== "valid" || !readBackValidation?.ok) {
    const restoration = restorePrimary(primaryKey, raw, storage);
    return blocked("startup-migration", raw, classification, preservation, { phase: "validate_readback", storageResult: readBack, validation: readBackValidation, restoration });
  }
  return { status: "ready", source: "migrated-primary", app: readBack.value, preservation };
}

function migrateOldKey({ primaryKey, legacyKey, raw, value, classification, normalize, migrateLegacy, validate, storage }) {
  const planned = normalizeAndValidate(value, normalize, migrateLegacy, validate);
  if (!planned.ok) return blocked("startup-migration", raw, classification, null, { phase: planned.phase, validation: planned.validation, error: planned.error, sourceKey: legacyKey });

  const preservation = preserveRecoveryRaw(primaryKey, raw, storage);
  if (!preservation.ok) return blocked("startup-migration", raw, classification, preservation, { phase: "preserve_source", sourceKey: legacyKey });

  let serialized;
  try { serialized = JSON.stringify(planned.candidate); }
  catch (error) { return blocked("startup-migration", raw, classification, preservation, { phase: "serialize", error, sourceKey: legacyKey }); }
  const written = writeVerified(primaryKey, serialized, storage);
  if (!written.ok) return blocked("startup-migration", raw, classification, preservation, { phase: "write_candidate", storageResult: written, sourceKey: legacyKey });
  const readBack = readJson(primaryKey, storage);
  const readBackValidation = readBack.ok && readBack.status === "valid" ? validate(readBack.value) : null;
  if (!readBack.ok || readBack.status !== "valid" || !readBackValidation?.ok) {
    removeKey(primaryKey, storage);
    return blocked("startup-migration", raw, classification, preservation, { phase: "validate_readback", storageResult: readBack, validation: readBackValidation, sourceKey: legacyKey });
  }
  const removed = removeKey(legacyKey, storage);
  if (!removed.ok) return blocked("startup-migration", raw, classification, preservation, { phase: "remove_legacy", storageResult: removed, sourceKey: legacyKey });
  return { status: "ready", source: "migrated-legacy-key", app: readBack.value, preservation };
}

export function initializeStartup({ primaryKey, legacyKey, emptyApp, normalize, migrateLegacy, validate, storage }) {
  const primary = readJson(primaryKey, storage);
  if (primary.ok && primary.status === "valid") {
    const classification = classifyStartupValue(primary.value, validate);
    if (classification.kind === "current") {
      const app = Array.isArray(primary.value.drivers) ? primary.value : { ...primary.value, drivers: [] };
      return { status: "ready", source: "primary", app };
    }
    if (classification.kind === "legacy") return migratePrimary({ primaryKey, raw: primary.raw, value: primary.value, classification, normalize, migrateLegacy, validate, storage });
    return preserveBlocked(primaryKey, primary.raw, classification, storage, classification.kind === "unsupported" ? "startup-unsupported" : "startup-invalid");
  }
  if (!primary.ok && primary.status === "corrupt") {
    return preserveBlocked(primaryKey, primary.raw, { kind: "invalid", reason: issue("INVALID_JSON", "Stored Trip-It data is not valid JSON.") }, storage, "recovery");
  }
  if (!primary.ok) return blocked("storage-unavailable", null, { kind: "unavailable" }, null, { result: primary });

  const legacy = readRaw(legacyKey, storage);
  if (!legacy.ok) return blocked("storage-unavailable", null, { kind: "unavailable" }, null, { result: legacy });
  if (legacy.status === "missing") return { status: "ready", source: "new", app: emptyApp() };

  let value;
  try { value = JSON.parse(legacy.raw); }
  catch (error) {
    const classification = { kind: "invalid", reason: issue("INVALID_JSON", "Legacy Trip-It data is not valid JSON."), error };
    return preserveBlocked(primaryKey, legacy.raw, classification, storage, "startup-migration");
  }
  const classification = classifyStartupValue(value, validate);
  if (!['current', 'legacy'].includes(classification.kind)) return preserveBlocked(primaryKey, legacy.raw, classification, storage, "startup-migration");
  return migrateOldKey({ primaryKey, legacyKey, raw: legacy.raw, value, classification, normalize, migrateLegacy, validate, storage });
}

export function shouldPersistApp({ ready, app, hydratedApp }) {
  return !!ready && app !== hydratedApp;
}
