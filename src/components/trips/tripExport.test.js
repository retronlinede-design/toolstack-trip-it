import { describe, expect, it } from "vitest";
import { createTripsCsv } from "./tripExport.js";

describe("trip people CSV export", () => {
  it("includes driver and safely joined passengers", () => {
    const csv = createTripsCsv([{ startDate: "2026-01-01", title: "Duty", legs: [{ driver: "Retro", passengers: ["Ambassador", "Deputy Minister"], startPlace: "A", endPlace: "B", startTime: "08:00", endTime: "09:00", km: 4, odoStart: 1, odoEnd: 5, note: "" }] }]);
    expect(csv).toContain("Driver,Passengers");
    expect(csv).toContain("Retro,Ambassador; Deputy Minister");
  });
  it("escapes quotes and commas", () => expect(createTripsCsv([{ title: "Duty", legs: [{ driver: 'Doe, "Jane"', passengers: [] }] }])).toContain('"Doe, ""Jane"""'));
});
