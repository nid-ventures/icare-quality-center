import { type Page } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { AccountListPage } from '../../pages/structure/account/account-list.page';
import { AccountCreateUpdatePage } from '../../pages/structure/account/account-create-update.page';
import { AccountUpdatePwdPage } from '../../pages/structure/account/account-update-pwd.page';
import { MyConfigurationPage } from '../../pages/structure/my-space/configuration.page';
import { AccountDataGenerator } from '../../pages/structure/generator/account-data-generator';
import { adminUser } from '../../test-data/structure-users';
import { GarantPage } from '../../pages/structure/my-space/garant.page';
import { PortalPage } from '../../pages/structure/portal/portal.page';
import { PatientPage } from '../../pages/structure/patient/patient.page';
import { PatientCarePage } from '../../pages/structure/patient/patient-care.page';
import { createDossierPatient, DOSSIER_SETUP_TIMEOUT, type DossierPatient } from '../../fixtures/dossier-patient';

// Libellé réel du rôle non-soignant dans le sélecteur de rôles
const NON_CAREGIVER_ROLE = 'HI-ADMINISTRATOR';

/** Crée un utilisateur dédié au test et le retrouve dans la liste ; renvoie ses données. */
async function createUser(page: Page) {
  const listPage = new AccountListPage(page);
  const createPage = new AccountCreateUpdatePage(page, 'create');
  const data = AccountDataGenerator.generate();
  await test.step(`Créer l'utilisateur ${data.login}`, async () => {
    await listPage.openCreateModal();
    await createPage.expectOpen();
    await createPage.fillCreationForm(data, NON_CAREGIVER_ROLE);
    await createPage.save();
    await listPage.expectListLoaded();
    await listPage.searchByLogin(data.login);
    await listPage.expectUserInList(data.login);
  });
  return data;
}

test.describe('Module Administration', () => {

  test.beforeEach(async ({ portal, page }) => {
    await portal.enterModule('Administration');
    await page.waitForURL('**/my-space/configuration');
  });

  // ======================================================================
  // Utilisateurs
  // ======================================================================
  test.describe('Utilisateurs', () => {
    test.beforeEach(async ({ page }) => {
      const listPage = new AccountListPage(page);
      await listPage.goto();
      await listPage.expectListLoaded();
    });

    test('Rechercher un utilisateur par login puis réinitialiser', async ({ page }) => {
      const listPage = new AccountListPage(page);
      await listPage.searchByLogin(adminUser.username);
      await listPage.expectUserInList(adminUser.username);
      await listPage.resetSearch();
    });

    test('Créer un utilisateur avec un rôle non-soignant', async ({ page }) => {
      await createUser(page);
    });

    test('Modifier le prénom et le nom d\'un utilisateur', async ({ page }) => {
      const listPage = new AccountListPage(page);
      const updatePage = new AccountCreateUpdatePage(page, 'update');
      const user = await createUser(page);
      const updated = AccountDataGenerator.generate();

      await test.step('Modifier l\'identité', async () => {
        await listPage.openUpdateModal(user.login);
        await updatePage.expectOpen();
        await updatePage.fillIdentity({ firstName: updated.firstName, lastName: updated.lastName });
        await updatePage.save();
      });

      await test.step('Vérifier la mise à jour dans la liste', async () => {
        await listPage.searchByLogin(user.login);
        const row = listPage.getRowByLogin(user.login);
        await expect(row).toContainText(updated.lastName);
        await expect(row).toContainText(updated.firstName);
      });
    });

    test("Changer le mot de passe d'un utilisateur", async ({ page }) => {
      const listPage = new AccountListPage(page);
      const pwdPage = new AccountUpdatePwdPage(page);
      const user = await createUser(page);

      await listPage.openPasswordModal(user.login);
      await pwdPage.expectOpen();
      await pwdPage.fillPasswords(AccountDataGenerator.generate().password);
      await pwdPage.save();
      await pwdPage.expectSuccessMessage();
    });

    test("Activer / désactiver un utilisateur", async ({ page }) => {
      const listPage = new AccountListPage(page);
      const user = await createUser(page);
      const etatInitial = await listPage.getEtatText(user.login);

      await test.step("Désactiver l'utilisateur", async () => {
        await listPage.toggleState(user.login);
      });

      await test.step('Le retrouver avec le filtre État = "Désactive"', async () => {
        await listPage.searchByLoginAndState(user.login, 'Désactive');
        await listPage.expectUserInList(user.login);
        expect(await listPage.getEtatText(user.login)).not.toBe(etatInitial);
      });

      await test.step("Le réactiver et le retrouver avec le filtre État = \"Active\"", async () => {
        await listPage.toggleState(user.login);
        await listPage.searchByLoginAndState(user.login, 'Active');
        await listPage.expectUserInList(user.login);
        expect(await listPage.getEtatText(user.login)).toBe(etatInitial);
      });
    });
  });

  // ======================================================================
  // Paramètres de la structure
  // ======================================================================
  test.describe('Paramètres', () => {
    test("Afficher toutes les rubriques de l'espace paramétrage", async ({ page }) => {
      const configPage = new MyConfigurationPage(page);
      await configPage.expectLoaded();
      await configPage.expectSectionsVisible([
        'Détails de la structure',
        'Modules de la structure',
        'Modules & Privilèges',
        'Configuration de consentement',
        'Configuration de facture',
        'Garants',
        'Actes',
        'Rémunération médecin',
        'Parcours de soins',
      ]);
    });

    test('Modifier les détails de la structure puis annuler', async ({ page }) => {
      const configPage = new MyConfigurationPage(page);
      await configPage.expectLoaded();
      await configPage.openDetailsSection();
      let originalName = '';

      await test.step('Activer le formulaire et modifier le nom', async () => {
        await configPage.enableHiDetailsForm();
        originalName = await configPage.getHiDetailsName();
        await configPage.fillHiDetailsName(`${originalName} QA`);
        await configPage.ensureHiDetailsEmailFilled('qa-structure@icaresenegal.com');
      });

      await test.step('Enregistrer : la confirmation apparaît, on l\'annule', async () => {
        await configPage.saveHiDetailsAndExpectConfirmation();
        await configPage.dismissWarningModal();
      });

      await test.step("Annuler l'édition : le nom d'origine est restauré", async () => {
        await configPage.cancelHiDetailsEdit();
        expect(await configPage.getHiDetailsName()).toBe(originalName);
        await configPage.closeDetailsSection();
      });
    });

    test('Modifier la configuration de facture puis annuler', async ({ page }) => {
      const configPage = new MyConfigurationPage(page);
      await configPage.expectLoaded();
      await configPage.openInvoiceSection();
      let originalFooter = '';

      await test.step("Activer la modification et changer l'en-tête / le pied de page", async () => {
        await configPage.enableInvoiceForm();
        originalFooter = await configPage.getInvoiceFooter();
        await configPage.fillInvoiceHeaderAndFooter('En-tête QA', 'Pied de page QA');
      });

      await test.step('Enregistrer : la confirmation apparaît, on l\'annule', async () => {
        await configPage.saveInvoiceAndExpectConfirmation();
        await configPage.dismissWarningModal();
      });

      await test.step("Annuler l'édition : le pied de page d'origine est restauré", async () => {
        await configPage.cancelInvoiceEdit();
        expect(await configPage.getInvoiceFooter()).toBe(originalFooter);
        await configPage.closeInvoiceSection();
      });
    });

    // La configuration des modules est conservée dans le navigateur (par structure) : le test
    // s'exécute dans un contexte isolé et ne modifie donc pas la configuration réelle.
    test('Désactiver puis réactiver un module de la structure', async ({ page, portal }) => {
      const configPage = new MyConfigurationPage(page);
      await configPage.openSection('Modules de la structure');

      await test.step('Le module Administration est toujours actif', async () => {
        await configPage.expectModuleAlwaysActive('Administration');
      });

      await test.step('Désactiver le module Rendez-vous : il disparaît du portail', async () => {
        await configPage.setModuleEnabled('Rendez-vous', false);
        await portal.goto();
        await expect(portal.moduleCard('Rendez-vous')).toHaveCount(0);
      });

      await test.step('Réactiver le module Rendez-vous : il réapparaît', async () => {
        await portal.enterModule('Administration');
        await configPage.openSection('Modules de la structure');
        await configPage.setModuleEnabled('Rendez-vous', true);
        await portal.goto();
        await expect(portal.moduleCard('Rendez-vous')).toBeVisible();
      });
    });
  });

  // ======================================================================
  // Garants (assureurs et IPM de la structure)
  // ======================================================================
  test.describe('Garants', () => {
    // Un assureur pas encore garant de la structure est ajouté ; un patient dédié sert à vérifier
    // les assureurs proposés dans sa prise en charge (garants actifs).
    test.describe.configure({ mode: 'serial' });
    let patient: DossierPatient;
    let insurer = '';
    let spareInsurer = '';
    const CONTACT = { contact: 'Awa QA Garant', phone: '771234567', email: 'garant.qa@example.com' };
    const digits = (text: string) => text.replace(/\D/g, '');

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(DOSSIER_SETUP_TIMEOUT);
      patient = await createDossierPatient(browser);
    });

    async function openGarants(page: Page) {
      const garants = new GarantPage(page);
      await garants.open();
      return garants;
    }

    /** Assureurs proposés dans "Ajouter prise en charge" pour le patient dédié. */
    async function patientInsurers(page: Page): Promise<string[]> {
      await new PortalPage(page).enterModule('Base patients');
      const patientPage = new PatientPage(page);
      await patientPage.searchByName(patient.firstName, patient.lastName);
      await patientPage.openPatient(patient.lastName);
      await page.waitForURL('**/patient/patient-info-administration/**');
      const care = new PatientCarePage(page);
      await care.goToCareTab();
      return (await care.proposedInsurers()).map(n => n.toUpperCase());
    }

    test("Choisir deux assureurs qui ne sont pas encore garants de la structure", async ({ page }) => {
      const garants = await openGarants(page);
      const proposed = (await garants.proposedInsurers()).filter(n => !/^Sélectionnez$/i.test(n));
      expect(proposed.length, 'Assureurs proposés').toBeGreaterThan(0);
      const free: string[] = [];
      for (const candidate of [...proposed].reverse()) {
        await garants.search({ assureur: candidate });
        if ((await garants.rows()).length === 0) free.push(candidate);
        if (free.length === 2) break;
      }
      expect(free.length, 'Deux assureurs libres').toBe(2);
      [insurer, spareInsurer] = free;
    });

    test('Ajouter un garant sans assureur est refusé', async ({ page }) => {
      const garants = await openGarants(page);
      await garants.openNew();
      await garants.save();
      await expect(garants.form.getByText("L'assurance est obligatoire")).toBeVisible();
      await expect(garants.form, 'Fenêtre toujours ouverte').toBeVisible();
      await garants.close();
    });

    test('Un email de contact invalide est refusé', async ({ page }) => {
      const garants = await openGarants(page);
      await garants.openNew();
      await garants.fill(insurer, { email: 'pas-un-email' });
      await garants.save();
      await expect(garants.form.getByText("L'email n'est pas conforme")).toBeVisible();
      await garants.close();
      await garants.search({ assureur: insurer });
      expect(await garants.rows(), 'Aucun garant créé').toHaveLength(0);
    });

    test('Un téléphone de contact invalide est refusé', async ({ page }) => {
      const garants = await openGarants(page);
      try {
        await garants.openNew();
        await garants.fill(spareInsurer, { contact: 'Contact QA', phone: '12' });
        await expect(garants.form.getByText("Le numéro de téléphone n'est pas valide"), 'Message affiché').toBeVisible();
        await garants.save();
        await expect(garants.form, 'Enregistrement bloqué : fenêtre toujours ouverte').toBeVisible({ timeout: 5000 });
        await garants.close();
        await garants.search({ assureur: spareInsurer });
        expect(await garants.rows(), 'Aucun garant créé avec un téléphone invalide').toHaveLength(0);
      } finally {
        // Si l'application l'a enregistré malgré tout, on le désactive pour ne pas laisser de garant de test actif
        await garants.search({ assureur: spareInsurer });
        if ((await garants.rows()).some(r => /^Active$/i.test(r.statut))) await garants.toggle(spareInsurer);
      }
    });

    test('Ajouter un garant avec tous les champs', async ({ page }) => {
      const garants = await openGarants(page);
      await garants.openNew();
      await garants.fill(insurer, CONTACT);
      expect(await garants.save(), "Message de l'application").toMatch(/enregistrement a\s+r[ée]ussi/i);
      await garants.search({ assureur: insurer });
      const [row] = await garants.rows();
      expect(row, 'Garant listé').toBeDefined();
      expect.soft(row.nom.toUpperCase()).toBe(insurer.toUpperCase());
      expect.soft(row.type, 'Type repris de l\'assureur').toBe(/\(IPM\)$/i.test(insurer) ? 'IPM' : 'ASSURANCE');
      expect.soft(row.contact).toBe(CONTACT.contact);
      expect.soft(digits(row.telephone)).toContain(CONTACT.phone);
      expect.soft(row.email).toBe(CONTACT.email);
      expect.soft(row.statut).toBe('Active');
    });

    test('Filtrer les garants par type et par état', async ({ page }) => {
      const garants = await openGarants(page);
      const type = /\(IPM\)$/i.test(insurer) ? 'IPM' : 'ASSURANCE';
      await garants.search({ type });
      const byType = await garants.rows();
      expect(byType.length).toBeGreaterThan(0);
      expect.soft(byType.every(r => r.type === type), `Uniquement des garants ${type}`).toBe(true);
      for (const [etat, statut] of [['Actif', 'Active'], ['Inactif', 'Désactive']] as const) {
        await garants.search({ etat });
        expect.soft((await garants.rows()).every(r => r.statut === statut), `Filtre "${etat}"`).toBe(true);
      }
    });

    test("Le nouveau garant est proposé dans la prise en charge d'un patient", async ({ page }) => {
      expect(await patientInsurers(page)).toContain(insurer.toUpperCase());
    });

    test('Modifier la personne à contacter du garant', async ({ page }) => {
      const updated = { contact: 'Awa QA Modifiée', phone: '781234567', email: 'garant.qa2@example.com' };
      const garants = await openGarants(page);
      await garants.search({ assureur: insurer });
      await garants.openEdit(insurer);
      await garants.fill(undefined, updated);
      expect(await garants.save(), "Message de l'application").toMatch(/modification a\s+r[ée]ussi/i);
      await garants.search({ assureur: insurer });
      const [row] = await garants.rows();
      expect.soft(row.contact).toBe(updated.contact);
      expect.soft(digits(row.telephone)).toContain(updated.phone);
      expect.soft(row.email).toBe(updated.email);
    });

    test("Un assureur déjà garant de la structure n'est plus proposé à l'ajout (pas de doublon)", async ({ page }) => {
      const garants = await openGarants(page);
      const proposed = (await garants.proposedInsurers()).map(n => n.toUpperCase());
      expect(proposed, 'Assureur déjà garant non proposé').not.toContain(insurer.toUpperCase());
      await garants.search({ assureur: insurer });
      expect(await garants.rows(), 'Un seul garant pour cet assureur').toHaveLength(1);
    });

    test("Désactiver un garant non utilisé : il n'est plus proposé, puis le réactiver", async ({ page }) => {
      let garants = await openGarants(page);
      await garants.search({ assureur: insurer });
      expect(await garants.toggle(insurer)).toMatch(/r[ée]ussi/i);
      // Un garant désactivé n'est listé qu'avec l'état "Inactif"
      await garants.search({ assureur: insurer, etat: 'Inactif' });
      expect((await garants.rows())[0]?.statut, 'Garant désactivé').toBe('Désactive');
      expect(await patientInsurers(page), 'Plus proposé dans la prise en charge').not.toContain(insurer.toUpperCase());

      await new PortalPage(page).enterModule('Administration');
      garants = await openGarants(page);
      await garants.search({ assureur: insurer, etat: 'Inactif' });
      expect(await garants.toggle(insurer)).toMatch(/r[ée]ussi/i);
      await garants.search({ assureur: insurer, etat: 'Actif' });
      expect((await garants.rows())[0]?.statut, 'Garant réactivé').toBe('Active');
      expect(await patientInsurers(page), 'De nouveau proposé').toContain(insurer.toUpperCase());
    });

    test('Un garant utilisé par une prise en charge ne peut pas être désactivé', async ({ page }) => {
      await test.step(`Prise en charge du patient par ${insurer}`, async () => {
        await new PortalPage(page).enterModule('Base patients');
        const patientPage = new PatientPage(page);
        await patientPage.searchByName(patient.firstName, patient.lastName);
        await patientPage.openPatient(patient.lastName);
        await page.waitForURL('**/patient/patient-info-administration/**');
        const care = new PatientCarePage(page);
        await care.goToCareTab();
        await care.addCover({ insurer, rate: 50 });
      });
      await new PortalPage(page).enterModule('Administration');
      const garants = await openGarants(page);
      await garants.search({ assureur: insurer });
      expect(await garants.toggle(insurer), 'Refus').toMatch(/encours d.utilisation/i);
      await garants.search({ assureur: insurer });
      expect((await garants.rows())[0]?.statut, 'Garant toujours actif').toBe('Active');
    });
  });
});
