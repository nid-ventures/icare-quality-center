import { type Browser } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { PortalPage } from '../../pages/structure/portal/portal.page';
import { PatientPage } from '../../pages/structure/patient/patient.page';
import { DossierSearchPage } from '../../pages/structure/patient/dossier-search.page';
import { CarePathwayPage, PatientPrescriptionsPage } from '../../pages/structure/patient/care-pathway.page';
import { DetailPatientPage } from '../../pages/structure/patient/detail_administratif.page';
import { RenseignementsGenerauxPage } from '../../pages/structure/patient/renseignements_generaux_patient.page';
import { AntecedentPage } from '../../pages/structure/patient/antecedant_patient.page';
import { ConsultationPage } from '../../pages/structure/consultation/consultation.page';
import { ConsultationPediatriquePage } from '../../pages/structure/consultation/consultation-pediatrique.page';
import { ConsultationPlanificationPage } from '../../pages/structure/consultation/consultation-planification.page';
import { ConsultationPrenatalPage } from '../../pages/structure/consultation/consultation-prenatal.page';
import { ConsultationDentairePage } from '../../pages/structure/consultation/consultation-dentaire.page';
import { HealthChecksListPage, HealthCheckDetailPage } from '../../pages/structure/analyse/health-check.page';
import { ImagerieDashboardPage } from '../../pages/structure/imagerie/imagerie-dashboard.page';
import { ImagingWorklistPage } from '../../pages/structure/imagerie/imaging-worklist.page';
import { VaccinationPage, type VaccinationData, type DoseData } from '../../pages/structure/vaccination/vaccination.page';
import { OrdonnancePage } from '../../pages/structure/ordonnance/ordonnance.page';
import { PrescriptionManagerPage } from '../../pages/structure/consultation/prescription-manager.page';
import { PatientDataGenerator } from '../../pages/structure/generator/data-generator';
import { ConsultationStandardDataGenerator } from '../../pages/structure/generator/consultation-standard-data-generator';
import { ConsultationPediatriqueDataGenerator } from '../../pages/structure/generator/consultation-pediatrique-data-generator';
import { ConsultationPlanificationDataGenerator } from '../../pages/structure/generator/consultation-planification-data-generator';
import { ConsultationPrenatalDataGenerator } from '../../pages/structure/generator/consultation-prenatal-data-generator';
import { ConsultationDentaireDataGenerator } from '../../pages/structure/generator/consultation-dentaire-data-generator';
import { HealthCheckDataGenerator } from '../../pages/structure/generator/health-check-data-generator';
import { ImagingDataGenerator } from '../../pages/structure/generator/imaging-data-generator';
import { ADMIN_STORAGE_STATE } from '../../test-data/structure-users';

test.setTimeout(120000);

type DossierPatient = { identifier: string; firstName: string; lastName: string };

/**
 * Crée (une fois par worker) une patiente adulte dédiée à ce module : tous les tests du
 * dossier médical travaillent sur elle, jamais sur des patients existants de la base.
 */
async function createDossierPatient(browser: Browser): Promise<DossierPatient> {
  const context = await browser.newContext({
    baseURL: process.env.BASE_URL,
    storageState: ADMIN_STORAGE_STATE,
    // Même fenêtre que les projets (cf. playwright.config.ts) : la page suit la taille de la fenêtre.
    viewport: null,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  try {
    const portal = new PortalPage(page);
    const patientPage = new PatientPage(page);
    // Sexe '1' = FEMME : nécessaire pour les consultations prénatales / planification familiale.
    const data = { ...PatientDataGenerator.generate(), sex: '1' };

    await portal.goto();
    await portal.enterModule('Base patients');
    await patientPage.createPatient(data);
    await portal.enterModule('Base patients');
    await patientPage.searchByName(data.firstName, data.lastName);
    await patientPage.expectPatientInList(data.lastName);
    const identifier = await patientPage.getPatientIdentifier(data.lastName);
    return { identifier, firstName: data.firstName, lastName: data.lastName };
  } finally {
    await context.close();
  }
}

// Filtre de type et premier bouton de consultation dans la liste du patient
const firstConsultationButton = (page: import('@playwright/test').Page) =>
  page.locator('app-consultations').getByRole('button', { name: /Consultation/ }).first();

test.describe('Module Dossier médical', () => {
  let patient: DossierPatient;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120000);
    patient = await createDossierPatient(browser);
  });

  test.beforeEach(async ({ portal, page }) => {
    await portal.enterModule('Dossier médical');
    await new DossierSearchPage(page).expectLoaded();
  });

  // Ouvre le dashboard médical de la patiente dédiée
  async function openDossier(page: import('@playwright/test').Page) {
    await test.step(`Ouvrir le dossier de ${patient.firstName} ${patient.lastName}`, async () => {
      await new DossierSearchPage(page).openPatientByIdentifier(patient.identifier);
    });
  }

  // Revient sur la recherche du module puis rouvre le dossier de la patiente
  async function openDossierAgain(page: import('@playwright/test').Page) {
    await new PortalPage(page).openMenu('Dossiers patients', '**/patient/patients');
    await openDossier(page);
  }

  // ======================================================================
  // Recherche de dossiers
  // ======================================================================
  test.describe('Recherche de dossiers patients', () => {
    test('Exiger au moins un critère de recherche', async ({ page }) => {
      const search = new DossierSearchPage(page);
      await search.searchButton.click();
      await expect(search.searchHint).toBeVisible();
    });

    test('Rechercher un patient par identifiant et ouvrir son dossier', async ({ page }) => {
      const search = new DossierSearchPage(page);
      await search.searchByIdentifier(patient.identifier);
      await search.expectResult(patient.identifier);
      await search.openDossier(patient.identifier);
      await expect(page.getByRole('heading', { level: 1, name: `${patient.firstName} ${patient.lastName}` })).toBeVisible();
    });

    test('Afficher un message quand aucun patient ne correspond', async ({ page }) => {
      const search = new DossierSearchPage(page);
      await search.searchByIdentifier('0000000000');
      await expect(search.noResult).toBeVisible({ timeout: 15000 });
    });

    test('Retrouver un dossier dans les "Récemment ouverts"', async ({ page, portal }) => {
      const search = new DossierSearchPage(page);
      await search.openPatientByIdentifier(patient.identifier);

      await test.step('Revenir sur la recherche de dossiers', async () => {
        await portal.openMenu('Dossiers patients', '**/patient/patients');
        await expect(search.recentsHeading).toBeVisible();
      });

      await test.step('Rouvrir le dossier depuis la liste des récents', async () => {
        await search.recent(patient.lastName).first().click();
        await page.waitForURL('**/patient/patient-dashboard/**');
      });
    });
  });

  // ======================================================================
  // Dashboard, identité, renseignements généraux, antécédents
  // ======================================================================
  test.describe('Dashboard et informations du patient', () => {
    test('Vérifier les sections du dashboard médical', async ({ page }) => {
      await openDossier(page);
      await new PatientPage(page).expectMedicalDashboardSections();
    });

    test('Ouvrir les détails administratifs depuis le dossier', async ({ page }) => {
      const detailPatientPage = new DetailPatientPage(page);
      await openDossier(page);
      await detailPatientPage.gotoDetailsPatient();
      await page.waitForURL('**/patient/patient-info-administration/**');
      await detailPatientPage.checkIfPageLoad();
    });

    test('Vérifier les textes des renseignements généraux', async ({ page }) => {
      await openDossier(page);
      await new RenseignementsGenerauxPage(page).checkRenseignementInfos();
    });

    test('Modifier les renseignements généraux', async ({ page }) => {
      await openDossier(page);
      await new RenseignementsGenerauxPage(page).updateRenseignementGenerauxForms();
    });

    test('Vérifier les informations des antécédents', async ({ page }) => {
      await openDossier(page);
      await new AntecedentPage(page).checkAntecedentInfos();
    });

    test('Modifier les antécédents généraux', async ({ page }) => {
      const antecedentPage = new AntecedentPage(page);
      await openDossier(page);
      await antecedentPage.checkAntecedentFormulaire();
      await antecedentPage.updateAntecedantGeneraux();
    });
  });

  // ======================================================================
  // Consultations : créer -> modifier -> supprimer, pour chaque type
  // (mode série : la modification et la suppression portent sur la consultation créée)
  // ======================================================================
  test.describe('Consultation standard', () => {
    test.describe.configure({ mode: 'serial' });
    const TYPE = 'CONSULTATION ANESTHÉSIQUE';

    test('Créer une consultation standard', async ({ page }) => {
      const consultationPage = new ConsultationPage(page);
      const data = ConsultationStandardDataGenerator.generate();
      await openDossier(page);
      await consultationPage.goToConsultationTab();
      await consultationPage.expectConsultationsListLoaded();
      await consultationPage.openNewConsultationModal();
      await consultationPage.fillConsultationBasics(data);
      await consultationPage.createConsultation();
      await consultationPage.fillMedicalConsultationForm(data);
      await consultationPage.saveConsultation();
      await consultationPage.filterByConsultationType(data.consultationType);
      await expect(firstConsultationButton(page)).toBeVisible();
    });

    test('Modifier la consultation standard', async ({ page }) => {
      const consultationPage = new ConsultationPage(page);
      await openDossier(page);
      await consultationPage.goToConsultationTab();
      await consultationPage.expectConsultationsListLoaded();
      await consultationPage.filterByConsultationType(TYPE);
      await consultationPage.selectFirstConsultation();
      await expect(consultationPage.reportInput).toBeVisible();
      await consultationPage.activateForm();
      await consultationPage.fillUpdatedForm(ConsultationStandardDataGenerator.generateUpdatedData());
      await consultationPage.updateConsultation();
      await expect(consultationPage.confirmButton).not.toBeVisible();
    });

    test('Supprimer la consultation standard', async ({ page }) => {
      const consultationPage = new ConsultationPage(page);
      await openDossier(page);
      await consultationPage.goToConsultationTab();
      await consultationPage.expectConsultationsListLoaded();
      await consultationPage.filterByConsultationType(TYPE);
      await consultationPage.openFirstConsultation();
      await consultationPage.deleteConsultation();
      await expect(consultationPage.confirmButton).not.toBeVisible();
    });
  });

  test.describe('Consultation pédiatrique', () => {
    test.describe.configure({ mode: 'serial' });
    const TYPE = 'CONSULTATION PÉDIATRIQUE';

    test('Créer une consultation pédiatrique', async ({ page }) => {
      const consultationPage = new ConsultationPediatriquePage(page);
      const data = ConsultationPediatriqueDataGenerator.generate();
      await openDossier(page);
      await consultationPage.goToConsultationTab();
      await consultationPage.expectConsultationsListLoaded();
      await consultationPage.openNewConsultationModal();
      await consultationPage.fillConsultationBasics({ specialty: data.specialty, consultationType: data.consultationType });
      await consultationPage.createConsultation();
      await consultationPage.expectPediatriqueFormLoaded();
      await consultationPage.fillMedicalConsultationForm(data);
      await consultationPage.saveConsultation();
      await consultationPage.filterByConsultationType(TYPE);
      await expect(firstConsultationButton(page)).toBeVisible();
    });

    test('Modifier la consultation pédiatrique', async ({ page }) => {
      const consultationPage = new ConsultationPediatriquePage(page);
      await openDossier(page);
      await consultationPage.goToConsultationTab();
      await consultationPage.expectConsultationsListLoaded();
      await consultationPage.filterByConsultationType(TYPE);
      await consultationPage.openFirstConsultation();
      await consultationPage.expectPediatriqueFormLoaded();
      await consultationPage.activateForm();
      await consultationPage.fillUpdatedPediatriqueForm(ConsultationPediatriqueDataGenerator.generateUpdatedData());
      await consultationPage.updateConsultation();
      await expect(consultationPage.confirmButton).not.toBeVisible();
    });

    test('Supprimer la consultation pédiatrique', async ({ page }) => {
      const consultationPage = new ConsultationPediatriquePage(page);
      await openDossier(page);
      await consultationPage.goToConsultationTab();
      await consultationPage.expectConsultationsListLoaded();
      await consultationPage.filterByConsultationType(TYPE);
      await consultationPage.openFirstConsultation();
      await consultationPage.deleteConsultation();
      await expect(consultationPage.confirmButton).not.toBeVisible();
    });
  });

  test.describe('Consultation de planification familiale', () => {
    test.describe.configure({ mode: 'serial' });
    const TYPE = 'CONSULTATION PLANIFICATION';

    test('Créer une consultation de planification familiale', async ({ page }) => {
      const consultationPage = new ConsultationPlanificationPage(page);
      const data = ConsultationPlanificationDataGenerator.generate();
      await openDossier(page);
      await consultationPage.goToConsultationTab();
      await consultationPage.expectConsultationsListLoaded();
      await consultationPage.openNewConsultationModal();
      await consultationPage.fillConsultationBasics({ specialty: data.specialty, consultationType: data.consultationType });
      await consultationPage.createConsultation();
      await consultationPage.fillPlanificationForm(data);
      await consultationPage.saveConsultation();
      await consultationPage.filterByConsultationType(TYPE);
      await expect(firstConsultationButton(page)).toBeVisible();
    });

    test('Modifier la consultation de planification familiale', async ({ page }) => {
      const consultationPage = new ConsultationPlanificationPage(page);
      await openDossier(page);
      await consultationPage.goToConsultationTab();
      await consultationPage.expectConsultationsListLoaded();
      await consultationPage.filterByConsultationType(TYPE);
      await consultationPage.openFirstConsultation();
      await expect(consultationPage.heightInput).toBeVisible();
      await consultationPage.activateForm();
      await consultationPage.fillUpdatedPlanificationForm(ConsultationPlanificationDataGenerator.generateUpdatedData());
      await consultationPage.updateConsultation();
      await expect(consultationPage.confirmButton).not.toBeVisible();
    });

    test('Supprimer la consultation de planification familiale', async ({ page }) => {
      const consultationPage = new ConsultationPlanificationPage(page);
      await openDossier(page);
      await consultationPage.goToConsultationTab();
      await consultationPage.expectConsultationsListLoaded();
      await consultationPage.filterByConsultationType(TYPE);
      await consultationPage.openFirstConsultation();
      await consultationPage.deleteConsultation();
      await expect(consultationPage.confirmButton).not.toBeVisible();
    });
  });

  test.describe('Consultation prénatale', () => {
    test.describe.configure({ mode: 'serial' });
    const TYPE = 'CONSULTATION PRÉNATALE';

    test('Créer une consultation prénatale', async ({ page }) => {
      const consultationPage = new ConsultationPrenatalPage(page);
      const data = ConsultationPrenatalDataGenerator.generate();
      await openDossier(page);
      await consultationPage.goToConsultationTab();
      await consultationPage.expectConsultationsListLoaded();
      await consultationPage.openNewConsultationModal();
      await consultationPage.fillConsultationBasics({ specialty: data.specialty, consultationType: data.consultationType });
      await consultationPage.createConsultation();
      await consultationPage.expectPrenatalFormLoaded();
      await consultationPage.fillPrenatalForm(data);
      await consultationPage.saveConsultation();
      await consultationPage.filterByConsultationType(TYPE);
      await expect(firstConsultationButton(page)).toBeVisible();
    });

    test('Modifier la consultation prénatale', async ({ page }) => {
      const consultationPage = new ConsultationPrenatalPage(page);
      await openDossier(page);
      await consultationPage.goToConsultationTab();
      await consultationPage.expectConsultationsListLoaded();
      await consultationPage.filterByConsultationType(TYPE);
      await consultationPage.openFirstConsultation();
      await consultationPage.expectPrenatalFormLoaded();
      await consultationPage.activateForm();
      await consultationPage.fillUpdatedPrenatalForm(ConsultationPrenatalDataGenerator.generateUpdatedData());
      await consultationPage.updateConsultation();
      await expect(consultationPage.confirmButton).not.toBeVisible();
    });

    test('Supprimer la consultation prénatale', async ({ page }) => {
      const consultationPage = new ConsultationPrenatalPage(page);
      await openDossier(page);
      await consultationPage.goToConsultationTab();
      await consultationPage.expectConsultationsListLoaded();
      await consultationPage.filterByConsultationType(TYPE);
      await consultationPage.openFirstConsultation();
      await consultationPage.deleteConsultation();
      await expect(consultationPage.confirmButton).not.toBeVisible();
    });
  });

  test.describe('Consultation dentaire', () => {
    test.describe.configure({ mode: 'serial' });
    const TYPE = 'CONSULTATION DENTAIRE';

    test('Créer une consultation dentaire', async ({ page }) => {
      const consultationPage = new ConsultationDentairePage(page);
      const data = ConsultationDentaireDataGenerator.generate();
      await openDossier(page);
      await consultationPage.goToConsultationTab();
      await consultationPage.expectConsultationsListLoaded();
      await consultationPage.openNewConsultationModal();
      await consultationPage.fillConsultationBasics({ specialty: data.specialty, consultationType: data.consultationType });
      await consultationPage.createConsultation();
      await consultationPage.expectDentaireFormLoaded();
      await consultationPage.fillDentaireConsultationForm(data);
      await consultationPage.saveConsultation();
      await consultationPage.filterByConsultationType(TYPE);
      await expect(firstConsultationButton(page)).toBeVisible();
    });

    test('Modifier la consultation dentaire', async ({ page }) => {
      const consultationPage = new ConsultationDentairePage(page);
      await openDossier(page);
      await consultationPage.goToConsultationTab();
      await consultationPage.expectConsultationsListLoaded();
      await consultationPage.filterByConsultationType(TYPE);
      await consultationPage.openFirstConsultation();
      await consultationPage.expectDentaireFormLoaded();
      await consultationPage.activateForm();
      await consultationPage.fillUpdatedDentaireForm(ConsultationDentaireDataGenerator.generateUpdatedData());
      await consultationPage.updateConsultation();
      await expect(consultationPage.confirmButton).not.toBeVisible();
    });

    test('Supprimer la consultation dentaire', async ({ page }) => {
      const consultationPage = new ConsultationDentairePage(page);
      await openDossier(page);
      await consultationPage.goToConsultationTab();
      await consultationPage.expectConsultationsListLoaded();
      await consultationPage.filterByConsultationType(TYPE);
      await consultationPage.openFirstConsultation();
      await consultationPage.deleteConsultation();
      await expect(consultationPage.confirmButton).not.toBeVisible();
    });
  });

  // ======================================================================
  // Bilans d'analyses
  // ======================================================================
  test.describe("Bilans d'analyses", () => {
    // Crée un bilan, l'ouvre et y ajoute une analyse ; renvoie le nombre d'analyses obtenu.
    async function createBilanWithAnalyse(page: import('@playwright/test').Page): Promise<number> {
      const listPage = new HealthChecksListPage(page);
      const detailPage = new HealthCheckDetailPage(page);
      await openDossier(page);
      await listPage.goToHealthChecksList();
      const ordersBefore = await listPage.getBilanOrderNumbers();

      await test.step('Créer un nouveau bilan', async () => {
        await listPage.openNewBilanModal();
        await listPage.selectFirstPrescripteur();
        await listPage.selectFirstTypeBilan();
        await listPage.fillDiagnostic(HealthCheckDataGenerator.generateDiagnostic());
        await listPage.saveBilan();
      });

      await test.step('Ouvrir le bilan créé', async () => {
        const ordersAfter = await listPage.getBilanOrderNumbers();
        const newOrder = ordersAfter.find(order => !ordersBefore.includes(order));
        expect(newOrder, 'Le nouveau N° de bulletin doit apparaître dans la liste').toBeTruthy();
        await listPage.openBilanByOrderNumber(newOrder!);
        await detailPage.expectDetailLoaded();
      });

      const countBefore = await detailPage.getAnalyseRowCount();
      await test.step('Ajouter une analyse au bulletin', async () => {
        await detailPage.openAddAnalyseModal();
        await detailPage.selectFirstConsultant();
        await detailPage.selectFirstAnalyse();
        await detailPage.saveAnalyse();
        await detailPage.expectAnalyseRowCount(countBefore + 1);
      });
      return countBefore + 1;
    }

    test('Créer un bilan et y ajouter une analyse', async ({ page }) => {
      await createBilanWithAnalyse(page);
    });

    test("Supprimer une analyse d'un bulletin", async ({ page }) => {
      const detailPage = new HealthCheckDetailPage(page);
      const count = await createBilanWithAnalyse(page);
      await detailPage.deleteFirstAnalyse();
      await detailPage.expectAnalyseRowCount(count - 1);
    });
  });

  // ======================================================================
  // Imagerie
  // ======================================================================
  test.describe('Imagerie', () => {
    async function createEchographie(page: import('@playwright/test').Page) {
      const imageriePage = new ImagerieDashboardPage(page);
      await openDossier(page);
      await imageriePage.gotoFromPatientDashboard();
      await imageriePage.openNewActeModal();
      await imageriePage.chooseType('ECHOGRAPHIE');
      await imageriePage.fillEchographieCreateForm(ImagingDataGenerator.generateEchographie());
      await imageriePage.submitEchographieCreateForm();
      await expect(imageriePage.confirmButton).not.toBeVisible();
      await expect(imageriePage.newActeButton).toBeVisible();
    }

    test('Créer une échographie', async ({ page }) => {
      await createEchographie(page);
    });

    test("Modifier une échographie depuis la worklist d'imagerie", async ({ page }) => {
      const worklistPage = new ImagingWorklistPage(page);
      const updatedData = ImagingDataGenerator.generateEchographieUpdate();
      await createEchographie(page);
      await worklistPage.goto();
      const found = await worklistPage.findFirstRowOfKind('echographie');
      expect(found).not.toBeNull();
      await worklistPage.echoActiverButton(found!.expandedRow).click();
      const resumeInput = worklistPage.echoResumeInput(found!.expandedRow);
      const compteRenduTextarea = worklistPage.echoCompteRenduTextarea(found!.expandedRow);
      if (await resumeInput.isVisible().catch(() => false)) await resumeInput.fill(updatedData.resume);
      if (await compteRenduTextarea.isVisible().catch(() => false)) await compteRenduTextarea.fill(updatedData.compteRendu);
      await worklistPage.echoSubmitButton(found!.expandedRow).click();
      await worklistPage.confirmModal();
      await expect(worklistPage.confirmButton).not.toBeVisible();
    });

    test("Supprimer une échographie depuis la worklist d'imagerie", async ({ page }) => {
      const worklistPage = new ImagingWorklistPage(page);
      await createEchographie(page);
      await worklistPage.goto();
      const found = await worklistPage.findFirstRowOfKind('echographie');
      expect(found).not.toBeNull();
      const fingerprint = (await found!.row.locator('td').nth(5).innerText()).trim();
      await worklistPage.echoSupprimerButton(found!.expandedRow).click();
      await worklistPage.confirmModal();
      await expect(worklistPage.confirmButton).not.toBeVisible();
      await worklistPage.goto();
      await expect(page.locator('table.compact-table tbody tr.table-row', { hasText: fingerprint })).toHaveCount(0);
    });

    test('Créer puis supprimer un scanner', async ({ page }) => {
      const imageriePage = new ImagerieDashboardPage(page);
      const worklistPage = new ImagingWorklistPage(page);
      await openDossier(page);
      await imageriePage.gotoFromPatientDashboard();
      await imageriePage.openNewActeModal();
      await imageriePage.chooseType('SCANNER');
      await imageriePage.fillScannerCreateForm();
      await imageriePage.submitScannerCreateForm();
      await expect(imageriePage.confirmButton).not.toBeVisible();

      await worklistPage.goto();
      const found = await worklistPage.findFirstRowOfKind('imaging');
      expect(found).not.toBeNull();
      const fingerprint = (await found!.row.locator('td').nth(5).innerText()).trim();
      await worklistPage.imagingSupprimerButton(found!.expandedRow).click();
      await worklistPage.confirmModal();
      await expect(worklistPage.confirmButton).not.toBeVisible();
      await worklistPage.goto();
      await expect(page.locator('table.compact-table tbody tr.table-row', { hasText: fingerprint })).toHaveCount(0);
    });
  });

  // ======================================================================
  // Vaccination
  // ======================================================================
  test.describe('Vaccination', () => {
    const vaccination = (commentary: string): VaccinationData => ({
      date: new Date().toISOString().split('T')[0],
      lot: `LOT-${Date.now()}`,
      commentary,
    });

    test('Créer une vaccination', async ({ page }) => {
      const vaccinationPage = new VaccinationPage(page);
      await openDossier(page);
      await vaccinationPage.gotoFromPatientDashboard();
      await vaccinationPage.openNewVaccinationModal();
      await vaccinationPage.fillVaccinationForm(vaccination('Commentaire de test automatisé'));
      await vaccinationPage.submitVaccinationForm();
      await expect(vaccinationPage.firstVaccinationHeader).toBeVisible();
    });

    test('Ajouter une dose à une vaccination', async ({ page }) => {
      const vaccinationPage = new VaccinationPage(page);
      const dose: DoseData = { date: new Date().toISOString().split('T')[0], lot: `DOSE-${Date.now()}` };
      await openDossier(page);
      await vaccinationPage.gotoFromPatientDashboard();
      await vaccinationPage.createVaccination(vaccination('Vaccination de référence pour ajout de dose'));
      await expect(vaccinationPage.firstVaccinationHeader).toBeVisible();
      await vaccinationPage.addDoseToFirstVaccination(dose);
      await expect(vaccinationPage.doseAddedToast).toBeVisible();
    });

    test('Supprimer une vaccination', async ({ page }) => {
      const vaccinationPage = new VaccinationPage(page);
      await openDossier(page);
      await vaccinationPage.gotoFromPatientDashboard();
      await vaccinationPage.createVaccination(vaccination('Vaccination de référence à supprimer'));
      await expect(vaccinationPage.firstVaccinationHeader).toBeVisible();
      await vaccinationPage.deleteFirstVaccination();
      await expect(vaccinationPage.vaccinationDeletedToast).toBeVisible();
    });
  });

  // ======================================================================
  // Prescriptions (analyses et imagerie prescrites)
  // ======================================================================
  test.describe('Prescriptions', () => {
    test("Consulter les prescriptions d'analyses du patient", async ({ page }) => {
      const prescriptions = new PatientPrescriptionsPage(page);
      await openDossier(page);
      await prescriptions.openAnalysesFromDashboard();
      await prescriptions.expectColumns(['N° bulletin', 'Titre', 'Analyses', 'Statut', 'Date']);
      await prescriptions.searchAndRefresh();
      await prescriptions.backToDashboard();
    });

    test("Consulter les prescriptions d'imagerie du patient", async ({ page }) => {
      const prescriptions = new PatientPrescriptionsPage(page);
      await openDossier(page);
      await prescriptions.openImagingFromDashboard();
      await prescriptions.expectColumns(['N° bulletin', 'Titre', 'Région', 'Diagnostic', 'Date', 'Actions']);
      await prescriptions.searchAndRefresh();
      await prescriptions.backToDashboard();
    });
  });

  // ======================================================================
  // Parcours de soins
  // ======================================================================
  test.describe('Parcours de soins', () => {
    // L'archivage n'est pas testé : pour un parcours vaccinal, "Archiver" ouvre le formulaire
    // d'antécédent obstétrical (issue de grossesse), propre au parcours prénatal.
    test('Démarrer un parcours vaccinal', async ({ page }) => {
      const carePathway = new CarePathwayPage(page);
      await openDossier(page);

      await test.step('Ouvrir le formulaire de démarrage du parcours VACCINAL', async () => {
        await carePathway.openStartForm('VACCINAL');
      });

      await test.step('Renseigner la date de début et le praticien, puis démarrer', async () => {
        await carePathway.fillStartForm(new Date().toISOString().split('T')[0]);
        await carePathway.start();
      });

      await test.step('Le parcours en cours apparaît sur le dashboard du patient', async () => {
        await openDossierAgain(page);
        await expect(page.getByRole('heading', { name: /Parcours de soins/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /VACCINAL/ }).or(page.getByRole('link', { name: /VACCINAL/ })).first()).toBeVisible();
      });
    });

    test('Consulter les archives des parcours de soins', async ({ page }) => {
      const carePathway = new CarePathwayPage(page);
      await openDossier(page);
      await carePathway.openArchivesFromDashboard();
      for (const column of ['Type', 'Médecin', 'Date enregistrement', 'État', 'Date clôture', 'Actions']) {
        await expect(page.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
      }
    });
  });

  // ======================================================================
  // Ordonnance
  // ======================================================================
  // Les ordonnances se prescrivent désormais dans le gestionnaire de prescriptions d'une
  // consultation ; la page Ordonnance du patient n'est plus qu'une liste (recherche, impression).
  test.describe('Ordonnance', () => {
    test("Prescrire une ordonnance lors d'une consultation", async ({ page }) => {
      const consultationPage = new ConsultationPage(page);
      const prescriptions = new PrescriptionManagerPage(page);
      const ordonnancePage = new OrdonnancePage(page);
      const consultation = ConsultationStandardDataGenerator.generate();
      const title = `Ordonnance test ${Date.now()}`;

      await test.step('Démarrer une consultation standard', async () => {
        await openDossier(page);
        await consultationPage.goToConsultationTab();
        await consultationPage.expectConsultationsListLoaded();
        await consultationPage.openNewConsultationModal();
        await consultationPage.fillConsultationBasics(consultation);
        await consultationPage.createConsultation();
        await consultationPage.fillMedicalConsultationForm(consultation);
      });

      await test.step('Ajouter une ordonnance dans le gestionnaire de prescriptions', async () => {
        await prescriptions.addMedicationPrescription({
          title,
          medicationName: 'Paracétamol',
          posologie: '1 comprimé matin et soir',
          recommandations: 'Repos et hydratation recommandés',
        });
      });

      await test.step('Enregistrer la consultation', async () => {
        await consultationPage.saveConsultation();
      });

      await test.step("Retrouver l'ordonnance dans la liste des ordonnances du patient", async () => {
        await openDossierAgain(page);
        await ordonnancePage.gotoFromPatientDashboard();
        await expect(page.getByRole('heading', { name: /^Ordonnances \([1-9]\d*\)/ })).toBeVisible();
        await expect(page.getByText(title).first()).toBeVisible();
      });
    });

    test('Consulter la liste des ordonnances du patient', async ({ page }) => {
      const ordonnancePage = new OrdonnancePage(page);
      await openDossier(page);
      await ordonnancePage.gotoFromPatientDashboard();
      await expect(page.getByRole('heading', { name: 'Formulaire de recherche' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Imprimer la sélection/ })).toBeVisible();
      await page.getByRole('button', { name: /Actualiser$/ }).click();
      await page.getByRole('button', { name: /Retour$/ }).click();
      await page.waitForURL('**/patient/patient-dashboard/**');
    });
  });
});
