import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';

// Données de test
const adminUser = {
  username: 'hi-admin@gmail.com',
  hi: 'NEST FOR ALL',
  password: 'BcIsX7V&ZRh7',
  role: 'Administrateur'
};

test(`Vérification des modules de l'application par l'utilisateur ${adminUser.role}`, async ({ page }) => {
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);

  await test.step('Ouverture de la page de connexion', async () => {
    await loginPage.goto();
  })
  await test.step('connexion', async () => {
    await loginPage.login(adminUser.username, adminUser.password);
  })
  await test.step('Sélection de la structure', async () => {
    await loginPage.selectStructure(adminUser.hi);
  });

  await test.step('Vérifier que le dashboard affiche les statistiques', async () => {
    await dashboardPage.statisticIsVisible();
  })

  await test.step('Vérifier que le module dashboard est visible', async () => {
    await dashboardPage.modulesDashboardIsVisible();
  })
  await test.step('Vérifier que le module patient est visible', async () => {
    await dashboardPage.modulesPatientIsVisible();
  })
  await test.step('Vérifier que le module facturation est visible', async () => {
    await dashboardPage.modulesFacturationIsVisible();
  })
  await test.step('Vérifier que le module honoraires est visible', async () => {
    await dashboardPage.modulesHonoraireIsVisible();
  })
  await test.step('Vérifier que le module reporting est visible', async () => {
    await dashboardPage.modulesReportingIsVisible();
  })
  await test.step('Vérifier que le module utilisateur est visible', async () => {
    await dashboardPage.modulesUsersIsVisible();
  })
  await test.step('Vérifier que le module paramètre est visible', async () => {
    await dashboardPage.modulesSettingsIsVisible();
  })

  await test.step("Ouvrir le menu utilisateur via l'icône de profil", async () => {
    await page.locator('i').nth(1).click();
  });

  console.log('\n✅ Test terminé avec succès');
});
