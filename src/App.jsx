import React, { useEffect, useMemo, useRef, useState } from "react";

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
const nowTime = () => new Date().toTimeString().slice(0, 5);

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
                <Bullet>Start a <b>Trip</b> when you begin your day or journey.</Bullet>
                <Bullet>Log individual <b>Legs</b> (Start → End) as you drive.</Bullet>
                <Bullet>Click <b>End Trip</b> when you are done.</Bullet>
                <Bullet>Use <b>Export</b> regularly to create backups.</Bullet>
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
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400/25 focus:border-neutral-300 mt-2 min-h-[220px]"
                value={body}
                onChange={(e) => onChangeBody && onChangeBody(e.target.value)}
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
    activeTripByVehicle: {}, // { [vid]: Trip | null }
    tripsByVehicle: {},      // { [vid]: Trip[] }
    fuelByVehicle: {},
    ui: { month: monthKey(todayISO()) },
  };
}

function normalizeApp(raw) {
  const base = emptyApp();
  const a = raw && typeof raw === "object" ? raw : base;

  const vehicles = Array.isArray(a.vehicles) ? a.vehicles.filter(Boolean) : [];
  const fuelByVehicle = a.fuelByVehicle && typeof a.fuelByVehicle === "object" ? a.fuelByVehicle : {};
  const ui = a.ui && typeof a.ui === "object" ? a.ui : base.ui;

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
  const normActiveTripByVehicle = a.activeTripByVehicle || {};
  const normTripsByVehicle = a.tripsByVehicle || {};

  // Migration: Convert legacy legsByVehicle to tripsByVehicle if trips are missing
  if (a.legsByVehicle && Object.keys(normTripsByVehicle).length === 0) {
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
          createdAt: l.createdAt || new Date().toISOString()
        }));

        trips.push({
          id: uid(),
          vehicleId: vid,
          title: `Trip on ${date}`,
          purpose: "",
          startedAt: new Date(date).toISOString(),
          startDate: date,
          status: "finished",
          legs: newLegs,
          notes: "",
          finishedAt: new Date(date).toISOString()
        });
      }
      normTripsByVehicle[vid] = trips.sort((x, y) => (x.startDate < y.startDate ? 1 : -1));
    }
  }

  for (const v of normVehicles) {
    // Ensure arrays exist
    if (!normTripsByVehicle[v.id]) normTripsByVehicle[v.id] = [];
    if (!normActiveTripByVehicle[v.id]) normActiveTripByVehicle[v.id] = null;

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
  }

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
    ui: { month },
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
    ui: { month: monthKey(todayISO()) },
  };
}

// 3) Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Trip-It Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-neutral-200 shadow-xl p-6 text-center">
            <h2 className="text-lg font-bold text-neutral-800">Something went wrong</h2>
            <p className="text-sm text-neutral-600 mt-2">The application encountered an error.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 rounded-xl bg-neutral-800 text-white text-sm font-medium"
            >
              Reload
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
  const [previewConfig, setPreviewConfig] = useState({ mode: "thisMonth", start: "", end: "" });

  const [helpOpen, setHelpOpen] = useState(false);
  const [emailModal, setEmailModal] = useState({ open: false, to: "", subject: "", body: "" });

  const [vehicleModal, setVehicleModal] = useState({ open: false, mode: "new", vehicleId: null });
  const [confirm, setConfirm] = useState({ open: false, kind: null, id: null, payload: null });
  const [importConfirm, setImportConfirm] = useState({ open: false, file: null });

  // Form States
  const [tripStartForm, setTripStartForm] = useState({
    title: "",
    purpose: "",
    startDate: todayISO()
  });

  const [legForm, setLegForm] = useState({
    startPlace: "",
    startTime: nowTime(),
    odoStart: "",
    endPlace: "",
    endTime: nowTime(),
    odoEnd: "",
    note: ""
  });

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
      t.legs.forEach(l => {
        distance += toNumber(l.km);
        legCount++;
      });
    });
    return { distance, count: legCount, tripCount: tripsForMonth.length };
  }, [tripsForMonth]);

  const fuelTotals = useMemo(() => {
    const liters = fuelForMonth.reduce((s, f) => s + toNumber(f.liters), 0);
    const spend = fuelForMonth.reduce((s, f) => s + toNumber(f.totalCost), 0);
    const currency = fuelForMonth.find((f) => f.currency)?.currency || "EUR";
    const avgPerLiter = liters > 0 ? spend / liters : 0;
    return { liters, spend, currency, avgPerLiter, count: fuelForMonth.length };
  }, [fuelForMonth]);

  // Preview Data Calculation
  const previewData = useMemo(() => {
    if (!previewOpen || !activeVehicle) return { trips: [], fuel: [], totals: {} };
    
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
      t.legs.forEach(l => {
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
  }, [previewOpen, activeVehicle, trips, fuelLogs, previewConfig]);

  const setMonth = (m) => setApp((a) => ({ ...a, ui: { ...a.ui, month: m } }));

  // Auto-fill leg form defaults when active trip changes or legs added
  useEffect(() => {
    if (activeTrip && activeTrip.legs.length > 0) {
      const lastLeg = activeTrip.legs[activeTrip.legs.length - 1];
      setLegForm(prev => ({
        ...prev,
        startPlace: lastLeg.endPlace,
        startTime: nowTime(),
        odoStart: lastLeg.odoEnd != null ? lastLeg.odoEnd : "",
        endPlace: "",
        endTime: nowTime(),
        odoEnd: "",
        note: ""
      }));
    } else if (activeTrip) {
      // New trip, try to find last finished trip for odo
      const lastTrip = trips[0];
      let lastOdo = "";
      if (lastTrip && lastTrip.legs.length > 0) {
        const lastLeg = lastTrip.legs[lastTrip.legs.length - 1];
        if (lastLeg.odoEnd != null) lastOdo = lastLeg.odoEnd;
      }
      setLegForm(prev => ({
        ...prev,
        startPlace: "",
        startTime: nowTime(),
        odoStart: lastOdo,
        endPlace: "",
        endTime: nowTime(),
        odoEnd: "",
        note: ""
      }));
    }
  }, [activeTrip, trips]);

  // ---------- Vehicle CRUD ----------
  const openNewVehicle = () => setVehicleModal({ open: true, mode: "new", vehicleId: null });

  const saveVehicle = (vehicle) => {
    setApp((a) => {
      const exists = a.vehicles.some((v) => v.id === vehicle.id);
      const vehicles = exists ? a.vehicles.map((v) => (v.id === vehicle.id ? vehicle : v)) : [vehicle, ...a.vehicles];
      const tripsByVehicle = { ...a.tripsByVehicle };
      const activeTripByVehicle = { ...a.activeTripByVehicle };
      const fuelByVehicle = { ...a.fuelByVehicle };
      
      if (!tripsByVehicle[vehicle.id]) tripsByVehicle[vehicle.id] = [];
      if (!activeTripByVehicle[vehicle.id]) activeTripByVehicle[vehicle.id] = null;
      if (!fuelByVehicle[vehicle.id]) fuelByVehicle[vehicle.id] = [];
      
      const activeVehicleId = a.activeVehicleId || vehicle.id;
      return normalizeApp({ ...a, vehicles, tripsByVehicle, activeTripByVehicle, fuelByVehicle, activeVehicleId });
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
      
      delete tripsByVehicle[id];
      delete activeTripByVehicle[id];
      delete fuelByVehicle[id];

      let activeVehicleId = a.activeVehicleId;
      if (activeVehicleId === id) activeVehicleId = vehicles.length ? vehicles[0].id : null;

      return normalizeApp({ ...a, vehicles, tripsByVehicle, activeTripByVehicle, fuelByVehicle, activeVehicleId });
    });
    setConfirm({ open: false, kind: null, id: null, payload: null });
    notify("Vehicle deleted");
  };

  const selectVehicle = (id) => setApp((a) => ({ ...a, activeVehicleId: id }));

  // ---------- Trip Workflow ----------
  const startTrip = () => {
    if (!activeVehicle) return notify("Select a vehicle");
    
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

  const addLeg = () => {
    if (!activeVehicle || !activeTrip) return;

    const odoStart = legForm.odoStart !== "" ? toNumber(legForm.odoStart) : null;
    const odoEnd = legForm.odoEnd !== "" ? toNumber(legForm.odoEnd) : null;

    if (odoStart == null || odoEnd == null) return notify("Odometer readings required");
    if (odoEnd < odoStart) return notify("End Odo cannot be less than Start Odo");

    const km = Math.max(0, odoEnd - odoStart);

    const newLeg = {
      id: uid(),
      startPlace: legForm.startPlace,
      startTime: legForm.startTime,
      odoStart: odoStart,
      endPlace: legForm.endPlace,
      endTime: legForm.endTime,
      odoEnd: odoEnd,
      km: km,
      note: legForm.note,
      createdAt: new Date().toISOString()
    };

    const updatedTrip = {
      ...activeTrip,
      legs: [...activeTrip.legs, newLeg]
    };

    setApp(a => ({
      ...a,
      activeTripByVehicle: { ...a.activeTripByVehicle, [activeVehicle.id]: updatedTrip }
    }));

    notify("Leg added");
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
      t.legs.forEach(l => {
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
    lines.push(`- Trips: ${tripTotals.tripCount}`);
    lines.push(`- Legs: ${tripTotals.count}`);
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
        open={confirm.open}
        title={confirm.kind === "vehicle" ? "Delete vehicle?" : "Cancel trip?"}
        message={confirm.kind === "vehicle" ? "This will delete the vehicle and all trips + fuel logs saved under it." : "This will discard the current active trip and all its legs."}
        confirmText={confirm.kind === "vehicle" ? "Delete" : "Cancel Trip"}
        onCancel={() => setConfirm({ open: false, kind: null, id: null, payload: null })}
        onConfirm={confirm.kind === "vehicle" ? deleteVehicleNow : cancelTrip}
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
                  value={(vehicleDraft && vehicleDraft.name) || ""}
                  onChange={(e) => setVehicleDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="e.g., BMW 530i (Consulate)"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700">Make</label>
                <input
                  className={`${inputBase} mt-2`}
                  value={(vehicleDraft && vehicleDraft.make) || ""}
                  onChange={(e) => setVehicleDraft((d) => ({ ...d, make: e.target.value }))}
                  placeholder="e.g., BMW"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700">Model</label>
                <input
                  className={`${inputBase} mt-2`}
                  value={(vehicleDraft && vehicleDraft.model) || ""}
                  onChange={(e) => setVehicleDraft((d) => ({ ...d, model: e.target.value }))}
                  placeholder="e.g., 530i"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700">Plate</label>
                <input
                  className={`${inputBase} mt-2`}
                  value={(vehicleDraft && vehicleDraft.plate) || ""}
                  onChange={(e) => setVehicleDraft((d) => ({ ...d, plate: e.target.value }))}
                  placeholder="e.g., M-AB 1234"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-700">VIN</label>
                <input
                  className={`${inputBase} mt-2`}
                  value={(vehicleDraft && vehicleDraft.vin) || ""}
                  onChange={(e) => setVehicleDraft((d) => ({ ...d, vin: e.target.value }))}
                  placeholder="optional"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-neutral-700">Notes</label>
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
                Cancel
              </button>
              <button
                className={`${btnPrimary} ${vehicleSaveDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={vehicleSaveDisabled}
                onClick={() => saveVehicle({ ...vehicleDraft, name: String((vehicleDraft && vehicleDraft.name) || "").trim() })}
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
          <div className="relative w-full max-w-5xl flex flex-col max-h-[90vh]">
            {/* Controls Header (Non-printable) */}
            <div className="mb-3 rounded-2xl bg-white border border-neutral-200 shadow-sm p-3 print:hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-neutral-500">ToolStack • Preview</div>
                  <div className="text-lg font-semibold text-neutral-800">Trip-It Report</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select 
                    className="h-9 rounded-lg border border-neutral-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400/25"
                    value={previewConfig.mode}
                    onChange={(e) => updatePreviewMode(e.target.value)}
                  >
                    <option value="thisWeek">This Week</option>
                    <option value="lastWeek">Last Week</option>
                    <option value="thisMonth">This Month</option>
                    <option value="lastMonth">Last Month</option>
                    <option value="custom">Custom</option>
                  </select>
                  
                  <input 
                    type="date" 
                    className="h-9 rounded-lg border border-neutral-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400/25"
                    value={previewConfig.start}
                    onChange={(e) => setPreviewConfig(p => ({ ...p, mode: "custom", start: e.target.value }))}
                  />
                  <span className="text-neutral-400">-</span>
                  <input 
                    type="date" 
                    className="h-9 rounded-lg border border-neutral-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400/25"
                    value={previewConfig.end}
                    onChange={(e) => setPreviewConfig(p => ({ ...p, mode: "custom", end: e.target.value }))}
                  />
                  
                  <div className="w-px h-6 bg-neutral-200 mx-1 hidden sm:block"></div>

                  <button className={btnSecondary} onClick={exportPreviewCSV}>CSV</button>
                  <button className={btnSecondary} onClick={exportPreviewJSON}>JSON</button>
                  <button className={btnPrimary} onClick={() => window.print()}>Print</button>
                  <button className={btnSecondary} onClick={() => setPreviewOpen(false)}>Close</button>
                </div>
              </div>
            </div>

            {/* Printable Content */}
            <div className="rounded-2xl bg-white border border-neutral-200 shadow-xl overflow-auto flex-1">
              <div id="tripit-print" className="p-6 sm:p-10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-2xl font-bold tracking-tight text-neutral-800">{profile.org || "ToolStack"}</div>
                    <div className="text-sm text-neutral-700 mt-1">
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
                    <div>Generated:</div>
                    <div>{new Date().toLocaleString()}</div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="text-sm text-neutral-700">Trips</div>
                    <div className="text-2xl font-semibold text-neutral-800 mt-1">{previewData.totals.tripCount}</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="text-sm text-neutral-700">Legs</div>
                    <div className="text-2xl font-semibold text-neutral-800 mt-1">{previewData.totals.legCount}</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="text-sm text-neutral-700">Distance</div>
                    <div className="text-2xl font-semibold text-neutral-800 mt-1">{previewData.totals.distance.toFixed(1)} km</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="text-sm text-neutral-700">Fuel</div>
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
                    <Pill>{tripTotals.tripCount} trips</Pill>
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
            
            {/* 1. Active Trip Card */}
            <div className={card}>
              <div className={`${cardHead} flex items-center justify-between gap-3`}>
                <div className="font-semibold text-neutral-800">{activeTrip ? "Active Trip" : "Start Trip"}</div>
                {activeTrip ? (
                  <button className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition" onClick={() => setConfirm({ open: true, kind: "cancel", id: null })}>
                    Cancel Trip
                  </button>
                ) : null}
              </div>
              <div className={cardPad}>
                {!activeVehicle ? (
                  <div className="text-sm text-neutral-700">Add a vehicle to start logging trips.</div>
                ) : activeTrip ? (
                  // Active Trip View
                  <div className="space-y-4">
                    <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3 text-sm text-neutral-700">
                      <div className="font-medium text-neutral-800">{activeTrip.title || "Untitled Trip"}</div>
                      <div className="mt-1">Started: {new Date(activeTrip.startedAt).toLocaleString()}</div>
                      {activeTrip.purpose ? <div className="text-xs text-neutral-500 mt-1">Purpose: {activeTrip.purpose}</div> : null}
                    </div>

                    {/* List of Legs in Active Trip */}
                    {activeTrip.legs.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Legs</div>
                        {activeTrip.legs.map((l, idx) => (
                          <div key={l.id} className="flex items-center justify-between p-2 rounded-lg border border-neutral-100 bg-white text-sm">
                            <div className="min-w-0">
                              <div className="font-medium text-neutral-800">{l.startPlace} → {l.endPlace}</div>
                              <div className="text-xs text-neutral-500">{l.startTime} - {l.endTime} • {l.km.toFixed(1)} km</div>
                            </div>
                            <button 
                              className="text-xs text-red-600 hover:text-red-800 px-2"
                              onClick={() => deleteLeg(l.id)}
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-neutral-500 italic">No legs logged yet. Add one below.</div>
                    )}

                    <div className="border-t border-neutral-100 pt-4">
                      <div className="text-sm font-medium text-neutral-800 mb-3">Add Leg</div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                        <div>
                          <label className="text-xs text-neutral-600 font-medium">Start Place</label>
                          <input
                            className={`${inputBase} mt-1`}
                            value={legForm.startPlace}
                            onChange={(e) => setLegForm({ ...legForm, startPlace: e.target.value })}
                            placeholder="Start"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-neutral-600 font-medium">Start Time</label>
                          <input
                            type="time"
                            className={`${inputBase} mt-1`}
                            value={legForm.startTime}
                            onChange={(e) => setLegForm({ ...legForm, startTime: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-neutral-600 font-medium">Odo Start</label>
                          <input
                            className={`${inputBase} mt-1 text-right tabular-nums`}
                            inputMode="decimal"
                            value={legForm.odoStart}
                            onChange={(e) => setLegForm({ ...legForm, odoStart: e.target.value })}
                            placeholder="0"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                        <div>
                          <label className="text-xs text-neutral-600 font-medium">End Place</label>
                          <input
                            className={`${inputBase} mt-1`}
                            value={legForm.endPlace}
                            onChange={(e) => setLegForm({ ...legForm, endPlace: e.target.value })}
                            placeholder="Destination"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-neutral-600 font-medium">End Time</label>
                          <input
                            type="time"
                            className={`${inputBase} mt-1`}
                            value={legForm.endTime}
                            onChange={(e) => setLegForm({ ...legForm, endTime: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-neutral-600 font-medium">Odo End</label>
                          <input
                            className={`${inputBase} mt-1 text-right tabular-nums`}
                            inputMode="decimal"
                            value={legForm.odoEnd}
                            onChange={(e) => setLegForm({ ...legForm, odoEnd: e.target.value })}
                            placeholder="0"
                          />
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="text-xs text-neutral-600 font-medium">Note</label>
                        <input
                          className={`${inputBase} mt-1`}
                          value={legForm.note}
                          onChange={(e) => setLegForm({ ...legForm, note: e.target.value })}
                          placeholder="Optional"
                        />
                      </div>

                      <div className="flex justify-end">
                        <button className={btnSecondary} onClick={addLeg}>
                          Log Leg
                        </button>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-neutral-100 flex justify-end">
                      <button className={btnAccent} onClick={endTrip}>
                        End Trip
                      </button>
                    </div>
                  </div>
                ) : (
                  // Start Trip Form
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-neutral-700">Trip Title (Optional)</label>
                      <input
                        className={`${inputBase} mt-1`}
                        value={tripStartForm.title}
                        onChange={(e) => setTripStartForm({ ...tripStartForm, title: e.target.value })}
                        placeholder="e.g. Client Visit"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-neutral-700">Purpose (Optional)</label>
                      <input
                        className={`${inputBase} mt-1`}
                        value={tripStartForm.purpose}
                        onChange={(e) => setTripStartForm({ ...tripStartForm, purpose: e.target.value })}
                        placeholder="e.g. Business"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-neutral-700">Date</label>
                      <input
                        type="date"
                        className={`${inputBase} mt-1`}
                        value={tripStartForm.startDate}
                        onChange={(e) => setTripStartForm({ ...tripStartForm, startDate: e.target.value })}
                      />
                    </div>
                    <div className="pt-2 flex justify-end">
                      <button className={btnAccent} onClick={startTrip}>
                        Start Trip
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Recent Trips List */}
            <div className={card}>
              <div className={cardHead}>
                <div className="font-semibold text-neutral-800">Recent Trips</div>
              </div>
              <div className={cardPad}>
                {!activeVehicle ? (
                  <div className="text-sm text-neutral-700">Select a vehicle to view trips.</div>
                ) : tripsForMonth.length === 0 ? (
                  <div className="text-sm text-neutral-700">No trips logged for {monthLabel(app.ui.month)}.</div>
                ) : (
                  <div className="space-y-3">
                    {tripsForMonth.map((t) => {
                      const totalKm = t.legs.reduce((sum, l) => sum + toNumber(l.km), 0);
                      const isExpanded = expandedTripId === t.id;
                      
                      return (
                        <div key={t.id} className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
                          <div 
                            className="p-3 flex items-center justify-between cursor-pointer hover:bg-neutral-50 transition"
                            onClick={() => toggleTrip(t.id)}
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-neutral-800 truncate">{t.title || "Untitled Trip"}</div>
                              <div className="text-xs text-neutral-500 mt-0.5">{t.startDate} • {t.legs.length} legs</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-bold text-neutral-800">{totalKm.toFixed(1)} km</div>
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <div className="border-t border-neutral-100 bg-neutral-50 p-3 space-y-2">
                              {t.purpose && <div className="text-xs text-neutral-600 mb-2">Purpose: {t.purpose}</div>}
                              {t.legs.map((l) => (
                                <div key={l.id} className="text-sm border-l-2 border-neutral-300 pl-2 py-1">
                                  <div className="flex justify-between">
                                    <span className="font-medium text-neutral-700">{l.startPlace} → {l.endPlace}</span>
                                    <span className="text-neutral-600">{l.km.toFixed(1)} km</span>
                                  </div>
                                  <div className="text-xs text-neutral-500">
                                    {l.startTime} - {l.endTime} • Odo: {l.odoStart} - {l.odoEnd}
                                  </div>
                                  {l.note && <div className="text-xs text-neutral-500 italic">"{l.note}"</div>}
                                </div>
                              ))}
                              <div className="pt-2 flex justify-end">
                                <button 
                                  className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition"
                                  onClick={(e) => { e.stopPropagation(); deleteTrip(t.id); }}
                                >
                                  Delete Trip
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
            </div>

            {/* 3. Fuel (Existing) */}
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

export default function App() {
  return (
    <ErrorBoundary>
      <TripIt />
    </ErrorBoundary>
  );
}
