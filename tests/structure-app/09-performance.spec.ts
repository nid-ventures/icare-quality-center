import { type Page, type Response } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { PortalPage } from '../../pages/structure/portal/portal.page';
import { LoginPage } from '../../pages/structure/patient/login.page';
import { DossierSearchPage } from '../../pages/structure/patient/dossier-search.page';
import { BillableBillingReportingPage } from '../../pages/structure/my-space/reporting.page';
import { adminUser } from '../../test-data/structure-users';

/**
 * Performance perçue : temps des écrans les plus utilisés, du clic à l'écran utilisable (données
 * reçues et affichées), et indicateurs web (Web Vitals) au premier chargement.
 *
 * Chaque mesure est comparée à un seuil (vérification non bloquante : toutes les mesures sont
 * prises, le test échoue à la fin si l'une dépasse son seuil) et jointe au rapport (Allure / HTML).
 * PERF_FACTOR multiplie tous les seuils (ex. PERF_FACTOR=1.5 sur une machine lente).
 *
 * Les seuils visent le serveur de développement local (ng serve, code non optimisé) : un front
 * construit en production (ng build) doit faire nettement mieux.
 */

const FACTOR = Number(process.env.PERF_FACTOR) || 1;

/**
 * Seuils des écrans, en millisecondes : environ 3 fois les temps mesurés le 19/10/2026 (en
 * commentaire, après l'ajout des index de la liste des patients), pour détecter une régression
 * sans échouer sur une machine un peu chargée.
 */
const SEUILS = {
  connexion: 5000, //         1,6 s
  portail: 4000, //           1,3 s
  basePatients: 2500, //      0,7 s
  rechercheDossier: 6000, //  2,3 s (appel /patients/search, à optimiser)
  ouvertureDossier: 2000, //  0,1 s
  facturesPatients: 2000, //  0,5 s
  honoraires: 2000, //        0,3 s
  listeActes: 4000, //        1,3 s
  administration: 2000, //    0,5 s
};

/**
 * Indicateurs web au premier chargement. Repères Google pour une « bonne » page : FCP < 1,8 s,
 * LCP < 2,5 s, CLS < 0,1 ; relevés ici pour le serveur de développement (code non minifié).
 */
const SEUILS_WEB = { fcp: 3000, lcp: 4000, cls: 0.1, clsMax: 0.25 };

type WebVitals = { ttfb: number; domContentLoaded: number; load: number; fcp: number; lcp: number; cls: number };

// Mesures sans signification avec les pauses du mode visuel
test.skip(Number(process.env.SLOWMO) > 0, 'Mesures de performance sans objet en mode visuel (SLOWMO)');

/** Chronomètre `action` (jusqu'à l'écran utilisable), joint le résultat et le compare au seuil. */
async function mesurer(nom: string, seuil: number, action: () => Promise<unknown>): Promise<number> {
  const limite = Math.round(seuil * FACTOR);
  const debut = Date.now();
  await test.step(nom, async () => { await action(); });
  const ms = Date.now() - debut;
  test.info().annotations.push({ type: 'performance', description: `${nom} : ${ms} ms (seuil ${limite} ms)` });
  expect.soft(ms, `${nom} : ${ms} ms, seuil ${limite} ms`).toBeLessThan(limite);
  return ms;
}

/**
 * Portail affiché ET application initialisée (référentiels chargés) : sans cela, le clic sur un
 * module mesuré juste après l'ouverture du portail compte aussi la fin de l'initialisation.
 */
async function portailPret(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

/** Réponse de l'API dont l'adresse contient `part`, attendue (enregistrée avant l'action). */
function reponse(page: Page, part: string, method = 'POST'): Promise<Response> {
  return page.waitForResponse(r => r.url().includes(part) && r.request().method() === method, { timeout: 60000 });
}

/** Indicateurs web de la page chargée (navigation, premier affichage, plus grand élément, décalages). */
async function webVitals(page: Page): Promise<WebVitals> {
  await page.waitForLoadState('load');
  return page.evaluate(() => new Promise<WebVitals>(resolve => {
    let lcp = 0;
    let cls = 0;
    new PerformanceObserver(list => { for (const e of list.getEntries()) lcp = e.startTime; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(list => {
      for (const e of list.getEntries() as any[]) if (!e.hadRecentInput) cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
    // Laisse les observateurs recevoir les entrées déjà enregistrées
    setTimeout(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
      resolve({
        ttfb: Math.round(nav.responseStart), domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
        load: Math.round(nav.loadEventEnd), fcp: Math.round(fcp), lcp: Math.round(lcp), cls: Math.round(cls * 1000) / 1000,
      });
    }, 1500);
  }));
}

/** Joint les indicateurs web et les compare aux repères. */
async function verifierWebVitals(nom: string, vitals: WebVitals) {
  await test.info().attach(`Web Vitals — ${nom}`, { body: JSON.stringify(vitals, null, 2), contentType: 'application/json' });
  test.info().annotations.push({
    type: 'performance',
    description: `${nom} : TTFB ${vitals.ttfb} ms, FCP ${vitals.fcp} ms, LCP ${vitals.lcp} ms, CLS ${vitals.cls}, chargement ${vitals.load} ms`,
  });
  expect.soft(vitals.fcp, `${nom} : premier affichage (FCP) ${vitals.fcp} ms`).toBeLessThan(SEUILS_WEB.fcp * FACTOR);
  expect.soft(vitals.lcp, `${nom} : plus grand élément affiché (LCP) ${vitals.lcp} ms`).toBeLessThan(SEUILS_WEB.lcp * FACTOR);
  // CLS : « bon » sous 0,1, « mauvais » au-delà de 0,25 ; entre les deux, avertissement sans échec
  if (vitals.cls >= SEUILS_WEB.cls) {
    test.info().annotations.push({ type: 'avertissement', description: `${nom} : mise en page instable au chargement (CLS ${vitals.cls}, bon sous ${SEUILS_WEB.cls})` });
  }
  expect.soft(vitals.cls, `${nom} : stabilité de la mise en page (CLS) ${vitals.cls}`).toBeLessThan(SEUILS_WEB.clsMax);
}

test.describe('Performance', () => {

  test.describe('Sans session', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('Page de connexion : indicateurs web au premier chargement', async ({ page }) => {
      await page.goto('/auth/login');
      await verifierWebVitals('Page de connexion', await webVitals(page));
    });

    test("Connexion : de la validation à l'affichage du portail", async ({ page }) => {
      const login = new LoginPage(page);
      await login.goto();
      await login.expectLoginPageIsFullyLoaded();
      await mesurer('Connexion jusqu\'au portail', SEUILS.connexion, async () => {
        await login.login(adminUser.username, adminUser.password);
        await login.selectStructure(adminUser.hi);
        await new PortalPage(page).expectLoaded();
      });
    });
  });

  test.describe('Écrans principaux', () => {

    test('Portail : premier chargement et indicateurs web', async ({ page }) => {
      await mesurer('Portail des modules', SEUILS.portail, () => new PortalPage(page).goto());
      await verifierWebVitals('Portail des modules', await webVitals(page));
    });

    test('Base patients : ouverture de la liste', async ({ portal, page }) => {
      await portailPret(page);
      await mesurer('Liste des patients', SEUILS.basePatients, async () => {
        const liste = reponse(page, '/patients/getAll');
        await portal.enterModule('Base patients');
        await liste;
        // Lignes de patients réelles : « Aucun patient disponible » s'affiche pendant le chargement
        await expect(page.locator('.compact-table tbody tr').filter({ hasNotText: /Aucun patient/ }).first()).toBeVisible({ timeout: 60000 });
      });
    });

    test('Dossier médical : recherche par identifiant puis ouverture du dossier', async ({ portal, page }) => {
      // Identifiant d'un patient existant, lu dans la réponse de l'API (le tableau affiche
      // « Aucun patient disponible » tant que la réponse n'est pas arrivée)
      const liste = reponse(page, '/patients/getAll');
      await portal.enterModule('Base patients');
      const identifier: string = (await (await liste).json())?.result?.data?.[0]?.identifier ?? '';
      expect(identifier, 'Identifiant d\'un patient existant').toBeTruthy();

      await portal.goto();
      await portal.enterModule('Dossier médical');
      const search = new DossierSearchPage(page);
      await search.expectLoaded();
      await mesurer('Recherche de dossier par identifiant', SEUILS.rechercheDossier, () => search.searchByIdentifier(identifier).then(() => search.expectResult(identifier)));
      await mesurer('Ouverture du dossier médical', SEUILS.ouvertureDossier, async () => {
        await search.openDossier(identifier);
        await expect(page.getByRole('heading', { name: /Parcours de soins/ })).toBeVisible({ timeout: 60000 });
      });
    });

    test('Facturation : liste des factures patients', async ({ portal, page }) => {
      await portal.enterModule('Facturation');
      await mesurer('Liste des factures patients', SEUILS.facturesPatients, async () => {
        const liste = reponse(page, '/invoices/patients');
        await portal.openMenu('Factures patients', '**/billing/billings-patients');
        await liste;
      });
    });

    test('Honoraires : liste des relevés', async ({ portal, page }) => {
      await portailPret(page);
      await mesurer('Liste des relevés d\'honoraires', SEUILS.honoraires, async () => {
        const liste = reponse(page, '/search/paged');
        await portal.enterModule('Honoraires');
        await liste;
        await expect(page.getByRole('heading', { name: /Relevés de Notes Honoraires/ })).toBeVisible({ timeout: 60000 });
      });
    });

    test('Reporting : recherche dans la liste des actes', async ({ portal, page }) => {
      await portal.enterModule('Reporting');
      await portal.openMenu('Liste des actes', '**/my-space/reporting/billable-billing');
      const actes = new BillableBillingReportingPage(page);
      await actes.expectLoaded();
      await mesurer('Recherche dans la liste des actes', SEUILS.listeActes, () => actes.search());
    });

    test('Administration : espace paramétrage', async ({ portal, page }) => {
      await portailPret(page);
      await mesurer('Espace paramétrage', SEUILS.administration, async () => {
        await portal.enterModule('Administration');
        await expect(page.getByRole('heading', { name: 'Espace paramétrage' })).toBeVisible({ timeout: 60000 });
        await expect(page.locator('.config-card').first()).toBeVisible({ timeout: 60000 });
      });
    });
  });
});
