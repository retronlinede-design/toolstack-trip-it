import { describe, expect, it } from "vitest";
import { canShowSavedFeedback, persistenceFromResult, requiresDestructiveConfirmation } from "./persistence.js";

describe("persistence status", () => {
  it("enters a persistent failure state and guards destructive actions", () => {
    const state = persistenceFromResult({ ok: false, status: "verification_failed" }, { status: "saving", lastSavedAt: "earlier" });
    expect(state.status).toBe("failed");
    expect(state.lastSavedAt).toBe("earlier");
    expect(canShowSavedFeedback(state)).toBe(false);
    expect(requiresDestructiveConfirmation(state)).toBe(true);
  });

  it("a verified retry clears failure and allows saved feedback", () => {
    const failed = persistenceFromResult({ ok: false, status: "write_failed" }, { status: "saving" });
    const saved = persistenceFromResult({ ok: true, savedAt: "2026-07-11T12:00:00.000Z", revision: 4 }, failed);
    expect(saved).toEqual({ status: "saved", lastSavedAt: "2026-07-11T12:00:00.000Z", revision: 4, error: null });
    expect(canShowSavedFeedback(saved)).toBe(true);
    expect(requiresDestructiveConfirmation(saved)).toBe(false);
  });
});
