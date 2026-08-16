import { readJson, readRaw, removeVerified, writeVerified } from "../storage/storage.js";
import { timestampToken } from "../storage/recovery.js";
import { rollbackTransactional } from "./importTransaction.js";

export const FULL_REPLACE_MANIFEST_KIND = "tripit-full-replace";
export const FULL_REPLACE_MANIFEST_VERSION = 1;

const failure = (code, message, extra = {}) => ({ ok: false, code, errors: [{ code, path: "$transaction", message }], ...extra });

function manifestValid(value) {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && value.transactionVersion === FULL_REPLACE_MANIFEST_VERSION
    && value.kind === FULL_REPLACE_MANIFEST_KIND
    && value.app?.present === true && typeof value.app.raw === "string"
    && typeof value.profile?.present === "boolean"
    && (value.profile.present ? typeof value.profile.raw === "string" : value.profile.raw === null)
    && typeof value.profile.stateRaw === "string";
}

function createManifest({ currentData, currentProfile, profileRawResult }) {
  return {
    transactionVersion: FULL_REPLACE_MANIFEST_VERSION,
    kind: FULL_REPLACE_MANIFEST_KIND,
    app: { present: true, raw: JSON.stringify(currentData) },
    profile: {
      present: profileRawResult.status === "present",
      raw: profileRawResult.status === "present" ? profileRawResult.raw : null,
      stateRaw: JSON.stringify(currentProfile),
    },
  };
}

function parseAndValidateApp(raw, validateApp) {
  let value;
  try { value = JSON.parse(raw); }
  catch (error) { return { ok: false, error, validation: null }; }
  const validation = validateApp(value);
  return validation.ok ? { ok: true, value, validation } : { ok: false, value, validation };
}

function restoreApp(primaryKey, raw, validateApp, storage) {
  const written = writeVerified(primaryKey, raw, storage);
  if (!written.ok) return { ...written, phase: "write" };
  const readBack = readJson(primaryKey, storage);
  const validation = readBack.ok && readBack.status === "valid" ? validateApp(readBack.value) : null;
  return readBack.ok && readBack.status === "valid" && validation?.ok
    ? { ok: true, status: "restored_verified", data: readBack.value }
    : { ok: false, status: "restore_validation_failed", phase: "validate", storageResult: readBack, validation };
}

function restoreProfile(profileKey, snapshot, storage) {
  if (snapshot.present) return writeVerified(profileKey, snapshot.raw, storage);
  return removeVerified(profileKey, storage);
}

function restoreGeneration({ primaryKey, profileKey, manifest, validateApp, storage, restoreProfileDomain = true }) {
  const app = restoreApp(primaryKey, manifest.app.raw, validateApp, storage);
  const profile = restoreProfileDomain ? restoreProfile(profileKey, manifest.profile, storage) : { ok: true, status: "untouched" };
  return { app, profile, complete: !!app.ok && !!profile.ok, partial: app.ok !== profile.ok };
}

function readProfileState(manifest) {
  try { return { ok: true, value: JSON.parse(manifest.profile.stateRaw) }; }
  catch (error) { return { ok: false, error }; }
}

function snapshotManifest({ primaryKey, profileKey, label, currentData, currentProfile, validateApp, storage, now }) {
  const currentValidation = validateApp(currentData);
  if (!currentValidation.ok) return failure("CURRENT_APP_INVALID", "Current application data is invalid; Replace was aborted.", { phase: "current_validation", validation: currentValidation });
  const profileRaw = readRaw(profileKey, storage);
  if (!profileRaw.ok) return failure("PROFILE_SNAPSHOT_READ_FAILED", "Current profile storage could not be read; Replace was aborted.", { phase: "profile_snapshot_read", storageResult: profileRaw });
  let manifest;
  let serialized;
  try { manifest = createManifest({ currentData, currentProfile, profileRawResult: profileRaw }); serialized = JSON.stringify(manifest); }
  catch (error) { return failure("SNAPSHOT_SERIALIZE_FAILED", "The pre-operation snapshot could not be serialized.", { phase: "snapshot_serialize", error }); }
  const snapshotKey = `${primaryKey}.${label}.${timestampToken(now)}`;
  const snapshot = writeVerified(snapshotKey, serialized, storage);
  if (!snapshot.ok) return failure("SNAPSHOT_FAILED", "The combined application/profile snapshot could not be written and verified.", { phase: "snapshot", snapshotKey, manifest, storageResult: snapshot });
  return { ok: true, snapshotKey, manifest, serialized };
}

export function replaceFullBackupTransactional({ primaryKey, profileKey, currentData, currentProfile, candidate, importedProfile, profileSupplied = importedProfile !== undefined && importedProfile !== null, validateApp, validateProfile, storage, now = new Date() }) {
  const candidateValidation = validateApp(candidate);
  if (!candidateValidation.ok) return failure("CANDIDATE_APP_INVALID", "Imported application data failed validation.", { phase: "candidate_validation", validation: candidateValidation });
  if (profileSupplied) {
    const profileValidation = validateProfile(importedProfile);
    if (!profileValidation.ok) return failure("CANDIDATE_PROFILE_INVALID", "Imported profile failed validation.", { phase: "profile_candidate_validation", validation: profileValidation });
  }

  const snap = snapshotManifest({ primaryKey, profileKey, label: "pre-import-full", currentData, currentProfile, validateApp, storage, now });
  if (!snap.ok) return snap;

  let candidateSerialized;
  try { candidateSerialized = JSON.stringify(candidate); }
  catch (error) { return failure("CANDIDATE_SERIALIZE_FAILED", "Imported application data could not be serialized.", { phase: "candidate_serialize", snapshotKey: snap.snapshotKey, error }); }
  const appWrite = writeVerified(primaryKey, candidateSerialized, storage);
  if (!appWrite.ok) {
    const restoration = restoreGeneration({ primaryKey, profileKey, manifest: snap.manifest, validateApp, storage, restoreProfileDomain: false });
    return failure("CANDIDATE_APP_WRITE_FAILED", "Imported application data could not be written and verified.", { phase: "app_candidate_write", snapshotKey: snap.snapshotKey, storageResult: appWrite, restoration, currentSerialized: snap.manifest.app.raw, candidateSerialized });
  }
  const appReadBack = readJson(primaryKey, storage);
  const appReadValidation = appReadBack.ok && appReadBack.status === "valid" ? validateApp(appReadBack.value) : null;
  if (!appReadBack.ok || appReadBack.status !== "valid" || !appReadValidation?.ok) {
    const restoration = restoreGeneration({ primaryKey, profileKey, manifest: snap.manifest, validateApp, storage, restoreProfileDomain: false });
    return failure("CANDIDATE_APP_VERIFY_FAILED", "Stored application data failed readback validation.", { phase: "app_post_write_validation", snapshotKey: snap.snapshotKey, storageResult: appReadBack, validation: appReadValidation, restoration, currentSerialized: snap.manifest.app.raw, candidateSerialized });
  }

  let profileData = currentProfile;
  if (profileSupplied) {
    let profileSerialized;
    try { profileSerialized = JSON.stringify(importedProfile); }
    catch (error) {
      const restoration = restoreGeneration({ primaryKey, profileKey, manifest: snap.manifest, validateApp, storage });
      return failure("CANDIDATE_PROFILE_SERIALIZE_FAILED", "Imported profile could not be serialized.", { phase: "profile_candidate_serialize", snapshotKey: snap.snapshotKey, error, restoration, currentSerialized: snap.manifest.app.raw, candidateSerialized });
    }
    const profileWrite = writeVerified(profileKey, profileSerialized, storage);
    if (!profileWrite.ok) {
      const restoration = restoreGeneration({ primaryKey, profileKey, manifest: snap.manifest, validateApp, storage });
      return failure("CANDIDATE_PROFILE_WRITE_FAILED", "Imported profile could not be written and verified.", { phase: "profile_candidate_write", snapshotKey: snap.snapshotKey, storageResult: profileWrite, restoration, currentSerialized: snap.manifest.app.raw, candidateSerialized });
    }
    const profileReadBack = readJson(profileKey, storage);
    const profileValidation = profileReadBack.ok && profileReadBack.status === "valid" ? validateProfile(profileReadBack.value) : null;
    if (!profileReadBack.ok || profileReadBack.status !== "valid" || !profileValidation?.ok) {
      const restoration = restoreGeneration({ primaryKey, profileKey, manifest: snap.manifest, validateApp, storage });
      return failure("CANDIDATE_PROFILE_VERIFY_FAILED", "Stored profile failed readback validation.", { phase: "profile_post_write_validation", snapshotKey: snap.snapshotKey, storageResult: profileReadBack, validation: profileValidation, restoration, currentSerialized: snap.manifest.app.raw, candidateSerialized });
    }
    profileData = profileReadBack.value;
  }
  return { ok: true, code: "FULL_REPLACE_IMPORTED", data: appReadBack.value, profileApplied: profileSupplied, profileData, snapshotKey: snap.snapshotKey, currentSerialized: snap.manifest.app.raw, candidateSerialized };
}

export function rollbackFullBackupTransactional({ primaryKey, profileKey, rollbackKey, currentData, currentProfile, validateApp, storage, now = new Date() }) {
  const source = readRaw(rollbackKey, storage);
  if (!source.ok || source.status !== "present") return failure("ROLLBACK_SOURCE_FAILED", "Rollback data could not be read.", { phase: "rollback_source", storageResult: source });
  let manifest;
  try { manifest = JSON.parse(source.raw); }
  catch { return rollbackTransactional({ primaryKey, rollbackKey, currentData, validate: validateApp, storage, now }); }
  if (!manifestValid(manifest)) {
    const hasManifestMarker = !!manifest && typeof manifest === "object" && (Object.prototype.hasOwnProperty.call(manifest, "kind") || Object.prototype.hasOwnProperty.call(manifest, "transactionVersion"));
    if (!hasManifestMarker && validateApp(manifest).ok) return rollbackTransactional({ primaryKey, rollbackKey, currentData, validate: validateApp, storage, now });
    return failure("ROLLBACK_MANIFEST_INVALID", "The combined rollback manifest is malformed or unsupported.", { phase: "rollback_manifest" });
  }
  const targetApp = parseAndValidateApp(manifest.app.raw, validateApp);
  if (!targetApp.ok) return failure("ROLLBACK_APP_INVALID", "Rollback application data failed validation.", { phase: "rollback_app_validation", validation: targetApp.validation });
  const stateProfile = readProfileState(manifest);
  if (!stateProfile.ok) return failure("ROLLBACK_PROFILE_STATE_INVALID", "Rollback profile UI state could not be parsed.", { phase: "rollback_profile_validation" });

  const snap = snapshotManifest({ primaryKey, profileKey, label: "pre-rollback-full", currentData, currentProfile, validateApp, storage, now });
  if (!snap.ok) return snap;
  const restoration = restoreGeneration({ primaryKey, profileKey, manifest, validateApp, storage });
  if (!restoration.complete) return failure("ROLLBACK_PARTIAL", "Rollback could not restore and verify every domain.", { phase: "rollback_restore", snapshotKey: snap.snapshotKey, restoration, currentSerialized: snap.manifest.app.raw, candidateSerialized: manifest.app.raw });
  return { ok: true, code: "FULL_REPLACE_ROLLED_BACK", data: restoration.app.data, profileApplied: true, profileData: stateProfile.value, snapshotKey: snap.snapshotKey, currentSerialized: snap.manifest.app.raw, candidateSerialized: manifest.app.raw };
}
