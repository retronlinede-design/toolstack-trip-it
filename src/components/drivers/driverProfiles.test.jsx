import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DriverProfiles } from "./DriverProfiles.jsx";
import { deriveDriverStatistics, duplicateDriverProfile, normalizeDriverProfile, normalizeDriverProfiles } from "./driverProfileUtils.js";

const vehicles = [{ id: "v1", name: "Sedan" }, { id: "v2", name: "Van", active: false }];
const tripsByVehicle = { v1: [
  { id: "old", startDate: "2026-01-01", legs: [{ driver: "Jane Doe", km: 10, startTime: "08:00", endTime: "08:30", passengers: ["A"], odoEnd: 110 }] },
  { id: "new", startDate: "2026-02-01", legs: [{ driver: "jane doe", km: 20, startTime: "09:00", endTime: "10:00", passengers: ["A", "B"], odoEnd: 130 }, { driver: "Other", km: 5, startTime: "10:15", endTime: "10:30", passengers: [] }] },
] };

describe("driver profiles", () => {
  it("normalizes legacy profiles with safe defaults and preserves IDs", () => expect(normalizeDriverProfile({ id: "d1", name: " Jane  Doe " })).toMatchObject({ id: "d1", fullName: "Jane Doe", displayName: "", active: true, defaultVehicleId: "" }));
  it("creates deterministic legacy profiles without changing trip driver text", () => { const source = structuredClone(tripsByVehicle); const first = normalizeDriverProfiles([], source); const second = normalizeDriverProfiles([], source); expect(first.map((driver) => driver.id)).toEqual(second.map((driver) => driver.id)); expect(source).toEqual(tripsByVehicle); });
  it("derives statistics and the ten most recent trips without persistence", () => expect(deriveDriverStatistics(normalizeDriverProfile({ id: "d1", fullName: "Jane Doe" }), tripsByVehicle, vehicles)).toMatchObject({ tripCount: 2, legCount: 2, totalDistance: 30, totalDriveMinutes: 90, passengerInstances: 3, firstTrip: "2026-01-01", latestTrip: "2026-02-01", recentTrips: [{ trip: { id: "new" } }, { trip: { id: "old" } }] }));
  it("duplicates profile identity safely and resets employee number", () => expect(duplicateDriverProfile({ id: "d1", fullName: "Jane Doe", employeeNumber: "42", active: false }, "d2")).toMatchObject({ id: "d2", fullName: "Jane Doe Copy", employeeNumber: "", active: true }));
  it("keeps assigned inactive default vehicles available in the profile model", () => expect(normalizeDriverProfile({ id: "d1", fullName: "Jane", defaultVehicleId: "v2" }).defaultVehicleId).toBe("v2"));
  it("applies default vehicle profile changes without touching trip data", () => { const trips = structuredClone(tripsByVehicle); const changed = normalizeDriverProfile({ id: "d1", fullName: "Jane", defaultVehicleId: "v1" }); expect(changed.defaultVehicleId).toBe("v1"); expect(trips).toEqual(tripsByVehicle); });
  it("preserves explicit inactive status", () => expect(normalizeDriverProfile({ id: "d1", fullName: "Jane", active: false }).active).toBe(false));
  it("renders responsive expanded profile cards with actions, statistics, and recent trips", () => { const html = renderToStaticMarkup(<DriverProfiles drivers={[normalizeDriverProfile({ id: "d1", fullName: "Jane Doe", defaultVehicleId: "v1" })]} vehicles={vehicles} tripsByVehicle={tripsByVehicle} onSave={vi.fn()} onDuplicate={vi.fn()} onToggleActive={vi.fn()} onDelete={vi.fn()} onViewTrip={vi.fn()} initialExpandedId="d1" />); expect(html).toContain("Driver Profiles"); expect(html).toContain("Jane Doe"); expect(html).toContain("Active"); expect(html).toContain("Sedan"); expect(html).toContain('aria-expanded="true"'); expect(html).toContain("Statistics"); expect(html).toContain("Recent Trips"); expect(html).toContain("sm:grid-cols-2"); expect(html).toContain("Duplicate"); });
});
