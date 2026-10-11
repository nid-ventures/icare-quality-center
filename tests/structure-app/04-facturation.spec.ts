import { type Page } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { type PortalPage } from '../../pages/structure/portal/portal.page';
import { PatientPage } from '../../pages/structure/patient/patient.page';
import { BillingInvoicePage } from '../../pages/structure/billing/billing-invoice.page';
import { BillingListPatientPage, BillingListGarantPage } from '../../pages/structure/billing/billing-list.page';

test.setTimeout(120000);

/** Identifiant du premier patient de Base patients (patient de référence pour facturer). */
async function getReferencePatientIdentifier(portal: PortalPage, page: Page): Promise<string> {
  const patientPage = new PatientPage(page);
  let identifier = '';
  await test.step('Relever un identifiant patient dans Base patients', async () => {
    await portal.enterModule('Base patients');
    await patientPage.gotoPatientsList();
    identifier = await patientPage.getFirstPatientId();
    expect(identifier, 'Aucun patient disponible pour créer une facture').not.toBe('');
  });
  return identifier;
}

/** Crée une facture pour le patient (assistant complet) ; termine sur la liste des factures patients. */
async function createInvoice(portal: PortalPage, page: Page, patientIdentifier: string) {
  await test.step(`Créer une facture pour le patient ${patientIdentifier}`, async () => {
    await portal.enterModule('Facturation');
    await page.waitForURL('**/billing/billings-create');
    await new BillingInvoicePage(page).createInvoiceForPatient(patientIdentifier);
  });
}

/** Retrouve les factures du patient dans la liste des factures patients. */
async function findPatientInvoices(page: Page, patientIdentifier: string) {
  const listPage = new BillingListPatientPage(page);
  await listPage.expectListLoaded();
  await listPage.fillIdentifiantPatient(patientIdentifier);
  await listPage.search();
  expect(await listPage.getRowCount(), `Aucune facture retrouvée pour le patient "${patientIdentifier}"`).toBeGreaterThan(0);
  return listPage.getFirstRowData();
}

test.describe('Module Facturation', () => {

  // ======================================================================
  // Nouvelle facture (assistant)
  // ======================================================================
  test.describe('Nouvelle facture', () => {
    test("Afficher l'assistant de facturation", async ({ portal, page }) => {
      await portal.enterModule('Facturation');
      await page.waitForURL('**/billing/billings-create');
      await test.step('Vérifier les 3 étapes de l\'assistant', async () => {
        for (const step of ['Recherche Patient', 'Actes Médicaux', 'Facturation']) {
          await expect(page.getByRole('button', { name: new RegExp(`${step}$`) }).first()).toBeVisible();
        }
      });
      await test.step('Le bouton Rechercher est désactivé sans critère', async () => {
        await expect(page.getByRole('button', { name: /Rechercher$/ })).toBeDisabled();
      });
    });

    test("Créer une facture patient via l'assistant de facturation", async ({ portal, page }) => {
      const invoicePage = new BillingInvoicePage(page);
      const patientIdentifier = await getReferencePatientIdentifier(portal, page);

      await test.step("Ouvrir l'assistant et sélectionner le patient", async () => {
        await portal.enterModule('Facturation');
        await page.waitForURL('**/billing/billings-create');
        await invoicePage.searchPatientByIdentifier(patientIdentifier);
        expect(await invoicePage.getSearchResultsCount()).toBeGreaterThan(0);
        await invoicePage.selectFirstSearchResult();
      });

      await test.step('Ajouter un acte facturable et saisir son montant', async () => {
        await invoicePage.seedBillableAct();
        const filled = await invoicePage.fillFirstAvailableActAmount('5000');
        expect(filled, "Aucune ligne d'acte facturable exploitable après ajout de l'acte de test").toBeTruthy();
      });

      await test.step('Facturer les actes, appliquer une prise en charge si disponible, générer', async () => {
        await invoicePage.proceedToBilling();
        await invoicePage.tryApplyFirstAvailableInsurance();
        await invoicePage.generateInvoice();
        await expect(page).toHaveURL(/\/billing\/billings-patients/);
      });

      await test.step('Vérifier la facture dans la liste des factures patients', async () => {
        await findPatientInvoices(page, patientIdentifier);
      });
    });
  });

  // ======================================================================
  // Factures patients
  // ======================================================================
  test.describe('Factures patients', () => {
    test('Rechercher des factures patients par chaque critère', async ({ portal, page }) => {
      const listPage = new BillingListPatientPage(page);
      const patientIdentifier = await getReferencePatientIdentifier(portal, page);
      await createInvoice(portal, page, patientIdentifier);

      await test.step('Ouvrir la liste des factures patients depuis le menu', async () => {
        await portal.openMenu('Factures patients', '**/billing/billings-patients');
        await listPage.expectListLoaded();
      });

      await test.step('Rechercher par chaque champ à partir de la première facture', async () => {
        expect(await listPage.getRowCount()).toBeGreaterThan(0);
        await listPage.searchByEachField(await listPage.getFirstRowData());
      });

      await test.step('Réinitialiser la recherche', async () => {
        await listPage.reset();
        await listPage.expectListLoaded();
      });
    });

    test("Voir le détail d'une facture patient", async ({ portal, page }) => {
      const listPage = new BillingListPatientPage(page);
      const patientIdentifier = await getReferencePatientIdentifier(portal, page);
      await createInvoice(portal, page, patientIdentifier);
      const reference = await findPatientInvoices(page, patientIdentifier);

      await test.step('Ouvrir et vérifier la fenêtre de détail', async () => {
        await listPage.openDetailModal();
        const detailModal = listPage.getDetailModal();
        await expect(detailModal.getByText(reference.invoiceOrder)).toBeVisible();
        await expect(detailModal).toContainText(reference.nomPatient);
        await expect(detailModal).toContainText(reference.prenomPatient);
        await expect(detailModal.getByText('Total Facture (F CFA)')).toBeVisible();
      });

      await test.step('Fermer la fenêtre de détail', async () => {
        await listPage.closeDetailModal();
      });
    });

    test('Supprimer une facture patient', async ({ portal, page }) => {
      const listPage = new BillingListPatientPage(page);
      const patientIdentifier = await getReferencePatientIdentifier(portal, page);
      await createInvoice(portal, page, patientIdentifier);
      const { invoiceOrder } = await findPatientInvoices(page, patientIdentifier);

      await test.step('Supprimer la facture et confirmer', async () => {
        await listPage.deleteRow();
      });

      await test.step("Vérifier que la facture n'apparaît plus", async () => {
        await listPage.fillIdentifiantPatient(patientIdentifier);
        await listPage.search();
        await listPage.expectInvoiceNotVisible(invoiceOrder);
      });
    });
  });

  // ======================================================================
  // Factures garants
  // ======================================================================
  test.describe('Factures garants', () => {
    test('Rechercher des factures garants par chaque critère', async ({ portal, page }) => {
      const listPage = new BillingListGarantPage(page);
      const patientIdentifier = await getReferencePatientIdentifier(portal, page);
      await createInvoice(portal, page, patientIdentifier);

      await test.step('Ouvrir la liste des factures garants depuis le menu', async () => {
        await portal.openMenu('Factures garants', '**/billing/billings-garants');
        await listPage.expectListLoaded();
      });

      await test.step('Rechercher par chaque champ (dont Garant) à partir de la première facture', async () => {
        expect(await listPage.getRowCount()).toBeGreaterThan(0);
        await listPage.searchByEachField(await listPage.getFirstRowData());
      });

      await test.step('Réinitialiser la recherche', async () => {
        await listPage.reset();
        await listPage.expectListLoaded();
      });
    });
  });
});
