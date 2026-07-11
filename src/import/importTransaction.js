import { readJson, readRaw, writeVerified } from "../storage/storage.js";
import { timestampToken } from "../storage/recovery.js";

const failure = (code, message, extra = {}) => ({ ok: false, code, errors: [{ code, path: "$transaction", message }], ...extra });

export function replaceDatasetTransactional({ primaryKey, currentData, candidate, validate, storage, now = new Date(), snapshotLabel = "pre-import" }) {
  const currentSerialized = JSON.stringify(currentData);
  const candidateSerialized = JSON.stringify(candidate);
  const snapshotKey = `${primaryKey}.${snapshotLabel}.${timestampToken(now)}`;
  const snapshot = writeVerified(snapshotKey, currentSerialized, storage);
  if (!snapshot.ok) return failure("SNAPSHOT_FAILED", "Current data could not be preserved and verified. Import was aborted.", { phase: "snapshot", snapshotKey, currentSerialized, candidateSerialized, storageResult: snapshot });

  const candidateWrite = writeVerified(primaryKey, candidateSerialized, storage);
  if (!candidateWrite.ok) {
    const restoration = writeVerified(primaryKey, currentSerialized, storage);
    return failure(candidateWrite.status === "verification_failed" ? "CANDIDATE_VERIFY_FAILED" : "CANDIDATE_WRITE_FAILED", "Candidate data could not be written and verified. Current data was retained or restored.", { phase: "candidate_write", snapshotKey, currentSerialized, candidateSerialized, restoration, storageResult: candidateWrite });
  }

  const readBack = readJson(primaryKey, storage);
  const validation = readBack.ok ? validate(readBack.value) : null;
  if (!readBack.ok || !validation?.ok) {
    const restoration = writeVerified(primaryKey, currentSerialized, storage);
    return failure("CANDIDATE_VERIFY_FAILED", "Stored candidate failed post-write parsing or validation. Current data was restored.", { phase: "post_write_validation", snapshotKey, currentSerialized, candidateSerialized, restoration, validation, storageResult: readBack });
  }
  return { ok: true, code: "IMPORTED", data: readBack.value, snapshotKey, currentSerialized, candidateSerialized };
}

export function rollbackTransactional({ primaryKey, rollbackKey, currentData, validate, storage, now = new Date() }) {
  const snapshot = readRaw(rollbackKey, storage);
  if (!snapshot.ok || snapshot.status !== "present") return failure("ROLLBACK_SOURCE_FAILED", "Pre-import rollback data could not be read.", { storageResult: snapshot });
  let candidate;
  try { candidate = JSON.parse(snapshot.raw); }
  catch { return failure("ROLLBACK_SOURCE_FAILED", "Pre-import rollback data is not valid JSON."); }
  const validation = validate(candidate);
  if (!validation.ok) return failure("ROLLBACK_SOURCE_FAILED", "Pre-import rollback data failed schema validation.", { validation });
  return replaceDatasetTransactional({ primaryKey, currentData, candidate, validate, storage, now, snapshotLabel: "pre-rollback" });
}

export function applyTransactionResult(result, setState) {
  if (!result.ok) return false;
  setState(result.data);
  return true;
}
