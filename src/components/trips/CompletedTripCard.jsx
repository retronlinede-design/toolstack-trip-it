import { getTripEndOdometer, getTripPassengerSummary, tripSummaryStats } from "./legDisplayUtils.js";
import { LegTimeline } from "./LegTimeline.jsx";

export function CompletedTripCard({ trip, vehicleName, expanded, onToggle, editingLegId, onEditLeg, onDeleteLeg, onAddLeg, onDeleteTrip, addingForm }) {
  const stats = tripSummaryStats(trip);
  const endOdometer = getTripEndOdometer(trip);
  const passengerSummary = getTripPassengerSummary(trip);
  const visiblePassengers = passengerSummary.distinctPassengers.slice(0, 3);
  const remainingPassengers = passengerSummary.distinctPassengers.length - visiblePassengers.length;
  const passengerLabel = visiblePassengers.length ? `${visiblePassengers.join(" · ")}${remainingPassengers > 0 ? ` · +${remainingPassengers}` : ""}` : "—";
  const endOdometerLabel = endOdometer == null ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(endOdometer);
  const panelId = `completed-trip-${trip.id}`;
  const range = stats.start || stats.end ? `${stats.start || "—"}–${stats.end || "—"}` : "";
  return <article className="ts-trip-record"><button type="button" className="ts-trip-record__summary" aria-expanded={expanded} aria-controls={panelId} onClick={onToggle}><span className="min-w-0"><span className="ts-trip-record__title">{trip.title || "Untitled Trip"}</span><span className="ts-trip-record__eyebrow">{trip.startDate} · {vehicleName}{trip.purpose ? ` · ${trip.purpose}` : ""}</span><span className="ts-trip-record__metrics"><span>{stats.legs} legs</span><span className="ts-trip-record__distance">{stats.totalKm.toFixed(1)} km</span><span>End KM {endOdometerLabel}</span>{range && <span>{range}</span>}</span><span className="ts-trip-record__people"><span className="font-medium">Passengers:</span> {passengerLabel}</span></span><span className="ts-disclosure-control" aria-hidden="true">{expanded ? "−" : "+"}</span></button>
    {expanded && <div id={panelId} className="ts-trip-record__details"><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"><Stat label="Legs" value={stats.legs} /><Stat label="Distance" value={`${stats.totalKm.toFixed(1)} km`} /><Stat label="Total Drive Time" value={stats.totalDriveTime || "—"} /><Stat label="Passenger instances" value={stats.passengers} /><Stat label="Drivers" value={stats.distinctDrivers} /><Stat label="End KM" value={endOdometerLabel} /></div><div className="ts-trip-inset text-sm"><div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Passengers</div><div className="mt-1 break-words text-neutral-800">{passengerSummary.distinctPassengers.length ? passengerSummary.distinctPassengers.join(" · ") : "—"}</div></div><LegTimeline legs={trip.legs || []} context="history" editingLegId={editingLegId} onEdit={onEditLeg} onDelete={onDeleteLeg} emptyMessage="No legs recorded for this trip." />{addingForm}<div className="flex flex-wrap justify-between gap-2 border-t border-neutral-200 pt-3"><button type="button" className="ts-button ts-button--secondary" onClick={onAddLeg}>Add leg</button><button type="button" className="ts-button ts-button--danger" onClick={onDeleteTrip}>Delete trip</button></div></div>}
  </article>;
}

function Stat({ label, value }) { return <div className="ts-trip-stat"><div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div><div className="mt-0.5 text-sm font-semibold text-neutral-800">{value}</div></div>; }
