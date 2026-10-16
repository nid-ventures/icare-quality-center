import { test, expect } from '../../fixtures/structure.fixture';
import { type Page } from '@playwright/test';
import { MedicalActsReportingPage, BillableBillingReportingPage, PrestationsReportingPage, type ReportingActRow, type PrestationsTab } from '../../pages/structure/my-space/reporting.page';
import { openDossier } from '../../fixtures/dossier-patient';
import { ConsultationPage } from '../../pages/structure/consultation/consultation.page';
import { ConsultationStandardDataGenerator } from '../../pages/structure/generator/consultation-standard-data-generator';
import { ConsultationFormPage } from '../../pages/structure/consultation/consultation-form.page';
import { VaccinationPage } from '../../pages/structure/vaccination/vaccination.page';
import { ImagerieDashboardPage } from '../../pages/structure/imagerie/imagerie-dashboard.page';
import { HealthChecksListPage } from '../../pages/structure/analyse/health-check.page';
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
  // Prestations : contrôles, actes du jour retrouvés par onglet, export réel
  // ======================================================================
  test.describe('Prestations : recherche par onglet et export', () => {
    // Un patient dédié reçoit aujourd'hui une consultation standard, une échographie, un bilan et une
    // vaccination. Les résultats du reporting n'affichent pas le patient (type, date, consultant) :
    // chaque onglet compte les prestations du jour pour le type de l'acte avant et après sa création.
    test.describe.configure({ mode: 'serial' });
    let patient: DossierPatient;
    // Recalculée avant chaque test : un run qui passe minuit daterait sinon les actes du lendemain
    let today = '';
    let todayFr = '';
    test.beforeEach(() => {
      today = new Date().toISOString().slice(0, 10);
      todayFr = today.split('-').reverse().join('/');
    });
    // Filtre "type" de chaque onglet ("Type d'acte" de l'imagerie exclu : il choisit échographie, scanner…)
    const TYPE = /Type (de consultation|de bilan|de vaccination|Échographie|Scanner|IRM|Radiographie)/i;
    const created: Partial<Record<PrestationsTab, { type: string; caregiver: string }>> = {};

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(DOSSIER_SETUP_TIMEOUT);
      patient = await createDossierPatient(browser);
    });

    /**
     * Libellé du type dans les formulaires de saisie : le reporting préfixe le domaine
     * ("Echographie standard", "Bilan …", "Vaccination …"), les formulaires non ("standard").
     */
    const formLabel = (type: string) => type.replace(/^\S+\s+/, '');

    /** Mots d'un nom, triés : l'ordre prénom / nom varie selon les écrans. */
    const words = (name: string) => name.toUpperCase().split(/\s+/).filter(Boolean).sort().join(' ');

    async function openReporting(portal: PortalPage, page: Page, tab: PrestationsTab) {
      await portal.enterModule('Reporting');
      await page.waitForURL('**/my-space/reporting/prestations');
      const reporting = new PrestationsReportingPage(page);
      await reporting.openTab(tab);
      return reporting;
    }

    /** Recherche des prestations du jour pour le type donné ; renvoie le nombre et les en-têtes. */
    async function searchToday(portal: PortalPage, page: Page, tab: PrestationsTab, type: string, consultant?: string) {
      const reporting = await openReporting(portal, page, tab);
      if (tab === 'Imagerie') await reporting.choose(/Type d'acte/, 'Échographie');
      await reporting.setDates(today, today);
      await reporting.choose(TYPE, type);
      if (consultant) await reporting.choose(/Consultant/, consultant);
      const message = await reporting.search();
      return { reporting, count: PrestationsReportingPage.countOf(message), message, headers: await reporting.headers() };
    }

    /** Type proposé par le reporting pour l'onglet (préférence par mot-clé, sinon le premier). */
    async function pickType(portal: PortalPage, page: Page, tab: PrestationsTab, keyword?: RegExp) {
      const reporting = await openReporting(portal, page, tab);
      if (tab === 'Imagerie') await reporting.choose(/Type d'acte/, 'Échographie');
      const options = await reporting.options(TYPE);
      expect(options.length, `Types proposés (${tab})`).toBeGreaterThan(0);
      return (keyword && options.find(o => keyword.test(o))) || options[0];
    }

    async function openPatientDossier(portal: PortalPage, page: Page) {
      await portal.enterModule('Dossier médical');
      await openDossier(page, patient);
    }

    const confirm = async (page: Page) => {
      const button = page.getByRole('button', { name: /^\W*Confirmer$/ }).last();
      await expect(button).toBeVisible({ timeout: 10000 });
      await button.click();
    };

    test('Contrôles de recherche dans chaque onglet : date de début, type, ordre des dates', async ({ portal, page }) => {
      for (const tab of ['Consultations', 'Imagerie', 'Bilans', 'Vaccinations'] as PrestationsTab[]) {
        await test.step(tab, async () => {
          const reporting = await openReporting(portal, page, tab);
          await reporting.reset();
          await reporting.setDates('', '');
          expect(await reporting.search(), 'Sans date de début').toMatch(/Veuillez saisir la date de début/);
          await reporting.setDates(today, today);
          await reporting.clear(TYPE);
          expect(await reporting.search(), 'Sans type').toMatch(/Veuillez choisir un type/);
          const [first] = await reporting.options(TYPE);
          await reporting.choose(TYPE, first);
          const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
          await reporting.setDates(today, yesterday);
          expect(await reporting.search(), 'Fin avant le début').toMatch(/La date de fin doit être supérieure à la date de début/);
          await reporting.reset();
        });
      }
    });

    /** Déroulé commun : compter, créer l'acte, recompter (+1), retrouver le consultant, filtrer par consultant. */
    async function checkTab(portal: PortalPage, page: Page, tab: PrestationsTab, keyword: RegExp | undefined,
      create: (type: string) => Promise<string>) {
      const type = await pickType(portal, page, tab, keyword);
      const before = (await searchToday(portal, page, tab, type)).count;
      const caregiver = await test.step(`Créer l'acte "${type}" pour le patient`, async () => create(type));
      created[tab] = { type, caregiver };
      const after = await searchToday(portal, page, tab, type);
      expect(after.count, `${tab} "${type}" du jour : une de plus`).toBe(before + 1);
      expect(after.headers.some(h => h.date === todayFr && words(h.caregiver) === words(caregiver)),
        `Résultat du ${todayFr} par ${caregiver}`).toBe(true);
      // Le patient de chaque résultat est affiché dans l'en-tête (chargé à la demande pour certains actes)
      const name = `${patient.firstName} ${patient.lastName}`;
      await expect.poll(async () => (await after.reporting.headers())
        .some(h => h.date === todayFr && words(h.caregiver) === words(caregiver) && name.toUpperCase().split(/\s+/).every(w => h.patient.toUpperCase().includes(w))),
        { message: `Patient ${name} affiché dans l'en-tête`, timeout: 15000 }).toBe(true);
      const byConsultant = await searchToday(portal, page, tab, type, after.headers.find(h => words(h.caregiver) === words(caregiver))!.caregiver);
      expect(byConsultant.count, 'Filtre consultant').toBeGreaterThan(0);
      expect(byConsultant.headers.every(h => words(h.caregiver) === words(caregiver)), 'Seulement ce consultant').toBe(true);
    }

    test('Consultations : une consultation du jour est retrouvée par type, date et consultant', async ({ portal, page }) => {
      await checkTab(portal, page, 'Consultations', /anesth/i, async () => {
        await openPatientDossier(portal, page);
        const consultationPage = new ConsultationPage(page);
        await consultationPage.goToConsultationTab();
        await consultationPage.expectConsultationsListLoaded();
        const data = ConsultationStandardDataGenerator.generate();
        await consultationPage.openNewConsultationModal();
        await consultationPage.fillConsultationBasics(data);
        await consultationPage.createConsultation();
        await consultationPage.fillMedicalConsultationForm(data);
        // Le formulaire prend le premier soignant de la liste (pas celui du générateur)
        const caregiver = ((await page.locator('#caregiverId .ng-value-label').first().textContent()) ?? '').replace(/\s+/g, ' ').trim();
        expect(caregiver, 'Soignant choisi').toBeTruthy();
        await consultationPage.saveConsultation();
        return caregiver;
      });
    });

    test('Imagerie : une échographie du jour est retrouvée par type, date et consultant', async ({ portal, page }) => {
      await checkTab(portal, page, 'Imagerie', /standard/i, async (type) => {
        await openPatientDossier(portal, page);
        const imagerie = new ImagerieDashboardPage(page);
        await imagerie.gotoFromPatientDashboard();
        await imagerie.openNewActeModal();
        await imagerie.chooseType('ECHOGRAPHIE');
        const root = page.locator('app-echographie-simple-static').filter({ visible: true }).first();
        const form = new ConsultationFormPage(page, root);
        await form.fill([{ name: 'type', kind: 'select', option: formLabel(type) }]);
        const values = await form.fill([
          { name: 'caregiverId', kind: 'select' },
          { name: 'date', kind: 'date', value: today },
          { name: 'region', kind: 'select' },
        ]);
        await root.getByRole('button', { name: /Enregistrer l'échographie/ }).click();
        await confirm(page);
        // Comme dans 04-facturation-actes-medicaux : l'échographie apparaît dans l'historique du patient
        await expect(page.locator('.imaging-item.imaging-item--echographie').first(), 'Échographie enregistrée').toBeVisible({ timeout: 20000 });
        return values.caregiverId as string;
      });
    });

    test('Bilans : un bilan du jour est retrouvé par type, date et consultant', async ({ portal, page }) => {
      await checkTab(portal, page, 'Bilans', undefined, async (type) => {
        await openPatientDossier(portal, page);
        const list = new HealthChecksListPage(page);
        await list.goToHealthChecksList();
        await list.openNewBilanModal();
        const form = new ConsultationFormPage(page, page.locator('#createBilanModal'));
        const values = await form.fill([
          { name: 'caregiverId', kind: 'select' },
          { name: 'type', kind: 'select', option: formLabel(type) },
        ]);
        await list.saveBilan();
        return values.caregiverId as string;
      });
    });

    test('Vaccinations : une vaccination du jour est retrouvée par type, date et consultant', async ({ portal, page }) => {
      await checkTab(portal, page, 'Vaccinations', undefined, async (type) => {
        await openPatientDossier(portal, page);
        const vaccination = new VaccinationPage(page);
        await vaccination.gotoFromPatientDashboard();
        await vaccination.openNewVaccinationModal();
        const values = await new ConsultationFormPage(page, vaccination.modal).fill([
          { name: 'type', kind: 'select', option: formLabel(type) },
          { name: 'caregiverId', kind: 'select' },
          { name: 'dose', kind: 'select' },
          { name: 'date', kind: 'date', value: today },
        ]);
        await vaccination.validerButton.click();
        await expect(vaccination.modal).toBeHidden({ timeout: 20000 });
        return values.caregiverId as string;
      });
    });

    test("Export : période obligatoire, ordre des dates, année antérieure ramenée au 1er janvier, champs DHIS2", async ({ portal, page }) => {
      const reporting = await openReporting(portal, page, 'Consultations');
      await reporting.openExport();
      await test.step('Sans période', async () => {
        await reporting.exportDates('', '');
        expect(await reporting.exportExpectingMessage()).toMatch(/Veuillez choisir une période/);
      });
      await test.step('Fin avant le début', async () => {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        await reporting.exportDates(today, yesterday);
        expect(await reporting.exportExpectingMessage()).toMatch(/La date de fin doit être supérieure à la date de début/);
      });
      await test.step("Date de l'année précédente ramenée au 1er janvier", async () => {
        const year = new Date().getFullYear();
        await reporting.exportDate(0).fill(`${year - 1}-06-15`);
        await reporting.exportDate(0).blur();
        await expect(reporting.exportDate(0)).toHaveValue(`${year}-01-01`);
      });
      await test.step('DHIS2 : unité d\'organisation et élément de données obligatoires', async () => {
        await reporting.exportDates(today, today);
        await reporting.exportFormat(/DHIS2/);
        await reporting.exportModal.getByPlaceholder("Unité d'org. (UID)").fill('');
        await reporting.exportModal.getByPlaceholder('Élément de données (UID)').fill('');
        expect(await reporting.exportExpectingMessage()).toMatch(/Veuillez renseigner l'unité d'organisation et l'élément de données DHIS2/);
      });
      await test.step('Période sans données : message, aucun fichier', async () => {
        // Le backend répond par un corps vide quand il n'y a aucune ligne (corrigé : il renvoyait
        // un CSV réduit à l'en-tête), le front affiche alors le message.
        const year = new Date().getFullYear();
        await reporting.exportFormat(/CSV/);
        await reporting.exportDates(`${year}-12-31`, `${year}-12-31`);
        // Réponse du backend attendue : le message précédent (DHIS2) peut encore être affiché
        await reporting.exportModal.getByRole('button', { name: /Télécharger/ }).click();
        await expect(reporting.exportMessage).toHaveText(/Aucune donnée trouvée pour cette période/, { timeout: 60000 });
      });
    });

    test('Export réel des consultations du jour : CSV, Excel, PDF et DHIS2', async ({ portal, page }) => {
      const reporting = await openReporting(portal, page, 'Consultations');
      const caregiver = created.Consultations?.caregiver ?? '';
      for (const [format, check] of [
        [/CSV/, (file: Buffer) => {
          const text = file.toString('utf8');
          const lines = text.split(/\r?\n/).filter(l => l.trim());
          expect(lines.length, 'En-tête et au moins une ligne').toBeGreaterThan(1);
          if (caregiver) expect.soft(words(text).length > 0 && caregiver.split(/\s+/).every(w => text.toUpperCase().includes(w.toUpperCase())), `Consultant ${caregiver} exporté`).toBe(true);
        }],
        [/Excel/, (file: Buffer) => expect(file.subarray(0, 2).toString(), 'Fichier xlsx (zip)').toBe('PK')],
        [/PDF/, (file: Buffer) => expect(file.subarray(0, 4).toString(), 'Fichier PDF').toBe('%PDF')],
      ] as [RegExp, (file: Buffer) => void][]) {
        await test.step(`Format ${format.source}`, async () => {
          await reporting.openExport();
          await reporting.exportCategory('Consultations');
          await reporting.exportDates(today, today);
          await reporting.exportFormat(format);
          const { name, content } = await reporting.exportFile();
          expect(content.length, `${name} non vide`).toBeGreaterThan(0);
          check(content);
          await expect(reporting.exportModal, 'Fenêtre refermée après export').toBeHidden();
        });
      }
      await test.step('Format DHIS2 (JSON)', async () => {
        await reporting.openExport();
        await reporting.exportCategory('Consultations');
        await reporting.exportDates(today, today);
        await reporting.exportFormat(/DHIS2/);
        await reporting.exportModal.getByPlaceholder("Unité d'org. (UID)").fill('OrgUnitQA01');
        await reporting.exportModal.getByPlaceholder('Élément de données (UID)').fill('DataElemQA1');
        const { content } = await reporting.exportFile();
        const json = JSON.parse(content.toString('utf8'));
        const text = JSON.stringify(json);
        expect(text, 'Unité d\'organisation').toContain('OrgUnitQA01');
        expect(text, 'Élément de données').toContain('DataElemQA1');
        expect(Array.isArray(json.dataValues) && json.dataValues.length > 0, 'Au moins une valeur').toBe(true);
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
      // Facturation puis lecture des listes de factures patient et garant : plus de 30 s
      test.setTimeout(Number(process.env.SLOWMO) > 0 ? 900000 : 180000);
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
