import { type Page } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { PatientPage } from '../../pages/structure/patient/patient.page';
import { PortalPage } from '../../pages/structure/portal/portal.page';
import { DetailPatientPage } from '../../pages/structure/patient/detail_administratif.page';
import { PatientCarePage } from '../../pages/structure/patient/patient-care.page';
import { PatientDataGenerator, type PatientData } from '../../pages/structure/generator/data-generator';
import { ContactPersonGenerator } from '../../pages/structure/generator/contact-person-generator';
import { CareDataGenerator } from '../../pages/structure/generator/care-data-generator';

test.setTimeout(90000);

/**
 * Crée un patient dédié au test (pour ne jamais modifier/supprimer des données existantes),
 * le retrouve dans la liste et, si demandé, ouvre sa fiche administrative.
 */
async function createTestPatient(page: Page, openFile = false): Promise<PatientData> {
  const patientPage = new PatientPage(page);
  const data = PatientDataGenerator.generate();

  await test.step(`Créer le patient de test ${data.firstName} ${data.lastName}`, async () => {
    await patientPage.createPatient(data);
  });

  await test.step('Revenir dans Base patients et retrouver le patient', async () => {
    // La création redirige vers le dossier médical : on revient dans le module Base patients.
    await new PortalPage(page).enterModule('Base patients');
    await patientPage.searchByName(data.firstName, data.lastName);
    await patientPage.expectPatientInList(data.lastName);
  });

  if (openFile) {
    await test.step('Ouvrir la fiche administrative du patient', async () => {
      await patientPage.openPatient(data.lastName);
      await page.waitForURL('**/patient/patient-info-administration/**');
      await new DetailPatientPage(page).checkIfPageLoad();
    });
  }
  return data;
}

test.describe('Module Base patients', () => {

  test.beforeEach(async ({ portal, page }) => {
    await portal.enterModule('Base patients');
    await page.waitForURL('**/patient/patients');
  });

  // ======================================================================
  // Liste & recherche
  // ======================================================================
  test.describe('Liste et recherche des patients', () => {
    test('Vérifier la présentation de la liste des patients', async ({ page }) => {
      await new PatientPage(page).checkPatientsList();
    });

    test('Rechercher un patient par chaque critère puis réinitialiser', async ({ page }) => {
      const patientPage = new PatientPage(page);

      await test.step('Rechercher le premier patient par chacun de ses champs', async () => {
        await patientPage.definitionChamps(page);
      });

      await test.step('Réinitialiser le formulaire de recherche', async () => {
        await patientPage.resetForm();
        await expect(page.getByPlaceholder('Identifiant...')).toHaveValue('');
      });
    });
  });

  // ======================================================================
  // Création / doublons / suppression
  // ======================================================================
  test.describe('Création et suppression de patients', () => {
    test('Créer un patient sans consentement', async ({ page }) => {
      const data = await createTestPatient(page);
      await test.step('Vérifier les données affichées dans la liste', async () => {
        await expect(new PatientPage(page).patientRow(data.lastName).first()).toContainText(data.firstName);
      });
    });

    test('Créer un patient avec demande de consentement', async ({ page }) => {
      const patientPage = new PatientPage(page);
      const data = PatientDataGenerator.generate();

      await test.step('Créer le patient avec le consentement activé (email de demande)', async () => {
        await patientPage.gotoPatientsList();
        await patientPage.createPatient(data, 'Activé', 'sanouarouna90@gmail.com');
      });

      await test.step('Le dossier du patient créé est ouvert', async () => {
        await expect(page.getByRole('heading', { level: 1, name: `${data.firstName} ${data.lastName}` })).toBeVisible();
      });
    });

    for (const choice of ['modifier', 'ignorer'] as const) {
      test(`Créer un doublon puis choisir "${choice === 'modifier' ? 'Valider le choix' : 'Ignorer et créer'}"`, async ({ page }) => {
        const patientPage = new PatientPage(page);

        await test.step('Préparer un doublon du premier patient (même date de naissance et téléphone)', async () => {
          await patientPage.gotoPatientsList();
          const original = {
            dob: await patientPage.getFirstPatientDob(),
            phonePrimary: await patientPage.getFirstPatientPhone(),
          } as PatientData;
          await patientPage.openCreationModal();
          await patientPage.fillCreationForm('Désactivé', PatientDataGenerator.generateDuplicateFrom(original));
        });

        await test.step('Enregistrer : la détection de doublon apparaît', async () => {
          await patientPage.saveAndConfirm();
        });

        await test.step(choice === 'modifier' ? 'Mettre à jour le patient existant' : 'Ignorer le doublon et créer le patient', async () => {
          if (choice === 'modifier') {
            await patientPage.updateDuplicatAndConfirm();
          } else {
            await patientPage.ignoreDuplicatAndConfirm();
          }
        });
      });
    }

    test('Supprimer un patient', async ({ page }) => {
      const patientPage = new PatientPage(page);
      const data = await createTestPatient(page);

      await test.step('Supprimer le patient depuis la liste', async () => {
        await patientPage.deletePatient(data.lastName);
      });

      await test.step("Vérifier qu'il n'apparaît plus dans la recherche", async () => {
        await patientPage.searchByName(data.firstName, data.lastName);
        await patientPage.expectPatientNotInList(data.lastName);
      });
    });
  });

  // ======================================================================
  // Fiche administrative : détails
  // ======================================================================
  test.describe('Fiche administrative', () => {
    test('Modifier les détails administratifs du patient', async ({ page }) => {
      await createTestPatient(page, true);
      await new DetailPatientPage(page).updateData();
    });

    // Le backend renvoie le téléphone principal en premier : la facturation et les actes
    // reprennent phones[0] comme téléphone du patient.
    test('Le téléphone principal reste en premier (liste et fiche administrative)', async ({ page }) => {
      const digits = (value: string) => value.replace(/\D/g, '').slice(-9);
      const patientPage = new PatientPage(page);
      const data = await createTestPatient(page);
      await test.step('Liste : principal puis secondaire', async () => {
        const row = page.locator('.compact-table tbody tr').filter({ hasText: data.lastName }).first();
        const shown = (await row.locator('td:nth-child(6)').innerText()).split('/').map(digits);
        expect(shown, 'Téléphones affichés').toEqual([digits(data.phonePrimary), digits(data.phoneSecondary)]);
      });
      await test.step('Fiche administrative : principal dans le premier champ', async () => {
        await patientPage.openPatient(data.lastName);
        await page.waitForURL('**/patient/patient-info-administration/**');
        await new DetailPatientPage(page).checkIfPageLoad();
        const phones = page.locator('app-intl-tel-input input[type="tel"]');
        await expect(phones.first()).not.toHaveValue('');
        expect(digits(await phones.nth(0).inputValue()), 'Premier champ').toBe(digits(data.phonePrimary));
        expect(digits(await phones.nth(1).inputValue()), 'Second champ').toBe(digits(data.phoneSecondary));
      });
    });
  });

  // ======================================================================
  // Personnes à contacter
  // ======================================================================
  test.describe('Personnes à contacter', () => {
    test.beforeEach(async ({ page }) => {
      const detailPatientPage = new DetailPatientPage(page);
      await createTestPatient(page, true);
      await test.step('Ajouter une personne à contacter', async () => {
        await detailPatientPage.goToPersonContactTab();
        await detailPatientPage.openAddPersonModal();
        await detailPatientPage.fillPersonContactForm(ContactPersonGenerator.generate());
        await detailPatientPage.savePersonContact();
      });
    });

    test('Ajouter une personne à contacter', async () => {
      // L'ajout (et sa vérification) est réalisé dans le beforeEach.
    });

    test('Modifier une personne à contacter (région et nationalité)', async ({ page }) => {
      await new DetailPatientPage(page).modifyFirstContactPerson('50', '32');
    });

    test('Supprimer une personne à contacter', async ({ page }) => {
      await new DetailPatientPage(page).deleteFirstContactPerson();
      // Toast de l'application : "La suppression a reussi avec succès" (sans accent sur "reussi").
      await expect(page.getByText(/suppression a r[ée]ussi/i)).toBeVisible();
    });
  });

  // ======================================================================
  // Prises en charge
  // ======================================================================
  test.describe('Prises en charge', () => {
    let insurerName = '';

    test.beforeEach(async ({ page }) => {
      const carePage = new PatientCarePage(page);
      const careData = CareDataGenerator.generate();
      insurerName = careData.insurerName;
      await createTestPatient(page, true);
      await test.step(`Ajouter une prise en charge ${insurerName}`, async () => {
        await carePage.goToCareTab();
        await carePage.openAddCareModal();
        await carePage.fillCareForm(careData);
        await carePage.saveCare();
      });
    });

    test('Ajouter une prise en charge', async ({ page }) => {
      await expect(page.locator('#pills-prise-en-charge-fill tbody tr').filter({ hasText: insurerName }).first()).toBeVisible();
    });

    test('Modifier une prise en charge', async ({ page }) => {
      // L'application exige une date de fin strictement postérieure à aujourd'hui.
      const newEndingDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      await new PatientCarePage(page).modifyFirstCare('AFRIC MANAGEMENT (IPM)', newEndingDate);
    });

    test("Voir les détails d'une prise en charge", async ({ page }) => {
      const carePage = new PatientCarePage(page);
      await carePage.viewFirstCareDetails();
      await carePage.closeViewModal();
    });

    test('Supprimer une prise en charge', async ({ page }) => {
      await new PatientCarePage(page).deleteFirstCare();
    });
  });

  // ======================================================================
  // Raccourcis vers la facturation
  // ======================================================================
  test.describe('Raccourcis de facturation', () => {
    test('Facturer un patient depuis la liste', async ({ page, portal }) => {
      const patientPage = new PatientPage(page);
      const data = await createTestPatient(page);
      await patientPage.billPatient(data.lastName);
      await expect(portal.moduleSwitcher).toContainText('Facturation');
      await expect(page.getByText(data.lastName, { exact: false }).first()).toBeVisible({ timeout: 15000 });
    });

    test('Consulter les factures d\'un patient depuis la liste', async ({ page, portal }) => {
      const patientPage = new PatientPage(page);
      const data = await createTestPatient(page);
      await patientPage.openPatientInvoices(data.lastName);
      await expect(portal.moduleSwitcher).toContainText('Facturation');
    });
  });
});
