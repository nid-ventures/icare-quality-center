import { test, expect } from '../../fixtures/structure.fixture';
import { createDossierPatient, openDossier as openPatientDossier, DOSSIER_SETUP_TIMEOUT, type DossierPatient } from '../../fixtures/dossier-patient';
import { PortalPage } from '../../pages/structure/portal/portal.page';
import { PatientPage } from '../../pages/structure/patient/patient.page';
import { DossierSearchPage } from '../../pages/structure/patient/dossier-search.page';
import { PatientPrescriptionsPage } from '../../pages/structure/patient/care-pathway.page';
import { DetailPatientPage } from '../../pages/structure/patient/detail_administratif.page';
import { RenseignementsGenerauxPage } from '../../pages/structure/patient/renseignements_generaux_patient.page';
import { AntecedentPage } from '../../pages/structure/patient/antecedant_patient.page';
import { ConsultationPage } from '../../pages/structure/consultation/consultation.page';
import { OrdonnancePage } from '../../pages/structure/ordonnance/ordonnance.page';
import { PrescriptionManagerPage } from '../../pages/structure/consultation/prescription-manager.page';
import { ConsultationStandardDataGenerator } from '../../pages/structure/generator/consultation-standard-data-generator';

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

  // Prestations médicales, dans l'ordre du cadre "Prestation Médicale" du dashboard :
  // 1-consultations, 2-imagerie, 3-vaccination, 4-bilans (fichiers 03-dossier-medical-<n>-*.spec.ts),
  // puis 5-parcours (parcours de soins).

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
  // Cas d'exception (chaque prestation a les siens dans son fichier)
  // ======================================================================
  test.describe("Cas d'exception", () => {
    test('Une recherche composée uniquement d\'espaces est refusée', async ({ page }) => {
      const search = new DossierSearchPage(page);
      await search.identifierInput.fill('   ');
      await search.searchButton.click();
      await expect(search.searchHint).toBeVisible();
      await expect(search.results).toHaveCount(0);
    });

    test("Ouvrir le dossier d'un patient inexistant affiche une erreur", async ({ page }) => {
      test.fail(true, "Anomalie : /patient/patient-dashboard/<id inconnu> affiche un dashboard vide (nom vide), sans message d'erreur ni redirection.");
      await page.goto('/patient/patient-dashboard/00000000-0000-0000-0000-000000000000');
      await expect(page.getByText(/introuvable|n'existe pas|inexistant|erreur/i).first()).toBeVisible({ timeout: 10000 });
    });
  });
});
