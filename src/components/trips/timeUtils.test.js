import { describe, expect, it } from "vitest";
import { adjustTimeByMinutes, freshLegTimes, isValidTime, roundTimeToFiveMinutes, updateLegTime, validateLegTimes } from "./timeUtils.js";

describe("leg time utilities", () => {
  it("accepts valid 24-hour HH:mm values", () => expect(["00:00", "08:15", "23:59"].every(isValidTime)).toBe(true));
  it("rejects malformed or out-of-range values", () => expect(["8:15", "24:00", "12:60", "", null].every((value) => !isValidTime(value))).toBe(true));
  it("rounds local device time to five minutes", () => expect(roundTimeToFiveMinutes(new Date(2026, 0, 1, 8, 13))).toBe("08:15"));
  it("adds minutes within an hour", () => expect(adjustTimeByMinutes("08:10", 5)).toBe("08:15"));
  it("subtracts minutes within an hour", () => expect(adjustTimeByMinutes("08:20", -5)).toBe("08:15"));
  it("crosses midnight forward", () => expect(adjustTimeByMinutes("23:55", 5)).toBe("00:00"));
  it("crosses midnight backward", () => expect(adjustTimeByMinutes("00:05", -15)).toBe("23:50"));
  it("defaults a first leg to rounded now with an empty end", () => expect(freshLegTimes("", new Date(2026, 0, 1, 8, 13))).toEqual({ startTime: "08:15", endTime: "" }));
  it("inherits a valid previous end time", () => expect(freshLegTimes("09:05", new Date(2026, 0, 1, 10, 0))).toEqual({ startTime: "09:05", endTime: "" }));
  it("falls back to rounded now when the previous end is invalid", () => expect(freshLegTimes("bad", new Date(2026, 0, 1, 10, 2))).toEqual({ startTime: "10:00", endTime: "" }));
  it("Now-style updates change only the selected field", () => expect(updateLegTime({ startTime: "08:00", endTime: "", note: "keep" }, "endTime", roundTimeToFiveMinutes(new Date(2026, 0, 1, 9, 3)))).toEqual({ startTime: "08:00", endTime: "09:05", note: "keep" }));
  it("minute adjustments change only the selected field", () => expect(updateLegTime({ startTime: "08:00", endTime: "09:00", note: "keep" }, "startTime", adjustTimeByMinutes("08:00", 15))).toEqual({ startTime: "08:15", endTime: "09:00", note: "keep" }));
  it("does not default over stored edit times", () => expect(updateLegTime({ startTime: "07:35", endTime: "08:40" }, "endTime", "08:45")).toEqual({ startTime: "07:35", endTime: "08:45" }));
  it("rejects malformed and earlier end times", () => { expect(validateLegTimes({ startTime: "bad", endTime: "09:00" }).ok).toBe(false); expect(validateLegTimes({ startTime: "10:00", endTime: "09:00" }).errors.endTime).toContain("earlier"); });
});
