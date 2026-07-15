import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import tripitLogo from "./assets/tripit-logo-optimized.png";
import { readJson, readRaw, writeVerified } from "./storage/storage.js";
import { downloadRawRecovery, preserveRecoveryRaw, replaceCorruptWithEmpty } from "./storage/recovery.js";
import { migrateLegacyTransactional } from "./storage/migration.js";
import { canShowSavedFeedback, persistenceFromResult, requiresDestructiveConfirmation } from "./storage/persistence.js";
import { createFullBackup, createReportExport, IMPORT_LIMITS } from "./import/backupSchema.js";
import { prepareBackupImport, requiresEmptyReplacementConfirmation, validateApplicationPayload } from "./import/backupValidator.js";
import { applyTransactionResult, replaceDatasetTransactional, rollbackTransactional } from "./import/importTransaction.js";
import { createMergePlan } from "./import/mergePlanner.js";
import { mergeDatasetTransactional, rollbackMergeTransactional } from "./import/mergeTransaction.js";
import { AlertBanner, Badge, Button, EmptyState, IconButton, ModalShell } from "./components/ui/index.jsx";
import { buttonClass, cardBodyClass, cardClass, cardHeaderClass, compactInputClass, inputClass } from "./components/ui/styles.js";
import { SuggestionChips } from "./components/ui/SuggestionChips.jsx";
import { TimeInput } from "./components/trips/TimeInput.jsx";
import { freshLegTimes, isValidTime, roundTimeToFiveMinutes, updateLegTime, validateLegTimes } from "./components/trips/timeUtils.js";
import { LegPeopleInput } from "./components/trips/LegPeopleInput.jsx";
import { LegComposer } from "./components/trips/LegComposer.jsx";
import { LegTimeline } from "./components/trips/LegTimeline.jsx";
import { CompletedTripCard } from "./components/trips/CompletedTripCard.jsx";
import { deleteLegConfirmation, deleteTripConfirmation } from "./components/trips/legDisplayUtils.js";
import { FuelEntryCard } from "./components/vehicle/FuelEntryCard.jsx";
import { WashEntryCard } from "./components/vehicle/WashEntryCard.jsx";
import { fuelDeleteConfirmation, fuelLogStats, washDeleteConfirmation, washLogStats } from "./components/vehicle/vehicleLogUtils.js";
import { ReportFilters } from "./components/reports/ReportFilters.jsx";
import { ReportSummary } from "./components/reports/ReportSummary.jsx";
import { ExportActions } from "./components/reports/ExportActions.jsx";
import { validateReportRange } from "./components/reports/reportUiUtils.js";
import { buildPeopleSuggestionItems, freshLegPeople, migrateTripPeopleToLegs, normalizeDriver, normalizeLegPeople, normalizePassengers } from "./components/trips/tripPeople.js";
import { createTripsCsv } from "./components/trips/tripExport.js";

/**
 * ToolStack — Trip-It (Duty Trip Log) — Styled v1.3 (Trip Workflow)
 * Paste into: src/App.jsx
 * Requires: Tailwind v4 configured.
 */

// ----- Module-ready keys -----
const APP_ID = "tripit";
const APP_VERSION = "v1";
const KEY = `toolstack.${APP_ID}.${APP_VERSION}`;
const PROFILE_KEY = "toolstack.profile.v1";

// Legacy key (older Trip-It)
const LEGACY_LS_KEY = "toolstack_tripit_v1";

const SUCCESS_MESSAGES = new Set([
  "Vehicle saved", "Vehicle deleted", "Trip started", "Leg updated", "Leg added",
  "Trip finished", "Trip cancelled", "Trip deleted", "Leg deleted", "Leg added to trip", "Wash updated",
  "Wash logged", "Wash deleted", "Fuel updated", "Fuel added", "Fuel entry deleted",
  "Template saved", "Template loaded", "Imported",
]);

const TRANSLATIONS = {
  EN: {
    hub: "Hub", preview: "Preview", export: "Export", help: "Help",
    vehicle: "Vehicle", addVehicle: "+ Add Vehicle", activeVehicle: "Active Vehicle",
    noVehicles: "No vehicles yet. Click", edit: "Edit", delete: "Delete",
    month: "Month", monthSummary: "Month summary", trips: "trips",
    activeTrip: "Active Trip", startTrip: "Start Trip", cancelTrip: "Cancel Trip",
    addVehicleToStart: "Add a vehicle to start logging trips.", started: "Started:",
    purpose: "Purpose:", legs: "Legs", noLegs: "No legs logged yet. Add one below.",
    updateLeg: "Update Leg", quickLeg: "Quick Leg", duplicateLast: "Duplicate last",
    return: "Return", from: "From", to: "To", start: "Start", end: "End",
    odoS: "Odo S", odoE: "Odo E", note: "Note", cancel: "Cancel", update: "Update",
    add: "Add", endTrip: "End Trip", tripTitle: "Trip Title *",
    purposeOpt: "Purpose (Optional)", date: "Date", recentTrips: "Recent Trips",
    selectVehicleView: "Select a vehicle to view trips.", noTrips: "No trips logged for",
    fuel: "Fuel", last: "Last:", selectVehicleFuel: "Select a vehicle to log fuel.",
    editFuel: "Edit Fuel Entry", addFuel: "Add Fuel Entry", odometer: "Odometer",
    station: "Station", liters: "Liters", totalCost: "Total cost", currency: "Currency",
    fullTank: "Full tank", notes: "Notes", fuelHistory: "Fuel log history",
    wash: "Wash", selectVehicleWash: "Select a vehicle.", type: "Type",
    location: "Location", cost: "Cost", upd: "Upd", del: "Del",
    recordTrips: "Record your daily vehicle trips", returnHub: "Return to ToolStack hub",
    saveVehicle: "Save vehicle", vehicleName: "Vehicle name *", make: "Make", model: "Model",
    plate: "Plate", vin: "VIN", optional: "optional",
    rangeSelection: "Range Selection", reports: "Reports", previewPack: "Preview Pack",
    printSavePdf: "Print / Save PDF", csvShare: "CSV / Share", exportCsv: "Export CSV",
    copySummary: "Copy Summary", emailSummary: "Email Summary", dataBackup: "Data Backup",
    exportJson: "Export JSON (Full)", importJson: "Import JSON",
    fullBackupDesc: "Full backup of all vehicles and settings.",
    selectMonth: "Select month", year: "Year", thisMonth: "This month", selected: "Selected:",
    deleteVehicleQ: "Delete vehicle?", deleteVehicleMsg: "This will delete the vehicle and all trips + fuel logs saved under it.",
    cancelTripQ: "Cancel trip?", cancelTripMsg: "This will discard the current active trip and all its legs.",
    importBackupQ: "Import backup?", importBackupMsg: "Import replaces your current saved data with the file contents. Tip: Export first if you want a backup of what’s currently here.",
    import: "Import", sendReport: "Send report via email", subject: "Subject",
    message: "Message", copy: "Copy", openEmail: "Open email", editLeg: "Edit Leg",
    startTime: "Start Time", endTime: "End Time", odoStart: "Odo Start", odoEnd: "Odo End", exportPack: "Export Pack",
    exportPackDesc: "Save, share, or back up your data.",
    pdfPrint: "PDF & Print",
    downloadPdf: "Download PDF",
    createEmailDraft: "Create Email Draft",
    downloadJson: "Download JSON",
    importJsonWarning: "Import replaces current app data. Export first if unsure.",
    tripItReport: "Trip-It Report", generated: "Generated:", storageKey: "Storage key:", 
    templates: "Templates", saveTemplate: "Save as Template", templateName: "Template Name", 
    load: "Load", manageTemplates: "Manage Templates", noTemplates: "No templates saved.", tag: "Tag / Location", startTag: "Start Tag", endTag: "End Tag",
    titleTag: "Title Tag", purposeTag: "Purpose Tag", close: "Close", save: "Save",
    driver: "Driver", driverPlaceholder: "Enter driver name", passengers: "Passengers", passengerPlaceholder: "Add passenger name", noPassengers: "No passengers", passengerCount: "Passenger count", driverSuggestions: "Driver suggestions", passengerSuggestions: "Passenger suggestions", passengerInstructions: "Press Enter or comma to add a name.", removePassenger: "Remove passenger", showAll: "Show all", showLess: "Show less", more: "more", people: "People", copyPreviousDriver: "Copy previous driver", copyPreviousPassengers: "Copy previous passengers", clearPassengers: "Clear passengers"
  },
  DE: {
    hub: "Hub", preview: "Vorschau", export: "Export", help: "Hilfe",
    vehicle: "Fahrzeug", addVehicle: "+ Fahrzeug hinzufügen", activeVehicle: "Aktives Fahrzeug",
    noVehicles: "Noch keine Fahrzeuge. Klicke", edit: "Bearbeiten", delete: "Löschen",
    month: "Monat", monthSummary: "Monatsübersicht", trips: "Fahrten",
    activeTrip: "Aktive Fahrt", startTrip: "Fahrt starten", cancelTrip: "Fahrt abbrechen",
    addVehicleToStart: "Füge ein Fahrzeug hinzu, um Fahrten zu protokollieren.", started: "Gestartet:",
    purpose: "Zweck:", legs: "Etappen", noLegs: "Noch keine Etappen. Füge unten eine hinzu.",
    updateLeg: "Etappe aktualisieren", quickLeg: "Schnelle Etappe", duplicateLast: "Letzte duplizieren",
    return: "Umkehren", from: "Von", to: "Nach", start: "Start", end: "Ende",
    odoS: "Km Start", odoE: "Km Ende", note: "Notiz", cancel: "Abbrechen", update: "Aktualisieren",
    add: "Hinzufügen", endTrip: "Fahrt beenden", tripTitle: "Titel *",
    purposeOpt: "Zweck (Optional)", date: "Datum", recentTrips: "Letzte Fahrten",
    selectVehicleView: "Wähle ein Fahrzeug, um Fahrten zu sehen.", noTrips: "Keine Fahrten für",
    fuel: "Tanken", last: "Zuletzt:", selectVehicleFuel: "Wähle ein Fahrzeug, um Tanken zu protokollieren.",
    editFuel: "Tankvorgang bearbeiten", addFuel: "Tankvorgang hinzufügen", odometer: "Kilometerstand",
    station: "Tankstelle", liters: "Liter", totalCost: "Gesamtkosten", currency: "Währung",
    fullTank: "Volltank", notes: "Notizen", fuelHistory: "Tankverlauf",
    wash: "Wäsche", selectVehicleWash: "Wähle ein Fahrzeug.", type: "Typ",
    location: "Ort", cost: "Kosten", upd: "Akt.", del: "Löschen",
    recordTrips: "Protokolliere deine täglichen Fahrten", returnHub: "Zurück zum ToolStack Hub",
    saveVehicle: "Fahrzeug speichern", vehicleName: "Fahrzeugname *", make: "Marke", model: "Modell",
    plate: "Kennzeichen", vin: "FIN", optional: "optional",
    rangeSelection: "Zeitraum", reports: "Berichte", previewPack: "Vorschau-Paket",
    printSavePdf: "Drucken / PDF speichern", csvShare: "CSV / Teilen", exportCsv: "CSV exportieren",
    copySummary: "Zusammenfassung kopieren", emailSummary: "Zusammenfassung mailen", dataBackup: "Datensicherung",
    exportJson: "JSON exportieren (Voll)", importJson: "JSON importieren",
    fullBackupDesc: "Vollständiges Backup aller Fahrzeuge und Einstellungen.",
    selectMonth: "Monat wählen", year: "Jahr", thisMonth: "Dieser Monat", selected: "Ausgewählt:",
    deleteVehicleQ: "Fahrzeug löschen?", deleteVehicleMsg: "Dies löscht das Fahrzeug und alle gespeicherten Fahrten + Tankvorgänge.",
    cancelTripQ: "Fahrt abbrechen?", cancelTripMsg: "Dies verwirft die aktuelle aktive Fahrt und alle Etappen.",
    importBackupQ: "Backup importieren?", importBackupMsg: "Import ersetzt die aktuellen Daten durch den Dateiinhalt. Tipp: Exportiere zuerst, wenn du ein Backup der aktuellen Daten möchtest.",
    import: "Importieren", sendReport: "Bericht per E-Mail senden", subject: "Betreff",
    message: "Nachricht", copy: "Kopieren", openEmail: "E-Mail öffnen", editLeg: "Etappe bearbeiten",
    startTime: "Startzeit", endTime: "Endzeit", odoStart: "Km Start", odoEnd: "Km Ende", exportPack: "Export-Paket",
    exportPackDesc: "Speichere, teile oder sichere deine Daten.",
    pdfPrint: "PDF & Drucken",
    downloadPdf: "PDF herunterladen",
    createEmailDraft: "E-Mail-Entwurf erstellen",
    downloadJson: "JSON herunterladen",
    importJsonWarning: "Der Import ersetzt die aktuellen App-Daten. Exportiere zuerst, wenn du unsicher bist.",
    tripItReport: "Trip-It Bericht", generated: "Erstellt:", storageKey: "Speicherschlüssel:", 
    templates: "Vorlagen", saveTemplate: "Als Vorlage speichern", templateName: "Vorlagenname", 
    load: "Laden", manageTemplates: "Vorlagen verwalten", noTemplates: "Keine Vorlagen gespeichert.", tag: "Tag / Ort", startTag: "Start Tag", endTag: "End Tag",
    titleTag: "Titel-Tag", purposeTag: "Zweck-Tag", close: "Schließen", save: "Speichern",
    driver: "Fahrer", driverPlaceholder: "Fahrernamen eingeben", passengers: "Fahrgäste", passengerPlaceholder: "Fahrgast hinzufügen", noPassengers: "Keine Fahrgäste", passengerCount: "Anzahl Fahrgäste", driverSuggestions: "Fahrervorschläge", passengerSuggestions: "Fahrgastvorschläge", passengerInstructions: "Mit Eingabetaste oder Komma hinzufügen.", removePassenger: "Fahrgast entfernen", showAll: "Alle anzeigen", showLess: "Weniger anzeigen", more: "weitere", people: "Personen", copyPreviousDriver: "Vorherigen Fahrer kopieren", copyPreviousPassengers: "Vorherige Fahrgäste kopieren", clearPassengers: "Fahrgäste löschen"
  }
};

// Optional: set later
const HUB_URL = "https://YOUR-WIX-HUB-URL-HERE";

// 1) Safe uid helper (Hardened for mobile/older browsers)
const uid = () => {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // ignore
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const safeParse = (s, fallback) => {
  try {
    const v = JSON.parse(s);
    return v != null ? v : fallback;
  } catch {
    return fallback;
  }
};

// B1) Harden localStorage completely
const safeStorageGet = (key) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeStorageSet = (key, value) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const toNumber = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const money = (v, currency = "EUR") => {
  const n = toNumber(v);
  const sym = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency === "GBP" ? "£" : `${currency} `;
  return `${sym}${n.toFixed(2)}`;
};

const monthKey = (isoDate) => {
  const d = isoDate ? new Date(isoDate) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`; // YYYY-MM
};

const monthLabel = (ym, lang = "EN") => {
  const [y, m] = String(ym || "").split("-");
  if (!y || !m) return String(ym || "");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(lang === "DE" ? "de-DE" : "en-US", { year: "numeric", month: "long" });
};

// ---------- Date Range Helpers ----------
const toLocalISO = (d) => {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
};

const getRangeDates = (mode) => {
  const now = new Date();
  const d = new Date(now);
  
  if (mode === "thisWeek") {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const mon = new Date(d.setDate(diff));
    const sun = new Date(d.setDate(mon.getDate() + 6));
    return { start: toLocalISO(mon), end: toLocalISO(sun) };
  }
  if (mode === "lastWeek") {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
    const mon = new Date(d.setDate(diff));
    const sun = new Date(d.setDate(mon.getDate() + 6));
    return { start: toLocalISO(mon), end: toLocalISO(sun) };
  }
  if (mode === "thisMonth") {
    const y = d.getFullYear(), m = d.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return { start: toLocalISO(start), end: toLocalISO(end) };
  }
  if (mode === "lastMonth") {
    const y = d.getFullYear(), m = d.getMonth() - 1;
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return { start: toLocalISO(start), end: toLocalISO(end) };
  }
  // Default to today
  const t = toLocalISO(now);
  return { start: t, end: t };
};

// ---------- Accent underline (fixed, non-dynamic Tailwind) ----------
function AccentUnderline({ className = "" }) {
  return (
    <div
      className={`h-[2px] rounded-full ${className}`}
      style={{ background: "linear-gradient(to right, transparent, var(--ts-accent), transparent)" }}
    />
  );
}

// ---------- Shared profile ----------
function loadProfile() {
  const p = safeParse(safeStorageGet(PROFILE_KEY), null);
  return (
    p || {
      org: "ToolStack",
      user: "",
      language: "EN",
      logo: "",
    }
  );
}

// ---------- Normalized top actions (Master Pack) ----------
function ActionButton({ children, onClick, disabled, title }) {
  return (
    <Button variant="ghost" onClick={onClick} title={title} disabled={disabled} className="print:hidden min-w-0">
      <span className="w-full text-center">{children}</span>
    </Button>
  );
}

// ---------- Help Pack v1 (Canonical) ----------
// ---------- Help Pack v1 (Graffiti Style) ----------
function HelpCard({ title, children }) {
  return (
    <div className="rounded-xl border border-[var(--ts-border)] bg-[var(--ts-surface)] p-4">
      <div className="mb-2 text-base font-semibold text-[var(--ts-text)]">{title}</div>
      <div className="text-sm text-[var(--ts-text-muted)] leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function HelpBullet({ children }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1.5 h-2 w-2 shrink-0 rotate-45 bg-[var(--ts-accent)]" />
      <span>{children}</span>
    </li>
  );
}

function HelpModal({ open, onClose, appName = "ToolStack App" }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 backdrop-blur-sm">
      <div className="absolute inset-0 bg-slate-700/25" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
        <div className="ts-modal max-w-3xl">
          
          {/* Header */}
          <div className="ts-modal__header">
            <div className="relative z-10">
              <div className="text-xs font-bold uppercase tracking-widest text-neutral-500">ToolStack • Help Pack v1</div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                {appName} <span className="text-[var(--ts-accent)]">Help</span>
              </h2>
              <div className="mt-2 text-sm font-bold text-neutral-400 uppercase tracking-wide">How your data works</div>
            </div>

            <IconButton label="Close" onClick={onClose}>×</IconButton>
          </div>

          <div className="ts-modal__body space-y-6">
            
            <HelpCard title="About Trip-It">
              <p>Trip-It is a local-first trip and vehicle log tool designed to help you record trips, fuel, and key vehicle details, then generate clean print-ready summaries. It’s built for daily operational logging with no accounts, no cloud storage, and no automatic data sharing.</p>
            </HelpCard>

            <HelpCard title="How Trip-It Works">
              <p>Trip-It follows a simple workflow:</p>
              <ul className="space-y-2 mt-2">
                <HelpBullet><b className="text-white">1. Add Vehicles</b><br/>Create one or more vehicles with basic identifiers (name/plate/type).</HelpBullet>
                <HelpBullet><b className="text-white">2. Log Trips</b><br/>Add trips with dates, purpose/route notes, and distance (km).</HelpBullet>
                <HelpBullet><b className="text-white">3. Log Fuel (optional)</b><br/>Record fuel entries to support cost tracking and usage history.</HelpBullet>
                <HelpBullet><b className="text-white">4. Review Totals</b><br/>Trip-It calculates totals and summaries based on your entries.</HelpBullet>
                <HelpBullet><b className="text-white">5. Preview & Print</b><br/>Use Preview to generate a print-ready report.</HelpBullet>
                <HelpBullet><b className="text-white">6. Export a Backup</b><br/>Export a JSON backup regularly, especially after major updates.</HelpBullet>
              </ul>
            </HelpCard>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <HelpCard title="Your Data & Privacy">
                <p>Your data is saved locally in this browser using secure local storage.</p>
                <p className="mt-2">This means:</p>
                <ul className="mt-2 space-y-2">
                  <HelpBullet>Your data stays on this device</HelpBullet>
                  <HelpBullet>Clearing browser data can remove your logs</HelpBullet>
                  <HelpBullet>Incognito/private mode will not retain data</HelpBullet>
                  <HelpBullet>Data does not automatically sync across devices</HelpBullet>
                </ul>
              </HelpCard>

              <HelpCard title="Backup & Restore">
                <p>Export downloads a JSON backup of your current Trip-It data.</p>
                <p>Import restores a previously exported JSON file and replaces current app data.</p>
                <p className="mt-2">Recommended routine:</p>
                <ul className="mt-2 space-y-2">
                  <HelpBullet>Export weekly</HelpBullet>
                  <HelpBullet>Export after major edits</HelpBullet>
                  <HelpBullet>Store backups in two locations (e.g., Downloads + Drive/USB)</HelpBullet>
                </ul>
              </HelpCard>

              <HelpCard title="Transfer Phone to PC">
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Export Full Backup on the phone.</li><li>Send or save the JSON file.</li><li>Open Trip-It on the PC.</li><li>Import the Full Backup.</li><li>Choose Merge Into Current Data.</li><li>Review additions and conflicts.</li><li>Confirm the merge.</li>
                </ol>
                <p className="mt-2">Report JSON cannot be merged. Merge combines compatible data; Replace substitutes the operational dataset after creating a verified rollback snapshot.</p>
              </HelpCard>
            </div>

            <HelpCard title="Buttons Explained">
              <ul className="space-y-2">
                <HelpBullet><b className="text-white">Preview</b> – Opens the print-ready view.</HelpBullet>
                <HelpBullet><b className="text-white">Print / Save PDF</b> – Prints only the preview sheet. Choose “Save as PDF” to create a file.</HelpBullet>
                <HelpBullet><b className="text-white">Export</b> – Downloads a JSON backup file.</HelpBullet>
                <HelpBullet><b className="text-white">Import</b> – Restores data from a JSON backup file.</HelpBullet>
              </ul>
            </HelpCard>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <HelpCard title="Storage Keys (Advanced)">
                <div className="rounded-sm border-2 border-dashed border-neutral-600 bg-neutral-900 px-3 py-2 text-xs font-mono text-[var(--ts-accent)] break-all">
                  App data key: toolstack.tripit.v1<br/>
                  Shared profile key: toolstack.profile.v1<br/>
                  Legacy key: toolstack_tripit_v1
                </div>
              </HelpCard>

              <HelpCard title="Notes / Limitations">
                <p>Trip-It is a logging tool. Totals and summaries depend on the accuracy of the entries you provide.</p>
                <p className="mt-2">Use Export regularly to avoid data loss.</p>
              </HelpCard>
            </div>

            <HelpCard title="Support / Feedback">
              <p>If something breaks, include: device + browser + steps to reproduce + what you expected vs what happened.</p>
            </HelpCard>

          </div>

          <div className="ts-modal__footer">
            <button
              type="button"
              className={btnAccent}
              onClick={onClose}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- UI helpers ----------
const BTN_BASE = "print:hidden";
const btnSecondary = `${buttonClass("secondary")} ${BTN_BASE}`;
const btnPrimary = btnSecondary;
const btnAccent = `${buttonClass("primary")} ${BTN_BASE}`;
const btnDanger = `${buttonClass("danger")} ${BTN_BASE}`;


const inputBase = inputClass;
const inputCompact = compactInputClass;
const card = cardClass;
const cardHead = cardHeaderClass;
const cardPad = cardBodyClass;

function Pill({ children, tone = "default" }) {
  return <Badge variant={tone === "warn" ? "danger" : tone}>{children}</Badge>;
}

function ConfirmModal({ open, title, message, confirmText = "Delete", onConfirm, onCancel }) {
  const cancelRef = useRef(null);
  const returnFocusRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement;
    cancelRef.current?.focus();
    return () => returnFocusRef.current?.focus?.();
  }, [open]);
  if (!open) return null;
  return (
    <div className="ts-modal-backdrop">
      <div className="ts-modal max-w-md" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="ts-modal__header">
          <div><div id="confirm-title" className="text-lg font-semibold text-neutral-800">{title}</div><div className="text-sm text-neutral-700 mt-1">{message}</div></div>
          <IconButton label="Close" onClick={onCancel}>×</IconButton>
        </div>
        <div className="ts-modal__footer">
          <button
            type="button"
            ref={cancelRef}
            className={btnSecondary}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={btnDanger}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailModal({ open, to, subject, body, onClose, onChangeTo, onChangeBody, onCopy, onOpenEmail }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-700/25" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white shadow-xl overflow-hidden">
          <div className="p-4 border-b border-neutral-100 flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-neutral-500">ToolStack • Email</div>
              <h2 className="text-lg font-semibold text-neutral-800">Send report via email</h2>
              <div className="mt-3">
                <AccentUnderline className="w-56" />
              </div>
            </div>
            <button
              type="button"
              className={btnSecondary}
              onClick={onClose}
            >
              Close
            </button>
          </div>

          <div className="p-4 space-y-3 max-h-[70vh] overflow-auto">
            <div>
              <label className="text-sm font-medium text-neutral-700">To</label>
              <input
                className={`${inputBase} mt-2`}
                value={to}
                onChange={(e) => onChangeTo && onChangeTo(e.target.value)}
                placeholder="email@example.com (optional)"
              />
              <div className="text-xs text-neutral-600 mt-2">
                Tip: This uses your device’s email app (mailto). Attachments aren’t added automatically — use Export/CSV if you
                need files.
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Subject</label>
              <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
                {subject}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Message</label>
              <textarea
                className={`${inputBase} mt-2 min-h-[220px]`}
                value={body}
                onChange={(e) => onChangeBody && onChangeBody(e.target.value)}
              />
            </div>
          </div>

          <div className="p-4 border-t border-neutral-100 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={onCopy}
            >
              Copy
            </button>
            <button
              type="button"
              className={btnAccent}
              onClick={onOpenEmail}
            >
              Open email
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Template Modal ----------
function TemplateModal({ open, type, templates, onClose, onLoad, onDelete, onSaveCurrent, t }) {
  const [newTemplateName, setNewTemplateName] = useState("");

  if (!open) return null;
  
  const filtered = templates.filter(tpl => tpl.type === type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-slate-700/25" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-neutral-200 shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="font-semibold text-neutral-800">{t("manageTemplates")} ({type === 'trip' ? t("trips") : t("legs")})</div>
          <button className={btnSecondary} onClick={onClose}>{t("close")}</button>
        </div>
        
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Save Current Section */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 space-y-2">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{t("saveTemplate")}</div>
            <div className="flex gap-2">
              <input 
                className={inputBase} 
                placeholder={t("templateName")} 
                value={newTemplateName}
                onChange={e => setNewTemplateName(e.target.value)}
              />
              <button 
                className={btnAccent} 
                disabled={!newTemplateName.trim()}
                onClick={() => { onSaveCurrent(newTemplateName); setNewTemplateName(""); }}
              >
                {t("save")}
              </button>
            </div>
            <div className="text-xs text-neutral-500">Saves current form values as a new template.</div>
          </div>

          {/* List */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{t("load")}</div>
            {filtered.length === 0 ? (
              <EmptyState title={t("noTemplates")} description="Save the current form to reuse it later." />
            ) : (
              filtered.map(tpl => (
                <div key={tpl.id} className="flex items-center justify-between p-2 rounded-lg border border-neutral-100 bg-white hover:border-neutral-300 transition">
                  <div className="font-medium text-neutral-800 truncate pr-2">{tpl.name}</div>
                  <div className="flex gap-2 shrink-0">
                    <button className="px-2 py-1 rounded-sm text-[10px] font-black uppercase tracking-wider border-2 border-neutral-700 bg-neutral-700 text-white hover:border-[var(--ts-accent)] hover:text-[var(--ts-accent)] transition-all" onClick={() => onLoad(tpl)}>{t("load")}</button>
                    <button className="ts-hover-accent px-2 py-1 rounded-sm text-[10px] font-black uppercase tracking-wider border-2 border-red-500 bg-red-500 text-white hover:text-red-600" onClick={() => onDelete(tpl.id)}>{t("delete")}</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Leg Modal (for saved legs) ----------
function LegModal({ open, leg, onClose, onSave, t, suggestions = [], driverSuggestions = [], passengerSuggestions = [] }) {
  const [draft, setDraft] = useState(normalizeLegPeople(leg || {}));
  const [timeValidationAttempted, setTimeValidationAttempted] = useState(false);
  const timeValidation = validateLegTimes(draft);
  const showTimeErrors = timeValidationAttempted || (isValidTime(draft.startTime) && isValidTime(draft.endTime) && draft.endTime < draft.startTime);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  const handleChange = (f, v) => setDraft(d => ({ ...d, [f]: v }));
  const handleTimeChange = (field, value) => {
    setDraft((current) => updateLegTime(current, field, value));
    setTimeValidationAttempted(false);
  };
  const handleSave = () => {
    if (!timeValidation.ok) {
      setTimeValidationAttempted(true);
      return;
    }
    onSave(normalizeLegPeople(draft));
  };

  return (
    <ModalShell
      title={t("editLeg")}
      onClose={onClose}
      maxWidth="32rem"
      footer={<><button className={btnSecondary} onClick={onClose}>{t("cancel")}</button><button className={btnAccent} onClick={handleSave}>{t("save")}</button></>}
    >
      <div className="min-w-0 space-y-3 overflow-x-hidden">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-neutral-600">{t("from")}</label>
              <input className={`${inputBase} mt-1`} value={draft.startPlace || ""} onChange={e => handleChange("startPlace", e.target.value)} list="leg-modal-locations" />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-600">{t("to")}</label>
              <input className={`${inputBase} mt-1`} value={draft.endPlace || ""} onChange={e => handleChange("endPlace", e.target.value)} list="leg-modal-locations" />
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:col-span-2">
              <div className="mb-2 text-xs font-semibold text-neutral-700">Time</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TimeInput id="saved-leg-start-time" label={t("startTime")} value={draft.startTime || ""} onChange={(value) => handleTimeChange("startTime", value)} error={showTimeErrors ? timeValidation.errors.startTime : ""} />
                <TimeInput id="saved-leg-end-time" label={t("endTime")} value={draft.endTime || ""} onChange={(value) => handleTimeChange("endTime", value)} error={showTimeErrors ? timeValidation.errors.endTime : ""} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-600">{t("odoStart")}</label>
              <input className={`${inputBase} mt-1 text-right tabular-nums`} inputMode="decimal" value={draft.odoStart || ""} onChange={e => handleChange("odoStart", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-600">{t("startTag")}</label>
              <input className={`${inputBase} mt-1`} value={draft.startTag || ""} onChange={e => handleChange("startTag", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-600">{t("endTag")}</label>
              <input className={`${inputBase} mt-1`} value={draft.endTag || ""} onChange={e => handleChange("endTag", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-600">{t("odoEnd")}</label>
              <input className={`${inputBase} mt-1 text-right tabular-nums`} inputMode="decimal" value={draft.odoEnd || ""} onChange={e => handleChange("odoEnd", e.target.value)} />
            </div>
          </div>
          <LegPeopleInput idPrefix="saved-leg" driver={draft.driver || ""} passengers={draft.passengers || []} onDriverChange={(value) => handleChange("driver", value)} onPassengersChange={(value) => handleChange("passengers", value)} driverSuggestions={driverSuggestions} passengerSuggestions={passengerSuggestions} t={t} />
          <div>
            <label className="text-xs font-medium text-neutral-600">{t("note")}</label>
            <input className={`${inputBase} mt-1`} value={draft.note || ""} onChange={e => handleChange("note", e.target.value)} />
          </div>
        <datalist id="leg-modal-locations">
          {suggestions.map((s, i) => <option key={i} value={s} />)}
        </datalist>
      </div>
    </ModalShell>
  );
}

// ---------- Month Picker (Trip-It style) ----------
function MonthPicker({ value, onChange, disabled, lang, t }) {
  const [open, setOpen] = useState(false);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth() + 1;

  // popup defaults to current year when opened
  const [year, setYear] = useState(currentYear);

  const years = useMemo(() => {
    const start = currentYear - 5;
    return Array.from({ length: 11 }, (_, i) => start + i);
  }, [currentYear]);

  const months = useMemo(
    () => [
      { n: 1, label: "Jan" },
      { n: 2, label: "Feb" },
      { n: 3, label: "Mar" },
      { n: 4, label: "Apr" },
      { n: 5, label: "May" },
      { n: 6, label: "Jun" },
      { n: 7, label: "Jul" },
      { n: 8, label: "Aug" },
      { n: 9, label: "Sep" },
      { n: 10, label: "Oct" },
      { n: 11, label: "Nov" },
      { n: 12, label: "Dec" },
    ],
    []
  );

  const pick = (monthNum) => {
    const mm = String(monthNum).padStart(2, "0");
    onChange && onChange(`${year}-${mm}`);
    setOpen(false);
  };

  const setThisMonth = () => {
    const mm = String(currentMonthNum).padStart(2, "0");
    onChange && onChange(`${currentYear}-${mm}`);
    setOpen(false);
  };

  return (
    <>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => { setYear(currentYear); setOpen(true); }}
          className={
            "ts-control flex items-center justify-between gap-3 text-left " +
            (disabled ? "opacity-50 cursor-not-allowed" : "")
          }
          title="Choose month"
        >
          <span className="truncate">{monthLabel(value, lang)}</span>
          <span
            className={
              "h-8 w-8 rounded-lg border border-neutral-200 bg-white flex items-center justify-center shrink-0 " +
              "hover:bg-[rgb(var(--ts-accent-rgb)/0.30)] hover:border-[var(--ts-accent)]"
            }
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-neutral-700"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </span>
        </button>
      </div>

      {open ? (
        <div className="ts-modal-backdrop">
          <div className="absolute inset-0 bg-slate-700/25" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="w-full max-w-md">
            <div className="ts-modal max-w-md">
              <div className="ts-modal__header">
                <div>
                  <div className="text-sm text-neutral-500">ToolStack • Month picker</div>
                  <div className="text-lg font-semibold text-neutral-800">{t("selectMonth")}</div>
                  <div className="mt-3">
                    <AccentUnderline className="w-44" />
                  </div>
                </div>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => setOpen(false)}
                >
                  {t("close")}
                </button>
              </div>

              <div className="ts-modal__body space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-neutral-700">{t("year")}</div>
                  <select
                    className="ts-control w-auto"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                  >
                    {years.map((yy) => (
                      <option key={yy} value={yy}>
                        {yy}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {months.map((m) => {
                    const active = year === currentYear && m.n === currentMonthNum;
                    return (
                      <button
                        key={m.n}
                        type="button"
                        className={`min-h-11 rounded-xl border text-sm font-semibold transition-all ${
                          active
                            ? "border-neutral-700 bg-neutral-700 text-white shadow-[2px_2px_0px_rgba(0,0,0,0.2)]"
                            : "border-neutral-200 bg-white text-neutral-600 hover:border-[var(--ts-accent)] hover:text-[var(--ts-accent)]"
                        }`}
                        onClick={() => pick(m.n)}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={setThisMonth}
                  >
                    {t("thisMonth")}
                  </button>
                  <div className="text-sm text-neutral-600">
                    {t("selected")} <span className="font-medium text-neutral-800">{monthLabel(value, lang)}</span>
                  </div>
                </div>

                <div className="text-xs text-neutral-600">Default highlight is always the current month.</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ---------- Data model ----------
function emptyApp() {
  return {
    vehicles: [],
    activeVehicleId: null,
    activeTripByVehicle: {}, // { [vid]: Trip | null }
    tripsByVehicle: {},      // { [vid]: Trip[] }
    fuelByVehicle: {},
    washByVehicle: {},
    ui: { month: monthKey(todayISO()) },
    templates: [],
  };
}

function normalizeApp(raw) {
  const base = emptyApp();
  const a = raw && typeof raw === "object" ? raw : base;

  const vehicles = Array.isArray(a.vehicles) ? a.vehicles.filter(Boolean) : [];
  const fuelByVehicle = a.fuelByVehicle && typeof a.fuelByVehicle === "object" ? a.fuelByVehicle : {};
  const washByVehicle = a.washByVehicle && typeof a.washByVehicle === "object" ? a.washByVehicle : {};
  const ui = a.ui && typeof a.ui === "object" ? a.ui : base.ui;
  const templates = Array.isArray(a.templates) ? a.templates : [];

  const normVehicles = vehicles.map((v) => ({
    id: v.id || uid(),
    name: String(v.name || "").trim(),
    make: String(v.make || "").trim(),
    model: String(v.model || "").trim(),
    plate: String(v.plate || "").trim(),
    vin: String(v.vin || "").trim(),
    notes: String(v.notes || ""),
  }));

  const normFuelByVehicle = {};
  const normWashByVehicle = {};
  // Ensure objects
  const normActiveTripByVehicle = (a.activeTripByVehicle && typeof a.activeTripByVehicle === 'object') ? a.activeTripByVehicle : {};
  const normTripsByVehicle = (a.tripsByVehicle && typeof a.tripsByVehicle === 'object') ? a.tripsByVehicle : {};

  // Migration: Convert legacy legsByVehicle to tripsByVehicle if trips are missing
  if (a.legsByVehicle && typeof a.legsByVehicle === 'object' && Object.keys(normTripsByVehicle).length === 0) {
    for (const vid in a.legsByVehicle) {
      const legs = Array.isArray(a.legsByVehicle[vid]) ? a.legsByVehicle[vid] : [];
      if (legs.length === 0) continue;

      // Group legs by date
      const byDate = {};
      legs.forEach(l => {
        const d = l.startDate || todayISO();
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(l);
      });

      const trips = [];
      for (const date in byDate) {
        const dayLegs = byDate[date].sort((x, y) => (x.startTime || "").localeCompare(y.startTime || ""));
        const newLegs = dayLegs.map(l => ({
          id: l.id || uid(),
          startPlace: l.startPlace || "",
          startTime: l.startTime || "",
          odoStart: l.odoStart != null ? toNumber(l.odoStart) : null,
          endPlace: l.endPlace || "",
          endTime: l.endTime || "",
          odoEnd: l.odoEnd != null ? toNumber(l.odoEnd) : null,
          km: toNumber(l.km),
          note: l.note || l.purpose || "", // Map purpose to note for legacy
          startTag: l.startTag || "",
          endTag: l.endTag || l.tag || "",
          tag: l.tag || "",
          driver: "",
          passengers: [],
          createdAt: l.createdAt || new Date().toISOString()
        }));

        trips.push({
          id: uid(),
          vehicleId: vid,
          title: `Trip on ${date}`,
          purpose: "",
          driver: "",
          passengers: [],
          tags: "",
          startedAt: new Date(date).toISOString(),
          startDate: date,
          status: "finished",
          legs: newLegs,
          notes: "",
          finishedAt: new Date(date).toISOString()
        });
      }
      normTripsByVehicle[vid] = trips.sort((a, b) => {
        const tA = a.startedAt || a.startDate || "";
        const tB = b.startedAt || b.startDate || "";
        if (tA > tB) return -1;
        if (tA < tB) return 1;
        return 0;
      });
    }
  }

  for (const v of normVehicles) {
    // Ensure arrays exist
    if (!Array.isArray(normTripsByVehicle[v.id])) normTripsByVehicle[v.id] = [];
    
    // Ensure each trip has legs array
    normTripsByVehicle[v.id] = normTripsByVehicle[v.id].map(t => {
        if (!t) return null;
        return migrateTripPeopleToLegs({ ...t, tags: t.tags || "", titleTag: t.titleTag || "", purposeTag: t.purposeTag || "", legs: Array.isArray(t.legs) ? t.legs : [] });
    }).filter(Boolean);

    if (!normActiveTripByVehicle[v.id]) {
        normActiveTripByVehicle[v.id] = null;
    } else {
        // Ensure active trip has legs array
        normActiveTripByVehicle[v.id] = migrateTripPeopleToLegs({
          ...normActiveTripByVehicle[v.id],
          legs: Array.isArray(normActiveTripByVehicle[v.id].legs) ? normActiveTripByVehicle[v.id].legs : []
        }, { preserveEmptyTripDefaults: true });
    }

    // Normalize Fuel
    const flist = Array.isArray(fuelByVehicle[v.id]) ? fuelByVehicle[v.id] : [];
    normFuelByVehicle[v.id] = flist
      .filter(Boolean)
      .map((f) => ({
        id: f.id || uid(),
        date: typeof f.date === "string" && f.date ? f.date : todayISO(),
        odometer: f.odometer != null ? f.odometer : "",
        liters: f.liters != null ? f.liters : 0,
        totalCost: f.totalCost != null ? f.totalCost : 0,
        currency: String(f.currency || "EUR") || "EUR",
        fullTank: !!f.fullTank,
        station: String(f.station || ""),
        notes: String(f.notes || ""),
      }));

    // Normalize Wash
    const wlist = Array.isArray(washByVehicle[v.id]) ? washByVehicle[v.id] : [];
    normWashByVehicle[v.id] = wlist.filter(Boolean).map((w) => ({
      id: w.id || uid(),
      date: typeof w.date === "string" && w.date ? w.date : todayISO(),
      type: String(w.type || "Quick"),
      location: String(w.location || ""),
      cost: w.cost != null ? w.cost : "",
      note: String(w.note || ""),
      createdAt: w.createdAt || new Date().toISOString(),
    }));
  }
  
  const normTemplates = templates.map(t => ({
    id: t.id || uid(),
    type: t.type || "trip",
    name: String(t.name || "Untitled"),
    data: t.type === "leg" ? normalizeLegPeople(t.data || {}) : (t.data || {})
  }));

  let activeVehicleId = a.activeVehicleId || null;
  if (activeVehicleId && !normVehicles.some((x) => x.id === activeVehicleId)) activeVehicleId = null;
  if (!activeVehicleId && normVehicles.length) activeVehicleId = normVehicles[0].id;

  const month = typeof ui.month === "string" && ui.month ? ui.month : base.ui.month;

  return {
    vehicles: normVehicles,
    activeVehicleId,
    activeTripByVehicle: normActiveTripByVehicle,
    tripsByVehicle: normTripsByVehicle,
    fuelByVehicle: normFuelByVehicle,
    washByVehicle: normWashByVehicle,
    ui: { month },
    templates: normTemplates,
  };
}

// Legacy migration (best-effort): if old format has `trips` (really legs), migrate into one Imported vehicle.
function migrateLegacyIfNeeded(saved) {
  if (!saved || typeof saved !== "object") return null;
  if (Array.isArray(saved.vehicles) || saved.legsByVehicle || saved.tripsByVehicle) return saved;

  const legacyTrips = Array.isArray(saved.trips) ? saved.trips : null;
  if (!legacyTrips) return saved;

  const vid = uid();
  const importedVehicle = {
    id: vid,
    name: "Imported vehicle",
    make: "",
    model: "",
    plate: "",
    vin: "",
    notes: "Auto-created to preserve legacy Trip-It data.",
  };

  // Convert legacy flat trips to legsByVehicle format, normalizeApp will then convert to tripsByVehicle
  const normLegs = legacyTrips
    .filter(Boolean)
    .map((t) => {
      const odoStart = t.odoStart != null ? t.odoStart : (t.odometerStart != null ? t.odometerStart : null);
      const odoEnd = t.odoEnd != null ? t.odoEnd : (t.odometerEnd != null ? t.odometerEnd : null);
      const dist =
        t.distance != null && t.distance !== ""
          ? toNumber(t.distance)
          : (odoEnd != null && odoStart != null ? Math.max(0, toNumber(odoEnd) - toNumber(odoStart)) : 0);

      return {
        id: t.id || uid(),
        vehicleId: vid,
        startDate: typeof t.date === "string" && t.date ? t.date : todayISO(),
        startTime: "",
        startPlace: String(t.from || t.start || ""),
        odoStart: odoStart != null ? toNumber(odoStart) : null,
        endTime: "",
        endPlace: String(t.to || t.end || ""),
        odoEnd: odoEnd != null ? toNumber(odoEnd) : null,
        km: dist,
        purpose: String(t.purpose || ""),
        note: String(t.notes || ""),
        createdAt: new Date().toISOString(),
      };
    });

  return {
    vehicles: [importedVehicle],
    activeVehicleId: vid,
    activeTripByVehicle: { [vid]: null },
    legsByVehicle: { [vid]: normLegs }, // Temporary for normalizeApp to consume
    fuelByVehicle: { [vid]: [] },
    washByVehicle: { [vid]: [] },
    ui: { month: monthKey(todayISO()) },
    templates: [],
  };
}

function isNormalizedApp(value) {
  return !!value && typeof value === "object" && Array.isArray(value.vehicles)
    && value.tripsByVehicle && typeof value.tripsByVehicle === "object";
}

function loadInitialState() {
  const primary = readJson(KEY);
  if (primary.ok && primary.status === "valid") {
    return { app: normalizeApp(primary.value), gate: null, source: "primary" };
  }

  if (!primary.ok && primary.status === "corrupt") {
    const preserved = preserveRecoveryRaw(KEY, primary.raw);
    return {
      app: emptyApp(),
      gate: { kind: "recovery", raw: primary.raw, preservation: preserved },
      source: "corrupt",
    };
  }

  if (!primary.ok) {
    return {
      app: emptyApp(),
      gate: { kind: "storage-unavailable", result: primary },
      source: "unavailable",
    };
  }

  const legacy = readRaw(LEGACY_LS_KEY);
  if (!legacy.ok) {
    return {
      app: emptyApp(),
      gate: { kind: "storage-unavailable", result: legacy },
      source: "unavailable",
    };
  }
  if (legacy.status === "missing") return { app: emptyApp(), gate: null, source: "new" };

  const migrated = migrateLegacyTransactional({
    legacyKey: LEGACY_LS_KEY,
    destinationKey: KEY,
    transform: (value) => normalizeApp(migrateLegacyIfNeeded(value) || emptyApp()),
    validate: isNormalizedApp,
  });
  if (migrated.ok) return { app: normalizeApp(migrated.data), gate: null, source: "migrated" };
  return {
    app: emptyApp(),
    gate: { kind: "migration", result: migrated, legacyRaw: legacy.raw },
    source: "legacy-error",
  };
}

// A) Crash Overlay & Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, stack: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const stack = errorInfo?.componentStack || error?.stack || "";
    this.setState({ stack });
    console.error("Trip-It Crash:", error);
  }

  componentDidMount() {
    window.addEventListener("error", this.onWindowError);
    window.addEventListener("unhandledrejection", this.onPromiseRejection);
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.onWindowError);
    window.removeEventListener("unhandledrejection", this.onPromiseRejection);
  }

  onWindowError = (event) => {
    this.setState({ hasError: true, error: event.error || new Error(event.message), stack: event.error?.stack });
  };

  onPromiseRejection = (event) => {
    this.setState({ hasError: true, error: event.reason || new Error("Unhandled Rejection"), stack: event.reason?.stack });
  };

  render() {
    if (this.state.hasError) {
      const { error, stack } = this.state;
      const stackLines = (stack || "").split("\n").slice(0, 5).join("\n");
      
      return (
        <div className="fixed inset-0 z-[9999] bg-white text-neutral-900 p-6 overflow-auto font-sans">
          <div className="max-w-lg mx-auto space-y-4">
            <h1 className="text-2xl font-bold text-red-600">Trip-It crashed</h1>
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm">
              <div className="font-semibold">{error?.toString() || "Unknown Error"}</div>
            </div>
            {stackLines && (
              <div className="p-4 bg-neutral-100 border border-neutral-200 rounded-xl text-xs font-mono whitespace-pre-wrap overflow-x-auto">
                {stackLines}
              </div>
            )}
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-neutral-800 text-white rounded-xl font-medium active:scale-95 transition"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function BlockingStorageScreen({ gate, onRetry, onStartNew, onContinueLegacy }) {
  const recovery = gate.kind === "recovery";
  const migration = gate.kind === "migration";
  const raw = recovery ? gate.raw : gate.legacyRaw;
  const key = recovery ? gate.preservation?.recoveryKey : gate.result?.backupKey;
  const title = recovery
    ? "Unreadable Trip-It data found"
    : migration
      ? "Legacy data migration could not be completed"
      : "Browser storage is unavailable";
  return (
    <div className="min-h-screen bg-[#f4f6f8] text-[#1f2933] flex items-center justify-center p-4">
      <main className="w-full max-w-2xl rounded-2xl border border-amber-300 bg-white p-6 shadow-xl" role="alert">
        <div className="mb-4 h-1 w-16 rounded-full bg-[var(--ts-accent)]" /><h1 className="text-2xl font-semibold text-amber-800">{title}</h1>
        <p className="mt-4 text-neutral-700">
          {recovery && "Trip-It found saved data that cannot be parsed. The normal application is locked so the unreadable value cannot be overwritten."}
          {migration && "Trip-It could not verify a safe copy at the new storage key. The original data remains unchanged under toolstack_tripit_v1."}
          {gate.kind === "storage-unavailable" && "Trip-It cannot safely read browser storage. The application is locked to prevent accidental replacement of existing records."}
        </p>
        {recovery && (
          <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
            {gate.preservation?.ok
              ? <>Recovery copy: <span className="font-mono break-all">{key}</span><br />Preserved: {gate.preservation.timestamp}</>
              : "The in-browser recovery copy could not be verified. Download the raw value before taking any other action."}
          </div>
        )}
        {migration && gate.result?.phase && <p className="mt-3 text-sm text-neutral-600">Failed step: {gate.result.phase}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          {raw !== undefined && (
            <button className={btnAccent} onClick={() => downloadRawRecovery(raw, recovery ? "tripit-corrupt-recovery.txt" : "tripit-legacy-recovery.json")}>Download raw data</button>
          )}
          <button className={btnSecondary} onClick={onRetry}>{migration ? "Retry migration" : "Retry reading storage"}</button>
          {migration && <button className={btnSecondary} onClick={onContinueLegacy}>Continue from legacy source</button>}
          {recovery && <button className={btnDanger} onClick={onStartNew}>Start with a new empty dataset</button>}
        </div>
      </main>
    </div>
  );
}

function ImportWorkflowModal({ state, currentCounts, onClose, onReplace, onMerge, onResolution, onResolveConflicts, onRetry, onRollback, onDownloadCurrent, onDownloadCandidate, onDownloadMerge }) {
  if (!state.open) return null;
  const candidateCounts = state.prepared?.counts;
  const rows = [
    ["Vehicles", "vehicles"], ["Completed trips", "completedTrips"], ["Active trips", "activeTrips"],
    ["Legs", "legs"], ["Fuel entries", "fuelEntries"], ["Wash entries", "washEntries"], ["Templates", "templates"],
  ];
  const recordSummary = (record) => Object.entries(record || {}).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value)).slice(0, 7);
  return (
    <div className="ts-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <div className="ts-modal max-w-2xl">
        <div className="ts-modal__header">
          <div><h2 id="import-title" className="text-xl font-bold">Backup Import</h2><p className="text-sm text-neutral-600">Current data is not replaced until validation, snapshot, write, and read-back verification succeed.</p></div>
          <IconButton label="Close" onClick={onClose}>×</IconButton>
        </div>
        <div className="ts-modal__body space-y-4">
          {state.stage === "reading" && <p>Reading and validating backup…</p>}
          {state.stage === "preview" && candidateCounts && (
            <>
              <div className="rounded-xl border bg-neutral-50 p-4 text-sm space-y-1">
                <div><b>Detected:</b> {state.prepared.classification.label}</div>
                <div><b>Schema:</b> {state.prepared.classification.schemaVersion}</div>
                <div><b>Exported:</b> {state.prepared.classification.exportedAt || "Not recorded"}</div>
                <div><b>Migration:</b> {state.prepared.classification.migrationRequired ? "Yes" : "No"}</div>
              </div>
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left py-2">Records</th><th className="text-right">Current</th><th className="text-right">Imported</th></tr></thead><tbody>{rows.map(([label, key]) => <tr className="border-b" key={key}><td className="py-2">{label}</td><td className="text-right">{currentCounts[key] || 0}</td><td className="text-right font-semibold">{candidateCounts[key] || 0}</td></tr>)}</tbody></table></div>
              {state.prepared.warnings.length > 0 && <div className="rounded-xl bg-amber-50 border border-amber-300 p-3"><div className="font-semibold">Warnings</div><ul className="list-disc pl-5 text-sm">{state.prepared.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
              <div className="grid sm:grid-cols-2 gap-3 text-sm"><div className="rounded-xl border-2 border-lime-500 bg-lime-50 p-3"><b>Merge preserves current records</b><p>Compatible records are combined. Probable duplicates and conflicts require decisions. A verified pre-merge snapshot is created.</p></div><div className="rounded-xl border border-red-300 bg-red-50 p-3"><b>Replace removes current records</b><p>The imported dataset substitutes the current operational dataset after a verified pre-import snapshot.</p></div></div>
              {state.mergePlan && (
                <div className="space-y-3">
                  <h3 className="font-bold">Planned Merge</h3>
                  <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b"><th className="text-left py-1">Type</th><th>Add</th><th>Match</th><th>Update</th><th>Skip</th><th>Probable</th><th>Conflicts</th></tr></thead><tbody>{Object.entries(state.mergePlan.stats).map(([type, stats]) => <tr className="border-b text-center" key={type}><td className="text-left py-1 capitalize">{type}</td><td>{stats.added}</td><td>{stats.matched}</td><td>{stats.updated}</td><td>{stats.skipped}</td><td>{stats.probable}</td><td>{stats.conflicts}</td></tr>)}</tbody></table></div>
                  <div className="rounded-xl bg-neutral-50 border p-3 text-sm"><b>Final expected counts:</b> {rows.map(([label, key]) => `${label} ${state.mergePlan.finalCounts[key] || 0}`).join(" · ")}</div>
                  {state.mergePlan.unresolved.length > 0 && <div className="rounded-xl border border-amber-400 bg-amber-50 p-3"><div className="flex flex-wrap justify-between gap-2"><b>{state.mergePlan.unresolved.length} decision(s) required</b><div className="flex gap-2"><button className={btnSecondary} onClick={() => onResolveConflicts("current")}>Keep Current for All Conflicts</button><button className={btnSecondary} onClick={() => onResolveConflicts("imported")}>Use Imported for All Conflicts</button></div></div></div>}
                  {[...state.mergePlan.conflicts, ...state.mergePlan.probableDuplicates].map((item) => (
                    <div key={item.key} className="rounded-xl border p-3 text-sm space-y-2">
                      <div className="font-bold capitalize">{item.type}: {item.identity}</div><div className="text-neutral-600">{item.reason}</div>
                      <div className="grid sm:grid-cols-2 gap-2"><div className="bg-neutral-50 p-2"><b>Current</b>{recordSummary(item.current).map(([key, value]) => <div key={key}><span className="text-neutral-500">{key}:</span> {String(value)}</div>)}</div><div className="bg-neutral-50 p-2"><b>Imported</b>{recordSummary(item.imported).map(([key, value]) => <div key={key}><span className="text-neutral-500">{key}:</span> {String(value)}</div>)}</div></div>
                      <div className="flex flex-wrap gap-2">{item.options.map((option) => <button key={option} className={state.mergePlan.resolutions[item.key] === option ? btnAccent : btnSecondary} onClick={() => onResolution(item.key, option)}>{({ current: "Keep Current", imported: "Use Imported", both: "Keep Both", remap: "Keep Both (remap vehicle)", same: "Treat as Same Record", skip: "Skip Imported", complete: "Convert Imported to Completed Draft", discard: "Discard Imported Active Trip" })[option] || option}</button>)}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-3"><button className={btnAccent} disabled={!state.mergePlan?.ready} onClick={onMerge}>Merge Into Current Data</button><button className={btnDanger} onClick={onReplace}>Replace Current Data</button></div>
            </>
          )}
          {(state.stage === "error" || state.stage === "transaction-failed") && (
            <div className="space-y-4">
              <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-950"><div className="font-bold">File rejected — {state.result?.code}</div><ul className="mt-2 list-disc pl-5 text-sm space-y-1">{(state.result?.errors || []).map((error, index) => <li key={`${error.path}-${index}`}><span className="font-mono">{error.path}</span>: {error.message}</li>)}</ul></div>
              <div className="flex flex-wrap gap-2">
                {state.stage === "transaction-failed" && <button className={btnAccent} onClick={onRetry}>Retry transaction</button>}
                {state.currentSerialized && <button className={btnSecondary} onClick={onDownloadCurrent}>Download Current Backup</button>}
                {state.candidateSerialized && <button className={btnSecondary} onClick={onDownloadCandidate}>Download Imported</button>}
                {state.mergeSerialized && <button className={btnSecondary} onClick={onDownloadMerge}>Download Planned Merge</button>}
              </div>
            </div>
          )}
          {state.stage === "success" && (
            <div className="space-y-4"><div className="rounded-xl border border-green-300 bg-green-50 p-4"><div className="font-bold text-green-900">{state.operation === "merge" ? "Merge" : "Import"} completed and verified.</div><div className="mt-1 text-sm">Rollback key: <span className="font-mono break-all">{state.rollbackKey}</span></div></div><button className={btnDanger} onClick={onRollback}>{state.operation === "merge" ? "Restore Pre-Merge Data" : "Restore Pre-Import Data"}</button></div>
          )}
        </div>
      </div>
    </div>
  );
}

function TripIt() {
  const importInputRef = useRef(null);

  const [profile, setProfile] = useState(loadProfile);
  const [initial] = useState(loadInitialState);
  const [app, setApp] = useState(initial.app);
  const [storageGate, setStorageGate] = useState(initial.gate);
  const [persistence, setPersistence] = useState({
    status: initial.gate?.kind === "storage-unavailable" ? "unavailable" : "saved",
    lastSavedAt: initial.source === "new" ? null : new Date().toISOString(),
    revision: 0,
    error: null,
  });
  const pendingSuccess = useRef(null);
  const appRevision = useRef(0);

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [previewConfig, setPreviewConfig] = useState({ mode: "thisMonth", start: "", end: "" });

  const [helpOpen, setHelpOpen] = useState(false);
  const [emailModal, setEmailModal] = useState({ open: false, to: "", subject: "", body: "" });

  const [vehicleModal, setVehicleModal] = useState({ open: false, mode: "new", vehicleId: null });
  const [confirm, setConfirm] = useState({ open: false, kind: null, id: null, payload: null });
  const [importWorkflow, setImportWorkflow] = useState({ open: false, stage: "idle", prepared: null, result: null, file: null });
  const [templateModal, setTemplateModal] = useState({ open: false, type: "trip" });

  // Form States
  const [tripStartForm, setTripStartForm] = useState({
    title: "",
    purpose: "",
    startDate: todayISO()
  });
  const [pendingFirstLegPeople, setPendingFirstLegPeople] = useState({ driver: "", passengers: [] });

  const [legForm, setLegForm] = useState({
    startPlace: "",
    startTime: roundTimeToFiveMinutes(),
    odoStart: "",
    endPlace: "",
    endTime: "",
    odoEnd: "",
    note: "",
    startTag: "",
    endTag: ""
    ,driver: "",
    passengers: []
  });
  const [editingActiveLegId, setEditingActiveLegId] = useState(null);
  const [timeValidationAttempted, setTimeValidationAttempted] = useState(false);
  const [savedLegModal, setSavedLegModal] = useState({ open: false, tripId: null, leg: null });
  const legTimeValidation = validateLegTimes(legForm);
  const showLegTimeErrors = timeValidationAttempted || (isValidTime(legForm.startTime) && isValidTime(legForm.endTime) && legForm.endTime < legForm.startTime);
  const changeLegTime = (field, value) => {
    setLegForm((current) => updateLegTime(current, field, value));
    setTimeValidationAttempted(false);
  };
  const requireValidLegTimes = (form = legForm) => {
    const result = validateLegTimes(form);
    if (result.ok) return true;
    setTimeValidationAttempted(true);
    notify(Object.values(result.errors)[0]);
    return false;
  };

  // Fuel Form State
  const [fuelForm, setFuelForm] = useState({
    date: todayISO(),
    odometer: "",
    liters: "",
    totalCost: "",
    currency: "EUR",
    fullTank: true,
    station: "",
    notes: ""
  });
  const [editingFuelId, setEditingFuelId] = useState(null);
  const [fuelHistoryOpen, setFuelHistoryOpen] = useState(false);
  const [fuelSectionOpen, setFuelSectionOpen] = useState(false);

  // Wash Form State
  const [washForm, setWashForm] = useState({
    date: todayISO(),
    type: "Quick",
    location: "",
    cost: "",
    note: ""
  });
  const [editingWashId, setEditingWashId] = useState(null);
  const [washSectionOpen, setWashSectionOpen] = useState(false);
  const [recentTripsOpen, setRecentTripsOpen] = useState(true);
  const [addingLegToTripId, setAddingLegToTripId] = useState(null);

  const t = (k) => {
    const l = profile.language || "EN";
    return TRANSLATIONS[l]?.[k] || TRANSLATIONS["EN"][k] || k;
  };

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  const notify = (msg) => {
    if (SUCCESS_MESSAGES.has(msg)) pendingSuccess.current = msg;
    else showToast(msg);
  };

  const persistApp = useCallback((value, revision = appRevision.current) => {
    setPersistence((current) => ({ ...current, status: "saving", error: null }));
    let serialized;
    try {
      serialized = JSON.stringify(value);
    } catch (error) {
      setPersistence((current) => ({ ...current, status: "failed", error }));
      pendingSuccess.current = null;
      return false;
    }
    const result = writeVerified(KEY, serialized);
    if (!result.ok) {
      setPersistence((current) => persistenceFromResult(result, current));
      pendingSuccess.current = null;
      return false;
    }
    const savedAt = new Date().toISOString();
    const nextPersistence = persistenceFromResult({ ok: true, savedAt, revision });
    setPersistence(nextPersistence);
    if (pendingSuccess.current && canShowSavedFeedback(nextPersistence)) {
      showToast(pendingSuccess.current);
      pendingSuccess.current = null;
    }
    return true;
  }, [showToast]);

  useEffect(() => {
    if (storageGate) return;
    appRevision.current += 1;
    const revision = appRevision.current;
    const timer = setTimeout(() => persistApp(app, revision), 0);
    return () => clearTimeout(timer);
  }, [app, storageGate, persistApp]);

  useEffect(() => {
    safeStorageSet(PROFILE_KEY, JSON.stringify(profile));
  }, [profile]);

  const activeVehicle = useMemo(
    () => app.vehicles.find((v) => v.id === app.activeVehicleId) || null,
    [app.vehicles, app.activeVehicleId]
  );

  const activeTrip = useMemo(() => {
    if (!activeVehicle) return null;
    return app.activeTripByVehicle[activeVehicle.id] || null;
  }, [app.activeTripByVehicle, activeVehicle]);

  const trips = useMemo(() => {
    if (!activeVehicle) return [];
    return Array.isArray(app.tripsByVehicle[activeVehicle.id]) ? app.tripsByVehicle[activeVehicle.id] : [];
  }, [app.tripsByVehicle, activeVehicle]);

  const fuelLogs = useMemo(() => {
    if (!activeVehicle) return [];
    return Array.isArray(app.fuelByVehicle[activeVehicle.id]) ? app.fuelByVehicle[activeVehicle.id] : [];
  }, [app.fuelByVehicle, activeVehicle]);

  const washLogs = useMemo(() => {
    if (!activeVehicle) return [];
    if (!activeVehicle || !app.washByVehicle) return [];
    return Array.isArray(app.washByVehicle[activeVehicle.id]) ? app.washByVehicle[activeVehicle.id] : [];
  }, [app.washByVehicle, activeVehicle]);

  const tripsForMonth = useMemo(() => {
    const m = app.ui.month;
    // Sort newest first
    return trips.filter((t) => monthKey(t.startDate) === m).sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  }, [trips, app.ui.month]);

  const fuelForMonth = useMemo(() => {
    const m = app.ui.month;
    return fuelLogs.filter((f) => monthKey(f.date) === m).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [fuelLogs, app.ui.month]);

  const tripTotals = useMemo(() => {
    let distance = 0;
    let legCount = 0;
    tripsForMonth.forEach(t => {
      (t.legs || []).forEach(l => {
        distance += toNumber(l.km);
        legCount++;
      });
    });

    let lastOdo = null;
    if (tripsForMonth.length > 0) {
      const latestTrip = tripsForMonth[0];
      if (latestTrip.legs.length > 0) {
        lastOdo = latestTrip.legs[latestTrip.legs.length - 1].odoEnd;
      }
    }
    return { distance, count: legCount, tripCount: tripsForMonth.length, lastOdo };
  }, [tripsForMonth]);

  const fuelTotals = useMemo(() => {
    const liters = fuelForMonth.reduce((s, f) => s + toNumber(f.liters), 0);
    const spend = fuelForMonth.reduce((s, f) => s + toNumber(f.totalCost), 0);
    const currency = (fuelForMonth[0] && fuelForMonth[0].currency) || "EUR";
    const avgPerLiter = liters > 0 ? spend / liters : 0;
    return { liters, spend, currency, avgPerLiter, count: fuelForMonth.length };
  }, [fuelForMonth]);
  const modernFuelStats = useMemo(() => fuelLogStats(fuelForMonth), [fuelForMonth]);
  const modernWashStats = useMemo(() => washLogStats(washLogs), [washLogs]);

  const currentDatasetCounts = useMemo(() => validateApplicationPayload(app).counts || {
    vehicles: 0, completedTrips: 0, activeTrips: 0, legs: 0, fuelEntries: 0, washEntries: 0, templates: 0,
  }, [app]);

  // Preview Data Calculation
  const previewData = useMemo(() => {
    if ((!previewOpen && !exportModalOpen) || !activeVehicle) return { trips: [], fuel: [], wash: [], totals: {} };
    
    const { start, end } = previewConfig;
    const s = start || "0000-00-00";
    const e = end || "9999-99-99";

    // Filter and sort ascending for report
    const filteredTrips = trips
      .filter(t => t.startDate >= s && t.startDate <= e)
      .reverse(); // trips is desc, we want asc for report

    const filteredFuel = fuelLogs
      .filter(f => f.date >= s && f.date <= e)
      .reverse();
    const filteredWash = washLogs.filter((entry) => entry.date >= s && entry.date <= e).reverse();

    let distance = 0;
    let legCount = 0;
    filteredTrips.forEach(t => {
      (t.legs || []).forEach(l => {
        distance += toNumber(l.km);
        legCount++;
      });
    });

    const liters = filteredFuel.reduce((acc, f) => acc + toNumber(f.liters), 0);
    const spend = filteredFuel.reduce((acc, f) => acc + toNumber(f.totalCost), 0);
    const currency = (filteredFuel[0] && filteredFuel[0].currency) || "EUR";

    return {
      trips: filteredTrips,
      fuel: filteredFuel,
      wash: filteredWash,
      totals: { distance, legCount, tripCount: filteredTrips.length, liters, spend, currency }
    };
  }, [previewOpen, exportModalOpen, activeVehicle, trips, fuelLogs, washLogs, previewConfig]);
  const reportRangeValidation = validateReportRange(previewConfig);

  const legTags = useMemo(() => {
    // Reduced defaults + frequency based sorting
    const defaults = ["Home", "Work", "Client"];
    const counts = {};

    if (activeVehicle && app.tripsByVehicle[activeVehicle.id]) {
      app.tripsByVehicle[activeVehicle.id].forEach(t => {
        (t.legs || []).forEach(l => {
          if (l.startTag) counts[l.startTag] = (counts[l.startTag] || 0) + 1;
          if (l.endTag) counts[l.endTag] = (counts[l.endTag] || 0) + 1;
        });
      });
    }

    const history = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const combined = new Set(defaults);
    history.forEach(tag => combined.add(tag));

    return Array.from(combined).slice(0, 8);
  }, [app.tripsByVehicle, activeVehicle]);

  const locationSuggestions = useMemo(() => {
    const locations = new Map();
    if (activeVehicle && app.tripsByVehicle[activeVehicle.id]) {
      app.tripsByVehicle[activeVehicle.id].forEach((t, tripIndex) => {
        (t.legs || []).forEach((l, legIndex) => {
          const timestamp = Date.parse(l.createdAt || `${t.startDate}T${l.endTime || l.startTime || "00:00"}`) || (1_000_000_000_000 - tripIndex * 1_000 - legIndex);
          [l.startPlace, l.endPlace].forEach((rawValue) => {
            const value = String(rawValue || "").trim().replace(/\s+/g, " ");
            if (!value) return;
            const key = value.toLocaleLowerCase();
            const existing = locations.get(key);
            if (existing) { existing.frequency += 1; existing.lastUsed = Math.max(existing.lastUsed, timestamp); }
            else locations.set(key, { value, frequency: 1, lastUsed: timestamp });
          });
        });
      });
    }
    return [...locations.values()];
  }, [app.tripsByVehicle, activeVehicle]);

  const allLocations = useMemo(() => locationSuggestions.map((item) => item.value), [locationSuggestions]);
  const peopleSuggestions = useMemo(() => buildPeopleSuggestionItems(Object.values(app.tripsByVehicle).flatMap((vehicleTrips) => vehicleTrips.flatMap((trip) => trip.legs || []))), [app.tripsByVehicle]);

  const setMonth = (m) => setApp((a) => ({ ...a, ui: { ...a.ui, month: m } }));

  const handleLegKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveActiveLeg();
    } else if (e.key === "Escape") {
      cancelEditActiveLeg();
    }
  };

  const handleFocus = (e) => {
    if (e.target.type === "time") {
      setTimeout(() => e.target.select?.(), 0);
    } else {
      e.target.select();
    }
  };

  const duplicateLastLeg = () => {
    if (!activeTrip || !activeTrip.legs.length) return;
    const last = activeTrip.legs[activeTrip.legs.length - 1];
    setLegForm((prev) => ({
      ...prev,
      startPlace: last.startPlace,
      startTag: last.startTag || "",
      endPlace: last.endPlace,
      endTag: last.endTag || last.tag || "",
      note: last.note,
      startTime: freshLegTimes(last.endTime).startTime,
      endTime: "",
      driver: normalizeDriver(last.driver),
      passengers: normalizePassengers(last.passengers),
    }));
  };

  const swapLegPlaces = () => {
    setLegForm((prev) => ({
      ...prev,
      startPlace: prev.endPlace,
      startTag: prev.endTag,
      endPlace: prev.startPlace,
      endTag: prev.startTag,
    }));
  };

  const resetLegForm = (trip) => {
    if (trip && trip.draft) {
      setLegForm(normalizeLegPeople(trip.draft, trip));
      return;
    }
    if (trip && trip.legs.length > 0) {
      const lastLeg = trip.legs[trip.legs.length - 1];
      const peopleDefaults = freshLegPeople(lastLeg);
      setLegForm({
        startPlace: lastLeg.endPlace,
        startTag: lastLeg.endTag || "",
        startTime: freshLegTimes(lastLeg.endTime).startTime,
        odoStart: (lastLeg && lastLeg.odoEnd != null) ? lastLeg.odoEnd : "",
        endPlace: "",
        endTag: "",
        endTime: "",
        odoEnd: "",
        note: "",
        ...peopleDefaults
      });
    } else {
      // New trip or first leg: fetch last odo from history
      let lastOdo = "";
      if (trips.length > 0) {
        const lastTrip = trips[0];
        if (lastTrip && lastTrip.legs.length > 0) {
          const lastLeg = lastTrip.legs[lastTrip.legs.length - 1];
          if (lastLeg && lastLeg.odoEnd != null) lastOdo = lastLeg.odoEnd;
        }
      }
      const peopleDefaults = freshLegPeople(null, trip);
      setLegForm({
        startPlace: "",
        startTag: "",
        startTime: roundTimeToFiveMinutes(),
        odoStart: lastOdo !== "" ? lastOdo : "",
        endPlace: "",
        endTag: "",
        endTime: "",
        odoEnd: "",
        note: "",
        ...peopleDefaults
      });
    }
  };

  // Auto-fill leg form defaults when active trip changes or legs added
  useEffect(() => {
    if (!editingActiveLegId) {
      if (activeTrip) {
        resetLegForm(activeTrip);
      } else {
        // New trip, try to find last finished trip for odo
        const lastTrip = trips[0];
        let lastOdo = "";
        if (lastTrip && lastTrip.legs.length > 0) {
          const lastLeg = lastTrip.legs[lastTrip.legs.length - 1];
          if (lastLeg && lastLeg.odoEnd != null) lastOdo = lastLeg.odoEnd;
        }
        setLegForm(prev => ({
          ...prev,
          startPlace: "",
          startTime: roundTimeToFiveMinutes(),
          odoStart: lastOdo,
          endPlace: "",
          endTime: "",
          odoEnd: "",
          note: "",
          driver: "",
          passengers: []
        }));
      }
    }
  }, [activeTrip?.id, activeTrip?.legs?.length, trips.length, editingActiveLegId]);

  // Persist draft leg
  useEffect(() => {
    if (!activeVehicle || !activeTrip || editingActiveLegId) return;
    const timer = setTimeout(() => {
      setApp(a => {
        const currentTrip = a.activeTripByVehicle[activeVehicle.id];
        if (!currentTrip) return a;
        if (JSON.stringify(currentTrip.draft) === JSON.stringify(legForm)) return a;
        return {
          ...a,
          activeTripByVehicle: {
            ...a.activeTripByVehicle,
            [activeVehicle.id]: { ...currentTrip, draft: legForm }
          }
        };
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [legForm, activeVehicle, activeTrip?.id, editingActiveLegId]);

  // ---------- Template Logic ----------
  const saveTemplate = (name) => {
    const type = templateModal.type;
    let data = {};
    
    if (type === 'trip') {
      data = { title: tripStartForm.title, purpose: tripStartForm.purpose };
    } else {
      data = { 
        startPlace: legForm.startPlace, 
        endPlace: legForm.endPlace, 
        note: legForm.note,
        driver: normalizeDriver(legForm.driver),
        passengers: normalizePassengers(legForm.passengers)
      };
    }

    setApp(a => ({
      ...a,
      templates: [...(a.templates || []), { id: uid(), type, name, data }]
    }));
    notify("Template saved");
  };

  const deleteTemplate = (id) => {
    if (!allowDestructiveAction("Deleting this template")) return;
    setApp(a => ({ ...a, templates: (a.templates || []).filter(t => t.id !== id) }));
  };

  const loadTemplate = (tpl) => {
    if (tpl.type === 'trip') {
      setTripStartForm(prev => ({ ...prev, title: tpl.data.title || "", purpose: tpl.data.purpose || "" }));
      const legacyPeople = { driver: normalizeDriver(tpl.data.driver), passengers: normalizePassengers(tpl.data.passengers) };
      setPendingFirstLegPeople(legacyPeople);
      if (legacyPeople.driver || legacyPeople.passengers.length) notify("Template people will be used as first-leg defaults");
    } else {
      setLegForm(prev => ({
        ...prev,
        startPlace: tpl.data.startPlace || "",
        startTag: tpl.data.startTag || "",
        endPlace: tpl.data.endPlace || "",
        endTag: tpl.data.endTag || "",
        note: tpl.data.note || "",
        driver: normalizeDriver(tpl.data.driver),
        passengers: normalizePassengers(tpl.data.passengers),
        odoEnd: ""
      }));
    }
    setTemplateModal({ open: false, type: 'trip' });
    notify("Template loaded");
  };

  // ---------- Vehicle CRUD ----------
  const openNewVehicle = () => setVehicleModal({ open: true, mode: "new", vehicleId: null });

  const saveVehicle = (vehicle) => {
    setApp((a) => {
      const exists = a.vehicles.some((v) => v.id === vehicle.id);
      const vehicles = exists ? a.vehicles.map((v) => (v.id === vehicle.id ? vehicle : v)) : [vehicle, ...a.vehicles];
      const tripsByVehicle = { ...a.tripsByVehicle };
      const activeTripByVehicle = { ...a.activeTripByVehicle };
      const fuelByVehicle = { ...a.fuelByVehicle };
      const washByVehicle = { ...a.washByVehicle };
      const templates = [...(a.templates || [])];
      
      if (!tripsByVehicle[vehicle.id]) tripsByVehicle[vehicle.id] = [];
      if (!activeTripByVehicle[vehicle.id]) activeTripByVehicle[vehicle.id] = null;
      if (!fuelByVehicle[vehicle.id]) fuelByVehicle[vehicle.id] = [];
      if (!washByVehicle[vehicle.id]) washByVehicle[vehicle.id] = [];
      
      const activeVehicleId = a.activeVehicleId || vehicle.id;
      return normalizeApp({ ...a, vehicles, tripsByVehicle, activeTripByVehicle, fuelByVehicle, washByVehicle, activeVehicleId, templates });
    });
    setVehicleModal({ open: false, mode: "new", vehicleId: null });
    notify("Vehicle saved");
  };

  const deleteVehicleNow = () => {
    if (!allowDestructiveAction("Deleting this vehicle and its records")) return;
    const id = confirm.id;
    setApp((a) => {
      const vehicles = a.vehicles.filter((v) => v.id !== id);
      const tripsByVehicle = { ...a.tripsByVehicle };
      const activeTripByVehicle = { ...a.activeTripByVehicle };
      const fuelByVehicle = { ...a.fuelByVehicle };
      const templates = [...(a.templates || [])];
      
      delete tripsByVehicle[id];
      delete activeTripByVehicle[id];
      delete fuelByVehicle[id];

      let activeVehicleId = a.activeVehicleId;
      if (activeVehicleId === id) activeVehicleId = vehicles.length ? vehicles[0].id : null;

      return normalizeApp({ ...a, vehicles, tripsByVehicle, activeTripByVehicle, fuelByVehicle, activeVehicleId, templates });
    });
    setConfirm({ open: false, kind: null, id: null, payload: null });
    notify("Vehicle deleted");
  };

  const selectVehicle = (id) => setApp((a) => ({ ...a, activeVehicleId: id }));

  // ---------- Trip Workflow ----------
  const startTrip = () => {
    if (!activeVehicle) return notify("Select a vehicle");
    if (!tripStartForm.title.trim()) return notify("Trip title is required");
    
    const newTrip = {
      id: uid(),
      vehicleId: activeVehicle.id,
      title: tripStartForm.title,
      purpose: tripStartForm.purpose,
      startedAt: new Date().toISOString(),
      startDate: tripStartForm.startDate,
      status: "active",
      legs: [],
      notes: ""
    };
    if (pendingFirstLegPeople.driver || pendingFirstLegPeople.passengers.length) {
      newTrip.driver = pendingFirstLegPeople.driver;
      newTrip.passengers = pendingFirstLegPeople.passengers;
    }

    setApp(a => ({
      ...a,
      activeTripByVehicle: { ...a.activeTripByVehicle, [activeVehicle.id]: newTrip }
    }));
    
    // Reset start form
    setTripStartForm({ title: "", purpose: "", startDate: todayISO() });
    setPendingFirstLegPeople({ driver: "", passengers: [] });
    notify("Trip started");
  };

  const saveActiveLeg = () => {
    if (!activeVehicle || !activeTrip) return;
    if (!requireValidLegTimes()) return;

    const odoStart = legForm.odoStart !== "" ? toNumber(legForm.odoStart) : null;
    const odoEnd = legForm.odoEnd !== "" ? toNumber(legForm.odoEnd) : null;

    if (odoStart == null || odoEnd == null) return notify("Odometer readings required");
    if (odoEnd < odoStart) return notify("End Odo cannot be less than Start Odo");

    const km = Math.max(0, odoEnd - odoStart);

    const legData = {
      startPlace: legForm.startPlace,
      startTime: legForm.startTime,
      odoStart: odoStart,
      endPlace: legForm.endPlace,
      endTime: legForm.endTime,
      odoEnd: odoEnd,
      startTag: legForm.startTag,
      endTag: legForm.endTag,
      driver: normalizeDriver(legForm.driver),
      passengers: normalizePassengers(legForm.passengers),
      km: km,
      note: legForm.note,
    };

    if (editingActiveLegId) {
      const { driver: _legacyDriver, passengers: _legacyPassengers, ...activeTripWithoutLegacyPeople } = activeTrip;
      const updatedTrip = {
        ...activeTripWithoutLegacyPeople,
        legs: activeTrip.legs.map(l => l.id === editingActiveLegId ? { ...l, ...legData } : l)
      };
      setApp(a => ({
        ...a,
        activeTripByVehicle: { ...a.activeTripByVehicle, [activeVehicle.id]: updatedTrip }
      }));
      setEditingActiveLegId(null);
      setTimeValidationAttempted(false);
      resetLegForm(updatedTrip);
      notify("Leg updated");
    } else {
      const newLeg = {
        id: uid(),
        ...legData,
        createdAt: new Date().toISOString()
      };
      const { driver: _legacyDriver, passengers: _legacyPassengers, ...activeTripWithoutLegacyPeople } = activeTrip;
      const updatedTrip = {
        ...activeTripWithoutLegacyPeople,
        legs: [...activeTrip.legs, newLeg]
        ,draft: null
      };
      setApp(a => ({
        ...a,
        activeTripByVehicle: { ...a.activeTripByVehicle, [activeVehicle.id]: updatedTrip }
      }));
      setTimeValidationAttempted(false);
      notify("Leg added");
    }
  };

  const editActiveLeg = (leg) => {
    setTimeValidationAttempted(false);
    setLegForm({
      startPlace: leg.startPlace,
      startTime: leg.startTime,
      odoStart: leg.odoStart != null ? leg.odoStart : "",
      startTag: leg.startTag || "",
      endPlace: leg.endPlace,
      endTag: leg.endTag || leg.tag || "",
      endTime: leg.endTime,
      odoEnd: leg.odoEnd != null ? leg.odoEnd : "",
      note: leg.note || ""
      ,driver: normalizeDriver(leg.driver),
      passengers: normalizePassengers(leg.passengers)
    });
    setEditingActiveLegId(leg.id);
  };

  const cancelEditActiveLeg = () => {
    setEditingActiveLegId(null);
    setTimeValidationAttempted(false);
    resetLegForm(activeTrip);
  };

  const deleteLeg = (legId) => {
    if (!activeVehicle || !activeTrip) return;
    if (!allowDestructiveAction("Deleting this leg")) return;
    const updatedTrip = {
      ...activeTrip,
      legs: activeTrip.legs.filter(l => l.id !== legId)
    };
    setApp(a => ({
      ...a,
      activeTripByVehicle: { ...a.activeTripByVehicle, [activeVehicle.id]: updatedTrip }
    }));
    if (editingActiveLegId === legId) {
      cancelEditActiveLeg();
    }
    setConfirm({ open: false, kind: null, id: null, payload: null });
  };

  const endTrip = () => {
    if (!activeVehicle || !activeTrip) return;

    const finishedTrip = {
      ...activeTrip,
      status: "finished",
      finishedAt: new Date().toISOString()
    };

    setApp(a => ({
      ...a,
      tripsByVehicle: { ...a.tripsByVehicle, [activeVehicle.id]: [finishedTrip, ...(a.tripsByVehicle[activeVehicle.id] || [])] },
      activeTripByVehicle: { ...a.activeTripByVehicle, [activeVehicle.id]: null }
    }));

    notify("Trip finished");
  };

  const cancelTrip = () => {
    if (!activeVehicle) return;
    if (!allowDestructiveAction("Cancelling this active trip")) return;
    setApp(a => ({
      ...a,
      activeTripByVehicle: { ...a.activeTripByVehicle, [activeVehicle.id]: null }
    }));
    setConfirm({ open: false, kind: null, id: null, payload: null });
    notify("Trip cancelled");
  };

  const deleteTrip = (tripId) => {
    if (!activeVehicle) return;
    if (!allowDestructiveAction("Deleting this trip")) return;
    setApp(a => ({
      ...a,
      tripsByVehicle: { ...a.tripsByVehicle, [activeVehicle.id]: (a.tripsByVehicle[activeVehicle.id] || []).filter(t => t.id !== tripId) }
    }));
    setConfirm({ open: false, kind: null, id: null, payload: null });
    notify("Trip deleted");
  };

  const deleteHistoricalLeg = (tripId, legId) => {
    if (!activeVehicle || !allowDestructiveAction("Deleting this historical leg")) return;
    setApp((current) => ({ ...current, tripsByVehicle: { ...current.tripsByVehicle, [activeVehicle.id]: (current.tripsByVehicle[activeVehicle.id] || []).map((trip) => trip.id === tripId ? { ...trip, legs: trip.legs.filter((leg) => leg.id !== legId) } : trip) } }));
    setConfirm({ open: false, kind: null, id: null, payload: null });
    notify("Leg deleted");
  };

  const saveSavedLeg = (updatedLeg) => {
    if (!activeVehicle || !savedLegModal.tripId) return;
    const timeValidation = validateLegTimes(updatedLeg);
    if (!timeValidation.ok) return notify(Object.values(timeValidation.errors)[0]);
    
    const odoStart = updatedLeg.odoStart !== "" ? toNumber(updatedLeg.odoStart) : null;
    const odoEnd = updatedLeg.odoEnd !== "" ? toNumber(updatedLeg.odoEnd) : null;
    const km = (odoStart != null && odoEnd != null) ? Math.max(0, odoEnd - odoStart) : 0;

    const finalLeg = { ...updatedLeg, odoStart, odoEnd, km };

    setApp(a => {
      const vehicleTrips = a.tripsByVehicle[activeVehicle.id] || [];
      const updatedTrips = vehicleTrips.map(t => {
        if (t.id === savedLegModal.tripId) {
          return {
            ...t,
            legs: t.legs.map(l => l.id === finalLeg.id ? finalLeg : l)
          };
        }
        return t;
      });
      return {
        ...a,
        tripsByVehicle: { ...a.tripsByVehicle, [activeVehicle.id]: updatedTrips }
      };
    });
    setSavedLegModal({ open: false, tripId: null, leg: null });
    notify("Leg updated");
  };

  const openAddLegToTrip = (trip) => {
    setAddingLegToTripId(trip.id);
    setExpandedTripId(trip.id); // Ensure it's expanded
    setTimeValidationAttempted(false);
    
    const sortedLegs = [...trip.legs].sort((a,b) => (a.startTime || "").localeCompare(b.startTime || ""));

    if (sortedLegs.length > 0) {
      const lastLeg = sortedLegs[sortedLegs.length - 1];
      const peopleDefaults = freshLegPeople(lastLeg);
      setLegForm({
        startPlace: lastLeg.endPlace,
        startTag: lastLeg.endTag || "",
        startTime: freshLegTimes(lastLeg.endTime).startTime,
        odoStart: (lastLeg && lastLeg.odoEnd != null) ? lastLeg.odoEnd : "",
        endPlace: "",
        endTag: "",
        endTime: "",
        odoEnd: "",
        note: "",
        ...peopleDefaults
      });
    } else {
      setLegForm({
        startPlace: "",
        startTag: "",
        startTime: roundTimeToFiveMinutes(),
        odoStart: "",
        endPlace: "",
        endTag: "",
        endTime: "",
        odoEnd: "",
        note: "",
        driver: "",
        passengers: []
      });
    }
  };

  const addLegToSavedTrip = (tripId) => {
    if (!activeVehicle) return;
    if (!requireValidLegTimes()) return;

    const odoStart = legForm.odoStart !== "" ? toNumber(legForm.odoStart) : null;
    const odoEnd = legForm.odoEnd !== "" ? toNumber(legForm.odoEnd) : null;

    if (odoStart == null || odoEnd == null) return notify("Odometer readings required");
    if (odoEnd < odoStart) return notify("End Odo cannot be less than Start Odo");

    const km = Math.max(0, odoEnd - odoStart);

    const newLeg = {
      id: uid(),
      startPlace: legForm.startPlace, startTime: legForm.startTime, odoStart,
      endPlace: legForm.endPlace, endTime: legForm.endTime, odoEnd,
      startTag: legForm.startTag, endTag: legForm.endTag,
      driver: normalizeDriver(legForm.driver), passengers: normalizePassengers(legForm.passengers),
      km, note: legForm.note, createdAt: new Date().toISOString()
    };

    setApp(a => {
      const vehicleTrips = a.tripsByVehicle[activeVehicle.id] || [];
      const updatedTrips = vehicleTrips.map(t => {
        if (t.id === tripId) {
          const updatedLegs = [...t.legs, newLeg].sort((l1, l2) => (l1.startTime || "").localeCompare(l2.startTime || ""));
          return { ...t, legs: updatedLegs };
        }
        return t;
      });
      return { ...a, tripsByVehicle: { ...a.tripsByVehicle, [activeVehicle.id]: updatedTrips } };
    });

    setAddingLegToTripId(null);
    setTimeValidationAttempted(false);
    notify("Leg added to trip");
  };

  // ---------- Wash CRUD ----------
  const saveWash = () => {
    if (!activeVehicle) return notify("Select a vehicle");
    const payload = {
      id: editingWashId || uid(),
      date: washForm.date,
      type: washForm.type,
      location: washForm.location,
      cost: washForm.cost,
      note: washForm.note,
      createdAt: new Date().toISOString()
    };

    setApp(a => {
      const list = Array.isArray(a.washByVehicle[activeVehicle.id]) ? a.washByVehicle[activeVehicle.id] : [];
      let nextList;
      if (editingWashId) {
        const original = list.find(w => w.id === editingWashId);
        nextList = list.map(w => w.id === editingWashId ? { ...payload, createdAt: original?.createdAt || payload.createdAt } : w);
      } else {
        nextList = [payload, ...list];
      }
      nextList.sort((a, b) => (a.date < b.date ? 1 : -1));
      return { ...a, washByVehicle: { ...a.washByVehicle, [activeVehicle.id]: nextList } };
    });
    cancelEditWash();
    notify(editingWashId ? "Wash updated" : "Wash logged");
  };

  const editWash = (w) => {
    setWashForm({
      date: w.date,
      type: w.type,
      location: w.location,
      cost: w.cost,
      note: w.note
    });
    setEditingWashId(w.id);
    setWashSectionOpen(true);
  };

  const cancelEditWash = () => {
    setWashForm({ date: todayISO(), type: "Quick", location: "", cost: "", note: "" });
    setEditingWashId(null);
  };

  const deleteWash = (id) => {
    if (!activeVehicle) return;
    if (!allowDestructiveAction("Deleting this wash entry")) return;
    setApp(a => {
      const list = Array.isArray(a.washByVehicle[activeVehicle.id]) ? a.washByVehicle[activeVehicle.id] : [];
      return { ...a, washByVehicle: { ...a.washByVehicle, [activeVehicle.id]: list.filter(w => w.id !== id) } };
    });
    setConfirm({ open: false, kind: null, id: null, payload: null });
    notify("Wash deleted");
  };

  // ---------- Fuel CRUD ----------
  const saveFuel = () => {
    if (!activeVehicle) return notify("Select a vehicle");
    
    const payload = {
      id: editingFuelId || uid(),
      date: fuelForm.date,
      odometer: fuelForm.odometer,
      liters: fuelForm.liters,
      totalCost: fuelForm.totalCost,
      currency: fuelForm.currency,
      fullTank: fuelForm.fullTank,
      station: fuelForm.station,
      notes: fuelForm.notes
    };

    setApp(a => {
      const list = Array.isArray(a.fuelByVehicle[activeVehicle.id]) ? a.fuelByVehicle[activeVehicle.id] : [];
      let nextList;
      if (editingFuelId) {
        nextList = list.map(f => f.id === editingFuelId ? payload : f);
      } else {
        nextList = [payload, ...list];
      }
      // Sort by date desc
      nextList.sort((a, b) => (a.date < b.date ? 1 : -1));
      
      return { ...a, fuelByVehicle: { ...a.fuelByVehicle, [activeVehicle.id]: nextList } };
    });

    cancelEditFuel(); // Resets form
    notify(editingFuelId ? "Fuel updated" : "Fuel added");
  };

  const editFuel = (f) => {
    setFuelForm({
      date: f.date,
      odometer: f.odometer,
      liters: f.liters,
      totalCost: f.totalCost,
      currency: f.currency,
      fullTank: f.fullTank,
      station: f.station,
      notes: f.notes
    });
    setEditingFuelId(f.id);
  };

  const cancelEditFuel = () => {
    setFuelForm({
      date: todayISO(),
      odometer: "",
      liters: "",
      totalCost: "",
      currency: "EUR",
      fullTank: true,
      station: "",
      notes: ""
    });
    setEditingFuelId(null);
  };

  const deleteFuel = (fuelId) => {
    if (!activeVehicle) return;
    if (!allowDestructiveAction("Deleting this fuel entry")) return;
    setApp((a) => {
      const list = Array.isArray(a.fuelByVehicle[activeVehicle.id]) ? a.fuelByVehicle[activeVehicle.id] : [];
      return { ...a, fuelByVehicle: { ...a.fuelByVehicle, [activeVehicle.id]: list.filter((f) => f.id !== fuelId) } };
    });
    setConfirm({ open: false, kind: null, id: null, payload: null });
    notify("Fuel entry deleted");
  };

  const confirmDeleteFuel = (id) => {
    if (window.confirm("Delete this fuel entry?")) {
      deleteFuel(id);
    }
  };

  // ---------- Export / Import ----------
  const downloadJSON = (payload, filename) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    downloadJSON(createFullBackup({ data: app, profile }), `trip-it-full-backup-${todayISO()}.json`);
  };

  const prepareImportFile = async (file) => {
    if (!file) return;
    setImportWorkflow({ open: true, stage: "reading", prepared: null, result: null, file });
    if (file.size > IMPORT_LIMITS.maxFileBytes) {
      setImportWorkflow({ open: true, stage: "error", prepared: null, result: { code: "FILE_TOO_LARGE", errors: [{ path: "$file", message: `File exceeds ${IMPORT_LIMITS.maxFileBytes} bytes.` }] }, file });
      return;
    }
    try {
      const text = await file.text();
      const prepared = prepareBackupImport({ text, size: file.size, normalize: (data) => normalizeApp(migrateLegacyIfNeeded(data) || emptyApp()) });
      if (!prepared.ok) setImportWorkflow({ open: true, stage: "error", prepared: null, result: prepared, file });
      else {
        const mergeTimestamp = new Date().toISOString();
        const mergePlan = createMergePlan(app, prepared.candidate, { importedAt: mergeTimestamp });
        setImportWorkflow({ open: true, stage: "preview", prepared, result: null, file, mergeTimestamp, mergePlan });
      }
    } catch {
      setImportWorkflow({ open: true, stage: "error", prepared: null, result: { code: "FILE_READ_FAILED", errors: [{ path: "$file", message: "The selected file could not be read." }] }, file });
    }
  };

  const onImportPick = () => {
    if (importInputRef.current) importInputRef.current.click();
  };

  // ---------- Header actions (Master Pack) ----------
  const openHub = () => {
    const url = String(HUB_URL || "").trim();
    if (!url || url.includes("YOUR-WIX-HUB-URL-HERE")) return notify("Set HUB_URL first");
    try {
      window.open(url, "_blank", "noreferrer");
    } catch {
      window.location.href = url;
    }
  };

  const openExportModal = () => {
    if (!activeVehicle) return notify("Select a vehicle first");
    const { start, end } = getRangeDates("thisMonth");
    if (!previewConfig.start) setPreviewConfig({ mode: "thisMonth", start, end });
    setExportModalOpen(true);
  };

  const openPreview = () => {
    if (!activeVehicle) return notify("Select a vehicle first");
    const { start, end } = getRangeDates("thisMonth");
    setPreviewConfig({ mode: "thisMonth", start, end });
    setPreviewOpen(true);
  };

  const updatePreviewMode = (mode) => {
    if (mode === "custom") {
      setPreviewConfig(prev => ({ ...prev, mode }));
    } else {
      const { start, end } = getRangeDates(mode);
      setPreviewConfig({ mode, start, end });
    }
  };

  const exportPreviewCSV = () => {
    const { trips } = previewData;
    if (!trips.length) return notify("No trips in range");
    
    const csvContent = createTripsCsv(trips);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tripit-export-${previewConfig.start}-to-${previewConfig.end}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportPreviewJSON = () => {
    const payload = createReportExport({
      range: { start: previewConfig.start, end: previewConfig.end },
      vehicle: { name: activeVehicle.name, plate: activeVehicle.plate },
      trips: previewData.trips,
      fuel: previewData.fuel,
    });
    downloadJSON(payload, `trip-it-report-${todayISO()}.json`);
  };

  // ---------- Email ----------
  const buildEmail = () => {
    const vName = (activeVehicle && activeVehicle.name) || "(no vehicle)";
    const rangeLabel = previewConfig.mode === "custom" ? `${previewConfig.start} to ${previewConfig.end}` : previewConfig.mode;
    const subject = `Trip-It report — ${vName} — ${rangeLabel}`;
    const t = previewData.totals;

    const lines = [];
    lines.push(`${profile.org || "ToolStack"}`);
    lines.push(`Trip-It report`);
    lines.push(`Vehicle: ${vName}`);
    lines.push(`Range: ${rangeLabel}`);
    if (profile.user) lines.push(`Prepared by: ${profile.user}`);
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push("");
    lines.push("Summary");
    lines.push(`- Trips: ${t.tripCount}`);
    lines.push(`- Legs: ${t.legCount}`);
    lines.push(`- Distance: ${t.distance.toFixed(1)} km`);
    lines.push(`- Fuel spend: ${money(t.spend, t.currency)} (${t.liters.toFixed(2)} L)`);
    lines.push("");

    lines.push("Trips");
    previewData.trips.forEach((trip) => {
      lines.push(`- ${trip.startDate}: ${trip.title || trip.purpose || "Untitled Trip"}`);
      (trip.legs || []).forEach((leg) => {
        lines.push(`  ${leg.startPlace || "?"} to ${leg.endPlace || "?"}`);
        if (leg.driver) lines.push(`    Driver: ${leg.driver}`);
        if (leg.passengers?.length) lines.push(`    Passengers (${leg.passengers.length}): ${normalizePassengers(leg.passengers).join("; ")}`);
      });
    });
    lines.push("");

    lines.push("For full details, use Export (JSON) or CSV.");

    return { subject, body: lines.join("\n") };
  };

  const openEmail = () => {
    // if (!activeVehicle) return notify("Select a vehicle first"); // Checked by openExportModal
    const built = buildEmail();
    setEmailModal((m) => ({ ...m, open: true, subject: built.subject, body: built.body }));
  };

  const copyEmail = async () => {
    try {
      const text = `Subject: ${emailModal.subject}\n\n${emailModal.body}`;
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      notify("Copied");
    } catch {
      notify("Copy failed");
    }
  };

  const openEmailClientFromModal = () => {
    const to = (emailModal.to || "").trim();
    const subject = encodeURIComponent(emailModal.subject || "");
    const body = encodeURIComponent(emailModal.body || "");
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`;
  };

  const copySummary = async () => {
    const built = buildEmail();
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(built.body);
      } else {
        const ta = document.createElement("textarea");
        ta.value = built.body;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      notify("Summary copied");
    } catch { notify("Copy failed"); }
  };
  void openEmail;
  void copySummary;

  // ---------- Vehicle modal state ----------
  const vehicleFormVehicle = useMemo(() => {
    if (!vehicleModal.open) return null;
    if (vehicleModal.mode === "new") return { id: uid(), name: "", make: "", model: "", plate: "", vin: "", notes: "" };
    const v = app.vehicles.find((x) => x.id === vehicleModal.vehicleId);
    return v ? { ...v } : { id: uid(), name: "", make: "", model: "", plate: "", vin: "", notes: "" };
  }, [vehicleModal, app.vehicles]);

  const [vehicleDraft, setVehicleDraft] = useState(null);
  useEffect(() => {
    if (vehicleFormVehicle) setVehicleDraft(vehicleFormVehicle);
  }, [vehicleFormVehicle]);

  const vehicleSaveDisabled = useMemo(() => !String((vehicleDraft && vehicleDraft.name) || "").trim(), [vehicleDraft]);

  const persistenceFailed = requiresDestructiveConfirmation(persistence);
  const allowDestructiveAction = (label) => {
    if (!persistenceFailed) return true;
    return window.confirm(`${label} may exist only in memory because browser storage is not saving. It may be lost on reload. Continue?`);
  };

  const performImportTransaction = () => {
    const prepared = importWorkflow.prepared;
    if (!prepared) return;
    if (requiresEmptyReplacementConfirmation(currentDatasetCounts, prepared.counts)
      && !window.confirm("The selected backup is empty while current Trip-It data is not. Confirm replacing all current records with an empty dataset.")) return;
    const result = replaceDatasetTransactional({
      primaryKey: KEY,
      currentData: app,
      candidate: prepared.candidate,
      validate: validateApplicationPayload,
    });
    if (!result.ok) {
      setImportWorkflow((current) => ({ ...current, stage: "transaction-failed", result, retryAction: "import", currentSerialized: result.currentSerialized || JSON.stringify(app), candidateSerialized: result.candidateSerialized || JSON.stringify(prepared.candidate) }));
      return;
    }
    applyTransactionResult(result, setApp);
    if (prepared.profile && typeof prepared.profile === "object" && !Array.isArray(prepared.profile)) setProfile(prepared.profile);
    setPersistence({ status: "saved", lastSavedAt: new Date().toISOString(), revision: appRevision.current, error: null });
    setImportWorkflow((current) => ({ ...current, stage: "success", operation: "replace", result, rollbackKey: result.snapshotKey, currentSerialized: result.currentSerialized, candidateSerialized: result.candidateSerialized }));
  };

  const updateMergeResolution = (key, resolution) => {
    setImportWorkflow((current) => {
      const resolutions = { ...(current.mergePlan?.resolutions || {}), [key]: resolution };
      return { ...current, mergePlan: createMergePlan(app, current.prepared.candidate, { importedAt: current.mergeTimestamp, resolutions }) };
    });
  };

  const resolveAllMergeConflicts = (resolution) => {
    setImportWorkflow((current) => {
      const resolutions = { ...(current.mergePlan?.resolutions || {}) };
      for (const conflict of current.mergePlan?.conflicts || []) {
        if (conflict.options.includes(resolution)) resolutions[conflict.key] = resolution;
      }
      return { ...current, mergePlan: createMergePlan(app, current.prepared.candidate, { importedAt: current.mergeTimestamp, resolutions }) };
    });
  };

  const performMergeTransaction = () => {
    const plan = importWorkflow.mergePlan;
    if (!plan?.ready) return;
    const result = mergeDatasetTransactional({ primaryKey: KEY, currentData: app, candidate: plan.candidate, validate: validateApplicationPayload });
    if (!result.ok) {
      setImportWorkflow((current) => ({ ...current, stage: "transaction-failed", operation: "merge", retryAction: "merge", result, currentSerialized: result.currentSerialized || JSON.stringify(app), candidateSerialized: JSON.stringify(current.prepared.candidate), mergeSerialized: result.candidateSerialized || JSON.stringify(plan.candidate) }));
      return;
    }
    applyTransactionResult(result, setApp);
    setPersistence({ status: "saved", lastSavedAt: new Date().toISOString(), revision: appRevision.current, error: null });
    setImportWorkflow((current) => ({ ...current, stage: "success", operation: "merge", result, rollbackKey: result.snapshotKey, currentSerialized: result.currentSerialized, candidateSerialized: JSON.stringify(current.prepared.candidate), mergeSerialized: result.candidateSerialized }));
  };

  const restorePreImportData = () => {
    if (!importWorkflow.rollbackKey) return;
    const rollback = importWorkflow.operation === "merge" ? rollbackMergeTransactional : rollbackTransactional;
    const result = rollback({ primaryKey: KEY, rollbackKey: importWorkflow.rollbackKey, currentData: app, validate: validateApplicationPayload });
    if (!result.ok) {
      setImportWorkflow((current) => ({ ...current, stage: "transaction-failed", result, retryAction: "rollback", currentSerialized: result.currentSerialized || JSON.stringify(app), candidateSerialized: result.candidateSerialized }));
      return;
    }
    applyTransactionResult(result, setApp);
    setPersistence({ status: "saved", lastSavedAt: new Date().toISOString(), revision: appRevision.current, error: null });
    setImportWorkflow((current) => ({ ...current, stage: "success", result, rollbackKey: result.snapshotKey, currentSerialized: result.currentSerialized, candidateSerialized: result.candidateSerialized }));
  };

  const retryStorageGate = () => {
    const next = loadInitialState();
    setApp(next.app);
    setStorageGate(next.gate);
    setPersistence((current) => ({
      ...current,
      status: next.gate?.kind === "storage-unavailable" ? "unavailable" : "saved",
      error: next.gate?.result?.error || null,
    }));
  };

  const startNewAfterRecovery = () => {
    if (storageGate?.kind !== "recovery") return;
    const next = emptyApp();
    const resolution = replaceCorruptWithEmpty({
      primaryKey: KEY,
      raw: storageGate.raw,
      emptyData: next,
      confirm: () => window.confirm("Start with a new empty dataset? The unreadable primary value will be replaced. The preserved recovery copy will remain available."),
    });
    if (resolution.status === "cancelled") return;
    if (!resolution.ok && resolution.phase === "preserve_recovery") {
      showToast("Could not verify a recovery copy. Download the raw data before retrying.");
      return;
    }
    if (!resolution.ok) {
      setPersistence({ status: resolution.status === "unavailable" ? "unavailable" : "failed", lastSavedAt: null, revision: 0, error: resolution.error });
      return;
    }
    setApp(next);
    setStorageGate(null);
    setPersistence({ status: "saved", lastSavedAt: new Date().toISOString(), revision: 0, error: null });
  };

  const continueFromLegacy = () => {
    if (storageGate?.kind !== "migration") return;
    try {
      const parsed = JSON.parse(storageGate.legacyRaw);
      setApp(normalizeApp(migrateLegacyIfNeeded(parsed) || emptyApp()));
      setStorageGate(null);
      setPersistence({ status: "failed", lastSavedAt: null, revision: 0, error: new Error("Legacy source is loaded in memory; the original legacy key remains unchanged") });
    } catch {
      showToast("Legacy data is unreadable and cannot be continued safely.");
    }
  };

  // ---------- Trip Details Expand ----------
  const [expandedTripId, setExpandedTripId] = useState(null);
  const toggleTrip = (id) => setExpandedTripId(prev => prev === id ? null : id);

  const getCurrentLocation = (field) => {
    if (!navigator.geolocation) return notify("Geolocation not supported");
    notify("Locating...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const coords = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        setLegForm((prev) => ({ ...prev, [field]: coords }));

        try {
          const lang = profile.language ? profile.language.toLowerCase() : "en";
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=${lang}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.address) {
              const { road, house_number, city, town, village } = data.address;
              const place = [road, house_number, city || town || village].filter(Boolean).join(", ");
              if (place) setLegForm((prev) => ({ ...prev, [field]: place }));
            }
          }
        } catch {
          // ignore
        }
      },
      () => notify("Location failed"),
      { enableHighAccuracy: true }
    );
  };

  if (storageGate) {
    return (
      <BlockingStorageScreen
        gate={storageGate}
        onRetry={retryStorageGate}
        onStartNew={startNewAfterRecovery}
        onContinueLegacy={continueFromLegacy}
      />
    );
  }

  return (
    <div className="tripit-app">
      {persistenceFailed && (
        <div className="sticky top-0 z-[60] p-3 print:hidden">
          <div className="mx-auto max-w-6xl">
            <AlertBanner variant="danger" title="Changes are not safely stored" actions={<><Button onClick={() => persistApp(app)}>Retry Save</Button><Button variant="primary" onClick={exportJSON}>Export Backup</Button></>}>
              Recent changes may be lost on reload. No save confirmation will be shown until a write and read-back verification succeeds.
              {persistence.lastSavedAt && <div className="text-xs mt-1">Last verified save: {new Date(persistence.lastSavedAt).toLocaleString()}</div>}
            </AlertBanner>
          </div>
        </div>
      )}
      {/* Print rules */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>

      {/* Print ONLY preview sheet when preview is open */}
      {previewOpen ? (
        <style>{`
          @media print {
            /* 1. Hide everything on the page by default */
            body * {
              visibility: hidden !important;
            }
            /* 2. Make the printable area and its children visible */
            #tripit-print,
            #tripit-print * {
              visibility: visible !important;
            }
            /* 3. Position the printable area to fill the page */
            #tripit-print {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
            }
            /* 4. Make the modal containers "disappear" for layout purposes during print */
            .fixed.inset-0.z-50, .fixed.inset-0.z-50 > .relative, .fixed.inset-0.z-50 .overflow-auto {
                display: contents !important;
            }
          }
        `}</style>
      ) : null}

      <ConfirmModal
        open={confirm.open}
        title={confirm.payload?.title || (confirm.kind === "vehicle" ? t("deleteVehicleQ") : t("cancelTripQ"))}
        message={confirm.payload?.message || (confirm.kind === "vehicle" ? t("deleteVehicleMsg") : t("cancelTripMsg"))}
        confirmText={["active-leg", "history-leg", "trip", "vehicle", "fuel", "wash"].includes(confirm.kind) ? t("delete") : t("cancelTrip")}
        onCancel={() => setConfirm({ open: false, kind: null, id: null, payload: null })}
        onConfirm={() => { if (confirm.kind === "vehicle") deleteVehicleNow(); else if (confirm.kind === "active-leg") deleteLeg(confirm.id); else if (confirm.kind === "history-leg") deleteHistoricalLeg(confirm.payload.tripId, confirm.id); else if (confirm.kind === "trip") deleteTrip(confirm.id); else if (confirm.kind === "fuel") deleteFuel(confirm.id); else if (confirm.kind === "wash") deleteWash(confirm.id); else cancelTrip(); }}
      />

      <ImportWorkflowModal
        state={importWorkflow}
        currentCounts={currentDatasetCounts}
        onClose={() => setImportWorkflow({ open: false, stage: "idle", prepared: null, result: null, file: null })}
        onReplace={performImportTransaction}
        onMerge={performMergeTransaction}
        onResolution={updateMergeResolution}
        onResolveConflicts={resolveAllMergeConflicts}
        onRetry={importWorkflow.retryAction === "rollback" ? restorePreImportData : importWorkflow.retryAction === "merge" ? performMergeTransaction : performImportTransaction}
        onRollback={restorePreImportData}
        onDownloadCurrent={() => downloadRawRecovery(importWorkflow.currentSerialized || JSON.stringify(app, null, 2), `trip-it-current-backup-${todayISO()}.json`)}
        onDownloadCandidate={() => downloadRawRecovery(importWorkflow.candidateSerialized || JSON.stringify(importWorkflow.prepared?.candidate || {}, null, 2), `trip-it-import-candidate-${todayISO()}.json`)}
        onDownloadMerge={() => downloadRawRecovery(importWorkflow.mergeSerialized || JSON.stringify(importWorkflow.mergePlan?.candidate || {}, null, 2), `trip-it-planned-merge-${todayISO()}.json`)}
      />

      <EmailModal
        open={emailModal.open}
        to={emailModal.to}
        subject={t("subject") + ": " + emailModal.subject}
        body={emailModal.body}
        onClose={() => setEmailModal((m) => ({ ...m, open: false }))}
        onChangeTo={(v) => setEmailModal((m) => ({ ...m, to: v }))}
        onChangeBody={(v) => setEmailModal((m) => ({ ...m, body: v }))}
        onCopy={copyEmail}
        onOpenEmail={openEmailClientFromModal}
      />

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} appName="Trip-It" />

      <LegModal 
        key={savedLegModal.leg?.id || "closed-leg-modal"}
        open={savedLegModal.open} 
        leg={savedLegModal.leg} 
        onClose={() => setSavedLegModal({ open: false, tripId: null, leg: null })} 
        onSave={saveSavedLeg} 
        t={t}
        suggestions={allLocations}
        driverSuggestions={peopleSuggestions.drivers}
        passengerSuggestions={peopleSuggestions.passengers}
      />

      <TemplateModal 
        open={templateModal.open}
        type={templateModal.type}
        templates={app.templates || []}
        onClose={() => setTemplateModal({ ...templateModal, open: false })}
        onLoad={loadTemplate}
        onDelete={deleteTemplate}
        onSaveCurrent={saveTemplate}
        t={t}
      />

      {/* Export Menu Modal */}
      {exportModalOpen && (
        <div className="ts-modal-backdrop">
          <div className="absolute inset-0 bg-slate-700/25" onClick={() => setExportModalOpen(false)} />
          <div className="ts-modal max-w-lg">
            
            {/* Header */}
            <div className="ts-modal__header">
              <div>
                 <div className="text-xs font-bold uppercase tracking-widest text-neutral-500">ToolStack • Data</div>
                 <h2 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-800">
                  {t("exportPack")}
                 </h2>
                 <p className="text-sm text-neutral-500 mt-1">{t("exportPackDesc")}</p>
              </div>
              <IconButton label="Close" onClick={() => setExportModalOpen(false)}>×</IconButton>
            </div>
            
            <div className="ts-modal__body space-y-5"><ReportFilters config={previewConfig} onMode={updatePreviewMode} onChange={setPreviewConfig} vehicle={activeVehicle} resultCount={previewData.trips.length} /><ReportSummary trips={previewData.trips} fuel={previewData.fuel} wash={previewData.wash} /><ExportActions disabled={!reportRangeValidation.valid} onBackup={exportJSON} onImport={onImportPick} onReportJson={exportPreviewJSON} onCsv={exportPreviewCSV} onPrint={() => { setExportModalOpen(false); setPreviewOpen(true); setTimeout(() => window.print(), 500); }} onCopy={copySummary} onEmail={openEmail} /><details className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600"><summary className="cursor-pointer font-medium">Advanced backup details</summary><div className="mt-2 break-all font-mono">{persistence.lastSavedAt ? `Last verified save: ${persistence.lastSavedAt}` : "No verified save timestamp"}</div><div className="mt-1">{t("importJsonWarning")}</div></details></div>
          </div>
        </div>
      )}

      {/* Hidden file input for Import button */}
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = (e.target.files && e.target.files[0]) || null;
          if (file) prepareImportFile(file);
          e.target.value = "";
        }}
      />

      {/* Vehicle modal */}
      {vehicleModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
          <div
            className="absolute inset-0 bg-slate-700/25"
            onClick={() => setVehicleModal({ open: false, mode: "new", vehicleId: null })}
          />
          <div className="relative w-full max-w-2xl rounded-2xl bg-white border border-neutral-200 shadow-xl overflow-hidden">
            <div className="p-4 border-b border-neutral-100 flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-neutral-800">{vehicleModal.mode === "new" ? t("addVehicle") : t("edit")}</div>
                <div className="text-sm text-neutral-700 mt-1">Trips + fuel logs are stored per vehicle.</div>
                <div className="mt-3">
                  <AccentUnderline className="w-52" />
                </div>
              </div>
              <button className={btnSecondary} onClick={() => setVehicleModal({ open: false, mode: "new", vehicleId: null })}>
                {t("close")}
              </button>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-neutral-700">{t("vehicleName")}</label>
                <input
                  className={`${inputBase} mt-2`}
                  value={(vehicleDraft && vehicleDraft.name) || ""}
                  onChange={(e) => setVehicleDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="e.g., BMW 530i (Consulate)"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700">{t("make")}</label>
                <input
                  className={`${inputBase} mt-2`}
                  value={(vehicleDraft && vehicleDraft.make) || ""}
                  onChange={(e) => setVehicleDraft((d) => ({ ...d, make: e.target.value }))}
                  placeholder="e.g., BMW"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700">{t("model")}</label>
                <input
                  className={`${inputBase} mt-2`}
                  value={(vehicleDraft && vehicleDraft.model) || ""}
                  onChange={(e) => setVehicleDraft((d) => ({ ...d, model: e.target.value }))}
                  placeholder="e.g., 530i"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700">{t("plate")}</label>
                <input
                  className={`${inputBase} mt-2`}
                  value={(vehicleDraft && vehicleDraft.plate) || ""}
                  onChange={(e) => setVehicleDraft((d) => ({ ...d, plate: e.target.value }))}
                  placeholder="e.g., M-AB 1234"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700">{t("vin")}</label>
                <input
                  className={`${inputBase} mt-2`}
                  value={(vehicleDraft && vehicleDraft.vin) || ""}
                  onChange={(e) => setVehicleDraft((d) => ({ ...d, vin: e.target.value }))}
                  placeholder={t("optional")}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-neutral-700">{t("notes")}</label>
                <textarea
                  className={`${inputBase} mt-2 min-h-[90px]`}
                  value={(vehicleDraft && vehicleDraft.notes) || ""}
                  onChange={(e) => setVehicleDraft((d) => ({ ...d, notes: e.target.value }))}
                  placeholder="optional"
                />
              </div>
            </div>

            <div className="p-4 border-t border-neutral-100 flex items-center justify-end gap-2">
              <button className={btnSecondary} onClick={() => setVehicleModal({ open: false, mode: "new", vehicleId: null })}>
                {t("cancel")}
              </button>
              <button
                className={`${btnPrimary} ${vehicleSaveDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={vehicleSaveDisabled}
                onClick={() => saveVehicle({ ...vehicleDraft, name: String((vehicleDraft && vehicleDraft.name) || "").trim() })}
              >
                {t("saveVehicle")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Print Preview Modal */}
      {previewOpen ? (
        <div className="ts-modal-backdrop">
          <div className="absolute inset-0 bg-slate-700/25" onClick={() => setPreviewOpen(false)} />
          <div className="ts-modal max-w-5xl">
            
            {/* Header (Controls) */}
            <div className="ts-modal__header print:hidden">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 relative z-20">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-neutral-500">ToolStack • Preview</div>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-800">
                    {t("tripItReport")}
                  </h2>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  <select 
                    className="ts-control w-auto text-sm"
                    value={previewConfig.mode}
                    onChange={(e) => updatePreviewMode(e.target.value)}
                  >
                    <option value="thisWeek">This Week</option>
                    <option value="lastWeek">Last Week</option>
                    <option value="thisMonth">This Month</option>
                    <option value="lastMonth">Last Month</option>
                    <option value="custom">Custom</option>
                  </select>
                  
                  <div className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-1">
                    <input 
                      type="date" 
                      className="h-9 w-28 bg-transparent px-2 text-xs text-neutral-800 focus:outline-none sm:w-auto"
                      value={previewConfig.start}
                      onChange={(e) => setPreviewConfig(p => ({ ...p, mode: "custom", start: e.target.value }))}
                    />
                    <span className="text-neutral-500 font-black">-</span>
                    <input 
                      type="date" 
                      className="h-9 w-28 bg-transparent px-2 text-xs text-neutral-800 focus:outline-none sm:w-auto"
                      value={previewConfig.end}
                      onChange={(e) => setPreviewConfig(p => ({ ...p, mode: "custom", end: e.target.value }))}
                    />
                  </div>
                  
                  <div className="mx-1 hidden h-8 w-px bg-neutral-200 xl:block"></div>

                  <button className={btnSecondary} onClick={exportPreviewCSV}>CSV</button>
                  <button className={btnSecondary} onClick={exportPreviewJSON}>Report JSON — not restorable</button>
                  <button className={btnAccent} onClick={() => window.print()}>Print</button>
                  <button 
                    className="ts-button ts-button--ghost"
                    onClick={() => setPreviewOpen(false)}
                  >
                    X
                  </button>
                </div>
              </div>
              
            </div>

            {/* Printable Content Area */}
            <div className="overflow-auto flex-1 bg-neutral-100 p-4 sm:p-8">
              <div id="tripit-print" className="bg-white text-neutral-900 p-8 sm:p-12 shadow-[0_0_50px_rgba(0,0,0,0.5)] mx-auto max-w-4xl min-h-[800px]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <img src={tripitLogo} alt="TripIt Logo" className="h-16 w-auto mb-4" />
                    <div className="text-sm text-neutral-700">
                      Trip-It • {(activeVehicle && activeVehicle.name) || "(no vehicle)"}
                    </div>
                    <div className="text-sm text-neutral-700">
                      Range: {previewConfig.start} to {previewConfig.end}
                    </div>
                    {profile.user ? <div className="text-sm text-neutral-700">Prepared by: {profile.user}</div> : null}
                    <div className="mt-3">
                      <AccentUnderline className="w-72" />
                    </div>
                  </div>
                  <div className="text-sm text-neutral-700 text-right">
                    <div>{t("generated")}</div>
                    <div>{new Date().toLocaleString()}</div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="text-sm text-neutral-700">{t("trips")}</div>
                    <div className="text-2xl font-semibold text-neutral-800 mt-1">{previewData.totals.tripCount}</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="text-sm text-neutral-700">{t("legs")}</div>
                    <div className="text-2xl font-semibold text-neutral-800 mt-1">{previewData.totals.legCount}</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="text-sm text-neutral-700">Distance</div>
                    <div className="text-2xl font-semibold text-neutral-800 mt-1">{previewData.totals.distance.toFixed(1)} km</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="text-sm text-neutral-700">{t("fuel")}</div>
                    <div className="text-2xl font-semibold text-neutral-800 mt-1">{money(previewData.totals.spend, previewData.totals.currency)}</div>
                  </div>
                </div>

                <table className="w-full text-sm text-left mt-8 border-collapse">
                  <thead>
                    <tr>
                      <th className="border-b border-neutral-200 py-2 font-medium text-neutral-600 w-24">Date</th>
                      <th className="border-b border-neutral-200 py-2 font-medium text-neutral-600">Trip / Purpose</th>
                      <th className="border-b border-neutral-200 py-2 font-medium text-neutral-600">Route</th>
                      <th className="border-b border-neutral-200 py-2 font-medium text-neutral-600 w-20 text-right">Dist</th>
                      <th className="border-b border-neutral-200 py-2 font-medium text-neutral-600 w-32 text-right">Odo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.trips.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-neutral-500 italic">No trips found in this date range.</td>
                      </tr>
                    ) : (
                      previewData.trips.map(trip => (
                        <React.Fragment key={trip.id}>
                          {(trip.legs.length ? trip.legs : [{}]).map((l, i) => (
                            <tr key={l.id || `empty-${trip.id}`} className="border-b border-neutral-100 last:border-0">
                              <td className="py-2 align-top text-neutral-800 whitespace-nowrap">{i === 0 ? trip.startDate : ""}</td>
                              <td className="py-2 align-top text-neutral-800">
                                {i === 0 && (trip.title || trip.purpose) ? (
                                  <div>
                                    <div className="font-medium">{trip.title}</div>
                                    {trip.purpose && <div className="text-xs text-neutral-500">{trip.purpose}</div>}
                                  </div>
                                ) : null}
                              </td>
                              <td className="py-2 align-top text-neutral-800">
                                <div>{l.startPlace} → {l.endPlace}</div>
                                {(l.startTag || l.endTag) && <div className="text-xs font-medium text-lime-700 bg-lime-50 inline-block px-1.5 rounded mt-0.5">{l.startTag}{l.startTag && l.endTag ? " → " : ""}{l.endTag}</div>}
                                <div className="text-xs text-neutral-500">{l.startTime} - {l.endTime}</div>
                                {l.driver && <div className="text-xs text-neutral-500">{t("driver")}: {l.driver}</div>}
                                {!!l.passengers?.length && <div className="text-xs text-neutral-500">{t("passengers")} ({l.passengers.length}): {normalizePassengers(l.passengers).join(" · ")}</div>}
                                {l.note && <div className="text-xs text-neutral-500 italic">"{l.note}"</div>}
                              </td>
                              <td className="py-2 align-top text-neutral-800 text-right">{l.km != null ? toNumber(l.km).toFixed(1) : ""}</td>
                              <td className="py-2 align-top text-neutral-800 text-xs text-neutral-500 text-right tabular-nums">
                                {l.odoStart} - {l.odoEnd}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>

                <div className="mt-8 text-xs text-neutral-400 border-t border-neutral-100 pt-4">
                  {t("storageKey")} <span className="font-mono">{KEY}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="ts-shell">
        {/* Header */}
        <header className="mb-4 overflow-hidden rounded-2xl border border-[var(--ts-border)] bg-white shadow-[0_6px_24px_rgba(31,41,51,0.07)]">
          <div className="h-1.5 bg-[var(--ts-accent)]" aria-hidden="true" />
          <div className="flex flex-col items-start gap-3 px-3 py-3 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
            <img src={tripitLogo} alt="Trip-It" className="h-[8.1rem] w-auto max-w-full shrink-0 object-contain select-none sm:h-[10.4rem]" draggable="false" />
            <div className="flex w-full flex-col items-start gap-3 lg:w-auto lg:items-end">
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {activeVehicle && <Badge variant="accent">Active vehicle: {activeVehicle.name}</Badge>}
                <div className="ts-segmented" role="group" aria-label="Language">
                  <button onClick={() => setProfile(p => ({ ...p, language: "EN" }))} className={`${buttonClass(profile.language === "EN" ? "primary" : "ghost")} min-h-9 px-3`}>EN</button>
                  <button onClick={() => setProfile(p => ({ ...p, language: "DE" }))} className={`${buttonClass(profile.language === "DE" ? "primary" : "ghost")} min-h-9 px-3`}>DE</button>
                </div>
              </div>
              <nav className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-start lg:justify-end" aria-label="Application actions">
                <ActionButton onClick={openHub} title={t("returnHub")}>
                  {t("hub")}
                </ActionButton>
                <ActionButton onClick={openPreview} disabled={!activeVehicle}>
                  {t("preview")}
                </ActionButton>
                <ActionButton onClick={openExportModal} disabled={!activeVehicle}>{t("export")}</ActionButton>
                <IconButton label="Help" onClick={() => setHelpOpen(true)}><span className="text-lg font-semibold">?</span></IconButton>
              </nav>
            </div>
          </div>
          {activeVehicle && <div className="flex flex-wrap gap-2 border-t border-[var(--ts-border)] bg-[var(--ts-surface-muted)] px-4 py-3 sm:px-6"><Pill>{tripTotals.tripCount} {t("trips")}</Pill><Pill>{tripTotals.distance.toFixed(1)} km</Pill><Pill tone="accent">{money(fuelTotals.spend, fuelTotals.currency)}</Pill><Pill>{fuelTotals.liters.toFixed(2)} L</Pill></div>}
        </header>

        {/* CONTENT */}
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Left: Vehicle + Month */}
          <div className="space-y-3">
            <div className={card}>
              <div className={`${cardHead} flex items-center justify-between`}>
                <div className="font-semibold text-neutral-800">{t("vehicle")}</div>
                <button className={btnAccent} onClick={openNewVehicle}>
                  {t("addVehicle")}
                </button>
              </div>

              <div className={`${cardPad} space-y-3`}>
                <div>
                  <label className="text-sm font-medium text-neutral-700">{t("activeVehicle")}</label>
                  {app.vehicles.length ? (
                    <select className={`${inputBase} mt-2`} value={app.activeVehicleId || ""} onChange={(e) => selectVehicle(e.target.value)}>
                      {app.vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <EmptyState title="No vehicles yet" description="Add a vehicle to begin recording duty trips." />
                  )}
                </div>

                {activeVehicle ? (
                  <>
                    <div className="rounded-2xl border border-neutral-200 p-4">
                      <div className="font-semibold text-neutral-800">{activeVehicle.name}</div>
                      <div className="text-sm text-neutral-700 mt-1">{(activeVehicle.make || "-") + " " + (activeVehicle.model || "")}</div>
                      <div className="text-sm text-neutral-700">Plate: {activeVehicle.plate || "-"}</div>
                      <div className="mt-3 flex items-center gap-2">
                        <button className={btnSecondary} onClick={() => setVehicleModal({ open: true, mode: "edit", vehicleId: activeVehicle.id })}>
                          {t("edit")}
                        </button>
                        <button
                          className={btnDanger}
                          onClick={() => setConfirm({ open: true, kind: "vehicle", id: activeVehicle.id })}
                        >
                          {t("delete")}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-neutral-700">{t("month")}</label>
                      <MonthPicker value={app.ui.month} onChange={setMonth} disabled={!activeVehicle} lang={profile.language} t={t} />
                    </div>

                    <div className="text-xs text-neutral-600">
                      Stored at <span className="font-mono">{KEY}</span> • Profile at <span className="font-mono">{PROFILE_KEY}</span>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {/* Right: Trips + Fuel */}
          <div className="lg:col-span-2 space-y-3">
            
            {/* 1. Active Trip Card */}
            <div className={`${card} ${activeTrip ? "ts-card--selected" : ""}`}>
              <div className={`${cardHead} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                <div className="flex flex-wrap items-center gap-2"><div className="font-semibold text-neutral-800">{activeTrip ? t("activeTrip") : t("startTrip")}</div>{activeTrip && <Badge variant="success">Active</Badge>}</div>
                
                <div className="flex flex-wrap items-center gap-3 justify-end">
                  {activeTrip ? (
                    <button className="text-xs font-black uppercase tracking-wider text-red-600 hover:text-red-800 px-2 py-1 border-2 border-red-100 bg-red-50 rounded-sm transition" onClick={() => setConfirm({ open: true, kind: "cancel", id: null })}>
                      {t("cancelTrip")}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className={cardPad}>
                {!activeVehicle ? (
                  <EmptyState title="No active vehicle" description={t("addVehicleToStart")} action={<Button variant="primary" onClick={openNewVehicle}>{t("addVehicle")}</Button>} />
                ) : activeTrip ? (
                  // Active Trip View
                  <div className="space-y-4">
                    <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4 text-sm text-neutral-700">
                      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold text-base text-neutral-800">{activeTrip.title || "Untitled Trip"}</div><div className="mt-1">{activeVehicle.name} · {activeTrip.startDate}</div><div className="mt-1">{t("started")} {new Date(activeTrip.startedAt).toLocaleString()}</div></div><div className="flex flex-wrap gap-2"><Badge>{activeTrip.legs.length} {t("legs")}</Badge><Badge variant="accent">{activeTrip.legs.reduce((sum, leg) => sum + toNumber(leg.km), 0).toFixed(1)} km</Badge><Badge variant={persistence.status === "saved" ? "success" : persistence.status === "saving" ? "warning" : "danger"}>{persistence.status}</Badge></div></div>
                      {activeTrip.purpose ? <div className="text-xs text-neutral-500 mt-1">{t("purpose")} {activeTrip.purpose}</div> : null}
                    </div>

                    {/* List of Legs in Active Trip */}
                    <LegTimeline legs={activeTrip.legs} context="active" editingLegId={editingActiveLegId} onEdit={editActiveLeg} onDelete={(leg) => setConfirm({ open: true, kind: "active-leg", id: leg.id, payload: { title: "Delete leg?", message: deleteLegConfirmation(leg) } })} emptyMessage="No legs recorded yet. Enter the first route above." />

                    <div className="border-t border-neutral-100 pt-4">
                      <LegComposer key={`${editingActiveLegId || "new"}-${activeTrip.legs.length}`} form={legForm} setField={(field, value) => field === "startTime" || field === "endTime" ? changeLegTime(field, value) : setLegForm((current) => ({ ...current, [field]: value }))} setPassengers={(passengers) => setLegForm((current) => ({ ...current, passengers }))} locationSuggestions={locationSuggestions} driverSuggestions={peopleSuggestions.drivers} passengerSuggestions={peopleSuggestions.passengers} tagSuggestions={legTags} previousLeg={activeTrip.legs.at(-1)} editingIndex={editingActiveLegId ? activeTrip.legs.findIndex((leg) => leg.id === editingActiveLegId) : null} timeErrors={showLegTimeErrors ? legTimeValidation.errors : {}} onSave={saveActiveLeg} onCancelEdit={cancelEditActiveLeg} onDuplicate={duplicateLastLeg} onReverse={swapLegPlaces} onCurrentLocation={getCurrentLocation} onTemplate={() => setTemplateModal({ open: true, type: "leg" })} onKeyDown={handleLegKeyDown} onFocus={handleFocus} t={t} />
                    </div>

                    <datalist id="locations-list">
                      {allLocations.map((s, i) => <option key={i} value={s} />)}
                    </datalist>

                    <div className="pt-4 border-t border-neutral-100 flex justify-end">
                      <button className={btnAccent} onClick={endTrip}>
                        {t("endTrip")}
                      </button>
                    </div>
                  </div>
                ) : (
                  // Start Trip Form
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-neutral-700">{t("tripTitle")}</label>
                      <input
                        className={`${inputBase} mt-1`}
                        value={tripStartForm.title}
                        onChange={(e) => setTripStartForm({ ...tripStartForm, title: e.target.value })}
                        placeholder="e.g. Client Visit"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-neutral-700">{t("purposeOpt")}</label>
                      <input
                        className={`${inputBase} mt-1`}
                        value={tripStartForm.purpose}
                        onChange={(e) => setTripStartForm({ ...tripStartForm, purpose: e.target.value })}
                        placeholder="e.g. Business"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-neutral-700">{t("date")}</label>
                      <input
                        type="date"
                        className={`${inputBase} mt-1`}
                        value={tripStartForm.startDate}
                        onChange={(e) => setTripStartForm({ ...tripStartForm, startDate: e.target.value })}
                      />
                    </div>
                    <div className="pt-2 flex justify-end">
                      <button className={btnAccent} onClick={startTrip}>
                        {t("startTrip")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Recent Trips List */}
            <div className={card}>
              <div 
                className={`${cardHead} flex items-center justify-between cursor-pointer select-none ${recentTripsOpen ? "border-l-2 border-l-[var(--ts-accent)] bg-[var(--ts-surface-soft)]" : "ts-hover-accent"}`}
                onClick={() => setRecentTripsOpen(!recentTripsOpen)}
              >
                <div className="font-semibold text-neutral-800 flex items-center gap-2">
                  <span>{t("recentTrips")}</span>
                  {!recentTripsOpen && tripsForMonth.length > 0 && (
                    <span className="text-xs font-normal text-neutral-500">
                      {tripsForMonth.length} {t("trips")}
                    </span>
                  )}
                </div>
                <div className="text-neutral-400 text-sm transform transition-transform duration-200" style={{ transform: recentTripsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  ▼
                </div>
              </div>
              {recentTripsOpen && (
              <div className={cardPad}>
                {!activeVehicle ? (
                  <EmptyState title="Select a vehicle" description={t("selectVehicleView")} />
                ) : tripsForMonth.length === 0 ? (
                  <EmptyState title="No trips this month" description={`${t("noTrips")} ${monthLabel(app.ui.month, profile.language)}.`} />
                ) : (
                  <div className="space-y-3">
                    {tripsForMonth.map((trip) => <CompletedTripCard key={trip.id} trip={trip} vehicleName={activeVehicle.name} expanded={expandedTripId === trip.id} onToggle={() => toggleTrip(trip.id)} onEditLeg={(leg) => setSavedLegModal({ open: true, tripId: trip.id, leg })} onDeleteLeg={(leg) => setConfirm({ open: true, kind: "history-leg", id: leg.id, payload: { tripId: trip.id, title: "Delete leg?", message: deleteLegConfirmation(leg) } })} onAddLeg={() => openAddLegToTrip(trip)} onDeleteTrip={() => setConfirm({ open: true, kind: "trip", id: trip.id, payload: { title: "Delete trip?", message: deleteTripConfirmation(trip) } })} addingForm={addingLegToTripId === trip.id ? <div className="rounded-xl border border-neutral-200 bg-white p-3"><div className="mb-2 text-sm font-semibold text-neutral-700">Add New Leg</div><div className="space-y-2"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><div><label className="text-xs font-medium text-neutral-500">{t("from")}</label><input className={inputCompact} value={legForm.startPlace} onChange={(e) => setLegForm({ ...legForm, startPlace: e.target.value })} /></div><div><label className="text-xs font-medium text-neutral-500">{t("to")}</label><input className={inputCompact} value={legForm.endPlace} onChange={(e) => setLegForm({ ...legForm, endPlace: e.target.value })} /></div></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><TimeInput compact id={`historical-${trip.id}-start-time`} label={t("startTime")} value={legForm.startTime} onChange={(value) => changeLegTime("startTime", value)} error={showLegTimeErrors ? legTimeValidation.errors.startTime : ""} /><TimeInput compact id={`historical-${trip.id}-end-time`} label={t("endTime")} value={legForm.endTime} onChange={(value) => changeLegTime("endTime", value)} error={showLegTimeErrors ? legTimeValidation.errors.endTime : ""} /></div><div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-medium text-neutral-500">{t("odoS")}</label><input className={`${inputCompact} text-right`} value={legForm.odoStart} onChange={(e) => setLegForm({ ...legForm, odoStart: e.target.value })} /></div><div><label className="text-xs font-medium text-neutral-500">{t("odoE")}</label><input className={`${inputCompact} text-right`} value={legForm.odoEnd} onChange={(e) => setLegForm({ ...legForm, odoEnd: e.target.value })} /></div></div><LegPeopleInput idPrefix={`historical-${trip.id}`} driver={legForm.driver} passengers={legForm.passengers} onDriverChange={(driver) => setLegForm((current) => ({ ...current, driver }))} onPassengersChange={(passengers) => setLegForm((current) => ({ ...current, passengers }))} driverSuggestions={peopleSuggestions.drivers} passengerSuggestions={peopleSuggestions.passengers} previousLeg={trip.legs.at(-1)} t={t} /><div><label className="text-xs font-medium text-neutral-500">{t("note")}</label><input className={inputCompact} value={legForm.note} onChange={(e) => setLegForm({ ...legForm, note: e.target.value })} /></div><div className="flex justify-end gap-2"><button className={btnSecondary} onClick={() => setAddingLegToTripId(null)}>{t("cancel")}</button><button className={btnAccent} onClick={() => addLegToSavedTrip(trip.id)}>{t("add")}</button></div></div></div> : null} />)}
                  </div>
                )}
              </div>
              )}
            </div>

            {/* 3. Fuel (Updated Workflow) */}
            <div className={card}>
              <div 
                className={`${cardHead} flex items-center justify-between cursor-pointer select-none ${fuelSectionOpen ? "border-l-2 border-l-[var(--ts-accent)] bg-[var(--ts-surface-soft)]" : "ts-hover-accent"}`}
                onClick={() => setFuelSectionOpen(!fuelSectionOpen)}
              >
                <div className="font-semibold text-neutral-800 flex items-center gap-2">
                  <span>{t("fuel")}</span>
                  {!fuelSectionOpen && fuelLogs.length > 0 && (
                    <span className="text-xs font-normal text-neutral-500">
                      {t("last")} {fuelLogs[0].date} • {fuelLogs[0].liters}L
                    </span>
                  )}
                </div>
                <div className="text-neutral-400 text-sm transform transition-transform duration-200" style={{ transform: fuelSectionOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  ▼
                </div>
              </div>

              {fuelSectionOpen && (
              <div className={cardPad}>
                {!activeVehicle ? (
                  <EmptyState title="Select a vehicle" description={t("selectVehicleFuel")} />
                ) : (
                  <>
                    {/* Fuel Form */}
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 mb-4 p-3">
                      <div className="font-semibold text-neutral-800 mb-2 text-xs">
                        {editingFuelId ? t("editFuel") : t("addFuel")}
                      </div>
                      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
                        <div>
                          <label className="text-xs font-medium text-neutral-600">{t("date")}</label>
                          <input type="date" className={inputCompact} value={fuelForm.date} onChange={(e) => setFuelForm({ ...fuelForm, date: e.target.value })} />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-neutral-600">{t("odometer")}</label>
                          <input
                            className={`${inputCompact} text-right tabular-nums`}
                            inputMode="decimal"
                            value={fuelForm.odometer}
                            onChange={(e) => setFuelForm({ ...fuelForm, odometer: e.target.value })}
                            placeholder="km"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-neutral-600">{t("station")}</label>
                          <input className={inputCompact} value={fuelForm.station} onChange={(e) => setFuelForm({ ...fuelForm, station: e.target.value })} placeholder={t("optional")} />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-neutral-600">{t("liters")} (L)</label>
                          <input
                            className={`${inputCompact} text-right tabular-nums`}
                            inputMode="decimal"
                            value={fuelForm.liters}
                            onChange={(e) => setFuelForm({ ...fuelForm, liters: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-neutral-600">{t("totalCost")}</label>
                          <input
                            className={`${inputCompact} text-right tabular-nums`}
                            inputMode="decimal"
                            value={fuelForm.totalCost}
                            onChange={(e) => setFuelForm({ ...fuelForm, totalCost: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-neutral-600">{t("currency")}</label>
                          <select className={inputCompact} value={fuelForm.currency} onChange={(e) => setFuelForm({ ...fuelForm, currency: e.target.value })}>
                            <option value="EUR">EUR</option>
                            <option value="USD">USD</option>
                            <option value="GBP">GBP</option>
                          </select>
                        </div>

                        <div className="flex items-center h-7 mt-4">
                          <label className="inline-flex items-center gap-2 text-xs text-neutral-700 select-none">
                            <input type="checkbox" className="h-4 w-4" checked={fuelForm.fullTank} onChange={(e) => setFuelForm({ ...fuelForm, fullTank: e.target.checked })} />
                            {t("fullTank")}
                          </label>
                        </div>

                        <div className="col-span-2 sm:col-span-3">
                          <label className="text-xs font-medium text-neutral-600">{t("notes")}</label>
                          <input className={inputCompact} value={fuelForm.notes} onChange={(e) => setFuelForm({ ...fuelForm, notes: e.target.value })} placeholder={t("optional")} />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-end gap-2">
                        {editingFuelId && (
                          <button className={btnSecondary} onClick={cancelEditFuel}>
                            {t("cancel")}
                          </button>
                        )}
                        <button className={btnAccent} onClick={saveFuel}>
                          {editingFuelId ? t("update") : `${t("add")} ${t("fuel")}`}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible History Table */}
                    <div className="border-t border-neutral-100 pt-2">
                      <button 
                        className="flex items-center gap-2 font-medium text-neutral-600 hover:text-neutral-800 transition w-full text-xs py-1"
                        onClick={() => setFuelHistoryOpen(!fuelHistoryOpen)}
                      >
                        <span className={`transform transition-transform ${fuelHistoryOpen ? "rotate-90" : ""}`}>▶</span>
                        {t("fuelHistory")} ({fuelLogs.length})
                      </button>
                      
                      {fuelHistoryOpen && (
                        <div className="mt-2 space-y-2">{fuelLogs.length === 0 ? <EmptyState title="No fuel entries" description="Add the first fuel record using the form above." /> : fuelLogs.map((entry) => <FuelEntryCard key={entry.id} entry={entry} onEdit={editFuel} onDelete={(fuel) => setConfirm({ open: true, kind: "fuel", id: fuel.id, payload: { title: "Delete fuel entry?", message: fuelDeleteConfirmation(fuel) } })} />)}</div>
                      )}
                      {fuelHistoryOpen && (
                        <div className="hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="text-neutral-500 bg-neutral-50 uppercase font-semibold text-[10px]">
                              <tr>
                                <th className="px-3 whitespace-nowrap py-1">{t("date")}</th>
                                <th className="px-3 text-right py-1">{t("odometer")}</th>
                                <th className="px-3 text-right py-1">{t("liters")}</th>
                                <th className="px-3 text-right py-1">{t("cost")}</th>
                                <th className="px-3 py-1">{t("station")}</th>
                                <th className="px-3 text-right py-1"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 bg-white">
                              {fuelLogs.length === 0 ? (
                                <tr>
                                  <td colSpan="6" className="px-3 py-4 text-center text-neutral-500 italic">No fuel logs yet.</td>
                                </tr>
                              ) : (
                                fuelLogs.map(f => (
                                  <tr key={f.id} className="ts-hover-accent">
                                    <td className="px-3 whitespace-nowrap text-neutral-800 py-1">{f.date}</td>
                                    <td className="px-3 text-right tabular-nums text-neutral-600 py-1">{f.odometer}</td>
                                    <td className="px-3 text-right tabular-nums text-neutral-600 py-1">{toNumber(f.liters).toFixed(2)}</td>
                                    <td className="px-3 text-right tabular-nums font-medium text-neutral-800 py-1">{money(f.totalCost, f.currency)}</td>
                                    <td className="px-3 text-neutral-600 truncate max-w-[120px] py-1">{f.station || "-"}</td>
                                    <td className="px-3 text-right whitespace-nowrap py-1">
                                      <button className="text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-800 mr-3" onClick={() => editFuel(f)}>{t("edit")}</button>
                                      <button className="text-[10px] font-black uppercase tracking-wider text-red-500 hover:text-red-700" onClick={() => confirmDeleteFuel(f.id)}>{t("del")}</button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Month Totals Summary */}
                    <div className="mt-4 rounded-2xl border border-neutral-200 p-4 bg-white">
                      <div className="text-sm text-neutral-700">{t("monthSummary")} ({monthLabel(app.ui.month, profile.language)})</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Pill>{modernFuelStats.count} entries</Pill><Pill>{modernFuelStats.liters.toFixed(2)} L</Pill>{Object.entries(modernFuelStats.currencyTotals).map(([currency, total]) => <Pill key={currency} tone="accent">{money(total, currency)}</Pill>)}<Pill>{modernFuelStats.latestOdometer ?? "—"} km latest</Pill><Pill>{modernFuelStats.averageCostPerLiter != null ? `${modernFuelStats.averageCostPerLiter.toFixed(3)} /L` : "Mixed currencies"}</Pill><Pill>{modernFuelStats.fullTankCount} full tanks</Pill>
                      </div>
                    </div>
                  </>
                )}
              </div>
              )}
            </div>

            {/* 4. Wash (Compact) */}
            <div className={card}>
              <div 
                className={`${cardHead} flex items-center justify-between cursor-pointer select-none ${washSectionOpen ? "border-l-2 border-l-[var(--ts-accent)] bg-[var(--ts-surface-soft)]" : "ts-hover-accent"}`}
                onClick={() => setWashSectionOpen(!washSectionOpen)}
              >
                <div className="font-semibold text-neutral-800 flex items-center gap-2">
                  <span>{t("wash")}</span>
                  {!washSectionOpen && washLogs.length > 0 && (
                    <span className="text-xs font-normal text-neutral-500">
                      {t("last")} {washLogs[0].date} • {washLogs[0].type}
                    </span>
                  )}
                </div>
                <div className="text-neutral-400 text-sm transform transition-transform duration-200" style={{ transform: washSectionOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  ▼
                </div>
              </div>

              {washSectionOpen && (
                <div className={cardPad}>
                  {!activeVehicle ? (
                    <EmptyState title="Select a vehicle" description={t("selectVehicleWash")} />
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                        <div>
                          <label className="text-xs font-medium text-neutral-600">{t("date")}</label>
                          <input type="date" className={`${inputBase} py-1 text-xs h-8`} value={washForm.date} onChange={e => setWashForm({...washForm, date: e.target.value})} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-neutral-600">{t("type")}</label>
                          <select className={`${inputBase} py-1 text-xs h-8`} value={washForm.type} onChange={e => setWashForm({...washForm, type: e.target.value})}>
                            <option>Quick</option>
                            <option>Full</option>
                            <option>Interior</option>
                            <option>Exterior</option>
                            <option>Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-neutral-600">{t("location")}</label>
                          <input className={`${inputBase} py-1 text-xs h-8`} placeholder={t("optional")} value={washForm.location} onChange={e => setWashForm({...washForm, location: e.target.value})} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-neutral-600">{t("note")}</label>
                          <input className={`${inputBase} py-1 text-xs h-8`} placeholder={t("optional")} value={washForm.note} onChange={e => setWashForm({...washForm, note: e.target.value})} />
                        </div>
                        <div className="flex items-end gap-1">
                          <div className="w-14">
                            <label className="text-xs font-medium text-neutral-600">{t("cost")} (EUR)</label>
                            <input className={`${inputBase} py-1 text-xs h-8 text-right`} placeholder="0.00" inputMode="decimal" value={washForm.cost} onChange={e => setWashForm({...washForm, cost: e.target.value})} />
                          </div>
                          <button className={btnAccent} onClick={saveWash}>{editingWashId ? t("update") : `${t("add")} ${t("wash")}`}</button>
                          {editingWashId && <button className={btnSecondary} onClick={cancelEditWash}>{t("cancel")}</button>}
                        </div>
                      </div>

                      {washLogs.length > 0 && (
                        <div className="space-y-2 border-t border-neutral-100 pt-3">{washLogs.map((entry) => <WashEntryCard key={entry.id} entry={entry} onEdit={editWash} onDelete={(wash) => setConfirm({ open: true, kind: "wash", id: wash.id, payload: { title: "Delete wash record?", message: washDeleteConfirmation(wash) } })} />)}</div>
                      )}
                      {washLogs.length > 0 && (
                        <div className="hidden">
                          <table className="w-full text-xs text-left">
                            <thead className="text-neutral-400 font-medium">
                              <tr>
                                <th className="py-1 pr-2">{t("date")}</th>
                                <th className="py-1 pr-2">{t("type")}</th>
                                <th className="py-1 pr-2">{t("location")}</th>
                                <th className="py-1 pr-2 text-right">{t("cost")}</th>
                                <th className="py-1 text-right"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                              {washLogs.map(w => (
                                <tr key={w.id} className="ts-hover-accent">
                                  <td className="py-1 pr-2 whitespace-nowrap text-neutral-700">{w.date}</td>
                                  <td className="py-1 pr-2 text-neutral-600">{w.type}</td>
                                  <td className="py-1 pr-2 text-neutral-500 truncate max-w-[100px]">{w.location}</td>
                                  <td className="py-1 pr-2 text-right text-neutral-700">{w.cost ? Number(w.cost).toFixed(2) : "-"}</td>
                                  <td className="py-1 text-right whitespace-nowrap">
                                    <button className="text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-800 mr-2" onClick={() => editWash(w)}>{t("edit")}</button>
                                    <button className="text-[10px] font-black uppercase tracking-wider text-red-500 hover:text-red-700" onClick={() => deleteWash(w.id)}>{t("del")}</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2"><Pill>{modernWashStats.count} washes</Pill>{Object.entries(modernWashStats.currencyTotals).map(([currency, total]) => <Pill key={currency} tone="accent">{money(total, currency)}</Pill>)}<Pill>{modernWashStats.mostRecent || "—"} latest</Pill><Pill>{modernWashStats.mostUsedType || "—"} most used</Pill></div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {toast ? (
          <div className="fixed bottom-6 right-6 rounded-2xl bg-neutral-800 text-white px-4 py-3 shadow-xl print:hidden">
            <div className="text-sm">{toast}</div>
          </div>
        ) : null}

        {/* Footer link */}
        {String(HUB_URL || "").trim() && !String(HUB_URL).includes("YOUR-WIX-HUB-URL-HERE") ? (
          <div className="mt-6 text-sm text-neutral-700">
            <a className="underline hover:text-neutral-800" href={HUB_URL} target="_blank" rel="noreferrer">
              Return to ToolStack hub
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function TripItSafe() {
  return (
    <ErrorBoundary>
      <TripIt />
    </ErrorBoundary>
  );
}
