import { type Page } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { createDossierPatient, openDossier, DOSSIER_SETUP_TIMEOUT, type DossierPatient } from '../../fixtures/dossier-patient';
import { type PortalPage } from '../../pages/structure/portal/portal.page';
import { ConsultationPage } from '../../pages/structure/consultation/consultation.page';
import { ConsultationStandardDataGenerator } from '../../pages/structure/generator/consultation-standard-data-generator';
import { BillingInvoicePage } from '../../pages/structure/billing/billing-invoice.page';
import { BillingListPatientPage } from '../../pages/structure/billing/billing-list.page';
import { VaccinationPage } from '../../pages/structure/vaccination/vaccination.page';
import { ConsultationFormPage } from '../../pages/structure/consultation/consultation-form.page';
import { isoDate } from '../../test-data/consultation-fields';

test.setTimeout(300000);

/**
 * Actes à facturer choisis dans un acte médical (champ "Actes à facturer") : ils arrivent à
 * facturer dans le module Facturation ; une fois facturés, ils sont grisés quand on modifie l'acte
 * médical, et la suppression de l'acte médical est bloquée tant que la facture existe.
 */

/** Message de l'application quand un acte médical à facturer est déjà facturé. */
const BLOCKED = /suppression\s+a\s+échoué\s*:\s*au moins une facture existe/i;

test.describe('Module Facturation — Actes à facturer depuis le dossier médical', () => {
  test.describe('Consultation standard', () => {
    test.describe.configure({ mode: 'serial' });
    // Deux actes à facturer : seul le premier est facturé
    const BILLED = 'GLYCÉMIE';
    const NOT_BILLED = 'PRÉLÈVEMENT';
    const TYPE = 'CONSULTATION ANESTHÉSIQUE';
    let patient: DossierPatient;
    let invoiceOrder = '';

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(DOSSIER_SETUP_TIMEOUT);
      patient = await createDossierPatient(browser);
    });

    async function openConsultations(portal: PortalPage, page: Page) {
      await portal.enterModule('Dossier médical');
      await openDossier(page, patient);
      const consultationPage = new ConsultationPage(page);
      await consultationPage.goToConsultationTab();
      await consultationPage.expectConsultationsListLoaded();
      return consultationPage;
    }

    /** Rouvre la consultation standard du patient (formulaire en lecture). */
    async function openConsultation(portal: PortalPage, page: Page) {
      const consultationPage = await openConsultations(portal, page);
      await consultationPage.filterByConsultationType(TYPE);
      await consultationPage.openFirstConsultation();
      return consultationPage;
    }

    async function openBilling(portal: PortalPage, page: Page) {
      const invoicePage = new BillingInvoicePage(page);
      await portal.enterModule('Facturation');
      await page.waitForURL('**/billing/billings-create');
      await invoicePage.searchPatientByIdentifier(patient.identifier);
      await invoicePage.selectFirstSearchResult();
      return invoicePage;
    }

    /** Pastille d'un acte à facturer sélectionné dans le formulaire de la consultation. */
    const actChip = (page: Page, act: string) =>
      page.locator('ng-select[formcontrolname="billableActs"] .ng-value').filter({ hasText: new RegExp(act, 'i') });

    test(`Créer une consultation standard avec deux actes à facturer (${BILLED}, ${NOT_BILLED})`, async ({ portal, page }) => {
      const consultationPage = await openConsultations(portal, page);
      const data = { ...ConsultationStandardDataGenerator.generate(), acts: [BILLED, NOT_BILLED] };
      await consultationPage.openNewConsultationModal();
      await consultationPage.fillConsultationBasics(data);
      await consultationPage.createConsultation();
      await consultationPage.fillMedicalConsultationForm(data);
      for (const act of data.acts) await expect(actChip(page, act), `Acte à facturer "${act}" choisi`).toHaveCount(1);
      await consultationPage.saveConsultation();
    });

    test('Les actes choisis sont à facturer dans le module Facturation', async ({ portal, page }) => {
      const invoicePage = await openBilling(portal, page);
      await expect.poll(() => invoicePage.counters(), { message: 'Deux actes à facturer' }).toEqual({ toBill: 2, inInvoice: 0 });
      for (const act of [BILLED, NOT_BILLED]) {
        expect(await invoicePage.showPendingAct(act), `"${act}" à facturer`).not.toBeNull();
      }
    });

    test(`Facturer ${BILLED} seulement`, async ({ portal, page }) => {
      const invoicePage = await openBilling(portal, page);
      await invoicePage.setActAmount(BILLED, 3000);
      await invoicePage.proceedToBilling();
      await invoicePage.generateInvoice();
      const invoices = await new BillingListPatientPage(page).invoicesOf(patient.identifier);
      expect(invoices.map(i => i.amount), 'Une facture patient de 3 000').toEqual([3000]);
      invoiceOrder = invoices[0].order;
    });

    test('Rouvrir la consultation : l\'acte facturé est grisé, l\'autre reste modifiable', async ({ portal, page }) => {
      const consultationPage = await openConsultation(portal, page);
      await consultationPage.activateForm();
      await expect(actChip(page, BILLED), `"${BILLED}" facturé : non retirable`).toHaveClass(/ng-value-disabled/);
      await expect(actChip(page, NOT_BILLED), `"${NOT_BILLED}" non facturé : retirable`).not.toHaveClass(/ng-value-disabled/);
    });

    test('Supprimer la consultation est bloqué tant que la facture existe', async ({ portal, page }) => {
      const consultationPage = await openConsultation(portal, page);
      await consultationPage.deleteConsultation();
      await expect(page.getByText(BLOCKED).first(), 'Suppression refusée : une facture existe').toBeVisible({ timeout: 15000 });
      const again = await openConsultations(portal, page);
      await again.filterByConsultationType(TYPE);
      await expect(page.locator('app-consultations').getByRole('button', { name: /Consultation/ }).first(), 'Consultation toujours présente').toBeVisible();
    });

    test('Après suppression de la facture, la consultation peut être supprimée', async ({ portal, page }) => {
      await test.step(`Supprimer la facture ${invoiceOrder}`, async () => {
        await portal.enterModule('Facturation');
        await portal.openMenu('Factures patients', '**/billing/billings-patients');
        const list = new BillingListPatientPage(page);
        await list.invoicesOf(patient.identifier);
        await list.deleteInvoice(invoiceOrder);
      });
      await test.step('Supprimer la consultation', async () => {
        const consultationPage = await openConsultation(portal, page);
        await consultationPage.deleteConsultation();
        await expect(page.getByText(/suppression de la consultation a\s+r[ée]ussi/i).first()).toBeVisible({ timeout: 15000 });
      });
      await test.step('Ses actes ne sont plus à facturer', async () => {
        const invoicePage = await openBilling(portal, page);
        await expect.poll(() => invoicePage.counters(), { message: 'Plus aucun acte à facturer' }).toEqual({ toBill: 0, inInvoice: 0 });
      });
    });
  });

  test.describe('Vaccination', () => {
    test.describe.configure({ mode: 'serial' });
    let patient: DossierPatient;
    let act = '';
    let invoiceOrder = '';

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(DOSSIER_SETUP_TIMEOUT);
      patient = await createDossierPatient(browser);
    });

    /** Ouvre la liste des vaccinations du patient. */
    async function openVaccinations(portal: PortalPage, page: Page) {
      await portal.enterModule('Dossier médical');
      await openDossier(page, patient);
      const vaccination = new VaccinationPage(page);
      await vaccination.gotoFromPatientDashboard();
      return vaccination;
    }

    async function openBilling(portal: PortalPage, page: Page) {
      const invoicePage = new BillingInvoicePage(page);
      await portal.enterModule('Facturation');
      await page.waitForURL('**/billing/billings-create');
      await invoicePage.searchPatientByIdentifier(patient.identifier);
      await invoicePage.selectFirstSearchResult();
      return invoicePage;
    }

    const confirm = async (page: Page) => {
      const button = page.getByRole('button', { name: /^\W*Confirmer$/ }).last();
      await expect(button).toBeVisible({ timeout: 10000 });
      await button.click();
    };

    test('Créer une vaccination avec un acte à facturer', async ({ portal, page }) => {
      const vaccination = await openVaccinations(portal, page);
      await vaccination.openNewVaccinationModal();
      const values = await new ConsultationFormPage(page, vaccination.modal).fill([
        { name: 'type', kind: 'select' },
        { name: 'caregiverId', kind: 'select' },
        { name: 'dose', kind: 'select' },
        { name: 'date', kind: 'date', value: isoDate(-1) },
        { name: 'billableActs', kind: 'multiselect', count: 1 },
      ]);
      act = (values.billableActs as string[])[0];
      expect(act, 'Acte à facturer choisi').toBeTruthy();
      await vaccination.validerButton.click();
      await expect(vaccination.modal).toBeHidden({ timeout: 20000 });
      await expect(vaccination.firstVaccinationHeader).toBeVisible();
    });

    test("L'acte choisi est à facturer dans le module Facturation", async ({ portal, page }) => {
      const invoicePage = await openBilling(portal, page);
      await expect.poll(() => invoicePage.counters(), { message: 'Un acte à facturer' }).toEqual({ toBill: 1, inInvoice: 0 });
      expect(await invoicePage.showPendingAct(act), `"${act}" à facturer`).not.toBeNull();
    });

    test("Facturer l'acte de la vaccination", async ({ portal, page }) => {
      const invoicePage = await openBilling(portal, page);
      await invoicePage.setActAmount(act, 4000);
      await invoicePage.proceedToBilling();
      await invoicePage.generateInvoice();
      const invoices = await new BillingListPatientPage(page).invoicesOf(patient.identifier);
      expect(invoices.map(i => i.amount), 'Une facture patient de 4 000').toEqual([4000]);
      invoiceOrder = invoices[0].order;
    });

    test("Modifier la vaccination : l'acte facturé est grisé", async ({ portal, page }) => {
      const vaccination = await openVaccinations(portal, page);
      await vaccination.openFirstVaccination();
      const item = page.locator('app-vaccination-simple-item').filter({ visible: true }).first();
      await item.getByRole('button', { name: /Modifier la vaccination/ }).click();
      await expect(item.locator('ng-select[formcontrolname="billableActs"] .ng-value').filter({ hasText: act }), `"${act}" facturé : non retirable`)
        .toHaveClass(/ng-value-disabled/);
    });

    test('Supprimer la vaccination est bloqué tant que la facture existe', async ({ portal, page }) => {
      const vaccination = await openVaccinations(portal, page);
      await vaccination.openFirstVaccination();
      await vaccination.supprimerButton.click();
      await confirm(page);
      await expect(page.getByText(BLOCKED).first(), 'Suppression refusée : une facture existe').toBeVisible({ timeout: 15000 });
      const again = await openVaccinations(portal, page);
      await expect(again.firstVaccinationHeader, 'Vaccination toujours présente').toBeVisible();
    });

    test('Après suppression de la facture, la vaccination peut être supprimée', async ({ portal, page }) => {
      await test.step(`Supprimer la facture ${invoiceOrder}`, async () => {
        await portal.enterModule('Facturation');
        await portal.openMenu('Factures patients', '**/billing/billings-patients');
        const list = new BillingListPatientPage(page);
        await list.invoicesOf(patient.identifier);
        await list.deleteInvoice(invoiceOrder);
      });
      await test.step('Supprimer la vaccination', async () => {
        const vaccination = await openVaccinations(portal, page);
        await vaccination.deleteFirstVaccination();
        await expect(vaccination.firstVaccinationHeader).toHaveCount(0, { timeout: 15000 });
      });
      await test.step("Son acte n'est plus à facturer", async () => {
        const invoicePage = await openBilling(portal, page);
        await expect.poll(() => invoicePage.counters(), { message: 'Plus aucun acte à facturer' }).toEqual({ toBill: 0, inInvoice: 0 });
      });
    });
  });
});
