import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CompletedTripCard } from "./CompletedTripCard.jsx";
import { LegCard } from "./LegCard.jsx";
import { deleteLegConfirmation, deleteTripConfirmation, legCompactSummary, tripSummaryStats } from "./legDisplayUtils.js";

const leg = { id: "l1", startPlace: "Consulate", endPlace: "Munich Airport", startTime: "08:10", endTime: "08:55", km: 42, odoStart: 50120, odoEnd: 50162, driver: "Retro", passengers: ["Ambassador", "Deputy Minister", "Security Officer", "Assistant"], note: "Meet at terminal\nDoor 3", startTag: "Duty", endTag: "Airport" };

describe("shared leg and trip presentation", () => {
  it("creates the compact leg hierarchy and metadata indicators", () => expect(legCompactSummary(leg)).toEqual({ route: "Consulate → Munich Airport", journey: "08:10–08:55 · 42.0 km", people: "Retro · 4 passengers", metadata: "Note · 2 tags" }));
  it("renders compact active and historical cards through the shared component", () => { const active = renderToStaticMarkup(<LegCard leg={leg} sequence={1} context="active" />); const history = renderToStaticMarkup(<LegCard leg={leg} sequence={1} context="history" />); expect(active).toContain("Consulate → Munich Airport"); expect(history).toContain("Consulate → Munich Airport"); expect(active).toContain('aria-expanded="false"'); });
  it("renders expanded odometer, passengers, tags, and multiline notes", () => { const html = renderToStaticMarkup(<LegCard leg={leg} sequence={1} context="history" initiallyExpanded />); expect(html).toContain("50120 km"); expect(html).toContain("Ambassador"); expect(html).toContain("Meet at terminal\nDoor 3"); expect(html).toContain("Duty"); });
  it("expresses active editing state in text and aria", () => { const html = renderToStaticMarkup(<LegCard leg={leg} sequence={2} editing />); expect(html).toContain("Currently editing"); expect(html).toContain('aria-current="step"'); });
  it("derives completed-trip statistics without storing them", () => expect(tripSummaryStats({ legs: [leg, { ...leg, id: "l2", driver: "Other", passengers: ["A"] }] })).toMatchObject({ legs: 2, totalKm: 84, passengers: 5, distinctDrivers: 2, duration: "0h 45m" }));
  it("renders a semantic collapsed and expanded completed-trip disclosure", () => { const trip = { id: "t1", title: "Airport Run", startDate: "2026-07-11", purpose: "Duty", legs: [leg] }; const collapsed = renderToStaticMarkup(<CompletedTripCard trip={trip} vehicleName="Car" expanded={false} />); const expanded = renderToStaticMarkup(<CompletedTripCard trip={trip} vehicleName="Car" expanded />); expect(collapsed).toContain('aria-expanded="false"'); expect(collapsed).toContain("Airport Run"); expect(expanded).toContain("Passengers carried"); });
  it("includes record context in delete confirmations", () => { expect(deleteLegConfirmation(leg)).toContain("Consulate → Munich Airport"); expect(deleteTripConfirmation({ title: "Airport Run" })).toContain("Airport Run"); });
});
