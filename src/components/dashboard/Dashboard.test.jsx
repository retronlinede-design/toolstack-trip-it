import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Dashboard } from "./Dashboard.jsx";

const handlers = { onStartTrip() {}, onResumeTrip() {}, onOpenHistory() {}, onOpenFuel() {}, onOpenWash() {}, onOpenReports() {}, onAddVehicle() {}, onOpenJourney() {} };
const base = { month: "2026-08", vehicle: { id: "v1", name: "Unit 1", plate: "GOV-1" }, activeTrip: null, metrics: { completedJourneys: 2, completedLegs: 3, distance: 42, fuelLitres: 15, fuelEntries: 2, fuelSpend: [{ currency: "EUR", total: 20 }, { currency: "USD", total: 12 }] }, recentJourneys: [], vehicleOverview: { name: "Unit 1", makeModel: "Ford Focus", plate: "GOV-1", hasActiveTrip: false, monthJourneys: 2, monthDistance: 42, latestFuel: null, latestWash: null, latestFuelOdometer: null } };

describe("Dashboard", () => {
  it("renders the no-vehicle setup action without vehicle metrics", () => {
    const html = renderToStaticMarkup(<Dashboard data={{ month: "2026-08", vehicle: null, activeTrip: null, metrics: null, recentJourneys: [], vehicleOverview: null }} persistenceStatus="saved" {...handlers} />);
    expect(html).toContain("No vehicle configured");
    expect(html).toContain("Add Vehicle");
    expect(html).not.toContain("Completed journeys");
  });

  it("renders exactly four principal metrics and keeps currencies separate", () => {
    const html = renderToStaticMarkup(<Dashboard data={base} persistenceStatus="saved" {...handlers} />);
    expect((html.match(/class="ts-dashboard-metric"/g) || [])).toHaveLength(4);
    expect(html).toContain("20.00 EUR");
    expect(html).toContain("12.00 USD");
  });

  it("offers Start Trip without creating dashboard-local trip content", () => {
    const html = renderToStaticMarkup(<Dashboard data={base} persistenceStatus="saved" {...handlers} />);
    expect(html).toContain("No active trip");
    expect(html).toContain("Start Trip");
    expect(html).not.toContain("Resume Trip");
  });

  it("renders active trip route and contextual people without a next-leg claim", () => {
    const activeTrip = { id: "a", title: "Duty Run", purpose: "Official", route: "HQ → Embassy", vehicleName: "Unit 1", startDate: "2026-08-16", startedAt: "2026-08-16T08:00:00Z", legCount: 2, distance: 12, driver: "Alex", passengers: ["Sam"], latestLeg: {}, latestLegSummary: { route: "Depot → Embassy", journey: "09:00–09:30 · 7.0 km" } };
    const html = renderToStaticMarkup(<Dashboard data={{ ...base, activeTrip }} persistenceStatus="saved" {...handlers} />);
    expect(html).toContain("HQ → Embassy");
    expect(html).toContain("Driver: Alex");
    expect(html).toContain("Passengers: Sam");
    expect(html).toContain("Latest leg: Depot → Embassy");
    expect(html).toContain("Resume Trip");
    expect(html).not.toContain("Next leg");
  });

  it("renders compact recent journey information and empty activity states", () => {
    const journey = { id: "t1", vehicleId: "v1", vehicleName: "Unit 1", title: "Airport", route: "HQ → Airport", startDate: "2026-08-10", distance: 25, drivers: ["Alex"], passengerCount: 2 };
    const populated = renderToStaticMarkup(<Dashboard data={{ ...base, recentJourneys: [journey] }} persistenceStatus="saved" {...handlers} />);
    const empty = renderToStaticMarkup(<Dashboard data={base} persistenceStatus="saved" {...handlers} />);
    expect(populated).toContain("HQ → Airport");
    expect(populated).toContain("25.0 km");
    expect(empty).toContain("No completed journeys");
  });
});
