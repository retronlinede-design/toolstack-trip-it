export const REPORT_PRINT_STYLES = `
  @media print {
    @page { margin: 12mm; }

    body { background: white !important; }
    body * { visibility: hidden !important; }
    .print\\:hidden { display: none !important; }

    .ts-modal-backdrop,
    .ts-modal-backdrop .ts-modal,
    .ts-modal-backdrop .tripit-print-scroll,
    #tripit-print,
    #tripit-print * {
      visibility: visible !important;
    }

    .ts-modal-backdrop {
      position: static !important;
      inset: auto !important;
      display: block !important;
      padding: 0 !important;
      background: transparent !important;
      backdrop-filter: none !important;
      isolation: auto !important;
    }

    .ts-modal-backdrop > .absolute.inset-0 {
      display: none !important;
    }

    .ts-modal-backdrop .ts-modal {
      position: static !important;
      display: block !important;
      width: 100% !important;
      max-width: none !important;
      max-height: none !important;
      overflow: visible !important;
      border: 0 !important;
      border-radius: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
    }

    .ts-modal-backdrop .tripit-print-scroll {
      display: block !important;
      overflow: visible !important;
      height: auto !important;
      max-height: none !important;
      flex: none !important;
      padding: 0 !important;
      background: white !important;
    }

    #tripit-print {
      position: static !important;
      width: 100% !important;
      max-width: none !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
      box-shadow: none !important;
    }

    #tripit-print thead { display: table-header-group; }
    #tripit-print tr,
    #tripit-print .print-keep-together {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  }
`;

export function printReportWhenReady({
  documentRef = document,
  windowRef = window,
  maxFrames = 10,
} = {}) {
  let framesRemaining = maxFrames;

  const waitForReport = () => {
    if (documentRef.getElementById("tripit-print")) {
      // Allow one complete frame after mounting so Chromium has current layout.
      windowRef.requestAnimationFrame(() => windowRef.requestAnimationFrame(() => windowRef.print()));
      return;
    }

    if (framesRemaining <= 0) return;
    framesRemaining -= 1;
    windowRef.requestAnimationFrame(waitForReport);
  };

  waitForReport();
}
