import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FuelEntryCard } from "./FuelEntryCard.jsx";
import { WashEntryCard } from "./WashEntryCard.jsx";
import { fuelDeleteConfirmation, fuelLogStats, groupCurrencyTotals, washDeleteConfirmation, washLogStats } from "./vehicleLogUtils.js";

describe("vehicle log presentation", () => {
  it("groups totals without combining currencies", () => expect(groupCurrencyTotals([{ totalCost: 10, currency: "EUR" }, { totalCost: 5, currency: "USD" }, { totalCost: 2, currency: "EUR" }])).toEqual({ EUR: 12, USD: 5 }));
  it("derives fuel totals and average for a single currency", () => expect(fuelLogStats([{ liters: 10, totalCost: 20, currency: "EUR", fullTank: true, odometer: 100 }])).toMatchObject({ count: 1, liters: 10, averageCostPerLiter: 2, fullTankCount: 1, latestOdometer: 100 }));
  it("does not calculate a misleading mixed-currency average", () => expect(fuelLogStats([{ liters: 1, totalCost: 2, currency: "EUR" }, { liters: 1, totalCost: 2, currency: "USD" }]).averageCostPerLiter).toBeNull());
  it("derives wash count, recent date, and most-used type", () => expect(washLogStats([{ date: "2026-02-02", type: "Full", cost: 2 }, { date: "2026-01-01", type: "Full", cost: 3 }])).toMatchObject({ count: 2, mostRecent: "2026-02-02", mostUsedType: "Full" }));
  it("renders responsive semantic fuel and wash cards", () => { expect(renderToStaticMarkup(<FuelEntryCard entry={{ id: "f", date: "2026-01-01", station: "Long Station Name", liters: 4, totalCost: 8, currency: "EUR" }} onEdit={() => {}} onDelete={() => {}} />)).toContain('aria-expanded="false"'); expect(renderToStaticMarkup(<WashEntryCard entry={{ id: "w", date: "2026-01-01", type: "Full" }} onEdit={() => {}} onDelete={() => {}} />)).toContain("Full"); });
  it("creates contextual delete confirmation text", () => { expect(fuelDeleteConfirmation({ date: "2026-01-01", station: "Shell" })).toContain("Shell"); expect(washDeleteConfirmation({ date: "2026-01-01", type: "Full" })).toContain("Full"); });
});
