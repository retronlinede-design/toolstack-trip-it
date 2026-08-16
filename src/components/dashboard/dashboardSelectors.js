import { getTripPassengerSummary, legCompactSummary, tripSummaryStats } from "../trips/legDisplayUtils.js";
import { normalizeDriver, normalizePassengers } from "../trips/tripPeople.js";
import { fuelLogStats } from "../vehicle/vehicleLogUtils.js";

const list = (value) => Array.isArray(value) ? value : [];
const numericDate = (value) => String(value || "");

export function calendarMonthKey(value = new Date()) {
  if (typeof value === "string") return /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function routeForTrip(trip) {
  const legs = list(trip?.legs);
  if (!legs.length) return "";
  const origin = legs[0]?.startPlace || "Unknown start";
  const destination = legs.at(-1)?.endPlace || "Unknown destination";
  return `${origin} → ${destination}`;
}

function summarizeActiveTrip(trip, vehicle) {
  if (!trip) return null;
  const legs = list(trip.legs);
  const latestLeg = legs.at(-1) || null;
  const stats = tripSummaryStats({ ...trip, legs });
  const fallbackPassengers = normalizePassengers(trip.passengers);
  const passengers = latestLeg ? normalizePassengers(latestLeg.passengers) : fallbackPassengers;
  return {
    id: trip.id,
    title: trip.title || trip.purpose || "Untitled Trip",
    purpose: trip.purpose || "",
    route: routeForTrip(trip),
    vehicleId: vehicle?.id || trip.vehicleId || "",
    vehicleName: vehicle?.name || "Unknown vehicle",
    startDate: trip.startDate || "",
    startedAt: trip.startedAt || "",
    legCount: legs.length,
    distance: stats.totalKm,
    driver: normalizeDriver(latestLeg?.driver) || normalizeDriver(trip.driver),
    passengers,
    latestLegSummary: latestLeg ? legCompactSummary(latestLeg) : null,
  };
}

function sortDatedEntries(entries) {
  return list(entries).map((entry, index) => ({ entry, index })).sort((left, right) =>
    numericDate(right.entry?.date).localeCompare(numericDate(left.entry?.date)) || left.index - right.index
  ).map(({ entry }) => entry);
}

function sortRecentTrips(trips) {
  return list(trips).map((trip, index) => ({ trip, index })).sort((left, right) =>
    numericDate(right.trip?.startDate).localeCompare(numericDate(left.trip?.startDate))
    || numericDate(right.trip?.finishedAt).localeCompare(numericDate(left.trip?.finishedAt))
    || numericDate(right.trip?.startedAt).localeCompare(numericDate(left.trip?.startedAt))
    || left.index - right.index
  ).map(({ trip }) => trip);
}

function summarizeJourney(trip, vehicle) {
  const stats = tripSummaryStats(trip || {});
  const passengerSummary = getTripPassengerSummary(trip || {});
  const drivers = [...new Set(list(trip?.legs).map((leg) => normalizeDriver(leg?.driver)).filter(Boolean))];
  return {
    id: trip.id,
    vehicleId: vehicle?.id || trip.vehicleId || "",
    vehicleName: vehicle?.name || "Unknown vehicle",
    title: trip.title || trip.purpose || "Untitled Trip",
    purpose: trip.purpose || "",
    startDate: trip.startDate || "",
    route: routeForTrip(trip),
    distance: stats.totalKm,
    legCount: stats.legs,
    drivers,
    passengerCount: passengerSummary.instances,
  };
}

export function selectDashboardData(app, options = {}) {
  const month = calendarMonthKey(options.currentDate ?? new Date());
  const vehicles = list(app?.vehicles);
  const vehicle = vehicles.find((item) => item.id === app?.activeVehicleId) || null;
  if (!vehicle) return { month, vehicle: null, activeTrip: null, metrics: null, recentJourneys: [], vehicleOverview: null };

  const trips = list(app?.tripsByVehicle?.[vehicle.id]);
  const fuel = list(app?.fuelByVehicle?.[vehicle.id]);
  const wash = list(app?.washByVehicle?.[vehicle.id]);
  const monthTrips = trips.filter((trip) => calendarMonthKey(trip?.startDate) === month);
  const monthFuel = fuel.filter((entry) => calendarMonthKey(entry?.date) === month);
  const journeyStats = monthTrips.reduce((totals, trip) => {
    const stats = tripSummaryStats(trip);
    return { distance: totals.distance + stats.totalKm, legs: totals.legs + stats.legs };
  }, { distance: 0, legs: 0 });
  const fuelStats = fuelLogStats(monthFuel);
  const currencyTotals = Object.entries(fuelStats.currencyTotals).sort(([left], [right]) => left.localeCompare(right)).map(([currency, total]) => ({ currency, total }));
  const sortedFuel = sortDatedEntries(fuel);
  const sortedWash = sortDatedEntries(wash);
  const recentLimit = Number.isInteger(options.recentLimit) ? Math.max(0, options.recentLimit) : 5;

  return {
    month,
    vehicle: { ...vehicle },
    activeTrip: summarizeActiveTrip(app?.activeTripByVehicle?.[vehicle.id] || null, vehicle),
    metrics: {
      completedJourneys: monthTrips.length,
      completedLegs: journeyStats.legs,
      distance: journeyStats.distance,
      fuelLitres: fuelStats.liters,
      fuelEntries: fuelStats.count,
      fuelSpend: currencyTotals,
    },
    recentJourneys: sortRecentTrips(trips).slice(0, recentLimit).map((trip) => summarizeJourney(trip, vehicle)),
    vehicleOverview: {
      name: vehicle.name,
      makeModel: [vehicle.make, vehicle.model].filter(Boolean).join(" "),
      plate: vehicle.plate || "",
      hasActiveTrip: !!app?.activeTripByVehicle?.[vehicle.id],
      monthJourneys: monthTrips.length,
      monthDistance: journeyStats.distance,
      latestFuel: sortedFuel[0] ? { ...sortedFuel[0] } : null,
      latestWash: sortedWash[0] ? { ...sortedWash[0] } : null,
      latestFuelOdometer: sortedFuel.find((entry) => entry.odometer !== "" && entry.odometer != null)?.odometer ?? null,
    },
  };
}
