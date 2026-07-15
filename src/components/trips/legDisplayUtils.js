const numberValue = (value) => Number(String(value ?? "").replace(",", "."));
export const validOdometer = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(numberValue(value));

export function getTripEndOdometer(trip) {
  const legs = Array.isArray(trip?.legs) ? trip.legs : [];
  const finalLeg = legs.at(-1);
  if (!finalLeg) return null;

  const value = finalLeg.odoEnd ?? finalLeg.endOdometer;
  return validOdometer(value) ? numberValue(value) : null;
}

export function legCompactSummary(leg) {
  return {
    route: `${leg.startPlace || "Unknown start"} → ${leg.endPlace || "Unknown destination"}`,
    journey: `${leg.startTime || "—"}–${leg.endTime || "—"} · ${Number.isFinite(Number(leg.km)) ? `${Number(leg.km).toFixed(1)} km` : "Distance unavailable"}`,
    people: `${leg.driver || "No driver"} · ${(leg.passengers || []).length ? `${leg.passengers.length} ${(leg.passengers.length === 1 ? "passenger" : "passengers")}` : "No passengers"}`,
    metadata: [leg.note ? "Note" : "", [leg.startTag, leg.endTag].filter(Boolean).length ? `${[leg.startTag, leg.endTag].filter(Boolean).length} tags` : ""].filter(Boolean).join(" · "),
  };
}

export function tripSummaryStats(trip) {
  const legs = trip.legs || [];
  const drivers = new Set(legs.map((leg) => String(leg.driver || "").trim().toLocaleLowerCase()).filter(Boolean));
  const passengers = legs.reduce((sum, leg) => sum + (Array.isArray(leg.passengers) ? leg.passengers.length : 0), 0);
  const totalKm = legs.reduce((sum, leg) => sum + (Number.isFinite(Number(leg.km)) ? Number(leg.km) : 0), 0);
  const start = legs.find((leg) => leg.startTime)?.startTime || "";
  const end = [...legs].reverse().find((leg) => leg.endTime)?.endTime || "";
  let duration = "";
  if (/^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end) && end >= start) {
    const [sh, sm] = start.split(":").map(Number); const [eh, em] = end.split(":").map(Number);
    const minutes = eh * 60 + em - sh * 60 - sm;
    duration = `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }
  return { legs: legs.length, totalKm, passengers, distinctDrivers: drivers.size, start, end, duration };
}

export const deleteLegConfirmation = (leg) => `Delete leg “${leg.startPlace || "Unknown start"} → ${leg.endPlace || "Unknown destination"}”? This cannot be undone.`;
export const deleteTripConfirmation = (trip) => `Delete trip “${trip.title || "Untitled Trip"}” and all of its legs? This cannot be undone.`;
