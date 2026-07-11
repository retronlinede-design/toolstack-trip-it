import { describe, expect, it } from "vitest";
import { prepareSuggestions } from "./suggestionUtils.js";

describe("prepareSuggestions", () => {
  it("normalizes whitespace and removes case-insensitive duplicates while preserving first capitalization", () => {
    const result = prepareSuggestions([" Munich  Airport ", "munich airport", "Munich Airport"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ value: "Munich Airport", frequency: 3 });
  });
  it("orders by recency, then frequency, then alphabetically", () => {
    const result = prepareSuggestions([{ value: "Zulu", lastUsed: 3, frequency: 1 }, { value: "Alpha", lastUsed: 2, frequency: 10 }, { value: "Beta", lastUsed: 2, frequency: 10 }]);
    expect(result.map((item) => item.value)).toEqual(["Zulu", "Alpha", "Beta"]);
  });
  it("puts prefix matches before substring matches and removes unrelated values", () => {
    const result = prepareSuggestions(["Old Munich Road", "Munich Airport", "Berlin"], "Mun");
    expect(result.map((item) => item.value)).toEqual(["Munich Airport", "Old Munich Road"]);
  });
  it("returns nothing when there are no matches", () => expect(prepareSuggestions(["Berlin"], "Mun")).toEqual([]));
});
