import { getTripEndOdometer, tripSummaryStats } from "./legDisplayUtils.js";
import { LegTimeline } from "./LegTimeline.jsx";

export function CompletedTripCard({ trip, vehicleName, expanded, onToggle, editingLegId, onEditLeg, onDeleteLeg, onAddLeg, onDeleteTrip, addingForm }) {
  const stats = tripSummaryStats(trip);
  const endOdometer = getTripEndOdometer(trip);
  const endOdometerLabel = endOdometer == null ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(endOdometer);
  const panelId = `completed-trip-${trip.id}`;
  const range = stats.start || stats.end ? `${stats.start || "—"}–${stats.end || "—"}` : "";
  return <article className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"><button type="button" className="flex w-full items-start justify-between gap-3 p-3 text-left hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime-400" aria-expanded={expanded} aria-controls={panelId} onClick={onToggle}><span className="min-w-0"><span className="block font-semibold text-neutral-800">{trip.title || "Untitled Trip"}</span><span className="mt-1 block text-xs text-neutral-500">{trip.startDate} · {vehicleName}{trip.purpose ? ` · ${trip.purpose}` : ""}</span><span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-600"><span>{stats.legs} legs</span><span>{stats.totalKm.toFixed(1)} km</span><span>End KM {endOdometerLabel}</span>{range && <span>{range}</span>}</span></span><span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-neutral-500" aria-hidden="true">{expanded ? "−" : "+"}</span></button>
    {expanded && <div id={panelId} className="space-y-3 border-t border-neutral-100 bg-neutral-50 p-3"><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"><Stat label="Legs" value={stats.legs} /><Stat label="Distance" value={`${stats.totalKm.toFixed(1)} km`} /><Stat label="Total Drive Time" value={stats.totalDriveTime || "—"} /><Stat label="Passenger instances" value={stats.passengers} /><Stat label="Drivers" value={stats.distinctDrivers} /><Stat label="End KM" value={endOdometerLabel} /></div><LegTimeline legs={trip.legs || []} context="history" editingLegId={editingLegId} onEdit={onEditLeg} onDelete={onDeleteLeg} emptyMessage="No legs recorded for this trip." />{addingForm}<div className="flex flex-wrap justify-between gap-2 border-t border-neutral-200 pt-3"><button type="button" className="ts-button ts-button--secondary" onClick={onAddLeg}>Add leg</button><button type="button" className="ts-button ts-button--danger" onClick={onDeleteTrip}>Delete trip</button></div></div>}
  </article>;
}

function Stat({ label, value }) { return <div className="rounded-lg border border-neutral-200 bg-white p-2"><div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div><div className="mt-0.5 text-sm font-semibold text-neutral-800">{value}</div></div>; }
