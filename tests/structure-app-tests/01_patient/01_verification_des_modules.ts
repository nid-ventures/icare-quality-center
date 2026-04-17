import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';

// Données de test
const adminUser = {
  username: 'hi-admin',
  hicode: 'NEST',
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
    await loginPage.login(adminUser.username, adminUser.hicode, adminUser.password);
  })
  await test.step("Vérifier que le  dashboard affiche les statistiques ", async () => {
    await dashboardPage.statisticIsVisible();
  })

  await test.step("Vérifier que le  module dashboard", async () => {
    await dashboardPage.modulesDashboardIsVisible();
  })
  await test.step("Vérifier que le  module patient ", async () => {
    await dashboardPage.modulesPatientIsVisible();
  })
  await test.step("Vérifier que le  module facturation ", async () => {
    await dashboardPage.modulesFacturationIsVisible();
  })
  await test.step("Vérifier que le  module honoraires ", async () => {
    await dashboardPage.modulesHonoraireIsVisible();
  })
  await test.step("Vérifier que le  module reporting ", async () => {
    await dashboardPage.modulesReportingIsVisible();
  })
  await test.step("Vérifier que le  module utilisateur ", async () => {
    await dashboardPage.modulesUsersIsVisible();
  })
  await test.step("Vérifier que le  module parametre ", async () => {
    await dashboardPage.modulesSettingsIsVisible();
  })

  // Cliquer sur l'icône utilisateur pour ouvrir le menu de profil
  await page.locator('i').nth(1).click();

  console.log('\n✅ Test terminé avec succès');
});