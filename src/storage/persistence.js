export function persistenceFromResult(result, previous = {}) {
  if (result.ok) {
    return {
      status: "saved",
      lastSavedAt: result.savedAt || new Date().toISOString(),
      revision: result.revision ?? previous.revision ?? 0,
      error: null,
    };
  }
  return {
    ...previous,
    status: result.status === "unavailable" ? "unavailable" : "failed",
    error: result.error || new Error(result.status || "Persistence failed"),
  };
}

export function canShowSavedFeedback(persistence) {
  return persistence.status === "saved";
}

export function requiresDestructiveConfirmation(persistence) {
  return persistence.status === "failed" || persistence.status === "unavailable";
}
