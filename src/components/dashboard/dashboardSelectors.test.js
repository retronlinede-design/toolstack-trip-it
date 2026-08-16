import { describe, expect, it } from "vitest";
import { calendarMonthKey, selectDashboardData } from "./dashboardSelectors.js";

const leg = (overrides = {}) => ({ id: "l", startPlace: "HQ", endPlace: "Embassy", startTime: "08:00", endTime: "09:00", km: 10, driver: "Alex", passengers: ["Sam"], ...overrides });
const trip = (id, startDate, overrides = {}) => ({ id, vehicleId: "v1", title: id, purpose: "Duty", startDate, status: "finished", legs: [leg({ id: `${id}-leg` })], ...overrides });
const appFixture = () => ({ vehicles: [{ id: "v1", name: "Unit 1", make: "Ford", model: "Focus", plate: "GOV-1" }, { id: "v2", name: "Unit 2" }], activeVehicleId: "v1", activeTripByVehicle: { v1: null, v2: null }, tripsByVehicle: { v1: [], v2: [] }, fuelByVehicle: { v1: [], v2: [] }, washByVehicle: { v1: [], v2: [] } });

describe("dashboard selectors", () => {
  it("derives local calendar month keys across year boundaries and leap day", () => {
    expect(calendarMonthKey("2024-02-29")).toBe("2024-02");
    expect(calendarMonthKey(new Date(2025, 11, 31))).toBe("2025-12");
    expect(calendarMonthKey(new Date(2026, 0, 1))).toBe("2026-01");
  });

  it("filters current-month metrics to the selected vehicle", () => {
    const app = appFixture();
    app.tripsByVehicle.v1 = [trip("current", "2026-08-03"), trip("old", "2026-07-31")];
    app.tripsByVehicle.v2 = [trip("other", "2026-08-04", { vehicleId: "v2", legs: [leg({ km: 90 })] })];
    const data = selectDashboardData(app, { currentDate: "2026-08-16" });
    expect(data.metrics).toMatchObject({ completedJourneys: 1, completedLegs: 1, distance: 10 });
  });

  it("summarizes a zero-leg active trip without fabricating a route", () => {
    const app = appFixture();
    app.activeTripByVehicle.v1 = { id: "active", vehicleId: "v1", title: "Patrol", startDate: "2026-08-16", startedAt: "2026-08-16T08:00:00Z", status: "active", legs: [], driver: "Legacy Driver", passengers: ["Officer"] };
    const active = selectDashboardData(app, { currentDate: "2026-08-16" }).activeTrip;
    expect(active).toMatchObject({ route: "", distance: 0, legCount: 0, driver: "Legacy Driver", passengers: ["Officer"] });
  });

  it("uses first origin, latest destination, accumulated distance, and latest-leg people", () => {
    const app = appFixture();
    app.activeTripByVehicle.v1 = { id: "active", vehicleId: "v1", title: "Patrol", startDate: "2026-08-16", status: "active", legs: [leg({ id: "one", startPlace: "HQ", endPlace: "Depot", km: 5, driver: "First", passengers: ["A"] }), leg({ id: "two", startPlace: "Depot", endPlace: "Embassy", km: 7, driver: "Latest", passengers: ["B", "C"] })] };
    expect(selectDashboardData(app, { currentDate: "2026-08-16" }).activeTrip).toMatchObject({ route: "HQ → Embassy", distance: 12, driver: "Latest", passengers: ["B", "C"] });
  });

  it("keeps mixed-currency fuel separate and excludes other months", () => {
    const app = appFixture();
    app.fuelByVehicle.v1 = [{ id: "e", date: "2026-08-01", liters: 10, totalCost: 20, currency: "EUR" }, { id: "u", date: "2026-08-02", liters: 5, totalCost: 12, currency: "USD" }, { id: "old", date: "2026-07-31", liters: 99, totalCost: 99, currency: "EUR" }];
    expect(selectDashboardData(app, { currentDate: "2026-08-16" }).metrics).toMatchObject({ fuelLitres: 15, fuelEntries: 2, fuelSpend: [{ currency: "EUR", total: 20 }, { currency: "USD", total: 12 }] });
  });

  it("orders recent trips deterministically, supports legacy missing finishedAt, and limits to five", () => {
    const app = appFixture();
    app.tripsByVehicle.v1 = [trip("same-original", "2026-08-10", { startedAt: "2026-08-10T08:00:00Z" }), trip("older-time", "2026-08-10", { finishedAt: "2026-08-10T09:00:00Z" }), trip("newer-time", "2026-08-10", { finishedAt: "2026-08-10T10:00:00Z" }), trip("d9", "2026-08-09"), trip("d8", "2026-08-08"), trip("d7", "2026-08-07")];
    const recent = selectDashboardData(app, { currentDate: "2026-08-16" }).recentJourneys;
    expect(recent.map((item) => item.id)).toEqual(["newer-time", "older-time", "same-original", "d9", "d8"]);
  });

  it("uses original order as the final tie breaker", () => {
    const app = appFixture();
    app.tripsByVehicle.v1 = [trip("first", "2026-08-10"), trip("second", "2026-08-10")];
    expect(selectDashboardData(app, { currentDate: "2026-08-16" }).recentJourneys.map((item) => item.id)).toEqual(["first", "second"]);
  });

  it("handles no vehicle and does not mutate the application graph", () => {
    const app = appFixture();
    app.activeVehicleId = null;
    const before = JSON.stringify(app);
    expect(selectDashboardData(app, { currentDate: "2026-08-16" })).toMatchObject({ vehicle: null, metrics: null, recentJourneys: [] });
    expect(JSON.stringify(app)).toBe(before);
  });

  it("returns useful zero and empty states for a selected vehicle with no records", () => {
    const data = selectDashboardData(appFixture(), { currentDate: "2026-08-16" });
    expect(data.metrics).toMatchObject({ completedJourneys: 0, distance: 0, fuelLitres: 0, fuelEntries: 0, fuelSpend: [] });
    expect(data.recentJourneys).toEqual([]);
    expect(data.vehicleOverview).toMatchObject({ hasActiveTrip: false, latestFuel: null, latestWash: null });
  });

  it("does not mutate trip, fuel, or wash ordering", () => {
    const app = appFixture();
    app.tripsByVehicle.v1 = [trip("old", "2026-01-01"), trip("new", "2026-08-01")];
    app.fuelByVehicle.v1 = [{ id: "old", date: "2026-01-01" }, { id: "new", date: "2026-08-01" }];
    app.washByVehicle.v1 = [{ id: "old", date: "2026-01-01" }, { id: "new", date: "2026-08-01" }];
    const before = JSON.stringify(app);
    selectDashboardData(app, { currentDate: "2026-08-16" });
    expect(JSON.stringify(app)).toBe(before);
  });
});
