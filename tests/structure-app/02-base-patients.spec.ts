import { type Page } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { PatientPage } from '../../pages/structure/patient/patient.page';
import { PortalPage } from '../../pages/structure/portal/portal.page';
import { DetailPatientPage, type ContactPersonData } from '../../pages/structure/patient/detail_administratif.page';
import { PatientCarePage, type CareData } from '../../pages/structure/patient/patient-care.page';
import { PatientDataGenerator, type PatientData } from '../../pages/structure/generator/data-generator';
import { ContactPersonGenerator } from '../../pages/structure/generator/contact-person-generator';
import { CareDataGenerator } from '../../pages/structure/generator/care-data-generator';
import { hasModule, withoutModuleReason } from '../../test-data/tenants';
import { UnsavedDialog } from '../../pages/structure/shared/unsaved-dialog';

// 5 min : la création d'un patient attend la liste des patients (/patients/getAll), qui peut
// dépasser une minute en local ; multiplié par 6 en mode visuel (SLOWMO) comme dans la configuration
test.setTimeout((Number(process.env.SLOWMO) > 0 ? 6 : 1) * 300000);

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
      // Patient créé par le test : premier de la liste (la plus récente création), avec des
      // données connues dans toutes les structures (les patients existants peuvent être incomplets)
      await createTestPatient(page);

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
        // L'envoi de l'e-mail de consentement précède l'ouverture du dossier : plus de 5 s possible
        await expect(page.getByRole('heading', { level: 1, name: `${data.firstName} ${data.lastName}` })).toBeVisible({ timeout: 30000 });
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
    test('Modifier les détails administratifs du patient : valeurs conservées après rechargement', async ({ page }) => {
      const detail = new DetailPatientPage(page);
      await createTestPatient(page, true);
      const data = await test.step('Modifier naissance, email, quartier, rue, ville et région', () => detail.updateData());
      await test.step('Recharger la fiche : chaque valeur modifiée est restituée', async () => {
        await page.reload();
        await detail.checkIfPageLoad();
        await detail.expectAdministrativeData(data);
      });
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
  // Saisies non enregistrées (frontend d6c6340c : garde sur toutes les pages, fenêtres, F5)
  // ======================================================================
  test.describe('Saisies non enregistrées', () => {
    const LEAVE = /MODIFICATIONS NON ENREGISTRÉES/;
    const email = (page: Page) => page.locator('input#email');
    const birth = (page: Page) => page.locator('input[name="doB"]');

    /** Patient de test, fiche administrative ouverte puis activée ; renvoie l'email enregistré. */
    async function openActivatedFile(page: Page) {
      const patient = await createTestPatient(page, true);
      await expect(birth(page), 'Fiche chargée').not.toHaveValue('', { timeout: 15000 });
      const saved = await email(page).inputValue();
      await test.step('Activer le formulaire', async () => {
        await page.getByRole('button', { name: 'Activer le formulaire' }).click();
        await expect(email(page)).toBeEditable();
      });
      return { patient, saved };
    }

    async function reopenFile(page: Page, patient: PatientData) {
      const patientPage = new PatientPage(page);
      await patientPage.searchByName(patient.firstName, patient.lastName);
      await patientPage.openPatient(patient.lastName);
      await page.waitForURL('**/patient/patient-info-administration/**');
      await new DetailPatientPage(page).checkIfPageLoad();
      await expect(birth(page), 'Fiche chargée').not.toHaveValue('', { timeout: 15000 });
    }

    test("Fiche administrative modifiée : quitter la page demande confirmation, « Rester » garde la saisie, « Quitter quand même » l'abandonne", async ({ page }) => {
      const { patient, saved } = await openActivatedFile(page);
      const typed = `non.enregistre${Date.now() % 1000000}@example.com`;
      await email(page).fill(typed);
      const dialog = new UnsavedDialog(page);
      const portal = new PortalPage(page);
      await test.step('Menu « Patients » : popup « Modifications non enregistrées »', async () => {
        await portal.openMenu('Patients');
        await dialog.expectOpen(LEAVE, /gardées en brouillon sur ce poste/);
      });
      await test.step('« Rester sur la page » : fiche toujours ouverte, saisie intacte', async () => {
        await dialog.answer(/Rester sur la page/);
        await expect(page).toHaveURL(/patient-info-administration/);
        await expect(email(page)).toHaveValue(typed);
      });
      await test.step('« Quitter quand même » : liste des patients', async () => {
        await portal.openMenu('Patients');
        await dialog.expectOpen(LEAVE);
        await dialog.answer(/Quitter (quand même|sans sauvegarder)/);
        await page.waitForURL('**/patient/patients');
      });
      await test.step("Fiche rouverte : l'email saisi n'a pas été enregistré", async () => {
        await reopenFile(page, patient);
        await expect(email(page)).toHaveValue(saved);
      });
    });

    /**
     * Menu « Patients » : la liste doit s'ouvrir sans popup. Une popup inattendue est refermée par
     * « Quitter quand même » (le test échoue sans rester bloqué sur la fiche).
     */
    async function leaveWithoutPopup(page: Page) {
      const dialog = new UnsavedDialog(page);
      await new PortalPage(page).openMenu('Patients');
      const popup = await Promise.race([
        page.waitForURL('**/patient/patients', { timeout: 30000 }).then(() => false),
        dialog.root.waitFor({ timeout: 30000 }).then(() => true),
      ]).catch(() => false);
      if (popup) {
        const title = await dialog.title.innerText();
        await dialog.answer(/Quitter (quand même|sans sauvegarder)/);
        expect(popup, `Popup « ${title} » affichée`).toBe(false);
      }
      await page.waitForURL('**/patient/patients');
      await dialog.expectClosed();
    }

    test('Fiche seulement activée : on la quitte sans popup', async ({ page }) => {
      await openActivatedFile(page);
      await leaveWithoutPopup(page);
    });

    test('Fiche modifiée puis ramenée à sa valeur de départ : on la quitte sans popup', async ({ page }) => {
      // e4a9d9ad comptait toute frappe comme une saisie, même ramenée à sa valeur ; corrigé par 908d05e5
      // (valeurs affichées comparées à celles du clic sur « Activer le formulaire »)
      await openActivatedFile(page);
      const before = await birth(page).inputValue();
      await test.step('Date de naissance modifiée puis remise à sa valeur', async () => {
        await birth(page).fill('1985-04-05' === before ? '1986-04-05' : '1985-04-05');
        await birth(page).fill(before);
        await expect(birth(page)).toHaveValue(before);
      });
      await leaveWithoutPopup(page);
    });

    test('Actualiser au clavier (F5 / Ctrl+R) une fiche modifiée : popup de l\'application, pas le message du navigateur', async ({ page }) => {
      const { saved } = await openActivatedFile(page);
      const typed = `non.enregistre${Date.now() % 1000000}@example.com`;
      await email(page).fill(typed);
      const dialog = new UnsavedDialog(page);
      let nativeWarnings = 0;
      page.on('dialog', d => { if (d.type() === 'beforeunload') nativeWarnings++; });
      await test.step('F5 : popup « Actualiser la page ? »', async () => {
        await email(page).press('F5');
        await dialog.expectOpen(/ACTUALISER LA PAGE/, /gardées en brouillon sur ce poste/);
      });
      await test.step('« Rester sur la page » : saisie intacte', async () => {
        await dialog.answer(/Rester sur la page/);
        await expect(email(page)).toHaveValue(typed);
      });
      await test.step('Ctrl+R puis « Actualiser quand même » : page rechargée sans second message du navigateur', async () => {
        await email(page).press('Control+r');
        await dialog.expectOpen(/ACTUALISER LA PAGE/);
        await Promise.all([page.waitForEvent('load'), dialog.root.getByRole('button', { name: /Actualiser (quand même|sans sauvegarder)/ }).click()]);
        await new DetailPatientPage(page).checkIfPageLoad();
        await expect(birth(page), 'Fiche rechargée').not.toHaveValue('', { timeout: 15000 });
        await expect(email(page), "Email saisi non enregistré").toHaveValue(saved);
        expect(nativeWarnings, 'Message natif « Quitter le site ? » du navigateur').toBe(0);
      });
    });

    test("Fenêtre « Ajouter personne à contacter » : fermeture confirmée seulement après une saisie", async ({ page }) => {
      await createTestPatient(page, true);
      const detail = new DetailPatientPage(page);
      const dialog = new UnsavedDialog(page);
      const modal = page.locator('.modal.show').filter({ has: page.getByRole('heading', { name: 'Ajouter personne à contacter' }) });
      const firstName = page.locator('#ctfirstName');
      await detail.goToPersonContactTab();
      await test.step('Sans saisie : « Fermer » ferme la fenêtre directement', async () => {
        await detail.openAddPersonModal();
        await modal.getByRole('button', { name: 'Fermer' }).click();
        await expect(modal).toBeHidden();
        await dialog.expectClosed();
      });
      await test.step('Après saisie, « Fermer » : popup « Saisie non enregistrée »', async () => {
        await detail.openAddPersonModal();
        await firstName.fill('Contact non enregistré');
        await modal.getByRole('button', { name: 'Fermer' }).click();
        await dialog.expectOpen(/SAISIE NON ENREGISTRÉE/, /gardées en brouillon sur ce poste/);
      });
      await test.step('« Revenir à la saisie » : fenêtre toujours ouverte, saisie intacte', async () => {
        await dialog.answer(/Revenir à la saisie/);
        await expect(modal).toBeVisible();
        await expect(firstName).toHaveValue('Contact non enregistré');
      });
      await test.step('Échap : même popup', async () => {
        await firstName.press('Escape');
        await dialog.expectOpen(/SAISIE NON ENREGISTRÉE/);
        await dialog.answer(/Revenir à la saisie/);
        await expect(modal).toBeVisible();
      });
      await test.step('Croix puis « Fermer sans enregistrer » : fenêtre fermée, aucune personne ajoutée', async () => {
        await modal.locator('button.close').click();
        await dialog.expectOpen(/SAISIE NON ENREGISTRÉE/);
        await dialog.answer(/Fermer sans enregistrer/);
        await expect(modal).toBeHidden();
        await expect(page.getByRole('tabpanel', { name: 'Personne à contacter' }).getByText('Aucun enregistrement')).toBeVisible();
      });
    });
  });

  // ======================================================================
  // Personnes à contacter
  // ======================================================================
  test.describe('Personnes à contacter', () => {
    let contact: ContactPersonData;

    test.beforeEach(async ({ page }) => {
      const detailPatientPage = new DetailPatientPage(page);
      // Test d'anomalie : personne née avant 1970 ; sinon date aléatoire après 1970
      contact = ContactPersonGenerator.generate(/avant 1970/.test(test.info().title) ? { dob: '1958-03-14' } : {});
      await createTestPatient(page, true);
      await test.step('Ajouter une personne à contacter', async () => {
        await detailPatientPage.goToPersonContactTab();
        await detailPatientPage.openAddPersonModal();
        await detailPatientPage.fillPersonContactForm(contact);
        await detailPatientPage.savePersonContact();
      });
    });

    /** Recharge la fiche et rouvre l'onglet : les données relues viennent du serveur. */
    async function reloadContacts(page: Page) {
      await page.reload();
      const detail = new DetailPatientPage(page);
      await detail.checkIfPageLoad();
      await detail.goToPersonContactTab();
      return detail;
    }

    test('Ajouter une personne à contacter : tous les champs enregistrés', async ({ page }) => {
      const detail = await reloadContacts(page);
      await test.step('Liste : prénom, nom, téléphones et lien', () => detail.expectContactRow(contact));
      await test.step('Détail : chaque champ saisi est restitué', () => detail.expectContactDetails(contact));
    });

    test('Modifier une personne à contacter (région et nationalité) : modification conservée', async ({ page }) => {
      await new DetailPatientPage(page).modifyFirstContactPerson('50', '32');
      const detail = await reloadContacts(page);
      // Région et nationalité modifiées, les autres champs inchangés
      await detail.expectContactDetails({ ...contact, region: '50', nationality: '32' });
    });

    test('Supprimer une personne à contacter : retirée de la liste, même après rechargement', async ({ page }) => {
      const detail = new DetailPatientPage(page);
      expect(await detail.contactCount(), 'Une personne avant suppression').toBe(1);
      await detail.deleteFirstContactPerson();
      const panel = page.getByRole('tabpanel', { name: 'Personne à contacter' });
      await expect(panel.getByText('Aucun enregistrement'), 'Liste vide').toBeVisible({ timeout: 15000 });
      await reloadContacts(page);
      expect(await detail.contactCount(), 'Toujours supprimée après rechargement').toBe(0);
    });

    test("Une personne à contacter née avant 1970 : sa date de naissance est affichée", async ({ page }) => {
      // Date antérieure à 1970 = horodatage négatif : affichée vide tant que le frontend exigeait doB > 0
      // (corrigé par 908d05e5 ; une modification aurait renvoyé une date vide).
      const detail = await reloadContacts(page);
      await detail.expectContactDetails(contact);
    });
  });

  // ======================================================================
  // Prises en charge
  // ======================================================================
  test.describe('Prises en charge', () => {
    let insurerName = '';
    let careData: CareData;

    /** Recharge la fiche et rouvre l'onglet : la liste relue vient du serveur. */
    async function reloadCovers(page: Page) {
      await page.reload();
      await new DetailPatientPage(page).checkIfPageLoad();
      const carePage = new PatientCarePage(page);
      await carePage.goToCareTab();
      return carePage;
    }

    test.beforeEach(async ({ page }) => {
      const carePage = new PatientCarePage(page);
      careData = CareDataGenerator.generate();
      await createTestPatient(page, true);
      await test.step('Ajouter une prise en charge', async () => {
        await carePage.goToCareTab();
        await carePage.openAddCareModal();
        // Assureur réellement choisi (repli sur un assureur de la structure si celui généré n'existe pas)
        await carePage.fillCareForm(careData);
        insurerName = careData.insurerName;
        await carePage.saveCare();
      });
    });

    test('Ajouter une prise en charge : chaque valeur saisie est enregistrée', async ({ page }) => {
      await expect(page.locator('#pills-prise-en-charge-fill tbody tr').filter({ hasText: insurerName }).first()).toBeVisible();
      const carePage = await reloadCovers(page);
      await carePage.expectCoverRow(careData);
    });

    test('Modifier une prise en charge : assureur et date de fin conservés, le reste inchangé', async ({ page }) => {
      // Date de fin future (une date passée est aussi acceptée depuis le 2026-11-18 : prise en charge expirée saisie a posteriori)
      const newEndingDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const chosen = await new PatientCarePage(page).modifyFirstCare('AFRIC MANAGEMENT (IPM)', newEndingDate);
      const carePage = await reloadCovers(page);
      await carePage.expectCoverRow({ ...careData, insurerName: chosen, endingDate: newEndingDate });
    });

    test("Une prise en charge expirée (date de fin passée) est acceptée", async ({ page }) => {
      // Saisie a posteriori d'une prise en charge expirée, permise depuis le 2026-11-18
      const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
      const expired: CareData = { ...CareDataGenerator.generate(), startingDate: day(-90), endingDate: day(-10) };
      const carePage = new PatientCarePage(page);
      // Seule prise en charge du patient : pas de chevauchement avec celle du beforeEach
      await carePage.removeAllCovers();
      await carePage.openAddCareModal();
      await carePage.fillCareForm(expired);
      await carePage.saveCare();
      await expect(page.getByText(/date de fin doit être supérieure à la date d'aujourd'hui/i)).toHaveCount(0);
      const reloaded = await reloadCovers(page);
      await reloaded.expectCoverRow(expired);
    });

    test("Voir les détails d'une prise en charge", async ({ page }) => {
      const carePage = new PatientCarePage(page);
      await carePage.viewFirstCareDetails();
      await carePage.closeViewModal();
    });

    test('Supprimer une prise en charge : retirée de la liste, même après rechargement', async ({ page }) => {
      const rows = page.locator('#pills-prise-en-charge-fill tbody tr').filter({ has: page.getByRole('button', { name: 'Action' }) });
      await expect(rows).toHaveCount(1);
      await new PatientCarePage(page).deleteFirstCare();
      await expect(rows).toHaveCount(0, { timeout: 15000 });
      await reloadCovers(page);
      await expect(rows, 'Toujours supprimée après rechargement').toHaveCount(0);
    });
  });

  // ======================================================================
  // Raccourcis vers la facturation
  // ======================================================================
  test.describe('Raccourcis de facturation', () => {
    test.skip(!hasModule('Facturation'), withoutModuleReason('Facturation'));
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
