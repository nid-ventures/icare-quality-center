import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { tenant, adminStorageState } from './test-data/tenants';

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

// Navigateur : Google Chrome installé sur le poste (channel chrome), fenêtre maximisée.
// - viewport: null -> la page prend la taille réelle de la fenêtre (pas de zone fixe qui déborde
//   de l'écran ou reste décentrée en mode --headed / --ui) ;
// - --force-device-scale-factor=1 -> rendu 1:1 même avec une mise à l'échelle Windows (ex: 150 %),
//   sinon la largeur CSS de la fenêtre (1920 / 1.5 = 1280 px) passe SOUS le breakpoint desktop
//   de l'app (min-width:1300px, cf. responsive.css) et la sidebar bascule en mode "tablette" ;
// - --window-size -> taille utilisée en headless, où --start-maximized est sans effet.
// - SLOWMO (ms, optionnel) -> pause après chaque action pour suivre les tests à l'écran
//   (ex: SLOWMO=1500 avec --headed, cf. "npm run test:visuel"). 0 par défaut.
const slowMo = Number(process.env.SLOWMO) || 0;
const chrome = {
  channel: 'chrome',
  viewport: null,
  launchOptions: {
    slowMo,
    args: ['--start-maximized', '--window-size=1920,1080', '--force-device-scale-factor=1'],
  },
};

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    // Structure testée affichée dans l'onglet « Environnement » du rapport
    ['allure-playwright', { outputFolder: 'allure-results', environmentInfo: { Structure: `${tenant.name} (${tenant.key})`, Environnement: testEnv ?? 'défaut (.env)' } }],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: process.env.BASE_URL,
    trace: 'on-first-retry',
    // Délai maximal d'une action (clic, saisie…) : sans lui, un élément absent fait attendre
    // jusqu'au délai du test (30 min en visuel), ce qui ressemble à un blocage. Doublé en visuel
    // (SLOWMO) où l'application, ralentie par les pauses, met plus de temps à se stabiliser.
    actionTimeout: Number(process.env.SLOWMO) > 0 ? 60000 : 30000,
    // Nécessaire pour l'environnement local (nid-dev.localhost.com) qui utilise un certificat
    // auto-signé non approuvé par défaut ; sans impact sur les environnements distants qui ont
    // un certificat valide.
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      // Connexion unique de l'administrateur, sauvegardée pour le projet structure-app.
      name: 'setup',
      testDir: './tests/structure-app',
      testMatch: /auth\.setup\.ts/,
      use: { ...chrome },
    },
    {
      // Données nécessaires aux tests ajoutées à la structure si elles manquent (actes, garant,
      // analyses), spécialité des honoraires choisie parmi ses soignants.
      name: 'setup-data',
      testDir: './tests/structure-app',
      testMatch: /structure-data\.setup\.ts/,
      dependencies: ['setup'],
      use: { ...chrome, storageState: adminStorageState() },
    },
    {
      // Application structure (hi-icare-patient) : un fichier .spec.ts par module métier.
      name: 'structure-app',
      metadata: { tenant: tenant.key },
      testDir: './tests/structure-app',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup-data'],
      use: {
        ...chrome,
        // Session de la structure testée (variable TENANT, cf. test-data/tenants.ts) : même chemin
        // que ADMIN_STORAGE_STATE ; tenants.ts ne dépend pas du fichier .env
        storageState: adminStorageState(),
      },
    },
    {
      name: 'caregiver-app',
      testDir: './tests/caregiver-app-tests',
      use: { ...chrome },
    },
  ],
});
