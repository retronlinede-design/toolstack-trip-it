import { useState } from "react";
import { prepareSuggestions } from "./suggestionUtils.js";

export function SuggestionChips({ suggestions, query = "", onSelect, label = "Location suggestions", limit = 8 }) {
  const [expanded, setExpanded] = useState(false);
  const prepared = prepareSuggestions(suggestions, query);
  if (!prepared.length) return null;
  const visible = expanded ? prepared : prepared.slice(0, limit);
  const remaining = Math.max(0, prepared.length - limit);
  return (
    <div className="mt-2" aria-label={label}>
      <div className="mb-1.5 text-[11px] font-medium text-[var(--ts-text-subtle)]">{label}</div>
      <div className={`flex flex-wrap gap-1.5 ${expanded ? "max-h-[66px] overflow-y-auto pr-1" : "max-h-[66px] overflow-hidden"}`}>
        {visible.map((item) => <button key={item.normalized} type="button" className="ts-suggestion-chip" onClick={() => onSelect(item.value)} aria-label={`Use suggestion ${item.value}`}>{item.value}</button>)}
        {!expanded && remaining > 0 && <button type="button" className="ts-suggestion-chip ts-suggestion-chip--more" onClick={() => setExpanded(true)} aria-label={`Show ${remaining} more suggestions`}>+{remaining} more</button>}
        {expanded && remaining > 0 && <button type="button" className="ts-suggestion-chip ts-suggestion-chip--more" onClick={() => setExpanded(false)} aria-label="Collapse suggestions">Show less</button>}
      </div>
    </div>
  );
}
