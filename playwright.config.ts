import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Sélection de l'environnement cible via TEST_ENV=local|dev|test (npm run test:local /
// test:dev / test:test). Sans TEST_ENV (ex: `npm test`, ou le workflow CI qui génère son
// propre `.env` à partir des secrets), on charge le `.env` par défaut comme avant.
// - local : backend Docker local (docker-compose-local-pmp-224) + frontend localhost:4200
// - dev   : icare-nestlabs-test.net
// - test  : pro-icare.com
const testEnv = process.env.TEST_ENV;
const envFile = path.resolve(__dirname, testEnv ? `.env.${testEnv}` : '.env');

if (!fs.existsSync(envFile)) {
  throw new Error(
    `Fichier d'environnement introuvable : ${envFile}. TEST_ENV doit valoir "local", "dev" ou "test".`
  );
}

dotenv.config({ path: envFile });

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['allure-playwright', { outputFolder: 'allure-results' }],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: process.env.BASE_URL,
    trace: 'on-first-retry',
    // Nécessaire pour l'environnement local (nid-dev.localhost.com) qui utilise un certificat
    // auto-signé non approuvé par défaut ; sans impact sur les environnements distants qui ont
    // un certificat valide.
    ignoreHTTPSErrors: true,
    // Le viewport par défaut (1280px) est SOUS le breakpoint desktop de l'app
    // (min-width:1300px, cf. responsive.css) : la sidebar y est hors-écran par défaut
    // (mode "tablette"), ce qui causait la quasi-totalité des interceptions de clic observées
    // sur les liens/éléments proches du bord gauche. Un viewport réellement desktop l'évite.
    viewport: { width: 1600, height: 900 },
  },

  projects: [
    // Edge (channel msedge, basé sur Chromium) utilise l'installation système, pas de
    // binaire téléchargé par Playwright. Le spread de devices['Desktop Edge'] écraserait
    // le viewport défini plus haut (il apporte son propre viewport 1280x720) : on le
    // redéfinit explicitement après le spread.
    {
      // Connexion unique de l'administrateur, sauvegardée pour le projet structure-app.
      name: 'setup',
      testDir: './tests/structure-app',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: { width: 1600, height: 900 } },
    },
    {
      // Application structure (hi-icare-patient) : un fichier .spec.ts par module métier.
      name: 'structure-app',
      testDir: './tests/structure-app',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        viewport: { width: 1600, height: 900 },
        // Même chemin que ADMIN_STORAGE_STATE (test-data/structure-users.ts), non importé ici
        // pour ne pas évaluer ce module avant le chargement du fichier .env.
        storageState: 'playwright/.auth/structure-admin.json',
      },
    },
    {
      name: 'caregiver-app',
      testDir: './tests/caregiver-app-tests',
      use: { ...devices['Desktop Edge'], channel: 'msedge', viewport: { width: 1600, height: 900 } },
    },
  ],
});
