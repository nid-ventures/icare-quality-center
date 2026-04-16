import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { PatientData, PatientDataGenerator } from '../../../pages/structure/generator/data-generator';
// Données de test
const adminUser = {
  username: 'hi-admin',
  hicode: 'NEST',
  password: 'BcIsX7V&ZRh7',
  role: 'Administrateur'
};
test('Créer un patient avec  les doublons en choisissant l\'option modification ', async ({ page }) => {
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
    // 1. Récupérer les données du premier patient affiché
    const originalDob = await patientPage.getFirstPatientDob();
    const originalPhone = await patientPage.getFirstPatientPhone();
    // 2. Créer un objet PatientData partiel (seulement dob et phonePrimary sont nécessaires)
    const originalData = { dob: originalDob, phonePrimary: originalPhone } as PatientData;
    // 3. Générer le doublon
    const duplicateData = PatientDataGenerator.generateDuplicateFrom(originalData);
    await patientPage.fillCreationForm('Désactivé', duplicateData);
  })
  await test.step("Enregistrer les données générées  ", async () => {
    await patientPage.saveAndConfirm();
  })
  await test.step("Modifier le duplicats ", async () => {
    await patientPage.ignoreDuplicatAndConfirm();
  })


});