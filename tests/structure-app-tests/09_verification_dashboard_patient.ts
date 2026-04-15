import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../pages/structure/dashboard.page';
import { PatientPage } from '../../pages/structure/patient.page';
import { LoginPage } from '../../pages/structure/login.page';
// Données de test
const adminUser = {
  username: 'hi-admin',
  hicode: 'NEST',
  password: 'BcIsX7V&ZRh7',
  role: 'Administrateur'
};
test('Cliquer et vérifier le dashboard de la première ligne de la liste des patients', async ({ page }) => {
  const dashboardPage = new DashboardPage(page);
  const patientPage = new PatientPage(page);
  const loginPage = new LoginPage(page);

  await test.step('Ouverture de la page de connexion', async () => {
    await loginPage.goto();
  })
  await test.step('connexion', async () => {
    await loginPage.login(adminUser.username, adminUser.hicode, adminUser.password);
  })
  await test.step("Vérifier que le  dashboard affiche les statistiques ", async () => {
    await dashboardPage.statisticIsVisible();
  })
  await test.step("Visiter la page de la liste des patients ", async () => {
    await patientPage.gotoPatientsList();
  })
  await test.step("Verifier la conformité du dashboard du patient ", async () => {
    await patientPage.checkPatientDashboard();
  })

});