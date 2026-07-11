import { PassengerInput } from "./PassengerInput.jsx";
import { MAX_DRIVER_LENGTH, normalizeDriver, normalizePassengers } from "./tripPeople.js";
import { SuggestionChips } from "../ui/SuggestionChips.jsx";

export function LegPeopleInput({ idPrefix, driver, passengers, onDriverChange, onPassengersChange, driverSuggestions = [], passengerSuggestions = [], previousLeg, t }) {
  const previousDriver = normalizeDriver(previousLeg?.driver);
  const previousPassengers = normalizePassengers(previousLeg?.passengers);
  const samePassengers = JSON.stringify(normalizePassengers(passengers)) === JSON.stringify(previousPassengers);
  return <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div className="text-xs font-semibold text-neutral-700">{t("people")}</div><div className="flex flex-wrap gap-1.5">
      {previousDriver && previousDriver !== normalizeDriver(driver) && <button type="button" className="ts-suggestion-chip" onClick={() => onDriverChange(previousDriver)}>{t("copyPreviousDriver")}</button>}
      {!!previousPassengers.length && !samePassengers && <button type="button" className="ts-suggestion-chip" onClick={() => onPassengersChange(previousPassengers)}>{t("copyPreviousPassengers")}</button>}
      {!!passengers.length && <button type="button" className="ts-suggestion-chip" onClick={() => onPassengersChange([])}>{t("clearPassengers")}</button>}
    </div></div>
    <div>
      <label htmlFor={`${idPrefix}-driver`} className="text-sm font-medium text-neutral-700">{t("driver")}</label>
      <input id={`${idPrefix}-driver`} className="ts-control mt-1" value={driver} maxLength={MAX_DRIVER_LENGTH} onChange={(event) => onDriverChange(event.target.value)} onBlur={(event) => onDriverChange(normalizeDriver(event.target.value))} placeholder={t("driverPlaceholder")} />
      <SuggestionChips suggestions={driverSuggestions} query={driver} onSelect={onDriverChange} label={t("driverSuggestions")} />
    </div>
    <div className="mt-2"><PassengerInput id={`${idPrefix}-passengers`} label={t("passengers")} placeholder={t("passengerPlaceholder")} values={passengers} onChange={onPassengersChange} suggestions={passengerSuggestions} suggestionsLabel={t("passengerSuggestions")} instructions={t("passengerInstructions")} removeLabel={t("removePassenger")} showAllLabel={t("showAll")} showLessLabel={t("showLess")} renderSuggestions={(items, onSelect, label) => <SuggestionChips suggestions={items} onSelect={onSelect} label={label} />} /></div>
  </div>;
}
