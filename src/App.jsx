import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * ToolStack — Trip-It (Duty Trip Log) — Styled v1.1 (Module-ready)
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

// Optional: set later
const HUB_URL = "https://YOUR-WIX-HUB-URL-HERE";

// Master accent
const ACCENT = "#D5FF00"; // rgb(213,255,0)
const ACCENT_RGB = "213 255 0";

const uid = () => {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    // ignore
  }
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
};

const safeParse = (s, fallback) => {
  try {
    const v = JSON.parse(s);
    return v ?? fallback;
  } catch {
    return fallback;
  }
};

const safeStorageGet = (key) => {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeStorageSet = (key, value) => {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
};

const safeStorageRemove = (key) => {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  } catch {
    // ignore
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

const monthLabel = (ym) => {
  const [y, m] = String(ym || "").split("-");
  if (!y || !m) return String(ym || "");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long" });
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
  "print:hidden h-10 rounded-xl border px-3 shadow-sm active:translate-y-[1px] transition flex items-center justify-center min-w-0 " +
  "text-[13px] sm:text-sm font-medium";

// Match the "?" Help hover (accent tint + accent border)
const HOVER_ACCENT = "hover:bg-[rgb(var(--ts-accent-rgb)/0.25)] hover:border-[var(--ts-accent)]";

function ActionButton({ children, onClick, tone = "default", disabled, title }) {
  const cls =
    tone === "primary"
      ? `bg-neutral-700 text-white border-neutral-700 ${HOVER_ACCENT} hover:text-neutral-800`
      : tone === "danger"
      ? "bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
      : `bg-white text-neutral-700 border-neutral-200 ${HOVER_ACCENT}`;

  return (
    <button type="button" onClick={onClick} title={title} disabled={disabled} className={`${ACTION_BASE} ${cls}`}>
      <span className="truncate w-full text-center">{children}</span>
    </button>
  );
}

// ---------- Help Pack v1 (Canonical) ----------
function HelpModal({ open, onClose, appName = "ToolStack App", storageKey = "(unknown)", actions = [] }) {
  if (!open) return null;

  const Card = ({ title, children }) => (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-2">
      <div className="text-sm font-semibold text-neutral-800">{title}</div>
      <div className="text-sm text-neutral-700 leading-relaxed space-y-2">{children}</div>
    </div>
  );

  const Bullet = ({ children }) => <li className="ml-4 list-disc">{children}</li>;

  const baseActions = [
    { name: "Preview", desc: "Open a clean report sheet inside the app (print-safe)." },
    { name: "Print / Save PDF", desc: "Use your browser print dialog to print or save a PDF." },
    { name: "Export", desc: "Download a JSON backup of your saved data." },
    { name: "Import", desc: "Load a JSON backup (replaces current saved data)." },
  ];

  const extra = (actions || []).map((a) => {
    const low = String(a).toLowerCase();
    return {
      name: a,
      desc: low.includes("csv")
        ? "Download a CSV file for Excel / Google Sheets."
        : low.includes("email")
        ? "Open your email app with a pre-filled report."
        : "Extra tool for this app.",
    };
  });

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white shadow-xl overflow-hidden">
          <div className="p-4 border-b border-neutral-100 flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-neutral-500">ToolStack • Help Pack v1</div>
              <h2 className="text-lg font-semibold text-neutral-800">{appName} — how your data works</h2>
              <div className="mt-3">
                <AccentUnderline className="w-56" />
              </div>
            </div>

            <button
              type="button"
              className="print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-[rgb(var(--ts-accent-rgb)/0.25)] hover:border-[var(--ts-accent)] text-neutral-800 transition"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          <div className="p-4 space-y-3 max-h-[70vh] overflow-auto">
            <Card title="Quick start">
              <ul className="space-y-1">
                <Bullet>Use the app normally — it autosaves as you type.</Bullet>
                <Bullet>
                  Use <b>Preview</b> → then <b>Print / Save PDF</b> for a clean report.
                </Bullet>
                <Bullet>
                  Use <b>Export</b> regularly to create backups.
                </Bullet>
              </ul>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card title="Where your data lives">
                <p>
                  Your data is stored in your browser on <b>this device</b> (localStorage). No login required.
                </p>
                <ul className="space-y-1">
                  <Bullet>Switching device/browser will not carry your data over automatically.</Bullet>
                  <Bullet>Incognito/private mode may not persist data.</Bullet>
                </ul>
              </Card>

              <Card title="Backup routine">
                <ul className="space-y-1">
                  <Bullet>
                    Export after big changes, or at least <b>weekly</b>.
                  </Bullet>
                  <Bullet>Keep 2–3 older exports as fallback.</Bullet>
                  <Bullet>Save exports to Drive/Dropbox/OneDrive (or email to yourself).</Bullet>
                </ul>
              </Card>
            </div>

            <Card title="Restore / move to a new device (Import)">
              <p>
                On a new device/browser (or after clearing site data), click <b>Import</b> and choose your latest exported JSON.
              </p>
              <ul className="space-y-1">
                <Bullet>Import replaces the current saved data with the file contents.</Bullet>
                <Bullet>If an import fails, try an older export (versions can differ).</Bullet>
              </ul>
            </Card>

            <Card title="Buttons glossary (same meaning across ToolStack)">
              <div className="rounded-2xl border border-neutral-200 bg-white px-3">
                {[...baseActions, ...extra].map((a) => (
                  <div
                    key={a.name}
                    className="flex items-start justify-between gap-4 py-2 border-b border-neutral-100 last:border-b-0"
                  >
                    <div className="text-sm font-medium text-neutral-800">{a.name}</div>
                    <div className="text-sm text-neutral-600 text-right">{a.desc}</div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card title="What can erase local data">
                <ul className="space-y-1">
                  <Bullet>Clearing browser history / site data.</Bullet>
                  <Bullet>“Cleaner/optimizer” tools.</Bullet>
                  <Bullet>Different browser profile or reinstall.</Bullet>
                </ul>
              </Card>

              <Card title="Storage key (for troubleshooting)">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                  <span className="font-medium">localStorage key:</span> <span className="font-mono">{storageKey}</span>
                </div>
                <p className="text-xs text-neutral-600">
                  Tip: If data looks “missing”, it’s usually a different device/browser/profile or cleared site data.
                </p>
              </Card>
            </div>

            <Card title="Privacy">
              <p>
                By default, your data stays on your device. It only leaves your device if you export it or share it yourself.
              </p>
            </Card>
          </div>

          <div className="p-4 border-t border-neutral-100 flex items-center justify-end gap-2">
            <button
              type="button"
              className="print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-[rgb(var(--ts-accent-rgb)/0.25)] hover:border-[var(--ts-accent)] text-neutral-800 transition"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- UI helpers ----------
const btnSecondary =
  "print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white text-neutral-800 shadow-sm " +
  "active:translate-y-[1px] transition disabled:opacity-50 disabled:cursor-not-allowed " +
  HOVER_ACCENT;

const btnPrimary =
  "print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-neutral-700 bg-neutral-700 text-white shadow-sm " +
  "active:translate-y-[1px] transition disabled:opacity-50 disabled:cursor-not-allowed " +
  HOVER_ACCENT +
  " hover:text-neutral-800";

// Accent (green) button (requested: green with dark-grey text)
const btnAccent =
  "print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-[var(--ts-accent)] bg-[var(--ts-accent)] text-neutral-800 shadow-sm " +
  "active:translate-y-[1px] transition disabled:opacity-50 disabled:cursor-not-allowed " +
  "hover:bg-[rgb(var(--ts-accent-rgb)/0.85)]";

const inputBase =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400/25 focus:border-neutral-300";
const card = "rounded-2xl bg-white border border-neutral-200 shadow-sm";
const cardHead = "px-4 py-3 border-b border-neutral-100";
const cardPad = "p-4";

function Pill({ children, tone = "default" }) {
  const cls =
    tone === "accent"
      ? "border-lime-200 bg-lime-50 text-neutral-800"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-neutral-800"
      : "border-neutral-200 bg-white text-neutral-800";
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}>{children}</span>;
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
            className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-[rgb(var(--ts-accent-rgb)/0.25)] hover:border-[var(--ts-accent)] text-neutral-800 transition"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-xl text-sm font-medium border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 transition"
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
              className="print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-[rgb(var(--ts-accent-rgb)/0.25)] hover:border-[var(--ts-accent)] text-neutral-800 transition"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          <div className="p-4 space-y-3 max-h-[70vh] overflow-auto">
            <div>
              <label className="text-sm font-medium text-neutral-700">To</label>
              <input
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400/25 focus:border-neutral-300 mt-2"
                value={to}
                onChange={(e) => onChangeTo?.(e.target.value)}
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
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400/25 focus:border-neutral-300 mt-2 min-h-[220px]"
                value={body}
                onChange={(e) => onChangeBody?.(e.target.value)}
              />
            </div>
          </div>

          <div className="p-4 border-t border-neutral-100 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className="print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-[rgb(var(--ts-accent-rgb)/0.25)] hover:border-[var(--ts-accent)] text-neutral-800 transition"
              onClick={onCopy}
            >
              Copy
            </button>
            <button
              type="button"
              className="print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-neutral-700 bg-neutral-700 text-white hover:bg-[rgb(var(--ts-accent-rgb)/0.25)] hover:border-[var(--ts-accent)] hover:text-neutral-800 transition"
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

// ---------- Month Picker (Trip-It style) ----------
function MonthPicker({ value, onChange, disabled }) {
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
    onChange?.(`${year}-${mm}`);
    setOpen(false);
  };

  const setThisMonth = () => {
    const mm = String(currentMonthNum).padStart(2, "0");
    onChange?.(`${currentYear}-${mm}`);
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
          <span className="truncate">{monthLabel(value)}</span>
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
                  <div className="text-lg font-semibold text-neutral-800">Select month</div>
                  <div className="mt-3">
                    <AccentUnderline className="w-44" />
                  </div>
                </div>
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-[rgb(var(--ts-accent-rgb)/0.25)] hover:border-[var(--ts-accent)] text-neutral-800 transition"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-neutral-700">Year</div>
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
                        className={
                          "h-10 rounded-xl border text-sm font-medium transition " +
                          (active
                            ? "border-neutral-700 bg-neutral-700 text-white"
                            : "border-neutral-200 bg-white hover:bg-[rgb(var(--ts-accent-rgb)/0.25)] hover:border-[var(--ts-accent)] text-neutral-700")
                        }
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
                    className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-[rgb(var(--ts-accent-rgb)/0.25)] hover:border-[var(--ts-accent)] text-neutral-800 transition"
                    onClick={setThisMonth}
                  >
                    This month
                  </button>
                  <div className="text-sm text-neutral-600">
                    Selected: <span className="font-medium text-neutral-800">{monthLabel(value)}</span>
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
    tripsByVehicle: {},
    fuelByVehicle: {},
    ui: { month: monthKey(todayISO()) },
  };
}

function normalizeApp(raw) {
  const base = emptyApp();
  const a = raw && typeof raw === "object" ? raw : base;

  const vehicles = Array.isArray(a.vehicles) ? a.vehicles.filter(Boolean) : [];
  const tripsByVehicle = a.tripsByVehicle && typeof a.tripsByVehicle === "object" ? a.tripsByVehicle : {};
  const fuelByVehicle = a.fuelByVehicle && typeof a.fuelByVehicle === "object" ? a.fuelByVehicle : {};
  const ui = a.ui && typeof a.ui === "object" ? a.ui : base.ui;

  const normVehicles = vehicles.map((v) => ({
    id: v.id || uid(),
    name: String(v.name ?? "").trim(),
    make: String(v.make ?? "").trim(),
    model: String(v.model ?? "").trim(),
    plate: String(v.plate ?? "").trim(),
    vin: String(v.vin ?? "").trim(),
    notes: String(v.notes ?? ""),
  }));

  const normTripsByVehicle = {};
  const normFuelByVehicle = {};

  for (const v of normVehicles) {
    const list = Array.isArray(tripsByVehicle[v.id]) ? tripsByVehicle[v.id] : [];
    normTripsByVehicle[v.id] = list
      .filter(Boolean)
      .map((t) => {
        const odoStart = t.odoStart ?? "";
        const odoEnd = t.odoEnd ?? "";
        const dist =
          t.distance != null && t.distance !== ""
            ? toNumber(t.distance)
            : Math.max(0, toNumber(odoEnd) - toNumber(odoStart));

        return {
          id: t.id || uid(),
          date: typeof t.date === "string" && t.date ? t.date : todayISO(),
          from: String(t.from ?? ""),
          to: String(t.to ?? ""),
          purpose: String(t.purpose ?? ""),
          driver: String(t.driver ?? ""),
          passengers: String(t.passengers ?? ""),
          odoStart,
          odoEnd,
          distance: dist,
          costs: {
            fuel: t.costs?.fuel ?? 0,
            tolls: t.costs?.tolls ?? 0,
            parking: t.costs?.parking ?? 0,
            other: t.costs?.other ?? 0,
            currency: String(t.costs?.currency ?? "EUR") || "EUR",
          },
          notes: String(t.notes ?? ""),
        };
      });

    const flist = Array.isArray(fuelByVehicle[v.id]) ? fuelByVehicle[v.id] : [];
    normFuelByVehicle[v.id] = flist
      .filter(Boolean)
      .map((f) => ({
        id: f.id || uid(),
        date: typeof f.date === "string" && f.date ? f.date : todayISO(),
        odometer: f.odometer ?? "",
        liters: f.liters ?? 0,
        totalCost: f.totalCost ?? 0,
        currency: String(f.currency ?? "EUR") || "EUR",
        fullTank: !!f.fullTank,
        station: String(f.station ?? ""),
        notes: String(f.notes ?? ""),
      }));
  }

  let activeVehicleId = a.activeVehicleId || null;
  if (activeVehicleId && !normVehicles.some((x) => x.id === activeVehicleId)) activeVehicleId = null;
  if (!activeVehicleId && normVehicles.length) activeVehicleId = normVehicles[0].id;

  const month = typeof ui.month === "string" && ui.month ? ui.month : base.ui.month;

  return {
    vehicles: normVehicles,
    activeVehicleId,
    tripsByVehicle: normTripsByVehicle,
    fuelByVehicle: normFuelByVehicle,
    ui: { month },
  };
}

// Legacy migration (best-effort): if old format has `trips`, migrate into one Imported vehicle.
function migrateLegacyIfNeeded(saved) {
  if (!saved || typeof saved !== "object") return null;
  if (Array.isArray(saved.vehicles) || saved.tripsByVehicle) return saved;

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

  const normTrips = legacyTrips
    .filter(Boolean)
    .map((t) => {
      const odoStart = t.odoStart ?? t.odometerStart ?? "";
      const odoEnd = t.odoEnd ?? t.odometerEnd ?? "";
      const dist =
        t.distance != null && t.distance !== ""
          ? toNumber(t.distance)
          : Math.max(0, toNumber(odoEnd) - toNumber(odoStart));

      return {
        id: t.id || uid(),
        date: typeof t.date === "string" && t.date ? t.date : todayISO(),
        from: String(t.from ?? t.start ?? ""),
        to: String(t.to ?? t.end ?? ""),
        purpose: String(t.purpose ?? ""),
        driver: String(t.driver ?? ""),
        passengers: String(t.passengers ?? ""),
        odoStart,
        odoEnd,
        distance: dist,
        costs: {
          fuel: t.costs?.fuel ?? t.fuel ?? 0,
          tolls: t.costs?.tolls ?? t.tolls ?? 0,
          parking: t.costs?.parking ?? t.parking ?? 0,
          other: t.costs?.other ?? t.other ?? 0,
          currency: String(t.costs?.currency ?? "EUR") || "EUR",
        },
        notes: String(t.notes ?? ""),
      };
    });

  return {
    vehicles: [importedVehicle],
    activeVehicleId: vid,
    tripsByVehicle: { [vid]: normTrips },
    fuelByVehicle: { [vid]: [] },
    ui: { month: monthKey(todayISO()) },
  };
}

export default function App() {
  const importInputRef = useRef(null);

  const [profile, setProfile] = useState(loadProfile);

  const [app, setApp] = useState(() => {
    const raw = safeStorageGet(KEY) ?? safeStorageGet(LEGACY_LS_KEY) ?? null;
    const saved = raw ? safeParse(raw, null) : null;
    const migrated = migrateLegacyIfNeeded(saved);
    const norm = normalizeApp(migrated ?? emptyApp());

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

  // Dev-only sanity checks (do not run unless enabled)
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const qs = new URLSearchParams(window.location.search);
      const enabled = !!window.__TOOLSTACK_DEV_TESTS__ || qs.get("tests") === "1";
      if (!enabled) return;

      console.assert(toNumber("1,5") === 1.5, "toNumber should accept comma decimals");
      console.assert(toNumber("abc") === 0, "toNumber should default non-numeric to 0");
      console.assert(monthKey("2026-01-04") === "2026-01", "monthKey should format YYYY-MM");
      console.assert(String(monthLabel("2026-01") || "").length > 0, "monthLabel should return a readable label");
      console.assert(safeParse('{"a":1}', null)?.a === 1, "safeParse should parse JSON");
      console.assert(safeParse("{bad}", { ok: true })?.ok === true, "safeParse should return fallback on error");
      const u = uid();
      console.assert(typeof u === "string" && u.length > 6, "uid should be a string");

      const norm = normalizeApp({ vehicles: [{ id: "v1", name: "X" }], activeVehicleId: "v1" });
      console.assert(Array.isArray(norm.vehicles) && norm.vehicles.length === 1, "normalizeApp should keep vehicles");

      const legacy = migrateLegacyIfNeeded({ trips: [{ date: "2026-01-01", from: "A", to: "B", odoStart: 0, odoEnd: 10 }] });
      console.assert(legacy?.vehicles?.length === 1, "migrateLegacyIfNeeded should create one imported vehicle");

      console.assert(money(1, "EUR").includes("€"), "money should include € for EUR");
    } catch {
      // ignore
    }
  }, []);

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [emailModal, setEmailModal] = useState({ open: false, to: "", subject: "", body: "" });

  const [vehicleModal, setVehicleModal] = useState({ open: false, mode: "new", vehicleId: null });
  const [confirm, setConfirm] = useState({ open: false, kind: null, id: null });
  const [importConfirm, setImportConfirm] = useState({ open: false, file: null });

  const notify = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  };

  useEffect(() => {
    safeStorageSet(KEY, JSON.stringify(app));
  }, [app]);

  useEffect(() => {
    safeStorageSet(PROFILE_KEY, JSON.stringify(profile));
  }, [profile]);

  const activeVehicle = useMemo(
    () => app.vehicles.find((v) => v.id === app.activeVehicleId) || null,
    [app.vehicles, app.activeVehicleId]
  );

  const trips = useMemo(() => {
    if (!activeVehicle) return [];
    return Array.isArray(app.tripsByVehicle[activeVehicle.id]) ? app.tripsByVehicle[activeVehicle.id] : [];
  }, [app.tripsByVehicle, activeVehicle]);

  const fuelLogs = useMemo(() => {
    if (!activeVehicle) return [];
    return Array.isArray(app.fuelByVehicle[activeVehicle.id]) ? app.fuelByVehicle[activeVehicle.id] : [];
  }, [app.fuelByVehicle, activeVehicle]);

  const tripsForMonth = useMemo(() => {
    const m = app.ui.month;
    return trips.filter((t) => monthKey(t.date) === m).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [trips, app.ui.month]);

  const fuelForMonth = useMemo(() => {
    const m = app.ui.month;
    return fuelLogs.filter((f) => monthKey(f.date) === m).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [fuelLogs, app.ui.month]);

  const tripTotals = useMemo(() => {
    const distance = tripsForMonth.reduce((s, t) => s + toNumber(t.distance), 0);
    const fuel = tripsForMonth.reduce((s, t) => s + toNumber(t.costs?.fuel), 0);
    const tolls = tripsForMonth.reduce((s, t) => s + toNumber(t.costs?.tolls), 0);
    const parking = tripsForMonth.reduce((s, t) => s + toNumber(t.costs?.parking), 0);
    const other = tripsForMonth.reduce((s, t) => s + toNumber(t.costs?.other), 0);
    const currency = tripsForMonth.find((t) => t.costs?.currency)?.costs?.currency || "EUR";
    const totalCost = fuel + tolls + parking + other;
    return { distance, fuel, tolls, parking, other, totalCost, currency, count: tripsForMonth.length };
  }, [tripsForMonth]);

  const fuelTotals = useMemo(() => {
    const liters = fuelForMonth.reduce((s, f) => s + toNumber(f.liters), 0);
    const spend = fuelForMonth.reduce((s, f) => s + toNumber(f.totalCost), 0);
    const currency = fuelForMonth.find((f) => f.currency)?.currency || "EUR";
    const avgPerLiter = liters > 0 ? spend / liters : 0;
    return { liters, spend, currency, avgPerLiter, count: fuelForMonth.length };
  }, [fuelForMonth]);

  const setMonth = (m) => setApp((a) => ({ ...a, ui: { ...a.ui, month: m } }));

  // ---------- Vehicle CRUD ----------
  const openNewVehicle = () => setVehicleModal({ open: true, mode: "new", vehicleId: null });

  const saveVehicle = (vehicle) => {
    setApp((a) => {
      const exists = a.vehicles.some((v) => v.id === vehicle.id);
      const vehicles = exists ? a.vehicles.map((v) => (v.id === vehicle.id ? vehicle : v)) : [vehicle, ...a.vehicles];
      const tripsByVehicle = { ...a.tripsByVehicle };
      const fuelByVehicle = { ...a.fuelByVehicle };
      if (!tripsByVehicle[vehicle.id]) tripsByVehicle[vehicle.id] = [];
      if (!fuelByVehicle[vehicle.id]) fuelByVehicle[vehicle.id] = [];
      const activeVehicleId = a.activeVehicleId || vehicle.id;
      return normalizeApp({ ...a, vehicles, tripsByVehicle, fuelByVehicle, activeVehicleId });
    });
    setVehicleModal({ open: false, mode: "new", vehicleId: null });
    notify("Vehicle saved");
  };

  const deleteVehicleNow = () => {
    const id = confirm.id;
    setApp((a) => {
      const vehicles = a.vehicles.filter((v) => v.id !== id);
      const tripsByVehicle = { ...a.tripsByVehicle };
      const fuelByVehicle = { ...a.fuelByVehicle };
      delete tripsByVehicle[id];
      delete fuelByVehicle[id];

      let activeVehicleId = a.activeVehicleId;
      if (activeVehicleId === id) activeVehicleId = vehicles.length ? vehicles[0].id : null;

      return normalizeApp({ ...a, vehicles, tripsByVehicle, fuelByVehicle, activeVehicleId });
    });
    setConfirm({ open: false, kind: null, id: null });
    notify("Vehicle deleted");
  };

  const selectVehicle = (id) => setApp((a) => ({ ...a, activeVehicleId: id }));

  // ---------- Trip CRUD ----------
  const addTrip = () => {
    if (!activeVehicle) return notify("Add a vehicle first");
    const t = {
      id: uid(),
      date: todayISO(),
      from: "",
      to: "",
      purpose: "",
      driver: "",
      passengers: "",
      odoStart: "",
      odoEnd: "",
      distance: 0,
      costs: { fuel: 0, tolls: 0, parking: 0, other: 0, currency: "EUR" },
      notes: "",
    };
    setApp((a) => {
      const list = Array.isArray(a.tripsByVehicle[activeVehicle.id]) ? a.tripsByVehicle[activeVehicle.id] : [];
      return { ...a, tripsByVehicle: { ...a.tripsByVehicle, [activeVehicle.id]: [t, ...list] } };
    });
    notify("Trip added");
  };

  const updateTrip = (tripId, patch) => {
    if (!activeVehicle) return;
    setApp((a) => {
      const list = Array.isArray(a.tripsByVehicle[activeVehicle.id]) ? a.tripsByVehicle[activeVehicle.id] : [];
      const next = list.map((t) => {
        if (t.id !== tripId) return t;
        const merged = { ...t, ...patch };
        merged.costs = { ...t.costs, ...patch.costs };

        const dist = Math.max(0, toNumber(merged.odoEnd) - toNumber(merged.odoStart));
        merged.distance = dist;

        return merged;
      });
      return { ...a, tripsByVehicle: { ...a.tripsByVehicle, [activeVehicle.id]: next } };
    });
  };

  const deleteTrip = (tripId) => {
    if (!activeVehicle) return;
    setApp((a) => {
      const list = Array.isArray(a.tripsByVehicle[activeVehicle.id]) ? a.tripsByVehicle[activeVehicle.id] : [];
      return { ...a, tripsByVehicle: { ...a.tripsByVehicle, [activeVehicle.id]: list.filter((t) => t.id !== tripId) } };
    });
    notify("Trip deleted");
  };

  // ---------- Fuel CRUD ----------
  const addFuel = () => {
    if (!activeVehicle) return notify("Add a vehicle first");
    const f = {
      id: uid(),
      date: todayISO(),
      odometer: "",
      liters: 0,
      totalCost: 0,
      currency: "EUR",
      fullTank: true,
      station: "",
      notes: "",
    };
    setApp((a) => {
      const list = Array.isArray(a.fuelByVehicle[activeVehicle.id]) ? a.fuelByVehicle[activeVehicle.id] : [];
      return { ...a, fuelByVehicle: { ...a.fuelByVehicle, [activeVehicle.id]: [f, ...list] } };
    });
    notify("Fuel entry added");
  };

  const updateFuel = (fuelId, patch) => {
    if (!activeVehicle) return;
    setApp((a) => {
      const list = Array.isArray(a.fuelByVehicle[activeVehicle.id]) ? a.fuelByVehicle[activeVehicle.id] : [];
      const next = list.map((f) => (f.id === fuelId ? { ...f, ...patch } : f));
      return { ...a, fuelByVehicle: { ...a.fuelByVehicle, [activeVehicle.id]: next } };
    });
  };

  const deleteFuel = (fuelId) => {
    if (!activeVehicle) return;
    setApp((a) => {
      const list = Array.isArray(a.fuelByVehicle[activeVehicle.id]) ? a.fuelByVehicle[activeVehicle.id] : [];
      return { ...a, fuelByVehicle: { ...a.fuelByVehicle, [activeVehicle.id]: list.filter((f) => f.id !== fuelId) } };
    });
    notify("Fuel entry deleted");
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
    setApp(normalizeApp(migrated ?? emptyApp()));
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

  const openPreview = () => {
    if (!activeVehicle) return notify("Select a vehicle first");
    setPreviewOpen(true);
  };

  // ---------- Email ----------
  const buildEmail = () => {
    const vName = activeVehicle?.name || "(no vehicle)";
    const mLabel = monthLabel(app.ui.month);
    const subject = `Trip-It report — ${vName} — ${mLabel}`;

    const lines = [];
    lines.push(`${profile.org || "ToolStack"}`);
    lines.push(`Trip-It report`);
    lines.push(`Vehicle: ${vName}`);
    lines.push(`Month: ${mLabel} (${app.ui.month})`);
    if (profile.user) lines.push(`Prepared by: ${profile.user}`);
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push("");
    lines.push("Summary");
    lines.push(`- Trips: ${tripTotals.count}`);
    lines.push(`- Distance: ${tripTotals.distance.toFixed(1)} km`);
    lines.push(`- Fuel spend: ${money(fuelTotals.spend, fuelTotals.currency)} (${fuelTotals.liters.toFixed(2)} L)`);
    lines.push("");

    lines.push("For full details, use Export (JSON) or CSV.");

    return { subject, body: lines.join("\n") };
  };

  const openEmail = () => {
    if (!activeVehicle) return notify("Select a vehicle first");
    const built = buildEmail();
    setEmailModal((m) => ({ ...m, open: true, subject: built.subject, body: built.body }));
  };

  const copyEmail = async () => {
    try {
      const text = `Subject: ${emailModal.subject}\n\n${emailModal.body}`;
      if (navigator?.clipboard?.writeText) {
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

  const vehicleSaveDisabled = useMemo(() => !String(vehicleDraft?.name || "").trim(), [vehicleDraft]);

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
            body * { visibility: hidden !important; }
            #tripit-print, #tripit-print * { visibility: visible !important; }
            #tripit-print { position: absolute !important; left: 0; top: 0; width: 100%; }
          }
        `}</style>
      ) : null}

      <ConfirmModal
        open={confirm.open && confirm.kind === "vehicle"}
        title="Delete vehicle?"
        message="This will delete the vehicle and all trips + fuel logs saved under it."
        onCancel={() => setConfirm({ open: false, kind: null, id: null })}
        onConfirm={deleteVehicleNow}
      />

      <ConfirmModal
        open={importConfirm.open}
        title="Import backup?"
        message="Import replaces your current saved data with the file contents. Tip: Export first if you want a backup of what’s currently here."
        confirmText="Import"
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
        subject={emailModal.subject}
        body={emailModal.body}
        onClose={() => setEmailModal((m) => ({ ...m, open: false }))}
        onChangeTo={(v) => setEmailModal((m) => ({ ...m, to: v }))}
        onChangeBody={(v) => setEmailModal((m) => ({ ...m, body: v }))}
        onCopy={copyEmail}
        onOpenEmail={openEmailClientFromModal}
      />

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} appName="Trip-It" storageKey={KEY} actions={["Email"]} />

      {/* Hidden file input for Import button */}
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] || null;
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
                <div className="text-lg font-semibold text-neutral-800">{vehicleModal.mode === "new" ? "Add vehicle" : "Edit vehicle"}</div>
                <div className="text-sm text-neutral-700 mt-1">Trips + fuel logs are stored per vehicle.</div>
                <div className="mt-3">
                  <AccentUnderline className="w-52" />
                </div>
              </div>
              <button className={btnSecondary} onClick={() => setVehicleModal({ open: false, mode: "new", vehicleId: null })}>
                Close
              </button>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-neutral-700">Vehicle name *</label>
                <input
                  className={`${inputBase} mt-2`}
                  value={vehicleDraft?.name ?? ""}
                  onChange={(e) => setVehicleDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="e.g., BMW 530i (Consulate)"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700">Make</label>
                <input
                  className={`${inputBase} mt-2`}
                  value={vehicleDraft?.make ?? ""}
                  onChange={(e) => setVehicleDraft((d) => ({ ...d, make: e.target.value }))}
                  placeholder="e.g., BMW"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700">Model</label>
                <input
                  className={`${inputBase} mt-2`}
                  value={vehicleDraft?.model ?? ""}
                  onChange={(e) => setVehicleDraft((d) => ({ ...d, model: e.target.value }))}
                  placeholder="e.g., 530i"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700">Plate</label>
                <input
                  className={`${inputBase} mt-2`}
                  value={vehicleDraft?.plate ?? ""}
                  onChange={(e) => setVehicleDraft((d) => ({ ...d, plate: e.target.value }))}
                  placeholder="e.g., M-AB 1234"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700">VIN</label>
                <input
                  className={`${inputBase} mt-2`}
                  value={vehicleDraft?.vin ?? ""}
                  onChange={(e) => setVehicleDraft((d) => ({ ...d, vin: e.target.value }))}
                  placeholder="optional"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-neutral-700">Notes</label>
                <textarea
                  className={`${inputBase} mt-2 min-h-[90px]`}
                  value={vehicleDraft?.notes ?? ""}
                  onChange={(e) => setVehicleDraft((d) => ({ ...d, notes: e.target.value }))}
                  placeholder="optional"
                />
              </div>
            </div>

            <div className="p-4 border-t border-neutral-100 flex items-center justify-end gap-2">
              <button className={btnSecondary} onClick={() => setVehicleModal({ open: false, mode: "new", vehicleId: null })}>
                Cancel
              </button>
              <button
                className={`${btnPrimary} ${vehicleSaveDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={vehicleSaveDisabled}
                onClick={() => saveVehicle({ ...vehicleDraft, name: String(vehicleDraft?.name || "").trim() })}
              >
                Save vehicle
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Print Preview Modal */}
      {previewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPreviewOpen(false)} />
          <div className="relative w-full max-w-5xl">
            <div className="mb-3 rounded-2xl bg-white border border-neutral-200 shadow-sm p-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-neutral-500">ToolStack • Preview</div>
                <div className="text-lg font-semibold text-neutral-800">Trip-It preview</div>
                <div className="mt-3">
                  <AccentUnderline className="w-40" />
                </div>
                <div className="text-xs text-neutral-600 mt-2">Use your browser print (Ctrl+P / ⌘P) to print or save a PDF.</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className={btnPrimary}
                  onClick={() => {
                    try {
                      if (typeof window !== "undefined") window.print();
                    } catch {
                      // ignore
                    }
                  }}
                >
                  Print / save PDF
                </button>
                <button className={btnSecondary} onClick={() => setPreviewOpen(false)}>
                  Close
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-neutral-200 shadow-xl overflow-auto max-h-[80vh]">
              <div id="tripit-print" className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-2xl font-bold tracking-tight text-neutral-800">{profile.org || "ToolStack"}</div>
                    <div className="text-sm text-neutral-700">
                      Trip-It • {activeVehicle?.name || "(no vehicle)"} • {monthLabel(app.ui.month)}
                    </div>
                    {profile.user ? <div className="text-sm text-neutral-700">Prepared by: {profile.user}</div> : null}
                    <div className="mt-3">
                      <AccentUnderline className="w-72" />
                    </div>
                  </div>
                  <div className="text-sm text-neutral-700">Generated: {new Date().toLocaleString()}</div>
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="text-sm text-neutral-700">Trips</div>
                    <div className="text-2xl font-semibold text-neutral-800 mt-1">{tripTotals.count}</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="text-sm text-neutral-700">Distance</div>
                    <div className="text-2xl font-semibold text-neutral-800 mt-1">{tripTotals.distance.toFixed(1)} km</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="text-sm text-neutral-700">Fuel spend</div>
                    <div className="text-2xl font-semibold text-neutral-800 mt-1">{money(fuelTotals.spend, fuelTotals.currency)}</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="text-sm text-neutral-700">Fuel liters</div>
                    <div className="text-2xl font-semibold text-neutral-800 mt-1">{fuelTotals.liters.toFixed(2)} L</div>
                  </div>
                </div>

                <div className="mt-5 text-xs text-neutral-600">
                  Storage key: <span className="font-mono">{KEY}</span>
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
            <div className="text-4xl sm:text-5xl font-black tracking-tight text-neutral-700">
              <span>Trip</span>
              <span style={{ color: ACCENT }}>It</span>
            </div>
            <div className="mt-3">
              <AccentUnderline className="w-80" />
            </div>
            <div className="mt-2 text-sm text-neutral-700">Record your daily vehicle trips</div>
          </div>

          {/* Normalized top actions grid (with pinned help) */}
          <div className="w-full sm:w-[820px]">
            <div className="relative">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 pr-12">
                <ActionButton onClick={openHub} title="Return to ToolStack hub">
                  Hub
                </ActionButton>
                <ActionButton onClick={openPreview} disabled={!activeVehicle}>
                  Preview
                </ActionButton>
                <ActionButton onClick={exportJSON}>Export</ActionButton>
                <ActionButton onClick={onImportPick} title="Import JSON backup (replaces current data)">
                  Import
                </ActionButton>
                <ActionButton onClick={() => setHelpOpen(true)}>Help</ActionButton>
              </div>

              <button
                type="button"
                title="Help"
                onClick={() => setHelpOpen(true)}
                className={
                  "print:hidden absolute right-0 top-0 h-10 w-10 rounded-xl border border-neutral-200 bg-white shadow-sm " +
                  "flex items-center justify-center font-bold text-neutral-800 transition " +
                  "hover:bg-[rgb(var(--ts-accent-rgb)/0.25)] hover:border-[var(--ts-accent)]"
                }
                aria-label="Help"
              >
                ?
              </button>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Left: Vehicle + Month */}
          <div className="space-y-3">
            <div className={card}>
              <div className={`${cardHead} flex items-center justify-between`}>
                <div className="font-semibold text-neutral-800">Vehicle</div>
                <button className={btnAccent} onClick={openNewVehicle}>
                  + Add vehicle
                </button>
              </div>

              <div className={`${cardPad} space-y-3`}>
                <div>
                  <label className="text-sm font-medium text-neutral-700">Active vehicle</label>
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
                      No vehicles yet. Click <span className="font-medium">Add vehicle</span>.
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
                          Edit
                        </button>
                        <button
                          className="print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-red-200 bg-red-50 text-red-700 shadow-sm hover:bg-red-100 active:translate-y-[1px] transition"
                          onClick={() => setConfirm({ open: true, kind: "vehicle", id: activeVehicle.id })}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-neutral-700">Month</label>
                      <MonthPicker value={app.ui.month} onChange={setMonth} disabled={!activeVehicle} />
                    </div>

                    <div className="text-xs text-neutral-600">
                      Stored at <span className="font-mono">{KEY}</span> • Profile at <span className="font-mono">{PROFILE_KEY}</span>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            {/* Hide the “0 trips / Jan 2026 / etc” summary until a vehicle exists */}
            {activeVehicle ? (
              <div className={card}>
                <div className={cardHead}>
                  <div className="font-semibold text-neutral-800">Month summary</div>
                </div>
                <div className={`${cardPad} space-y-2`}>
                  <div className="flex flex-wrap gap-2">
                    <Pill>{tripTotals.count} trips</Pill>
                    <Pill>{tripTotals.distance.toFixed(1)} km</Pill>
                    <Pill tone="accent">{money(fuelTotals.spend, fuelTotals.currency)}</Pill>
                    <Pill>{fuelTotals.liters.toFixed(2)} L</Pill>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Right: Trips + Fuel */}
          <div className="lg:col-span-2 space-y-3">
            {/* Trips */}
            <div className={card}>
              <div className={`${cardHead} flex items-center justify-between gap-3`}>
                <div className="font-semibold text-neutral-800">Trips</div>
                <button
                  className={
                    activeVehicle
                      ? btnAccent
                      : "print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-neutral-100 text-neutral-400 shadow-sm cursor-not-allowed"
                  }
                  onClick={addTrip}
                  disabled={!activeVehicle}
                >
                  + Add trip
                </button>
              </div>

              <div className={`${cardPad} space-y-3`}>
                {!activeVehicle ? (
                  <div className="text-sm text-neutral-700">Add a vehicle to start logging trips.</div>
                ) : tripsForMonth.length === 0 ? (
                  <div className="text-sm text-neutral-700">No trips for this month yet.</div>
                ) : (
                  tripsForMonth.map((t) => (
                    <div key={t.id} className="rounded-2xl border border-neutral-200 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <div>
                          <label className="text-xs text-neutral-600 font-medium">Date</label>
                          <input
                            type="date"
                            className={`${inputBase} mt-2`}
                            value={t.date}
                            onChange={(e) => updateTrip(t.id, { date: e.target.value })}
                          />
                        </div>

                        <div className="md:col-span-3">
                          <label className="text-xs text-neutral-600 font-medium">Route</label>
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input className={inputBase} value={t.from} onChange={(e) => updateTrip(t.id, { from: e.target.value })} placeholder="From" />
                            <input className={inputBase} value={t.to} onChange={(e) => updateTrip(t.id, { to: e.target.value })} placeholder="To" />
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <label className="text-xs text-neutral-600 font-medium">Purpose</label>
                          <input className={`${inputBase} mt-2`} value={t.purpose} onChange={(e) => updateTrip(t.id, { purpose: e.target.value })} placeholder="Purpose" />
                        </div>

                        <div>
                          <label className="text-xs text-neutral-600 font-medium">Driver</label>
                          <input className={`${inputBase} mt-2`} value={t.driver} onChange={(e) => updateTrip(t.id, { driver: e.target.value })} placeholder="Driver" />
                        </div>

                        <div>
                          <label className="text-xs text-neutral-600 font-medium">Passengers</label>
                          <input className={`${inputBase} mt-2`} value={t.passengers} onChange={(e) => updateTrip(t.id, { passengers: e.target.value })} placeholder="Optional" />
                        </div>

                        <div>
                          <label className="text-xs text-neutral-600 font-medium">Odo start</label>
                          <input
                            className={`${inputBase} mt-2 text-right tabular-nums`}
                            inputMode="decimal"
                            value={t.odoStart ?? ""}
                            onChange={(e) => updateTrip(t.id, { odoStart: e.target.value })}
                            placeholder="0"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-neutral-600 font-medium">Odo end</label>
                          <input
                            className={`${inputBase} mt-2 text-right tabular-nums`}
                            inputMode="decimal"
                            value={t.odoEnd ?? ""}
                            onChange={(e) => updateTrip(t.id, { odoEnd: e.target.value })}
                            placeholder="0"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-neutral-600 font-medium">Distance (auto)</label>
                          <div className={`${inputBase} mt-2 text-right tabular-nums bg-neutral-50 border-neutral-200`}>{toNumber(t.distance).toFixed(1)} km</div>
                        </div>

                        <div className="md:col-span-4">
                          <label className="text-xs text-neutral-600 font-medium">Costs</label>
                          <div className="mt-2 grid grid-cols-2 md:grid-cols-6 gap-2">
                            <input
                              className={`${inputBase} text-right tabular-nums`}
                              inputMode="decimal"
                              value={t.costs?.fuel ?? 0}
                              onChange={(e) => updateTrip(t.id, { costs: { ...t.costs, fuel: e.target.value } })}
                              placeholder="Fuel"
                            />
                            <input
                              className={`${inputBase} text-right tabular-nums`}
                              inputMode="decimal"
                              value={t.costs?.tolls ?? 0}
                              onChange={(e) => updateTrip(t.id, { costs: { ...t.costs, tolls: e.target.value } })}
                              placeholder="Tolls"
                            />
                            <input
                              className={`${inputBase} text-right tabular-nums`}
                              inputMode="decimal"
                              value={t.costs?.parking ?? 0}
                              onChange={(e) => updateTrip(t.id, { costs: { ...t.costs, parking: e.target.value } })}
                              placeholder="Parking"
                            />
                            <input
                              className={`${inputBase} text-right tabular-nums`}
                              inputMode="decimal"
                              value={t.costs?.other ?? 0}
                              onChange={(e) => updateTrip(t.id, { costs: { ...t.costs, other: e.target.value } })}
                              placeholder="Other"
                            />
                            <select className={inputBase} value={t.costs?.currency || "EUR"} onChange={(e) => updateTrip(t.id, { costs: { ...t.costs, currency: e.target.value } })}>
                              <option value="EUR">EUR</option>
                              <option value="USD">USD</option>
                              <option value="GBP">GBP</option>
                            </select>
                            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-right tabular-nums">
                              {money(
                                toNumber(t.costs?.fuel) + toNumber(t.costs?.tolls) + toNumber(t.costs?.parking) + toNumber(t.costs?.other),
                                t.costs?.currency || "EUR"
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="md:col-span-4">
                          <label className="text-xs text-neutral-600 font-medium">Notes</label>
                          <textarea className={`${inputBase} mt-2 min-h-[70px]`} value={t.notes} onChange={(e) => updateTrip(t.id, { notes: e.target.value })} placeholder="Optional notes..." />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-end">
                        <button className={btnSecondary} onClick={() => deleteTrip(t.id)}>
                          Delete trip
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Fuel */}
            <div className={card}>
              <div className={`${cardHead} flex items-center justify-between gap-3`}>
                <div className="font-semibold text-neutral-800">Fuel</div>
                <button
                  className={
                    activeVehicle
                      ? btnAccent
                      : "print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-neutral-100 text-neutral-400 shadow-sm cursor-not-allowed"
                  }
                  onClick={addFuel}
                  disabled={!activeVehicle}
                >
                  + Add fuel
                </button>
              </div>

              <div className={`${cardPad} space-y-3`}>
                {!activeVehicle ? (
                  <div className="text-sm text-neutral-700">Select a vehicle to log fuel.</div>
                ) : fuelForMonth.length === 0 ? (
                  <div className="text-sm text-neutral-700">No fuel entries for this month yet.</div>
                ) : (
                  fuelForMonth.map((f) => {
                    const liters = toNumber(f.liters);
                    const cost = toNumber(f.totalCost);
                    const pricePerLiter = liters > 0 ? cost / liters : 0;

                    return (
                      <div key={f.id} className="rounded-2xl border border-neutral-200 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                          <div>
                            <label className="text-xs text-neutral-600 font-medium">Date</label>
                            <input type="date" className={`${inputBase} mt-2`} value={f.date} onChange={(e) => updateFuel(f.id, { date: e.target.value })} />
                          </div>

                          <div>
                            <label className="text-xs text-neutral-600 font-medium">Odometer</label>
                            <input
                              className={`${inputBase} mt-2 text-right tabular-nums`}
                              inputMode="decimal"
                              value={f.odometer ?? ""}
                              onChange={(e) => updateFuel(f.id, { odometer: e.target.value })}
                              placeholder="km"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-neutral-600 font-medium">Liters</label>
                            <input
                              className={`${inputBase} mt-2 text-right tabular-nums`}
                              inputMode="decimal"
                              value={f.liters ?? 0}
                              onChange={(e) => updateFuel(f.id, { liters: e.target.value })}
                              placeholder="0.00"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-neutral-600 font-medium">Total cost</label>
                            <input
                              className={`${inputBase} mt-2 text-right tabular-nums`}
                              inputMode="decimal"
                              value={f.totalCost ?? 0}
                              onChange={(e) => updateFuel(f.id, { totalCost: e.target.value })}
                              placeholder="0.00"
                            />
                          </div>

                          <div>
                            <label className="text-xs text-neutral-600 font-medium">Currency</label>
                            <select className={`${inputBase} mt-2`} value={f.currency || "EUR"} onChange={(e) => updateFuel(f.id, { currency: e.target.value })}>
                              <option value="EUR">EUR</option>
                              <option value="USD">USD</option>
                              <option value="GBP">GBP</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-xs text-neutral-600 font-medium">€/L (auto)</label>
                            <div className={`${inputBase} mt-2 text-right tabular-nums bg-neutral-50 border-neutral-200`}>{pricePerLiter ? pricePerLiter.toFixed(3) : "0.000"}</div>
                          </div>

                          <div className="md:col-span-3">
                            <label className="text-xs text-neutral-600 font-medium">Station</label>
                            <input className={`${inputBase} mt-2`} value={f.station || ""} onChange={(e) => updateFuel(f.id, { station: e.target.value })} placeholder="Optional (e.g., Aral, Shell)" />
                          </div>

                          <div className="md:col-span-3 flex items-end gap-3">
                            <label className="inline-flex items-center gap-2 text-sm text-neutral-700 select-none">
                              <input type="checkbox" className="h-4 w-4" checked={!!f.fullTank} onChange={(e) => updateFuel(f.id, { fullTank: e.target.checked })} />
                              Full tank
                            </label>
                            <div className="text-sm text-neutral-700">
                              Entry total: <span className="font-semibold text-neutral-800">{money(cost, f.currency || "EUR")}</span>
                            </div>
                          </div>

                          <div className="md:col-span-6">
                            <label className="text-xs text-neutral-600 font-medium">Notes</label>
                            <textarea className={`${inputBase} mt-2 min-h-[60px]`} value={f.notes || ""} onChange={(e) => updateFuel(f.id, { notes: e.target.value })} placeholder="Optional notes..." />
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-end">
                          <button className={btnSecondary} onClick={() => deleteFuel(f.id)}>
                            Delete fuel
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}

                {activeVehicle ? (
                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="text-sm text-neutral-700">Month fuel totals</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Pill>{fuelTotals.count} fill(s)</Pill>
                      <Pill tone="accent">{money(fuelTotals.spend, fuelTotals.currency)}</Pill>
                      <Pill>{fuelTotals.liters.toFixed(2)} L</Pill>
                      <Pill>{fuelTotals.avgPerLiter ? `${fuelTotals.avgPerLiter.toFixed(3)} /L` : "0.000 /L"}</Pill>
                    </div>
                  </div>
                ) : null}
              </div>
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
