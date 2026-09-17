// tests/structure-app-tests/07_vaccination/01_verification_creer_vaccination.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { VaccinationPage, VaccinationData } from '../../../pages/structure/vaccination/vaccination.page';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

test.setTimeout(60000);

test('Créer une vaccination pour un patient', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const patientPage = new PatientPage(page);
    const vaccinationPage = new VaccinationPage(page);

    const vaccinationData: VaccinationData = {
        date: new Date().toISOString().split('T')[0],
        lot: `LOT-${Date.now()}`,
        commentary: 'Commentaire de test automatisé'
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

    await test.step('Ouvrir la modale de nouvelle vaccination', async () => {
        await vaccinationPage.openNewVaccinationModal();
    });

    await test.step('Remplir le formulaire de vaccination', async () => {
        await vaccinationPage.fillVaccinationForm(vaccinationData);
    });

    await test.step('Enregistrer la vaccination', async () => {
        await vaccinationPage.submitVaccinationForm();
    });

    await test.step('Vérifier que la vaccination apparaît dans la liste', async () => {
        await expect(vaccinationPage.firstVaccinationHeader).toBeVisible();
    });
});
