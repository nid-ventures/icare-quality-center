import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { DetailPatientPage } from '../../../pages/structure/patient/detail_administratif.page';
import { PatientCarePage } from '../../../pages/structure/patient/patient-care.page';

const adminUser = {
  username: 'hi-admin',
  hicode: 'NEST',
  password: 'BcIsX7V&ZRh7',
};

test('Modifier une prise en charge existante', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);
  const patientPage = new PatientPage(page);
  const detailPatientPage = new DetailPatientPage(page);
  const carePage = new PatientCarePage(page);

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

  await test.step('Modifier la première prise en charge', async () => {
    await carePage.modifyFirstCare('Ascoma Assurance (ASSURANCE)', '2026-05-10');
  });
});