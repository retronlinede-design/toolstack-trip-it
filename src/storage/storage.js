export function resolveStorage(storage) {
  if (storage) return { ok: true, storage };
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return { ok: false, status: "unavailable", error: new Error("localStorage is unavailable") };
    }
    return { ok: true, storage: window.localStorage };
  } catch (error) {
    return { ok: false, status: "unavailable", error };
  }
}

export function readRaw(key, storage) {
  const resolved = resolveStorage(storage);
  if (!resolved.ok) return resolved;
  try {
    const raw = resolved.storage.getItem(key);
    return raw === null
      ? { ok: true, status: "missing", raw: null }
      : { ok: true, status: "present", raw };
  } catch (error) {
    return { ok: false, status: "read_failed", error };
  }
}

export function readJson(key, storage) {
  const result = readRaw(key, storage);
  if (!result.ok || result.status === "missing") return result;
  try {
    return { ok: true, status: "valid", raw: result.raw, value: JSON.parse(result.raw) };
  } catch (error) {
    return { ok: false, status: "corrupt", raw: result.raw, error };
  }
}

export function writeVerified(key, serialized, storage) {
  const resolved = resolveStorage(storage);
  if (!resolved.ok) return resolved;
  try {
    resolved.storage.setItem(key, serialized);
  } catch (error) {
    return { ok: false, status: "write_failed", error };
  }

  const readBack = readRaw(key, resolved.storage);
  if (!readBack.ok) return { ...readBack, status: "readback_failed" };
  if (readBack.status !== "present" || readBack.raw !== serialized) {
    return {
      ok: false,
      status: "verification_failed",
      expected: serialized,
      actual: readBack.raw,
      error: new Error("Stored value did not match the intended value"),
    };
  }
  return { ok: true, status: "verified", raw: readBack.raw };
}

export function removeKey(key, storage) {
  const resolved = resolveStorage(storage);
  if (!resolved.ok) return resolved;
  try {
    resolved.storage.removeItem(key);
    return { ok: true, status: "removed" };
  } catch (error) {
    return { ok: false, status: "remove_failed", error };
  }
}

export function removeVerified(key, storage) {
  const removed = removeKey(key, storage);
  if (!removed.ok) return removed;
  const readBack = readRaw(key, storage);
  if (!readBack.ok) return { ...readBack, status: "remove_readback_failed" };
  if (readBack.status !== "missing") {
    return { ok: false, status: "remove_verification_failed", actual: readBack.raw, error: new Error("Removed key is still present") };
  }
  return { ok: true, status: "removed_verified" };
}
