export function validApp() {
  return {
    vehicles: [{ id: "v1", name: "Car", make: "", model: "", plate: "", vin: "", notes: "" }],
    activeVehicleId: "v1",
    activeTripByVehicle: { v1: { id: "active-1", vehicleId: "v1", title: "Active", startDate: "2026-07-11", status: "active", legs: [{ id: "al1", odoStart: 10, odoEnd: 11, km: 1 }] } },
    tripsByVehicle: { v1: [{ id: "t1", vehicleId: "v1", title: "Done", startDate: "2026-07-10", status: "finished", legs: [{ id: "l1", odoStart: 1, odoEnd: 5, km: 4 }] }] },
    fuelByVehicle: { v1: [{ id: "f1", date: "2026-07-10", odometer: 5, liters: 2, totalCost: 4, currency: "EUR" }] },
    washByVehicle: { v1: [{ id: "w1", date: "2026-07-10", cost: 3 }] },
    ui: { month: "2026-07" },
    templates: [{ id: "tpl1", type: "trip", name: "Work", data: { title: "Work" } }],
  };
}

export const clone = (value) => JSON.parse(JSON.stringify(value));
