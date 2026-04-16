// tests/structure-app-tests/17_verification_supprimer_prise_en_charge.ts
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

test('Supprimer une prise en charge existante', async ({ page }) => {
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

  await test.step('Supprimer la première prise en charge', async () => {
    // Ouvrir le menu Action de la première ligne
    const firstRow = await carePage.getFirstCareRow();
    const actionButton = firstRow.getByRole('button', { name: 'Action' });
    await actionButton.click();

    // Cliquer sur "Supprimer" dans le menu déroulant
    await page.getByRole('link', { name: 'Supprimer' }).click();

    // Vérifier le modal de confirmation
    await expect(page.getByRole('heading', { name: 'Suppression' })).toBeVisible();
    await expect(page.getByText('Êtes-vous sûr de vouloir')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Supprimer' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fermer' })).toBeVisible();

    // Confirmer la suppression
    await page.getByRole('button', { name: 'Supprimer' }).click();


  });
});