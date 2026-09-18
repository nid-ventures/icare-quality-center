// tests/structure-app-tests/04_billing/01_verification_recherche_factures_patient.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { BillingInvoicePage } from '../../../pages/structure/billing/billing-invoice.page';
import { BillingListPatientPage } from '../../../pages/structure/billing/billing-list.page';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

test.setTimeout(120000);

// PRÉ-REQUIS DU TEST : sur un environnement local fraîchement provisionné, la liste des
// factures patients est vide (aucune donnée héritée d'exécutions précédentes). On crée donc
// d'abord une facture de référence (cf. BillingInvoicePage.createInvoiceForPatient) avant de
// tester la recherche par champ.
test('Rechercher des factures patients par chaque critère du formulaire', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const patientPage = new PatientPage(page);
    const billingInvoicePage = new BillingInvoicePage(page);
    const billingListPatientPage = new BillingListPatientPage(page);

    await test.step('Ouverture de la page de connexion et connexion', async () => {
        await loginPage.goto();
        await loginPage.login(adminUser.username, adminUser.password);
        await loginPage.selectStructure(adminUser.hi);
    });

    await test.step('Vérifier que le dashboard affiche les statistiques', async () => {
        await dashboardPage.statisticIsVisible();
    });

    await test.step('Créer une facture de référence pour ce patient (pré-requis du test)', async () => {
        await patientPage.gotoPatientsList();
        const patientIdentifier = await patientPage.getFirstPatientId();
        expect(patientIdentifier, 'Aucun patient disponible pour créer une facture').not.toBe('');

        await dashboardPage.goToFacturationCreate();
        await billingInvoicePage.createInvoiceForPatient(patientIdentifier);
    });

    await test.step('Accéder à la liste des factures patients', async () => {
        await dashboardPage.goToFacturationPatientList();
        await billingListPatientPage.expectListLoaded();
    });

    await test.step('Recherche individuelle par champ à partir de la première facture de la liste', async () => {
        const nbFactures = await billingListPatientPage.getRowCount();
        expect(nbFactures, 'Aucune facture patient trouvée pour tester la recherche').toBeGreaterThan(0);

        const reference = await billingListPatientPage.getFirstRowData();
        await billingListPatientPage.searchByEachField(reference);
    });

    await test.step('Réinitialiser le formulaire de recherche', async () => {
        await billingListPatientPage.reset();
        await billingListPatientPage.expectListLoaded();
    });
});
