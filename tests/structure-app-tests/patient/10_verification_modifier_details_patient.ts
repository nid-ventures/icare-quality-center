import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { DetailPatientPage } from '../../../pages/structure/patient/detail_administratif.page';
// Données de test
const adminUser = {
  username: 'hi-admin',
  hicode: 'NEST',
  password: 'BcIsX7V&ZRh7',
  role: 'Administrateur'
};
test('Verification de modification de details patients', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);
  const patientPage = new PatientPage(page);
  const detailPatientPage = new DetailPatientPage(page);

  await test.step('Ouverture de la page de connexion', async () => {
    await loginPage.goto();
  })
  await test.step('connexion', async () => {
    await loginPage.login(adminUser.username, adminUser.hicode, adminUser.password);
  })
  await test.step("Vérifier que le  dashboard affiche les statistiques ", async () => {
    await dashboardPage.statisticIsVisible();
  })
  await test.step("Choisir le premier patient de la liste des patients", async () => {
    await patientPage.chooseFirstPatient();
  })
  await test.step("Voir la page détails administratifs ", async () => {
    await detailPatientPage.gotoDetailsPatient();
  })
  await test.step("Vérifier que la page des détails administratifs est chargée ", async () => {
    await detailPatientPage.checkIfPageLoad();
  })
  await test.step("Saisir et enregistrer les mise à jour éffectuées ", async () => {
    await detailPatientPage.updateData();
  })

});