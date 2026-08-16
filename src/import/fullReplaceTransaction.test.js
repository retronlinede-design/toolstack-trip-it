import { describe, expect, it } from "vitest";
import { validateApplicationPayload, validateBackupProfile } from "./backupValidator.js";
import { FULL_REPLACE_MANIFEST_KIND, replaceFullBackupTransactional, rollbackFullBackupTransactional } from "./fullReplaceTransaction.js";
import { clone, validApp } from "./testFixtures.js";

const PRIMARY = "primary";
const PROFILE = "profile";
const NOW = new Date("2026-07-11T12:00:00.000Z");

function storageMock(initial = {}) {
  const values = new Map(Object.entries(initial));
  const calls = [];
  return {
    values, calls,
    getItem(key) { calls.push(["get", key]); return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { calls.push(["set", key, value]); values.set(key, value); },
    removeItem(key) { calls.push(["remove", key]); values.delete(key); },
  };
}

const currentProfile = { org: "Current", user: "A", language: "EN", logo: "" };
const importedProfile = { org: "Imported", user: "B", language: "DE", logo: "" };

function run(storage, overrides = {}) {
  const currentData = overrides.currentData || validApp();
  const candidate = overrides.candidate || (() => { const value = clone(currentData); value.vehicles[0].name = "Imported"; return value; })();
  return replaceFullBackupTransactional({ primaryKey: PRIMARY, profileKey: PROFILE, currentData, currentProfile, candidate, importedProfile, profileSupplied: true, validateApp: validateApplicationPayload, validateProfile: validateBackupProfile, storage, now: NOW, ...overrides });
}

describe("full Replace transaction", () => {
  it("writes and verifies app and profile after a combined exact-profile snapshot", () => {
    const current = validApp();
    const originalProfileRaw = '{ "language": "EN", "custom": true }';
    const storage = storageMock({ [PRIMARY]: JSON.stringify(current), [PROFILE]: originalProfileRaw });
    const result = run(storage, { currentData: current });
    expect(result).toMatchObject({ ok: true, profileApplied: true, profileData: importedProfile });
    expect(JSON.parse(storage.values.get(PRIMARY)).vehicles[0].name).toBe("Imported");
    expect(JSON.parse(storage.values.get(PROFILE))).toEqual(importedProfile);
    const manifest = JSON.parse(storage.values.get(result.snapshotKey));
    expect(manifest.kind).toBe(FULL_REPLACE_MANIFEST_KIND);
    expect(JSON.parse(manifest.app.raw)).toEqual(current);
    expect(manifest.profile).toMatchObject({ present: true, raw: originalProfileRaw });
    const snapshotWrite = storage.calls.findIndex(([type, key]) => type === "set" && key === result.snapshotKey);
    const appWrite = storage.calls.findIndex(([type, key]) => type === "set" && key === PRIMARY);
    const profileWrite = storage.calls.findIndex(([type, key]) => type === "set" && key === PROFILE);
    expect(snapshotWrite).toBeLessThan(appWrite); expect(appWrite).toBeLessThan(profileWrite);
  });

  it("records original profile absence and treats an empty imported object as supplied", () => {
    const storage = storageMock({ [PRIMARY]: JSON.stringify(validApp()) });
    const result = run(storage, { importedProfile: {}, profileSupplied: true });
    expect(result.ok).toBe(true);
    expect(JSON.parse(storage.values.get(PROFILE))).toEqual({});
    expect(JSON.parse(storage.values.get(result.snapshotKey)).profile).toMatchObject({ present: false, raw: null });
  });

  it.each([[undefined], [null]])("leaves profile unchanged when imported profile is %s", (profile) => {
    const raw = JSON.stringify(currentProfile);
    const storage = storageMock({ [PRIMARY]: JSON.stringify(validApp()), [PROFILE]: raw });
    const result = run(storage, { importedProfile: profile, profileSupplied: false });
    expect(result).toMatchObject({ ok: true, profileApplied: false });
    expect(storage.values.get(PROFILE)).toBe(raw);
    expect(storage.calls.filter(([type, key]) => type === "set" && key === PROFILE)).toHaveLength(0);
  });

  it("rejects invalid profile before snapshot or candidate writes", () => {
    const appRaw = JSON.stringify(validApp()); const profileRaw = JSON.stringify(currentProfile);
    const storage = storageMock({ [PRIMARY]: appRaw, [PROFILE]: profileRaw });
    const result = run(storage, { importedProfile: { language: 42 } });
    expect(result).toMatchObject({ ok: false, code: "CANDIDATE_PROFILE_INVALID" });
    expect(storage.calls.filter(([type]) => type === "set")).toHaveLength(0);
    expect(storage.values.get(PRIMARY)).toBe(appRaw); expect(storage.values.get(PROFILE)).toBe(profileRaw);
  });

  it("snapshot failure touches neither candidate domain", () => {
    const appRaw = JSON.stringify(validApp()); const profileRaw = JSON.stringify(currentProfile);
    const storage = storageMock({ [PRIMARY]: appRaw, [PROFILE]: profileRaw });
    const originalSet = storage.setItem.bind(storage);
    storage.setItem = (key, value) => { if (key.includes("pre-import-full")) throw new Error("quota"); originalSet(key, value); };
    const result = run(storage);
    expect(result.code).toBe("SNAPSHOT_FAILED");
    expect(storage.values.get(PRIMARY)).toBe(appRaw); expect(storage.values.get(PROFILE)).toBe(profileRaw);
  });

  it("app write failure leaves profile untouched and restores app", () => {
    const appRaw = JSON.stringify(validApp()); const profileRaw = JSON.stringify(currentProfile);
    const storage = storageMock({ [PRIMARY]: appRaw, [PROFILE]: profileRaw }); let appWrites = 0;
    const originalSet = storage.setItem.bind(storage);
    storage.setItem = (key, value) => { if (key === PRIMARY && ++appWrites === 1) throw new Error("blocked"); originalSet(key, value); };
    const result = run(storage);
    expect(result).toMatchObject({ code: "CANDIDATE_APP_WRITE_FAILED", restoration: { complete: true, profile: { status: "untouched" } } });
    expect(storage.values.get(PRIMARY)).toBe(appRaw); expect(storage.values.get(PROFILE)).toBe(profileRaw);
  });

  it("app post-write validation failure restores app without touching profile", () => {
    const appRaw = JSON.stringify(validApp()); const profileRaw = JSON.stringify(currentProfile);
    const storage = storageMock({ [PRIMARY]: appRaw, [PROFILE]: profileRaw }); let primaryReads = 0;
    const originalGet = storage.getItem.bind(storage);
    storage.getItem = (key) => key === PRIMARY && ++primaryReads === 2 ? JSON.stringify({ vehicles: [] }) : originalGet(key);
    const result = run(storage);
    expect(result).toMatchObject({ code: "CANDIDATE_APP_VERIFY_FAILED", restoration: { complete: true, profile: { status: "untouched" } } });
    expect(storage.values.get(PRIMARY)).toBe(appRaw); expect(storage.values.get(PROFILE)).toBe(profileRaw);
  });

  it("profile write failure restores both exact generations", () => {
    const appRaw = JSON.stringify(validApp()); const profileRaw = '{ "language": "EN", "legacy": 1 }';
    const storage = storageMock({ [PRIMARY]: appRaw, [PROFILE]: profileRaw }); let profileWrites = 0;
    const originalSet = storage.setItem.bind(storage);
    storage.setItem = (key, value) => { if (key === PROFILE && ++profileWrites === 1) throw new Error("quota"); originalSet(key, value); };
    const result = run(storage);
    expect(result).toMatchObject({ code: "CANDIDATE_PROFILE_WRITE_FAILED", restoration: { complete: true, app: { ok: true }, profile: { ok: true } } });
    expect(storage.values.get(PRIMARY)).toBe(appRaw); expect(storage.values.get(PROFILE)).toBe(profileRaw);
  });

  it("profile readback mismatch restores both", () => {
    const appRaw = JSON.stringify(validApp()); const profileRaw = JSON.stringify(currentProfile);
    const storage = storageMock({ [PRIMARY]: appRaw, [PROFILE]: profileRaw }); let mismatch = true; let profileWritten = false;
    const originalSet = storage.setItem.bind(storage);
    const originalGet = storage.getItem.bind(storage);
    storage.setItem = (key, value) => { originalSet(key, value); if (key === PROFILE && value !== profileRaw) profileWritten = true; };
    storage.getItem = (key) => key === PROFILE && profileWritten && mismatch ? (mismatch = false, "mismatch") : originalGet(key);
    const result = run(storage);
    expect(result).toMatchObject({ code: "CANDIDATE_PROFILE_WRITE_FAILED", restoration: { complete: true } });
    expect(storage.values.get(PRIMARY)).toBe(appRaw); expect(storage.values.get(PROFILE)).toBe(profileRaw);
  });

  it("profile post-read validation failure restores both", () => {
    const appRaw = JSON.stringify(validApp()); const profileRaw = JSON.stringify(currentProfile);
    const storage = storageMock({ [PRIMARY]: appRaw, [PROFILE]: profileRaw }); let profileReads = 0;
    const originalGet = storage.getItem.bind(storage);
    storage.getItem = (key) => key === PROFILE && ++profileReads === 3 ? JSON.stringify({ language: 42 }) : originalGet(key);
    const result = run(storage);
    expect(result).toMatchObject({ code: "CANDIDATE_PROFILE_VERIFY_FAILED", restoration: { complete: true } });
    expect(storage.values.get(PRIMARY)).toBe(appRaw); expect(storage.values.get(PROFILE)).toBe(profileRaw);
  });

  it("reports app-restored/profile-failed as partial and attempts both", () => {
    const storage = storageMock({ [PRIMARY]: JSON.stringify(validApp()), [PROFILE]: JSON.stringify(currentProfile) }); let profileWrites = 0;
    const originalSet = storage.setItem.bind(storage);
    storage.setItem = (key, value) => { if (key === PROFILE && ++profileWrites >= 1) throw new Error("blocked"); originalSet(key, value); };
    const result = run(storage);
    expect(result.restoration).toMatchObject({ partial: true, app: { ok: true }, profile: { ok: false } });
    expect(storage.calls.some(([type, key]) => type === "set" && key === PRIMARY)).toBe(true);
  });

  it("reports profile-restored/app-failed as partial and attempts both", () => {
    const storage = storageMock({ [PRIMARY]: JSON.stringify(validApp()), [PROFILE]: JSON.stringify(currentProfile) }); let appWrites = 0; let profileWrites = 0;
    const originalSet = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
      if (key === PRIMARY && ++appWrites === 2) throw new Error("restore blocked");
      if (key === PROFILE) { profileWrites += 1; if (profileWrites === 1) throw new Error("candidate blocked"); }
      originalSet(key, value);
    };
    const result = run(storage);
    expect(result.restoration).toMatchObject({ partial: true, app: { ok: false }, profile: { ok: true } });
    expect(profileWrites).toBe(2);
  });
});

describe("full Replace rollback", () => {
  it("restores app and exact profile, while snapshotting the imported generation", () => {
    const originalApp = validApp(); const originalProfileRaw = '{ "language": "EN", "legacy": true }';
    const storage = storageMock({ [PRIMARY]: JSON.stringify(originalApp), [PROFILE]: originalProfileRaw });
    const imported = run(storage, { currentData: originalApp });
    const importedApp = imported.data; const rolled = rollbackFullBackupTransactional({ primaryKey: PRIMARY, profileKey: PROFILE, rollbackKey: imported.snapshotKey, currentData: importedApp, currentProfile: importedProfile, validateApp: validateApplicationPayload, validateProfile: validateBackupProfile, storage, now: new Date("2026-07-11T13:00:00.000Z") });
    expect(rolled).toMatchObject({ ok: true, profileApplied: true });
    expect(JSON.parse(storage.values.get(PRIMARY))).toEqual(originalApp);
    expect(storage.values.get(PROFILE)).toBe(originalProfileRaw);
    const forward = JSON.parse(storage.values.get(rolled.snapshotKey));
    expect(JSON.parse(forward.app.raw)).toEqual(importedApp);
    expect(JSON.parse(forward.profile.raw)).toEqual(importedProfile);
  });

  it("restores an exact malformed-but-parseable stored profile without normalizing it", () => {
    const unusualRaw = '"legacy-profile-value"';
    const storage = storageMock({ [PRIMARY]: JSON.stringify(validApp()), [PROFILE]: unusualRaw });
    const imported = run(storage, { currentProfile: "legacy-profile-value" });
    const rolled = rollbackFullBackupTransactional({ primaryKey: PRIMARY, profileKey: PROFILE, rollbackKey: imported.snapshotKey, currentData: imported.data, currentProfile: importedProfile, validateApp: validateApplicationPayload, validateProfile: validateBackupProfile, storage, now: new Date("2026-07-11T13:00:00.000Z") });
    expect(rolled.ok).toBe(true);
    expect(storage.values.get(PROFILE)).toBe(unusualRaw);
    expect(rolled.profileData).toBe("legacy-profile-value");
  });

  it("removes and verifies an originally absent profile on rollback", () => {
    const storage = storageMock({ [PRIMARY]: JSON.stringify(validApp()) });
    const imported = run(storage);
    expect(storage.values.has(PROFILE)).toBe(true);
    const rolled = rollbackFullBackupTransactional({ primaryKey: PRIMARY, profileKey: PROFILE, rollbackKey: imported.snapshotKey, currentData: imported.data, currentProfile: importedProfile, validateApp: validateApplicationPayload, validateProfile: validateBackupProfile, storage, now: new Date("2026-07-11T13:00:00.000Z") });
    expect(rolled.ok).toBe(true); expect(storage.values.has(PROFILE)).toBe(false);
    expect(storage.calls.some(([type, key]) => type === "get" && key === PROFILE)).toBe(true);
  });

  it("reports a partial rollback when absent-profile removal cannot be verified", () => {
    const storage = storageMock({ [PRIMARY]: JSON.stringify(validApp()) });
    const imported = run(storage);
    storage.removeItem = (key) => { storage.calls.push(["remove", key]); };
    const rolled = rollbackFullBackupTransactional({ primaryKey: PRIMARY, profileKey: PROFILE, rollbackKey: imported.snapshotKey, currentData: imported.data, currentProfile: importedProfile, validateApp: validateApplicationPayload, validateProfile: validateBackupProfile, storage, now: new Date("2026-07-11T13:00:00.000Z") });
    expect(rolled).toMatchObject({ ok: false, code: "ROLLBACK_PARTIAL", restoration: { app: { ok: true }, profile: { ok: false }, partial: true } });
  });

  it("supports deterministic forward rollback through the pre-rollback manifest", () => {
    const original = validApp(); const storage = storageMock({ [PRIMARY]: JSON.stringify(original), [PROFILE]: JSON.stringify(currentProfile) });
    const imported = run(storage, { currentData: original });
    const back = rollbackFullBackupTransactional({ primaryKey: PRIMARY, profileKey: PROFILE, rollbackKey: imported.snapshotKey, currentData: imported.data, currentProfile: importedProfile, validateApp: validateApplicationPayload, validateProfile: validateBackupProfile, storage, now: new Date("2026-07-11T13:00:00.000Z") });
    const forward = rollbackFullBackupTransactional({ primaryKey: PRIMARY, profileKey: PROFILE, rollbackKey: back.snapshotKey, currentData: back.data, currentProfile: back.profileData, validateApp: validateApplicationPayload, validateProfile: validateBackupProfile, storage, now: new Date("2026-07-11T14:00:00.000Z") });
    expect(forward.ok).toBe(true);
    expect(JSON.parse(storage.values.get(PRIMARY)).vehicles[0].name).toBe("Imported");
    expect(JSON.parse(storage.values.get(PROFILE))).toEqual(importedProfile);
  });

  it("rejects malformed combined manifests without candidate writes", () => {
    const current = validApp(); const appRaw = JSON.stringify(current); const profileRaw = JSON.stringify(currentProfile);
    const storage = storageMock({ [PRIMARY]: appRaw, [PROFILE]: profileRaw, bad: JSON.stringify({ kind: FULL_REPLACE_MANIFEST_KIND }) });
    const before = storage.calls.length;
    const result = rollbackFullBackupTransactional({ primaryKey: PRIMARY, profileKey: PROFILE, rollbackKey: "bad", currentData: current, currentProfile, validateApp: validateApplicationPayload, validateProfile: validateBackupProfile, storage, now: NOW });
    expect(result.code).toBe("ROLLBACK_MANIFEST_INVALID");
    expect(storage.calls.slice(before).filter(([type]) => ["set", "remove"].includes(type))).toHaveLength(0);
  });

  it("supports legacy dataset-only rollback without touching profile", () => {
    const old = validApp(); const current = clone(old); current.vehicles[0].name = "Imported";
    const profileRaw = JSON.stringify(importedProfile);
    const storage = storageMock({ [PRIMARY]: JSON.stringify(current), [PROFILE]: profileRaw, legacy: JSON.stringify(old) });
    const result = rollbackFullBackupTransactional({ primaryKey: PRIMARY, profileKey: PROFILE, rollbackKey: "legacy", currentData: current, currentProfile: importedProfile, validateApp: validateApplicationPayload, validateProfile: validateBackupProfile, storage, now: NOW });
    expect(result.ok).toBe(true); expect(JSON.parse(storage.values.get(PRIMARY))).toEqual(old);
    expect(storage.values.get(PROFILE)).toBe(profileRaw);
    expect(storage.calls.filter(([type, key]) => type === "set" && key === PROFILE)).toHaveLength(0);
  });
});
