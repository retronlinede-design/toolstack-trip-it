import { replaceDatasetTransactional, rollbackTransactional } from "./importTransaction.js";

export function mergeDatasetTransactional(options) {
  const currentValidation = options.validate(options.currentData);
  if (!currentValidation.ok) return { ok: false, code: "CURRENT_SCHEMA_INVALID", errors: currentValidation.errors };
  const candidateValidation = options.validate(options.candidate);
  if (!candidateValidation.ok) return { ok: false, code: "MERGE_SCHEMA_INVALID", errors: candidateValidation.errors };
  return replaceDatasetTransactional({ ...options, snapshotLabel: "pre-merge" });
}

export function rollbackMergeTransactional(options) {
  return rollbackTransactional(options);
}
