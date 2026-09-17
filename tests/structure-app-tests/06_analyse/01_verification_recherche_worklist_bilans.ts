// tests/structure-app-tests/06_analyse/01_verification_recherche_worklist_bilans.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { LaboratoryWorklistPage } from '../../../pages/structure/analyse/laboratory-worklist.page';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

test('Rechercher des bilans dans le worklist laboratoire', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const patientPage = new PatientPage(page);
    const worklistPage = new LaboratoryWorklistPage(page);

    await test.step('Ouverture de la page de connexion', async () => {
        await loginPage.goto();
        await loginPage.login(adminUser.username, adminUser.password);
        await loginPage.selectStructure(adminUser.hi);
    });

    await test.step('Vérifier que le dashboard affiche les statistiques', async () => {
        await dashboardPage.statisticIsVisible();
    });

    let firstPatientLastName = '';
    await test.step('Récupérer le nom du premier patient de la liste', async () => {
        await patientPage.gotoPatientsList();
        firstPatientLastName = await patientPage.getFirstPatientLastName();
        expect(firstPatientLastName).toBeTruthy();
    });

    await test.step('Accéder au worklist laboratoire', async () => {
        await worklistPage.gotoWorklist();
    });

    await test.step('Rechercher par nom et vérifier la mise à jour du tableau', async () => {
        await worklistPage.searchByLastName(firstPatientLastName);
        await worklistPage.expectResultsMatchLastName(firstPatientLastName);
    });

    await test.step('Réinitialiser puis rechercher par type de bilan et vérifier la mise à jour du tableau', async () => {
        await worklistPage.reset();
        const typeLabel = await worklistPage.filterByFirstAvailableType();
        await worklistPage.expectResultsMatchType(typeLabel);
    });

    await test.step('Réinitialiser puis rechercher par prescripteur et vérifier la mise à jour du tableau', async () => {
        await worklistPage.reset();
        const prescriberLabel = await worklistPage.filterByFirstAvailablePrescriber();
        await worklistPage.expectResultsMatchPrescriber(prescriberLabel);
    });
});
