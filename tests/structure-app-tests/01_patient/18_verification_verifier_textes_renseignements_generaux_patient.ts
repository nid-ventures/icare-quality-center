import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { RenseignementsGenerauxPage } from '../../../pages/structure/patient/renseignements_generaux_patient.page';
// Données de test
const adminUser = {
  username: 'hi-admin',
  hicode: 'NEST',
  password: 'BcIsX7V&ZRh7',
  role: 'Administrateur'
};


test(`Vérification les textes du renseignements généraux du patient de l'application par l'utilisateur ${adminUser.role}`, async ({ page }) => {
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);
  const patientPage = new PatientPage(page);
  const renseignementsGenerauxPage = new RenseignementsGenerauxPage(page);


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
  await test.step("Vérifier les informations des renseignements généraux", async () => {
    await renseignementsGenerauxPage.checkRenseignementInfos();
  })




});