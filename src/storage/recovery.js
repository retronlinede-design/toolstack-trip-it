import { writeVerified } from "./storage.js";

export function timestampToken(now = new Date()) {
  return now.toISOString().replace(/[:.]/g, "-");
}

export function preserveRecoveryRaw(primaryKey, raw, storage, now = new Date()) {
  const recoveryKey = `${primaryKey}.recovery.${timestampToken(now)}`;
  const result = writeVerified(recoveryKey, raw, storage);
  return result.ok
    ? { ok: true, status: "preserved", recoveryKey, timestamp: now.toISOString(), raw }
    : { ...result, recoveryKey, timestamp: now.toISOString(), raw };
}

export function replaceCorruptWithEmpty({ primaryKey, raw, emptyData, confirm, storage, now = new Date() }) {
  if (!confirm()) return { ok: false, status: "cancelled" };
  const preservation = preserveRecoveryRaw(primaryKey, raw, storage, now);
  if (!preservation.ok) return { ...preservation, phase: "preserve_recovery" };
  const serialized = JSON.stringify(emptyData);
  const written = writeVerified(primaryKey, serialized, storage);
  if (!written.ok) return { ...written, phase: "write_empty", preservation };
  return { ok: true, status: "replaced", preservation, data: emptyData };
}

export function downloadRawRecovery(raw, filename = "tripit-recovery.txt") {
  const blob = new Blob([raw], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
