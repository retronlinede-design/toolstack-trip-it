import { normalizePassengers } from "./tripPeople.js";

const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function createTripsCsv(trips) {
  const rows = [["Date", "Trip Title", "Driver", "Passengers", "Start Place", "End Place", "Start Time", "End Time", "Distance (km)", "Odo Start", "Odo End", "Notes"]];
  trips.forEach((trip) => ((trip.legs || []).length ? trip.legs : [{}]).forEach((leg) => rows.push([
    trip.startDate, trip.title || trip.purpose || "", trip.driver || "", normalizePassengers(trip.passengers).join("; "), leg.startPlace, leg.endPlace,
    leg.startTime, leg.endTime, leg.km, leg.odoStart, leg.odoEnd, leg.note || ""
  ])));
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}
