// tests/structure-app-tests/10_my_space/02_verification_reporting_consultations.ts
import { test } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { MedicalActsReportingPage } from '../../../pages/structure/my-space/reporting.page';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

test(`Vérification du filtre et de la recherche de l'onglet Consultations du Reporting Médical par l'utilisateur ${adminUser.role}`, async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const reportingPage = new MedicalActsReportingPage(page);

    await test.step('Ouverture de la page de connexion et connexion', async () => {
        await loginPage.goto();
        await loginPage.login(adminUser.username, adminUser.password);
        await loginPage.selectStructure(adminUser.hi);
    });

    await test.step('Accéder au Reporting Médical (Prestations)', async () => {
        await dashboardPage.goToReportingPrestations();
        await reportingPage.expectLoaded();
    });

    await test.step('Lancer une recherche sans date de début : vérifier le message de validation', async () => {
        await reportingPage.searchConsultations();
        await reportingPage.expectConsultationValidationMessage(/Veuillez saisir la date de début/);
    });

    await test.step('Renseigner les dates puis lancer une recherche sans type de consultation : vérifier le message de validation', async () => {
        const today = new Date();
        const dateEnd = today.toISOString().slice(0, 10);
        const dateStart = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()).toISOString().slice(0, 10);
        await reportingPage.fillConsultationDateRange(dateStart, dateEnd);
        await reportingPage.searchConsultations();
        await reportingPage.expectConsultationValidationMessage(/Veuillez choisir un type/);
    });

    await test.step('Choisir un type de consultation puis rechercher : vérifier que le message de validation disparaît au profit du résultat', async () => {
        await reportingPage.selectFirstConsultationType();
        await reportingPage.searchConsultations();
        await reportingPage.expectConsultationValidationMessage(/consultation\(s\) trouvée\(s\)|Aucune consultation trouvée/);
    });

    await test.step('Réinitialiser les filtres de l\'onglet Consultations', async () => {
        await reportingPage.resetConsultationFilters();
    });
});
