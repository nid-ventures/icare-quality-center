// tests/structure-app-tests/16_verification_voir_prise_en_charge.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/structure/login.page';
import { DashboardPage } from '../../pages/structure/dashboard.page';
import { PatientPage } from '../../pages/structure/patient.page';
import { DetailPatientPage } from '../../pages/structure/detail_administratif';
import { PatientCarePage } from '../../pages/structure/patient-care.page';

const adminUser = {
  username: 'hi-admin',
  hicode: 'NEST',
  password: 'BcIsX7V&ZRh7',
};

test('Visualiser les détails d\'une prise en charge', async ({ page }) => {
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

  await test.step('Ouvrir les détails de la première prise en charge', async () => {
    await carePage.viewFirstCareDetails();
  });

  await test.step('Vérifier le contenu du modal', async () => {
    await expect(page.getByRole('heading', { name: 'Voir prise en charge' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fermer' })).toBeVisible();
  });

  await test.step('Fermer le modal', async () => {
    await carePage.closeViewModal();
    await expect(page.getByRole('heading', { name: 'Voir prise en charge' })).not.toBeVisible();
  });
});