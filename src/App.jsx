import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * ToolStack — Trip-It (Duty Trip Log) — MVP
 *
 * Goal: Consulate-friendly duty-trip logging + printable trip report.
 *
 * Features:
 * - Log trips (date, from/to, purpose, vehicle, driver, passengers)
 * - Odometer start/end -> auto distance
 * - Costs (fuel/tolls/parking/other) + currency
 * - Month filter + totals
 * - Print Preview that prints ONLY the report sheet
 * - Export/Import JSON + Export CSV
 * - Autosave to localStorage
 */

const LS_KEY = "toolstack_tripit_v1";
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

function Pill({ children }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-slate-200 bg-white text-slate-700">
      {children}
    </span>
  );
}

function SmallButton({ children, onClick, tone = "default", disabled, title, className = "", type = "button" }) {
  const cls =
    tone === "primary"
      ? "bg-slate-900 hover:bg-slate-800 text-white border-slate-900"
      : tone === "danger"
        ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-700"
        : "bg-white hover:bg-slate-50 text-slate-900 border-slate-200";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`print:hidden px-3 py-2 rounded-xl text-sm font-medium border transition disabled:opacity-50 disabled:cursor-not-allowed ${cls} ${className}`}
    >
      {children}
    </button>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm text-slate-700 font-medium">{label}</label>
        {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
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
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-lg">
        <div className="p-4 border-b border-slate-100">
          <div className="text-lg font-semibold text-slate-900">{title}</div>
          <div className="text-sm text-slate-600 mt-1">{message}</div>
        </div>
        <div className="p-4 flex items-center justify-end gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 transition"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-xl text-sm font-medium border border-rose-700 bg-rose-600 hover:bg-rose-700 text-white transition"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

const blankTrip = () => ({
  id: uid(),
  date: isoToday(),
  startTime: "",
  endTime: "",
  from: "",
  to: "",
  purpose: "",
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
  proof: "", // link or note: "Email saved", "PDF stored", etc.
});

export default function TripItApp() {
  const [profile, setProfile] = useState({
    orgName: "South African Consulate, Munich",
    defaultVehicle: "BMW 530i",
    defaultCurrency: "EUR",
    mileageRate: "", // optional
  });

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
    return t;
  });

  const [ui, setUi] = useState({
    month: monthKeyFromDate(isoToday()),
    search: "",
    previewOpen: false,
  });

  const [confirm, setConfirm] = useState({ open: false, tripId: null });
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notify = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  };

  // Load profile too
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    const data = saved ? safeParse(saved, null) : null;
    if (data?.profile) {
      setProfile((p) => ({ ...p, ...data.profile }));
      setForm((f) => ({
        ...f,
        vehicle: data.profile.defaultVehicle || f.vehicle,
        currency: data.profile.defaultCurrency || f.currency,
      }));
    }
  }, []);

  // Autosave
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ profile, trips }));
  }, [profile, trips]);

  // Keep form distance updated
  useEffect(() => {
    const d = km(form.endKm) - km(form.startKm);
    if (form.startKm !== "" && form.endKm !== "" && Number.isFinite(d)) {
      setForm((p) => ({ ...p, distanceKm: d >= 0 ? String(d) : p.distanceKm }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.startKm, form.endKm]);

  const monthOptions = useMemo(() => {
    const ms = new Set(trips.map((t) => monthKeyFromDate(t.date)).filter(Boolean));
    ms.add(monthKeyFromDate(isoToday()));
    return Array.from(ms).sort().reverse();
  }, [trips]);

  const filteredTrips = useMemo(() => {
    const m = ui.month;
    const q = (ui.search || "").trim().toLowerCase();

    return trips
      .filter((t) => (m ? monthKeyFromDate(t.date) === m : true))
      .filter((t) => {
        if (!q) return true;
        const hay = [t.from, t.to, t.purpose, t.vehicle, t.driver, t.passengers, t.notes].join(" ").toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.id || "").localeCompare(a.id || ""));
  }, [trips, ui.month, ui.search]);

  const totals = useMemo(() => {
    const list = filteredTrips;
    const sumKm = list.reduce((acc, t) => acc + km(t.distanceKm || (km(t.endKm) - km(t.startKm))), 0);
    const sumFuel = list.reduce((acc, t) => acc + money(t.fuelCost), 0);
    const sumToll = list.reduce((acc, t) => acc + money(t.tollCost), 0);
    const sumPark = list.reduce((acc, t) => acc + money(t.parkingCost), 0);
    const sumOther = list.reduce((acc, t) => acc + money(t.otherCost), 0);
    const sumCosts = sumFuel + sumToll + sumPark + sumOther;
    const rate = money(profile.mileageRate);
    const mileageClaim = rate ? sumKm * rate : 0;

    // currency: assume consistent; show chosen profile currency label
    const currency = profile.defaultCurrency || "EUR";

    return {
      count: list.length,
      km: sumKm,
      fuel: sumFuel,
      toll: sumToll,
      parking: sumPark,
      other: sumOther,
      costs: sumCosts,
      mileageClaim,
      currency,
      rate,
    };
  }, [filteredTrips, profile.mileageRate, profile.defaultCurrency]);

  const resetForm = () => {
    const t = blankTrip();
    t.vehicle = profile.defaultVehicle || t.vehicle;
    t.currency = profile.defaultCurrency || t.currency;
    setForm(t);
  };

  const validate = () => {
    if (!form.date) return "Date is required";
    if (!String(form.from || "").trim()) return "From is required";
    if (!String(form.to || "").trim()) return "To is required";
    if (!String(form.purpose || "").trim()) return "Purpose is required";
    // Optional: odometer
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
      const normalized = {
        ...form,
        vehicle: form.vehicle || profile.defaultVehicle || "",
        currency: form.currency || profile.defaultCurrency || "EUR",
      };
      if (exists) return prev.map((t) => (t.id === form.id ? normalized : t));
      return [normalized, ...prev];
    });

    notify("Saved");
    // Keep month filter synced to saved trip
    setUi((p) => ({ ...p, month: monthKeyFromDate(form.date) || p.month }));
    resetForm();
  };

  const editTrip = (t) => {
    setForm({ ...blankTrip(), ...t });
    notify("Loaded into form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const duplicateTrip = (t) => {
    const copy = { ...t, id: uid() };
    setForm({ ...blankTrip(), ...copy });
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

  const exportJSON = () => {
    downloadBlob("toolstack-trip-it.json", JSON.stringify({ profile, trips }, null, 2), "application/json");
  };

  const importJSON = async (file) => {
    if (!file) return;
    const text = await file.text();
    const parsed = safeParse(text, null);
    if (!parsed || !Array.isArray(parsed.trips)) {
      notify("Invalid JSON");
      return;
    }
    setProfile((p) => ({ ...p, ...(parsed.profile || {}) }));
    setTrips(parsed.trips);
    notify("Imported");
  };

  const exportCSV = () => {
    const rows = [
      [
        "date",
        "startTime",
        "endTime",
        "from",
        "to",
        "purpose",
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
        t.from,
        t.to,
        (t.purpose || "").replaceAll("\n", " "),
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
    const name = `toolstack-trip-it-${ui.month || "all"}.csv`;
    downloadBlob(name, csv, "text/csv");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Print rules */}
      <style>{`
        @media print { .print\\:hidden { display: none !important; } }
      `}</style>

      {ui.previewOpen ? (
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
        title="Delete trip?"
        message="This will permanently delete this trip log entry."
        onCancel={() => setConfirm({ open: false, tripId: null })}
        onConfirm={deleteNow}
      />

      {/* Print Preview */}
      {ui.previewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
          <div className="absolute inset-0 bg-black/40" onClick={() => setUi((p) => ({ ...p, previewOpen: false }))} />
          <div className="relative w-full max-w-6xl">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-lg font-semibold text-white">Trip report</div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-2 rounded-xl text-sm font-medium border border-white/40 bg-white/10 hover:bg-white/15 text-white transition"
                  onClick={() => window.print()}
                >
                  Print / Save PDF
                </button>
                <button
                  className="px-3 py-2 rounded-xl text-sm font-medium border border-white/40 bg-white/10 hover:bg-white/15 text-white transition"
                  onClick={() => setUi((p) => ({ ...p, previewOpen: false }))}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-slate-200 shadow-lg overflow-auto max-h-[80vh]">
              <div id="tripit-print" className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-2xl font-semibold text-slate-900">Trip Report</div>
                    <div className="text-sm text-slate-600 mt-1">{profile.orgName || "—"}</div>
                    <div className="text-sm text-slate-600">Period: {ui.month || "All"}</div>
                  </div>
                  <div className="text-sm text-slate-600">Generated: {new Date().toLocaleString()}</div>
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="text-xs text-slate-500">Trips</div>
                    <div className="text-xl font-semibold text-slate-900 mt-1">{totals.count}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="text-xs text-slate-500">Total km</div>
                    <div className="text-xl font-semibold text-slate-900 mt-1">{totals.km.toFixed(0)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="text-xs text-slate-500">Out-of-pocket costs</div>
                    <div className="text-xl font-semibold text-slate-900 mt-1">{fmtMoney(totals.costs, totals.currency)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="text-xs text-slate-500">Mileage claim</div>
                    <div className="text-xl font-semibold text-slate-900 mt-1">{totals.rate ? fmtMoney(totals.mileageClaim, totals.currency) : "—"}</div>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="text-left p-3">Date</th>
                        <th className="text-left p-3">Route</th>
                        <th className="text-left p-3">Purpose</th>
                        <th className="text-left p-3">Vehicle</th>
                        <th className="text-right p-3">Km</th>
                        <th className="text-right p-3">Costs</th>
                        <th className="text-left p-3">Proof</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTrips.map((t) => {
                        const dist = km(t.distanceKm || (km(t.endKm) - km(t.startKm)));
                        const costs = money(t.fuelCost) + money(t.tollCost) + money(t.parkingCost) + money(t.otherCost);
                        return (
                          <tr key={t.id} className="border-t border-slate-100">
                            <td className="p-3">{t.date}</td>
                            <td className="p-3">{t.from} → {t.to}</td>
                            <td className="p-3">{t.purpose || "—"}</td>
                            <td className="p-3">{t.vehicle || "—"}</td>
                            <td className="p-3 text-right">{dist ? dist.toFixed(0) : "—"}</td>
                            <td className="p-3 text-right">{costs ? fmtMoney(costs, t.currency || totals.currency) : "—"}</td>
                            <td className="p-3">{t.proof || "—"}</td>
                          </tr>
                        );
                      })}
                      {!filteredTrips.length ? (
                        <tr>
                          <td className="p-3 text-slate-500" colSpan={7}>(no trips)</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 text-xs text-slate-500">ToolStack • Trip-It</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Main */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold text-slate-900">Trip-It</div>
            <div className="text-sm text-slate-600">Duty trips, mileage, and printable reports.</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Pill>{filteredTrips.length} trips</Pill>
              <Pill>{totals.km.toFixed(0)} km</Pill>
              <Pill>{fmtMoney(totals.costs, totals.currency)} costs</Pill>
              {totals.rate ? <Pill>{fmtMoney(totals.mileageClaim, totals.currency)} mileage</Pill> : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SmallButton onClick={() => setUi((p) => ({ ...p, previewOpen: true }))}>Preview</SmallButton>
            <SmallButton onClick={() => window.print()} disabled={!filteredTrips.length}>Print / Save PDF</SmallButton>
            <SmallButton onClick={exportCSV} disabled={!filteredTrips.length}>Export CSV</SmallButton>
            <SmallButton onClick={exportJSON}>Export</SmallButton>
            <label className="print:hidden px-3 py-2 rounded-xl text-sm font-medium bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 cursor-pointer">
              Import
              <input type="file" className="hidden" accept="application/json" onChange={(e) => importJSON(e.target.files?.[0] || null)} />
            </label>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white shadow-sm border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="font-semibold text-slate-900">Defaults</div>
            </div>
            <div className="p-4 space-y-3">
              <Field label="Organization">
                <input className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" value={profile.orgName} onChange={(e) => setProfile((p) => ({ ...p, orgName: e.target.value }))} />
              </Field>
              <Field label="Default vehicle">
                <input className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" value={profile.defaultVehicle} onChange={(e) => setProfile((p) => ({ ...p, defaultVehicle: e.target.value }))} />
              </Field>
              <Field label="Default currency">
                <select className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" value={profile.defaultCurrency} onChange={(e) => setProfile((p) => ({ ...p, defaultCurrency: e.target.value }))}>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="ZAR">ZAR</option>
                  <option value="GBP">GBP</option>
                </select>
              </Field>
              <Field label="Mileage rate (optional)" hint="per km">
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={profile.mileageRate}
                  onChange={(e) => setProfile((p) => ({ ...p, mileageRate: e.target.value }))}
                  placeholder="e.g., 0.30"
                />
              </Field>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-2 rounded-2xl bg-white shadow-sm border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-900">Add / Edit trip</div>
                <div className="text-xs text-slate-500">Required: date, from, to, purpose</div>
              </div>
              <div className="flex items-center gap-2">
                <SmallButton onClick={resetForm}>New</SmallButton>
                <SmallButton tone="primary" onClick={upsertTrip}>Save</SmallButton>
              </div>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Date" hint="Required">
                <input type="date" className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
              </Field>
              <Field label="Start time">
                <input type="time" className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" value={form.startTime} onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))} />
              </Field>
              <Field label="End time">
                <input type="time" className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" value={form.endTime} onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))} />
              </Field>

              <Field label="From" hint="Required">
                <input className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" value={form.from} onChange={(e) => setForm((p) => ({ ...p, from: e.target.value }))} placeholder="e.g., Consulate" />
              </Field>
              <Field label="To" hint="Required">
                <input className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" value={form.to} onChange={(e) => setForm((p) => ({ ...p, to: e.target.value }))} placeholder="e.g., Landshut" />
              </Field>
              <Field label="Purpose" hint="Required">
                <input className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" value={form.purpose} onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))} placeholder="e.g., Official pickup" />
              </Field>

              <Field label="Vehicle">
                <input className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" value={form.vehicle} onChange={(e) => setForm((p) => ({ ...p, vehicle: e.target.value }))} />
              </Field>
              <Field label="Driver">
                <input className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" value={form.driver} onChange={(e) => setForm((p) => ({ ...p, driver: e.target.value }))} />
              </Field>
              <Field label="Passengers">
                <input className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" value={form.passengers} onChange={(e) => setForm((p) => ({ ...p, passengers: e.target.value }))} placeholder="Names or count" />
              </Field>

              <Field label="Start km">
                <input className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" value={form.startKm} onChange={(e) => setForm((p) => ({ ...p, startKm: e.target.value }))} />
              </Field>
              <Field label="End km">
                <input className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" value={form.endKm} onChange={(e) => setForm((p) => ({ ...p, endKm: e.target.value }))} />
              </Field>
              <Field label="Distance (km)" hint="auto">
                <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" value={form.distanceKm} readOnly />
              </Field>

              <Field label="Fuel">
                <input className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" value={form.fuelCost} onChange={(e) => setForm((p) => ({ ...p, fuelCost: e.target.value }))} />
              </Field>
              <Field label="Tolls">
                <input className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" value={form.tollCost} onChange={(e) => setForm((p) => ({ ...p, tollCost: e.target.value }))} />
              </Field>
              <Field label="Parking">
                <input className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" value={form.parkingCost} onChange={(e) => setForm((p) => ({ ...p, parkingCost: e.target.value }))} />
              </Field>

              <Field label="Other costs">
                <input className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" value={form.otherCost} onChange={(e) => setForm((p) => ({ ...p, otherCost: e.target.value }))} />
              </Field>
              <Field label="Currency">
                <select className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="ZAR">ZAR</option>
                  <option value="GBP">GBP</option>
                </select>
              </Field>
              <Field label="Proof reference" hint="receipt/email/pdf link">
                <input className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" value={form.proof} onChange={(e) => setForm((p) => ({ ...p, proof: e.target.value }))} />
              </Field>

              <div className="md:col-span-3">
                <Field label="Notes">
                  <textarea className="w-full min-h-[90px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
                </Field>
              </div>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="mt-5 rounded-2xl bg-white shadow-sm border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-slate-900">Trips</div>
              <div className="text-xs text-slate-500">Filter by month and export reports.</div>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="print:hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                value={ui.month}
                onChange={(e) => setUi((p) => ({ ...p, month: e.target.value }))}
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <input
                className="print:hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm w-64"
                value={ui.search}
                onChange={(e) => setUi((p) => ({ ...p, search: e.target.value }))}
                placeholder="Search route/purpose…"
              />
              <SmallButton onClick={() => setUi((p) => ({ ...p, previewOpen: true }))} disabled={!filteredTrips.length}>Preview</SmallButton>
            </div>
          </div>

          <div className="p-4">
            {filteredTrips.length ? (
              <div className="space-y-3">
                {filteredTrips.map((t) => {
                  const dist = km(t.distanceKm || (km(t.endKm) - km(t.startKm)));
                  const costs = money(t.fuelCost) + money(t.tollCost) + money(t.parkingCost) + money(t.otherCost);
                  return (
                    <div key={t.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-slate-500">{t.date}{t.startTime ? ` • ${t.startTime}` : ""}{t.endTime ? `–${t.endTime}` : ""}</div>
                          <div className="text-lg font-semibold text-slate-900 truncate">{t.from} → {t.to}</div>
                          <div className="text-sm text-slate-700 mt-1">{t.purpose || "—"}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Pill>{t.vehicle || "vehicle"}</Pill>
                            {dist ? <Pill>{dist.toFixed(0)} km</Pill> : <Pill>km —</Pill>}
                            {costs ? <Pill>{fmtMoney(costs, t.currency || totals.currency)}</Pill> : <Pill>costs —</Pill>}
                            {t.proof ? <Pill>proof ✓</Pill> : <Pill>proof —</Pill>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <SmallButton onClick={() => editTrip(t)}>Edit</SmallButton>
                          <SmallButton onClick={() => duplicateTrip(t)}>Duplicate</SmallButton>
                          <SmallButton tone="danger" onClick={() => requestDelete(t.id)}>Delete</SmallButton>
                        </div>
                      </div>

                      {(t.passengers || t.driver || t.notes) ? (
                        <div className="mt-3 text-sm text-slate-600">
                          {t.driver ? <div><span className="text-slate-500">Driver:</span> {t.driver}</div> : null}
                          {t.passengers ? <div><span className="text-slate-500">Passengers:</span> {t.passengers}</div> : null}
                          {t.notes ? <div className="mt-2 whitespace-pre-wrap">{t.notes}</div> : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No trips for this filter yet.</div>
            )}
          </div>
        </div>

        {toast ? (
          <div className="fixed bottom-6 right-6 rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-lg print:hidden">
            <div className="text-sm">{toast}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
