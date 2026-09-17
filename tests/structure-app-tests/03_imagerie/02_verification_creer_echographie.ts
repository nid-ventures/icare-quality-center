// tests/structure-app-tests/03_imagerie/02_verification_creer_echographie.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { ImagerieDashboardPage } from '../../../pages/structure/imagerie/imagerie-dashboard.page';
import { ImagingDataGenerator } from '../../../pages/structure/generator/imaging-data-generator';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

test.setTimeout(60000);

test('Créer une échographie pour un patient', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const patientPage = new PatientPage(page);
    const imagerieDashboardPage = new ImagerieDashboardPage(page);

    const echographieData = ImagingDataGenerator.generateEchographie();

    await test.step('Ouverture de la page de connexion', async () => {
        await loginPage.goto();
        await loginPage.login(adminUser.username, adminUser.password);
        await loginPage.selectStructure(adminUser.hi);
    });

    await test.step('Vérifier que le dashboard affiche les statistiques', async () => {
        await dashboardPage.statisticIsVisible();
    });

    await test.step('Choisir le premier patient de la liste des patients', async () => {
        await patientPage.chooseFirstPatient();
    });

    await test.step("Accéder au dashboard d'imagerie du patient", async () => {
        await imagerieDashboardPage.gotoFromPatientDashboard();
    });

    await test.step("Ouvrir la modale de choix du type d'acte d'imagerie", async () => {
        await imagerieDashboardPage.openNewActeModal();
    });

    await test.step('Choisir le type Échographie', async () => {
        await imagerieDashboardPage.chooseType('ECHOGRAPHIE');
    });

    await test.step("Remplir le formulaire de l'échographie", async () => {
        await imagerieDashboardPage.fillEchographieCreateForm(echographieData);
    });

    await test.step("Enregistrer l'échographie", async () => {
        await imagerieDashboardPage.submitEchographieCreateForm();
    });

    await test.step("Vérifier que l'échographie a bien été enregistrée", async () => {
        await expect(imagerieDashboardPage.confirmButton).not.toBeVisible();
        await expect(imagerieDashboardPage.newActeButton).toBeVisible();
    });
});
