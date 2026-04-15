import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/structure/login.page';
import { DashboardPage } from '../../pages/structure/dashboard.page';
import { PatientPage } from '../../pages/structure/patient.page';
import { DetailPatientPage } from '../../pages/structure/detail_administratif';
import { PatientCarePage, CareData } from '../../pages/structure/patient-care.page';
import { CareDataGenerator } from '../../pages/structure/care-data-generator';

const adminUser = {
  username: 'hi-admin',
  hicode: 'NEST',
  password: 'BcIsX7V&ZRh7',
};

test('Ajouter une prise en charge pour un patient', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);
  const patientPage = new PatientPage(page);
  const detailPatientPage = new DetailPatientPage(page);
  const carePage = new PatientCarePage(page);

  const careData: CareData = CareDataGenerator.generate();

  await test.step('Connexion', async () => {
    await loginPage.goto();
    await loginPage.login(adminUser.username, adminUser.hicode, adminUser.password);
  });

  await test.step('Sélectionner le premier patient', async () => {
    await patientPage.chooseFirstPatient();
  });

  await test.step('Accéder aux détails administratifs', async () => {
    await detailPatientPage.gotoDetailsPatient();
  });


  await test.step('Onglet Prise en charge', async () => {
    await carePage.goToCareTab();
  });

  await test.step('Ajouter une prise en charge', async () => {
    await carePage.openAddCareModal();
    await carePage.fillCareForm(careData);
    await carePage.saveCare();
  });


});