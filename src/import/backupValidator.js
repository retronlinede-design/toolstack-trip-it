import { APP_ID, EXPORT_TYPES, FORBIDDEN_KEYS, IMPORT_LIMITS, SCHEMA_VERSION } from "./backupSchema.js";
import { MAX_DRIVER_LENGTH, MAX_PASSENGERS, MAX_PASSENGER_LENGTH } from "../components/trips/tripPeople.js";

export const isPlainObject = (value) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const issue = (code, path, message) => ({ code, path, message });
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function operationalShape(value) {
  return isPlainObject(value)
    && Array.isArray(value.vehicles)
    && own(value, "activeVehicleId")
    && isPlainObject(value.activeTripByVehicle)
    && isPlainObject(value.tripsByVehicle)
    && isPlainObject(value.fuelByVehicle)
    && isPlainObject(value.washByVehicle)
    && isPlainObject(value.ui)
    && Array.isArray(value.templates);
}

export function identifyBackup(value) {
  if (!isPlainObject(value)) return { ok: false, code: "UNKNOWN_EXPORT_TYPE", errors: [issue("UNKNOWN_EXPORT_TYPE", "$", "JSON root must be an object.")] };
  const metadata = value.metadata;
  if (isPlainObject(metadata)) {
    if (metadata.appId !== APP_ID) return { ok: false, code: "WRONG_APP", errors: [issue("WRONG_APP", "metadata.appId", "This file was not exported by Trip-It.")] };
    if (metadata.schemaVersion > SCHEMA_VERSION) return { ok: false, code: "UNSUPPORTED_VERSION", errors: [issue("UNSUPPORTED_VERSION", "metadata.schemaVersion", `Backup schema version ${metadata.schemaVersion} is newer than supported version ${SCHEMA_VERSION}.`)] };
    if (metadata.schemaVersion !== SCHEMA_VERSION) return { ok: false, code: "UNSUPPORTED_VERSION", errors: [issue("UNSUPPORTED_VERSION", "metadata.schemaVersion", "This backup schema version is not supported.")] };
    if (metadata.exportType === EXPORT_TYPES.REPORT) return { ok: false, code: "REPORT_NOT_RESTORABLE", errors: [issue("REPORT_NOT_RESTORABLE", "metadata.exportType", "Report JSON is not a restorable full backup.")] };
    if (metadata.exportType !== EXPORT_TYPES.FULL_BACKUP) return { ok: false, code: "UNKNOWN_EXPORT_TYPE", errors: [issue("UNKNOWN_EXPORT_TYPE", "metadata.exportType", "Unknown Trip-It export type.")] };
    return { ok: true, kind: "current", label: "Trip-It full backup", schemaVersion: metadata.schemaVersion, exportedAt: metadata.exportedAt, payload: value.data, profile: value.profile, migrationRequired: false };
  }

  // A legacy backup is deliberately recognized only by the complete operational
  // shape. Wrapped exports additionally require old Trip-It metadata, its storage
  // key, or the historical exportedAt+profile markers. Raw legacy application
  // objects must contain every operational container. A report shape
  // ({range, vehicle, trips, fuel}) never satisfies these criteria.
  if (isPlainObject(value.data) && operationalShape(value.data)) {
    const oldMeta = value.meta;
    const identifiedWrapper = (isPlainObject(oldMeta) && (oldMeta.appId === APP_ID || oldMeta.storageKey === "toolstack.tripit.v1"))
      || (typeof value.exportedAt === "string" && isPlainObject(value.profile));
    if (identifiedWrapper) return { ok: true, kind: "legacy", label: "Legacy Trip-It backup", schemaVersion: 0, exportedAt: value.exportedAt, payload: value.data, profile: value.profile, migrationRequired: true };
  }
  if (operationalShape(value)) return { ok: true, kind: "legacy", label: "Legacy Trip-It backup", schemaVersion: 0, exportedAt: null, payload: value, profile: null, migrationRequired: true };
  if (Array.isArray(value.trips) && (own(value, "range") || own(value, "vehicle") || own(value, "fuel"))) {
    return { ok: false, code: "REPORT_NOT_RESTORABLE", errors: [issue("REPORT_NOT_RESTORABLE", "$", "This appears to be a legacy report export, not a full backup.")] };
  }
  return { ok: false, code: "UNKNOWN_EXPORT_TYPE", errors: [issue("UNKNOWN_EXPORT_TYPE", "$", "The file is not a recognized Trip-It full backup.")] };
}

function inspectSafeTree(value, limits, errors, path = "$", depth = 0) {
  if (depth > limits.maxDepth) { errors.push(issue("INVALID_SCHEMA", path, `Maximum nesting depth of ${limits.maxDepth} exceeded.`)); return; }
  if (typeof value === "string" && value.length > limits.maxStringLength) errors.push(issue("INVALID_SCHEMA", path, `String exceeds ${limits.maxStringLength} characters.`));
  if (value === null || typeof value !== "object") return;
  if (!Array.isArray(value) && !isPlainObject(value)) { errors.push(issue("INVALID_SCHEMA", path, "Value must be a plain object or array.")); return; }
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key)) { errors.push(issue("INVALID_SCHEMA", `${path}.${key}`, "Prototype-pollution key is forbidden.")); continue; }
    inspectSafeTree(value[key], limits, errors, `${path}.${key}`, depth + 1);
  }
}

const validDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const finiteWhenPresent = (value) => value === undefined || value === null || value === "" || Number.isFinite(Number(String(value).replace(",", ".")));

function validatePeopleFields(value, path, errors) {
  if (value.driver !== undefined && (typeof value.driver !== "string" || value.driver.length > MAX_DRIVER_LENGTH)) errors.push(issue("INVALID_SCHEMA", `${path}.driver`, `Driver must be a string of at most ${MAX_DRIVER_LENGTH} characters.`));
  if (value.passengers === undefined) return;
  if (!Array.isArray(value.passengers)) { errors.push(issue("INVALID_SCHEMA", `${path}.passengers`, "Passengers must be an array of strings.")); return; }
  if (value.passengers.length > MAX_PASSENGERS) errors.push(issue("INVALID_SCHEMA", `${path}.passengers`, `A trip may contain at most ${MAX_PASSENGERS} passengers.`));
  value.passengers.forEach((passenger, index) => {
    if (typeof passenger !== "string" || passenger.length > MAX_PASSENGER_LENGTH) errors.push(issue("INVALID_SCHEMA", `${path}.passengers[${index}]`, `Passenger must be a string of at most ${MAX_PASSENGER_LENGTH} characters.`));
  });
}

function validateEntriesMap(map, name, vehicleIds, limit, validateEntry, errors) {
  if (!isPlainObject(map)) { errors.push(issue("INVALID_SCHEMA", name, `${name} must be an object.`)); return 0; }
  let count = 0;
  for (const [vehicleId, entries] of Object.entries(map)) {
    if (!vehicleIds.has(vehicleId)) errors.push(issue("UNKNOWN_VEHICLE_REFERENCE", `${name}.${vehicleId}`, "Collection references an unknown vehicle."));
    if (!Array.isArray(entries)) { errors.push(issue("INVALID_SCHEMA", `${name}.${vehicleId}`, "Vehicle collection must be an array.")); continue; }
    count += entries.length;
    const ids = new Set();
    entries.forEach((entry, index) => {
      const path = `${name}.${vehicleId}[${index}]`;
      if (!isPlainObject(entry)) { errors.push(issue("INVALID_SCHEMA", path, "Entry must be a plain object.")); return; }
      if (typeof entry.id !== "string" || !entry.id.trim()) errors.push(issue("INVALID_SCHEMA", `${path}.id`, "Entry ID must be a nonempty string."));
      else if (ids.has(entry.id)) errors.push(issue("DUPLICATE_ID", `${path}.id`, `Duplicate ID ${entry.id}.`));
      else ids.add(entry.id);
      validateEntry(entry, path, vehicleId, errors);
    });
  }
  if (count > limit) errors.push(issue("INVALID_SCHEMA", name, `Collection exceeds the limit of ${limit}.`));
  return count;
}

function validateLegs(legs, path, errors, limits) {
  if (!Array.isArray(legs)) { errors.push(issue("INVALID_SCHEMA", path, "Legs must be an array.")); return 0; }
  if (legs.length > limits.maxLegs) errors.push(issue("INVALID_SCHEMA", path, `Leg count exceeds ${limits.maxLegs}.`));
  const ids = new Set();
  legs.forEach((leg, index) => {
    const legPath = `${path}[${index}]`;
    if (!isPlainObject(leg)) { errors.push(issue("INVALID_SCHEMA", legPath, "Leg must be a plain object.")); return; }
    if (typeof leg.id !== "string" || !leg.id.trim()) errors.push(issue("INVALID_SCHEMA", `${legPath}.id`, "Leg ID must be a nonempty string."));
    else if (ids.has(leg.id)) errors.push(issue("DUPLICATE_ID", `${legPath}.id`, `Duplicate leg ID ${leg.id}.`));
    else ids.add(leg.id);
    for (const field of ["odoStart", "odoEnd", "km"]) if (!finiteWhenPresent(leg[field])) errors.push(issue("INVALID_SCHEMA", `${legPath}.${field}`, `${field} must be finite when present.`));
    validatePeopleFields(leg, legPath, errors);
  });
  return legs.length;
}

export function validateApplicationPayload(payload, options = {}) {
  const limits = { ...IMPORT_LIMITS, ...(options.limits || {}) };
  const errors = [];
  const warnings = [];
  inspectSafeTree(payload, limits, errors);
  if (!isPlainObject(payload)) return { ok: false, code: "INVALID_SCHEMA", errors: [...errors, issue("INVALID_SCHEMA", "data", "Application payload must be a plain object.")], warnings };
  if (!Array.isArray(payload.vehicles)) errors.push(issue("INVALID_SCHEMA", "data.vehicles", "Vehicles must be an array."));
  const vehicles = Array.isArray(payload.vehicles) ? payload.vehicles : [];
  if (vehicles.length > limits.maxVehicles) errors.push(issue("INVALID_SCHEMA", "data.vehicles", `Vehicle count exceeds ${limits.maxVehicles}.`));
  const vehicleIds = new Set();
  vehicles.forEach((vehicle, index) => {
    const path = `data.vehicles[${index}]`;
    if (!isPlainObject(vehicle)) { errors.push(issue("INVALID_SCHEMA", path, "Vehicle must be a plain object.")); return; }
    if (typeof vehicle.id !== "string" || !vehicle.id.trim()) errors.push(issue("INVALID_SCHEMA", `${path}.id`, "Vehicle ID must be a nonempty string."));
    else if (vehicleIds.has(vehicle.id)) errors.push(issue("DUPLICATE_ID", `${path}.id`, `Duplicate vehicle ID ${vehicle.id}.`));
    else vehicleIds.add(vehicle.id);
    if (typeof vehicle.name !== "string" || !vehicle.name.trim()) errors.push(issue("INVALID_SCHEMA", `${path}.name`, "Vehicle name must be nonempty."));
  });
  if (payload.activeVehicleId !== null && typeof payload.activeVehicleId !== "string") errors.push(issue("INVALID_SCHEMA", "data.activeVehicleId", "Active vehicle ID must be a string or null."));
  else if (typeof payload.activeVehicleId === "string" && !vehicleIds.has(payload.activeVehicleId)) errors.push(issue("UNKNOWN_VEHICLE_REFERENCE", "data.activeVehicleId", "Active vehicle ID references an unknown vehicle."));

  let legCount = 0;
  const tripIds = new Set();
  const validateTrip = (trip, path, vehicleId, isActive = false) => {
    if (!isPlainObject(trip)) { errors.push(issue("INVALID_SCHEMA", path, "Trip must be a plain object.")); return; }
    if (typeof trip.id !== "string" || !trip.id.trim()) errors.push(issue("INVALID_SCHEMA", `${path}.id`, "Trip ID must be a nonempty string."));
    else if (tripIds.has(trip.id)) errors.push(issue("DUPLICATE_ID", `${path}.id`, `Duplicate trip ID ${trip.id}.`));
    else tripIds.add(trip.id);
    if (trip.vehicleId !== undefined && trip.vehicleId !== vehicleId) errors.push(issue("UNKNOWN_VEHICLE_REFERENCE", `${path}.vehicleId`, "Trip vehicleId does not match its containing vehicle."));
    if (!validDate(trip.startDate)) errors.push(issue("INVALID_SCHEMA", `${path}.startDate`, "Trip startDate must use YYYY-MM-DD."));
    // Trip-level people remain accepted only as migration input for older backups.
    validatePeopleFields(trip, path, errors);
    const supported = isActive ? ["active", undefined] : ["finished", undefined];
    if (!supported.includes(trip.status)) errors.push(issue("INVALID_SCHEMA", `${path}.status`, "Trip status is not supported."));
    legCount += validateLegs(trip.legs, `${path}.legs`, errors, limits);
  };

  let completedTripCount = 0;
  if (!isPlainObject(payload.tripsByVehicle)) errors.push(issue("INVALID_SCHEMA", "data.tripsByVehicle", "Trips container must be an object."));
  else for (const [vehicleId, trips] of Object.entries(payload.tripsByVehicle)) {
    if (!vehicleIds.has(vehicleId)) errors.push(issue("UNKNOWN_VEHICLE_REFERENCE", `data.tripsByVehicle.${vehicleId}`, "Trips reference an unknown vehicle."));
    if (!Array.isArray(trips)) { errors.push(issue("INVALID_SCHEMA", `data.tripsByVehicle.${vehicleId}`, "Trips must be an array.")); continue; }
    completedTripCount += trips.length;
    trips.forEach((trip, index) => validateTrip(trip, `data.tripsByVehicle.${vehicleId}[${index}]`, vehicleId));
  }
  if (completedTripCount > limits.maxTrips) errors.push(issue("INVALID_SCHEMA", "data.tripsByVehicle", `Trip count exceeds ${limits.maxTrips}.`));

  let activeTripCount = 0;
  if (!isPlainObject(payload.activeTripByVehicle)) errors.push(issue("INVALID_SCHEMA", "data.activeTripByVehicle", "Active trips container must be an object."));
  else for (const [vehicleId, trip] of Object.entries(payload.activeTripByVehicle)) {
    if (!vehicleIds.has(vehicleId)) errors.push(issue("UNKNOWN_VEHICLE_REFERENCE", `data.activeTripByVehicle.${vehicleId}`, "Active trip references an unknown vehicle."));
    if (trip !== null) { activeTripCount += 1; validateTrip(trip, `data.activeTripByVehicle.${vehicleId}`, vehicleId, true); }
  }
  if (legCount > limits.maxLegs) errors.push(issue("INVALID_SCHEMA", "data", `Total leg count exceeds ${limits.maxLegs}.`));

  const fuelEntryCount = validateEntriesMap(payload.fuelByVehicle, "data.fuelByVehicle", vehicleIds, limits.maxFuelEntries, (entry, path, _vehicleId, listErrors) => {
    for (const field of ["odometer", "liters", "totalCost"]) if (!finiteWhenPresent(entry[field])) listErrors.push(issue("INVALID_SCHEMA", `${path}.${field}`, `${field} must be finite when present.`));
    if (entry.date !== undefined && !validDate(entry.date)) listErrors.push(issue("INVALID_SCHEMA", `${path}.date`, "Fuel date must use YYYY-MM-DD."));
    if (entry.currency !== undefined && typeof entry.currency !== "string") listErrors.push(issue("INVALID_SCHEMA", `${path}.currency`, "Currency must be a string."));
  }, errors);
  const washEntryCount = validateEntriesMap(payload.washByVehicle, "data.washByVehicle", vehicleIds, limits.maxWashEntries, (entry, path, _vehicleId, listErrors) => {
    if (!finiteWhenPresent(entry.cost)) listErrors.push(issue("INVALID_SCHEMA", `${path}.cost`, "Wash cost must be finite when present."));
    if (entry.date !== undefined && !validDate(entry.date)) listErrors.push(issue("INVALID_SCHEMA", `${path}.date`, "Wash date must use YYYY-MM-DD."));
  }, errors);

  const drivers = payload.drivers === undefined ? [] : payload.drivers;
  if (!Array.isArray(drivers)) errors.push(issue("INVALID_SCHEMA", "data.drivers", "Drivers must be an array when present."));
  const driverIds = new Set();
  if (Array.isArray(drivers)) drivers.forEach((driver, index) => {
    const path = `data.drivers[${index}]`;
    if (!isPlainObject(driver)) { errors.push(issue("INVALID_SCHEMA", path, "Driver profile must be an object.")); return; }
    if (typeof driver.id !== "string" || !driver.id.trim()) errors.push(issue("INVALID_SCHEMA", `${path}.id`, "Driver ID must be nonempty."));
    else if (driverIds.has(driver.id)) errors.push(issue("DUPLICATE_ID", `${path}.id`, `Duplicate driver ID ${driver.id}.`));
    else driverIds.add(driver.id);
    if (typeof driver.fullName !== "string" || !driver.fullName.trim()) errors.push(issue("INVALID_SCHEMA", `${path}.fullName`, "Driver fullName must be nonempty."));
    if (driver.defaultVehicleId && !vehicleIds.has(driver.defaultVehicleId)) errors.push(issue("UNKNOWN_VEHICLE_REFERENCE", `${path}.defaultVehicleId`, "Default vehicle references an unknown vehicle."));
  });

  if (payload.profile !== undefined && !isPlainObject(payload.profile)) errors.push(issue("INVALID_SCHEMA", "data.profile", "Profile must be a plain object when present."));
  if (!isPlainObject(payload.ui)) errors.push(issue("INVALID_SCHEMA", "data.ui", "UI settings must be an object."));
  if (!Array.isArray(payload.templates)) errors.push(issue("INVALID_SCHEMA", "data.templates", "Templates must be an array."));
  const templates = Array.isArray(payload.templates) ? payload.templates : [];
  if (templates.length > limits.maxTemplates) errors.push(issue("INVALID_SCHEMA", "data.templates", `Template count exceeds ${limits.maxTemplates}.`));
  const templateIds = new Set();
  templates.forEach((template, index) => {
    const path = `data.templates[${index}]`;
    if (!isPlainObject(template)) { errors.push(issue("INVALID_SCHEMA", path, "Template must be a plain object.")); return; }
    if (typeof template.id !== "string" || !template.id.trim()) errors.push(issue("INVALID_SCHEMA", `${path}.id`, "Template ID must be nonempty."));
    else if (templateIds.has(template.id)) errors.push(issue("DUPLICATE_ID", `${path}.id`, `Duplicate template ID ${template.id}.`));
    else templateIds.add(template.id);
    if (!["trip", "leg"].includes(template.type)) errors.push(issue("INVALID_SCHEMA", `${path}.type`, "Template type must be trip or leg."));
    if (!isPlainObject(template.data)) errors.push(issue("INVALID_SCHEMA", `${path}.data`, "Template data must be a plain object."));
    else validatePeopleFields(template.data, `${path}.data`, errors);
  });

  const supportedKeys = new Set(["vehicles", "activeVehicleId", "activeTripByVehicle", "tripsByVehicle", "fuelByVehicle", "washByVehicle", "drivers", "ui", "templates"]);
  for (const key of Object.keys(payload)) if (!supportedKeys.has(key)) warnings.push(`Unsupported top-level field "${key}" was ignored by the current application schema.`);

  const counts = { vehicles: vehicles.length, completedTrips: completedTripCount, activeTrips: activeTripCount, legs: legCount, fuelEntries: fuelEntryCount, washEntries: washEntryCount, templates: templates.length };
  return { ok: errors.length === 0, code: errors[0]?.code || null, errors, warnings, counts };
}

export function prepareBackupImport({ text, size, normalize, limits }) {
  const effectiveLimits = { ...IMPORT_LIMITS, ...(limits || {}) };
  if (size > effectiveLimits.maxFileBytes) return { ok: false, code: "FILE_TOO_LARGE", errors: [issue("FILE_TOO_LARGE", "$file", `File exceeds ${effectiveLimits.maxFileBytes} bytes.`)] };
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { return { ok: false, code: "INVALID_JSON", errors: [issue("INVALID_JSON", "$", "File does not contain valid JSON.")] }; }
  const treeErrors = [];
  inspectSafeTree(parsed, effectiveLimits, treeErrors);
  if (treeErrors.length) return { ok: false, code: "INVALID_SCHEMA", errors: treeErrors };
  const identified = identifyBackup(parsed);
  if (!identified.ok) return identified;
  if (identified.profile !== undefined && identified.profile !== null) {
    if (!isPlainObject(identified.profile)) return { ok: false, code: "INVALID_SCHEMA", errors: [issue("INVALID_SCHEMA", "profile", "Profile must be a plain object when present.")] };
    for (const field of ["org", "user", "language", "logo"]) if (identified.profile[field] !== undefined && typeof identified.profile[field] !== "string") return { ok: false, code: "INVALID_SCHEMA", errors: [issue("INVALID_SCHEMA", `profile.${field}`, `${field} must be a string when present.`)] };
  }
  const sourceValidation = validateApplicationPayload(identified.payload, { limits: effectiveLimits });
  if (!sourceValidation.ok) return { ...sourceValidation, classification: identified };
  let candidate;
  try { candidate = normalize(identified.payload); }
  catch { return { ok: false, code: "INVALID_SCHEMA", errors: [issue("INVALID_SCHEMA", "data", "Backup could not be normalized safely.")] }; }
  const candidateValidation = validateApplicationPayload(candidate, { limits: effectiveLimits });
  if (!candidateValidation.ok) return { ...candidateValidation, classification: identified };
  const warnings = [...sourceValidation.warnings, ...candidateValidation.warnings];
  if (identified.migrationRequired) warnings.push("Legacy backup will be migrated to schema version 1.");
  return { ok: true, classification: identified, candidate, profile: identified.profile, counts: candidateValidation.counts, warnings };
}

export function requiresEmptyReplacementConfirmation(currentCounts, candidateCounts) {
  const currentTotal = Object.values(currentCounts).reduce((sum, value) => sum + value, 0);
  const candidateTotal = Object.values(candidateCounts).reduce((sum, value) => sum + value, 0);
  return currentTotal > 0 && candidateTotal === 0;
}
