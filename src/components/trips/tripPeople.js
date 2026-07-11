export const MAX_DRIVER_LENGTH = 150;
export const MAX_PASSENGERS = 50;
export const MAX_PASSENGER_LENGTH = 150;

export const normalizePersonName = (value) => String(value ?? "").trim().replace(/\s+/g, " ");
export const personKey = (value) => normalizePersonName(value).toLocaleLowerCase();

export function normalizeDriver(value) {
  return normalizePersonName(value).slice(0, MAX_DRIVER_LENGTH);
}

export function normalizePassengers(values, options = {}) {
  const limit = options.limit ?? MAX_PASSENGERS;
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const name = normalizePersonName(value);
    const key = personKey(name);
    if (!name || seen.has(key)) continue;
    if (name.length > MAX_PASSENGER_LENGTH || result.length >= limit) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

export function splitPassengerInput(value) {
  return String(value ?? "").split(",").map(normalizePersonName).filter(Boolean);
}

export function addPassengers(current, incoming) {
  const existing = normalizePassengers(current);
  const candidates = Array.isArray(incoming) ? incoming : splitPassengerInput(incoming);
  const invalid = candidates.find((name) => normalizePersonName(name).length > MAX_PASSENGER_LENGTH);
  if (invalid) return { values: existing, added: 0, error: `Passenger names must be ${MAX_PASSENGER_LENGTH} characters or fewer.` };
  const combined = normalizePassengers([...existing, ...candidates]);
  const uniqueIncoming = normalizePassengers(candidates);
  if (existing.length + uniqueIncoming.filter((name) => !existing.some((item) => personKey(item) === personKey(name))).length > MAX_PASSENGERS) {
    return { values: existing, added: 0, error: `A trip can have at most ${MAX_PASSENGERS} passengers.` };
  }
  if (combined.length === existing.length && uniqueIncoming.length) return { values: existing, added: 0, error: "Passenger is already added." };
  return { values: combined, added: combined.length - existing.length, error: "" };
}

export const removePassenger = (values, index) => normalizePassengers(values).filter((_, itemIndex) => itemIndex !== index);

export function applyPassengerInputAction(values, draft, action) {
  if (action.type === "backspace" && !draft && values.length) return { values: removePassenger(values, values.length - 1), draft: "", error: "" };
  if (action.type !== "commit") return { values, draft, error: "" };
  const result = addPassengers(values, action.value ?? draft);
  return { values: result.values, draft: result.added ? "" : draft, error: result.error };
}

export function normalizeTripPeople(trip) {
  return { ...trip, driver: normalizeDriver(trip?.driver), passengers: normalizePassengers(trip?.passengers) };
}

export function buildPeopleSuggestionItems(trips) {
  const drivers = [];
  const passengers = [];
  (Array.isArray(trips) ? trips : []).forEach((trip, index) => {
    const lastUsed = Date.parse(trip.finishedAt || trip.startedAt || trip.startDate) || (1_000_000_000_000 - index);
    const driver = normalizeDriver(trip.driver);
    if (driver) drivers.push({ value: driver, lastUsed, frequency: 1 });
    normalizePassengers(trip.passengers).forEach((value) => passengers.push({ value, lastUsed, frequency: 1 }));
  });
  return { drivers, passengers };
}

export function mergePassengerSets(currentValues, importedValues) {
  const current = normalizePassengers(currentValues);
  const imported = normalizePassengers(importedValues);
  const currentKeys = new Set(current.map(personKey));
  const importedKeys = new Set(imported.map(personKey));
  const currentSubset = [...currentKeys].every((key) => importedKeys.has(key));
  const importedSubset = [...importedKeys].every((key) => currentKeys.has(key));
  const equivalent = currentSubset && importedSubset;
  if (!current.length || !imported.length || currentSubset || equivalent) {
    return { compatible: true, values: normalizePassengers([...current, ...imported]), enriched: imported.some((name) => !currentKeys.has(personKey(name))) };
  }
  return { compatible: false, values: current, enriched: false };
}
