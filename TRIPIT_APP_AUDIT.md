# TripIt Application Audit

**Audit date:** 2026-08-16  
**Repository:** `toolstack-trip-it` (`main`, HEAD `02e95f7`)  
**Scope:** Investigation of the current working tree. Application code and data were not changed.

## Executive Summary

TripIt is a client-only React 19/Vite 7 single-page vehicle and journey log. It stores its entire operational dataset in browser `localStorage`, supports vehicles, active/completed trips and legs, driver profiles, fuel/wash logs, templates, reports, and full-backup replace/merge workflows. There is no server, router, authentication layer, or database.

The repository is buildable and its automated suite is healthy: 181 tests pass, the production build succeeds, ESLint has no errors (two hook warnings), and `npm audit --omit=dev` reports no known production dependency vulnerabilities. Import validation and transactional persistence are unusually well defended for a local-only application.

One high-priority data-integrity gap remains: startup validates only that the primary value is valid JSON, not that it conforms to the application schema. A parseable but malformed, partially written, or future-version dataset is normalized in memory and automatically written back. Normalization drops unknown/orphaned collections and supplies defaults, so this path can silently destroy recoverable data without making a recovery copy. No P0 issue was confirmed.

**Finding count:** P0: **0** · P1: **1** · P2: **9** · P3: **7**

# Before Tomorrow

- **Safe to continue developing:** Yes, with normal source-control discipline. Build and tests are green.
- **Safe to continue using with important data:** Generally, but export a full backup first. Do not rely on `localStorage` as the only copy.
- **Build/tests:** Build passes; 19 test files / 181 tests pass; lint has two warnings and no errors. No separate typecheck or formatting check exists.
- **P0 issues:** None found.
- **Deal with before tomorrow:** P1-01—validate stored primary data before normalization and preserve the raw value before any repair/writeback.
- **Can wait:** Modal accessibility, validation polish, configuration/branding, coverage expansion, file decomposition, and asset/repository cleanup.

## Verification Results

| Command | Result | Notes |
|---|---:|---|
| `npm test` | Pass | Vitest 4.1.10; 19 files, 181 tests, 0 failures; ~2.07 s |
| `npm run build` | Pass | Vite 7.3.0; 66 modules; JS 391.75 kB (112.69 kB gzip), CSS 45.18 kB (9.11 kB gzip), logo 180.18 kB |
| `npm run lint` | Pass with warnings | 0 errors, 2 `react-hooks/exhaustive-deps` warnings in `src/App.jsx` at lines 1767 and 1787 |
| `npm audit --omit=dev --json` | Pass | 0 known production vulnerabilities across 28 production dependencies |
| Typecheck | Not available | JavaScript project; no `typecheck` script or TypeScript configuration |
| Formatting validation | Not available | No formatter configuration or script |
| Practical browser/viewport run | Not performed | No browser automation or visual-test infrastructure is configured; responsive conclusions are code-based |

Running the build refreshed ignored files under `dist/`; it did not change tracked application files.

## Architecture Overview

### Stack and structure

| Area | Implementation |
|---|---|
| Application | Client-only SPA; React 19.2, React DOM 19.2 |
| Language | JavaScript/JSX and CSS |
| Build | Vite 7 with `@vitejs/plugin-react` and Tailwind CSS 4 Vite plugin |
| Package manager | npm (`package-lock.json`, lockfile v3) |
| Entry | `index.html` → `src/main.jsx` → `src/App.jsx` |
| Styling | Tailwind utility classes plus design-system rules in `src/index.css`; `App.css` appears unused |
| Routing | No URL router. One long page with accordions and modal overlays; state selects vehicle/month and expanded records |
| State | React component state concentrated in `TripIt`; derived data via `useMemo`; no external state library |
| Persistence | Browser `localStorage`: `toolstack.tripit.v1` for app data, `toolstack.profile.v1` for display profile; legacy key `toolstack_tripit_v1` |
| Services | No application backend. Optional browser geolocation plus Nominatim reverse-geocoding request |
| Tests | Vitest unit and server-rendered component tests colocated under `src`; no DOM/browser E2E harness |
| Deployment | Generic Vite build only; no hosting, CI, container, PWA, service worker, or environment-specific configuration |

### Major modules

- `src/App.jsx` (3,614 lines) owns orchestration, state, persistence hooks, trip/vehicle/fuel/wash CRUD, modals, reporting, import/export, recovery, and most page markup.
- `src/storage/` provides guarded reads, verified write/readback, migration backup, corrupt-value preservation, and persistence status helpers.
- `src/import/` identifies and validates backups, limits hostile/oversized structures, plans deterministic merges and conflict resolutions, performs snapshot-backed replace/merge, and supports rollback.
- `src/components/trips/` provides leg composition/timeline/cards, people handling, time validation, summaries, and CSV export.
- `src/components/drivers/`, `vehicle/`, and `reports/` provide driver profiles/statistics, responsive log cards, and report controls.
- `src/components/ui/` is a small local component/design-system layer.

### Data flow

On startup, `loadInitialState()` reads the primary key, migrates a legacy key transactionally when necessary, or blocks on unreadable/unavailable storage. UI actions replace React state; an effect writes the complete serialized application object to `localStorage` and verifies it by readback. Full-backup imports are classified, schema-validated, normalized, previewed, then replaced or merged using a verified pre-operation snapshot. Reports are derived from the selected vehicle and date range and exported as non-restorable JSON/CSV/print/email text.

## Major Workflows

| Workflow | Status | Evidence / dependencies / breaks |
|---|---|---|
| Vehicle management | Implemented | Add/edit/select/delete; vehicle deletion cascades through normalized per-vehicle collections. Confirmation exists. No undo other than a prior external backup. |
| Active trip | Implemented | Start a titled/date trip, draft auto-save, add/edit/delete legs, duplicate/reverse leg details, finish or cancel. One active trip per vehicle. |
| Completed trip history | Implemented | Month filter, expand summaries, edit/delete/add historical legs, delete whole trip. |
| Driver profiles | Implemented, newer/less covered | CRUD, duplicate, active status, default vehicle, derived statistics/recent trips. Delete is disabled when historical trips reference the driver name. No explicit confirmation for deletable profiles. |
| Fuel logs | Implemented | Add/edit/delete, monthly totals/history, currency/full-tank/station fields. Numeric/date validation is weak in the live form. |
| Wash logs | Implemented | Add/edit/delete and summary cards. Cost/date validation is weak in the live form. |
| Templates | Implemented | Save/load/delete trip or leg templates. Deletes have no contextual modal; only the extra persistence-failure warning when storage is unhealthy. |
| Reports | Implemented | Preset/custom range, summary, preview, print/PDF, CSV, non-restorable JSON, clipboard/email. Scoped to active vehicle. |
| Full backup export | Implemented | Includes metadata, profile, and entire dataset. Download is unencrypted JSON. |
| Import/replace | Implemented defensively | File-size/tree/schema checks, preview/counts, empty-replacement warning, verified snapshot/write/readback, recovery downloads and rollback. |
| Merge | Implemented defensively | Deterministic matching, explicit conflicts/probable duplicates, active-trip choices, verified transaction and rollback. |
| Legacy migration/recovery | Partially robust | Invalid JSON is blocked and preserved; old key is migrated transactionally. Parseable invalid primary data is not protected (P1-01). |
| Hub navigation | Placeholder/disabled | `HUB_URL` is `https://YOUR-WIX-HUB-URL-HERE`; UI suppresses the footer link and header action only displays “Set HUB_URL first.” |
| Localization | Partial | EN/DE dictionary exists, but many newer UI strings are hard-coded in English. |

## Findings by Priority

### P0 — Critical

No confirmed P0 findings.

### P1 — High

#### P1-01 — Parseable invalid primary storage can be silently normalized and overwritten

- **Evidence:** `loadInitialState()` in `src/App.jsx` accepts every `readJson(KEY)` result with status `valid` and immediately calls `normalizeApp(primary.value)`. It does not call `validateApplicationPayload`. The general persistence effect then writes that normalized state to the same key. `normalizeApp` filters/falls back arrays and objects, reconstructs missing IDs, only carries per-vehicle collections for recognized vehicles, and drops unsupported top-level fields. Recovery preservation is used only for JSON parse failure.
- **Affected area:** Startup, schema compatibility, local data recovery.
- **Likely user impact:** A structurally damaged, partially compatible, or future-version value can appear to load while records/fields are discarded; the next automatic save overwrites the only primary copy. The user receives no warning or recovery filename.
- **Recommended next action:** Validate the raw parsed primary payload before normalization. On failure or unsupported version, block normal persistence and preserve/download the original raw value. If normalization is an intentional migration, compare/validate the candidate and snapshot the source before writeback.
- **Further investigation required:** Yes—define supported in-place migrations and future-version policy before implementation.

### P2 — Medium

| ID | Finding | Evidence and impact | Recommended action |
|---|---|---|---|
| P2-01 | `localStorage` is the only automatic durable store | All app data lives in one browser-origin key; no server sync, scheduled backup, quota monitoring, or cross-device persistence. Browser/site-data clearing loses the dataset. | Make backup status prominent and define a backup cadence; consider a durable store only if product requirements call for it. |
| P2-02 | Sensitive operational data is plaintext and unauthenticated | Driver contact/licence/employee details, passenger names, VIN/plate, routes and notes are readable by any script/user with access to the origin/profile and included in JSON exports. This is a **likely privacy risk**, not a confirmed exploit. | Document trust model; avoid shared origins/devices, apply hosting security headers, and consider access control/encryption if deployed for multiple users. |
| P2-03 | Modals are not keyboard-complete | `ModalShell` has dialog semantics but no focus trap/restoration, initial focus, Escape handler, or background inerting. Several custom modals similarly lack a consistent Escape/focus system; repeated `id="ts-modal-title"` can collide if overlays stack. | Centralize modal behavior and add keyboard/focus tests. |
| P2-04 | Runtime form validation is inconsistent | Trips require title and leg odometers/times, but places can be blank; fuel/wash accept blank/negative/non-numeric values and dates are not explicitly required in handlers. Import validation checks finiteness but normal UI can persist values that make summaries misleading. | Define field invariants and show inline validation before save. |
| P2-05 | Rollback restores app data but not imported display profile | Replace import applies `prepared.profile` to the separate profile key; `restorePreImportData()` rolls back only `app`. A rollback can therefore leave organization/user/language branding from the imported file. | Snapshot/restore profile alongside dataset, or explicitly state rollback scope in UI. |
| P2-06 | Hook dependencies are incomplete | ESLint reports missing `activeTrip`, `resetLegForm`, and `trips` dependencies in the auto-default effect, plus missing `activeTrip` in draft persistence. Closure behavior can become stale as logic evolves. | Stabilize callbacks or restructure effects, then make lint warning-free. |
| P2-07 | Destructive changes have no record-level undo/snapshot | Import/merge has excellent rollback, but vehicle/trip/leg/fuel/wash deletion is persisted to the single primary value after confirmation. A mistaken confirmation requires a prior exported backup. | Consider short-lived undo or snapshot for high-impact vehicle/trip deletion; retain current contextual confirmations. |
| P2-08 | Core orchestration is highly coupled | `src/App.jsx` is 3,614 lines and owns storage lifecycle, business mutations, modals, reports, and rendering. The risk is change regression and difficult behavioral testing, not size alone. | Extract cohesive hooks/services (persistence lifecycle, import workflow, trip mutations) incrementally with tests. |
| P2-09 | Behavioral coverage misses the integrated persistence/UI boundary | Tests strongly cover storage/import utilities and pure/component rendering, but use server markup rather than a browser DOM. No test proves startup gate behavior, save-failure banners, keyboard modal behavior, full active-trip flow, download, geolocation, or page navigation. | Add a DOM integration layer and a few high-value browser workflows; prioritize P1-01 and recovery scenarios. |

### P3 — Low / Future

| ID | Finding | Evidence / disposition |
|---|---|---|
| P3-01 | Hub integration is an intentional placeholder | `HUB_URL` contains `YOUR-WIX-HUB-URL-HERE`; safe to configure when deployment target is known. |
| P3-02 | Generic template metadata remains | README is Vite boilerplate; title is `toolstack-trip-it`; favicon is `/vite.svg`. Cleanup is safe and not data-sensitive. |
| P3-03 | Partial localization | New driver/report/import/accessibility strings remain English when DE is selected. UX debt, not a workflow blocker. |
| P3-04 | No CI/deployment contract | No CI workflow, environment sample, hosting config, base-path setting, or runtime support statement. Local build is healthy but deployment behavior is undocumented. |
| P3-05 | Source-map/caching policy is implicit | Vite defaults are used; no PWA/service worker exists, which avoids stale offline caches but provides no offline install/update behavior. |
| P3-06 | Unused/legacy assets and CSS are present | `src/assets/react.svg`, `public/vite.svg`, `src/App.css`, and a large UUID-named PNG appear unused. Removal appears safe after reference/build confirmation; assets are not data-sensitive. |
| P3-07 | Repository contains a suspicious tracked filename | Root file `h origin main` (16,789 bytes) is tracked and not referenced by the app; likely accidental command output. Removal appears safe after owner confirmation. |

## Data Safety

### Model and identity

The persisted object contains `vehicles`, `activeVehicleId`, `activeTripByVehicle`, `tripsByVehicle`, `fuelByVehicle`, `washByVehicle`, `drivers`, `ui`, and `templates`. IDs are generated with `crypto.randomUUID()` where available, otherwise timestamp/random text. Import validation requires non-empty IDs and detects duplicates within collections; trip IDs are checked globally. Merge planning remaps collisions deterministically and records source aliases to make repeated imports idempotent.

Per-vehicle dictionaries are the normalization mechanism. Deleting a vehicle removes trip/active/fuel entries explicitly; although wash is not explicitly deleted in `deleteVehicleNow`, `normalizeApp` reconstructs wash collections only for remaining vehicles, so the cascade currently occurs indirectly. Driver-to-trip identity is name-based for historical statistics rather than a stable driver ID, making driver renames and duplicate names semantically fragile.

### Migration, backup, import and recovery

- Legacy key migration writes and verifies the destination, validates it, writes a timestamped migration backup, then removes the old key.
- Corrupt JSON is preserved under a timestamped recovery key and blocks normal app use.
- Full exports are versioned (`schemaVersion: 1`) and clearly distinguished from non-restorable report exports.
- Imports reject excessive file size/depth/string/record counts, forbidden prototype keys, wrong app/export types, future/unsupported versions, duplicate IDs, orphan references, invalid dates and non-finite numeric fields.
- Replace and merge first write a timestamped pre-operation snapshot, verify all writes by readback, post-validate, restore current serialized data on failure, and expose downloadable candidates plus rollback.
- Snapshot/recovery keys have no retention policy and share the same `localStorage` quota. Over time they can consume quota and cause otherwise valid saves to fail; failures are surfaced, but cleanup is manual/nonexistent.
- There is no automatic backup, backup reminder, checksum/signature, encryption, or export verification after browser download.

## Security

No authentication or authorization exists because there is no server or user-account model. This is acceptable only under an explicit single-user/trusted-browser deployment model. If hosted as a shared/multi-user product, the current architecture cannot enforce access boundaries.

No committed `.env` file, API credential, token, unsafe `dangerouslySetInnerHTML`, dynamic code execution, or application backend endpoint was found. React escapes displayed user content. Backup import includes meaningful structural and prototype-pollution defenses. External links use `noreferrer`; the Hub URL is a compile-time constant rather than user input.

Nominatim reverse geocoding sends the coordinates obtained after a user presses the location control to `nominatim.openstreetmap.org`; the request is caught and falls back to raw coordinates. This is a privacy disclosure/hardening consideration. Production hosting should define CSP and related headers; none are repository-configured. Exported JSON/CSV/email text can contain personal and location data and should be treated as sensitive.

Classification summary: no confirmed vulnerability; P2-02 is a likely privacy/deployment-model risk; CSP, privacy disclosure, and export handling are hardening opportunities.

## UX & Accessibility

Strengths include real button elements, widespread labels, visible `focus-visible` rings, semantic sections/headings, `aria-expanded`/`aria-controls` on disclosures, polite validation regions, contextual delete text, responsive cards in place of tables, and a top-level error boundary/recovery screen.

High-confidence gaps:

- Modal keyboard/focus behavior is incomplete (P2-03). Some overlays close by backdrop and some on Escape, but behavior is inconsistent and focus is not contained/restored.
- The app has no route/navigation landmarks or `aria-current`; this is mostly because it is one long view, but driver profiles, trips and logs require substantial scrolling rather than navigable sections.
- Some compact legacy inputs in `App.jsx` use a visual `<label>` without `htmlFor`/input `id`, notably historical add-leg and fuel/wash controls. Driver editor wraps controls inside labels and is programmatically associated.
- Toasts are transient and should be verified with a live region; critical persistence failures correctly use a persistent alert banner.
- Disabled driver deletion has no nearby explanation; a user can see a disabled control but not why historical references prevent deletion.
- “Saved” feedback is intentionally deferred until verified storage, which is good. Some actions such as driver duplicate/toggle/delete do not provide explicit feedback.

Responsive code is generally thoughtful: mobile-first grids, `min-w-0`, wrapping action groups, 44px disclosure targets, capped modal widths and scrollable modal bodies are used. Likely pressure points are dense header actions, the fixed/modal layering on small viewport keyboards, `min-h-screen`/fixed overlays on mobile browser chrome, and long unbroken imported IDs/errors. No fixed desktop table was found. These are code-based risks; practical 320/375/768px checks were not available.

## Performance

No current performance failure was measured. The production JS bundle is 391.75 kB (112.69 kB gzip), reasonable for the current scope, with a 180.18 kB logo. There is one eager application chunk and no route-based splitting, but the app has no routes.

Potential scaling limits are architectural: every edit serializes and rewrites the full dataset; many derived selectors scan all trips/legs; completed records are rendered without virtualization; import limits allow datasets far larger than this UI/storage design can comfortably handle. These are reasonable future optimizations only after measuring realistic data volumes. `localStorage` quota is likely to fail before the stated 100k/500k import maxima are useful in a browser.

The UUID-named PNG is approximately 5.4 MB and tracked but apparently unused; it affects repository size, not the current production bundle. Avoid micro-optimizing current memoized summaries until real traces show a problem.

## Legacy / Dead Code

- `migrateLegacyIfNeeded`, legacy `legsByVehicle`, trip-level driver/passenger migration, and legacy storage-key migration are data-sensitive compatibility layers. Removal is **migration-sensitive and test-sensitive**; retain until supported-data policy is explicit.
- `confirmDeleteFuel()` and the older table-style fuel/wash markup appear superseded by responsive record cards; reachability should be confirmed before removal. **Unclear/test-sensitive.**
- `void openEmail; void copySummary;` is redundant because those functions are wired through `ExportActions`. Safe cleanup after lint/build confirmation.
- `App.css`, template React assets, UUID-named PNG, and root `h origin main` appear unused. Removal is likely safe but requires owner/reference confirmation; not data-sensitive.
- No abandoned feature-flag system or large commented-out subsystem was found.

## Testing & Maintainability

The 19 test files / 181 tests emphasize storage primitives, migration/recovery, import classification and schema validation, transactional replace/rollback, merge identity/planning/idempotency, time and people utilities, CSV export, suggestions, modal layering markup, driver calculations, and responsive component markup. This is strong coverage of high-risk pure data logic.

Coverage is not measured, and tests do not use jsdom or a browser. Rendering tests mainly assert static HTML/class strings, so they cannot demonstrate keyboard interactions, state transitions, storage effects, downloads, timers, focus, geolocation/network failure, or actual responsive layout. The most valuable additions are startup validation/recovery integration, failed-save behavior, import+profile rollback, complete trip lifecycle, and keyboard modal tests.

The main maintainability concern is responsibility concentration in `App.jsx` (P2-08), compounded by two effect warnings. Refactoring should be incremental and behavior-preserving; the import/storage modules already demonstrate a useful boundary pattern. No rewrite is justified.

## Deployment / Configuration

`npm run build` produces a valid static Vite bundle. There are no runtime environment variables, API base URLs, server dependencies, source-map overrides, deployment scripts, CI workflow, PWA manifest, or service worker. Vite’s default root base (`/`) is used, so deployment below a URL subpath may require an explicit `base` setting. The Hub integration is unconfigured, and page title/favicon/README remain template defaults.

Because persistence is origin-scoped, changing scheme/host/port or deployment path to a different origin makes existing browser data appear absent. A deployment migration plan must preserve origin or explicitly guide users through full backup/export and import. HTTPS is required for reliable geolocation/clipboard behavior outside localhost. Production privacy and retention expectations are undocumented.

## Git / Repository Hygiene

At audit start, the working tree already contained an uncommitted modification to `src/App.jsx`; it was not altered. `dist/` and `node_modules/` exist locally and are ignored. No tracked `.env`, generated `dist`, or `node_modules` content was found. The lockfile is tracked.

The repository tracks an apparently accidental root file named `h origin main` and a roughly 5.4 MB UUID-named PNG. Generic Vite assets/metadata remain. The audit report is the only tracked-content modification created by this audit.

## Recommended Next Steps

### Immediate

1. Address P1-01: validate primary stored data before normalization/writeback and preserve the raw source on every incompatible/repair path.
2. Before changing that startup path, export a representative full backup and add regression tests for valid JSON with missing containers, orphan references, duplicate IDs, future fields/version, and failed recovery preservation.

### Next

1. Define the deployment/trust model and backup expectations; address plaintext personal/location data accordingly.
2. Make modal focus/Escape/background behavior consistent and test it in a DOM/browser environment.
3. Tighten live fuel/wash/leg validation and add high-value integrated workflows.
4. Include the profile in replace-import rollback semantics.
5. Resolve hook warnings and extract persistence/import orchestration from `App.jsx` behind tested boundaries.

### Later

1. Configure deployment base/Hub URL/branding and document origin/data migration behavior.
2. Complete DE localization where product requirements warrant it.
3. Confirm and remove unused assets/CSS, superseded markup, and the suspicious root file.
4. Measure large real datasets before considering list virtualization or chunk splitting.

## Detailed Findings / Evidence

| Area | Key locations | Audit evidence |
|---|---|---|
| Startup risk | `src/App.jsx` `loadInitialState`, `normalizeApp`, persistence effect | Parsed primary accepted without application-schema validation; normalization then auto-persists |
| Verified persistence | `src/storage/storage.js`, `persistence.js`; `src/App.jsx` `persistApp` | `setItem` followed by exact readback; persistent warning and backup action on failure |
| Migration/recovery | `src/storage/migration.js`, `recovery.js`; blocking screen in `App.jsx` | Transactional migration, timestamped backup, raw download, corrupt-data gate |
| Import safety | `src/import/backupValidator.js`, `importTransaction.js`, `mergeTransaction.js` | Size/depth/schema/prototype checks; snapshot, verify, restore, rollback |
| Merge behavior | `src/import/mergePlanner.js`, `mergeIdentity.js` | Conflict resolution, probable duplicate handling, deterministic remap, repeat-import aliases |
| Data model | `src/App.jsx` `emptyApp`/`normalizeApp`; `src/components/drivers/driverProfileUtils.js` | Per-vehicle maps, active trip per vehicle, driver profiles plus name-derived history |
| Accessibility | `src/components/ui/index.jsx` `ModalShell`; modal implementations in `App.jsx` | Dialog roles present; focus trap/restoration and consistent Escape missing |
| Validation | Save handlers in `src/App.jsx`; `src/components/trips/timeUtils.js` | Strong import/time/odometer checks; inconsistent live numeric/date/place constraints |
| External integration | `src/App.jsx` geolocation handler around line 2674 | Browser geolocation, Nominatim reverse lookup, caught fallback |
| Build/deps | `package.json`, `vite.config.js`, build output, npm audit | Minimal coherent dependency set; no duplicate functional libraries or known production advisory found |
| Repository state | `git status`, `git ls-files`, `.gitignore` | Pre-existing `src/App.jsx` change; ignored build/dependencies; suspicious tracked root file and unused large asset |

### Audit limitations

The audit inspected all source/configuration areas and ran every configured validation command plus a production dependency audit. It did not exercise the app in an interactive browser, inspect real browser `localStorage`, test actual mobile devices, perform a full dev-dependency vulnerability audit, or assess a production hosting environment because none is present/configured in the repository. No real user data was read or modified.
