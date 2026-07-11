import { blank, deepEquivalent, deterministicUniqueId, probableFuelMatch, probableLegMatch, probableTemplateMatch, probableTripMatch, probableVehicleMatch, probableWashMatch } from "./mergeIdentity.js";

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const TYPES = ["vehicles", "trips", "legs", "fuel", "wash", "templates", "activeTrips"];
const emptyStats = () => Object.fromEntries(TYPES.map((type) => [type, { added: 0, updated: 0, skipped: 0, matched: 0, probable: 0, conflicts: 0 }]));
const validTime = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));

function mergeMetadata(result, current, imported) {
  const created = [current.createdAt, imported.createdAt].filter(validTime).sort();
  const updated = [current.updatedAt, imported.updatedAt].filter(validTime).sort();
  if (created.length) result.createdAt = created[0];
  if (updated.length) result.updatedAt = updated.at(-1);
  if (current.importedAt) result.importedAt = current.importedAt;
  return result;
}

export function compatibleMerge(current, imported, ignored = new Set(["id"])) {
  const result = clone(current);
  const conflicts = [];
  let enriched = false;
  for (const key of new Set([...Object.keys(current), ...Object.keys(imported)])) {
    if (ignored.has(key) || ["createdAt", "updatedAt", "importedAt"].includes(key)) continue;
    const left = current[key]; const right = imported[key];
    if (deepEquivalent(left, right) || blank(right)) continue;
    if (blank(left)) { result[key] = clone(right); enriched = true; }
    else conflicts.push({ field: key, current: left, imported: right });
  }
  mergeMetadata(result, current, imported);
  return { compatible: conflicts.length === 0, enriched, value: result, differences: conflicts };
}

function conflictKey(type, scope, id) { return `${type}:${scope || "root"}:${id}`; }
function probableKey(type, scope, currentId, importedId) { return `probable:${type}:${scope || "root"}:${currentId}:${importedId}`; }
function newRecord(record, importedAt) { const value = clone(record); if (!value.importedAt) value.importedAt = importedAt; return value; }
function previouslyKeptBoth(records, imported) {
  return records.find((record) => record.id.startsWith(`${imported.id}-imported`) && deepEquivalent(record, { ...imported, id: record.id }));
}
const hasSourceAlias = (record, importedId) => Array.isArray(record.mergeSourceIds) && record.mergeSourceIds.includes(importedId);
function markSourceAlias(record, importedId) {
  record.mergeSourceIds = [...new Set([...(record.mergeSourceIds || []), importedId])].sort();
}

function addConflict(plan, type, scope, current, imported, reason, options) {
  const key = conflictKey(type, scope, current.id);
  plan.conflicts.push({ key, type, scope, identity: current.id, reason, current, imported, options });
  plan.stats[type].conflicts += 1;
  return plan.resolutions[key];
}

function addProbable(plan, type, scope, current, imported, reason) {
  const key = probableKey(type, scope, current.id, imported.id);
  plan.probableDuplicates.push({ key, type, scope, identity: `${current.id} / ${imported.id}`, reason, current, imported, options: ["same", "both", "skip"] });
  plan.stats[type].probable += 1;
  return plan.resolutions[key];
}

function mergeLegs(currentTrip, importedTrip, plan, scope, importedAt) {
  const result = clone(currentTrip.legs || []); const byId = new Map(result.map((item) => [item.id, item])); const used = new Set(byId.keys());
  for (const importedLeg of importedTrip.legs || []) {
    const existing = byId.get(importedLeg.id);
    if (existing) {
      if (deepEquivalent(existing, importedLeg)) { plan.stats.legs.skipped += 1; continue; }
      if (previouslyKeptBoth(result, importedLeg)) { plan.stats.legs.skipped += 1; continue; }
      const merged = compatibleMerge(existing, importedLeg);
      if (merged.compatible) { if (merged.enriched) { Object.assign(existing, merged.value); plan.stats.legs.updated += 1; } else plan.stats.legs.skipped += 1; continue; }
      const resolution = addConflict(plan, "legs", scope, existing, importedLeg, `Same leg ID has conflicting fields: ${merged.differences.map((item) => item.field).join(", ")}`, ["current", "imported", "both"]);
      if (resolution === "imported") Object.assign(existing, clone(importedLeg));
      if (resolution === "both") { const id = deterministicUniqueId(importedLeg.id, used); used.add(id); result.push(newRecord({ ...importedLeg, id }, importedAt)); plan.stats.legs.added += 1; }
      continue;
    }
    const alias = result.find((item) => hasSourceAlias(item, importedLeg.id));
    if (alias) { plan.stats.legs.skipped += 1; continue; }
    const probable = result.find((item) => probableLegMatch(item, importedLeg));
    if (probable) {
      const decision = addProbable(plan, "legs", scope, probable, importedLeg, "Route, times, odometers, and distance match");
      if (decision === "both") { result.push(newRecord(importedLeg, importedAt)); used.add(importedLeg.id); plan.stats.legs.added += 1; }
      else if (decision === "same") { const merged = compatibleMerge(probable, importedLeg, new Set(["id"])); if (merged.compatible) Object.assign(probable, merged.value); markSourceAlias(probable, importedLeg.id); plan.stats.legs.skipped += 1; }
      else if (decision === "skip") plan.stats.legs.skipped += 1;
      continue;
    }
    result.push(newRecord(importedLeg, importedAt)); used.add(importedLeg.id); plan.stats.legs.added += 1;
  }
  return result.sort((left, right) => String(left.startTime || "").localeCompare(String(right.startTime || "")) || left.id.localeCompare(right.id));
}

function mergeList(currentList, importedList, plan, type, scope, probableMatch, importedAt) {
  const result = clone(currentList || []); const byId = new Map(result.map((item) => [item.id, item])); const used = new Set(byId.keys());
  for (const imported of importedList || []) {
    const existing = byId.get(imported.id);
    if (existing) {
      if (deepEquivalent(existing, imported)) { plan.stats[type].skipped += 1; continue; }
      if (previouslyKeptBoth(result, imported)) { plan.stats[type].skipped += 1; continue; }
      const merged = compatibleMerge(existing, imported);
      if (merged.compatible) { if (merged.enriched) { Object.assign(existing, merged.value); plan.stats[type].updated += 1; } else plan.stats[type].skipped += 1; continue; }
      const resolution = addConflict(plan, type, scope, existing, imported, `Same ID has conflicting fields: ${merged.differences.map((item) => item.field).join(", ")}`, ["current", "imported", "both"]);
      if (resolution === "imported") Object.assign(existing, clone(imported));
      if (resolution === "both") {
        const generated = deterministicUniqueId(imported.id, used);
        const already = result.find((item) => item.id === generated && deepEquivalent(item, imported));
        if (!already) { used.add(generated); result.push(newRecord({ ...imported, id: generated }, importedAt)); plan.stats[type].added += 1; }
      }
      continue;
    }
    const alias = result.find((item) => hasSourceAlias(item, imported.id));
    if (alias) { plan.stats[type].skipped += 1; continue; }
    const probable = result.find((item) => probableMatch?.(item, imported));
    if (probable) {
      const decision = addProbable(plan, type, scope, probable, imported, "Different IDs have the same substantive identity fields");
      if (decision === "both") { result.push(newRecord(imported, importedAt)); used.add(imported.id); plan.stats[type].added += 1; }
      else if (decision === "same") { const merged = compatibleMerge(probable, imported, new Set(["id"])); if (merged.compatible) Object.assign(probable, merged.value); markSourceAlias(probable, imported.id); plan.stats[type].skipped += 1; }
      else if (decision === "skip") plan.stats[type].skipped += 1;
      continue;
    }
    result.push(newRecord(imported, importedAt)); used.add(imported.id); plan.stats[type].added += 1;
  }
  return result.sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")) || left.id.localeCompare(right.id));
}

function mergeTrips(currentList, importedList, plan, vehicleId, importedAt) {
  const result = clone(currentList || []); const byId = new Map(result.map((item) => [item.id, item])); const used = new Set(byId.keys());
  for (const source of importedList || []) {
    const imported = { ...clone(source), vehicleId };
    const existing = byId.get(imported.id);
    const otherOwner = !existing ? plan.tripIdOwners.get(imported.id) : null;
    if (otherOwner && otherOwner.vehicleId !== vehicleId) {
      if (plan.remappedVehicleTargets.has(vehicleId)) {
        const id = deterministicUniqueId(imported.id, plan.globalTripIds);
        plan.globalTripIds.add(id); used.add(id); result.push(newRecord({ ...imported, id }, importedAt)); plan.stats.trips.added += 1; plan.stats.legs.added += imported.legs?.length || 0;
        continue;
      }
      const resolution = addConflict(plan, "trips", vehicleId, otherOwner.trip, imported, `Trip ID already belongs to vehicle ${otherOwner.vehicleId}`, ["current", "both"]);
      if (resolution === "both") {
        const id = deterministicUniqueId(imported.id, plan.globalTripIds);
        plan.globalTripIds.add(id); used.add(id); result.push(newRecord({ ...imported, id }, importedAt)); plan.stats.trips.added += 1; plan.stats.legs.added += imported.legs?.length || 0;
      }
      continue;
    }
    if (existing) {
      if (previouslyKeptBoth(result, imported)) { plan.stats.trips.skipped += 1; plan.stats.legs.skipped += imported.legs?.length || 0; continue; }
      const importedWithoutLegs = { ...imported, legs: undefined }; const existingWithoutLegs = { ...existing, legs: undefined };
      const base = compatibleMerge(existingWithoutLegs, importedWithoutLegs, new Set(["id", "legs"]));
      if (!base.compatible) {
        const resolution = addConflict(plan, "trips", vehicleId, existing, imported, `Same trip ID has conflicting fields: ${base.differences.map((item) => item.field).join(", ")}`, ["current", "imported", "both"]);
        if (resolution === "imported") Object.assign(existing, imported);
        if (resolution === "both") { const id = deterministicUniqueId(imported.id, plan.globalTripIds); used.add(id); plan.globalTripIds.add(id); result.push(newRecord({ ...imported, id }, importedAt)); plan.stats.trips.added += 1; }
        continue;
      }
      const before = JSON.stringify(existing); Object.assign(existing, base.value); existing.legs = mergeLegs(existing, imported, plan, imported.id, importedAt);
      if (JSON.stringify(existing) === before) plan.stats.trips.skipped += 1; else plan.stats.trips.updated += 1;
      continue;
    }
    const alias = result.find((item) => hasSourceAlias(item, imported.id));
    if (alias) { plan.stats.trips.skipped += 1; plan.stats.legs.skipped += imported.legs?.length || 0; continue; }
    const probable = result.find((item) => probableTripMatch(item, imported, vehicleId));
    if (probable) {
      const decision = addProbable(plan, "trips", vehicleId, probable, imported, "Date, title, purpose, route, legs, and available odometers substantially match");
      if (decision === "both") { result.push(newRecord(imported, importedAt)); used.add(imported.id); plan.globalTripIds.add(imported.id); plan.stats.trips.added += 1; }
      else if (decision === "same") { const merged = compatibleMerge(probable, imported, new Set(["id", "legs"])); if (merged.compatible) Object.assign(probable, merged.value); markSourceAlias(probable, imported.id); plan.stats.trips.skipped += 1; }
      else if (decision === "skip") plan.stats.trips.skipped += 1;
      continue;
    }
    result.push(newRecord(imported, importedAt)); used.add(imported.id); plan.globalTripIds.add(imported.id); plan.stats.trips.added += 1; plan.stats.legs.added += imported.legs?.length || 0;
  }
  return result.sort((left, right) => String(right.startDate || "").localeCompare(String(left.startDate || "")) || left.id.localeCompare(right.id));
}

function resolveActive(current, imported, plan, vehicleId, importedAt) {
  if (!imported) return clone(current);
  const remapped = { ...clone(imported), vehicleId };
  if (!current) { plan.stats.activeTrips.added += 1; return newRecord(remapped, importedAt); }
  if (deepEquivalent(current, remapped)) { plan.stats.activeTrips.skipped += 1; return clone(current); }
  const key = conflictKey("activeTrips", vehicleId, current.id);
  plan.conflicts.push({ key, type: "activeTrips", scope: vehicleId, identity: `${current.id} / ${remapped.id}`, reason: "Current and imported active trips differ", current, imported: remapped, options: ["current", "imported", "complete", "discard"] });
  plan.stats.activeTrips.conflicts += 1;
  const decision = plan.resolutions[key];
  if (decision === "imported") return remapped;
  if (decision === "complete") { plan.convertedActive.push({ ...remapped, status: "finished", finishedAt: remapped.finishedAt || importedAt }); return clone(current); }
  return clone(current);
}

export function createMergePlan(currentData, importedData, options = {}) {
  const current = clone(currentData); const imported = clone(importedData); const importedAt = options.importedAt || new Date().toISOString();
  const plan = { stats: emptyStats(), conflicts: [], probableDuplicates: [], resolutions: options.resolutions || {}, vehicleMap: {}, convertedActive: [], candidate: current };
  plan.tripIdOwners = new Map();
  plan.remappedVehicleTargets = new Set();
  for (const [vehicleId, trips] of Object.entries(current.tripsByVehicle)) for (const trip of trips) plan.tripIdOwners.set(trip.id, { vehicleId, trip });
  for (const [vehicleId, trip] of Object.entries(current.activeTripByVehicle)) if (trip) plan.tripIdOwners.set(trip.id, { vehicleId, trip });
  plan.globalTripIds = new Set(plan.tripIdOwners.keys());
  const vehicles = clone(current.vehicles); const currentById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  for (const importedVehicle of imported.vehicles) {
    const sameId = currentById.get(importedVehicle.id);
    if (sameId) {
      plan.vehicleMap[importedVehicle.id] = sameId.id;
      if (deepEquivalent(sameId, importedVehicle)) { plan.stats.vehicles.skipped += 1; continue; }
      const priorRemap = previouslyKeptBoth(vehicles, importedVehicle);
      if (priorRemap) { plan.vehicleMap[importedVehicle.id] = priorRemap.id; plan.stats.vehicles.skipped += 1; continue; }
      const merged = compatibleMerge(sameId, importedVehicle);
      if (merged.compatible) { if (merged.enriched) { Object.assign(sameId, merged.value); plan.stats.vehicles.updated += 1; } else plan.stats.vehicles.skipped += 1; continue; }
      const resolution = addConflict(plan, "vehicles", null, sameId, importedVehicle, `Same vehicle ID has conflicting fields: ${merged.differences.map((item) => item.field).join(", ")}`, ["current", "imported", "remap"]);
      if (resolution === "imported") Object.assign(sameId, clone(importedVehicle));
      if (resolution === "remap") {
        const used = new Set(vehicles.map((vehicle) => vehicle.id));
        const id = deterministicUniqueId(importedVehicle.id, used);
        vehicles.push(newRecord({ ...importedVehicle, id }, importedAt));
        currentById.set(id, vehicles.at(-1));
        plan.vehicleMap[importedVehicle.id] = id;
        plan.remappedVehicleTargets.add(id);
        plan.stats.vehicles.added += 1;
      }
      continue;
    }
    const aliasedVehicle = vehicles.find((vehicle) => hasSourceAlias(vehicle, importedVehicle.id));
    if (aliasedVehicle) { plan.vehicleMap[importedVehicle.id] = aliasedVehicle.id; plan.stats.vehicles.skipped += 1; continue; }
    const probable = vehicles.find((vehicle) => probableVehicleMatch(vehicle, importedVehicle).match);
    if (probable) {
      const evidence = probableVehicleMatch(probable, importedVehicle);
      const decision = addProbable(plan, "vehicles", null, probable, importedVehicle, evidence.reason);
      if (decision === "same") { plan.vehicleMap[importedVehicle.id] = probable.id; markSourceAlias(probable, importedVehicle.id); const merged = compatibleMerge(probable, importedVehicle, new Set(["id", "mergeSourceIds"])); if (merged.compatible && merged.enriched) { Object.assign(probable, merged.value); markSourceAlias(probable, importedVehicle.id); plan.stats.vehicles.updated += 1; } else plan.stats.vehicles.matched += 1; }
      else if (decision === "both") { vehicles.push(newRecord(importedVehicle, importedAt)); currentById.set(importedVehicle.id, vehicles.at(-1)); plan.vehicleMap[importedVehicle.id] = importedVehicle.id; plan.stats.vehicles.added += 1; }
      else if (decision === "skip") plan.vehicleMap[importedVehicle.id] = null;
      continue;
    }
    vehicles.push(newRecord(importedVehicle, importedAt)); currentById.set(importedVehicle.id, vehicles.at(-1)); plan.vehicleMap[importedVehicle.id] = importedVehicle.id; plan.stats.vehicles.added += 1;
  }
  plan.candidate.vehicles = vehicles.sort((left, right) => left.id.localeCompare(right.id));

  for (const importedVehicle of imported.vehicles) {
    const sourceId = importedVehicle.id; const targetId = plan.vehicleMap[sourceId];
    if (!targetId) continue;
    plan.candidate.tripsByVehicle[targetId] = mergeTrips(plan.candidate.tripsByVehicle[targetId] || [], imported.tripsByVehicle[sourceId] || [], plan, targetId, importedAt);
    plan.candidate.fuelByVehicle[targetId] = mergeList(plan.candidate.fuelByVehicle[targetId] || [], imported.fuelByVehicle[sourceId] || [], plan, "fuel", targetId, probableFuelMatch, importedAt);
    plan.candidate.washByVehicle[targetId] = mergeList(plan.candidate.washByVehicle[targetId] || [], imported.washByVehicle[sourceId] || [], plan, "wash", targetId, probableWashMatch, importedAt);
    let importedActive = imported.activeTripByVehicle[sourceId];
    if (importedActive && plan.remappedVehicleTargets.has(targetId) && plan.globalTripIds.has(importedActive.id)) {
      const id = deterministicUniqueId(importedActive.id, plan.globalTripIds); plan.globalTripIds.add(id); importedActive = { ...importedActive, id };
    }
    plan.candidate.activeTripByVehicle[targetId] = resolveActive(plan.candidate.activeTripByVehicle[targetId], importedActive, plan, targetId, importedAt);
    if (plan.convertedActive.length) {
      plan.candidate.tripsByVehicle[targetId] = mergeTrips(plan.candidate.tripsByVehicle[targetId] || [], plan.convertedActive.splice(0), plan, targetId, importedAt);
    }
  }
  plan.candidate.templates = mergeList(plan.candidate.templates || [], imported.templates || [], plan, "templates", null, probableTemplateMatch, importedAt)
    .sort((left, right) => `${left.type}:${left.name}:${left.id}`.localeCompare(`${right.type}:${right.name}:${right.id}`));
  const unresolvedConflicts = plan.conflicts.filter((item) => !plan.resolutions[item.key]);
  const unresolvedProbables = plan.probableDuplicates.filter((item) => !plan.resolutions[item.key]);
  plan.unresolved = [...unresolvedConflicts, ...unresolvedProbables];
  plan.ready = plan.unresolved.length === 0;
  plan.finalCounts = {
    vehicles: plan.candidate.vehicles.length,
    completedTrips: Object.values(plan.candidate.tripsByVehicle).reduce((sum, list) => sum + list.length, 0),
    activeTrips: Object.values(plan.candidate.activeTripByVehicle).filter(Boolean).length,
    legs: Object.values(plan.candidate.tripsByVehicle).flat().reduce((sum, trip) => sum + (trip.legs?.length || 0), 0) + Object.values(plan.candidate.activeTripByVehicle).filter(Boolean).reduce((sum, trip) => sum + (trip.legs?.length || 0), 0),
    fuelEntries: Object.values(plan.candidate.fuelByVehicle).reduce((sum, list) => sum + list.length, 0),
    washEntries: Object.values(plan.candidate.washByVehicle).reduce((sum, list) => sum + list.length, 0),
    templates: plan.candidate.templates.length,
  };
  return plan;
}
