const finiteOdometer = (value) => value !== "" && Number.isFinite(Number(String(value).replace(",", ".")));

export function calculatePendingDistance(start, end) {
  if (!finiteOdometer(start) || !finiteOdometer(end)) return { status: "incomplete", label: "— km" };
  const distance = Number(String(end).replace(",", ".")) - Number(String(start).replace(",", "."));
  if (distance < 0) return { status: "invalid", label: "End odometer is below start odometer." };
  return { status: "valid", value: distance, label: `${distance.toFixed(1)} km` };
}

export function peopleSummary(driver, passengers, labels = {}) {
  const driverLabel = String(driver || "").trim() || (labels.noDriver || "No driver");
  const count = Array.isArray(passengers) ? passengers.length : 0;
  return `${driverLabel} · ${count ? `${count} ${count === 1 ? "passenger" : "passengers"}` : (labels.noPassengers || "No passengers")}`;
}

export function optionalDetailsSummary(form) {
  const tags = [form.startTag, form.endTag].filter((value) => String(value || "").trim()).length;
  const parts = [];
  if (String(form.note || "").trim()) parts.push("Note added");
  if (tags) parts.push(`${tags} ${tags === 1 ? "tag" : "tags"}`);
  return parts.length ? parts.join(" · ") : "Notes, tags and template details";
}

export function buildPendingLegSummary(form) {
  const route = [form.startPlace, form.endPlace].filter(Boolean).join(" → ");
  const time = form.startTime || form.endTime ? `${form.startTime || "—"}–${form.endTime || "—"}` : "";
  const distance = calculatePendingDistance(form.odoStart, form.odoEnd);
  return { route: route || "Route incomplete", journey: [time, distance.label].filter(Boolean).join(" · "), people: peopleSummary(form.driver, form.passengers), warning: distance.status === "invalid" ? distance.label : "" };
}

export const shouldShowRouteSuggestions = (focusedField, field, value) => focusedField === field || !!String(value || "").trim();
export const initialPeopleExpanded = (editing, form, invalid = false) => !!(invalid || (editing && (form.driver || form.passengers?.length)));
export const hasPeopleValidationError = (form) => typeof form.driver !== "string" || form.driver.length > 150 || !Array.isArray(form.passengers) || form.passengers.length > 50 || form.passengers.some((name) => typeof name !== "string" || name.length > 150);
export const legActionLabel = (editing) => editing ? "Update Leg" : "Add Leg";
