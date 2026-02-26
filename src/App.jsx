import React, { useEffect, useMemo, useRef, useState } from "react";
import tripitLogo from "./assets/tripit-logo.png";

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

const TRANSLATIONS = {
  EN: {
    hub: "Hub", preview: "Preview", export: "Export", help: "Help",
    vehicle: "Vehicle", addVehicle: "+ Add vehicle", activeVehicle: "Active vehicle",
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
    startTime: "Start Time", endTime: "End Time", odoStart: "Odo Start", odoEnd: "Odo End",
    tripItReport: "Trip-It Report", generated: "Generated:", storageKey: "Storage key:", 
    templates: "Templates", saveTemplate: "Save as Template", templateName: "Template Name", 
    load: "Load", manageTemplates: "Manage Templates", noTemplates: "No templates saved.", tag: "Tag / Location", startTag: "Start Tag", endTag: "End Tag",
    titleTag: "Title Tag", purposeTag: "Purpose Tag", close: "Close", save: "Save"
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
    startTime: "Startzeit", endTime: "Endzeit", odoStart: "Km Start", odoEnd: "Km Ende",
    tripItReport: "Trip-It Bericht", generated: "Erstellt:", storageKey: "Speicherschlüssel:", 
    templates: "Vorlagen", saveTemplate: "Als Vorlage speichern", templateName: "Vorlagenname", 
    load: "Laden", manageTemplates: "Vorlagen verwalten", noTemplates: "Keine Vorlagen gespeichert.", tag: "Tag / Ort", startTag: "Start Tag", endTag: "End Tag",
    titleTag: "Titel-Tag", purposeTag: "Zweck-Tag", close: "Schließen", save: "Speichern"
  }
};

// Optional: set later
const HUB_URL = "https://YOUR-WIX-HUB-URL-HERE";

// Master accent
const ACCENT = "#D5FF00"; // rgb(213,255,0)
const ACCENT_RGB = "213 255 0";

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

const safeStorageRemove = (key) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);
const roundTime = () => {
  const coeff = 1000 * 60 * 5;
  const date = new Date();
  const rounded = new Date(Math.round(date.getTime() / coeff) * coeff);
  return rounded.toTimeString().slice(0, 5);
};

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
      style={{ background: `linear-gradient(to right, transparent, ${ACCENT}, transparent)` }}
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
const ACTION_BASE =
  "print:hidden group relative h-10 px-2 sm:px-3 flex items-center justify-center min-w-0 " +
  "text-xs sm:text-sm font-black uppercase tracking-wider transition-all duration-200 " +
  "border-2 border-neutral-700 shadow-[3px_3px_0px_rgba(0,0,0,0.2)] " +
  "active:translate-y-0.5 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 disabled:active:shadow-[3px_3px_0px_rgba(0,0,0,0.2)] hover:z-10";

// Match the "?" Help hover (accent tint + accent border)
const HOVER_ACCENT = "hover:bg-[rgb(var(--ts-accent-rgb)/0.25)] hover:border-[var(--ts-accent)]";

function ActionButton({ children, onClick, tone = "default", disabled, title }) {
  const cls = disabled
    ? "bg-neutral-800 text-neutral-500 border-neutral-700"
    : "bg-neutral-700 text-white hover:-translate-y-1 hover:shadow-[5px_5px_0px_var(--ts-accent)] hover:border-[var(--ts-accent)] hover:text-[var(--ts-accent)]";

  return (
    <button type="button" onClick={onClick} title={title} disabled={disabled} className={`${ACTION_BASE} ${cls}`}>
      <span className="truncate w-full text-center relative z-10">{children}</span>
    </button>
  );
}

// ---------- Help Pack v1 (Canonical) ----------
// ---------- Help Pack v1 (Graffiti Style) ----------
function HelpModal({ open, onClose, appName = "ToolStack App", storageKey = "(unknown)", actions = [] }) {
  if (!open) return null;

  const Card = ({ title, children }) => (
    <div className="group relative rounded-sm border-2 border-neutral-700 bg-neutral-800 p-4 transition-all hover:border-[var(--ts-accent)] hover:shadow-[4px_4px_0px_var(--ts-accent)] hover:-translate-y-1">
      <div className="mb-2 text-lg font-black uppercase tracking-tight text-[var(--ts-accent)] drop-shadow-md">{title}</div>
      <div className="text-sm font-medium text-neutral-300 leading-relaxed space-y-2">{children}</div>
    </div>
  );

  const Bullet = ({ children }) => (
    <li className="flex items-start gap-2">
      <span className="mt-1.5 h-2 w-2 shrink-0 rotate-45 bg-[var(--ts-accent)]" />
      <span>{children}</span>
    </li>
  );

  return (
    <div className="fixed inset-0 z-50 backdrop-blur-sm">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-3xl transform border-4 border-[var(--ts-accent)] bg-neutral-900 shadow-[8px_8px_0px_rgba(0,0,0,0.5)] overflow-hidden">
          
          {/* Header */}
          <div className="relative border-b-4 border-[var(--ts-accent)] bg-neutral-900 p-6 flex items-start justify-between gap-4">
            <div className="relative z-10">
              <div className="text-xs font-bold uppercase tracking-widest text-neutral-500">ToolStack • Help Pack v1</div>
              <h2 className="mt-1 text-4xl font-black uppercase italic tracking-tighter text-white drop-shadow-[2px_2px_0px_var(--ts-accent)]">
                {appName} <span className="text-[var(--ts-accent)]">Help</span>
              </h2>
              <div className="mt-2 text-sm font-bold text-neutral-400 uppercase tracking-wide">How your data works</div>
            </div>

            <button
              type="button"
              className="group relative px-4 py-2 font-black uppercase tracking-wider text-neutral-900 bg-[var(--ts-accent)] hover:bg-white transition-colors border-2 border-[var(--ts-accent)] hover:border-[var(--ts-accent)]"
              onClick={onClose}
            >
              <span className="relative z-10">Close X</span>
            </button>
            
            {/* Graffiti splatter decoration (CSS shapes) */}
            <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-[var(--ts-accent)] opacity-20 blur-2xl pointer-events-none"></div>
          </div>

          <div className="p-6 space-y-6 max-h-[70vh] overflow-auto bg-neutral-900 scrollbar-thin scrollbar-thumb-[var(--ts-accent)] scrollbar-track-neutral-800">
            
            <Card title="About Trip-It">
              <p>Trip-It is a local-first trip and vehicle log tool designed to help you record trips, fuel, and key vehicle details, then generate clean print-ready summaries. It’s built for daily operational logging with no accounts, no cloud storage, and no automatic data sharing.</p>
            </Card>

            <Card title="How Trip-It Works">
              <p>Trip-It follows a simple workflow:</p>
              <ul className="space-y-2 mt-2">
                <Bullet><b className="text-white">1. Add Vehicles</b><br/>Create one or more vehicles with basic identifiers (name/plate/type).</Bullet>
                <Bullet><b className="text-white">2. Log Trips</b><br/>Add trips with dates, purpose/route notes, and distance (km).</Bullet>
                <Bullet><b className="text-white">3. Log Fuel (optional)</b><br/>Record fuel entries to support cost tracking and usage history.</Bullet>
                <Bullet><b className="text-white">4. Review Totals</b><br/>Trip-It calculates totals and summaries based on your entries.</Bullet>
                <Bullet><b className="text-white">5. Preview & Print</b><br/>Use Preview to generate a print-ready report.</Bullet>
                <Bullet><b className="text-white">6. Export a Backup</b><br/>Export a JSON backup regularly, especially after major updates.</Bullet>
              </ul>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Card title="Your Data & Privacy">
                <p>Your data is saved locally in this browser using secure local storage.</p>
                <p className="mt-2">This means:</p>
                <ul className="mt-2 space-y-2">
                  <Bullet>Your data stays on this device</Bullet>
                  <Bullet>Clearing browser data can remove your logs</Bullet>
                  <Bullet>Incognito/private mode will not retain data</Bullet>
                  <Bullet>Data does not automatically sync across devices</Bullet>
                </ul>
              </Card>

              <Card title="Backup & Restore">
                <p>Export downloads a JSON backup of your current Trip-It data.</p>
                <p>Import restores a previously exported JSON file and replaces current app data.</p>
                <p className="mt-2">Recommended routine:</p>
                <ul className="mt-2 space-y-2">
                  <Bullet>Export weekly</Bullet>
                  <Bullet>Export after major edits</Bullet>
                  <Bullet>Store backups in two locations (e.g., Downloads + Drive/USB)</Bullet>
                </ul>
              </Card>
            </div>

            <Card title="Buttons Explained">
              <ul className="space-y-2">
                <Bullet><b className="text-white">Preview</b> – Opens the print-ready view.</Bullet>
                <Bullet><b className="text-white">Print / Save PDF</b> – Prints only the preview sheet. Choose “Save as PDF” to create a file.</Bullet>
                <Bullet><b className="text-white">Export</b> – Downloads a JSON backup file.</Bullet>
                <Bullet><b className="text-white">Import</b> – Restores data from a JSON backup file.</Bullet>
              </ul>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Card title="Storage Keys (Advanced)">
                <div className="rounded-sm border-2 border-dashed border-neutral-600 bg-neutral-900 px-3 py-2 text-xs font-mono text-[var(--ts-accent)] break-all">
                  App data key: toolstack.tripit.v1<br/>
                  Shared profile key: toolstack.profile.v1<br/>
                  Legacy key: toolstack_tripit_v1
                </div>
              </Card>

              <Card title="Notes / Limitations">
                <p>Trip-It is a logging tool. Totals and summaries depend on the accuracy of the entries you provide.</p>
                <p className="mt-2">Use Export regularly to avoid data loss.</p>
              </Card>
            </div>

            <Card title="Support / Feedback">
              <p>If something breaks, include: device + browser + steps to reproduce + what you expected vs what happened.</p>
            </Card>

          </div>

          <div className="border-t-4 border-[var(--ts-accent)] bg-neutral-900 p-4 flex items-center justify-end gap-2">
            <button
              type="button"
              className="px-6 py-3 font-black uppercase tracking-wider text-neutral-900 bg-[var(--ts-accent)] border-2 border-[var(--ts-accent)] hover:bg-white hover:scale-105 transition-all shadow-[4px_4px_0px_rgba(255,255,255,0.2)]"
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
const BTN_BASE = "print:hidden group relative inline-flex items-center justify-center px-4 py-2 rounded-sm text-xs font-black uppercase tracking-wider transition-all duration-200 border-2 shadow-[3px_3px_0px_rgba(0,0,0,0.2)] active:translate-y-0.5 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed";

const btnSecondary = `${BTN_BASE} border-neutral-700 bg-neutral-700 text-white hover:bg-[var(--ts-accent)] hover:text-neutral-900 hover:border-[var(--ts-accent)] hover:-translate-y-1 hover:shadow-[5px_5px_0px_var(--ts-accent)]`;

const btnPrimary = btnSecondary;

// Accent (green) button (requested: green with dark-grey text)
const btnAccent = `${BTN_BASE} border-[var(--ts-accent)] bg-[var(--ts-accent)] text-neutral-900 hover:bg-white hover:text-neutral-900 hover:border-[var(--ts-accent)] hover:-translate-y-1 hover:shadow-[5px_5px_0px_rgba(0,0,0,0.2)]`;

const btnDanger = `${BTN_BASE} border-red-500 bg-red-500 text-white hover:bg-white hover:text-red-600 hover:border-red-500 hover:-translate-y-1 hover:shadow-[5px_5px_0px_rgba(0,0,0,0.2)]`;


const inputBase =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ts-accent-rgb)/0.3)] focus:border-[var(--ts-accent)]";
const inputCompact =
  "w-full rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ts-accent-rgb)/0.3)] focus:border-[var(--ts-accent)]";
const card = "rounded-2xl bg-white border border-neutral-200 shadow-sm overflow-hidden";
const cardHead = "px-4 py-3 border-b border-neutral-100";
const cardPad = "p-4";

function Pill({ children, tone = "default" }) {
  const cls =
    tone === "accent"
      ? "bg-[var(--ts-accent)] text-neutral-900 border-neutral-700"
      : tone === "warn"
      ? "bg-red-500 text-white border-neutral-700"
      : "bg-neutral-700 text-white border-neutral-700";
  return <span className={`inline-flex items-center px-2 py-1 rounded-sm text-[10px] sm:text-xs font-black uppercase tracking-wider border-2 shadow-[2px_2px_0px_rgba(0,0,0,0.2)] transform -rotate-1 hover:rotate-0 transition-transform ${cls}`}>{children}</span>;
}

function ConfirmModal({ open, title, message, confirmText = "Delete", onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-neutral-200 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-neutral-100">
          <div className="text-lg font-semibold text-neutral-800">{title}</div>
          <div className="text-sm text-neutral-700 mt-1">{message}</div>
          <div className="mt-3">
            <AccentUnderline className="w-40" />
          </div>
        </div>
        <div className="p-4 flex items-center justify-end gap-2">
          <button
            type="button"
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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
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
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ts-accent-rgb)/0.3)] focus:border-[var(--ts-accent)] mt-2"
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
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--ts-accent-rgb)/0.3)] focus:border-[var(--ts-accent)] mt-2 min-h-[220px]"
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
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
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
              <div className="text-sm text-neutral-500 italic">{t("noTemplates")}</div>
            ) : (
              filtered.map(tpl => (
                <div key={tpl.id} className="flex items-center justify-between p-2 rounded-lg border border-neutral-100 bg-white hover:border-neutral-300 transition">
                  <div className="font-medium text-neutral-800 truncate pr-2">{tpl.name}</div>
                  <div className="flex gap-2 shrink-0">
                    <button className="px-2 py-1 rounded-sm text-[10px] font-black uppercase tracking-wider border-2 border-neutral-700 bg-neutral-700 text-white hover:border-[var(--ts-accent)] hover:text-[var(--ts-accent)] transition-all" onClick={() => onLoad(tpl)}>{t("load")}</button>
                    <button className="px-2 py-1 rounded-sm text-[10px] font-black uppercase tracking-wider border-2 border-red-500 bg-red-500 text-white hover:bg-white hover:text-red-600 transition-all" onClick={() => onDelete(tpl.id)}>{t("delete")}</button>
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

function TagSuggestions({ tags, onSelect }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {tags.map(t => (
        <button
          key={t}
          type="button"
          onClick={() => onSelect(t)}
          className="px-2 py-1 rounded-sm text-[10px] font-black uppercase tracking-wider border-2 border-neutral-700 bg-neutral-700 text-white hover:bg-neutral-600 hover:border-[var(--ts-accent)] hover:text-[var(--ts-accent)] transition-all shadow-[2px_2px_0px_rgba(0,0,0,0.2)]"
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// ---------- Leg Modal (for saved legs) ----------
function LegModal({ open, leg, onClose, onSave, t, suggestions = [] }) {
  const [draft, setDraft] = useState(leg || {});
  useEffect(() => { setDraft(leg || {}); }, [leg]);
  const uniqueId = useMemo(() => Math.random().toString(36).slice(2), []);

  if (!open) return null;

  const handleChange = (f, v) => setDraft(d => ({ ...d, [f]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white border border-neutral-200 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-neutral-100">
          <div className="text-lg font-semibold text-neutral-800">{t("editLeg")}</div>
          <div className="mt-3"><AccentUnderline className="w-32" /></div>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-neutral-600">{t("from")}</label>
              <input className={`${inputBase} mt-1`} value={draft.startPlace || ""} onChange={e => handleChange("startPlace", e.target.value)} list="leg-modal-locations" />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-600">{t("to")}</label>
              <input className={`${inputBase} mt-1`} value={draft.endPlace || ""} onChange={e => handleChange("endPlace", e.target.value)} list="leg-modal-locations" />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-600">{t("startTime")}</label>
              <input type="time" className={`${inputBase} mt-1`} value={draft.startTime || ""} onChange={e => handleChange("startTime", e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-600">{t("endTime")}</label>
              <input type="time" className={`${inputBase} mt-1`} value={draft.endTime || ""} onChange={e => handleChange("endTime", e.target.value)} />
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
          <div>
            <label className="text-xs font-medium text-neutral-600">{t("note")}</label>
            <input className={`${inputBase} mt-1`} value={draft.note || ""} onChange={e => handleChange("note", e.target.value)} />
          </div>
        </div>
        <div className="p-4 border-t border-neutral-100 flex justify-end gap-2">
          <button className={btnSecondary} onClick={onClose}>{t("cancel")}</button>
          <button className={btnAccent} onClick={() => onSave(draft)}>{t("save")}</button>
        </div>
        <datalist id="leg-modal-locations">
          {suggestions.map((s, i) => <option key={i} value={s} />)}
        </datalist>
      </div>
    </div>
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
  useEffect(() => {
    if (open) setYear(currentYear);
  }, [open, currentYear]);

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
          onClick={() => setOpen(true)}
          className={
            "w-full h-10 rounded-xl border border-neutral-200 bg-white px-3 text-[13px] sm:text-sm text-neutral-700 shadow-sm " +
            "hover:bg-[rgb(var(--ts-accent-rgb)/0.25)] hover:border-[var(--ts-accent)] transition flex items-center justify-between gap-3 " +
            (disabled ? "opacity-50 cursor-not-allowed" : "")
          }
          title="Choose month"
        >
          <span className="truncate">{monthLabel(value, lang)}</span>
          <span
            className={
              "h-8 w-8 rounded-lg border border-neutral-200 bg-white flex items-center justify-center shrink-0 " +
              "hover:bg-[rgb(var(--ts-accent-rgb)/0.25)] hover:border-[var(--ts-accent)]"
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
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
            <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white shadow-xl overflow-hidden">
              <div className="p-4 border-b border-neutral-100 flex items-start justify-between gap-4">
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

              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-neutral-700">{t("year")}</div>
                  <select
                    className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700"
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
                        className={`h-10 rounded-sm border-2 text-xs font-black uppercase tracking-wider transition-all ${
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
          createdAt: l.createdAt || new Date().toISOString()
        }));

        trips.push({
          id: uid(),
          vehicleId: vid,
          title: `Trip on ${date}`,
          purpose: "",
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
        return { ...t, tags: t.tags || "", titleTag: t.titleTag || "", purposeTag: t.purposeTag || "", legs: Array.isArray(t.legs) ? t.legs : [] };
    }).filter(Boolean);

    if (!normActiveTripByVehicle[v.id]) {
        normActiveTripByVehicle[v.id] = null;
    } else {
        // Ensure active trip has legs array
        if (!Array.isArray(normActiveTripByVehicle[v.id].legs)) {
            normActiveTripByVehicle[v.id] = { ...normActiveTripByVehicle[v.id], legs: [] };
        }
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
    data: t.data || {}
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

function TripIt() {
  const importInputRef = useRef(null);

  const [profile, setProfile] = useState(loadProfile);
  const [storageError, setStorageError] = useState(false);

  const [app, setApp] = useState(() => {
    const raw = safeStorageGet(KEY) || safeStorageGet(LEGACY_LS_KEY) || null;
    const saved = raw ? safeParse(raw, null) : null;
    const migrated = migrateLegacyIfNeeded(saved);
    const norm = normalizeApp(migrated || emptyApp());

    try {
      const fromLegacy = !safeStorageGet(KEY) && !!safeStorageGet(LEGACY_LS_KEY);
      if (fromLegacy) {
        safeStorageSet(KEY, JSON.stringify(norm));
        safeStorageRemove(LEGACY_LS_KEY);
      }
    } catch {
      // ignore
    }

    return norm;
  });

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [previewConfig, setPreviewConfig] = useState({ mode: "thisMonth", start: "", end: "" });

  const [helpOpen, setHelpOpen] = useState(false);
  const [emailModal, setEmailModal] = useState({ open: false, to: "", subject: "", body: "" });

  const [vehicleModal, setVehicleModal] = useState({ open: false, mode: "new", vehicleId: null });
  const [confirm, setConfirm] = useState({ open: false, kind: null, id: null, payload: null });
  const [importConfirm, setImportConfirm] = useState({ open: false, file: null });
  const [templateModal, setTemplateModal] = useState({ open: false, type: "trip" });

  // Form States
  const [tripStartForm, setTripStartForm] = useState({
    title: "",
    purpose: "",
    startDate: todayISO()
  });

  const [legForm, setLegForm] = useState({
    startPlace: "",
    startTime: roundTime(),
    odoStart: "",
    endPlace: "",
    endTime: roundTime(),
    odoEnd: "",
    note: "",
    startTag: "",
    endTag: ""
  });
  const [editingActiveLegId, setEditingActiveLegId] = useState(null);
  const [savedLegModal, setSavedLegModal] = useState({ open: false, tripId: null, leg: null });

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

  const t = (k) => {
    const l = profile.language || "EN";
    return TRANSLATIONS[l]?.[k] || TRANSLATIONS["EN"][k] || k;
  };
  const toggleLang = () => setProfile(p => ({ ...p, language: p.language === "EN" ? "DE" : "EN" }));

  const notify = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  };

  useEffect(() => {
    const success = safeStorageSet(KEY, JSON.stringify(app));
    if (!success && !storageError) setStorageError(true);
    else if (success && storageError) setStorageError(false);
  }, [app, storageError]);

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

  // Preview Data Calculation
  const previewData = useMemo(() => {
    if ((!previewOpen && !exportModalOpen) || !activeVehicle) return { trips: [], fuel: [], totals: {} };
    
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
      totals: { distance, legCount, tripCount: filteredTrips.length, liters, spend, currency }
    };
  }, [previewOpen, exportModalOpen, activeVehicle, trips, fuelLogs, previewConfig]);

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

  const allLocations = useMemo(() => {
    const counts = {};
    if (activeVehicle && app.tripsByVehicle[activeVehicle.id]) {
      app.tripsByVehicle[activeVehicle.id].forEach(t => {
        (t.legs || []).forEach(l => {
          if (l.startPlace) counts[l.startPlace] = (counts[l.startPlace] || 0) + 1;
          if (l.endPlace) counts[l.endPlace] = (counts[l.endPlace] || 0) + 1;
        });
      });
    }
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  }, [app.tripsByVehicle, activeVehicle]);

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
      startTime: roundTime(),
      endTime: "",
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
      setLegForm(trip.draft);
      return;
    }
    if (trip && trip.legs.length > 0) {
      const lastLeg = trip.legs[trip.legs.length - 1];
      setLegForm({
        startPlace: lastLeg.endPlace,
        startTag: lastLeg.endTag || "",
        startTime: roundTime(),
        odoStart: (lastLeg && lastLeg.odoEnd != null) ? lastLeg.odoEnd : "",
        endPlace: "",
        endTag: "",
        endTime: roundTime(),
        odoEnd: "",
        note: ""
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
      setLegForm({
        startPlace: "",
        startTag: "",
        startTime: roundTime(),
        odoStart: lastOdo !== "" ? lastOdo : "",
        endPlace: "",
        endTag: "",
        endTime: roundTime(),
        odoEnd: "",
        note: ""
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
          startTime: roundTime(),
          odoStart: lastOdo,
          endPlace: "",
          endTime: roundTime(),
          odoEnd: "",
          note: ""
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
        note: legForm.note 
      };
    }

    setApp(a => ({
      ...a,
      templates: [...(a.templates || []), { id: uid(), type, name, data }]
    }));
    notify("Template saved");
  };

  const deleteTemplate = (id) => {
    setApp(a => ({ ...a, templates: (a.templates || []).filter(t => t.id !== id) }));
  };

  const loadTemplate = (tpl) => {
    if (tpl.type === 'trip') {
      setTripStartForm(prev => ({ ...prev, title: tpl.data.title || "", purpose: tpl.data.purpose || "" }));
    } else {
      setLegForm(prev => ({
        ...prev,
        startPlace: tpl.data.startPlace || "",
        startTag: tpl.data.startTag || "",
        endPlace: tpl.data.endPlace || "",
        endTag: tpl.data.endTag || "",
        note: tpl.data.note || "",
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

    setApp(a => ({
      ...a,
      activeTripByVehicle: { ...a.activeTripByVehicle, [activeVehicle.id]: newTrip }
    }));
    
    // Reset start form
    setTripStartForm({ title: "", purpose: "", startDate: todayISO() });
    notify("Trip started");
  };

  const saveActiveLeg = () => {
    if (!activeVehicle || !activeTrip) return;

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
      km: km,
      note: legForm.note,
    };

    if (editingActiveLegId) {
      const updatedTrip = {
        ...activeTrip,
        legs: activeTrip.legs.map(l => l.id === editingActiveLegId ? { ...l, ...legData } : l)
      };
      setApp(a => ({
        ...a,
        activeTripByVehicle: { ...a.activeTripByVehicle, [activeVehicle.id]: updatedTrip }
      }));
      setEditingActiveLegId(null);
      resetLegForm(updatedTrip);
      notify("Leg updated");
    } else {
      const newLeg = {
        id: uid(),
        ...legData,
        createdAt: new Date().toISOString()
      };
      const updatedTrip = {
        ...activeTrip,
        legs: [...activeTrip.legs, newLeg]
        ,draft: null
      };
      setApp(a => ({
        ...a,
        activeTripByVehicle: { ...a.activeTripByVehicle, [activeVehicle.id]: updatedTrip }
      }));
      notify("Leg added");
    }
  };

  const editActiveLeg = (leg) => {
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
    });
    setEditingActiveLegId(leg.id);
  };

  const cancelEditActiveLeg = () => {
    setEditingActiveLegId(null);
    resetLegForm(activeTrip);
  };

  const deleteLeg = (legId) => {
    if (!activeVehicle || !activeTrip) return;
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
    setApp(a => ({
      ...a,
      activeTripByVehicle: { ...a.activeTripByVehicle, [activeVehicle.id]: null }
    }));
    setConfirm({ open: false, kind: null, id: null, payload: null });
    notify("Trip cancelled");
  };

  const deleteTrip = (tripId) => {
    if (!activeVehicle) return;
    setApp(a => ({
      ...a,
      tripsByVehicle: { ...a.tripsByVehicle, [activeVehicle.id]: (a.tripsByVehicle[activeVehicle.id] || []).filter(t => t.id !== tripId) }
    }));
    notify("Trip deleted");
  };

  const saveSavedLeg = (updatedLeg) => {
    if (!activeVehicle || !savedLegModal.tripId) return;
    
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
    if (!activeVehicle || !window.confirm("Delete this wash entry?")) return;
    setApp(a => {
      const list = Array.isArray(a.washByVehicle[activeVehicle.id]) ? a.washByVehicle[activeVehicle.id] : [];
      return { ...a, washByVehicle: { ...a.washByVehicle, [activeVehicle.id]: list.filter(w => w.id !== id) } };
    });
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
    setApp((a) => {
      const list = Array.isArray(a.fuelByVehicle[activeVehicle.id]) ? a.fuelByVehicle[activeVehicle.id] : [];
      return { ...a, fuelByVehicle: { ...a.fuelByVehicle, [activeVehicle.id]: list.filter((f) => f.id !== fuelId) } };
    });
    notify("Fuel entry deleted");
  };

  const confirmDeleteFuel = (id) => {
    if (window.confirm("Delete this fuel entry?")) {
      deleteFuel(id);
    }
  };

  // ---------- Export / Import ----------
  const exportJSON = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile,
      data: app,
      meta: { appId: APP_ID, version: APP_VERSION, storageKey: KEY },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `toolstack-trip-it-${APP_VERSION}-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importJSON = async (file) => {
    if (!file) return;
    const text = await file.text();
    const parsed = safeParse(text, null);
    if (!parsed) return notify("Invalid JSON");

    // Accept either {profile,data} export OR raw app object
    const incomingProfile = parsed?.profile || profile;
    const incomingData = parsed?.data || parsed;

    const migrated = migrateLegacyIfNeeded(incomingData);
    setProfile(incomingProfile);
    setApp(normalizeApp(migrated || emptyApp()));
    notify("Imported");
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
    
    const rows = [["Date", "Trip Title", "Start Place", "End Place", "Start Time", "End Time", "Distance (km)", "Odo Start", "Odo End", "Notes"]];
    
    trips.forEach(t => {
      (t.legs || []).forEach(l => {
        rows.push([
          t.startDate,
          `"${(t.title || t.purpose || "").replace(/"/g, '""')}"`,
          `"${l.startPlace.replace(/"/g, '""')}"`,
          `"${l.endPlace.replace(/"/g, '""')}"`,
          l.startTime,
          l.endTime,
          l.km,
          l.odoStart,
          l.odoEnd,
          `"${(l.note || "").replace(/"/g, '""')}"`
        ]);
      });
    });

    const csvContent = rows.map(r => r.join(",")).join("\n");
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
    const payload = {
      range: { start: previewConfig.start, end: previewConfig.end },
      exportedAt: new Date().toISOString(),
      vehicle: { name: activeVehicle.name, plate: activeVehicle.plate },
      trips: previewData.trips,
      fuel: previewData.fuel
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tripit-export-${previewConfig.start}-to-${previewConfig.end}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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

  const handleQuickStart = () => {
    setLegForm((prev) => ({
      ...prev,
      startTime: new Date().toTimeString().slice(0, 5),
    }));
    getCurrentLocation("startPlace");
  };

  const handleQuickEnd = () => {
    setLegForm((prev) => ({ ...prev, endTime: new Date().toTimeString().slice(0, 5) }));
    getCurrentLocation("endPlace");
  };

  return (
    <div
      className="min-h-screen bg-neutral-50 text-neutral-800"
      style={{
        "--ts-accent": ACCENT,
        "--ts-accent-rgb": ACCENT_RGB,
      }}
    >
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
        title={confirm.kind === "vehicle" ? t("deleteVehicleQ") : t("cancelTripQ")}
        message={confirm.kind === "vehicle" ? t("deleteVehicleMsg") : t("cancelTripMsg")}
        confirmText={confirm.kind === "vehicle" ? t("delete") : t("cancelTrip")}
        onCancel={() => setConfirm({ open: false, kind: null, id: null, payload: null })}
        onConfirm={confirm.kind === "vehicle" ? deleteVehicleNow : cancelTrip}
      />

      <ConfirmModal
        open={importConfirm.open}
        title={t("importBackupQ")}
        message={t("importBackupMsg")}
        confirmText={t("import")}
        onCancel={() => setImportConfirm({ open: false, file: null })}
        onConfirm={() => {
          const f = importConfirm.file;
          setImportConfirm({ open: false, file: null });
          importJSON(f);
        }}
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

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} appName="Trip-It" storageKey={KEY} actions={["Email"]} />

      <LegModal 
        open={savedLegModal.open} 
        leg={savedLegModal.leg} 
        onClose={() => setSavedLegModal({ open: false, tripId: null, leg: null })} 
        onSave={saveSavedLeg} 
        t={t}
        suggestions={allLocations}
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
        <div className="fixed inset-0 z-50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8">
          <div className="absolute inset-0 bg-black/80" onClick={() => setExportModalOpen(false)} />
          <div className="relative w-full max-w-lg transform border-4 border-[var(--ts-accent)] bg-neutral-900 shadow-[8px_8px_0px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="relative border-b-4 border-[var(--ts-accent)] bg-neutral-900 p-6 flex items-center justify-between z-10">
              <div>
                 <div className="text-xs font-bold uppercase tracking-widest text-neutral-500">ToolStack • Data</div>
                 <h2 className="mt-1 text-3xl font-black uppercase italic tracking-tighter text-white drop-shadow-[2px_2px_0px_var(--ts-accent)]">
                  {t("export")}
                 </h2>
              </div>
              <button 
                className="group relative px-4 py-2 font-black uppercase tracking-wider text-black bg-[var(--ts-accent)] hover:bg-white transition-colors border-2 border-transparent hover:border-[var(--ts-accent)]"
                onClick={() => setExportModalOpen(false)}
              >
                <span className="relative z-10">Close X</span>
              </button>
              {/* Graffiti splatter decoration */}
              <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-[var(--ts-accent)] opacity-20 blur-2xl pointer-events-none"></div>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-8 bg-neutral-900 scrollbar-thin scrollbar-thumb-[var(--ts-accent)] scrollbar-track-neutral-800">
              {/* Range Selector */}
              <div className="space-y-3">
                <div className="text-xs font-black text-[var(--ts-accent)] uppercase tracking-widest">{t("rangeSelection")}</div>
                <div className="flex flex-wrap gap-2">
                  <select 
                    className="h-12 rounded-sm border-2 border-neutral-700 bg-neutral-700 px-3 text-sm font-bold text-white focus:outline-none focus:border-[var(--ts-accent)] w-full sm:w-auto"
                    value={previewConfig.mode}
                    onChange={(e) => updatePreviewMode(e.target.value)}
                  >
                    <option value="thisWeek">This Week</option>
                    <option value="lastWeek">Last Week</option>
                    <option value="thisMonth">This Month</option>
                    <option value="lastMonth">Last Month</option>
                    <option value="custom">Custom</option>
                  </select>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input 
                      type="date" 
                      className="h-12 rounded-sm border-2 border-neutral-700 bg-neutral-700 px-3 text-sm font-bold text-white focus:outline-none focus:border-[var(--ts-accent)] grow"
                      value={previewConfig.start}
                      onChange={(e) => setPreviewConfig(p => ({ ...p, mode: "custom", start: e.target.value }))}
                    />
                    <span className="text-neutral-500 font-black">-</span>
                    <input 
                      type="date" 
                      className="h-12 rounded-sm border-2 border-neutral-700 bg-neutral-700 px-3 text-sm font-bold text-white focus:outline-none focus:border-[var(--ts-accent)] grow"
                      value={previewConfig.end}
                      onChange={(e) => setPreviewConfig(p => ({ ...p, mode: "custom", end: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Reports */}
              <div className="space-y-3">
                <div className="text-xs font-black text-[var(--ts-accent)] uppercase tracking-widest">{t("reports")}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button className="group relative p-4 text-left border-2 border-neutral-700 bg-neutral-700 hover:border-[var(--ts-accent)] hover:-translate-y-1 transition-all" onClick={() => { setExportModalOpen(false); setPreviewOpen(true); }}>
                    <div className="font-black text-white uppercase tracking-tight group-hover:text-[var(--ts-accent)]">{t("previewPack")}</div>
                    <div className="text-xs text-neutral-400 mt-1">View report on screen</div>
                  </button>
                  <button className="group relative p-4 text-left border-2 border-neutral-700 bg-neutral-700 hover:border-[var(--ts-accent)] hover:-translate-y-1 transition-all" onClick={() => { setExportModalOpen(false); setPreviewOpen(true); setTimeout(() => window.print(), 500); }}>
                    <div className="font-black text-white uppercase tracking-tight group-hover:text-[var(--ts-accent)]">{t("printSavePdf")}</div>
                    <div className="text-xs text-neutral-400 mt-1">Print or Save as PDF</div>
                  </button>
                </div>
              </div>

              {/* CSV / Share */}
              <div className="space-y-3">
                <div className="text-xs font-black text-[var(--ts-accent)] uppercase tracking-widest">{t("csvShare")}</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button className="h-12 font-bold text-sm text-white border-2 border-neutral-700 bg-neutral-700 hover:border-[var(--ts-accent)] hover:text-[var(--ts-accent)] transition-all" onClick={exportPreviewCSV}>{t("exportCsv")}</button>
                  <button className="h-12 font-bold text-sm text-white border-2 border-neutral-700 bg-neutral-700 hover:border-[var(--ts-accent)] hover:text-[var(--ts-accent)] transition-all" onClick={copySummary}>{t("copySummary")}</button>
                  <button className="h-12 font-bold text-sm text-white border-2 border-neutral-700 bg-neutral-700 hover:border-[var(--ts-accent)] hover:text-[var(--ts-accent)] transition-all" onClick={openEmail}>{t("emailSummary")}</button>
                </div>
              </div>

              {/* Data Backup */}
              <div className="space-y-3">
                <div className="text-xs font-black text-[var(--ts-accent)] uppercase tracking-widest">{t("dataBackup")}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button className="h-12 font-bold text-sm text-neutral-900 bg-[var(--ts-accent)] border-2 border-[var(--ts-accent)] hover:bg-white hover:text-neutral-900 transition-all" onClick={exportJSON}>{t("exportJson")}</button>
                  <button className="h-12 font-bold text-sm text-white border-2 border-neutral-700 bg-neutral-700 hover:border-[var(--ts-accent)] hover:text-[var(--ts-accent)] transition-all" onClick={onImportPick}>{t("importJson")}</button>
                </div>
                <div className="text-xs text-neutral-500 font-mono">{t("fullBackupDesc")}</div>
              </div>
            </div>
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
          if (file) setImportConfirm({ open: true, file });
          e.target.value = "";
        }}
      />

      {/* Vehicle modal */}
      {vehicleModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
          <div
            className="absolute inset-0 bg-black/40"
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
        <div className="fixed inset-0 z-50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8">
          <div className="absolute inset-0 bg-black/80" onClick={() => setPreviewOpen(false)} />
          <div className="relative w-full max-w-5xl transform border-4 border-[var(--ts-accent)] bg-neutral-900 shadow-[8px_8px_0px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh]">
            
            {/* Header (Controls) */}
            <div className="relative border-b-4 border-[var(--ts-accent)] bg-neutral-900 p-4 sm:p-6 z-10 print:hidden">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 relative z-20">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-neutral-500">ToolStack • Preview</div>
                  <h2 className="mt-1 text-3xl font-black uppercase italic tracking-tighter text-white drop-shadow-[2px_2px_0px_var(--ts-accent)]">
                    {t("tripItReport")}
                  </h2>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  <select 
                    className="h-10 rounded-sm border-2 border-neutral-700 bg-neutral-800 px-2 text-xs font-bold text-white focus:outline-none focus:border-[var(--ts-accent)] uppercase tracking-wider"
                    value={previewConfig.mode}
                    onChange={(e) => updatePreviewMode(e.target.value)}
                  >
                    <option value="thisWeek">This Week</option>
                    <option value="lastWeek">Last Week</option>
                    <option value="thisMonth">This Month</option>
                    <option value="lastMonth">Last Month</option>
                    <option value="custom">Custom</option>
                  </select>
                  
                  <div className="flex items-center gap-1 bg-neutral-800 border-2 border-neutral-700 rounded-sm px-1">
                    <input 
                      type="date" 
                      className="h-9 bg-transparent text-xs font-bold text-white focus:outline-none uppercase tracking-wider w-24 sm:w-auto"
                      value={previewConfig.start}
                      onChange={(e) => setPreviewConfig(p => ({ ...p, mode: "custom", start: e.target.value }))}
                    />
                    <span className="text-neutral-500 font-black">-</span>
                    <input 
                      type="date" 
                      className="h-9 bg-transparent text-xs font-bold text-white focus:outline-none uppercase tracking-wider w-24 sm:w-auto"
                      value={previewConfig.end}
                      onChange={(e) => setPreviewConfig(p => ({ ...p, mode: "custom", end: e.target.value }))}
                    />
                  </div>
                  
                  <div className="w-px h-8 bg-neutral-700 mx-1 hidden xl:block"></div>

                  <button className={btnSecondary} onClick={exportPreviewCSV}>CSV</button>
                  <button className={btnSecondary} onClick={exportPreviewJSON}>JSON</button>
                  <button className={btnAccent} onClick={() => window.print()}>Print</button>
                  <button 
                    className="group relative px-3 py-2 font-black uppercase tracking-wider text-white border-2 border-neutral-700 bg-neutral-800 hover:border-red-500 hover:text-red-500 transition-all"
                    onClick={() => setPreviewOpen(false)}
                  >
                    X
                  </button>
                </div>
              </div>
              
              {/* Graffiti splatter decoration */}
              <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-[var(--ts-accent)] opacity-20 blur-2xl pointer-events-none"></div>
            </div>

            {/* Printable Content Area */}
            <div className="overflow-auto flex-1 bg-neutral-900 p-4 sm:p-8 scrollbar-thin scrollbar-thumb-[var(--ts-accent)] scrollbar-track-neutral-800">
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
                      previewData.trips.map(t => (
                        <React.Fragment key={t.id}>
                          {t.legs.map((l, i) => (
                            <tr key={l.id} className="border-b border-neutral-100 last:border-0">
                              <td className="py-2 align-top text-neutral-800 whitespace-nowrap">{i === 0 ? t.startDate : ""}</td>
                              <td className="py-2 align-top text-neutral-800">
                                {i === 0 && (t.title || t.purpose) ? (
                                  <div>
                                    <div className="font-medium">{t.title}</div>
                                    {t.purpose && <div className="text-xs text-neutral-500">{t.purpose}</div>}
                                  </div>
                                ) : null}
                              </td>
                              <td className="py-2 align-top text-neutral-800">
                                <div>{l.startPlace} → {l.endPlace}</div>
                                {(l.startTag || l.endTag) && <div className="text-xs font-medium text-lime-700 bg-lime-50 inline-block px-1.5 rounded mt-0.5">{l.startTag}{l.startTag && l.endTag ? " → " : ""}{l.endTag}</div>}
                                <div className="text-xs text-neutral-500">{l.startTime} - {l.endTime}</div>
                                {l.note && <div className="text-xs text-neutral-500 italic">"{l.note}"</div>}
                              </td>
                              <td className="py-2 align-top text-neutral-800 text-right">{l.km.toFixed(1)}</td>
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

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="w-fit">
              <img
                src={tripitLogo}
                alt="TripIt"
                className="h-28 w-auto sm:h-40 select-none mix-blend-multiply"
                draggable="false"
              />
            </div>
            {activeVehicle && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Pill>{tripTotals.tripCount} {t("trips")}</Pill>
                <Pill>{tripTotals.distance.toFixed(1)} km</Pill>
                <Pill tone="accent">{money(fuelTotals.spend, fuelTotals.currency)}</Pill>
                <Pill>{fuelTotals.liters.toFixed(2)} L</Pill>
              </div>
            )}
          </div>

          {/* Normalized top actions grid (with pinned help) */}
          <div className="w-full sm:flex-1 lg:flex-none lg:w-3/5">
            <div className="relative">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 pr-24">
                <ActionButton onClick={openHub} title={t("returnHub")}>
                  {t("hub")}
                </ActionButton>
                <ActionButton onClick={openPreview} disabled={!activeVehicle}>
                  {t("preview")}
                </ActionButton>
                <ActionButton onClick={openExportModal} disabled={!activeVehicle}>{t("export")}</ActionButton>
              </div>

              <button
                type="button"
                title="Help"
                onClick={() => setHelpOpen(true)}
                className="print:hidden absolute right-0 top-0 h-12 w-12 z-30 group"
                aria-label="Help"
              >
                <div className="absolute inset-0 bg-neutral-700 border-2 border-[var(--ts-accent)] shadow-[4px_4px_0px_rgba(0,0,0,0.5)] flex items-center justify-center transform transition-all group-hover:-translate-y-1 group-hover:shadow-[6px_6px_0px_var(--ts-accent)]">
                  <span className="text-2xl font-black text-[var(--ts-accent)] italic">?</span>
                </div>
              </button>

              <div className="print:hidden absolute right-0 top-20 flex items-center justify-end z-20">
                <div className="flex bg-neutral-800 p-1 gap-1 border-2 border-neutral-800 shadow-[4px_4px_0px_rgba(0,0,0,0.1)]">
                  <button
                    onClick={() => setProfile(p => ({ ...p, language: "EN" }))}
                    className={`px-2 py-1 text-xs font-black uppercase tracking-tighter transition-all border-2 ${
                      profile.language === "EN"
                        ? "bg-[var(--ts-accent)] border-[var(--ts-accent)] text-black shadow-[2px_2px_0px_white] -translate-y-0.5"
                        : "bg-transparent border-transparent text-neutral-500 hover:text-white"
                    }`}
                  >
                    EN
                  </button>
                  <button
                    onClick={() => setProfile(p => ({ ...p, language: "DE" }))}
                    className={`px-2 py-1 text-xs font-black uppercase tracking-tighter transition-all border-2 ${
                      profile.language === "DE"
                        ? "bg-[var(--ts-accent)] border-[var(--ts-accent)] text-black shadow-[2px_2px_0px_white] -translate-y-0.5"
                        : "bg-transparent border-transparent text-neutral-500 hover:text-white"
                    }`}
                  >
                    DE
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-3">
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
                    <div className="mt-2 text-sm text-neutral-700">
                      {t("noVehicles")} <span className="font-medium">{t("addVehicle")}</span>.
                    </div>
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
            <div className={card}>
              <div className={`${cardHead} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                <div className="font-semibold text-neutral-800">{activeTrip ? t("activeTrip") : t("startTrip")}</div>
                
                <div className="flex flex-wrap items-center gap-3 justify-end">
                  {activeTrip ? (
                    <button className="text-xs font-black uppercase tracking-wider text-red-600 hover:text-red-800 px-2 py-1 border-2 border-red-100 bg-red-50 rounded-sm transition" onClick={() => setConfirm({ open: true, kind: "cancel", id: null })}>
                      {t("cancelTrip")}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className={cardPad}>
                {storageError && (
                  <div className="mb-4 bg-amber-100 border border-amber-200 text-amber-900 px-4 py-2 text-xs rounded-lg text-center">
                    Storage unavailable. Data may not persist.
                  </div>
                )}
                {!activeVehicle ? (
                  <div className="text-sm text-neutral-700">{t("addVehicleToStart")}</div>
                ) : activeTrip ? (
                  // Active Trip View
                  <div className="space-y-4">
                    <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3 text-sm text-neutral-700">
                      <div className="font-medium text-neutral-800">{activeTrip.title || "Untitled Trip"}</div>
                      <div className="mt-1">{t("started")} {new Date(activeTrip.startedAt).toLocaleString()}</div>
                      {activeTrip.purpose ? <div className="text-xs text-neutral-500 mt-1">{t("purpose")} {activeTrip.purpose}</div> : null}
                    </div>

                    {/* List of Legs in Active Trip */}
                    {activeTrip.legs.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{t("legs")}</div>
                        {activeTrip.legs.map((l, idx) => (
                          <div key={l.id} className="flex items-center justify-between p-2 rounded-lg border border-neutral-100 bg-white text-sm">
                            <div className="min-w-0">
                              <div className="font-medium text-neutral-800">{l.startPlace} → {l.endPlace}</div>
                              <div className="text-xs text-neutral-500">{l.startTime} - {l.endTime} • {l.km.toFixed(1)} km</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                className="text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-800 px-2"
                                onClick={() => editActiveLeg(l)}
                              >
                                {t("edit")}
                              </button>
                              <button 
                                className="text-[10px] font-black uppercase tracking-wider text-red-500 hover:text-red-700 px-2"
                                onClick={() => deleteLeg(l.id)}
                              >
                                {t("delete")}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-neutral-500 italic">{t("noLegs")}</div>
                    )}

                    <div className="border-t border-neutral-100 pt-4">
                      {!editingActiveLegId && (
                        <div className="flex gap-3 mb-4">
                          <button
                            className={`${btnSecondary} flex-1 py-3 border-[var(--ts-accent)] bg-neutral-700 text-[var(--ts-accent)] hover:bg-white hover:text-neutral-900`}
                            onClick={handleQuickStart}
                            title="Auto-fill Start Time & Location"
                          >
                            START
                          </button>
                          <button
                            className={`${btnSecondary} flex-1 py-3 border-[var(--ts-accent)] bg-neutral-700 text-[var(--ts-accent)] hover:bg-white hover:text-neutral-900`}
                            onClick={handleQuickEnd}
                            title="Auto-fill End Time & Location"
                          >
                            END
                          </button>
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-neutral-800">{editingActiveLegId ? t("updateLeg") : t("quickLeg")}</div>
                        <div className="flex gap-3 items-center">
                          <button type="button" className="text-xs text-neutral-500 hover:text-neutral-800 underline" onClick={() => setTemplateModal({ open: true, type: 'leg' })}>
                            {t("templates")}
                          </button>
                          {!editingActiveLegId && (
                            <>
                              <button type="button" className="text-xs text-neutral-500 hover:text-neutral-800 underline" onClick={duplicateLastLeg}>{t("duplicateLast")}</button>
                              <button type="button" className="text-xs text-neutral-500 hover:text-neutral-800 underline" onClick={swapLegPlaces}>{t("return")}</button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        {/* Row 1 & 2: Locations & Tags */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                          <label className="text-xs text-neutral-500 font-medium block mb-1">{t("from")}</label>
                          <div className="relative">
                            <input
                              className={`${inputBase} pr-8`}
                              value={legForm.startPlace}
                              onChange={(e) => setLegForm({ ...legForm, startPlace: e.target.value })}
                              onKeyDown={handleLegKeyDown}
                              onFocus={handleFocus}
                              placeholder={t("start")}
                              list="locations-list"
                            />
                            <button
                              type="button"
                              onClick={() => getCurrentLocation("startPlace")}
                              className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 transition"
                              title="Current location"
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                            
                            <div>
                              <input
                                className={inputBase}
                                value={legForm.startTag}
                                onChange={(e) => setLegForm({ ...legForm, startTag: e.target.value })}
                                onKeyDown={handleLegKeyDown}
                                onFocus={handleFocus}
                                placeholder={t("startTag")}
                              />
                              <TagSuggestions tags={legTags} onSelect={(t) => setLegForm(prev => ({ ...prev, startTag: t }))} />
                            </div>
                          </div>

                          <div className="space-y-2">
                          <label className="text-xs text-neutral-500 font-medium block mb-1">{t("to")}</label>
                          <div className="relative">
                            <input
                              className={`${inputBase} pr-8`}
                              value={legForm.endPlace}
                              onChange={(e) => setLegForm({ ...legForm, endPlace: e.target.value })}
                              onKeyDown={handleLegKeyDown}
                              onFocus={handleFocus}
                              placeholder={t("end")}
                              list="locations-list"
                            />
                            <button
                              type="button"
                              onClick={() => getCurrentLocation("endPlace")}
                              className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 transition"
                              title="Current location"
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>

                            <div>
                              <input
                                className={inputBase}
                                value={legForm.endTag}
                                onChange={(e) => setLegForm({ ...legForm, endTag: e.target.value })}
                                onKeyDown={handleLegKeyDown}
                                onFocus={handleFocus}
                                placeholder={t("endTag")}
                              />
                              <TagSuggestions tags={legTags} onSelect={(t) => setLegForm(prev => ({ ...prev, endTag: t }))} />
                            </div>
                          </div>
                        </div>

                        {/* Row 3: Details */}
                        <div className="flex flex-wrap gap-2 items-end">
                          <div className="w-28">
                          <label className="text-xs text-neutral-500 font-medium block mb-1">{t("start")}</label>
                          <input
                            type="time"
                            className={inputBase}
                            value={legForm.startTime}
                            onChange={(e) => setLegForm({ ...legForm, startTime: e.target.value })}
                            onKeyDown={handleLegKeyDown}
                            onFocus={handleFocus}
                          />
                          </div>
                          <div className="w-28">
                          <label className="text-xs text-neutral-500 font-medium block mb-1">{t("end")}</label>
                          <input
                            type="time"
                            className={inputBase}
                            value={legForm.endTime}
                            onChange={(e) => setLegForm({ ...legForm, endTime: e.target.value })}
                            onKeyDown={handleLegKeyDown}
                            onFocus={handleFocus}
                          />
                          </div>
                          <div className="w-20">
                          <label className="text-xs text-neutral-500 font-medium block mb-1">{t("odoS")}</label>
                          <input
                            className={`${inputBase} text-right tabular-nums`}
                            inputMode="decimal"
                            value={legForm.odoStart}
                            onChange={(e) => setLegForm({ ...legForm, odoStart: e.target.value })}
                            onKeyDown={handleLegKeyDown}
                            onFocus={handleFocus}
                            placeholder="0"
                          />
                          </div>
                          <div className="w-20">
                          <label className="text-xs text-neutral-500 font-medium block mb-1">{t("odoE")}</label>
                          <input
                            className={`${inputBase} text-right tabular-nums`}
                            inputMode="decimal"
                            value={legForm.odoEnd}
                            onChange={(e) => setLegForm({ ...legForm, odoEnd: e.target.value })}
                            onKeyDown={handleLegKeyDown}
                            onFocus={handleFocus}
                            placeholder="0"
                          />
                          </div>
                          <div className="grow min-w-[150px]">
                          <label className="text-xs text-neutral-500 font-medium block mb-1">{t("note")}</label>
                          <input
                            className={inputBase}
                            value={legForm.note}
                            onChange={(e) => setLegForm({ ...legForm, note: e.target.value })}
                            onKeyDown={handleLegKeyDown}
                            onFocus={handleFocus}
                            placeholder={t("optional")}
                          />
                          </div>
                        </div>

                        {editingActiveLegId ? (
                          <div className="flex gap-2">
                            <button className={btnSecondary} onClick={cancelEditActiveLeg}>
                              {t("cancel")}
                            </button>
                            <button className={btnAccent} onClick={saveActiveLeg}>
                              {t("update")}
                            </button>
                          </div>
                        ) : (
                          <button className={btnSecondary} onClick={saveActiveLeg}>
                            {t("add")}
                          </button>
                        )}
                      </div>
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
                className={`${cardHead} flex items-center justify-between cursor-pointer transition select-none ${recentTripsOpen ? "bg-[var(--ts-accent)]" : "hover:bg-[var(--ts-accent)]"}`}
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
                  <div className="text-sm text-neutral-700">{t("selectVehicleView")}</div>
                ) : tripsForMonth.length === 0 ? (
                  <div className="text-sm text-neutral-700">{t("noTrips")} {monthLabel(app.ui.month, profile.language)}.</div>
                ) : (
                  <div className="space-y-3">
                    {tripsForMonth.map((trip) => {
                      const totalKm = trip.legs.reduce((sum, l) => sum + toNumber(l.km), 0);
                      const isExpanded = expandedTripId === trip.id;
                      
                      let tripLastOdo = null;
                      if (trip.legs.length > 0) {
                        tripLastOdo = trip.legs[trip.legs.length - 1].odoEnd;
                      }
                      
                      return (
                        <div key={trip.id} className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
                          <div 
                            className="p-3 cursor-pointer hover:bg-[rgb(var(--ts-accent-rgb)/0.25)] transition"
                            onClick={() => toggleTrip(trip.id)}
                          >
                            <div className="font-semibold text-neutral-800 truncate">{trip.title || "Untitled Trip"}</div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                              <span>{trip.startDate}</span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[rgb(var(--ts-accent-rgb)/0.3)] text-neutral-800">
                                {trip.legs.length} {t("legs")}
                              </span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[rgb(var(--ts-accent-rgb)/0.3)] text-neutral-800">
                                {totalKm.toFixed(1)} km
                              </span>
                              {tripLastOdo != null && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[rgb(var(--ts-accent-rgb)/0.3)] text-neutral-800">
                                  {t("odoE")}: {tripLastOdo}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <div className="border-t border-neutral-100 bg-neutral-50 p-3 space-y-2">
                              {trip.purpose && <div className="text-xs text-neutral-600 mb-2">{t("purpose")} {trip.purpose}</div>}
                              {trip.legs.map((l) => (
                                <div key={l.id} className="text-sm border-l-2 border-neutral-300 pl-2 py-1">
                                  <div className="flex justify-between">
                                    <span className="font-medium text-neutral-700">{l.startPlace} → {l.endPlace}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-neutral-600">{l.km.toFixed(1)} km</span>
                                      <button 
                                        className="text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-800"
                                        onClick={(e) => { e.stopPropagation(); setSavedLegModal({ open: true, tripId: trip.id, leg: l }); }}
                                      >
                                        {t("edit")}
                                      </button>
                                    </div>
                                  </div>
                                  {(l.startTag || l.endTag) && <div className="text-xs font-medium text-lime-700 bg-lime-50 inline-block px-1.5 rounded my-0.5">{l.startTag}{l.startTag && l.endTag ? " → " : ""}{l.endTag}</div>}
                                  <div className="text-xs text-neutral-500">
                                    {l.startTime} - {l.endTime} • Odo: {l.odoStart} - {l.odoEnd}
                                  </div>
                                  {l.note && <div className="text-xs text-neutral-500 italic">"{l.note}"</div>}
                                </div>
                              ))}
                              <div className="pt-2 flex justify-end">
                                <button 
                                  className="text-[10px] font-black uppercase tracking-wider text-red-600 hover:text-red-800 px-2 py-1 border-2 border-red-100 bg-red-50 rounded-sm transition"
                                  onClick={(e) => { e.stopPropagation(); deleteTrip(trip.id); }}
                                >
                                  {t("delete")}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              )}
            </div>

            {/* 3. Fuel (Updated Workflow) */}
            <div className={card}>
              <div 
                className={`${cardHead} flex items-center justify-between cursor-pointer transition select-none ${fuelSectionOpen ? "bg-[var(--ts-accent)]" : "hover:bg-[var(--ts-accent)]"}`}
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
                  <div className="text-sm text-neutral-700">{t("selectVehicleFuel")}</div>
                ) : (
                  <>
                    {/* Fuel Form */}
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 mb-4 p-3">
                      <div className="font-semibold text-neutral-800 mb-2 text-xs">
                        {editingFuelId ? t("editFuel") : t("addFuel")}
                      </div>
                      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
                        <div>
                          <label className="text-[10px] font-medium text-neutral-500">{t("date")}</label>
                          <input type="date" className={inputCompact} value={fuelForm.date} onChange={(e) => setFuelForm({ ...fuelForm, date: e.target.value })} />
                        </div>

                        <div>
                          <label className="text-[10px] font-medium text-neutral-500">{t("odometer")}</label>
                          <input
                            className={`${inputCompact} text-right tabular-nums`}
                            inputMode="decimal"
                            value={fuelForm.odometer}
                            onChange={(e) => setFuelForm({ ...fuelForm, odometer: e.target.value })}
                            placeholder="km"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-medium text-neutral-500">{t("station")}</label>
                          <input className={inputCompact} value={fuelForm.station} onChange={(e) => setFuelForm({ ...fuelForm, station: e.target.value })} placeholder={t("optional")} />
                        </div>

                        <div>
                          <label className="text-[10px] font-medium text-neutral-500">{t("liters")}</label>
                          <input
                            className={`${inputCompact} text-right tabular-nums`}
                            inputMode="decimal"
                            value={fuelForm.liters}
                            onChange={(e) => setFuelForm({ ...fuelForm, liters: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-medium text-neutral-500">{t("totalCost")}</label>
                          <input
                            className={`${inputCompact} text-right tabular-nums`}
                            inputMode="decimal"
                            value={fuelForm.totalCost}
                            onChange={(e) => setFuelForm({ ...fuelForm, totalCost: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-medium text-neutral-500">{t("currency")}</label>
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
                          <label className="text-[10px] font-medium text-neutral-500">{t("notes")}</label>
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
                          {editingFuelId ? t("update") : t("add")}
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
                        <div className="mt-2 overflow-x-auto rounded-xl border border-neutral-200">
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
                                  <tr key={f.id} className="hover:bg-neutral-50 transition">
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
                        <Pill>{fuelTotals.count} fill(s)</Pill>
                        <Pill tone="accent">{money(fuelTotals.spend, fuelTotals.currency)}</Pill>
                        <Pill>{fuelTotals.liters.toFixed(2)} L</Pill>
                        <Pill>{fuelTotals.avgPerLiter ? `${fuelTotals.avgPerLiter.toFixed(3)} /L` : "0.000 /L"}</Pill>
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
                className={`${cardHead} flex items-center justify-between cursor-pointer transition select-none ${washSectionOpen ? "bg-[var(--ts-accent)]" : "hover:bg-[var(--ts-accent)]"}`}
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
                    <div className="text-sm text-neutral-700">{t("selectVehicleWash")}</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                        <div>
                          <label className="text-[10px] font-medium text-neutral-500 uppercase">{t("date")}</label>
                          <input type="date" className={`${inputBase} py-1 text-xs h-8`} value={washForm.date} onChange={e => setWashForm({...washForm, date: e.target.value})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-neutral-500 uppercase">{t("type")}</label>
                          <select className={`${inputBase} py-1 text-xs h-8`} value={washForm.type} onChange={e => setWashForm({...washForm, type: e.target.value})}>
                            <option>Quick</option>
                            <option>Full</option>
                            <option>Interior</option>
                            <option>Exterior</option>
                            <option>Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-neutral-500 uppercase">{t("location")}</label>
                          <input className={`${inputBase} py-1 text-xs h-8`} placeholder={t("optional")} value={washForm.location} onChange={e => setWashForm({...washForm, location: e.target.value})} />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-neutral-500 uppercase">{t("note")}</label>
                          <input className={`${inputBase} py-1 text-xs h-8`} placeholder={t("optional")} value={washForm.note} onChange={e => setWashForm({...washForm, note: e.target.value})} />
                        </div>
                        <div className="flex items-end gap-1">
                          <div className="w-14">
                            <label className="text-[10px] font-medium text-neutral-500 uppercase">{t("cost")}</label>
                            <input className={`${inputBase} py-1 text-xs h-8 text-right`} placeholder="0.00" inputMode="decimal" value={washForm.cost} onChange={e => setWashForm({...washForm, cost: e.target.value})} />
                          </div>
                          <button className={`${btnAccent} h-8 px-3 py-0 text-[10px]`} onClick={saveWash}>{editingWashId ? t("upd") : t("add")}</button>
                          {editingWashId && <button className={`${btnSecondary} h-8 px-2 py-0 text-[10px]`} onClick={cancelEditWash}>✕</button>}
                        </div>
                      </div>

                      {washLogs.length > 0 && (
                        <div className="overflow-x-auto border-t border-neutral-100 pt-2">
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
                                <tr key={w.id} className="hover:bg-neutral-50">
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
