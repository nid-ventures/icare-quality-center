import { type Page, type Locator } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { createDossierPatient, openDossier, DOSSIER_SETUP_TIMEOUT, type DossierPatient } from '../../fixtures/dossier-patient';
import { type PortalPage } from '../../pages/structure/portal/portal.page';
import { ConsultationPage } from '../../pages/structure/consultation/consultation.page';
import { ConsultationStandardDataGenerator } from '../../pages/structure/generator/consultation-standard-data-generator';
import { BillingInvoicePage } from '../../pages/structure/billing/billing-invoice.page';
import { BillingListPatientPage } from '../../pages/structure/billing/billing-list.page';
import { VaccinationPage } from '../../pages/structure/vaccination/vaccination.page';
import { ConsultationFormPage, type FieldSpec } from '../../pages/structure/consultation/consultation-form.page';
import { ImagerieDashboardPage } from '../../pages/structure/imagerie/imagerie-dashboard.page';
import { HealthChecksListPage, HealthCheckDetailPage } from '../../pages/structure/analyse/health-check.page';
import { isoDate, prenatalFields, planificationFields, pediatricFields, dentalFields } from '../../test-data/consultation-fields';
import { tenant, hasModule, withoutModuleReason } from '../../test-data/tenants';
import { ACTS } from '../../test-data/cover-scenarios';
import { confirmSave } from '../../pages/structure/shared/confirm-save';
import { billableActRows, expectBillableActsInDb } from '../../fixtures/billable-acts-db';

// Module absent de certaines structures (cf. test-data/tenants.ts) : fichier ignoré pour elles
test.skip(!hasModule('Facturation'), withoutModuleReason('Facturation'));

test.setTimeout(300000);

/**
 * Actes à facturer choisis dans un acte médical (champ "Actes à facturer") : ils arrivent à
 * facturer dans le module Facturation ; une fois facturés, ils sont grisés quand on modifie l'acte
 * médical, et la suppression de l'acte médical est bloquée tant que la facture existe.
 */

/**
 * Message de l'application quand un acte médical à facturer est déjà facturé ("Suppression
 * impossible : une facture existe déjà" pour la planification familiale).
 */
const BLOCKED = /suppression\s+a\s+échoué\s*:\s*au moins une facture existe|suppression impossible\s*:\s*une facture existe/i;

test.describe('Module Facturation — Actes à facturer depuis le dossier médical', () => {
  test.describe('Consultation standard', () => {
    test.describe.configure({ mode: 'serial' });
    // Deux actes à facturer proposés par la structure testée (relevés à la création) : seul le premier est facturé
    let BILLED = '';
    let NOT_BILLED = '';
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

    test('Créer une consultation standard avec deux actes à facturer', async ({ portal, page }) => {
      const consultationPage = await openConsultations(portal, page);
      const data = ConsultationStandardDataGenerator.generate();
      await consultationPage.openNewConsultationModal();
      await consultationPage.fillConsultationBasics(data);
      await consultationPage.createConsultation();
      const acts = await consultationPage.availableActs(2);
      expect(acts, `Deux actes à facturer proposés par ${tenant.name}`).toHaveLength(2);
      [BILLED, NOT_BILLED] = acts;
      test.info().annotations.push({ type: 'Actes à facturer choisis', description: acts.join(' ; ') });
      data.acts = acts;
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

    test('Facturer le premier acte seulement', async ({ portal, page }) => {
      const invoicePage = await openBilling(portal, page);
      await invoicePage.setActAmount(BILLED, 3000);
      await test.step('Acte venu de la consultation : date et praticien en lecture seule, même coché', async () => {
        const line = invoicePage.lineOf(BILLED).first();
        await expect(invoicePage.lineDateInput(line), 'Date non modifiable').toHaveCount(0);
        await expect(invoicePage.lineCaregiverSelect(line), 'Praticien non modifiable').toHaveCount(0);
      });
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

  // Consultations prénatale, de planification familiale, pédiatrique et dentaire : tous leurs champs
  // (dont un acte à facturer) remplis comme dans les tests du dossier médical
  for (const def of [
    { label: 'Consultation prénatale', specialty: 'gynécologie-obstétrique', type: 'CONSULTATION prénatale', filter: 'CONSULTATION PRÉNATALE', createRoot: 'app-consultation-prenatal', editRoot: 'app-consultation-prenatal-edit', probe: 'appearance', fields: prenatalFields },
    { label: 'Consultation de planification familiale', specialty: 'gynécologie-obstétrique', type: 'CONSULTATION planification familiale', filter: 'CONSULTATION PLANIFICATION', createRoot: 'app-consultation-planification-familiale', editRoot: 'app-consultation-planification-familiale-edit', probe: 'observations', fields: planificationFields },
    { label: 'Consultation pédiatrique', specialty: 'pédiatrie', type: 'CONSULTATION pédiatrique', filter: 'CONSULTATION PÉDIATRIQUE', createRoot: 'app-consultation-pediatric', editRoot: 'app-consultation-pediatric-edit', probe: 'report', fields: pediatricFields },
    { label: 'Consultation dentaire', specialty: 'dentiste', type: 'CONSULTATION dentaire', filter: 'CONSULTATION DENTAIRE', createRoot: 'app-consultation-tooth', editRoot: 'app-consultation-tooth-edit', probe: 'conclusion', fields: dentalFields },
  ]) {
    test.describe(def.label, () => {
      test.describe.configure({ mode: 'serial' });
      let patient: DossierPatient;
      let act = '';
      let invoiceOrder = '';
      const root = (page: Page, selector: string) => page.locator(selector).filter({ visible: true }).first();

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

      /** Rouvre la consultation du patient et renvoie son formulaire de modification. */
      async function openConsultation(portal: PortalPage, page: Page) {
        const consultationPage = await openConsultations(portal, page);
        await consultationPage.filterByConsultationType(def.filter);
        await consultationPage.openFirstConsultation();
        const form = root(page, def.editRoot);
        await expect(form, `Formulaire "${def.label}"`).toBeVisible({ timeout: 15000 });
        return form;
      }

      async function openBilling(portal: PortalPage, page: Page) {
        const invoicePage = new BillingInvoicePage(page);
        await portal.enterModule('Facturation');
        await page.waitForURL('**/billing/billings-create');
        await invoicePage.searchPatientByIdentifier(patient.identifier);
        await invoicePage.selectFirstSearchResult();
        return invoicePage;
      }

      test(`Créer une ${def.label.toLowerCase()} avec un acte à facturer`, async ({ portal, page }) => {
        const consultationPage = await openConsultations(portal, page);
        await consultationPage.openNewConsultationModal();
        await consultationPage.fillConsultationBasics({ specialty: def.specialty, consultationType: def.type });
        await consultationPage.createConsultation();
        const form = root(page, def.createRoot);
        await expect(form).toBeVisible({ timeout: 15000 });
        const values = await new ConsultationFormPage(page, form).fill(def.fields(1));
        act = (values.billableActs as string[])[0];
        expect(act, 'Acte à facturer choisi').toBeTruthy();
        await new ConsultationFormPage(page, form).saveNew();
      });

      test("L'acte choisi est à facturer dans le module Facturation", async ({ portal, page }) => {
        const invoicePage = await openBilling(portal, page);
        await expect.poll(() => invoicePage.counters(), { message: 'Un acte à facturer' }).toEqual({ toBill: 1, inInvoice: 0 });
        expect(await invoicePage.showPendingAct(act), `"${act}" à facturer`).not.toBeNull();
      });

      test("Facturer l'acte de la consultation", async ({ portal, page }) => {
        const invoicePage = await openBilling(portal, page);
        await invoicePage.setActAmount(act, 5000);
        await invoicePage.proceedToBilling();
        await invoicePage.generateInvoice();
        const invoices = await new BillingListPatientPage(page).invoicesOf(patient.identifier);
        expect(invoices.map(i => i.amount), 'Une facture patient de 5 000').toEqual([5000]);
        invoiceOrder = invoices[0].order;
      });

      test("Modifier la consultation : l'acte facturé est grisé", async ({ portal, page }) => {
        const form = await openConsultation(portal, page);
        await new ConsultationFormPage(page, form).activate(def.probe);
        await expect(form.locator('ng-select[formcontrolname="billableActs"] .ng-value').filter({ hasText: act }), `"${act}" facturé : non retirable`)
          .toHaveClass(/ng-value-disabled/);
      });

      test('Supprimer la consultation est bloqué tant que la facture existe', async ({ portal, page }) => {
        const form = await openConsultation(portal, page);
        await new ConsultationFormPage(page, form).deleteConsultation();
        await expect(page.getByText(BLOCKED).first(), 'Suppression refusée : une facture existe').toBeVisible({ timeout: 15000 });
        const consultationPage = await openConsultations(portal, page);
        await consultationPage.filterByConsultationType(def.filter);
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
          const form = await openConsultation(portal, page);
          await new ConsultationFormPage(page, form).deleteConsultation();
          const consultationPage = await openConsultations(portal, page);
          await consultationPage.filterByConsultationType(def.filter);
          await expect(page.locator('app-consultations').getByRole('button', { name: /Consultation/ })).toHaveCount(0, { timeout: 15000 });
        });
        await test.step("Son acte n'est plus à facturer", async () => {
          const invoicePage = await openBilling(portal, page);
          await expect.poll(() => invoicePage.counters(), { message: 'Plus aucun acte à facturer' }).toEqual({ toBill: 0, inInvoice: 0 });
        });
      });
    });
  }

  // Échographie (écran propre) et scanner (écran commun au scanner, à l'IRM et à la radiographie)
  for (const imaging of [
    {
      label: 'Échographie', kind: 'ECHOGRAPHIE' as const, key: 'echographie', root: 'app-echographie-simple-static',
      submit: /Enregistrer l'échographie/, first: [{ name: 'type', kind: 'select', option: 'Standard' }] as FieldSpec[], withExamDate: false,
    },
    {
      label: 'Scanner', kind: 'SCANNER' as const, key: 'scanner', root: 'app-scanner-static',
      submit: /Enregistrer le scanner/, first: [] as FieldSpec[], withExamDate: true,
    },
  ]) {
    test.describe(imaging.label, () => {
      test.describe.configure({ mode: 'serial' });
      let patient: DossierPatient;
      let act = '';
      let invoiceOrder = '';
      const items = (page: Page) => page.locator(`.imaging-item.imaging-item--${imaging.key}`);

      test.beforeAll(async ({ browser }) => {
        test.setTimeout(DOSSIER_SETUP_TIMEOUT);
        patient = await createDossierPatient(browser);
      });

      async function openImaging(portal: PortalPage, page: Page) {
        await portal.enterModule('Dossier médical');
        await openDossier(page, patient);
        const imagerie = new ImagerieDashboardPage(page);
        await imagerie.gotoFromPatientDashboard();
        return imagerie;
      }

      /** Déplie l'acte d'imagerie du patient et renvoie son formulaire. */
      async function openItem(portal: PortalPage, page: Page): Promise<Locator> {
        await openImaging(portal, page);
        const item = items(page).first();
        await expect(item, `${imaging.label} dans l'historique`).toBeVisible({ timeout: 15000 });
        const body = item.locator('.imaging-item-body');
        if (!(await body.isVisible().catch(() => false))) await item.locator('.imaging-item-header').click();
        await expect(body).toBeVisible();
        return body.locator(imaging.key === 'echographie' ? 'app-echographie-simple-item' : 'app-imaging-item');
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

      test(`Créer un acte "${imaging.label}" avec un acte à facturer`, async ({ portal, page }) => {
        const imagerie = await openImaging(portal, page);
        await imagerie.openNewActeModal();
        await imagerie.chooseType(imaging.kind);
        const root = page.locator(imaging.root).filter({ visible: true }).first();
        await expect(root).toBeVisible();
        const form = new ConsultationFormPage(page, root);
        if (imaging.first.length) await form.fill(imaging.first);
        const values = await form.fill([
          { name: 'caregiverId', kind: 'select' },
          { name: 'date', kind: 'date', value: isoDate(-2) },
          ...(imaging.withExamDate ? [{ name: 'dateExam', kind: 'date', value: isoDate(-1) } as FieldSpec] : []),
          { name: 'region', kind: 'select' },
          { name: 'billableActs', kind: 'multiselect', count: 1 },
        ]);
        act = (values.billableActs as string[])[0];
        expect(act, 'Acte à facturer choisi').toBeTruthy();
        await root.getByRole('button', { name: imaging.submit }).click();
        await confirm(page);
        await expect(items(page).first()).toBeVisible({ timeout: 20000 });
      });

      test("L'acte choisi est à facturer dans le module Facturation", async ({ portal, page }) => {
        const invoicePage = await openBilling(portal, page);
        await expect.poll(() => invoicePage.counters(), { message: 'Un acte à facturer' }).toEqual({ toBill: 1, inInvoice: 0 });
        expect(await invoicePage.showPendingAct(act), `"${act}" à facturer`).not.toBeNull();
      });

      test(`Facturer l'acte de l'acte "${imaging.label}"`, async ({ portal, page }) => {
        const invoicePage = await openBilling(portal, page);
        await invoicePage.setActAmount(act, 6000);
        await invoicePage.proceedToBilling();
        await invoicePage.generateInvoice();
        const invoices = await new BillingListPatientPage(page).invoicesOf(patient.identifier);
        expect(invoices.map(i => i.amount), 'Une facture patient de 6 000').toEqual([6000]);
        invoiceOrder = invoices[0].order;
      });

      test(`Modifier l'acte "${imaging.label}" : l'acte facturé est grisé`, async ({ portal, page }) => {
        const item = await openItem(portal, page);
        await new ConsultationFormPage(page, item).activate('date');
        await expect(item.locator('ng-select[formcontrolname="billableActs"] .ng-value').filter({ hasText: act }), `"${act}" facturé : non retirable`)
          .toHaveClass(/ng-value-disabled/);
      });

      test(`Supprimer l'acte "${imaging.label}" est bloqué tant que la facture existe`, async ({ portal, page }) => {
        const item = await openItem(portal, page);
        await item.getByRole('button', { name: /^\W*Supprimer$/ }).first().click();
        await confirm(page);
        await expect(page.getByText(BLOCKED).first(), 'Suppression refusée : une facture existe').toBeVisible({ timeout: 15000 });
        await openImaging(portal, page);
        await expect(items(page), `${imaging.label} toujours présent`).toHaveCount(1);
      });

      test(`Après suppression de la facture, l'acte "${imaging.label}" peut être supprimé`, async ({ portal, page }) => {
        await test.step(`Supprimer la facture ${invoiceOrder}`, async () => {
          await portal.enterModule('Facturation');
          await portal.openMenu('Factures patients', '**/billing/billings-patients');
          const list = new BillingListPatientPage(page);
          await list.invoicesOf(patient.identifier);
          await list.deleteInvoice(invoiceOrder);
        });
        await test.step(`Supprimer l'acte "${imaging.label}"`, async () => {
          const item = await openItem(portal, page);
          await item.getByRole('button', { name: /^\W*Supprimer$/ }).first().click();
          await confirm(page);
          await expect(items(page)).toHaveCount(0, { timeout: 20000 });
        });
        await test.step("Son acte n'est plus à facturer", async () => {
          const invoicePage = await openBilling(portal, page);
          await expect.poll(() => invoicePage.counters(), { message: 'Plus aucun acte à facturer' }).toEqual({ toBill: 0, inInvoice: 0 });
        });
      });
    });
  }

  test.describe("Bilan d'analyses", () => {
    // Le type du bilan présélectionne ses actes à facturer : un seul est facturé
    test.describe.configure({ mode: 'serial' });
    let patient: DossierPatient;
    let acts: string[] = [];
    let bilanOrder = '';
    let invoiceOrder = '';
    const bilanModal = (page: Page) => page.locator('#createBilanModal');

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(DOSSIER_SETUP_TIMEOUT);
      patient = await createDossierPatient(browser);
    });

    async function openBilans(portal: PortalPage, page: Page) {
      await portal.enterModule('Dossier médical');
      await openDossier(page, patient);
      const list = new HealthChecksListPage(page);
      await list.goToHealthChecksList();
      return list;
    }

    /** Ouvre le bilan du patient (page de détail). */
    async function openBilan(portal: PortalPage, page: Page) {
      const list = await openBilans(portal, page);
      await list.openBilanByOrderNumber(bilanOrder);
      await new HealthCheckDetailPage(page).expectDetailLoaded();
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

    test('Créer un bilan dont le type présélectionne des actes à facturer', async ({ portal, page }) => {
      const list = await openBilans(portal, page);
      const before = await list.getBilanOrderNumbers();
      await list.openNewBilanModal();
      const form = new ConsultationFormPage(page, bilanModal(page));
      await form.fill([{ name: 'caregiverId', kind: 'select' }]);
      const chosen = bilanModal(page).locator('ng-select[formcontrolname="billableActs"] .ng-value-label');
      await test.step('Choisir le premier type qui présélectionne des actes à facturer', async () => {
        for (let index = 0; index < 20 && acts.length === 0; index++) {
          await form.fill([{ name: 'type', kind: 'select', index }]);
          await page.waitForTimeout(1000);
          acts = (await chosen.allTextContents()).map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
        }
        expect(acts.length, 'Actes à facturer présélectionnés par le type').toBeGreaterThan(0);
      });
      // Diagnostic obligatoire depuis le 2026-11-18
      await form.fill([{ name: 'diagnostic', kind: 'textarea', value: 'Bilan facturé QA' }]);
      await list.saveBilan();
      await expect(async () => {
        bilanOrder = (await list.getBilanOrderNumbers()).find(o => o && !before.includes(o)) ?? '';
        expect(bilanOrder, 'Nouveau bilan dans la liste').toBeTruthy();
      }).toPass({ timeout: 30000 });
    });

    test('Les actes présélectionnés sont à facturer dans le module Facturation', async ({ portal, page }) => {
      const invoicePage = await openBilling(portal, page);
      await expect.poll(async () => (await invoicePage.counters()).toBill, { message: `${acts.length} acte(s) à facturer` }).toBe(acts.length);
      for (const act of acts) expect(await invoicePage.showPendingAct(act), `"${act}" à facturer`).not.toBeNull();
    });

    test("Facturer le premier acte du bilan", async ({ portal, page }) => {
      const invoicePage = await openBilling(portal, page);
      await invoicePage.setActAmount(acts[0], 2500);
      await invoicePage.proceedToBilling();
      await invoicePage.generateInvoice();
      const invoices = await new BillingListPatientPage(page).invoicesOf(patient.identifier);
      expect(invoices.map(i => i.amount), 'Une facture patient de 2 500').toEqual([2500]);
      invoiceOrder = invoices[0].order;
    });

    test("Modifier le résultat du bilan : l'acte facturé est grisé", async ({ portal, page }) => {
      await openBilan(portal, page);
      await page.getByRole('tab', { name: /Résultat/ }).or(page.locator('a.nav-link', { hasText: 'Résultat' })).first().click();
      const pane = page.locator('[id^="result-content-"]');
      await expect(pane).toBeVisible();
      const toggle = pane.locator('.btn-action-activate');
      await expect(async () => {
        if (!/Verrouiller/.test(await toggle.innerText())) await toggle.click();
        await expect(pane.locator('textarea[formcontrolname="diagnostic"]')).toBeEnabled({ timeout: 3000 });
      }).toPass({ timeout: 30000 });
      const chips = pane.locator('ng-select[formcontrolname="billableActs"] .ng-value');
      await expect(chips.filter({ hasText: acts[0] }), `"${acts[0]}" facturé : non retirable`).toHaveClass(/ng-value-disabled/);
      for (const act of acts.slice(1)) {
        await expect.soft(chips.filter({ hasText: act }), `"${act}" non facturé : retirable`).not.toHaveClass(/ng-value-disabled/);
      }
    });

    test('Supprimer le bilan est bloqué tant que la facture existe', async ({ portal, page }) => {
      await openBilan(portal, page);
      await page.locator('.btn-action-delete', { hasText: 'Supprimer cette prestation' }).click();
      await confirm(page);
      await expect(page.getByText(BLOCKED).first(), 'Suppression refusée : une facture existe').toBeVisible({ timeout: 15000 });
      const list = await openBilans(portal, page);
      expect(await list.getBilanOrderNumbers(), 'Bilan toujours présent').toContain(bilanOrder);
    });

    test('Après suppression de la facture, le bilan peut être supprimé', async ({ portal, page }) => {
      await test.step(`Supprimer la facture ${invoiceOrder}`, async () => {
        await portal.enterModule('Facturation');
        await portal.openMenu('Factures patients', '**/billing/billings-patients');
        const list = new BillingListPatientPage(page);
        await list.invoicesOf(patient.identifier);
        await list.deleteInvoice(invoiceOrder);
      });
      await test.step('Supprimer le bilan', async () => {
        await openBilan(portal, page);
        await page.locator('.btn-action-delete', { hasText: 'Supprimer cette prestation' }).click();
        await confirm(page);
        await expect(page.getByText('La suppression du bilan a réussi').first()).toBeVisible({ timeout: 15000 });
      });
      await test.step("Ses actes ne sont plus à facturer", async () => {
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
  /**
   * Non-régression (anomalie backend hi-medical-act-reactor, corrigée par c887687) : modifier un acte
   * médical ayant des actes à facturer exécutait « delete from billable_act where medical_act_id is
   * null and patient_id = ? ». Cela supprimait tous les actes du patient ajoutés depuis une facture
   * (« Ajouter des actes »), facturés compris : la facture gardait son montant mais perdait sa ligne.
   * Le code est commun à tous les actes médicaux : consultation standard et vaccination.
   * Correctif déployé en local seulement (21/11) : sur dev et test, l'anomalie est attendue.
   */
  const FIX_DEPLOYED = (process.env.TEST_ENV ?? '') === 'local';
  const ANOMALY = "Anomalie : modifier un acte médical supprime les actes du patient ajoutés depuis une facture (correctif c887687 non déployé)";
  for (const variant of ['Consultation standard', 'Vaccination'] as const) {
    test.describe(`Non-régression — modifier une ${variant.toLowerCase()} garde les actes ajoutés depuis une facture`, () => {
      test.describe.configure({ mode: 'serial' });
      const BILLED_FROM_INVOICE = ACTS.pharmacie;
      const PENDING_FROM_INVOICE = ACTS.visite;
      const PRICE = 4500;
      const CONSULTATION_TYPE = 'CONSULTATION ANESTHÉSIQUE';
      const EDITED_SUMMARY = `Synthèse modifiée QA ${Date.now()}`;
      const EDITED_COMMENT = `Commentaire modifié QA ${Date.now()}`;
      let patient: DossierPatient;
      let invoiceOrder = '';
      let detailBefore: { total: number; lines: { act: string; quantity: number; unit: number; amount: number }[] };
      let csvBefore: Record<string, string> = {};
      let kept = '';
      let removed = '';

      test.beforeAll(async ({ browser }) => {
        test.setTimeout(DOSSIER_SETUP_TIMEOUT);
        patient = await createDossierPatient(browser);
      });

      async function openBilling(portal: PortalPage, page: Page) {
        const invoicePage = new BillingInvoicePage(page);
        await portal.enterModule('Facturation');
        await page.waitForURL('**/billing/billings-create');
        await invoicePage.searchPatientByIdentifier(patient.identifier);
        await invoicePage.selectFirstSearchResult();
        return invoicePage;
      }

      async function openInvoices(portal: PortalPage, page: Page) {
        await portal.enterModule('Facturation');
        await portal.openMenu('Factures patients', '**/billing/billings-patients');
        const list = new BillingListPatientPage(page);
        const invoices = await list.invoicesOf(patient.identifier);
        return { list, invoices };
      }

      /** Détail réduit à ce qui doit rester identique (total et lignes d'actes). */
      async function readDetail(list: BillingListPatientPage) {
        const detail = await list.detailOf(invoiceOrder);
        return {
          total: detail.total,
          lines: detail.lines.map(l => ({ act: l.act.replace(/\s+/g, ' ').trim().toUpperCase(), quantity: l.quantity, unit: l.unit, amount: l.amount })),
        };
      }

      async function readCsvRow(list: BillingListPatientPage) {
        const row = (await list.exportCsvRows()).find(r => r.Numero_Facture === invoiceOrder);
        expect(row, `Facture ${invoiceOrder} dans l'export CSV`).toBeTruthy();
        return row!;
      }

      /** Ouvre l'acte médical du patient ; renvoie la zone qui porte ses actes à facturer. */
      async function openMedicalAct(portal: PortalPage, page: Page): Promise<Locator> {
        await portal.enterModule('Dossier médical');
        await openDossier(page, patient);
        if (variant === 'Consultation standard') {
          const consultationPage = new ConsultationPage(page);
          await consultationPage.goToConsultationTab();
          await consultationPage.expectConsultationsListLoaded();
          await consultationPage.filterByConsultationType(CONSULTATION_TYPE);
          await consultationPage.openFirstConsultation();
          await expect(consultationPage.reportInput).toBeVisible({ timeout: 15000 });
          return page.locator('body');
        }
        const vaccination = new VaccinationPage(page);
        await vaccination.gotoFromPatientDashboard();
        await vaccination.openFirstVaccination();
        return page.locator('app-vaccination-simple-item').filter({ visible: true }).first();
      }

      const chips = (zone: Locator) => zone.locator('ng-select[formcontrolname="billableActs"] .ng-value');
      const chipOf = (zone: Locator, act: string) => chips(zone).filter({ hasText: new RegExp(`^\\W*${act.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') });

      test(`Facturer un acte ajouté depuis la facture, puis en ajouter un second laissé à facturer`, async ({ portal, page }) => {
        await test.step(`« Ajouter des actes » : ${BILLED_FROM_INVOICE.act} au prix de ${PRICE}, facture émise`, async () => {
          const invoicePage = await openBilling(portal, page);
          await expect.poll(() => invoicePage.counters(), { message: 'Patient neuf : rien à facturer' }).toEqual({ toBill: 0, inInvoice: 0 });
          await invoicePage.addAct(BILLED_FROM_INVOICE);
          await invoicePage.setActAmount(BILLED_FROM_INVOICE.act, PRICE);
          await invoicePage.proceedToBilling();
          await invoicePage.generateInvoice();
        });
        await test.step('Facture relevée : numéro, total, détail et export', async () => {
          const { list, invoices } = await openInvoices(portal, page);
          expect(invoices.map(i => i.amount), `Une facture patient de ${PRICE}`).toEqual([PRICE]);
          invoiceOrder = invoices[0].order;
          detailBefore = await readDetail(list);
          expect(detailBefore.total, 'Total de la facture').toBe(PRICE);
          expect(detailBefore.lines, "Une ligne d'acte").toHaveLength(1);
          expect(detailBefore.lines[0].act, "L'acte ajouté depuis la facture").toContain(BILLED_FROM_INVOICE.act.toUpperCase());
          csvBefore = await readCsvRow(list);
          test.info().annotations.push({ type: 'Facture', description: `${invoiceOrder} : ${BILLED_FROM_INVOICE.act} ${PRICE}` });
        });
        await test.step(`« Ajouter des actes » : ${PENDING_FROM_INVOICE.act}, laissé à facturer`, async () => {
          const invoicePage = await openBilling(portal, page);
          await invoicePage.addAct(PENDING_FROM_INVOICE);
          await page.reload();
          await invoicePage.searchPatientByIdentifier(patient.identifier);
          await invoicePage.selectFirstSearchResult();
          expect(await invoicePage.showPendingAct(PENDING_FROM_INVOICE.act, true), `"${PENDING_FROM_INVOICE.act}" à facturer, même après rechargement`).not.toBeNull();
          await expect.poll(async () => (await invoicePage.counters()).toBill, { message: 'Un seul acte à facturer' }).toBe(1);
        });
      });

      test(`Créer une ${variant.toLowerCase()} avec deux actes à facturer`, async ({ portal, page }) => {
        await portal.enterModule('Dossier médical');
        await openDossier(page, patient);
        let acts: string[] = [];
        if (variant === 'Consultation standard') {
          const consultationPage = new ConsultationPage(page);
          await consultationPage.goToConsultationTab();
          await consultationPage.expectConsultationsListLoaded();
          const data = ConsultationStandardDataGenerator.generate();
          await consultationPage.openNewConsultationModal();
          await consultationPage.fillConsultationBasics(data);
          await consultationPage.createConsultation();
          acts = await consultationPage.availableActs(2);
          expect(acts, `Deux actes à facturer proposés par ${tenant.name}`).toHaveLength(2);
          data.acts = acts;
          await consultationPage.fillMedicalConsultationForm(data);
          await consultationPage.saveConsultation();
        } else {
          const vaccination = new VaccinationPage(page);
          await vaccination.gotoFromPatientDashboard();
          await vaccination.openNewVaccinationModal();
          const values = await new ConsultationFormPage(page, vaccination.modal).fill([
            { name: 'type', kind: 'select' },
            { name: 'caregiverId', kind: 'select' },
            { name: 'dose', kind: 'select' },
            { name: 'date', kind: 'date', value: isoDate(-1) },
            { name: 'billableActs', kind: 'multiselect', count: 2 },
          ]);
          acts = values.billableActs as string[];
          expect(acts, `Deux actes à facturer proposés par ${tenant.name}`).toHaveLength(2);
          await vaccination.validerButton.click();
          await expect(vaccination.modal).toBeHidden({ timeout: 20000 });
          await expect(vaccination.firstVaccinationHeader).toBeVisible();
        }
        [kept, removed] = acts;
        for (const act of acts) expect([BILLED_FROM_INVOICE.act, PENDING_FROM_INVOICE.act].map(a => a.toUpperCase()), `"${act}" distinct des actes ajoutés depuis la facture`).not.toContain(act.toUpperCase());
        test.info().annotations.push({ type: 'Actes à facturer', description: `gardé : ${kept} ; retiré : ${removed}` });
        const invoicePage = await openBilling(portal, page);
        await expect.poll(async () => (await invoicePage.counters()).toBill, { message: '3 actes à facturer (2 de l\'acte médical, 1 ajouté depuis la facture)' }).toBe(3);
      });

      test(`Modifier la ${variant.toLowerCase()} : retirer un acte à facturer et changer un champ`, async ({ portal, page }) => {
        const zone = await openMedicalAct(portal, page);
        if (variant === 'Consultation standard') {
          const consultationPage = new ConsultationPage(page);
          await consultationPage.activateForm();
          await chipOf(zone, removed).locator('.ng-value-icon').click();
          await consultationPage.summaryInput.fill(EDITED_SUMMARY);
          await expect(chips(zone), 'Un seul acte à facturer restant').toHaveCount(1);
          await consultationPage.updateConsultation();
        } else {
          await zone.getByRole('button', { name: /Modifier la vaccination/ }).click();
          await chipOf(zone, removed).locator('.ng-value-icon').click();
          await zone.locator('textarea[formcontrolname="commentary"]').fill(EDITED_COMMENT);
          await expect(chips(zone), 'Un seul acte à facturer restant').toHaveCount(1);
          await zone.getByRole('button', { name: /^\W*Enregistrer$/ }).click();
          const confirm = page.getByRole('button', { name: /^\W*Confirmer$/ }).last();
          await expect(confirm).toBeVisible({ timeout: 10000 });
          await confirm.click();
          await expect(page.getByText('Vaccination mise à jour avec succès').first()).toBeVisible({ timeout: 15000 });
        }
        await test.step('Rouvrir : champ modifié et acte retiré conservés', async () => {
          await page.reload();
          const again = await openMedicalAct(portal, page);
          if (variant === 'Consultation standard') await expect(new ConsultationPage(page).summaryInput, 'Synthèse modifiée').toHaveValue(EDITED_SUMMARY);
          else await expect(again.locator('textarea[formcontrolname="commentary"]'), 'Commentaire modifié').toHaveValue(EDITED_COMMENT);
          await expect(chipOf(again, kept), `"${kept}" gardé`).toHaveCount(1);
          await expect(chipOf(again, removed), `"${removed}" retiré`).toHaveCount(0);
        });
      });

      test('La facture garde son acte ajouté depuis la facture : détail, total et export inchangés ; l\'acte laissé à facturer est toujours là', async ({ portal, page }) => {
        test.fail(!FIX_DEPLOYED, ANOMALY);
        await test.step(`Facture ${invoiceOrder} : détail et total identiques`, async () => {
          const { list, invoices } = await openInvoices(portal, page);
          expect(invoices.find(i => i.order === invoiceOrder)?.amount, 'Montant dans la liste').toBe(PRICE);
          expect(await readDetail(list), 'Détail identique (total et lignes)').toEqual(detailBefore);
          await test.step('Export CSV identique', async () => {
            expect(await readCsvRow(list), 'Ligne de la facture dans l\'export').toEqual(csvBefore);
          });
        });
        await test.step(`"${PENDING_FROM_INVOICE.act}" (ajouté depuis la facture) toujours à facturer`, async () => {
          const invoicePage = await openBilling(portal, page);
          expect(await invoicePage.showPendingAct(PENDING_FROM_INVOICE.act, true), `"${PENDING_FROM_INVOICE.act}" à facturer`).not.toBeNull();
        });
        await test.step("Base : la ligne facturée de l'acte ajouté depuis la facture existe toujours", async () => {
          const rows = await billableActRows(patient.identifier);
          if (rows) expect(rows.filter(r => r.medical_act_id == null && !!r.invoice_id), 'Ligne billable_act facturée sans acte médical').toHaveLength(1);
        });
      });

      test(`Actes à facturer : l'acte retiré de la ${variant.toLowerCase()} n'y est plus, l'acte gardé y est toujours`, async ({ portal, page }) => {
        const invoicePage = await openBilling(portal, page);
        expect(await invoicePage.showPendingAct(kept, true), `"${kept}" toujours à facturer`).not.toBeNull();
        expect(await invoicePage.showPendingAct(removed, true), `"${removed}" retiré : plus à facturer`).toBeNull();
        await expect.poll(async () => (await invoicePage.counters()).toBill, { message: `2 actes à facturer (${kept}, ${PENDING_FROM_INVOICE.act})` }).toBe(2);
      });
    });
  }
  /**
   * Actes à facturer décochés à la modification d'un acte médical (correction backend
   * hi-medicalact du 21/11, déployée en local seulement) :
   *  - modification sans toucher aux actes : ils ne changent pas ;
   *  - un acte décoché disparaît seul des actes à facturer ;
   *  - tout décocher (liste vide) retire les actes non facturés (avant la correction, une liste
   *    vide était ignorée pour les consultations et les bilans : les actes restaient à facturer) ;
   *  - un acte facturé reste rattaché (grisé) et sa facture est inchangée.
   * Chaque étape est vérifiée dans le formulaire rouvert, dans les actes à facturer du patient et
   * en base (lignes billable_act : ni orphelin, ni doublon).
   * La modification d'une analyse (update-analyse) n'est pas testée : l'écran n'a pas de bouton
   * pour l'ouvrir (seule la suppression est proposée dans le bulletin d'analyses).
   */
  type UncheckKind = {
    label: string;
    /** Nombre d'actes choisis à la création (3 : cas « un décoché » et « facturé » en plus). */
    acts: 2 | 3;
    /** Liste vide ignorée avant la correction : test « tout décocher » en anomalie hors local. */
    emptyIgnoredBefore: boolean;
    create(page: Page, count: number): Promise<string[]>;
    /** Rouvre l'acte médical (dashboard du patient ouvert) ; renvoie la zone de son formulaire. */
    open(page: Page): Promise<Locator>;
    /** Passe le formulaire en modification. */
    activate(page: Page, zone: Locator): Promise<void>;
    /** Champ modifié (hors actes) et sa valeur, pour le contrôle à la réouverture. */
    field(step: number): FieldSpec;
    /** Champ sans formcontrolname (synthèse de la consultation standard) : saisi et relu par ce locator. */
    fieldLocator?(page: Page, zone: Locator): Locator;
    save(page: Page, zone: Locator): Promise<void>;
  };

  const confirmIn = async (page: Page, what: string) => {
    const button = page.getByRole('button', { name: /^\W*Confirmer$/ }).last();
    await expect(button).toBeVisible({ timeout: 10000 });
    await confirmSave(page, button, what);
  };

  const consultationKind = (def: { label: string; specialty: string; type: string; filter: string; createRoot: string; editRoot: string; probe: string; fields: (v: 1 | 2) => FieldSpec[] }): UncheckKind => ({
    label: def.label, acts: 3, emptyIgnoredBefore: true,
    async create(page, count) {
      const consultationPage = new ConsultationPage(page);
      await consultationPage.goToConsultationTab();
      await consultationPage.expectConsultationsListLoaded();
      await consultationPage.openNewConsultationModal();
      await consultationPage.fillConsultationBasics({ specialty: def.specialty, consultationType: def.type });
      await consultationPage.createConsultation();
      const root = page.locator(def.createRoot).filter({ visible: true }).first();
      await expect(root).toBeVisible({ timeout: 15000 });
      const form = new ConsultationFormPage(page, root);
      await form.fill(def.fields(1).filter(f => f.name !== 'billableActs'));
      // La structure peut proposer moins d'actes que demandé pour ce type (2 en pédiatrie et en
      // prénatal sur nest) : on en prend autant que possible, 2 au moins (le scénario tient avec 2)
      const offered = await test.step('Actes à facturer proposés', async () => {
        const select = root.locator('ng-select[formcontrolname="billableActs"]').first();
        await select.locator('.ng-select-container').click();
        const options = page.locator('.ng-dropdown-panel .ng-option:not(.ng-option-disabled)');
        await options.first().waitFor({ state: 'visible', timeout: 10000 });
        const n = await options.count();
        await select.locator('.ng-arrow-wrapper').click();
        await page.locator('.ng-dropdown-panel').first().waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
        return n;
      });
      expect(offered, `Au moins 2 actes à facturer proposés pour "${def.label}"`).toBeGreaterThanOrEqual(2);
      const acts = (await form.fill([{ name: 'billableActs', kind: 'multiselect', count: Math.min(count, offered) }])).billableActs as string[];
      await form.saveNew();
      return acts;
    },
    async open(page) {
      const consultationPage = new ConsultationPage(page);
      await consultationPage.goToConsultationTab();
      await consultationPage.expectConsultationsListLoaded();
      await consultationPage.filterByConsultationType(def.filter);
      await consultationPage.openFirstConsultation();
      const root = page.locator(def.editRoot).filter({ visible: true }).first();
      await expect(root).toBeVisible({ timeout: 15000 });
      return root;
    },
    activate: (page, zone) => new ConsultationFormPage(page, zone).activate(def.probe),
    field: step => {
      const spec = def.fields(2).find(f => f.name === def.probe)!;
      return 'value' in spec && typeof spec.value === 'string' ? { ...spec, value: `${spec.value} (modif ${step})` } as FieldSpec : spec;
    },
    save: (page, zone) => new ConsultationFormPage(page, zone).saveUpdate(),
  });

  const STANDARD_TYPE = 'CONSULTATION ANESTHÉSIQUE';
  const UNCHECK_KINDS: UncheckKind[] = [
    {
      label: 'Consultation standard', acts: 3, emptyIgnoredBefore: true,
      async create(page, count) {
        const consultationPage = new ConsultationPage(page);
        await consultationPage.goToConsultationTab();
        await consultationPage.expectConsultationsListLoaded();
        const data = ConsultationStandardDataGenerator.generate();
        await consultationPage.openNewConsultationModal();
        await consultationPage.fillConsultationBasics(data);
        await consultationPage.createConsultation();
        const acts = await consultationPage.availableActs(count);
        expect(acts, `${count} actes à facturer proposés par ${tenant.name}`).toHaveLength(count);
        data.acts = acts;
        await consultationPage.fillMedicalConsultationForm(data);
        await consultationPage.saveConsultation();
        return acts;
      },
      async open(page) {
        const consultationPage = new ConsultationPage(page);
        await consultationPage.goToConsultationTab();
        await consultationPage.expectConsultationsListLoaded();
        await consultationPage.filterByConsultationType(STANDARD_TYPE);
        await consultationPage.openFirstConsultation();
        await expect(consultationPage.reportInput).toBeVisible({ timeout: 15000 });
        return page.locator('body');
      },
      activate: page => new ConsultationPage(page).activateForm(),
      field: step => ({ name: 'summary', kind: 'textarea', value: `Synthèse modifiée QA (modif ${step})` }),
      fieldLocator: page => new ConsultationPage(page).summaryInput,
      save: page => new ConsultationPage(page).updateConsultation(),
    },
    consultationKind({ label: 'Consultation pédiatrique', specialty: 'pédiatrie', type: 'CONSULTATION pédiatrique', filter: 'CONSULTATION PÉDIATRIQUE', createRoot: 'app-consultation-pediatric', editRoot: 'app-consultation-pediatric-edit', probe: 'report', fields: pediatricFields }),
    consultationKind({ label: 'Consultation prénatale', specialty: 'gynécologie-obstétrique', type: 'CONSULTATION prénatale', filter: 'CONSULTATION PRÉNATALE', createRoot: 'app-consultation-prenatal', editRoot: 'app-consultation-prenatal-edit', probe: 'appearance', fields: prenatalFields }),
    consultationKind({ label: 'Consultation de planification familiale', specialty: 'gynécologie-obstétrique', type: 'CONSULTATION planification familiale', filter: 'CONSULTATION PLANIFICATION', createRoot: 'app-consultation-planification-familiale', editRoot: 'app-consultation-planification-familiale-edit', probe: 'observations', fields: planificationFields }),
    consultationKind({ label: 'Consultation dentaire', specialty: 'dentiste', type: 'CONSULTATION dentaire', filter: 'CONSULTATION DENTAIRE', createRoot: 'app-consultation-tooth', editRoot: 'app-consultation-tooth-edit', probe: 'conclusion', fields: dentalFields }),
    {
      label: "Bilan d'analyses", acts: 2, emptyIgnoredBefore: true,
      async create(page, count) {
        const list = new HealthChecksListPage(page);
        await list.goToHealthChecksList();
        const before = await list.getBilanOrderNumbers();
        await list.openNewBilanModal();
        const modal = page.locator('#createBilanModal');
        const form = new ConsultationFormPage(page, modal);
        await form.fill([{ name: 'caregiverId', kind: 'select' }, { name: 'type', kind: 'select' }]);
        await page.waitForTimeout(1000);
        const chosen = modal.locator('ng-select[formcontrolname="billableActs"] .ng-value-label');
        const preselected = (await chosen.allTextContents()).map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
        if (preselected.length < count) await form.fill([{ name: 'billableActs', kind: 'multiselect', count: count - preselected.length }]);
        // Au-delà de `count` (type qui en présélectionne plus), les actes en trop sont retirés
        while (await chosen.count() > count) await modal.locator('ng-select[formcontrolname="billableActs"] .ng-value .ng-value-icon').last().click();
        const acts = (await chosen.allTextContents()).map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
        expect(acts, `${count} actes à facturer`).toHaveLength(count);
        await form.fill([{ name: 'diagnostic', kind: 'textarea', value: 'Bilan actes décochés QA' }]);
        await list.saveBilan();
        await expect(async () => {
          expect((await list.getBilanOrderNumbers()).find(o => o && !before.includes(o)), 'Nouveau bilan dans la liste').toBeTruthy();
        }).toPass({ timeout: 30000 });
        return acts;
      },
      async open(page) {
        const list = new HealthChecksListPage(page);
        await list.goToHealthChecksList();
        const [order] = await list.getBilanOrderNumbers();
        await list.openBilanByOrderNumber(order);
        await new HealthCheckDetailPage(page).expectDetailLoaded();
        await page.getByRole('tab', { name: /Résultat/ }).or(page.locator('a.nav-link', { hasText: 'Résultat' })).first().click();
        const pane = page.locator('[id^="result-content-"]');
        await expect(pane).toBeVisible();
        return pane;
      },
      async activate(page, pane) {
        const toggle = pane.locator('.btn-action-activate');
        const probe = pane.locator('textarea[formcontrolname="diagnostic"]');
        await expect(async () => {
          if (!/Verrouiller/.test(await toggle.innerText())) await toggle.click();
          else if (!(await probe.isEnabled())) { await toggle.click(); await toggle.click(); }
          await expect(probe).toBeEnabled({ timeout: 3000 });
          await page.waitForTimeout(1000);
          await expect(probe).toBeEnabled({ timeout: 500 });
        }).toPass({ timeout: 30000 });
      },
      field: step => ({ name: 'diagnostic', kind: 'textarea', value: `Diagnostic modifié QA (modif ${step})` }),
      async save(page, pane) {
        await pane.locator('button.btn-submit').click();
        await confirmIn(page, 'Résultat du bilan');
        await expect(page.getByText(/enregistrement de ce\(s\) résultat\(s\) a réussi/).first()).toBeVisible({ timeout: 20000 });
      },
    },
    ...([
      { label: 'Échographie', kind: 'ECHOGRAPHIE' as const, key: 'echographie', root: 'app-echographie-simple-static', item: 'app-echographie-simple-item', submit: /Enregistrer l'échographie/, first: [{ name: 'type', kind: 'select', option: 'Standard' }] as FieldSpec[], withExamDate: false },
      { label: 'Scanner', kind: 'SCANNER' as const, key: 'scanner', root: 'app-scanner-static', item: 'app-imaging-item', submit: /Enregistrer le scanner/, first: [] as FieldSpec[], withExamDate: true },
    ].map((imaging): UncheckKind => ({
      label: imaging.label, acts: 2, emptyIgnoredBefore: false,
      async create(page, count) {
        const imagerie = new ImagerieDashboardPage(page);
        await imagerie.gotoFromPatientDashboard();
        await imagerie.openNewActeModal();
        await imagerie.chooseType(imaging.kind);
        const root = page.locator(imaging.root).filter({ visible: true }).first();
        await expect(root).toBeVisible();
        const form = new ConsultationFormPage(page, root);
        if (imaging.first.length) await form.fill(imaging.first);
        const values = await form.fill([
          { name: 'caregiverId', kind: 'select' },
          { name: 'date', kind: 'date', value: isoDate(-2) },
          ...(imaging.withExamDate ? [{ name: 'dateExam', kind: 'date', value: isoDate(-1) } as FieldSpec] : []),
          { name: 'region', kind: 'select' },
          { name: 'billableActs', kind: 'multiselect', count },
        ]);
        await root.getByRole('button', { name: imaging.submit }).click();
        await confirmIn(page, imaging.label);
        await expect(page.locator(`.imaging-item.imaging-item--${imaging.key}`).first()).toBeVisible({ timeout: 20000 });
        return values.billableActs as string[];
      },
      async open(page) {
        await new ImagerieDashboardPage(page).gotoFromPatientDashboard();
        const item = page.locator(`.imaging-item.imaging-item--${imaging.key}`).first();
        await expect(item).toBeVisible({ timeout: 15000 });
        const body = item.locator('.imaging-item-body');
        if (!(await body.isVisible().catch(() => false))) await item.locator('.imaging-item-header').click();
        await expect(body).toBeVisible();
        return body.locator(imaging.item);
      },
      activate: (page, zone) => new ConsultationFormPage(page, zone).activate('date'),
      field: step => ({ name: 'date', kind: 'date', value: isoDate(-2 - step) }),
      async save(page, zone) {
        await zone.locator('button.btn-success').last().click();
        await confirmIn(page, imaging.label);
      },
    }))),
    {
      label: 'Vaccination', acts: 2, emptyIgnoredBefore: false,
      async create(page, count) {
        const vaccination = new VaccinationPage(page);
        await vaccination.gotoFromPatientDashboard();
        await vaccination.openNewVaccinationModal();
        const values = await new ConsultationFormPage(page, vaccination.modal).fill([
          { name: 'type', kind: 'select' },
          { name: 'caregiverId', kind: 'select' },
          { name: 'dose', kind: 'select' },
          { name: 'date', kind: 'date', value: isoDate(-1) },
          { name: 'billableActs', kind: 'multiselect', count },
        ]);
        await vaccination.validerButton.click();
        await expect(vaccination.modal).toBeHidden({ timeout: 20000 });
        await expect(vaccination.firstVaccinationHeader).toBeVisible();
        return values.billableActs as string[];
      },
      async open(page) {
        const vaccination = new VaccinationPage(page);
        await vaccination.gotoFromPatientDashboard();
        await vaccination.openFirstVaccination();
        return page.locator('app-vaccination-simple-item').filter({ visible: true }).first();
      },
      activate: async (_page, zone) => { await zone.getByRole('button', { name: /Modifier la vaccination/ }).click(); },
      field: step => ({ name: 'commentary', kind: 'textarea', value: `Commentaire modifié QA (modif ${step})` }),
      async save(page, zone) {
        await zone.getByRole('button', { name: /^\W*Enregistrer$/ }).click();
        await confirmIn(page, 'Vaccination');
        await expect(page.getByText('Vaccination mise à jour avec succès').first()).toBeVisible({ timeout: 15000 });
      },
    },
  ];

  for (const kind of UNCHECK_KINDS) {
    test.describe(`${kind.label} — actes à facturer décochés à la modification`, () => {
      test.describe.configure({ mode: 'serial' });
      let patient: DossierPatient;
      let acts: string[] = [];
      /** Actes attendus sur l'acte médical rouvert, et parmi eux le facturé (grisé). */
      let attached: string[] = [];
      let billed = '';
      let invoiceOrder = '';
      let detailBefore: unknown;
      let step = 0;

      test.beforeAll(async ({ browser }) => {
        test.setTimeout(DOSSIER_SETUP_TIMEOUT);
        patient = await createDossierPatient(browser);
      });

      async function openDossierOf(portal: PortalPage, page: Page) {
        await portal.enterModule('Dossier médical');
        await openDossier(page, patient);
      }

      async function openBilling(portal: PortalPage, page: Page) {
        const invoicePage = new BillingInvoicePage(page);
        await portal.enterModule('Facturation');
        await page.waitForURL('**/billing/billings-create');
        await invoicePage.searchPatientByIdentifier(patient.identifier);
        await invoicePage.selectFirstSearchResult();
        return invoicePage;
      }

      async function openInvoices(portal: PortalPage, page: Page) {
        await portal.enterModule('Facturation');
        await portal.openMenu('Factures patients', '**/billing/billings-patients');
        const list = new BillingListPatientPage(page);
        return { list, invoices: await list.invoicesOf(patient.identifier) };
      }

      const chips = (zone: Locator) => zone.locator('ng-select[formcontrolname="billableActs"] .ng-value');
      const chipOf = (zone: Locator, act: string) => chips(zone).filter({ hasText: new RegExp(`^\\W*${act.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') });
      const chipNames = async (zone: Locator) =>
        (await chips(zone).locator('.ng-value-label').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim().toUpperCase()).filter(Boolean).sort();
      const upper = (list: string[]) => list.map(a => a.toUpperCase()).sort();

      /** Modifie l'acte médical : retire `remove` (« all » = tous les actes retirables), change un champ si demandé. */
      async function edit(portal: PortalPage, page: Page, remove: string[] | 'all', changeField: boolean) {
        await openDossierOf(portal, page);
        const zone = await kind.open(page);
        await kind.activate(page, zone);
        if (remove === 'all') {
          const removable = zone.locator('ng-select[formcontrolname="billableActs"] .ng-value:not(.ng-value-disabled)');
          while (await removable.count() > 0) await removable.first().locator('.ng-value-icon').click();
        } else {
          for (const act of remove) await chipOf(zone, act).locator('.ng-value-icon').click();
        }
        if (billed) await expect(chipOf(zone, billed), `"${billed}" facturé : toujours là, non retirable`).toHaveClass(/ng-value-disabled/);
        await expect.poll(() => chipNames(zone), { message: 'Actes restants dans le formulaire' }).toEqual(upper(attached));
        let filled: FieldSpec | undefined;
        if (changeField) {
          filled = kind.field(++step);
          if (kind.fieldLocator && 'value' in filled) await kind.fieldLocator(page, zone).fill(filled.value as string);
          else await new ConsultationFormPage(page, zone).fill([filled]);
        }
        await kind.save(page, zone);
        await test.step('Rouvrir après rechargement : actes et champ modifié conservés', async () => {
          await page.reload();
          await openDossierOf(portal, page);
          const again = await kind.open(page);
          await expect.poll(() => chipNames(again), { message: 'Actes à facturer de l\'acte médical rouvert', timeout: 20000 }).toEqual(upper(attached));
          if (filled && 'value' in filled) {
            if (kind.fieldLocator) await expect(kind.fieldLocator(page, again), `Champ "${filled.name}" modifié`).toHaveValue(filled.value as string);
            else await new ConsultationFormPage(page, again).expectValues([filled], { [filled.name]: filled.value as string });
          }
        });
      }

      /** Actes à facturer du patient : exactement ceux attendus (non facturés), en panier et en base. */
      async function expectPending(portal: PortalPage, page: Page) {
        const pending = attached.filter(a => a !== billed);
        const invoicePage = await openBilling(portal, page);
        await expect.poll(async () => (await invoicePage.counters()).toBill, { message: `Actes à facturer : ${pending.join(', ') || 'aucun'}` }).toBe(pending.length);
        for (const act of pending) expect(await invoicePage.showPendingAct(act, true), `"${act}" à facturer`).not.toBeNull();
        for (const act of acts.filter(a => !pending.includes(a))) expect(await invoicePage.showPendingAct(act, true), `"${act}" plus à facturer`).toBeNull();
        await expectBillableActsInDb(patient.identifier, { pending: pending.length, billed: billed ? 1 : 0 });
      }

      test(kind.acts === 3 ? "Créer : 3 actes à facturer (2 si la structure n'en propose que 2)" : 'Créer : 2 actes à facturer', async ({ portal, page }) => {
        await openDossierOf(portal, page);
        acts = await kind.create(page, kind.acts);
        expect(acts.length, 'Au moins 2 actes choisis').toBeGreaterThanOrEqual(2);
        expect(new Set(upper(acts)).size, `${acts.length} actes distincts choisis`).toBe(acts.length);
        attached = [...acts];
        test.info().annotations.push({ type: 'Actes à facturer', description: acts.join(' ; ') });
        await expectPending(portal, page);
      });

      test('Modifier un champ sans toucher aux actes : les actes ne changent pas', async ({ portal, page }) => {
        await edit(portal, page, [], true);
        await expectPending(portal, page);
      });

      if (kind.acts === 3) {
        test("Décocher un seul acte : lui seul n'est plus à facturer", async ({ portal, page }) => {
          const removed = attached[attached.length - 1];
          attached = attached.slice(0, -1);
          await edit(portal, page, [removed], false);
          await expectPending(portal, page);
        });

        test('Facturer un acte puis tout décocher : le facturé reste (facture inchangée), les autres ne sont plus à facturer', async ({ portal, page }) => {
          await test.step(`Facturer "${attached[0]}"`, async () => {
            const invoicePage = await openBilling(portal, page);
            await invoicePage.setActAmount(attached[0], 3500);
            await invoicePage.proceedToBilling();
            await invoicePage.generateInvoice();
            billed = attached[0];
            const { list, invoices } = await openInvoices(portal, page);
            expect(invoices.map(i => i.amount), 'Une facture de 3 500').toEqual([3500]);
            invoiceOrder = invoices[0].order;
            detailBefore = await list.detailOf(invoiceOrder).then(d => ({ total: d.total, lines: d.lines }));
          });
          attached = [billed];
          await edit(portal, page, 'all', true);
          await expectPending(portal, page);
          await test.step(`Facture ${invoiceOrder} inchangée`, async () => {
            const { list, invoices } = await openInvoices(portal, page);
            expect(invoices.find(i => i.order === invoiceOrder)?.amount, 'Montant').toBe(3500);
            expect(await list.detailOf(invoiceOrder).then(d => ({ total: d.total, lines: d.lines })), 'Détail identique').toEqual(detailBefore);
          });
        });

        test("Supprimer la facture : l'acte redevient à facturer", async ({ portal, page }) => {
          const { list } = await openInvoices(portal, page);
          await list.deleteInvoice(invoiceOrder);
          billed = '';
          await expectPending(portal, page);
        });
      }

      test("Tout décocher : plus aucun acte à facturer, aucun acte sur l'acte médical rouvert", async ({ portal, page }) => {
        test.fail(kind.emptyIgnoredBefore && !FIX_DEPLOYED, "Anomalie : une liste d'actes à facturer vide est ignorée à la modification (actes décochés toujours à facturer)");
        attached = [];
        await edit(portal, page, 'all', true);
        await expectPending(portal, page);
      });

      // Une consultation sans acte à facturer perdait ses modifications (transaction effacée par le
      // traitement des ordonnances avant écriture ; corrigé avec la même livraison backend)
      test("Sans aucun acte à facturer, modifier un champ : modification enregistrée", async ({ portal, page }) => {
        test.fail(kind.label.startsWith('Consultation') && !FIX_DEPLOYED, "Anomalie : la modification d'une consultation sans acte à facturer n'est pas enregistrée");
        await edit(portal, page, [], true);
        await expectPending(portal, page);
      });
    });
  }
});
