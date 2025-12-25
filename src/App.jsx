import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * ToolStack — Trip-It (Duty Trip Log) — Ultimate v1 (Styled v1: neutral + lime accent)
 *
 * Includes:
 * - Quick Add mode
 * - Templates / Presets + Template Manager (add/edit/delete)
 * - Period filters: Today / This Week / Month / Custom / All
 * - Vehicle + Category filters + global search
 * - Duration calc (start/end time)
 * - Insights (by vehicle/category)
 * - Email report (mailto text summary, no attachment)
 * - Weekly Backup (ENTIRE DATABASE) with ISO week filename
 * - Export/Import JSON (includes templates + ui prefs) + Export CSV
 * - Autosave to localStorage + safe migration
 */

const LS_KEY = "toolstack_tripit_v1"; // keep to preserve existing saves
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const safeParse = (s, fallback) => {
  try {
    const v = JSON.parse(s);
    return v ?? fallback;
  } catch {
    return fallback;
  }
};

const isoToday = () => new Date().toISOString().slice(0, 10);

function money(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}
function km(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function fmtMoney(amount, currency) {
  const n = money(amount);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "EUR" }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency || "EUR"}`;
  }
}

function monthKeyFromDate(d) {
  if (!d) return "";
  return String(d).slice(0, 7); // YYYY-MM
}

function downloadBlob(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function nowTimeHHMM() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function parseHHMM(v) {
  if (!v || typeof v !== "string") return null;
  const m = v.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function durationMinutes(startHHMM, endHHMM) {
  const s = parseHHMM(startHHMM);
  const e = parseHHMM(endHHMM);
  if (s == null || e == null) return 0;
  const d = e - s;
  return d > 0 ? d : 0;
}

function fmtDuration(mins) {
  const m = Number(mins) || 0;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!m) return "—";
  return h ? `${h}h ${r}m` : `${r}m`;
}

// Monday-based week start (Germany-friendly)
function startOfWeekISO(dateStr) {
  const d = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
function endOfWeekISO(dateStr) {
  const s = startOfWeekISO(dateStr);
  const d = new Date(s + "T00:00:00");
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

function clampDateRange(a, b) {
  if (!a && !b) return { from: "", to: "" };
  if (a && b && a > b) return { from: b, to: a };
  return { from: a || "", to: b || "" };
}

// ISO week filename (YYYY-Www)
function isoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Thursday in current week decides the year
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

const btnSecondary =
  "print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white shadow-sm hover:bg-neutral-50 active:translate-y-[1px] transition disabled:opacity-50 disabled:cursor-not-allowed";
const btnPrimary =
  "print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-neutral-900 bg-neutral-900 text-white shadow-sm hover:bg-neutral-800 active:translate-y-[1px] transition disabled:opacity-50 disabled:cursor-not-allowed";
const btnDanger =
  "print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-red-200 bg-red-50 text-red-700 shadow-sm hover:bg-red-100 active:translate-y-[1px] transition disabled:opacity-50 disabled:cursor-not-allowed";
const btnGhost =
  "print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-transparent bg-transparent hover:bg-neutral-100 text-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed";
const inputBase =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400/25 focus:border-neutral-300";
const inputMuted =
  "w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm";
const card = "rounded-2xl bg-white border border-neutral-200 shadow-sm";
const cardHead = "px-4 py-3 border-b border-neutral-100";
const cardPad = "p-4";

function Pill({ children, tone = "default" }) {
  const cls =
    tone === "accent"
      ? "border-lime-200 bg-lime-50 text-neutral-800"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-neutral-800"
      : tone === "bad"
      ? "border-red-200 bg-red-50 text-neutral-800"
      : "border-neutral-200 bg-white text-neutral-700";

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}>
      {children}
    </span>
  );
}

function SmallButton({ children, onClick, tone = "default", disabled, title, className = "", type = "button" }) {
  const cls =
    tone === "primary" ? btnPrimary : tone === "danger" ? btnDanger : tone === "ghost" ? btnGhost : btnSecondary;

  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={`${cls} ${className}`}>
      {children}
    </button>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm text-neutral-700 font-medium">{label}</label>
        {hint ? <span className="text-xs text-neutral-500">{hint}</span> : null}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ConfirmModal({ open, title, message, confirmText = "Delete", onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-neutral-200 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-neutral-100">
          <div className="text-lg font-semibold text-neutral-900">{title}</div>
          <div className="text-sm text-neutral-600 mt-1">{message}</div>
          <div className="mt-3 h-[2px] w-40 rounded-full bg-gradient-to-r from-lime-400/0 via-lime-400 to-emerald-400/0" />
        </div>
        <div className="p-4 flex items-center justify-end gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-900 transition"
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

function ModalShell({ open, title, subtitle, onClose, children, actions }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 print:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-2xl bg-white border border-neutral-200 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-neutral-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-neutral-900">{title}</div>
              {subtitle ? <div className="text-sm text-neutral-600 mt-1">{subtitle}</div> : null}
              <div className="mt-3 h-[2px] w-56 rounded-full bg-gradient-to-r from-lime-400/0 via-lime-400 to-emerald-400/0" />
            </div>
            <button
              type="button"
              className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-900 transition"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
        <div className="p-4">{children}</div>
        {actions ? <div className="p-4 border-t border-neutral-100 flex items-center justify-end gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

const DEFAULT_CATEGORIES = ["Official", "Errand", "Maintenance", "Training", "Private"];

const blankTrip = () => ({
  id: uid(),
  date: isoToday(),
  startTime: "",
  endTime: "",
  from: "",
  to: "",
  purpose: "",
  category: "Official",
  vehicle: "BMW 530i",
  driver: "",
  passengers: "",
  startKm: "",
  endKm: "",
  distanceKm: "",
  fuelCost: "",
  tollCost: "",
  parkingCost: "",
  otherCost: "",
  currency: "EUR",
  notes: "",
  proof: "",
  issueFlag: false,
  issueNotes: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

function normalizeTrip(t, profile) {
  const base = { ...blankTrip(), ...t };
  base.id = t?.id || uid();
  base.date = t?.date || isoToday();
  base.vehicle = base.vehicle || profile?.defaultVehicle || "Vehicle";
  base.currency = base.currency || profile?.defaultCurrency || "EUR";
  base.category = base.category || "Official";
  base.issueFlag = !!base.issueFlag;
  base.issueNotes = String(base.issueNotes || "");
  base.updatedAt = new Date().toISOString();
  return base;
}

function buildEmailText({ profile, trips, totals, periodLabel, filtersLabel }) {
  const lines = [];
  const iso = isoToday();
  lines.push(`ToolStack • Trip-It`);
  lines.push(`Org: ${profile.orgName || "—"}`);
  lines.push(`Date: ${iso}`);
  lines.push(`Period: ${periodLabel}`);
  if (filtersLabel) lines.push(`Filters: ${filtersLabel}`);
  lines.push(``);
  lines.push(`Summary:`);
  lines.push(`- Trips: ${totals.count}`);
  lines.push(`- Total km: ${totals.km.toFixed(0)}`);
  lines.push(`- Costs: ${fmtMoney(totals.costs, totals.currency)}`);
  if (totals.rate) lines.push(`- Mileage claim @ ${totals.rate}: ${fmtMoney(totals.mileageClaim, totals.currency)}`);
  if (totals.durationMin) lines.push(`- Logged duration: ${fmtDuration(totals.durationMin)}`);
  lines.push(``);
  lines.push(`Trips:`);
  for (const t of trips) {
    const dist = km(t.distanceKm || (km(t.endKm) - km(t.startKm)));
    const costs = money(t.fuelCost) + money(t.tollCost) + money(t.parkingCost) + money(t.otherCost);
    const dur = durationMinutes(t.startTime, t.endTime);
    const time = t.startTime || t.endTime ? ` ${t.startTime || "—"}–${t.endTime || "—"}` : "";
    const issue = t.issueFlag ? " ⚠️" : "";
    lines.push(
      `- ${t.date}${time}: ${t.from} → ${t.to} | ${t.purpose || "—"} | ${t.vehicle || "—"} | ${t.category || "—"} | ${dist ? `${dist.toFixed(0)}km` : "km—"} | ${costs ? fmtMoney(costs, t.currency || totals.currency) : "cost—"} | ${dur ? fmtDuration(dur) : "dur—"}${issue}`
    );
  }
  lines.push(``);
  lines.push(`Link: https://toolstack-trip-it.vercel.app`);
  return lines.join("\n");
}

export default function TripItApp() {
  const [profile, setProfile] = useState({
    orgName: "South African Consulate, Munich",
    defaultVehicle: "BMW 530i",
    defaultCurrency: "EUR",
    mileageRate: "",
    vehicles: ["BMW 530i", "Mercedes Vito 119"],
    categories: DEFAULT_CATEGORIES,
  });

  const [templates, setTemplates] = useState(() => [
    { id: uid(), name: "Consulate Run", from: "Consulate", to: "", purpose: "Official run", category: "Official", vehicle: "BMW 530i" },
    { id: uid(), name: "Airport", from: "Munich", to: "Airport", purpose: "Pickup/Drop-off", category: "Official", vehicle: "Mercedes Vito 119" },
    { id: uid(), name: "Service", from: "", to: "", purpose: "Vehicle service/repair", category: "Maintenance", vehicle: "BMW 530i" },
  ]);

  const [trips, setTrips] = useState(() => {
    const saved = localStorage.getItem(LS_KEY);
    const data = saved ? safeParse(saved, null) : null;
    if (Array.isArray(data?.trips)) return data.trips;
    return [];
  });

  const [form, setForm] = useState(() => {
    const t = blankTrip();
    t.vehicle = "BMW 530i";
    t.currency = "EUR";
    t.category = "Official";
    return t;
  });

  const [ui, setUi] = useState(() => {
    const saved = localStorage.getItem(LS_KEY);
    const data = saved ? safeParse(saved, null) : null;
    const pref = data?.uiPrefs || {};
    return {
      previewOpen: false,
      quickMode: pref.quickMode ?? true,

      period: pref.period || "month",
      month: pref.month || monthKeyFromDate(isoToday()),
      customFrom: pref.customFrom || "",
      customTo: pref.customTo || "",

      search: "",
      vehicleFilter: "all",
      categoryFilter: "all",

      showInsights: pref.showInsights ?? true,

      templateManagerOpen: false,
      templateDraft: null, // {id,name,from,to,purpose,category,vehicle}
      templateDeleteConfirm: { open: false, id: null },
      lastBackupAt: pref.lastBackupAt || "",
    };
  });

  const [confirm, setConfirm] = useState({ open: false, tripId: null });
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notify = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  // Load saved + migrate safely
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    const data = saved ? safeParse(saved, null) : null;

    if (data?.profile) {
      setProfile((p) => {
        const merged = { ...p, ...data.profile };
        merged.vehicles = Array.isArray(merged.vehicles) && merged.vehicles.length ? merged.vehicles : p.vehicles;
        merged.categories = Array.isArray(merged.categories) && merged.categories.length ? merged.categories : p.categories;
        return merged;
      });
    }

    if (Array.isArray(data?.templates) && data.templates.length) {
      setTemplates(
        data.templates.map((t) => ({
          id: t.id || uid(),
          name: String(t.name || "Template"),
          from: String(t.from || ""),
          to: String(t.to || ""),
          purpose: String(t.purpose || ""),
          category: String(t.category || "Official"),
          vehicle: String(t.vehicle || ""),
        }))
      );
    }

    if (Array.isArray(data?.trips)) {
      setTrips(data.trips);
    }

    setForm((f) => ({
      ...f,
      vehicle: (data?.profile?.defaultVehicle || f.vehicle) || "Vehicle",
      currency: (data?.profile?.defaultCurrency || f.currency) || "EUR",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave (includes templates + ui prefs)
  useEffect(() => {
    const uiPrefs = {
      quickMode: ui.quickMode,
      period: ui.period,
      month: ui.month,
      customFrom: ui.customFrom,
      customTo: ui.customTo,
      showInsights: ui.showInsights,
      lastBackupAt: ui.lastBackupAt,
    };
    localStorage.setItem(LS_KEY, JSON.stringify({ profile, templates, trips, uiPrefs }));
  }, [
    profile,
    templates,
    trips,
    ui.quickMode,
    ui.period,
    ui.month,
    ui.customFrom,
    ui.customTo,
    ui.showInsights,
    ui.lastBackupAt,
  ]);

  // Keep form distance updated
  useEffect(() => {
    const d = km(form.endKm) - km(form.startKm);
    if (form.startKm !== "" && form.endKm !== "" && Number.isFinite(d)) {
      setForm((p) => ({ ...p, distanceKm: d >= 0 ? String(d) : p.distanceKm }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.startKm, form.endKm]);

  const vehicles = useMemo(() => {
    const fromProfile = Array.isArray(profile.vehicles) ? profile.vehicles.filter(Boolean) : [];
    const fromTrips = Array.from(new Set(trips.map((t) => (t.vehicle || "").trim()).filter(Boolean)));
    const fromTemplates = Array.from(new Set(templates.map((t) => (t.vehicle || "").trim()).filter(Boolean)));
    const all = Array.from(new Set([...fromProfile, ...fromTrips, ...fromTemplates]));
    return all.length ? all : ["Vehicle"];
  }, [profile.vehicles, trips, templates]);

  const categories = useMemo(() => {
    const fromProfile = Array.isArray(profile.categories) ? profile.categories.filter(Boolean) : [];
    const fromTrips = Array.from(new Set(trips.map((t) => (t.category || "").trim()).filter(Boolean)));
    const fromTemplates = Array.from(new Set(templates.map((t) => (t.category || "").trim()).filter(Boolean)));
    const all = Array.from(new Set([...fromProfile, ...fromTrips, ...fromTemplates]));
    return all.length ? all : DEFAULT_CATEGORIES;
  }, [profile.categories, trips, templates]);

  // Period boundaries
  const periodRange = useMemo(() => {
    const today = isoToday();

    if (ui.period === "today") return { from: today, to: today };
    if (ui.period === "week") return { from: startOfWeekISO(today), to: endOfWeekISO(today) };
    if (ui.period === "month") {
      const m = ui.month || monthKeyFromDate(today);
      const from = `${m}-01`;
      const d = new Date(from + "T00:00:00");
      d.setMonth(d.getMonth() + 1);
      d.setDate(0);
      const to = d.toISOString().slice(0, 10);
      return { from, to };
    }
    if (ui.period === "custom") {
      const r = clampDateRange(ui.customFrom, ui.customTo);
      return { from: r.from, to: r.to };
    }
    return { from: "", to: "" }; // all
  }, [ui.period, ui.month, ui.customFrom, ui.customTo]);

  const periodLabel = useMemo(() => {
    if (ui.period === "today") return "Today";
    if (ui.period === "week") return `This week (${periodRange.from} → ${periodRange.to})`;
    if (ui.period === "month") return `Month (${ui.month || monthKeyFromDate(isoToday())})`;
    if (ui.period === "custom") return periodRange.from || periodRange.to ? `Custom (${periodRange.from || "?"} → ${periodRange.to || "?"})` : "Custom";
    return "All";
  }, [ui.period, ui.month, periodRange.from, periodRange.to]);

  const filteredTrips = useMemo(() => {
    const q = (ui.search || "").trim().toLowerCase();
    const vf = ui.vehicleFilter;
    const cf = ui.categoryFilter;
    const { from, to } = periodRange;

    return trips
      .map((t) => normalizeTrip(t, profile))
      .filter((t) => {
        if (!from && !to) return true;
        if (!t.date) return false;
        if (from && t.date < from) return false;
        if (to && t.date > to) return false;
        return true;
      })
      .filter((t) => (vf === "all" ? true : (t.vehicle || "") === vf))
      .filter((t) => (cf === "all" ? true : (t.category || "") === cf))
      .filter((t) => {
        if (!q) return true;
        const hay = [t.date, t.from, t.to, t.purpose, t.vehicle, t.driver, t.passengers, t.category, t.notes, t.proof].join(" ").toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }, [trips, ui.search, ui.vehicleFilter, ui.categoryFilter, periodRange, profile]);

  const totals = useMemo(() => {
    const list = filteredTrips;
    const sumKm = list.reduce((acc, t) => acc + km(t.distanceKm || (km(t.endKm) - km(t.startKm))), 0);
    const sumFuel = list.reduce((acc, t) => acc + money(t.fuelCost), 0);
    const sumToll = list.reduce((acc, t) => acc + money(t.tollCost), 0);
    const sumPark = list.reduce((acc, t) => acc + money(t.parkingCost), 0);
    const sumOther = list.reduce((acc, t) => acc + money(t.otherCost), 0);
    const sumCosts = sumFuel + sumToll + sumPark + sumOther;

    const sumDur = list.reduce((acc, t) => acc + durationMinutes(t.startTime, t.endTime), 0);

    const rate = money(profile.mileageRate);
    const mileageClaim = rate ? sumKm * rate : 0;

    const currency = profile.defaultCurrency || "EUR";

    return {
      count: list.length,
      km: sumKm,
      costs: sumCosts,
      durationMin: sumDur,
      mileageClaim,
      currency,
      rate,
    };
  }, [filteredTrips, profile.mileageRate, profile.defaultCurrency]);

  const insights = useMemo(() => {
    const byVehicle = {};
    const byCategory = {};
    for (const t of filteredTrips) {
      const v = t.vehicle || "—";
      const c = t.category || "—";
      const dist = km(t.distanceKm || (km(t.endKm) - km(t.startKm)));
      const costs = money(t.fuelCost) + money(t.tollCost) + money(t.parkingCost) + money(t.otherCost);
      byVehicle[v] = byVehicle[v] || { trips: 0, km: 0, costs: 0 };
      byCategory[c] = byCategory[c] || { trips: 0, km: 0, costs: 0 };
      byVehicle[v].trips += 1;
      byVehicle[v].km += dist;
      byVehicle[v].costs += costs;
      byCategory[c].trips += 1;
      byCategory[c].km += dist;
      byCategory[c].costs += costs;
    }
    const sortRows = (o) =>
      Object.entries(o)
        .map(([k, v]) => ({ key: k, ...v }))
        .sort((a, b) => b.km - a.km || b.trips - a.trips);

    return { byVehicle: sortRows(byVehicle), byCategory: sortRows(byCategory) };
  }, [filteredTrips]);

  const resetForm = () => {
    const t = blankTrip();
    t.vehicle = profile.defaultVehicle || t.vehicle;
    t.currency = profile.defaultCurrency || t.currency;
    t.category = (profile.categories?.[0] || "Official") ?? "Official";
    setForm(t);
  };

  const applyTemplate = (tpl) => {
    setForm((p) => ({
      ...p,
      from: tpl.from ?? p.from,
      to: tpl.to ?? p.to,
      purpose: tpl.purpose ?? p.purpose,
      category: tpl.category ?? p.category,
      vehicle: tpl.vehicle || p.vehicle,
    }));
    notify(`Template: ${tpl.name}`);
  };

  const validate = () => {
    if (!form.date) return "Date is required";
    if (!String(form.from || "").trim()) return "From is required";
    if (!String(form.to || "").trim()) return "To is required";
    if (!String(form.purpose || "").trim()) return "Purpose is required";
    const s = form.startKm === "" ? null : km(form.startKm);
    const e = form.endKm === "" ? null : km(form.endKm);
    if (s != null && e != null && e < s) return "End km must be >= start km";
    return null;
  };

  const upsertTrip = () => {
    const err = validate();
    if (err) {
      notify(err);
      return;
    }

    setTrips((prev) => {
      const exists = prev.some((t) => t.id === form.id);
      const normalized = normalizeTrip(
        {
          ...form,
          vehicle: form.vehicle || profile.defaultVehicle || "",
          currency: form.currency || profile.defaultCurrency || "EUR",
          category: form.category || "Official",
          updatedAt: new Date().toISOString(),
        },
        profile
      );
      if (exists) return prev.map((t) => (t.id === form.id ? normalized : t));
      return [normalized, ...prev];
    });

    notify("Saved");
    resetForm();
  };

  const editTrip = (t) => {
    setForm(normalizeTrip(t, profile));
    notify("Loaded into form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const duplicateTrip = (t) => {
    const copy = normalizeTrip({ ...t, id: uid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, profile);
    copy.date = isoToday();
    setForm(copy);
    notify("Duplicated into form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const requestDelete = (id) => setConfirm({ open: true, tripId: id });

  const deleteNow = () => {
    const id = confirm.tripId;
    setTrips((prev) => prev.filter((t) => t.id !== id));
    setConfirm({ open: false, tripId: null });
    notify("Deleted");
  };

  const getDBPackage = () => {
    const uiPrefs = {
      quickMode: ui.quickMode,
      period: ui.period,
      month: ui.month,
      customFrom: ui.customFrom,
      customTo: ui.customTo,
      showInsights: ui.showInsights,
      lastBackupAt: ui.lastBackupAt,
    };
    return { profile, templates, trips, uiPrefs };
  };

  const weeklyBackup = () => {
    const key = isoWeekKey(new Date());
    const filename = `toolstack-trip-it-backup-${key}.json`;
    downloadBlob(filename, JSON.stringify(getDBPackage(), null, 2), "application/json");
    const stamp = new Date().toISOString();
    setUi((p) => ({ ...p, lastBackupAt: stamp }));
    notify(`Backup saved: ${key}`);
  };

  const exportJSON = () => {
    downloadBlob("toolstack-trip-it.json", JSON.stringify(getDBPackage(), null, 2), "application/json");
  };

  const importJSON = async (file) => {
    if (!file) return;
    const text = await file.text();
    const parsed = safeParse(text, null);
    if (!parsed || !Array.isArray(parsed.trips)) {
      notify("Invalid JSON");
      return;
    }
    if (parsed.profile) setProfile((p) => ({ ...p, ...parsed.profile }));
    if (Array.isArray(parsed.templates)) setTemplates(parsed.templates);
    setTrips(parsed.trips);
    notify("Imported");
  };

  const exportCSV = () => {
    const rows = [
      [
        "date",
        "startTime",
        "endTime",
        "durationMin",
        "from",
        "to",
        "purpose",
        "category",
        "vehicle",
        "driver",
        "passengers",
        "startKm",
        "endKm",
        "distanceKm",
        "fuelCost",
        "tollCost",
        "parkingCost",
        "otherCost",
        "currency",
        "notes",
        "proof",
      ],
      ...filteredTrips.map((t) => [
        t.date,
        t.startTime,
        t.endTime,
        String(durationMinutes(t.startTime, t.endTime)),
        t.from,
        t.to,
        (t.purpose || "").replaceAll("\n", " "),
        t.category,
        t.vehicle,
        t.driver,
        t.passengers,
        t.startKm,
        t.endKm,
        t.distanceKm,
        t.fuelCost,
        t.tollCost,
        t.parkingCost,
        t.otherCost,
        t.currency,
        (t.notes || "").replaceAll("\n", " "),
        (t.proof || "").replaceAll("\n", " "),
      ]),
    ];

    const esc = (v) => {
      const s = String(v ?? "");
      const needs = /[",\n]/.test(s);
      const out = s.replaceAll('"', '""');
      return needs ? `"${out}"` : out;
    };

    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const name = `toolstack-trip-it-${ui.period}-${periodRange.from || "all"}-${periodRange.to || "all"}.csv`;
    downloadBlob(name, csv, "text/csv");
  };

  const emailReport = () => {
    const filters = [];
    if (ui.vehicleFilter !== "all") filters.push(`Vehicle=${ui.vehicleFilter}`);
    if (ui.categoryFilter !== "all") filters.push(`Category=${ui.categoryFilter}`);
    if (ui.search.trim()) filters.push(`Search="${ui.search.trim()}"`);
    const filtersLabel = filters.join(", ");

    const subject = `ToolStack Trip-It Report (${periodLabel})`;
    const body = buildEmailText({
      profile,
      trips: filteredTrips,
      totals,
      periodLabel,
      filtersLabel,
    });

    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  // Template Manager
  const openTemplateManager = () => setUi((p) => ({ ...p, templateManagerOpen: true, templateDraft: null }));

  const startNewTemplateFromForm = () => {
    setUi((p) => ({
      ...p,
      templateManagerOpen: true,
      templateDraft: {
        id: uid(),
        name: "New template",
        from: form.from || "",
        to: form.to || "",
        purpose: form.purpose || "",
        category: form.category || "Official",
        vehicle: form.vehicle || profile.defaultVehicle || "",
      },
    }));
  };

  const editTemplate = (tpl) => {
    setUi((p) => ({
      ...p,
      templateManagerOpen: true,
      templateDraft: {
        id: tpl.id,
        name: tpl.name || "Template",
        from: tpl.from || "",
        to: tpl.to || "",
        purpose: tpl.purpose || "",
        category: tpl.category || "Official",
        vehicle: tpl.vehicle || "",
      },
    }));
  };

  const saveTemplateDraft = () => {
    const d = ui.templateDraft;
    if (!d) return;
    const name = String(d.name || "").trim();
    if (!name) {
      notify("Template name required");
      return;
    }
    const next = {
      id: d.id || uid(),
      name,
      from: String(d.from || ""),
      to: String(d.to || ""),
      purpose: String(d.purpose || ""),
      category: String(d.category || "Official"),
      vehicle: String(d.vehicle || profile.defaultVehicle || ""),
    };
    setTemplates((prev) => {
      const exists = prev.some((t) => t.id === next.id);
      if (exists) return prev.map((t) => (t.id === next.id ? next : t));
      return [next, ...prev];
    });
    setUi((p) => ({ ...p, templateDraft: null }));
    notify("Template saved");
  };

  const requestDeleteTemplate = (id) => setUi((p) => ({ ...p, templateDeleteConfirm: { open: true, id } }));

  const deleteTemplateNow = () => {
    const id = ui.templateDeleteConfirm.id;
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    setUi((p) => ({ ...p, templateDeleteConfirm: { open: false, id: null }, templateDraft: null }));
    notify("Template deleted");
  };

  const distOf = (t) => km(t.distanceKm || (km(t.endKm) - km(t.startKm)));
  const costsOf = (t) => money(t.fuelCost) + money(t.tollCost) + money(t.parkingCost) + money(t.otherCost);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Print rules */}
      <style>{`
        @media print { .print\\:hidden { display: none !important; } }
      `}</style>

      <ConfirmModal
        open={confirm.open}
        title="Delete trip?"
        message="This will permanently delete this trip log entry."
        onCancel={() => setConfirm({ open: false, tripId: null })}
        onConfirm={deleteNow}
      />

      <ConfirmModal
        open={ui.templateDeleteConfirm.open}
        title="Delete template?"
        message="This will remove the template permanently."
        onCancel={() => setUi((p) => ({ ...p, templateDeleteConfirm: { open: false, id: null } }))}
        onConfirm={deleteTemplateNow}
      />

      <ModalShell
        open={ui.templateManagerOpen}
        title="Template Manager"
        subtitle="Add, edit, delete templates. Use templates to log trips in seconds."
        onClose={() => setUi((p) => ({ ...p, templateManagerOpen: false, templateDraft: null }))}
        actions={
          ui.templateDraft ? (
            <>
              <SmallButton tone="ghost" onClick={() => setUi((p) => ({ ...p, templateDraft: null }))}>
                Cancel edit
              </SmallButton>
              <SmallButton tone="primary" onClick={saveTemplateDraft}>
                Save template
              </SmallButton>
            </>
          ) : (
            <>
              <SmallButton tone="ghost" onClick={() => setUi((p) => ({ ...p, templateManagerOpen: false }))}>
                Done
              </SmallButton>
            </>
          )
        }
      >
        {ui.templateDraft ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Template name" hint="Required">
              <input
                className={inputBase}
                value={ui.templateDraft.name}
                onChange={(e) =>
                  setUi((p) => ({ ...p, templateDraft: { ...p.templateDraft, name: e.target.value } }))
                }
              />
            </Field>

            <Field label="Vehicle">
              <select
                className={inputBase}
                value={ui.templateDraft.vehicle}
                onChange={(e) =>
                  setUi((p) => ({ ...p, templateDraft: { ...p.templateDraft, vehicle: e.target.value } }))
                }
              >
                {vehicles.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Category">
              <select
                className={inputBase}
                value={ui.templateDraft.category}
                onChange={(e) =>
                  setUi((p) => ({ ...p, templateDraft: { ...p.templateDraft, category: e.target.value } }))
                }
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <div />

            <Field label="From">
              <input
                className={inputBase}
                value={ui.templateDraft.from}
                onChange={(e) =>
                  setUi((p) => ({ ...p, templateDraft: { ...p.templateDraft, from: e.target.value } }))
                }
              />
            </Field>

            <Field label="To">
              <input
                className={inputBase}
                value={ui.templateDraft.to}
                onChange={(e) =>
                  setUi((p) => ({ ...p, templateDraft: { ...p.templateDraft, to: e.target.value } }))
                }
              />
            </Field>

            <div className="md:col-span-2">
              <Field label="Purpose">
                <input
                  className={inputBase}
                  value={ui.templateDraft.purpose}
                  onChange={(e) =>
                    setUi((p) => ({ ...p, templateDraft: { ...p.templateDraft, purpose: e.target.value } }))
                  }
                />
              </Field>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <SmallButton tone="danger" onClick={() => requestDeleteTemplate(ui.templateDraft.id)}>
                Delete template
              </SmallButton>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="text-sm text-neutral-600">
                You have <span className="font-semibold text-neutral-900">{templates.length}</span> templates.
              </div>
              <SmallButton tone="primary" onClick={startNewTemplateFromForm} title="Create a template from current form fields">
                Save current form as template
              </SmallButton>
            </div>

            <div className="rounded-2xl border border-neutral-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-neutral-700">
                  <tr>
                    <th className="text-left p-3">Name</th>
                    <th className="text-left p-3">Route</th>
                    <th className="text-left p-3">Vehicle</th>
                    <th className="text-left p-3">Category</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.id} className="border-t border-neutral-100">
                      <td className="p-3 font-medium text-neutral-900">{t.name}</td>
                      <td className="p-3 text-neutral-700">
                        {(t.from || "—")} → {(t.to || "—")}
                      </td>
                      <td className="p-3 text-neutral-700">{t.vehicle || "—"}</td>
                      <td className="p-3 text-neutral-700">{t.category || "—"}</td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2">
                          <SmallButton onClick={() => applyTemplate(t)}>Apply</SmallButton>
                          <SmallButton onClick={() => editTemplate(t)}>Edit</SmallButton>
                          <SmallButton tone="danger" onClick={() => requestDeleteTemplate(t.id)}>Delete</SmallButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!templates.length ? (
                    <tr>
                      <td className="p-3 text-neutral-500" colSpan={5}>
                        (no templates)
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-neutral-500 mt-3">
              Tip: Build templates for your repeat work. Then keep Trip-It in Quick Add mode most days.
            </div>
          </div>
        )}
      </ModalShell>

      {/* Main */}
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-bold tracking-tight text-neutral-900">Trip-It</div>
            <div className="text-sm text-neutral-600">Daily duty trips, mileage, and reliable backups.</div>
            <div className="mt-3 h-[2px] w-80 rounded-full bg-gradient-to-r from-lime-400/0 via-lime-400 to-emerald-400/0" />
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill tone="accent">{filteredTrips.length} trips</Pill>
              <Pill>{totals.km.toFixed(0)} km</Pill>
              <Pill>{fmtMoney(totals.costs, totals.currency)} costs</Pill>
              <Pill>{fmtDuration(totals.durationMin)} duration</Pill>
              {totals.rate ? <Pill tone="warn">{fmtMoney(totals.mileageClaim, totals.currency)} mileage</Pill> : null}
              <Pill>{periodLabel}</Pill>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SmallButton onClick={openTemplateManager}>Templates</SmallButton>
            <SmallButton onClick={weeklyBackup} title="Exports entire database (profile + templates + trips + prefs)">
              Weekly Backup
            </SmallButton>
            <SmallButton onClick={emailReport} disabled={!filteredTrips.length} title="Open email with report summary (no attachment)">
              Email
            </SmallButton>
            <SmallButton onClick={exportCSV} disabled={!filteredTrips.length}>
              Export CSV
            </SmallButton>
            <SmallButton onClick={exportJSON}>Export</SmallButton>
            <label className={`${btnPrimary} cursor-pointer`}>
              Import
              <input type="file" className="hidden" accept="application/json" onChange={(e) => importJSON(e.target.files?.[0] || null)} />
            </label>
          </div>
        </div>

        {ui.lastBackupAt ? (
          <div className="mt-3 text-xs text-neutral-500">
            Last backup: {new Date(ui.lastBackupAt).toLocaleString()}
          </div>
        ) : null}

        {/* Filters */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className={card}>
            <div className={cardHead}>
              <div className="font-semibold text-neutral-900">Filters</div>
            </div>
            <div className={`${cardPad} space-y-3`}>
              <Field label="Period">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`${btnSecondary} ${ui.period === "today" ? "border-neutral-900 bg-neutral-900 text-white" : ""}`}
                    onClick={() => setUi((p) => ({ ...p, period: "today" }))}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className={`${btnSecondary} ${ui.period === "week" ? "border-neutral-900 bg-neutral-900 text-white" : ""}`}
                    onClick={() => setUi((p) => ({ ...p, period: "week" }))}
                  >
                    This week
                  </button>
                  <button
                    type="button"
                    className={`${btnSecondary} ${ui.period === "month" ? "border-neutral-900 bg-neutral-900 text-white" : ""}`}
                    onClick={() => setUi((p) => ({ ...p, period: "month" }))}
                  >
                    Month
                  </button>
                  <button
                    type="button"
                    className={`${btnSecondary} ${ui.period === "all" ? "border-neutral-900 bg-neutral-900 text-white" : ""}`}
                    onClick={() => setUi((p) => ({ ...p, period: "all" }))}
                  >
                    All
                  </button>
                </div>

                <div className="mt-2">
                  <button
                    type="button"
                    className={`${btnSecondary} ${ui.period === "custom" ? "border-neutral-900 bg-neutral-900 text-white" : ""}`}
                    onClick={() =>
                      setUi((p) => ({
                        ...p,
                        period: "custom",
                        customFrom: p.customFrom || startOfWeekISO(isoToday()),
                        customTo: p.customTo || isoToday(),
                      }))
                    }
                  >
                    Custom range
                  </button>
                </div>

                {ui.period === "month" ? (
                  <div className="mt-2">
                    <select className={inputBase} value={ui.month} onChange={(e) => setUi((p) => ({ ...p, month: e.target.value }))}>
                      {Array.from(
                        new Set([monthKeyFromDate(isoToday()), ...trips.map((t) => monthKeyFromDate(t.date)).filter(Boolean)])
                      )
                        .sort()
                        .reverse()
                        .map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : null}

                {ui.period === "custom" ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      className={inputBase}
                      value={ui.customFrom}
                      onChange={(e) => setUi((p) => ({ ...p, customFrom: e.target.value }))}
                    />
                    <input
                      type="date"
                      className={inputBase}
                      value={ui.customTo}
                      onChange={(e) => setUi((p) => ({ ...p, customTo: e.target.value }))}
                    />
                  </div>
                ) : null}
              </Field>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Vehicle">
                  <select className={inputBase} value={ui.vehicleFilter} onChange={(e) => setUi((p) => ({ ...p, vehicleFilter: e.target.value }))}>
                    <option value="all">All</option>
                    {vehicles.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Category">
                  <select className={inputBase} value={ui.categoryFilter} onChange={(e) => setUi((p) => ({ ...p, categoryFilter: e.target.value }))}>
                    <option value="all">All</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Search">
                <input className={inputBase} value={ui.search} onChange={(e) => setUi((p) => ({ ...p, search: e.target.value }))} placeholder="Route, purpose, notes…" />
              </Field>

              <div className="flex flex-wrap gap-2">
                <SmallButton
                  tone="ghost"
                  onClick={() =>
                    setUi((p) => ({
                      ...p,
                      search: "",
                      vehicleFilter: "all",
                      categoryFilter: "all",
                      period: "month",
                      month: monthKeyFromDate(isoToday()),
                      customFrom: "",
                      customTo: "",
                    }))
                  }
                >
                  Reset
                </SmallButton>

                <SmallButton tone="ghost" onClick={() => setUi((p) => ({ ...p, showInsights: !p.showInsights }))}>
                  {ui.showInsights ? "Hide" : "Show"} insights
                </SmallButton>

                <SmallButton tone="ghost" onClick={() => setUi((p) => ({ ...p, quickMode: !p.quickMode }))}>
                  {ui.quickMode ? "Full form" : "Quick add"}
                </SmallButton>
              </div>
            </div>
          </div>

          {/* Defaults */}
          <div className={card}>
            <div className={cardHead}>
              <div className="font-semibold text-neutral-900">Defaults</div>
            </div>
            <div className={`${cardPad} space-y-3`}>
              <Field label="Organization">
                <input className={inputBase} value={profile.orgName} onChange={(e) => setProfile((p) => ({ ...p, orgName: e.target.value }))} />
              </Field>

              <Field label="Default vehicle">
                <select className={inputBase} value={profile.defaultVehicle} onChange={(e) => setProfile((p) => ({ ...p, defaultVehicle: e.target.value }))}>
                  {vehicles.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Default currency">
                  <select className={inputBase} value={profile.defaultCurrency} onChange={(e) => setProfile((p) => ({ ...p, defaultCurrency: e.target.value }))}>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="ZAR">ZAR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </Field>
                <Field label="Mileage rate (opt.)" hint="per km">
                  <input className={inputBase} value={profile.mileageRate} onChange={(e) => setProfile((p) => ({ ...p, mileageRate: e.target.value }))} placeholder="e.g., 0.30" />
                </Field>
              </div>

              <div className="text-xs text-neutral-500">
                Work routine: “This week” filter → Email/CSV if needed → Friday Weekly Backup.
              </div>
            </div>
          </div>

          {/* Insights */}
          <div className={`${card} ${ui.showInsights ? "" : "hidden lg:block lg:opacity-50"}`}>
            <div className={cardHead}>
              <div className="font-semibold text-neutral-900">Insights</div>
            </div>
            <div className={`${cardPad} space-y-3`}>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-neutral-200 p-3">
                  <div className="text-xs text-neutral-500">Trips</div>
                  <div className="text-lg font-semibold text-neutral-900 mt-1">{totals.count}</div>
                </div>
                <div className="rounded-2xl border border-neutral-200 p-3">
                  <div className="text-xs text-neutral-500">Km</div>
                  <div className="text-lg font-semibold text-neutral-900 mt-1">{totals.km.toFixed(0)}</div>
                </div>
                <div className="rounded-2xl border border-neutral-200 p-3">
                  <div className="text-xs text-neutral-500">Costs</div>
                  <div className="text-lg font-semibold text-neutral-900 mt-1">{fmtMoney(totals.costs, totals.currency)}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 p-3">
                <div className="text-xs text-neutral-500">Duration</div>
                <div className="text-lg font-semibold text-neutral-900 mt-1">{fmtDuration(totals.durationMin)}</div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-2xl border border-neutral-200 p-3">
                  <div className="text-sm font-medium text-neutral-900">By vehicle</div>
                  <div className="mt-2 space-y-2">
                    {insights.byVehicle.length ? (
                      insights.byVehicle.slice(0, 5).map((r) => (
                        <div key={r.key} className="flex items-center justify-between gap-3 text-sm">
                          <div className="min-w-0 truncate">{r.key}</div>
                          <div className="text-neutral-600 whitespace-nowrap">
                            {r.trips} • {r.km.toFixed(0)} km • {fmtMoney(r.costs, totals.currency)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-neutral-500">No data for this filter.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 p-3">
                  <div className="text-sm font-medium text-neutral-900">By category</div>
                  <div className="mt-2 space-y-2">
                    {insights.byCategory.length ? (
                      insights.byCategory.slice(0, 6).map((r) => (
                        <div key={r.key} className="flex items-center justify-between gap-3 text-sm">
                          <div className="min-w-0 truncate">{r.key}</div>
                          <div className="text-neutral-600 whitespace-nowrap">
                            {r.trips} • {r.km.toFixed(0)} km • {fmtMoney(r.costs, totals.currency)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-neutral-500">No data for this filter.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-xs text-neutral-500">Tip: “This week” + “Vehicle” = clean weekly report.</div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className={`mt-3 ${card}`}>
          <div className={`${cardHead} flex flex-wrap items-center justify-between gap-3`}>
            <div>
              <div className="font-semibold text-neutral-900">{ui.quickMode ? "Quick Add" : "Add / Edit trip"}</div>
              <div className="text-xs text-neutral-500">Required: date, from, to, purpose</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SmallButton onClick={resetForm}>New</SmallButton>
              <SmallButton tone="ghost" onClick={() => setForm((p) => ({ ...p, startTime: nowTimeHHMM() }))} title="Set start time to now">
                Start now
              </SmallButton>
              <SmallButton tone="ghost" onClick={() => setForm((p) => ({ ...p, endTime: nowTimeHHMM() }))} title="Set end time to now">
                End now
              </SmallButton>
              <SmallButton tone="ghost" onClick={() => applyTemplate(templates[0] || {})} disabled={!templates.length} title="Apply first template (fast)">
                Quick template
              </SmallButton>
              <SmallButton tone="primary" onClick={upsertTrip}>
                Save
              </SmallButton>
            </div>
          </div>

          <div className={`${cardPad} grid grid-cols-1 md:grid-cols-3 gap-3`}>
            <Field label="Date" hint="Required">
              <input type="date" className={inputBase} value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
            </Field>

            <Field label="Start time">
              <input type="time" className={inputBase} value={form.startTime} onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))} />
            </Field>

            <Field label="End time" hint={`Duration: ${fmtDuration(durationMinutes(form.startTime, form.endTime))}`}>
              <input type="time" className={inputBase} value={form.endTime} onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))} />
            </Field>

            <Field label="From" hint="Required">
              <input className={inputBase} value={form.from} onChange={(e) => setForm((p) => ({ ...p, from: e.target.value }))} placeholder="e.g., Consulate" />
            </Field>

            <Field label="To" hint="Required">
              <input className={inputBase} value={form.to} onChange={(e) => setForm((p) => ({ ...p, to: e.target.value }))} placeholder="e.g., Landshut" />
            </Field>

            <Field label="Purpose" hint="Required">
              <input className={inputBase} value={form.purpose} onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))} placeholder="e.g., Official pickup" />
            </Field>

            <Field label="Category">
              <select className={inputBase} value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Vehicle">
              <select className={inputBase} value={form.vehicle} onChange={(e) => setForm((p) => ({ ...p, vehicle: e.target.value }))}>
                {vehicles.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Passengers">
              <input className={inputBase} value={form.passengers} onChange={(e) => setForm((p) => ({ ...p, passengers: e.target.value }))} placeholder="Names or count" />
            </Field>

            <Field label="Start km">
              <input className={inputBase} value={form.startKm} onChange={(e) => setForm((p) => ({ ...p, startKm: e.target.value }))} />
            </Field>

            <Field label="End km">
              <input className={inputBase} value={form.endKm} onChange={(e) => setForm((p) => ({ ...p, endKm: e.target.value }))} />
            </Field>

            <Field label="Distance (km)" hint="auto">
              <input className={inputMuted} value={form.distanceKm} readOnly />
            </Field>

            {!ui.quickMode ? (
              <>
                <Field label="Driver">
                  <input className={inputBase} value={form.driver} onChange={(e) => setForm((p) => ({ ...p, driver: e.target.value }))} />
                </Field>

                <Field label="Fuel">
                  <input className={inputBase} value={form.fuelCost} onChange={(e) => setForm((p) => ({ ...p, fuelCost: e.target.value }))} />
                </Field>

                <Field label="Tolls">
                  <input className={inputBase} value={form.tollCost} onChange={(e) => setForm((p) => ({ ...p, tollCost: e.target.value }))} />
                </Field>

                <Field label="Parking">
                  <input className={inputBase} value={form.parkingCost} onChange={(e) => setForm((p) => ({ ...p, parkingCost: e.target.value }))} />
                </Field>

                <Field label="Other costs">
                  <input className={inputBase} value={form.otherCost} onChange={(e) => setForm((p) => ({ ...p, otherCost: e.target.value }))} />
                </Field>

                <Field label="Currency">
                  <select className={inputBase} value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="ZAR">ZAR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </Field>

                <Field label="Proof reference" hint="receipt/email/pdf link">
                  <input className={inputBase} value={form.proof} onChange={(e) => setForm((p) => ({ ...p, proof: e.target.value }))} />
                </Field>

                <div className="md:col-span-3">
                  <Field label="Notes">
                    <textarea className={`${inputBase} min-h-[100px]`} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
                  </Field>
                </div>

                <div className="md:col-span-3">
                  <SmallButton tone="primary" onClick={startNewTemplateFromForm}>
                    Save current form as template
                  </SmallButton>
                </div>
              </>
            ) : (
              <div className="md:col-span-3">
                <div className="rounded-2xl border border-neutral-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium text-neutral-900">Quick Add tips</div>
                    <div className="text-xs text-neutral-500">Switch to “Full form” for costs, proofs, notes.</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Pill>Templates button (top)</Pill>
                    <Pill>Friday: Weekly Backup</Pill>
                    <Pill>“This week” = clean report</Pill>
                    <Pill tone="accent">Fast & safe</Pill>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Trips list */}
        <div className={`mt-5 ${card}`}>
          <div className={`${cardHead} flex flex-wrap items-center justify-between gap-3`}>
            <div>
              <div className="font-semibold text-neutral-900">Trips</div>
              <div className="text-xs text-neutral-500">Your filtered working set for reporting.</div>
            </div>
            <div className="text-xs text-neutral-500">{filteredTrips.length} entries</div>
          </div>

          <div className={cardPad}>
            {filteredTrips.length ? (
              <div className="space-y-3">
                {filteredTrips.map((t) => {
                  const dist = distOf(t);
                  const costs = costsOf(t);
                  const dur = durationMinutes(t.startTime, t.endTime);
                  return (
                    <div key={t.id} className="rounded-2xl border border-neutral-200 p-4 bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-neutral-500">
                            {t.date}
                            {t.startTime ? ` • ${t.startTime}` : ""}
                            {t.endTime ? `–${t.endTime}` : ""}
                          </div>
                          <div className="text-lg font-semibold text-neutral-900 truncate">
                            {t.from} → {t.to}
                          </div>
                          <div className="text-sm text-neutral-700 mt-1">{t.purpose || "—"}</div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <Pill>{t.vehicle || "vehicle"}</Pill>
                            <Pill>{t.category || "category"}</Pill>
                            {dist ? <Pill>{dist.toFixed(0)} km</Pill> : <Pill>km —</Pill>}
                            {dur ? <Pill>{fmtDuration(dur)}</Pill> : <Pill>dur —</Pill>}
                            {costs ? <Pill>{fmtMoney(costs, t.currency || totals.currency)}</Pill> : <Pill>costs —</Pill>}
                            {t.proof ? <Pill tone="accent">proof ✓</Pill> : <Pill>proof —</Pill>}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <SmallButton onClick={() => editTrip(t)}>Edit</SmallButton>
                          <SmallButton onClick={() => duplicateTrip(t)}>Duplicate</SmallButton>
                          <SmallButton tone="danger" onClick={() => requestDelete(t.id)}>
                            Delete
                          </SmallButton>
                        </div>
                      </div>

                      {(t.passengers || t.driver || t.notes) && !ui.quickMode ? (
                        <div className="mt-3 text-sm text-neutral-600">
                          {t.driver ? (
                            <div>
                              <span className="text-neutral-500">Driver:</span> {t.driver}
                            </div>
                          ) : null}
                          {t.passengers ? (
                            <div>
                              <span className="text-neutral-500">Passengers:</span> {t.passengers}
                            </div>
                          ) : null}
                          {t.notes ? <div className="mt-2 whitespace-pre-wrap">{t.notes}</div> : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-neutral-500">No trips for this filter yet.</div>
            )}
          </div>
        </div>

        {toast ? (
          <div className="fixed bottom-6 right-6 rounded-2xl bg-neutral-900 text-white px-4 py-3 shadow-xl print:hidden">
            <div className="text-sm">{toast}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
