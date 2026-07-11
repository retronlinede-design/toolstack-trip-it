import { describe, expect, it } from "vitest";
import { buildPendingLegSummary, calculatePendingDistance, hasPeopleValidationError, initialPeopleExpanded, legActionLabel, optionalDetailsSummary, peopleSummary, shouldShowRouteSuggestions } from "./legComposerUtils.js";

describe("compact leg composer presentation", () => {
  it("builds collapsed People summaries", () => { expect(peopleSummary("Retro", ["A", "B", "C"])).toBe("Retro · 3 passengers"); expect(peopleSummary("", [])).toBe("No driver · No passengers"); });
  it("expands People for populated edits and validation errors", () => { expect(initialPeopleExpanded(true, { driver: "Retro", passengers: [] })).toBe(true); expect(initialPeopleExpanded(false, { driver: "", passengers: [] }, true)).toBe(true); });
  it("detects invalid People values for forced expansion", () => expect(hasPeopleValidationError({ driver: "x".repeat(151), passengers: [] })).toBe(true));
  it("summarizes optional details", () => { expect(optionalDetailsSummary({ note: "Note", startTag: "A", endTag: "B" })).toBe("Note added · 2 tags"); expect(optionalDetailsSummary({})).toBe("Notes, tags and template details"); });
  it("hides empty unfocused route suggestions and shows focused suggestions", () => { expect(shouldShowRouteSuggestions(null, "startPlace", "")).toBe(false); expect(shouldShowRouteSuggestions("startPlace", "startPlace", "")).toBe(true); expect(shouldShowRouteSuggestions(null, "startPlace", "Mun")).toBe(true); });
  it("derives a live pending-leg summary", () => expect(buildPendingLegSummary({ startPlace: "Consulate", endPlace: "Airport", startTime: "08:10", endTime: "08:55", odoStart: "10", odoEnd: "52", driver: "Retro", passengers: ["A", "B", "C"] })).toEqual({ route: "Consulate → Airport", journey: "08:10–08:55 · 42.0 km", people: "Retro · 3 passengers", warning: "" }));
  it("shows incomplete and invalid distance states", () => { expect(calculatePendingDistance("", "").label).toBe("— km"); expect(calculatePendingDistance("20", "10").status).toBe("invalid"); });
  it("uses Add Leg and Update Leg action labels", () => { expect(legActionLabel(false)).toBe("Add Leg"); expect(legActionLabel(true)).toBe("Update Leg"); });
});
