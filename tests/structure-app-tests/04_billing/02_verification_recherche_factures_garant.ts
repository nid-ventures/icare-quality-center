// tests/structure-app-tests/04_billing/02_verification_recherche_factures_garant.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { BillingListGarantPage } from '../../../pages/structure/billing/billing-list.page';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

test('Rechercher des factures garants par chaque critère du formulaire', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const billingListGarantPage = new BillingListGarantPage(page);

    await test.step('Ouverture de la page de connexion et connexion', async () => {
        await loginPage.goto();
        await loginPage.login(adminUser.username, adminUser.password);
        await loginPage.selectStructure(adminUser.hi);
    });

    await test.step('Vérifier que le dashboard affiche les statistiques', async () => {
        await dashboardPage.statisticIsVisible();
    });

    await test.step('Accéder à la liste des factures garants', async () => {
        await dashboardPage.goToFacturationGarantList();
        await billingListGarantPage.expectListLoaded();
    });

    await test.step('Recherche individuelle par champ (dont Garant) à partir de la première facture de la liste', async () => {
        const nbFactures = await billingListGarantPage.getRowCount();
        expect(nbFactures, 'Aucune facture garant trouvée pour tester la recherche').toBeGreaterThan(0);

        const reference = await billingListGarantPage.getFirstRowData();
        await billingListGarantPage.searchByEachField(reference);
    });

    await test.step('Réinitialiser le formulaire de recherche', async () => {
        await billingListGarantPage.reset();
        await billingListGarantPage.expectListLoaded();
    });
});
