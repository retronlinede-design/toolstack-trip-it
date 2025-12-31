import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * ToolStack — Trip-It (Duty Trip Log) — Styled v1
 *
 * Changes (per Retro request):
 * 1) No default seeded data (new installs start empty)
 * 2) Vehicle manager (add/edit/delete vehicles)
 * 3) Trips are stored per-vehicle (select vehicle → log trips for that vehicle only)
 * 4) Normalized top actions grid (mobile-aligned buttons)
 * 5) Migration: if legacy data exists, migrate to one "Imported vehicle"
 */

const LS_KEY = "toolstack_tripit_v1";

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

const todayISO = () => new Date().toISOString().slice(0, 10);

const toNumber = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const money = (v, currency = "EUR") => {
  const n = toNumber(v);
  const sym = currency === "EUR" ? "€" : currency === "USD" ? "$" : `${currency} `;
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

// ---------- Normalized top actions (mobile grid) ----------
const ACTION_BASE =
  "print:hidden h-10 w-full rounded-xl text-sm font-medium border transition shadow-sm active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center";

function ActionButton({ children, onClick, tone = "default", disabled, title }) {
  const cls =
    tone === "primary"
      ? "bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-900"
      : tone === "danger"
        ? "bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
        : "bg-white hover:bg-neutral-50 text-neutral-900 border-neutral-200";

  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={`${ACTION_BASE} ${cls}`}>
      {children}
    </button>
  );
}

function ActionFileButton({ children, onFile, accept = "application/json", tone = "primary", title }) {
  const cls =
    tone === "primary"
      ? "bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-900"
      : "bg-white hover:bg-neutral-50 text-neutral-900 border-neutral-200";

  return (
    <label title={title} className={`${ACTION_BASE} ${cls} cursor-pointer`}>
      <span>{children}</span>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile?.(e.target.files?.[0] || null)}
      />
    </label>
  );
}

// ---------- UI helpers ----------
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
        : "border-neutral-200 bg-white text-neutral-700";
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}>{children}</span>;
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

// ---------- Data model ----------
/**
 * app = {
 *   vehicles: [{ id, name, make, model, plate, vin, notes }],
 *   activeVehicleId: string|null,
 *   tripsByVehicle: { [vehicleId]: Trip[] },
 *   ui: { month: "YYYY-MM" },
 * }
 *
 * Trip = { id, date, from, to, purpose, driver, passengers, odoStart, odoEnd, distance, costs:{fuel,tolls,parking,other,currency}, notes }
 */

function emptyApp() {
  return {
    vehicles: [],
    activeVehicleId: null,
    tripsByVehicle: {},
    ui: { month: monthKey(todayISO()) },
  };
}

function normalizeApp(raw) {
  const base = emptyApp();
  const a = raw && typeof raw === "object" ? raw : base;

  const vehicles = Array.isArray(a.vehicles) ? a.vehicles.filter(Boolean) : [];
  const tripsByVehicle = a.tripsByVehicle && typeof a.tripsByVehicle === "object" ? a.tripsByVehicle : {};
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
  }

  // Ensure activeVehicleId exists
  let activeVehicleId = a.activeVehicleId || null;
  if (activeVehicleId && !normVehicles.some((x) => x.id === activeVehicleId)) activeVehicleId = null;
  if (!activeVehicleId && normVehicles.length) activeVehicleId = normVehicles[0].id;

  const month = typeof ui.month === "string" && ui.month ? ui.month : base.ui.month;

  return {
    vehicles: normVehicles,
    activeVehicleId,
    tripsByVehicle: normTripsByVehicle,
    ui: { month },
  };
}

// Legacy migration (best-effort):
// If saved data has a `trips` array (old format), migrate into one Imported vehicle
function migrateLegacyIfNeeded(saved) {
  if (!saved || typeof saved !== "object") return null;

  // Already new model?
  if (Array.isArray(saved.vehicles) || saved.tripsByVehicle) return saved;

  // Common legacy patterns: { trips: [...] } or { items: [...] } etc.
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
    ui: { month: monthKey(todayISO()) },
  };
}

export default function App() {
  const [app, setApp] = useState(() => {
    const savedRaw = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    const saved = savedRaw ? safeParse(savedRaw, null) : null;

    const migrated = migrateLegacyIfNeeded(saved);
    const normalized = normalizeApp(migrated ?? emptyApp());
    return normalized;
  });

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const [previewOpen, setPreviewOpen] = useState(false);

  const [vehicleModal, setVehicleModal] = useState({ open: false, mode: "new", vehicleId: null });
  const [confirm, setConfirm] = useState({ open: false, kind: null, id: null });

  const notify = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  };

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(app));
  }, [app]);

  const activeVehicle = useMemo(
    () => app.vehicles.find((v) => v.id === app.activeVehicleId) || null,
    [app.vehicles, app.activeVehicleId]
  );

  const trips = useMemo(() => {
    if (!activeVehicle) return [];
    return Array.isArray(app.tripsByVehicle[activeVehicle.id]) ? app.tripsByVehicle[activeVehicle.id] : [];
  }, [app.tripsByVehicle, activeVehicle]);

  const tripsForMonth = useMemo(() => {
    const m = app.ui.month;
    return trips.filter((t) => monthKey(t.date) === m).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [trips, app.ui.month]);

  const totals = useMemo(() => {
    const distance = tripsForMonth.reduce((s, t) => s + toNumber(t.distance), 0);
    const fuel = tripsForMonth.reduce((s, t) => s + toNumber(t.costs?.fuel), 0);
    const tolls = tripsForMonth.reduce((s, t) => s + toNumber(t.costs?.tolls), 0);
    const parking = tripsForMonth.reduce((s, t) => s + toNumber(t.costs?.parking), 0);
    const other = tripsForMonth.reduce((s, t) => s + toNumber(t.costs?.other), 0);
    const currency = tripsForMonth.find((t) => t.costs?.currency)?.costs?.currency || "EUR";
    const totalCost = fuel + tolls + parking + other;
    return { distance, fuel, tolls, parking, other, totalCost, currency, count: tripsForMonth.length };
  }, [tripsForMonth]);

  const setMonth = (m) => setApp((a) => ({ ...a, ui: { ...a.ui, month: m } }));

  // ---------- Vehicle CRUD ----------
  const openNewVehicle = () => setVehicleModal({ open: true, mode: "new", vehicleId: null });
  const openEditVehicle = (id) => setVehicleModal({ open: true, mode: "edit", vehicleId: id });

  const saveVehicle = (vehicle) => {
    setApp((a) => {
      const exists = a.vehicles.some((v) => v.id === vehicle.id);
      const vehicles = exists ? a.vehicles.map((v) => (v.id === vehicle.id ? vehicle : v)) : [vehicle, ...a.vehicles];
      const tripsByVehicle = { ...a.tripsByVehicle };
      if (!tripsByVehicle[vehicle.id]) tripsByVehicle[vehicle.id] = [];
      const activeVehicleId = a.activeVehicleId || vehicle.id;
      return normalizeApp({ ...a, vehicles, tripsByVehicle, activeVehicleId });
    });
    setVehicleModal({ open: false, mode: "new", vehicleId: null });
    notify("Vehicle saved");
  };

  const requestDeleteVehicle = (id) => setConfirm({ open: true, kind: "vehicle", id });
  const deleteVehicleNow = () => {
    const id = confirm.id;
    setApp((a) => {
      const vehicles = a.vehicles.filter((v) => v.id !== id);
      const tripsByVehicle = { ...a.tripsByVehicle };
      delete tripsByVehicle[id];

      let activeVehicleId = a.activeVehicleId;
      if (activeVehicleId === id) activeVehicleId = vehicles.length ? vehicles[0].id : null;

      return normalizeApp({ ...a, vehicles, tripsByVehicle, activeVehicleId });
    });
    setConfirm({ open: false, kind: null, id: null });
    notify("Vehicle deleted");
  };

  const selectVehicle = (id) => setApp((a) => ({ ...a, activeVehicleId: id }));

  // ---------- Trip CRUD ----------
  const addTrip = () => {
    if (!activeVehicle) {
      notify("Add a vehicle first");
      return;
    }
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
      const tripsByVehicle = { ...a.tripsByVehicle, [activeVehicle.id]: [t, ...list] };
      return { ...a, tripsByVehicle };
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

        // auto distance when odo fields change (unless distance explicitly set)
        const odoStart = merged.odoStart;
        const odoEnd = merged.odoEnd;
        const dist = Math.max(0, toNumber(odoEnd) - toNumber(odoStart));
        merged.distance = dist;

        // ensure nested costs
        merged.costs = { ...t.costs, ...patch.costs };
        return merged;
      });
      return { ...a, tripsByVehicle: { ...a.tripsByVehicle, [activeVehicle.id]: next } };
    });
  };

  const deleteTrip = (tripId) => {
    if (!activeVehicle) return;
    setApp((a) => {
      const list = Array.isArray(a.tripsByVehicle[activeVehicle.id]) ? a.tripsByVehicle[activeVehicle.id] : [];
      const next = list.filter((t) => t.id !== tripId);
      return { ...a, tripsByVehicle: { ...a.tripsByVehicle, [activeVehicle.id]: next } };
    });
    notify("Trip deleted");
  };

  // ---------- Export / Import ----------
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(app, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `toolstack-trip-it.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importJSON = async (file) => {
    if (!file) return;
    const text = await file.text();
    const parsed = safeParse(text, null);
    if (!parsed) {
      notify("Invalid JSON");
      return;
    }
    const migrated = migrateLegacyIfNeeded(parsed);
    const normalized = normalizeApp(migrated ?? emptyApp());
    setApp(normalized);
    notify("Imported");
  };

  const exportCSVView = () => {
    if (!activeVehicle) {
      notify("Select a vehicle first");
      return;
    }
    const rows = [];
    rows.push([
      "vehicle_name",
      "vehicle_make",
      "vehicle_model",
      "vehicle_plate",
      "month",
      "date",
      "from",
      "to",
      "purpose",
      "driver",
      "passengers",
      "odo_start",
      "odo_end",
      "distance",
      "fuel",
      "tolls",
      "parking",
      "other",
      "currency",
      "notes",
    ]);

    const v = activeVehicle;
    const m = app.ui.month;

    for (const t of tripsForMonth) {
      rows.push([
        v.name,
        v.make,
        v.model,
        v.plate,
        m,
        t.date,
        t.from,
        t.to,
        t.purpose,
        t.driver,
        t.passengers,
        t.odoStart,
        t.odoEnd,
        String(toNumber(t.distance).toFixed(1)),
        String(toNumber(t.costs?.fuel).toFixed(2)),
        String(toNumber(t.costs?.tolls).toFixed(2)),
        String(toNumber(t.costs?.parking).toFixed(2)),
        String(toNumber(t.costs?.other).toFixed(2)),
        t.costs?.currency || "EUR",
        (t.notes || "").replace(/\r?\n/g, " ").trim(),
      ]);
    }

    const csv = rows
      .map((r) =>
        r
          .map((cell) => {
            const s = String(cell ?? "");
            const escaped = s.replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    const safeName = (v.name || "vehicle").replace(/[^\w\-]+/g, "_").slice(0, 32);
    a.download = `trip-it_${safeName}_${m}.csv`;

    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // ---------- Print preview ----------
  const openPreview = () => {
    if (!activeVehicle) {
      notify("Select a vehicle first");
      return;
    }
    setPreviewOpen(true);
  };

  // ---------- Modals ----------
  const vehicleFormVehicle = useMemo(() => {
    if (!vehicleModal.open) return null;
    if (vehicleModal.mode === "new") {
      return { id: uid(), name: "", make: "", model: "", plate: "", vin: "", notes: "" };
    }
    const v = app.vehicles.find((x) => x.id === vehicleModal.vehicleId);
    return v ? { ...v } : { id: uid(), name: "", make: "", model: "", plate: "", vin: "", notes: "" };
  }, [vehicleModal, app.vehicles]);

  const [vehicleDraft, setVehicleDraft] = useState(null);
  useEffect(() => {
    if (vehicleFormVehicle) setVehicleDraft(vehicleFormVehicle);
  }, [vehicleFormVehicle]);

  const vehicleSaveDisabled = useMemo(() => {
    const n = String(vehicleDraft?.name || "").trim();
    return !n;
  }, [vehicleDraft]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Print rules */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          .print\\:p-0 { padding: 0 !important; }
        }
      `}</style>

      {/* When preview is open, print only preview sheet */}
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
        message="This will delete the vehicle and all trips saved under it."
        onCancel={() => setConfirm({ open: false, kind: null, id: null })}
        onConfirm={deleteVehicleNow}
      />

      {/* Vehicle modal */}
      {vehicleModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
          <div className="absolute inset-0 bg-black/40" onClick={() => setVehicleModal({ open: false, mode: "new", vehicleId: null })} />
          <div className="relative w-full max-w-2xl rounded-2xl bg-white border border-neutral-200 shadow-xl overflow-hidden">
            <div className="p-4 border-b border-neutral-100 flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-neutral-900">
                  {vehicleModal.mode === "new" ? "Add vehicle" : "Edit vehicle"}
                </div>
                <div className="text-sm text-neutral-600 mt-1">Create and manage vehicles so trips are logged per vehicle.</div>
                <div className="mt-3 h-[2px] w-52 rounded-full bg-gradient-to-r from-lime-400/0 via-lime-400 to-emerald-400/0" />
              </div>
              <button
                className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-900 transition"
                onClick={() => setVehicleModal({ open: false, mode: "new", vehicleId: null })}
              >
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
              <button
                className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-900 transition"
                onClick={() => setVehicleModal({ open: false, mode: "new", vehicleId: null })}
              >
                Cancel
              </button>
              <button
                className={`px-3 py-2 rounded-xl text-sm font-medium border transition ${
                  vehicleSaveDisabled
                    ? "border-neutral-200 bg-neutral-100 text-neutral-400 cursor-not-allowed"
                    : "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800"
                }`}
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
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-lg font-semibold text-white">Print preview</div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-2 rounded-xl text-sm font-medium border border-white/40 bg-white/10 hover:bg-white/15 text-white transition"
                  onClick={() => window.print()}
                >
                  Print / Save PDF
                </button>
                <button
                  className="px-3 py-2 rounded-xl text-sm font-medium border border-white/40 bg-white/10 hover:bg-white/15 text-white transition"
                  onClick={() => setPreviewOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-neutral-200 shadow-xl overflow-auto max-h-[80vh]">
              <div id="tripit-print" className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-2xl font-semibold text-neutral-900">Trip-It</div>
                    <div className="text-sm text-neutral-600">
                      {activeVehicle?.name || "(no vehicle)"} • {monthLabel(app.ui.month)}
                    </div>
                    <div className="mt-3 h-[2px] w-72 rounded-full bg-gradient-to-r from-lime-400/0 via-lime-400 to-emerald-400/0" />
                    <div className="mt-3 text-sm text-neutral-700">
                      <div className="font-medium text-neutral-900">Vehicle info</div>
                      <div className="text-neutral-600">
                        {activeVehicle?.make || "-"} {activeVehicle?.model || ""} • Plate: {activeVehicle?.plate || "-"}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-neutral-600">Generated: {new Date().toLocaleString()}</div>
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="text-sm text-neutral-600">Trips</div>
                    <div className="text-2xl font-semibold text-neutral-900 mt-1">{totals.count}</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="text-sm text-neutral-600">Distance</div>
                    <div className="text-2xl font-semibold text-neutral-900 mt-1">{totals.distance.toFixed(1)} km</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="text-sm text-neutral-600">Costs</div>
                    <div className="text-2xl font-semibold text-neutral-900 mt-1">{money(totals.totalCost, totals.currency)}</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <div className="text-sm text-neutral-600">Fuel</div>
                    <div className="text-2xl font-semibold text-neutral-900 mt-1">{money(totals.fuel, totals.currency)}</div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-neutral-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-neutral-100 font-semibold text-neutral-900">
                    Trips ({monthLabel(app.ui.month)})
                  </div>
                  <div className="p-4 space-y-3">
                    {tripsForMonth.length === 0 ? (
                      <div className="text-sm text-neutral-600">No trips logged for this month.</div>
                    ) : (
                      tripsForMonth.map((t) => (
                        <div key={t.id} className="rounded-2xl border border-neutral-200 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-neutral-900">
                                {t.date} • {t.from || "-"} → {t.to || "-"}
                              </div>
                              <div className="text-sm text-neutral-600 mt-1">
                                Purpose: {t.purpose || "-"} • Driver: {t.driver || "-"}
                              </div>
                              {t.notes ? <div className="text-sm text-neutral-700 mt-2 whitespace-pre-wrap">{t.notes}</div> : null}
                            </div>
                            <div className="text-sm text-neutral-600 text-right">
                              <div className="font-semibold text-neutral-900">{toNumber(t.distance).toFixed(1)} km</div>
                              <div className="mt-1">{money(toNumber(t.costs?.fuel) + toNumber(t.costs?.tolls) + toNumber(t.costs?.parking) + toNumber(t.costs?.other), t.costs?.currency || "EUR")}</div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-5 text-xs text-neutral-500">ToolStack • Trip-It</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-2xl font-semibold text-neutral-900">Trip-It</div>
            <div className="text-sm text-neutral-600">Log duty trips per vehicle. Export, print, and keep a clean record.</div>
            <div className="mt-3 h-[2px] w-80 rounded-full bg-gradient-to-r from-lime-400/0 via-lime-400 to-emerald-400/0" />
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill tone="accent">{activeVehicle ? activeVehicle.name : "No vehicle selected"}</Pill>
              <Pill>{monthLabel(app.ui.month)}</Pill>
              <Pill>{totals.count} trips</Pill>
              <Pill>{totals.distance.toFixed(1)} km</Pill>
              <Pill>{money(totals.totalCost, totals.currency)}</Pill>
            </div>
          </div>

          {/* Top actions (normalized grid) */}
          <div className="w-full sm:w-[720px]">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <ActionButton onClick={openPreview} disabled={!activeVehicle}>
                Preview
              </ActionButton>
              <ActionButton onClick={() => window.print()} disabled={!activeVehicle}>
                Print / Save PDF
              </ActionButton>
              <ActionButton onClick={exportJSON}>Export</ActionButton>
              <ActionFileButton onFile={(f) => importJSON(f)} tone="primary">
                Import
              </ActionFileButton>
              <ActionButton onClick={exportCSVView} disabled={!activeVehicle}>
                Export CSV
              </ActionButton>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Left: Vehicle + Month */}
          <div className={card}>
            <div className={`${cardHead} flex items-center justify-between`}>
              <div className="font-semibold text-neutral-900">Vehicle & Month</div>
              <button
                className="print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white shadow-sm hover:bg-neutral-50 active:translate-y-[1px] transition"
                onClick={openNewVehicle}
              >
                + Add vehicle
              </button>
            </div>

            <div className={`${cardPad} space-y-3`}>
              <div>
                <label className="text-sm font-medium text-neutral-700">Active vehicle</label>
                {app.vehicles.length ? (
                  <select
                    className={`${inputBase} mt-2`}
                    value={app.activeVehicleId || ""}
                    onChange={(e) => selectVehicle(e.target.value)}
                  >
                    {app.vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="mt-2 text-sm text-neutral-600">
                    No vehicles yet. Click <span className="font-medium">Add vehicle</span> to start.
                  </div>
                )}
              </div>

              {activeVehicle ? (
                <div className="rounded-2xl border border-neutral-200 p-4">
                  <div className="font-semibold text-neutral-900">{activeVehicle.name}</div>
                  <div className="text-sm text-neutral-600 mt-1">
                    {(activeVehicle.make || "-") + " " + (activeVehicle.model || "")}
                  </div>
                  <div className="text-sm text-neutral-600">Plate: {activeVehicle.plate || "-"}</div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      className="print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white shadow-sm hover:bg-neutral-50 active:translate-y-[1px] transition"
                      onClick={() => openEditVehicle(activeVehicle.id)}
                    >
                      Edit
                    </button>
                    <button
                      className="print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-red-200 bg-red-50 text-red-700 shadow-sm hover:bg-red-100 active:translate-y-[1px] transition"
                      onClick={() => requestDeleteVehicle(activeVehicle.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : null}

              <div>
                <label className="text-sm font-medium text-neutral-700">Month</label>
                <input
                  type="month"
                  className={`${inputBase} mt-2`}
                  value={app.ui.month}
                  onChange={(e) => setMonth(e.target.value)}
                  disabled={!activeVehicle}
                />
              </div>

              <div className="text-xs text-neutral-500">
                Trips are stored per-vehicle. Select a vehicle to log and view its trips.
              </div>
            </div>
          </div>

          {/* Middle/Right: Trips */}
          <div className="lg:col-span-2 space-y-3">
            <div className={card}>
              <div className={`${cardHead} flex items-center justify-between gap-3`}>
                <div className="font-semibold text-neutral-900">Trips</div>
                <button
                  className={`print:hidden px-3 py-2 rounded-xl text-sm font-medium border shadow-sm active:translate-y-[1px] transition ${
                    activeVehicle
                      ? "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800"
                      : "border-neutral-200 bg-neutral-100 text-neutral-400 cursor-not-allowed"
                  }`}
                  onClick={addTrip}
                  disabled={!activeVehicle}
                >
                  + Add trip
                </button>
              </div>

              <div className={`${cardPad} space-y-3`}>
                {!activeVehicle ? (
                  <div className="text-sm text-neutral-600">Add a vehicle to start logging trips.</div>
                ) : tripsForMonth.length === 0 ? (
                  <div className="text-sm text-neutral-600">No trips for this month yet. Click “Add trip”.</div>
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
                            <input
                              className={inputBase}
                              value={t.from}
                              onChange={(e) => updateTrip(t.id, { from: e.target.value })}
                              placeholder="From"
                            />
                            <input
                              className={inputBase}
                              value={t.to}
                              onChange={(e) => updateTrip(t.id, { to: e.target.value })}
                              placeholder="To"
                            />
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <label className="text-xs text-neutral-600 font-medium">Purpose</label>
                          <input
                            className={`${inputBase} mt-2`}
                            value={t.purpose}
                            onChange={(e) => updateTrip(t.id, { purpose: e.target.value })}
                            placeholder="e.g., Consulate duty trip"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-neutral-600 font-medium">Driver</label>
                          <input
                            className={`${inputBase} mt-2`}
                            value={t.driver}
                            onChange={(e) => updateTrip(t.id, { driver: e.target.value })}
                            placeholder="Driver"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-neutral-600 font-medium">Passengers</label>
                          <input
                            className={`${inputBase} mt-2`}
                            value={t.passengers}
                            onChange={(e) => updateTrip(t.id, { passengers: e.target.value })}
                            placeholder="Optional"
                          />
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
                          <div className={`${inputBase} mt-2 text-right tabular-nums bg-neutral-50 border-neutral-200`}>
                            {toNumber(t.distance).toFixed(1)} km
                          </div>
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
                              title="Fuel"
                            />
                            <input
                              className={`${inputBase} text-right tabular-nums`}
                              inputMode="decimal"
                              value={t.costs?.tolls ?? 0}
                              onChange={(e) => updateTrip(t.id, { costs: { ...t.costs, tolls: e.target.value } })}
                              placeholder="Tolls"
                              title="Tolls"
                            />
                            <input
                              className={`${inputBase} text-right tabular-nums`}
                              inputMode="decimal"
                              value={t.costs?.parking ?? 0}
                              onChange={(e) => updateTrip(t.id, { costs: { ...t.costs, parking: e.target.value } })}
                              placeholder="Parking"
                              title="Parking"
                            />
                            <input
                              className={`${inputBase} text-right tabular-nums`}
                              inputMode="decimal"
                              value={t.costs?.other ?? 0}
                              onChange={(e) => updateTrip(t.id, { costs: { ...t.costs, other: e.target.value } })}
                              placeholder="Other"
                              title="Other"
                            />
                            <select
                              className={inputBase}
                              value={t.costs?.currency || "EUR"}
                              onChange={(e) => updateTrip(t.id, { costs: { ...t.costs, currency: e.target.value } })}
                              title="Currency"
                            >
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
                          <textarea
                            className={`${inputBase} mt-2 min-h-[70px]`}
                            value={t.notes}
                            onChange={(e) => updateTrip(t.id, { notes: e.target.value })}
                            placeholder="Optional notes..."
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-end">
                        <button
                          className="print:hidden px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white shadow-sm hover:bg-neutral-50 active:translate-y-[1px] transition"
                          onClick={() => deleteTrip(t.id)}
                        >
                          Delete trip
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Summary card */}
            <div className={card}>
              <div className={cardHead}>
                <div className="font-semibold text-neutral-900">Month summary</div>
              </div>
              <div className={`${cardPad} grid grid-cols-1 md:grid-cols-4 gap-3`}>
                <div className="rounded-2xl border border-neutral-200 p-4">
                  <div className="text-sm text-neutral-600">Trips</div>
                  <div className="text-2xl font-semibold text-neutral-900 mt-1">{totals.count}</div>
                </div>
                <div className="rounded-2xl border border-neutral-200 p-4">
                  <div className="text-sm text-neutral-600">Distance</div>
                  <div className="text-2xl font-semibold text-neutral-900 mt-1">{totals.distance.toFixed(1)} km</div>
                </div>
                <div className="rounded-2xl border border-neutral-200 p-4">
                  <div className="text-sm text-neutral-600">Fuel</div>
                  <div className="text-2xl font-semibold text-neutral-900 mt-1">{money(totals.fuel, totals.currency)}</div>
                </div>
                <div className="rounded-2xl border border-neutral-200 p-4">
                  <div className="text-sm text-neutral-600">Total costs</div>
                  <div className="text-2xl font-semibold text-neutral-900 mt-1">{money(totals.totalCost, totals.currency)}</div>
                </div>
              </div>
            </div>
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
