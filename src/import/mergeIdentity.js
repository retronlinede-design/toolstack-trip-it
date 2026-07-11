const META_FIELDS = new Set(["createdAt", "updatedAt", "importedAt"]);

export const blank = (value) => value === undefined || value === null || (typeof value === "string" && value.trim() === "");
export const normalizeText = (value) => String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
export const normalizeVehicleCode = (value) => normalizeText(value).replace(/[^a-z0-9]/g, "").toUpperCase();

export function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).filter((key) => !META_FIELDS.has(key)).sort().map((key) => [key, ["plate", "vin"].includes(key) ? normalizeVehicleCode(value[key]) : canonicalValue(value[key])]));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed !== "" && Number.isFinite(Number(trimmed.replace(",", ".")))) return Number(trimmed.replace(",", "."));
    return trimmed;
  }
  return value;
}

export const deepEquivalent = (left, right) => JSON.stringify(canonicalValue(left)) === JSON.stringify(canonicalValue(right));

export function probableVehicleMatch(left, right) {
  const leftVin = normalizeVehicleCode(left.vin);
  const rightVin = normalizeVehicleCode(right.vin);
  if (leftVin && rightVin && leftVin === rightVin) return { match: true, reason: "Matching normalized VIN" };
  const leftPlate = normalizeVehicleCode(left.plate);
  const rightPlate = normalizeVehicleCode(right.plate);
  if (leftPlate && rightPlate && leftPlate === rightPlate && (!leftVin || !rightVin || leftVin === rightVin)) return { match: true, reason: "Matching normalized registration plate with no conflicting VIN" };
  return { match: false };
}

const same = (left, right) => canonicalValue(left) === canonicalValue(right);

export function probableLegMatch(left, right) {
  return ["startPlace", "endPlace", "startTime", "endTime", "odoStart", "odoEnd", "km"].every((field) => same(left[field], right[field]));
}

export function probableTripMatch(left, right, resolvedVehicleId) {
  if ((left.vehicleId || resolvedVehicleId) !== resolvedVehicleId) return false;
  if (!same(left.startDate, right.startDate) || normalizeText(left.title) !== normalizeText(right.title) || normalizeText(left.purpose) !== normalizeText(right.purpose)) return false;
  const leftLegs = left.legs || [];
  const rightLegs = right.legs || [];
  if (leftLegs.length !== rightLegs.length || !leftLegs.every((leg, index) => probableLegMatch(leg, rightLegs[index]))) return false;
  const firstLeft = leftLegs[0]; const firstRight = rightLegs[0]; const lastLeft = leftLegs.at(-1); const lastRight = rightLegs.at(-1);
  return (!firstLeft || same(firstLeft.odoStart, firstRight?.odoStart)) && (!lastLeft || same(lastLeft.odoEnd, lastRight?.odoEnd));
}

export function probableFuelMatch(left, right) {
  return ["date", "odometer", "liters", "totalCost"].every((field) => same(left[field], right[field])) && normalizeText(left.station) === normalizeText(right.station);
}

export function probableWashMatch(left, right) {
  return ["date", "cost"].every((field) => same(left[field], right[field])) && normalizeText(left.type) === normalizeText(right.type) && normalizeText(left.location) === normalizeText(right.location);
}

export function probableTemplateMatch(left, right) {
  return left.type === right.type && normalizeText(left.name) === normalizeText(right.name) && deepEquivalent(left.data, right.data);
}

export function deterministicUniqueId(baseId, usedIds) {
  const root = `${baseId}-imported`;
  let candidate = root;
  let suffix = 2;
  while (usedIds.has(candidate)) candidate = `${root}-${suffix++}`;
  return candidate;
}
