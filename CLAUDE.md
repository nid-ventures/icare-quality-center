# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Playwright E2E test suite for the ICARE-CENTRY HR/appointment application (French-language UI). Tests verify core application modules (login, medecins, structures, utilisateurs) via data-driven scenarios.

## Commands

```bash
# Run all tests (clears previous allure-results first)
npm test

# Run a single test file
npx playwright test tests/verification_des_modules_applicatifs.ts

# Run tests with headed browser
npx playwright test --headed

# Run tests in a specific browser (configured: firefox; chromium/webkit commented out)
npx playwright test --project=firefox

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

**Page Object Model (POM)** with **Data-Driven Testing (DDT)**:

- `pages/*.page.ts` — Page Object classes. Each encapsulates locators and actions for one page of the app (LoginPage, DashboardPage, MedecinsPage, StructuresPage, UtilisateursPage).
- `tests/` — Test specs. Currently a single test file (`verification_des_modules_applicatifs.ts`) that iterates over `test-data/users.json` to run the same scenario for each user role.
- `test-data/users.json` — Test data array. Each entry has `role`, `expectedName`, `expectedStructure`, `expectedUser`. Tests loop over this array with `for (const user of users)`.

**Test flow**: Login → search medecins → verify structures table → verify utilisateurs table. Navigation between modules uses DashboardPage methods (`goToStructures()`, `goToUtilisateurs()`).

## Configuration

- **Environment variables** (`.env` file, not committed): `BASE_URL`, `USER_EMAIL`, `USER_PASSWORD`. Loaded via `dotenv` in `playwright.config.ts`.
- **Browser**: Only Firefox is active in `playwright.config.ts`; Chromium and WebKit project blocks are commented out.
- **Reporters**: list (console), allure-playwright (to `allure-results/`), HTML (auto-generated to `playwright-report/`).
- **CI**: GitHub Actions workflow (`.github/workflows/playwright.yml`) runs daily at 3:00 UTC, on push/PR to main, and manually. Sends email notification with results via OVH SMTP. Secrets required: `BASE_URL`, `USER_EMAIL`, `USER_PASSWORD`, `SMTP_USERNAME`, `SMTP_PASSWORD`.

## Conventions

- Page Object files use the naming pattern `<name>.page.ts`.
- Locators prefer Playwright role-based selectors (`getByRole`) over CSS/XPath.
- Test steps use `test.step()` with French-language descriptions.
- The app UI is in French; selectors reference French labels (e.g., `"Se connecter"`, `"Rechercher par nom"`).
