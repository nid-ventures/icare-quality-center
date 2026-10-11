import { test, expect } from '../../fixtures/structure.fixture';
import { createDossierPatient, openDossier as openPatientDossier, DOSSIER_SETUP_TIMEOUT, type DossierPatient } from '../../fixtures/dossier-patient';
import { PortalPage } from '../../pages/structure/portal/portal.page';
import { PatientPage } from '../../pages/structure/patient/patient.page';
import { DossierSearchPage } from '../../pages/structure/patient/dossier-search.page';
import { CarePathwayPage, PatientPrescriptionsPage } from '../../pages/structure/patient/care-pathway.page';
import { DetailPatientPage } from '../../pages/structure/patient/detail_administratif.page';
import { RenseignementsGenerauxPage } from '../../pages/structure/patient/renseignements_generaux_patient.page';
import { AntecedentPage } from '../../pages/structure/patient/antecedant_patient.page';
import { ConsultationPage } from '../../pages/structure/consultation/consultation.page';
import { HealthChecksListPage, HealthCheckDetailPage } from '../../pages/structure/analyse/health-check.page';
import { ImagerieDashboardPage } from '../../pages/structure/imagerie/imagerie-dashboard.page';
import { ImagingWorklistPage } from '../../pages/structure/imagerie/imaging-worklist.page';
import { VaccinationPage, type VaccinationData, type DoseData } from '../../pages/structure/vaccination/vaccination.page';
import { OrdonnancePage } from '../../pages/structure/ordonnance/ordonnance.page';
import { PrescriptionManagerPage } from '../../pages/structure/consultation/prescription-manager.page';
import { ConsultationStandardDataGenerator } from '../../pages/structure/generator/consultation-standard-data-generator';
import { HealthCheckDataGenerator } from '../../pages/structure/generator/health-check-data-generator';
import { ImagingDataGenerator } from '../../pages/structure/generator/imaging-data-generator';

test.setTimeout(120000);

test.describe('Module Dossier médical', () => {
  let patient: DossierPatient;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(DOSSIER_SETUP_TIMEOUT);
    patient = await createDossierPatient(browser);
  });

  test.beforeEach(async ({ portal, page }) => {
    await portal.enterModule('Dossier médical');
    await new DossierSearchPage(page).expectLoaded();
  });

  // Ouvre le dashboard médical de la patiente dédiée
  async function openDossier(page: import('@playwright/test').Page) {
    await test.step(`Ouvrir le dossier de ${patient.firstName} ${patient.lastName}`, async () => {
      await openPatientDossier(page, patient);
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

  // Consultations (tous types, tous les champs, prescriptions, cas d'exception) :
  // voir 03-dossier-medical-consultations.spec.ts

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

  // ======================================================================
  // Cas d'exception (les consultations ont les leurs : 03-dossier-medical-consultations.spec.ts)
  // ======================================================================
  test.describe("Cas d'exception", () => {
    test('Une recherche composée uniquement d\'espaces est refusée', async ({ page }) => {
      const search = new DossierSearchPage(page);
      await search.identifierInput.fill('   ');
      await search.searchButton.click();
      await expect(search.searchHint).toBeVisible();
      await expect(search.results).toHaveCount(0);
    });

    test("Un bilan sans prescripteur ni type n'est pas enregistré", async ({ page }) => {
      const listPage = new HealthChecksListPage(page);
      await openDossier(page);
      await listPage.goToHealthChecksList();
      const before = await listPage.getBilanOrderNumbers();
      await listPage.openNewBilanModal();
      const modal = page.locator('#createBilanModal');
      await modal.getByRole('button', { name: /Enregistrer/ }).click();
      await expect(modal.getByText('Le prescripteur est obligatoire')).toBeVisible();
      await expect(modal.getByText('Le type de bilan est obligatoire')).toBeVisible();
      await expect(modal, 'La fenêtre reste ouverte').toBeVisible();
      await page.keyboard.press('Escape');
      expect(await listPage.getBilanOrderNumbers()).toEqual(before);
    });

    // La date est préremplie avec la date du jour : seuls type, consultant et dose sont manquants.
    test("Une vaccination sans type, consultant ni dose n'est pas enregistrée", async ({ page }) => {
      const vaccinationPage = new VaccinationPage(page);
      await openDossier(page);
      await vaccinationPage.gotoFromPatientDashboard();
      await vaccinationPage.openNewVaccinationModal();
      const modal = page.locator('.modal.show');
      await modal.getByRole('button', { name: /Valider/ }).click();
      for (const message of ['Le type est obligatoire', 'Le consultant est obligatoire', 'La dose est obligatoire']) {
        await expect(modal.getByText(message), message).toBeVisible();
      }
    });

    test('Démarrer un parcours de soins sans date ni praticien est refusé', async ({ page }) => {
      const carePathway = new CarePathwayPage(page);
      await openDossier(page);
      await carePathway.openStartForm('VACCINAL');
      await carePathway.startButton.click();
      await expect(page.getByText(/est obligatoire/).first()).toBeVisible();
      // Libellé de l'application : "Le patricien est obligatoire" (sic)
      await expect(page.getByText(/Le pa(t)?ricien est obligatoire|Le praticien est obligatoire/)).toBeVisible();
      await expect(page).toHaveURL(/\/patient\/create-careplan\//);
    });

    test("Valider un acte d'imagerie sans type est refusé", async ({ page }) => {
      test.fail(true, "Anomalie : \"Valider\" sans type d'acte ferme la fenêtre et ouvre le formulaire sans type (imagerie-dashboard.component.ts, onAddEchographie sans contrôle).");
      const imageriePage = new ImagerieDashboardPage(page);
      await openDossier(page);
      await imageriePage.gotoFromPatientDashboard();
      await imageriePage.openNewActeModal();
      await page.locator('.modal.show').getByRole('button', { name: /Valider/ }).click();
      await expect(page.locator('.modal.show'), 'La fenêtre doit rester ouverte avec un message').toBeVisible({ timeout: 3000 });
    });

    test("Ouvrir le dossier d'un patient inexistant affiche une erreur", async ({ page }) => {
      test.fail(true, "Anomalie : /patient/patient-dashboard/<id inconnu> affiche un dashboard vide (nom vide), sans message d'erreur ni redirection.");
      await page.goto('/patient/patient-dashboard/00000000-0000-0000-0000-000000000000');
      await expect(page.getByText(/introuvable|n'existe pas|inexistant|erreur/i).first()).toBeVisible({ timeout: 10000 });
    });
  });
});
