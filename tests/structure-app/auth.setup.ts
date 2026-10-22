import { test as setup, expect } from '@playwright/test';
import { LoginPage } from '../../pages/structure/patient/login.page';
import { PortalPage } from '../../pages/structure/portal/portal.page';
import { adminUser, ADMIN_STORAGE_STATE } from '../../test-data/structure-users';
import { saveStructureContext } from '../../test-data/tenants';

// Connexion unique de l'administrateur de structure : la session (localStorage : token,
// structure choisie, référentiels) est sauvegardée puis réutilisée par tous les specs.
// La structure est choisie par son code (TENANT) ; ce qu'on en voit à la connexion (nom, code
// d'API, administrateur, modules du portail, autres structures du compte) est relevé pour les tests.
setup('Connexion administrateur structure', async ({ page }) => {
  // Mode visuel (SLOWMO) : chaque action attend SLOWMO ms, 30 s ne suffisent plus toujours
  if (Number(process.env.SLOWMO) > 0) setup.setTimeout(180000);
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
  // L'application envoie le code en majuscules comme code d'API (login.component.ts)
  saveStructureContext({
    code: adminUser.hi,
    name: current?.name ?? adminUser.hi,
    hiCode: session.hiCode || adminUser.hi.toUpperCase(),
    adminFullName: session.fullName,
    modules,
    others: structures
      .filter(s => s !== current)
      .map(s => ({ code: s.code.toLowerCase(), name: s.name, hiCode: s.code.toUpperCase() })),
  });

  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});
