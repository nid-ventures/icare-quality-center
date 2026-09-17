// tests/structure-app-tests/04_billing/04_verification_voir_details_facture.ts
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

// PRÉ-REQUIS DU TEST : on crée d'abord une facture pour le premier patient de la liste (via
// BillingInvoicePage.createInvoiceForPatient, qui ajoute un acte facturable de test avant de
// dérouler l'assistant de facturation - cf. commentaire détaillé dans BillingInvoicePage), puis
// on la retrouve de façon fiable dans la liste des factures patients en filtrant par
// "Identifiant Patient" (plutôt que de supposer un ordre de tri particulier de la liste).
test('Voir le détail d\'une facture patient', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const patientPage = new PatientPage(page);
    const billingInvoicePage = new BillingInvoicePage(page);
    const billingListPatientPage = new BillingListPatientPage(page);

    let patientIdentifier = '';

    await test.step('Ouverture de la page de connexion et connexion', async () => {
        await loginPage.goto();
        await loginPage.login(adminUser.username, adminUser.password);
        await loginPage.selectStructure(adminUser.hi);
    });

    await test.step('Vérifier que le dashboard affiche les statistiques', async () => {
        await dashboardPage.statisticIsVisible();
    });

    await test.step('Récupérer l\'identifiant du premier patient de la liste', async () => {
        await patientPage.gotoPatientsList();
        patientIdentifier = await patientPage.getFirstPatientId();
        expect(patientIdentifier, 'Aucun patient disponible pour créer une facture').not.toBe('');
    });

    await test.step('Créer une facture pour ce patient (pré-requis du test)', async () => {
        await dashboardPage.goToFacturationCreate();
        await billingInvoicePage.createInvoiceForPatient(patientIdentifier);
    });

    let reference: Awaited<ReturnType<BillingListPatientPage['getFirstRowData']>>;

    await test.step('Retrouver la facture créée dans la liste des factures patients', async () => {
        await billingListPatientPage.expectListLoaded();
        await billingListPatientPage.fillIdentifiantPatient(patientIdentifier);
        await billingListPatientPage.search();
        const nbFactures = await billingListPatientPage.getRowCount();
        expect(nbFactures, `Aucune facture retrouvée pour le patient "${patientIdentifier}"`).toBeGreaterThan(0);
        reference = await billingListPatientPage.getFirstRowData();
    });

    await test.step('Ouvrir la fenêtre de détail de la facture', async () => {
        await billingListPatientPage.openDetailModal();
    });

    await test.step('Vérifier les informations clés affichées dans le détail', async () => {
        const detailModal = billingListPatientPage.getDetailModal();
        await expect(detailModal.getByText(reference.invoiceOrder)).toBeVisible();
        await expect(detailModal).toContainText(reference.nomPatient);
        await expect(detailModal).toContainText(reference.prenomPatient);
        await expect(detailModal.getByText(/Total Facture/)).toBeVisible();
    });

    await test.step('Fermer la fenêtre de détail', async () => {
        await billingListPatientPage.closeDetailModal();
    });
});
