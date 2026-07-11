import { LegCard } from "./LegCard.jsx";

export function LegTimeline({ legs, context, editingLegId, onEdit, onDelete, emptyMessage }) {
  if (!legs.length) return <div className="rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-500">{emptyMessage}</div>;
  return <div className="relative space-y-2 before:absolute before:bottom-4 before:left-[26px] before:top-4 before:w-px before:bg-neutral-200">{legs.map((leg, index) => <LegCard key={leg.id} leg={leg} sequence={index + 1} context={context} editing={editingLegId === leg.id} onEdit={onEdit} onDelete={onDelete} />)}</div>;
}
