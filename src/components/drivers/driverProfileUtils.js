import { getTripEndOdometer, tripSummaryStats } from "../trips/legDisplayUtils.js";
import { normalizeDriver } from "../trips/tripPeople.js";

const text = (value) => String(value ?? "").trim();
const key = (value) => normalizeDriver(value).toLocaleLowerCase();
const legacyId = (name) => {
  let hash = 2166136261;
  for (const char of key(name)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `driver-${(hash >>> 0).toString(36)}`;
};

export function emptyDriverProfile(id = "") {
  return { id, fullName: "", displayName: "", phone: "", email: "", employeeNumber: "", licenceNumber: "", licenceCountry: "", licenceExpiry: "", startDate: "", defaultVehicleId: "", notes: "", active: true };
}

export function normalizeDriverProfile(value = {}, options = {}) {
  const legacyName = typeof value === "string" ? value : value.fullName ?? value.name ?? value.displayName;
  const fullName = normalizeDriver(legacyName);
  return {
    ...emptyDriverProfile(),
    ...(typeof value === "object" && value ? value : {}),
    id: text(value?.id) || options.id || legacyId(fullName),
    fullName,
    displayName: normalizeDriver(value?.displayName),
    phone: text(value?.phone), email: text(value?.email), employeeNumber: text(value?.employeeNumber),
    licenceNumber: text(value?.licenceNumber), licenceCountry: text(value?.licenceCountry), licenceExpiry: text(value?.licenceExpiry),
    startDate: text(value?.startDate), defaultVehicleId: text(value?.defaultVehicleId), notes: String(value?.notes ?? ""),
    active: value?.active !== false,
  };
}

export function normalizeDriverProfiles(values, tripsByVehicle = {}) {
  const profiles = []; const seenIds = new Set(); const seenNames = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const profile = normalizeDriverProfile(value);
    if (!profile.fullName || seenIds.has(profile.id)) continue;
    profiles.push(profile); seenIds.add(profile.id); seenNames.add(key(profile.fullName));
  }
  for (const trips of Object.values(tripsByVehicle || {})) for (const trip of Array.isArray(trips) ? trips : []) for (const leg of trip.legs || []) {
    const name = normalizeDriver(leg.driver); const nameKey = key(name);
    if (!name || seenNames.has(nameKey)) continue;
    const profile = normalizeDriverProfile(name);
    if (!seenIds.has(profile.id)) { profiles.push(profile); seenIds.add(profile.id); }
    seenNames.add(nameKey);
  }
  return profiles;
}

export const driverDisplayName = (profile) => profile.displayName || profile.fullName || "Unnamed driver";
export const driverMatchesLeg = (profile, leg) => {
  const driverKey = key(leg?.driver);
  return !!driverKey && [profile.fullName, profile.displayName].some((name) => key(name) === driverKey);
};

export function deriveDriverStatistics(profile, tripsByVehicle = {}, vehicles = []) {
  const vehicleNames = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.name]));
  const trips = [];
  for (const [vehicleId, vehicleTrips] of Object.entries(tripsByVehicle || {})) for (const trip of Array.isArray(vehicleTrips) ? vehicleTrips : []) {
    const matchingLegs = (trip.legs || []).filter((leg) => driverMatchesLeg(profile, leg));
    if (!matchingLegs.length) continue;
    const stats = tripSummaryStats({ ...trip, legs: matchingLegs });
    trips.push({ trip, vehicleId, vehicleName: vehicleNames.get(vehicleId) || "Unknown vehicle", distance: stats.totalKm, driveMinutes: stats.driveMinutes, driveTime: stats.totalDriveTime || "—", endOdometer: getTripEndOdometer(trip), legCount: matchingLegs.length, passengerInstances: matchingLegs.reduce((sum, leg) => sum + (Array.isArray(leg.passengers) ? leg.passengers.length : 0), 0) });
  }
  trips.sort((left, right) => String(right.trip.startDate || "").localeCompare(String(left.trip.startDate || "")) || String(right.trip.startedAt || "").localeCompare(String(left.trip.startedAt || "")));
  const totalMinutes = trips.reduce((sum, item) => sum + item.driveMinutes, 0);
  return { tripCount: trips.length, legCount: trips.reduce((sum, item) => sum + item.legCount, 0), totalDistance: trips.reduce((sum, item) => sum + item.distance, 0), totalDriveMinutes: totalMinutes, totalDriveTime: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`, passengerInstances: trips.reduce((sum, item) => sum + item.passengerInstances, 0), firstTrip: trips.at(-1)?.trip.startDate || null, latestTrip: trips[0]?.trip.startDate || null, recentTrips: trips.slice(0, 10) };
}

export function duplicateDriverProfile(profile, id) {
  return { ...normalizeDriverProfile(profile), id, fullName: `${profile.fullName} Copy`, displayName: profile.displayName ? `${profile.displayName} Copy` : "", employeeNumber: "", active: true };
}
