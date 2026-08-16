import { LegCard } from "./LegCard.jsx";

export function LegTimeline({ legs, context, editingLegId, onEdit, onDelete, emptyMessage }) {
  if (!legs.length) return <div className="ts-trip-empty">{emptyMessage}</div>;
  return <div className="ts-leg-timeline">{legs.map((leg, index) => <LegCard key={leg.id} leg={leg} sequence={index + 1} context={context} editing={editingLegId === leg.id} onEdit={onEdit} onDelete={onDelete} />)}</div>;
}
