export const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value) {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

export function roundTimeToFiveMinutes(now = new Date()) {
  const interval = 5 * 60 * 1000;
  const rounded = new Date(Math.round(now.getTime() / interval) * interval);
  return `${String(rounded.getHours()).padStart(2, "0")}:${String(rounded.getMinutes()).padStart(2, "0")}`;
}

export function adjustTimeByMinutes(value, minutes) {
  if (!isValidTime(value)) return value;
  const [hours, currentMinutes] = value.split(":").map(Number);
  const minutesInDay = 24 * 60;
  const adjusted = ((hours * 60 + currentMinutes + minutes) % minutesInDay + minutesInDay) % minutesInDay;
  return `${String(Math.floor(adjusted / 60)).padStart(2, "0")}:${String(adjusted % 60).padStart(2, "0")}`;
}

export function freshLegTimes(previousEndTime, now = new Date()) {
  return { startTime: isValidTime(previousEndTime) ? previousEndTime : roundTimeToFiveMinutes(now), endTime: "" };
}

export function updateLegTime(form, field, value) {
  if (field !== "startTime" && field !== "endTime") return form;
  return { ...form, [field]: value };
}

export function validateLegTimes({ startTime, endTime }) {
  const errors = {};
  if (!isValidTime(startTime)) errors.startTime = startTime ? "Start time must use HH:mm." : "Start time is required.";
  if (!isValidTime(endTime)) errors.endTime = endTime ? "End time must use HH:mm." : "End time is required.";
  // The current leg schema has no end date, so an earlier end cannot safely be inferred as overnight.
  if (!errors.startTime && !errors.endTime && endTime < startTime) errors.endTime = "End time is earlier than start time. Check the entered times.";
  return { ok: Object.keys(errors).length === 0, errors };
}
