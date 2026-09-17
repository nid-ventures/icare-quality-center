// tests/structure-app-tests/07_vaccination/02_verification_ajouter_dose.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { VaccinationPage, VaccinationData, DoseData } from '../../../pages/structure/vaccination/vaccination.page';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

test.setTimeout(60000);

test('Ajouter une dose à une vaccination', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const patientPage = new PatientPage(page);
    const vaccinationPage = new VaccinationPage(page);

    const vaccinationData: VaccinationData = {
        date: new Date().toISOString().split('T')[0],
        lot: `LOT-${Date.now()}`,
        commentary: 'Vaccination de référence pour ajout de dose'
    };
    const doseData: DoseData = {
        date: new Date().toISOString().split('T')[0],
        lot: `DOSE-${Date.now()}`
    };

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

    await test.step('Accéder aux vaccinations du patient', async () => {
        await vaccinationPage.gotoFromPatientDashboard();
    });

    await test.step('Créer une vaccination de référence', async () => {
        await vaccinationPage.createVaccination(vaccinationData);
        await expect(vaccinationPage.firstVaccinationHeader).toBeVisible();
    });

    await test.step('Ajouter une dose à cette vaccination', async () => {
        await vaccinationPage.addDoseToFirstVaccination(doseData);
    });

    await test.step("Vérifier que l'ajout de la dose a réussi", async () => {
        await expect(vaccinationPage.doseAddedToast).toBeVisible();
    });
});
