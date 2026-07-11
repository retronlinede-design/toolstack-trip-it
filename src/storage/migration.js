import { readJson, readRaw, removeKey, writeVerified } from "./storage.js";
import { timestampToken } from "./recovery.js";

export function migrateLegacyTransactional({
  legacyKey,
  destinationKey,
  transform,
  validate = (value) => value !== null && typeof value === "object",
  storage,
  now = new Date(),
}) {
  const legacy = readRaw(legacyKey, storage);
  if (!legacy.ok) return { ...legacy, phase: "read_legacy" };
  if (legacy.status === "missing") return { ok: true, status: "no_legacy" };

  let parsed;
  let migrated;
  try {
    parsed = JSON.parse(legacy.raw);
    migrated = transform(parsed);
  } catch (error) {
    return { ok: false, status: "invalid_legacy", phase: "parse_or_normalize", error, legacyRaw: legacy.raw };
  }

  const serialized = JSON.stringify(migrated);
  const written = writeVerified(destinationKey, serialized, storage);
  if (!written.ok) return { ...written, phase: "write_destination", legacyRaw: legacy.raw };

  const destination = readJson(destinationKey, storage);
  if (!destination.ok || !validate(destination.value, migrated)) {
    return {
      ok: false,
      status: "invalid_destination",
      phase: "validate_destination",
      error: destination.error || new Error("Migrated destination is invalid"),
      legacyRaw: legacy.raw,
    };
  }

  const backupKey = `${destinationKey}.migration-backup.${timestampToken(now)}`;
  const backup = writeVerified(backupKey, legacy.raw, storage);
  if (!backup.ok) return { ...backup, phase: "backup_legacy", backupKey, legacyRaw: legacy.raw };

  const removed = removeKey(legacyKey, storage);
  if (!removed.ok) return { ...removed, phase: "remove_legacy", backupKey, legacyRaw: legacy.raw };

  return {
    ok: true,
    status: "migrated",
    data: destination.value,
    backupKey,
    legacyRaw: legacy.raw,
  };
}
