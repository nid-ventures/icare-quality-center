import { test, expect } from '../../fixtures/structure.fixture';
import { type Page } from '@playwright/test';
import { MedicalActsReportingPage, BillableBillingReportingPage, type ReportingActRow } from '../../pages/structure/my-space/reporting.page';
import { type PortalPage } from '../../pages/structure/portal/portal.page';
import { PatientPage } from '../../pages/structure/patient/patient.page';
import { PatientCarePage } from '../../pages/structure/patient/patient-care.page';
import { BillingInvoicePage } from '../../pages/structure/billing/billing-invoice.page';
import { BillingListPatientPage, BillingListGarantPage } from '../../pages/structure/billing/billing-list.page';
import { createDossierPatient, DOSSIER_SETUP_TIMEOUT, type DossierPatient } from '../../fixtures/dossier-patient';
import { ACTS, INSURER } from '../../test-data/cover-scenarios';

// Le dashboard statistique historique (/my-space/dashboard) redirige désormais vers le portail
// des modules (cf. my-space.routes.ts) : il n'existe plus de fonctionnalité à tester.

test.describe('Module Reporting', () => {

  test.beforeEach(async ({ portal, page }) => {
    await portal.enterModule('Reporting');
    await page.waitForURL('**/my-space/reporting/prestations');
  });

  // ======================================================================
  // Prestations (Reporting médical)
  // ======================================================================
  test.describe('Prestations', () => {
    test("Parcourir les onglets du reporting médical", async ({ page }) => {
      await new MedicalActsReportingPage(page).expectLoaded();
      // Chaque onglet affiche son libellé suivi d'un compteur (ex: "Imagerie 6")
      const tabs: [string, RegExp, string][] = [
        ['Imagerie', /Imagerie \d+$/, "Filtres d'imagerie"],
        ['Bilans', /Bilans \d+$/, 'Filtres des bilans'],
        ['Vaccinations', /Vaccinations \d+$/, 'Filtres des vaccinations'],
        ['Consultations', /Consultations \d+$/, 'Filtres des consultations'],
      ];
      for (const [label, tab, filtersTitle] of tabs) {
        await test.step(`Onglet ${label}`, async () => {
          await page.getByRole('button', { name: tab }).click();
          await expect(page.getByRole('heading', { name: filtersTitle })).toBeVisible();
        });
      }
    });

    test('Valider puis lancer une recherche de consultations', async ({ page }) => {
      const reportingPage = new MedicalActsReportingPage(page);
      await reportingPage.expectLoaded();

      await test.step('Sans date de début : message de validation', async () => {
        await reportingPage.searchConsultations();
        await reportingPage.expectConsultationValidationMessage(/Veuillez saisir la date de début/);
      });

      await test.step('Avec dates mais sans type : message de validation', async () => {
        const today = new Date();
        const dateEnd = today.toISOString().slice(0, 10);
        const dateStart = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()).toISOString().slice(0, 10);
        await reportingPage.fillConsultationDateRange(dateStart, dateEnd);
        await reportingPage.searchConsultations();
        await reportingPage.expectConsultationValidationMessage(/Veuillez choisir un type/);
      });

      await test.step('Avec un type de consultation : résultat affiché', async () => {
        await reportingPage.selectFirstConsultationType();
        await reportingPage.searchConsultations();
        await reportingPage.expectConsultationValidationMessage(/consultation\(s\) trouvée\(s\)|Aucune consultation trouvée/);
      });

      await test.step('Réinitialiser les filtres', async () => {
        await reportingPage.resetConsultationFilters();
      });
    });

    test("Configurer la modale d'export sans télécharger", async ({ page }) => {
      const reportingPage = new MedicalActsReportingPage(page);
      await reportingPage.expectLoaded();

      await test.step('Valeurs par défaut : Consultations en Excel', async () => {
        await reportingPage.openExportModal();
        await reportingPage.expectExportSourceActive('Consultations');
        await reportingPage.expectExportFormatActive('Excel');
        await reportingPage.expectExportSummary(/Export\s*:\s*Consultations\s+en\s+Excel/);
      });

      await test.step('Source : Imagerie', async () => {
        await reportingPage.selectExportSource('Imagerie');
        await reportingPage.expectExportSourceActive('Imagerie');
        await reportingPage.expectExportSubCategorySelectVisible();
        await reportingPage.expectExportSummary(/Export\s*:\s*Imagerie/);
      });

      await test.step('Période : "Mois dernier"', async () => {
        const initialRange = await reportingPage.getExportDateRange();
        await reportingPage.selectExportPeriodPreset('Mois dernier');
        const updatedRange = await reportingPage.getExportDateRange();
        expect(updatedRange.start).not.toBe(initialRange.start);
        expect(new Date(updatedRange.start).getTime()).toBeLessThanOrEqual(new Date(updatedRange.end).getTime());
      });

      await test.step('Formats : CSV, DHIS2 (champs dédiés) puis Excel', async () => {
        await reportingPage.selectExportFormat('CSV');
        await reportingPage.expectExportFormatActive('CSV');
        await reportingPage.expectExportSummary(/en\s+CSV/);
        await reportingPage.selectExportFormat('DHIS2');
        await reportingPage.expectExportFormatActive('DHIS2');
        await reportingPage.expectDhis2FieldsVisible();
        await reportingPage.selectExportFormat('Excel');
        await reportingPage.expectExportFormatActive('Excel');
        await reportingPage.expectDhis2FieldsHidden();
      });

      await test.step('Fermer via "Annuler"', async () => {
        await reportingPage.closeExportModalViaAnnuler();
      });
    });
  });

  // ======================================================================
  // Liste des actes
  // ======================================================================
  test.describe('Liste des actes', () => {
    test('Rechercher dans la liste des actes', async ({ portal, page }) => {
      const actsPage = new BillableBillingReportingPage(page);

      await test.step('Ouvrir "Liste des actes" depuis le menu', async () => {
        await portal.openMenu('Liste des actes', '**/my-space/reporting/billable-billing');
        await actsPage.expectLoaded();
      });

      await test.step('Recherche sans filtre', async () => {
        await actsPage.search();
        await actsPage.expectResultsRendered();
      });

      await test.step('Identifiant patient inexistant : aucun résultat', async () => {
        await actsPage.fillPatientIdentifier('QA-TEST-INEXISTANT-999999');
        await actsPage.search();
        await actsPage.expectNoResults();
      });

      await test.step('Filtrer par statut "Facturé" puis "Non Facturé"', async () => {
        await actsPage.reset();
        for (const status of ['Facturé', 'Non Facturé'] as const) {
          await actsPage.selectStatus(status);
          await actsPage.search();
          await actsPage.expectResultsRendered();
        }
      });

      await test.step('Réinitialiser le formulaire', async () => {
        await actsPage.reset();
        await actsPage.expectLoaded();
      });
    });
  });

  // ======================================================================
  // Liste des actes : statuts et N° de factures d'un patient dédié
  // ======================================================================
  test.describe('Liste des actes : statut et factures de chaque acte', () => {
    // Patient pris en charge à 80 % ; deux actes à facturer, dont un seul est facturé.
    test.describe.configure({ mode: 'serial' });
    const BILLED = ACTS.cardio;
    const NOT_BILLED = ACTS.pharmacie;
    let patient: DossierPatient;
    let orders = { patient: '', garant: '' };

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(DOSSIER_SETUP_TIMEOUT);
      patient = await createDossierPatient(browser);
    });

    async function openActsList(portal: PortalPage, page: Page) {
      await portal.enterModule('Reporting');
      await portal.openMenu('Liste des actes', '**/my-space/reporting/billable-billing');
      const actsPage = new BillableBillingReportingPage(page);
      await actsPage.expectLoaded();
      return actsPage;
    }

    async function openBilling(portal: PortalPage, page: Page) {
      const invoicePage = new BillingInvoicePage(page);
      await portal.enterModule('Facturation');
      await page.waitForURL('**/billing/billings-create');
      await invoicePage.searchPatientByIdentifier(patient.identifier);
      await invoicePage.selectFirstSearchResult();
      return invoicePage;
    }

    const isBilled = (status: string) => /^\s*factur/i.test(status);
    const rowOf = (rows: ReportingActRow[], act: string) => rows.filter(r => r.act.toUpperCase().includes(act.toUpperCase()));

    test('Préparer : patient pris en charge à 80 % avec deux actes à facturer', async ({ portal, page }) => {
      await test.step('Prise en charge à 80 %', async () => {
        await portal.enterModule('Base patients');
        const patientPage = new PatientPage(page);
        await patientPage.searchByName(patient.firstName, patient.lastName);
        await patientPage.openPatient(patient.lastName);
        await page.waitForURL('**/patient/patient-info-administration/**');
        const carePage = new PatientCarePage(page);
        await carePage.goToCareTab();
        await carePage.addCover({ insurer: INSURER, rate: 80 });
      });
      await test.step(`Ajouter ${BILLED.act} et ${NOT_BILLED.act}`, async () => {
        const invoicePage = await openBilling(portal, page);
        await invoicePage.addAct(BILLED);
        await invoicePage.addAct(NOT_BILLED);
      });
    });

    test('Actes non facturés : statut "Non facturé", sans N° de facture, supprimables', async ({ portal, page }) => {
      const rows = await (await openActsList(portal, page)).searchActs({ patientIdentifier: patient.identifier });
      expect(rows.map(r => r.act), 'Les deux actes du patient').toHaveLength(2);
      for (const row of rows) {
        expect.soft(row.status, `${row.act} : non facturé`).toMatch(/non\s+factur/i);
        expect.soft(row.invoicePatient + row.invoiceGarant, `${row.act} : sans N° de facture`).toMatch(/^[\s-]*$/);
        expect.soft(row.deletable, `${row.act} : supprimable`).toBe(true);
        expect.soft(row.identifier, `${row.act} : identifiant du patient`).toBe(patient.identifier);
      }
    });

    test(`Facturer ${BILLED.act} : statut "Facturé" avec les N° de facture patient et garant`, async ({ portal, page }) => {
      await test.step('Facturer avec la prise en charge', async () => {
        const invoicePage = await openBilling(portal, page);
        await invoicePage.setActAmount(BILLED.act, 10000);
        await invoicePage.proceedToBilling();
        await invoicePage.chooseCover(INSURER);
        await invoicePage.generateInvoice();
        orders.patient = (await new BillingListPatientPage(page).invoicesOf(patient.identifier))[0].order;
        await portal.openMenu('Factures garants', '**/billing/billings-garants');
        orders.garant = (await new BillingListGarantPage(page).invoicesOf(patient.identifier))[0].order;
      });
      const rows = await (await openActsList(portal, page)).searchActs({ patientIdentifier: patient.identifier });
      const [billed] = rowOf(rows, BILLED.act);
      expect(billed, `${BILLED.act} listé`).toBeDefined();
      expect.soft(isBilled(billed.status), `${BILLED.act} : facturé (statut "${billed.status}")`).toBe(true);
      expect.soft(billed.invoicePatient, 'N° de facture patient').toBe(orders.patient);
      expect.soft(billed.invoiceGarant, 'N° de facture garant').toBe(orders.garant);
      expect.soft(billed.amount, 'Montant facturé').toBe(10000);
      expect.soft(billed.deletable, 'Acte facturé : suppression grisée').toBe(false);
      const [pending] = rowOf(rows, NOT_BILLED.act);
      expect.soft(pending.status, `${NOT_BILLED.act} : toujours non facturé`).toMatch(/non\s+factur/i);
    });

    test('Rechercher les actes par chaque critère', async ({ portal, page }) => {
      const actsPage = await openActsList(portal, page);
      const checks: [string, Parameters<BillableBillingReportingPage['searchActs']>[0], string[]][] = [
        ['N° de facture patient', { invoicePatientOrder: orders.patient }, [BILLED.act]],
        ['N° de facture garant', { invoiceGarantOrder: orders.garant }, [BILLED.act]],
        ['Statut "Facturé"', { patientIdentifier: patient.identifier, status: 'Facturé' }, [BILLED.act]],
        ['Statut "Non Facturé"', { patientIdentifier: patient.identifier, status: 'Non Facturé' }, [NOT_BILLED.act]],
      ];
      for (const [label, criteria, acts] of checks) {
        await test.step(label, async () => {
          const rows = await actsPage.searchActs(criteria);
          expect.soft(rows.map(r => acts.find(a => r.act.toUpperCase().includes(a.toUpperCase())) ?? r.act), label).toEqual(acts);
        });
      }
      for (const [label, criteria, value] of [
        ['Nom du patient', { patientFirstname: patient.firstName }, (r: ReportingActRow) => r.lastname],
        ['Prénom du patient', { patientLastname: patient.lastName }, (r: ReportingActRow) => r.firstname],
      ] as const) {
        await test.step(label, async () => {
          const rows = await actsPage.searchActs(criteria);
          const expected = Object.values(criteria)[0]!.toLowerCase();
          expect.soft(rows.length, `${label} : des résultats`).toBeGreaterThan(0);
          expect.soft(rows.every(r => value(r).toLowerCase().includes(expected)), `${label} : chaque ligne correspond`).toBe(true);
          expect.soft(rows.some(r => r.identifier === patient.identifier), `${label} : actes du patient retrouvés`).toBe(true);
        });
      }
    });

    test('Supprimer un acte non facturé', async ({ portal, page }) => {
      const actsPage = await openActsList(portal, page);
      const [pending] = rowOf(await actsPage.searchActs({ patientIdentifier: patient.identifier }), NOT_BILLED.act);
      await actsPage.deleteAct(pending.row);
      await expect(page.getByText(/suppression.*r[ée]ussi/i).first()).toBeVisible({ timeout: 15000 });
      const rows = await actsPage.searchActs({ patientIdentifier: patient.identifier });
      expect(rows.map(r => r.act.toUpperCase()), 'Seul l\'acte facturé reste').toEqual([expect.stringContaining(BILLED.act.toUpperCase())]);
      const invoicePage = await openBilling(portal, page);
      await expect.poll(() => invoicePage.counters(), { message: 'Plus aucun acte à facturer' }).toEqual({ toBill: 0, inInvoice: 0 });
    });

    test('Après suppression de la facture, l\'acte redevient "Non facturé" sans N° de facture', async ({ portal, page }) => {
      await test.step(`Supprimer la facture patient ${orders.patient}`, async () => {
        await portal.enterModule('Facturation');
        await portal.openMenu('Factures patients', '**/billing/billings-patients');
        const list = new BillingListPatientPage(page);
        await list.invoicesOf(patient.identifier);
        await list.deleteInvoice(orders.patient);
      });
      const [row] = rowOf(await (await openActsList(portal, page)).searchActs({ patientIdentifier: patient.identifier }), BILLED.act);
      expect.soft(row.status, 'Non facturé').toMatch(/non\s+factur/i);
      expect.soft(row.invoicePatient + row.invoiceGarant, 'Plus de N° de facture').toMatch(/^[\s-]*$/);
      expect.soft(row.deletable, 'De nouveau supprimable').toBe(true);
    });
  });
});
