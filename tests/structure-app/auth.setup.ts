import { test as setup } from '@playwright/test';
import { LoginPage } from '../../pages/structure/patient/login.page';
import { PortalPage } from '../../pages/structure/portal/portal.page';
import { adminUser, ADMIN_STORAGE_STATE } from '../../test-data/structure-users';

// Connexion unique de l'administrateur de structure : la session (localStorage : token,
// structure choisie, référentiels) est sauvegardée puis réutilisée par tous les specs.
setup('Connexion administrateur structure', async ({ page }) => {
  // Mode visuel (SLOWMO) : chaque action attend SLOWMO ms, 30 s ne suffisent plus toujours
  if (Number(process.env.SLOWMO) > 0) setup.setTimeout(180000);
  const loginPage = new LoginPage(page);
  const portal = new PortalPage(page);

  await loginPage.goto();
  await loginPage.login(adminUser.username, adminUser.password);
  await loginPage.selectStructure(adminUser.hi);
  await portal.expectLoaded();

  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});
