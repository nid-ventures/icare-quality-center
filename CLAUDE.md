# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Playwright E2E test suite (French-language UI) for the iCare structure application (`hi-icare-patient`, Angular — source at `D:\APP_HI\hi-icare-patient`) and the ICARE-CENTRY caregiver application.

## Commands

```bash
# Run all tests against a specific environment (clears previous allure-results first)
npm run test:local   # local Docker backend (docker-compose-local-pmp-224) + http://localhost:4200
npm run test:dev     # icare-nestlabs-test.net
npm run test:test    # pro-icare.com

# Run all tests (clears previous allure-results first) — uses the legacy .env file (no TEST_ENV)
npm test

# Run the structure app suite only (PowerShell: $env:TEST_ENV="local"; npx playwright test ...)
TEST_ENV=local npx playwright test --project=structure-app

# Run a single module
TEST_ENV=local npx playwright test tests/structure-app/02-base-patients.spec.ts --project=structure-app

# Run tests with headed browser
npx playwright test --headed

# Watch the structure suite in slow motion (SLOWMO ms after each action — 1500 by default —, test timeouts x6, on-screen banner with the current feature)
npm run test:visuel

# Generate and open Allure report
npm run report

# Generate Allure report only
npm run report:generate

# Open existing Allure report
npm run report:open

# Show Playwright HTML report
npx playwright show-report
```

## Architecture

**Page Object Model (POM)**, two applications:

- **Structure app (hi-icare-patient)** — `tests/structure-app/`, one `.spec.ts` per business module of the app (mirrors `AppModulesService.modules` in the app source):
  `00-authentification` (login, forgot/change password, policies, public consent pages), `01-portail` (module launcher `/modules`), `02-base-patients`, `03-dossier-medical-<n>-*`. The Dossier médical files are numbered in the order of the dashboard's "Prestation Médicale" frame, because Playwright runs files alphabetically:
  - `0-general`: search, dashboard, prescriptions, ordonnance.
  - `1-consultations`: prenatal / family planning / pediatric / dental create-edit with every field and prescriptions, dental chart cases.
  - `2-imagerie`: scanner / IRM / radiographie (general fields only: the app hides their technical fields) and standard / obstetric échographie with every displayed field and attachments, history, worklist.
  - `3-vaccination`: vaccination and doses.
  - `4-bilans`: one bilan per type, full result form with attachment, PDF bulletins, analyses.
  - `5-parcours`: care pathway templates created by the tests with every act, then started; offered by target sex (male patient too); vaccinal pathway and archives.
  - `6-parcours-suivi`: full follow-up on 3 pathways (women only, men only, all sexes) with the 4 act types in 2 steps, on a female and a male patient: offer by sex, start, detail and step navigation, acts done inside a step, step closing (complete / incomplete), summary, edit, archiving (with exception and anomaly), archives list in read-only, cleanup.

  Each file has its own exception cases.
  Then `04-facturation`, `05-honoraires`, `06-reporting`, `07-administration`, `08-laboratoire-imagerie` (worklists only: the module is hidden in the app and opened by URL).
  Each spec is a `test.describe('Module …')` with one nested `describe` per feature and one `test()` per action.
- `tests/structure-app/auth.setup.ts` — logs in once as the structure admin and saves the session to `playwright/.auth/structure-admin.json` (project `setup`); the `structure-app` project reuses it via `storageState`. Tests needing a logged-out browser use `test.use({ storageState: { cookies: [], origins: [] } })`.
- `fixtures/structure.fixture.ts` — `test`/`expect` to import in structure specs; the `portal` fixture opens `/modules` (`PortalPage`).
- `pages/structure/portal/portal.page.ts` — module launcher, "Changer de module" switcher and module side menu (`enterModule()`, `openMenu()`, `switchModule()`). After login the app lands on `/modules`; every module is entered through it.
- `pages/structure/**` — Page Objects per app feature; `pages/structure/generator/*` — faker data generators.
- `test-data/structure-users.ts` — structure admin credentials (overridable with `STRUCTURE_USER_EMAIL` / `_PASSWORD` / `_HI`).
- **Caregiver app** — `tests/caregiver-app-tests/` (project `caregiver-app`) with `pages/*.page.ts` and `test-data/users.json`.

**Test data**: tests that modify or delete data create their own records first (patient, user, invoice, fee statement…). Dossier médical specs create one dedicated female patient per worker in `beforeAll` (`fixtures/dossier-patient.ts`); consultation CRUD groups run in `serial` mode (create → verify → update → verify → delete).

**Configuration created by the tests**: when a feature depends on Administration > Paramètres, the tests set it up themselves — e.g. `fixtures/honoraires-setup.ts` creates a doctor remuneration profile (speciality "pédiatrie" + default billed act) if missing and bills an act to that doctor before each fee statement; the parcours spec creates its own care pathway templates and deletes them at the end.

**Every-field consultation tests**: `pages/structure/consultation/consultation-form.page.ts` fills any consultation form by `formcontrolname` (text/number/date/radio/checkbox/ng-select) and re-checks every value after reopening; field sets live in `test-data/consultation-fields.ts`. Known app defects are kept as `test.fail(true, 'Anomalie : …')` tests so they turn red when fixed.

**Visual runs**: with `SLOWMO>0` (`npm run test:visuel`, 1.5 s per action) a banner (`fixtures/visual-notes.ts`, closed shadow DOM, invisible to locators) shows module › section, test and current step.

**App behaviours to know**: creating a patient redirects to its medical dashboard (switching to the Dossier médical module) and may trigger the duplicate-detection panel; in the patient model `firstName` holds the family name and `lastName` the given name; Base patients opens the administrative file on row click, Dossier médical is "search first" and opens the medical dashboard.

## Configuration

- **Environment variables**: `BASE_URL`, `USER_EMAIL`, `USER_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`. Loaded via `dotenv` in `playwright.config.ts`.
- **Multi-environment support**: three env files, none committed (`.env.local`, `.env.dev`, `.env.test`), selected at runtime via the `TEST_ENV` variable (`local`/`dev`/`test`) — see `npm run test:local|dev|test` above. Without `TEST_ENV` (e.g. plain `npx playwright test`, or CI), the config falls back to loading the legacy `.env` file. `TEST_ENV` values map to: `local` → local Docker backend, `dev` → icare-nestlabs-test.net, `test` → pro-icare.com.
- **Browser / projects**: Google Chrome (`channel: 'chrome'`), maximized window with `viewport: null` and `--force-device-scale-factor=1` (1920×1080 headless) so the app stays in its desktop layout (≥1300px). Projects: `setup` (login), `structure-app` (depends on `setup`), `caregiver-app`.
- **Reporters**: list (console), allure-playwright (to `allure-results/`), HTML (auto-generated to `playwright-report/`).
- **CI**: GitHub Actions workflow (`.github/workflows/playwright.yml`) runs daily at 3:00 UTC, on push/PR to main, and manually. Sends email notification with results via OVH SMTP. Secrets required: `BASE_URL`, `USER_EMAIL`, `USER_PASSWORD`, `SMTP_USERNAME`, `SMTP_PASSWORD`.

## Conventions

- Page Object files use the naming pattern `<name>.page.ts`.
- Locators prefer Playwright role-based selectors (`getByRole`) over CSS/XPath.
- Test steps use `test.step()` with French-language descriptions.
- The app UI is in French; selectors reference French labels (e.g., `"Se connecter"`, `"Rechercher par nom"`).
