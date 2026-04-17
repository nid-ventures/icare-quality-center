import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { PatientDataGenerator } from '../../../pages/structure/generator/data-generator';
// Données de test
const adminUser = {
  username: 'hi-admin',
  hicode: 'NEST',
  password: 'BcIsX7V&ZRh7',
  role: 'Administrateur'
};
test('Créer un patient sans tester les doublons mais avec consentements', async ({ page }) => {
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
  await test.step("Ouvrir le popup de création de patient ", async () => {
    await patientPage.openCreationModal();
  })
  await test.step("Générer des données de patient  ", async () => {
    const patientData = PatientDataGenerator.generate();
    await patientPage.fillCreationForm('Activé', patientData, "sanouarouna90@gmail.com");
  })
  await test.step("Enregistrer les données générées  ", async () => {
    await patientPage.saveAndConfirm();
  })




});