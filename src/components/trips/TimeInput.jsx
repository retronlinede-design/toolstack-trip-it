import { adjustTimeByMinutes, isValidTime, roundTimeToFiveMinutes } from "./timeUtils.js";

const adjustments = [-15, -5, 5, 15];

export function TimeInput({ id, label, value, onChange, error, now = () => new Date(), compact = false, onKeyDown, onFocus }) {
  const errorId = `${id}-error`;
  const valid = isValidTime(value);
  return (
    <div className={compact ? "min-w-0" : "min-w-0 flex-1"}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-neutral-600">{label}</label>
      <div className="flex items-center gap-2">
        <input id={id} type="time" step="60" className={`ts-control min-w-0 ${error ? "ts-control--invalid" : ""}`} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown} onFocus={onFocus} aria-invalid={error ? "true" : undefined} aria-describedby={error ? errorId : undefined} />
        <button type="button" className="ts-time-now" onClick={() => onChange(roundTimeToFiveMinutes(now()))} aria-label={`Set ${label} to now`}>Now</button>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {adjustments.map((minutes) => (
          <button key={minutes} type="button" className="ts-time-adjust" disabled={!valid} onClick={() => onChange(adjustTimeByMinutes(value, minutes))} aria-label={`${minutes < 0 ? "Subtract" : "Add"} ${Math.abs(minutes)} minutes ${minutes < 0 ? "from" : "to"} ${label}`}>
            {minutes > 0 ? `+${minutes}` : `−${Math.abs(minutes)}`}
          </button>
        ))}
      </div>
      <div id={errorId} className="mt-1 min-h-4 text-[11px] text-red-600" aria-live="polite">{error || ""}</div>
    </div>
  );
}
