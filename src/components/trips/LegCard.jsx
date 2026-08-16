import { useState } from "react";
import { legCompactSummary, validOdometer } from "./legDisplayUtils.js";

export function LegCard({ leg, sequence, context = "active", editing = false, initiallyExpanded = false, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [peopleExpanded, setPeopleExpanded] = useState(false);
  const summary = legCompactSummary(leg);
  const passengers = Array.isArray(leg.passengers) ? leg.passengers : [];
  const visiblePassengers = peopleExpanded ? passengers : passengers.slice(0, 3);
  const detailsId = `leg-${context}-${leg.id}-details`;
  const routeLabel = `Leg ${sequence}: ${summary.route}`;
  return <article className={`ts-leg-card ${editing ? "ts-leg-card--editing" : ""}`} aria-label={routeLabel} aria-current={editing ? "step" : undefined}>
    <div className="flex items-start gap-3"><div className={`ts-leg-sequence ${editing ? "ts-leg-sequence--active" : ""}`}>{sequence}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h4 className="ts-leg-route">{summary.route}</h4><div className="ts-leg-journey">{summary.journey}</div><div className="mt-1 text-xs text-neutral-500">{summary.people}</div>{summary.metadata && <div className="mt-1 text-[11px] font-medium text-neutral-500">{summary.metadata}</div>}{editing && <div className="mt-1 text-[11px] font-semibold text-lime-700">Currently editing</div>}</div><div className="flex shrink-0 items-center gap-1">{onEdit && <button type="button" className="ts-suggestion-chip" onClick={() => onEdit(leg)} aria-label={`Edit ${routeLabel}`}>Edit</button>}<button type="button" className="ts-disclosure-control" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded((value) => !value)} aria-label={`${expanded ? "Hide" : "Show"} details for ${routeLabel}`}>{expanded ? "−" : "+"}</button></div></div>
      {expanded && <div id={detailsId} className="ts-leg-details"><div><div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Odometer</div>{validOdometer(leg.odoStart) && validOdometer(leg.odoEnd) ? <div className="mt-0.5 text-neutral-700">{leg.odoStart} km → {leg.odoEnd} km</div> : <div className="mt-0.5 text-neutral-500">Odometer values incomplete</div>}</div>
        {(leg.driver || passengers.length) && <div className="grid gap-2 sm:grid-cols-2">{leg.driver && <div><div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Driver</div><div>{leg.driver}</div></div>}{!!passengers.length && <div><div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Passengers</div><div className="whitespace-normal">{visiblePassengers.join(" · ")}{!peopleExpanded && passengers.length > 3 && <button type="button" className="ml-1 text-xs font-semibold underline" aria-expanded={false} onClick={() => setPeopleExpanded(true)}>+{passengers.length - 3} more</button>}</div></div>}</div>}
        {(leg.startTag || leg.endTag) && <div><div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Tags</div><div>{leg.startTag || "—"} → {leg.endTag || "—"}</div></div>}{leg.note && <div><div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Note</div><div className="mt-0.5 whitespace-pre-wrap text-neutral-700">{leg.note}</div></div>}{leg.createdAt && <div className="text-[11px] text-neutral-400">Created {new Date(leg.createdAt).toLocaleString()}</div>}
        {onDelete && <div className="flex justify-end border-t border-neutral-100 pt-3"><button type="button" className="ts-button ts-button--danger" onClick={() => onDelete(leg)} aria-label={`Delete ${routeLabel}`}>Delete leg</button></div>}
      </div>}</div></div>
  </article>;
}
