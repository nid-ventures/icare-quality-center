import fs from 'fs';
import { type Browser, type Page, expect } from '@playwright/test';
import { LoginPage } from '../pages/structure/patient/login.page';
import { PortalPage } from '../pages/structure/portal/portal.page';
import { adminUser, ADMIN_STORAGE_STATE } from '../test-data/structure-users';
import { saveStructureContext, structure } from '../test-data/tenants';

/**
 * Connecte l'administrateur dans la structure de code TENANT, relève ce qu'on en voit (nom, code
 * d'API, administrateur, modules du portail, autres structures du compte) puis enregistre la
 * session. Les référentiels de la structure (actes, garants…) sont chargés à la connexion.
 */
export async function loginAdminAndSave(page: Page) {
  const loginPage = new LoginPage(page);
  const portal = new PortalPage(page);

  await loginPage.goto();
  await loginPage.login(adminUser.username, adminUser.password);
  const structures = await loginPage.selectStructure(adminUser.hi);
  await portal.expectLoaded();

  // Cartes du portail (« Entrer dans … ») : modules proposés à cette structure
  const cards = portal.modulesRegion.getByRole('button', { name: /^Entrer dans / });
  await expect(cards.first()).toBeVisible();
  const modules = (await cards.evaluateAll(els => els.map(e => e.getAttribute('aria-label') || e.textContent || '')))
    .map(label => label.replace(/^\s*Entrer dans\s+/, '').trim());
  const session = await page.evaluate(() => ({
    hiCode: localStorage.getItem('x_hi_code') ?? '',
    fullName: localStorage.getItem('fullName') ?? '',
  }));
  const current = structures.find(s => s.code.toLowerCase() === adminUser.hi);
  const previous = structure();
  // L'application envoie le code en majuscules comme code d'API (login.component.ts)
  saveStructureContext({
    ...previous,
    code: adminUser.hi,
    name: current?.name ?? (previous.name || adminUser.hi),
    hiCode: session.hiCode || adminUser.hi.toUpperCase(),
    adminFullName: session.fullName,
    modules,
    others: structures.length
      ? structures.filter(s => s !== current).map(s => ({ code: s.code.toLowerCase(), name: s.name, hiCode: s.code.toUpperCase() }))
      : previous.others,
  });

  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
}

/** Marge avant expiration du jeton en dessous de laquelle la session est refaite. */
const SESSION_MARGIN_MS = 10 * 60 * 1000;

/** Fin de validité (ms) du jeton enregistré dans la session, 0 si illisible. */
function savedTokenExpiry(): number {
  try {
    const state = JSON.parse(fs.readFileSync(ADMIN_STORAGE_STATE, 'utf8'));
    const token = state.origins?.flatMap((o: any) => o.localStorage ?? []).find((i: any) => i.name === 'access_token')?.value;
    const payload = JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8'));
    return Number(payload.exp) * 1000 || 0;
  } catch {
    return 0;
  }
}

/**
 * Le front ne renouvelle pas le jeton (Keycloak : 30 min) : passé ce délai, la première requête
 * en 401 renvoie à la connexion. Un fichier de tests long dépasse cette durée : la session
 * enregistrée est refaite quand son jeton expire bientôt, avant d'ouvrir un contexte qui l'utilise.
 */
export async function ensureFreshAdminSession(browser: Browser) {
  if (savedTokenExpiry() - Date.now() > SESSION_MARGIN_MS) return;
  const context = await browser.newContext({ baseURL: process.env.BASE_URL, viewport: null, ignoreHTTPSErrors: true });
  try {
    await loginAdminAndSave(await context.newPage());
  } finally {
    await context.close();
  }
}
