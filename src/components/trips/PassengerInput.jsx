import { useState } from "react";
import { addPassengers, applyPassengerInputAction, MAX_PASSENGERS, removePassenger } from "./tripPeople.js";

export function PassengerInput({ id, label, placeholder, values = [], onChange, suggestions = [], suggestionsLabel, renderSuggestions, instructions = "Press Enter or comma to add a name.", removeLabel = "Remove passenger", showAllLabel = "Show all", showLessLabel = "Show less" }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      const result = applyPassengerInputAction(values, draft, { type: "commit" });
      setError(result.error); setDraft(result.draft); if (result.values !== values) onChange(result.values);
    } else if (event.key === "Backspace" && !draft && values.length) {
      event.preventDefault();
      const result = applyPassengerInputAction(values, draft, { type: "backspace" });
      onChange(result.values); setError(result.error);
    }
  };
  const handlePaste = (event) => {
    const pasted = event.clipboardData.getData("text");
    if (!pasted.includes(",")) return;
    event.preventDefault();
    const result = applyPassengerInputAction(values, draft, { type: "commit", value: pasted });
    setError(result.error); setDraft(result.draft); if (result.values !== values) onChange(result.values);
  };
  const addSuggestion = (name) => {
    const result = addPassengers(values, [name]);
    setError(result.error);
    if (result.added) onChange(result.values);
  };

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-neutral-700">{label}</label>
      <div id={helpId} className="mt-0.5 text-[11px] text-neutral-500">{instructions} {values.length}/{MAX_PASSENGERS}</div>
      <div className="mt-1 rounded-xl border border-neutral-300 bg-white p-2 focus-within:border-[#b5d51c] focus-within:ring-2 focus-within:ring-lime-200">
        {!!values.length && <div className={`mb-2 flex flex-wrap gap-1.5 overflow-y-auto ${expanded ? "max-h-40" : "max-h-20"}`}>
          {(expanded ? values : values.slice(0, 6)).map((name, index) => <span key={`${name}-${index}`} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 pl-2.5 pr-1 text-xs text-neutral-700">
            <span>{name}</span><button type="button" className="grid h-7 w-7 place-items-center rounded-full text-neutral-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400" onClick={() => onChange(removePassenger(values, index))} aria-label={`${removeLabel} ${name}`}>×</button>
          </span>)}
          {values.length > 6 && <button type="button" className="ts-suggestion-chip ts-suggestion-chip--more" onClick={() => setExpanded((value) => !value)}>{expanded ? showLessLabel : `${showAllLabel} (+${values.length - 6})`}</button>}
        </div>}
        <input id={id} className="h-10 w-full border-0 bg-transparent px-1 text-sm text-neutral-800 outline-none placeholder:text-neutral-400" value={draft} onChange={(event) => { setDraft(event.target.value.replace(/,$/, "")); setError(""); }} onKeyDown={handleKeyDown} onPaste={handlePaste} placeholder={placeholder} aria-describedby={`${helpId}${error ? ` ${errorId}` : ""}`} aria-invalid={error ? "true" : undefined} />
      </div>
      <div id={errorId} className="mt-1 min-h-4 text-[11px] text-red-600" role="status" aria-live="polite">{error}</div>
      {renderSuggestions?.(suggestions.filter((item) => {
        const name = typeof item === "string" ? item : item.value;
        return !values.some((selected) => selected.toLocaleLowerCase() === String(name).toLocaleLowerCase());
      }), addSuggestion, suggestionsLabel)}
    </div>
  );
}
