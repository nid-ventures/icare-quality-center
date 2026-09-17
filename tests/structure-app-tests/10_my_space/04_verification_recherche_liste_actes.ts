// tests/structure-app-tests/10_my_space/04_verification_recherche_liste_actes.ts
import { test } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { BillableBillingReportingPage } from '../../../pages/structure/my-space/reporting.page';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

test(`Vérification de la recherche dans la Liste des actes par l'utilisateur ${adminUser.role}`, async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const billableBillingPage = new BillableBillingReportingPage(page);

    await test.step('Ouverture de la page de connexion et connexion', async () => {
        await loginPage.goto();
        await loginPage.login(adminUser.username, adminUser.password);
        await loginPage.selectStructure(adminUser.hi);
    });

    await test.step('Accéder à la Liste des actes (Reporting)', async () => {
        await dashboardPage.goToReportingBillableBilling();
        await billableBillingPage.expectLoaded();
    });

    await test.step('Rechercher sans filtre : la liste se charge (résultats ou message "Aucun enregistrement")', async () => {
        await billableBillingPage.search();
        await billableBillingPage.expectResultsRendered();
    });

    await test.step('Rechercher avec un identifiant patient manifestement inexistant : aucun résultat', async () => {
        await billableBillingPage.fillPatientIdentifier('QA-TEST-INEXISTANT-999999');
        await billableBillingPage.search();
        await billableBillingPage.expectNoResults();
    });

    await test.step('Changer le filtre Statut sur "Facturé" puis "Non Facturé"', async () => {
        await billableBillingPage.reset();
        await billableBillingPage.selectStatus('Facturé');
        await billableBillingPage.search();
        await billableBillingPage.expectResultsRendered();

        await billableBillingPage.selectStatus('Non Facturé');
        await billableBillingPage.search();
        await billableBillingPage.expectResultsRendered();
    });

    await test.step('Réinitialiser le formulaire de recherche', async () => {
        await billableBillingPage.reset();
        await billableBillingPage.expectLoaded();
    });
});
