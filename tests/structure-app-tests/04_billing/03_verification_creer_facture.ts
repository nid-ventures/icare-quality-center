// tests/structure-app-tests/04_billing/03_verification_creer_facture.ts
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

// NOTE SUR LA STRATÉGIE DE TEST :
// Un patient fraîchement sélectionné dans l'assistant de facturation n'a en général aucun acte
// médical NON FACTURÉ en attente (le tableau de l'onglet "Actes Médicaux" est vide et le bouton
// "Procéder à la facturation" n'apparaît jamais). Pour fiabiliser ce test de bout en bout, on
// ajoute donc d'abord un acte facturable au patient choisi via la modale "Ajouter un acte"
// (voir BillingInvoicePage.seedBillableAct), avant d'enchaîner sur les 3 onglets de l'assistant
// (Recherche Patient -> Actes Médicaux -> Facturation) jusqu'à "Générer la facture".
test('Créer une facture patient via l\'assistant de facturation', async ({ page }) => {
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

    await test.step('Accéder à l\'assistant de création de facture', async () => {
        await dashboardPage.goToFacturationCreate();
    });

    await test.step('Rechercher et sélectionner le patient', async () => {
        await billingInvoicePage.searchPatientByIdentifier(patientIdentifier);
        expect(await billingInvoicePage.getSearchResultsCount()).toBeGreaterThan(0);
        await billingInvoicePage.selectFirstSearchResult();
    });

    await test.step('Ajouter un acte facturable de test au patient (pré-requis du test)', async () => {
        await billingInvoicePage.seedBillableAct();
    });

    await test.step('Saisir un montant sur l\'acte ajouté pour l\'activer', async () => {
        const filled = await billingInvoicePage.fillFirstAvailableActAmount('5000');
        expect(filled, 'Aucune ligne d\'acte facturable exploitable trouvée après ajout de l\'acte de test').toBeTruthy();
    });

    await test.step('Procéder à la facturation des actes sélectionnés', async () => {
        await billingInvoicePage.proceedToBilling();
    });

    await test.step('Appliquer, si disponible, une prise en charge (facultatif)', async () => {
        await billingInvoicePage.tryApplyFirstAvailableInsurance();
    });

    await test.step('Générer la facture', async () => {
        await billingInvoicePage.generateInvoice();
        await expect(page).toHaveURL(/\/billing\/billings-patients/);
    });

    await test.step('Vérifier que la facture générée apparaît dans la liste des factures patients', async () => {
        await billingListPatientPage.expectListLoaded();
        await billingListPatientPage.fillIdentifiantPatient(patientIdentifier);
        await billingListPatientPage.search();
        const nbFactures = await billingListPatientPage.getRowCount();
        expect(nbFactures, `Aucune facture retrouvée pour le patient "${patientIdentifier}" après création`).toBeGreaterThan(0);
    });
});
