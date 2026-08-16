import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { printReportWhenReady, REPORT_PRINT_STYLES } from "./printReport.js";

const appSource = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

describe("report printing", () => {
  it("neutralizes the current modal hierarchy and allows the report to flow", () => {
    expect(REPORT_PRINT_STYLES).toContain(".ts-modal-backdrop");
    expect(REPORT_PRINT_STYLES).toContain(".ts-modal-backdrop .ts-modal");
    expect(REPORT_PRINT_STYLES).toContain(".tripit-print-scroll");
    expect(REPORT_PRINT_STYLES).toMatch(/\.tripit-print-scroll[\s\S]*overflow: visible !important/);
    expect(REPORT_PRINT_STYLES).toMatch(/#tripit-print \{[\s\S]*position: static !important/);
    expect(REPORT_PRINT_STYLES).not.toContain(".fixed.inset-0.z-50");
  });

  it("hides controls and protects report rows and key blocks from page breaks", () => {
    expect(REPORT_PRINT_STYLES).toContain(".print\\:hidden");
    expect(REPORT_PRINT_STYLES).toContain("#tripit-print tr");
    expect(REPORT_PRINT_STYLES).toContain(".print-keep-together");
    expect(REPORT_PRINT_STYLES).toContain("break-inside: avoid");
  });

  it("wires Export through the readiness gate and keeps direct Preview printing", () => {
    expect(appSource).toContain("setPreviewOpen(true); printReportWhenReady();");
    expect(appSource).toContain('onClick={() => window.print()}>Print</button>');
    expect(appSource).not.toContain("setTimeout(() => window.print(), 500)");
  });

  it("waits for the report DOM and two layout frames before printing", () => {
    const callbacks = [];
    const print = vi.fn();
    const windowRef = { requestAnimationFrame: (callback) => callbacks.push(callback), print };
    let mounted = false;
    const documentRef = { getElementById: () => (mounted ? {} : null) };

    printReportWhenReady({ documentRef, windowRef });
    expect(print).not.toHaveBeenCalled();

    mounted = true;
    callbacks.shift()();
    expect(print).not.toHaveBeenCalled();
    callbacks.shift()();
    expect(print).not.toHaveBeenCalled();
    callbacks.shift()();
    expect(print).toHaveBeenCalledOnce();
  });

  it("does not print when the report never mounts", () => {
    const callbacks = [];
    const print = vi.fn();
    const windowRef = { requestAnimationFrame: (callback) => callbacks.push(callback), print };
    const documentRef = { getElementById: () => null };

    printReportWhenReady({ documentRef, windowRef, maxFrames: 2 });
    while (callbacks.length) callbacks.shift()();

    expect(print).not.toHaveBeenCalled();
  });
});
