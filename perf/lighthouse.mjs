// Audit Lighthouse des écrans principaux de l'application structure.
//
//   npm run perf:lighthouse            (TEST_ENV=local par défaut)
//   LH_MIN_SCORE=60 npm run perf:lighthouse
//
// Lighthouse pilote un Chrome lancé par Playwright. Les pages internes demandent une session :
// celle sauvegardée par le projet « setup » (playwright/.auth/structure-admin.json) est recopiée
// dans le navigateur avant l'audit ; lancer une fois les tests (ou le projet setup) si elle manque.
// Résultat : un rapport HTML par écran dans lighthouse-reports/ et un résumé dans la console
// (note de performance, accessibilité, bonnes pratiques et indicateurs principaux).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import lighthouse from 'lighthouse';
import { chromium } from '@playwright/test';

const env = process.env.TEST_ENV || 'local';
dotenv.config({ path: path.resolve(`.env.${env}`) });
const baseUrl = process.env.BASE_URL;
if (!baseUrl) throw new Error(`BASE_URL absent de .env.${env}`);

const STATE = 'playwright/.auth/structure-admin.json';
const OUT = 'lighthouse-reports';
const PORT = 9223;
const MIN_SCORE = Number(process.env.LH_MIN_SCORE) || 0;

// Écrans audités : la page de connexion sans session, les autres avec
const PAGES = [
  { nom: 'connexion', url: '/auth/login', session: false },
  { nom: 'portail', url: '/modules', session: true },
  { nom: 'patients', url: '/patient/patients', session: true },
  { nom: 'factures-patients', url: '/billing/billings-patients', session: true },
  { nom: 'honoraires', url: '/honoraire/honoraires', session: true },
  { nom: 'liste-des-actes', url: '/my-space/reporting/billable-billing', session: true },
  { nom: 'parametrage', url: '/my-space/configuration', session: true },
];

const OPTIONS = {
  port: PORT,
  output: 'html',
  logLevel: 'error',
  onlyCategories: ['performance', 'accessibility', 'best-practices'],
  // Application de bureau (≥ 1300 px) : audit en mode ordinateur, sans bridage réseau simulé
  formFactor: 'desktop',
  screenEmulation: { mobile: false, width: 1920, height: 1080, deviceScaleFactor: 1, disabled: false },
  throttlingMethod: 'provided',
  // Garde la session recopiée (Lighthouse vide le stockage par défaut)
  disableStorageReset: true,
};

/** Recopie le localStorage de la session sauvegardée dans le navigateur audité. */
async function restoreSession(context) {
  if (!fs.existsSync(STATE)) throw new Error(`Session absente (${STATE}) : lancer d'abord les tests ou le projet "setup".`);
  const origin = new URL(baseUrl).origin;
  const entries = JSON.parse(fs.readFileSync(STATE, 'utf8')).origins.find(o => o.origin === origin)?.localStorage ?? [];
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.evaluate(items => { for (const { name, value } of items) localStorage.setItem(name, value); }, entries);
  await page.close();
}

async function clearSession(context) {
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.evaluate(() => localStorage.clear());
  await page.close();
}

const pct = v => (v == null ? '-' : Math.round(v * 100));
const sec = (audits, id) => (audits[id]?.numericValue == null ? '-' : `${(audits[id].numericValue / 1000).toFixed(1)} s`);

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'icare-lh-'));
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chrome',
  headless: true,
  ignoreHTTPSErrors: true,
  args: [`--remote-debugging-port=${PORT}`, '--ignore-certificate-errors', '--window-size=1920,1080'],
});

fs.mkdirSync(OUT, { recursive: true });
const resume = [];
let session = null;
try {
  for (const { nom, url, session: withSession } of PAGES) {
    if (withSession !== session) {
      await (withSession ? restoreSession(context) : clearSession(context));
      session = withSession;
    }
    process.stdout.write(`Audit ${nom} (${url})… `);
    const result = await lighthouse(baseUrl + url, OPTIONS);
    fs.writeFileSync(path.join(OUT, `${nom}.html`), result.report);
    const { categories, audits } = result.lhr;
    const ligne = {
      ecran: nom,
      performance: pct(categories.performance?.score),
      accessibilite: pct(categories.accessibility?.score),
      bonnesPratiques: pct(categories['best-practices']?.score),
      FCP: sec(audits, 'first-contentful-paint'),
      LCP: sec(audits, 'largest-contentful-paint'),
      TBT: audits['total-blocking-time']?.displayValue ?? '-',
      CLS: audits['cumulative-layout-shift']?.displayValue ?? '-',
      poids: audits['total-byte-weight']?.displayValue ?? '-',
    };
    resume.push(ligne);
    console.log(`performance ${ligne.performance}/100`);
  }
} finally {
  await context.close();
  fs.rmSync(profile, { recursive: true, force: true });
}

fs.writeFileSync(path.join(OUT, 'resume.json'), JSON.stringify(resume, null, 2));
console.table(resume);
console.log(`Rapports détaillés : ${path.resolve(OUT)}`);

const sousSeuil = resume.filter(r => typeof r.performance === 'number' && r.performance < MIN_SCORE);
if (sousSeuil.length) {
  console.error(`Note de performance sous ${MIN_SCORE} : ${sousSeuil.map(r => `${r.ecran} (${r.performance})`).join(', ')}`);
  process.exit(1);
}
