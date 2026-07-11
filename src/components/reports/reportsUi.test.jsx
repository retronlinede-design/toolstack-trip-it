import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import logoUrl from "../../assets/tripit-logo-optimized.png";
import { ExportActions } from "./ExportActions.jsx";
import { ReportFilters } from "./ReportFilters.jsx";
import { EXPORT_GROUPS, reportUiSummary, validateReportRange } from "./reportUiUtils.js";

describe("report and export UI", () => {
  it("validates custom ranges and disables actions through the caller", () => { expect(validateReportRange({ start: "2026-02-02", end: "2026-01-01" }).valid).toBe(false); expect(validateReportRange({ start: "2026-01-01", end: "2026-02-02" }).valid).toBe(true); });
  it("renders preset controls and connected custom errors", () => { const html = renderToStaticMarkup(<ReportFilters config={{ mode: "custom", start: "2026-02-02", end: "2026-01-01" }} onMode={() => {}} onChange={() => {}} />); expect(html).toContain("This week"); expect(html).toContain("report-range-error"); });
  it("derives report counts, drivers, passengers, and currencies", () => expect(reportUiSummary({ trips: [{ legs: [{ km: 4, driver: "Retro", passengers: ["A"] }] }], fuel: [{ totalCost: 5, currency: "EUR" }], wash: [{}] })).toMatchObject({ trips: 1, legs: 1, distance: 4, fuel: 1, wash: 1, drivers: 1, passengers: 1, fuelTotals: { EUR: 5 } }));
  it("labels backup and report groups accurately", () => { const html = renderToStaticMarkup(<ExportActions disabled onBackup={() => {}} onImport={() => {}} />); expect(html).toContain("Restorable"); expect(html).toContain("Not restorable"); expect(html).toContain("Print / Save PDF"); expect(html).not.toContain("Download PDF"); expect(EXPORT_GROUPS.reports).toContain("Report JSON"); });
  it("resolves the optimized logo asset", () => expect(logoUrl).toContain("tripit-logo-optimized"));
});
