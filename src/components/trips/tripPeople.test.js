import { describe, expect, it } from "vitest";
import { addPassengers, applyPassengerInputAction, buildPeopleSuggestionItems, freshLegPeople, MAX_PASSENGERS, mergePassengerSets, migrateTripPeopleToLegs, normalizeDriver, normalizeLegPeople, normalizePassengers, removePassenger, splitPassengerInput } from "./tripPeople.js";

describe("trip people normalization", () => {
  it("trims and collapses driver whitespace", () => expect(normalizeDriver("  Retro   Driver ")).toBe("Retro Driver"));
  it("limits driver length", () => expect(normalizeDriver("x".repeat(151))).toHaveLength(150));
  it("removes empty and case-insensitive duplicate passengers", () => expect(normalizePassengers([" Ambassador ", "", "ambassador", "Deputy   Minister"])).toEqual(["Ambassador", "Deputy Minister"]));
  it("enforces passenger count and length", () => { expect(normalizePassengers(Array.from({ length: 51 }, (_, i) => `P${i}`))).toHaveLength(50); expect(normalizePassengers(["x".repeat(151)])).toEqual([]); });
  it("splits pasted comma-separated names", () => expect(splitPassengerInput("Ambassador, Deputy Minister, Security Officer")).toEqual(["Ambassador", "Deputy Minister", "Security Officer"]));
  it("adds Enter/comma-style input and rejects duplicates", () => { const added = addPassengers([], "Ambassador"); expect(added.values).toEqual(["Ambassador"]); expect(addPassengers(added.values, "ambassador").error).toContain("already"); });
  it("commits Enter and comma actions and clears the draft", () => { expect(applyPassengerInputAction([], "Ambassador", { type: "commit" })).toMatchObject({ values: ["Ambassador"], draft: "" }); expect(applyPassengerInputAction(["A"], "B", { type: "commit" }).values).toEqual(["A", "B"]); });
  it("commits pasted comma-separated passengers", () => expect(applyPassengerInputAction([], "", { type: "commit", value: "A, B, C" }).values).toEqual(["A", "B", "C"]));
  it("uses Backspace on an empty draft to remove the last passenger", () => expect(applyPassengerInputAction(["A", "B"], "", { type: "backspace" }).values).toEqual(["A"]));
  it("removes a passenger", () => expect(removePassenger(["A", "B"], 0)).toEqual(["B"]));
  it("blocks additions above the maximum", () => expect(addPassengers(Array.from({ length: MAX_PASSENGERS }, (_, i) => `P${i}`), "Extra").error).toContain("at most"));
  it("combines additive passenger sets deterministically", () => expect(mergePassengerSets(["A"], ["A", "B"])).toMatchObject({ compatible: true, values: ["A", "B"], enriched: true }));
  it("flags ambiguous replacement sets", () => expect(mergePassengerSets(["A", "B"], ["A", "C"]).compatible).toBe(false));
  it("flags a nonempty imported subset as possible removal intent", () => expect(mergePassengerSets(["A", "B"], ["A"]).compatible).toBe(false));
  it("builds suggestions only from historical legs", () => expect(buildPeopleSuggestionItems([{ driver: " Retro ", passengers: ["Ambassador"], createdAt: "2026-01-01" }])).toMatchObject({ drivers: [{ value: "Retro" }], passengers: [{ value: "Ambassador" }] }));
  it("normalizes missing leg people to empty values", () => expect(normalizeLegPeople({ id: "l" })).toMatchObject({ driver: "", passengers: [] }));
  it("migrates trip-level people into every empty leg", () => { const migrated = migrateTripPeopleToLegs({ driver: "Retro", passengers: ["A"], legs: [{ id: "1" }, { id: "2" }] }); expect(migrated.legs.every((leg) => leg.driver === "Retro" && leg.passengers[0] === "A")).toBe(true); expect(migrated.driver).toBeUndefined(); });
  it("preserves populated leg people and fills only missing values", () => { const migrated = migrateTripPeopleToLegs({ driver: "Legacy", passengers: ["Legacy P"], legs: [{ id: "1", driver: "Own", passengers: [] }, { id: "2", driver: "", passengers: ["Own P"] }] }); expect(migrated.legs).toEqual([{ id: "1", driver: "Own", passengers: ["Legacy P"] }, { id: "2", driver: "Legacy", passengers: ["Own P"] }]); });
  it("retains legacy defaults temporarily for an empty active trip", () => expect(migrateTripPeopleToLegs({ driver: "Legacy", passengers: ["P"], legs: [] }, { preserveEmptyTripDefaults: true })).toMatchObject({ driver: "Legacy", passengers: ["P"], legs: [] }));
  it("inherits the previous driver without automatically copying passengers", () => expect(freshLegPeople({ driver: "Retro", passengers: ["A"] })).toEqual({ driver: "Retro", passengers: [] }));
  it("uses legacy people for a first leg only", () => expect(freshLegPeople(null, { driver: "Legacy", passengers: ["P"] })).toEqual({ driver: "Legacy", passengers: ["P"] }));
});
