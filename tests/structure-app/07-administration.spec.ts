import { type Page } from '@playwright/test';
import fs from 'fs';
import { test, expect } from '../../fixtures/structure.fixture';
import { AccountListPage } from '../../pages/structure/account/account-list.page';
import { AccountCreateUpdatePage } from '../../pages/structure/account/account-create-update.page';
import { AccountUpdatePwdPage } from '../../pages/structure/account/account-update-pwd.page';
import { MyConfigurationPage } from '../../pages/structure/my-space/configuration.page';
import { AccountDataGenerator } from '../../pages/structure/generator/account-data-generator';
import { adminUser } from '../../test-data/structure-users';
import { GarantPage } from '../../pages/structure/my-space/garant.page';
import { BillableActConfigPage, normalizeLabel, accentInsensitive } from '../../pages/structure/my-space/billable-act-config.page';
import { RemunerationProfilePage } from '../../pages/structure/my-space/remuneration-profile.page';
import { ConsentConfigPage } from '../../pages/structure/my-space/consent-config.page';
import { BillingInvoicePage } from '../../pages/structure/billing/billing-invoice.page';
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

  // ======================================================================
  // Actes (catalogue facturable de la structure)
  // ======================================================================
  test.describe('Actes', () => {
    // Un acte du référentiel pas encore présent dans la structure est ajouté pour une spécialité ;
    // un patient dédié sert à vérifier les actes proposés en facturation.
    test.describe.configure({ mode: 'serial' });
    let patient: DossierPatient;
    let speciality = '';
    let otherSpeciality = '';
    let act = '';
    let listed = { nom: '', type: '' };

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(DOSSIER_SETUP_TIMEOUT);
      patient = await createDossierPatient(browser);
    });

    async function openActs(page: Page) {
      const acts = new BillableActConfigPage(page);
      await acts.open();
      return acts;
    }

    /** Actes proposés en facturation pour la catégorie donnée (fenêtre "Ajouter un acte", sans enregistrer). */
    async function billingActs(page: Page, category: string): Promise<string[]> {
      return (await openBilling(page).then(invoice => invoice.proposedActs(category))).map(a => a.toUpperCase());
    }

    /** Facturation du patient dédié, référentiels de session rechargés (actes de la structure). */
    async function openBilling(page: Page): Promise<BillingInvoicePage> {
      await new PortalPage(page).enterModule('Facturation');
      await page.waitForURL('**/billing/billings-create');
      const loaded = page.waitForResponse(r => r.url().includes('/modules/loadconfigs'), { timeout: 30000 });
      await page.reload();
      await loaded;
      const invoice = new BillingInvoicePage(page);
      await invoice.searchPatientByIdentifier(patient.identifier);
      await invoice.selectFirstSearchResult();
      return invoice;
    }

    test('Choisir une spécialité dont un acte du référentiel n\'est pas encore dans la structure', async ({ page }) => {
      const acts = await openActs(page);
      await acts.openNew();
      // Spécialités du soignant connecté d'abord, puis "toutes les spécialités", puis les autres :
      // chaque passage consomme un acte du référentiel (un acte ajouté ne peut pas être supprimé).
      // Si l'acte n'est pas d'une spécialité du soignant, il est ensuite étendu à toutes les
      // spécialités pour être proposé en facturation.
      const mine = (await acts.userSpecialities()).map(s => s.toLowerCase());
      const isAll = (s: string) => /^toutes les sp/i.test(normalizeLabel(s));
      const rank = (s: string) => mine.includes(s.toLowerCase()) ? 0 : isAll(s) ? 1 : 2;
      const specialities = (await acts.specialities()).filter(Boolean).sort((a, b) => rank(a) - rank(b));
      for (const candidate of specialities) {
        const proposed = await acts.chooseSpeciality(candidate);
        if (proposed.length > 0 && !speciality) { speciality = candidate; act = proposed[0]; }
        else if (speciality && !otherSpeciality && candidate !== speciality && !isAll(candidate)) otherSpeciality = candidate;
        if (speciality && otherSpeciality) break;
      }
      await acts.close();
      expect(speciality, 'Une spécialité avec un acte libre').toBeTruthy();
      expect(otherSpeciality, 'Une seconde spécialité').toBeTruthy();
    });

    test('Ajouter un acte sans spécialité ni acte est refusé', async ({ page }) => {
      const acts = await openActs(page);
      await acts.openNew();
      await acts.save();
      await expect(acts.modal.getByText('La spécialité est obligatoire')).toBeVisible();
      await expect(acts.modal.getByText('Au moins un acte est obligatoire')).toBeVisible();
      await acts.close();
    });

    test(`Ajouter un acte à la structure`, async ({ page }) => {
      const acts = await openActs(page);
      await acts.openNew();
      await acts.chooseSpeciality(speciality);
      await acts.chooseAct(act);
      expect(await acts.save(), "Message de l'application").toMatch(/enregistrement a\s+r[ée]ussi/i);
      await acts.search({ specialite: speciality });
      const row = (await acts.rows()).find(r => act.toUpperCase().includes(r.nom) || r.nom.includes(act.toUpperCase()));
      expect(row, `Acte "${act}" listé`).toBeDefined();
      expect.soft(normalizeLabel(row!.specialite)).toContain(normalizeLabel(speciality));
      expect.soft(row!.statut).toBe('Actif');
      listed = { nom: row!.nom, type: row!.type };
    });

    test("Un acte déjà dans la structure n'est plus proposé à l'ajout", async ({ page }) => {
      const acts = await openActs(page);
      await acts.openNew();
      expect((await acts.chooseSpeciality(speciality)).map(a => a.toUpperCase()), 'Acte non proposé une seconde fois').not.toContain(act.toUpperCase());
      await acts.close();
    });

    test('Filtrer les actes par nom, spécialité et état', async ({ page }) => {
      const acts = await openActs(page);
      await acts.search({ nom: listed.nom });
      expect.soft((await acts.rows()).map(r => r.nom), 'Par nom').toContain(listed.nom);
      await acts.search({ specialite: speciality });
      expect.soft((await acts.rows()).every(r => normalizeLabel(r.specialite).includes(normalizeLabel(speciality))), 'Par spécialité').toBe(true);
      for (const [etat, statut] of [['Actif', 'Actif'], ['Inactif', 'Inactif']] as const) {
        await acts.search({ etat });
        expect.soft((await acts.rows()).every(r => r.statut === statut), `Filtre "${etat}"`).toBe(true);
      }
    });

    test("Ajouter une seconde spécialité à l'acte", async ({ page }) => {
      const acts = await openActs(page);
      await acts.search({ nom: listed.nom });
      await acts.openEdit(listed.nom);
      await acts.addSpeciality(otherSpeciality);
      expect(await acts.save(), "Message de l'application").toMatch(/modification a\s+r[ée]ussi/i);
      await acts.search({ nom: listed.nom });
      const row = (await acts.rows()).find(r => r.nom === listed.nom);
      const shown = normalizeLabel(row?.specialite ?? '');
      if (/^TOUTES LES SP/.test(normalizeLabel(speciality))) {
        // "Toutes les spécialités" couvre déjà les autres : l'application ramène la liste à elle seule
        expect.soft(shown, 'Reste "toutes les spécialités"').toBe(normalizeLabel(speciality));
      } else {
        expect.soft(shown).toContain(normalizeLabel(speciality));
        expect.soft(shown).toContain(normalizeLabel(otherSpeciality));
      }
    });

    test("Étendre l'acte à toutes les spécialités : la liste est ramenée à « toutes »", async ({ page }) => {
      const acts = await openActs(page);
      await acts.search({ nom: listed.nom });
      const before = normalizeLabel((await acts.rows()).find(r => r.nom === listed.nom)?.specialite ?? '');
      if (!/^TOUTES LES SP/.test(before)) {
        await acts.openEdit(listed.nom);
        await acts.addSpeciality('TOUTES LES SPECIALITES');
        expect(await acts.save(), "Message de l'application").toMatch(/modification a\s+r[ée]ussi/i);
        await acts.search({ nom: listed.nom });
      }
      const row = (await acts.rows()).find(r => r.nom === listed.nom);
      expect(normalizeLabel(row?.specialite ?? ''), 'Toutes les spécialités seule').toBe('TOUTES LES SPECIALITES');
    });

    test("Modifier un acte en retirant toutes ses spécialités est refusé", async ({ page }) => {
      const acts = await openActs(page);
      await acts.search({ nom: listed.nom });
      await acts.openEdit(listed.nom);
      await acts.modal.locator('[formcontrolname="specialities"] .ng-clear-wrapper').click();
      await acts.save();
      await expect(acts.modal.getByText('Au moins une spécialité est obligatoire')).toBeVisible();
      await acts.close();
    });

    test("L'acte ajouté est proposé en facturation", async ({ page }) => {
      expect(await billingActs(page, listed.type)).toContain(listed.nom);
    });

    test("Désactiver un acte non utilisé : il n'est plus proposé en facturation, puis le réactiver", async ({ page }) => {
      let acts = await openActs(page);
      await acts.search({ nom: listed.nom });
      expect(await acts.toggle(listed.nom)).toMatch(/réussi/i);
      await acts.search({ nom: listed.nom, etat: 'Inactif' });
      expect((await acts.rows())[0]?.statut, 'Acte désactivé').toBe('Inactif');
      expect(await billingActs(page, listed.type), 'Plus proposé en facturation').not.toContain(listed.nom);

      await new PortalPage(page).enterModule('Administration');
      acts = await openActs(page);
      await acts.search({ nom: listed.nom, etat: 'Inactif' });
      expect(await acts.toggle(listed.nom)).toMatch(/réussi/i);
      await acts.search({ nom: listed.nom, etat: 'Actif' });
      expect((await acts.rows())[0]?.statut, 'Acte réactivé').toBe('Actif');
      expect(await billingActs(page, listed.type), 'De nouveau proposé').toContain(listed.nom);
    });

    /** Bascule l'état de l'acte depuis Administration › Actes ; renvoie le message et le statut affiché ensuite. */
    async function toggleListed(page: Page, from: 'Actif' | 'Inactif') {
      await new PortalPage(page).enterModule('Administration');
      const acts = await openActs(page);
      await acts.search({ nom: listed.nom, etat: from });
      const message = await acts.toggle(listed.nom);
      const statuses = async (etat: 'Actif' | 'Inactif') => {
        await acts.search({ nom: listed.nom, etat });
        return (await acts.rows()).some(r => r.nom === listed.nom);
      };
      return { message, statut: await statuses('Actif') ? 'Actif' : await statuses('Inactif') ? 'Inactif' : '' };
    }

    // Règle du backend : un acte ne peut pas être désactivé tant qu'il reste des actes à facturer
    // (non facturés) ; un acte déjà facturé ne bloque pas. La réactivation doit toujours être possible.
    test("Un acte en attente de facturation ne peut pas être désactivé ; une fois facturé, il peut l'être", async ({ page }) => {
      await test.step(`Ajouter "${listed.nom}" aux actes à facturer du patient, sans facturer`, async () => {
        const invoice = await openBilling(page);
        await invoice.addAct({ category: listed.type, act: listed.nom });
      });
      await test.step("Désactivation refusée : acte en cours d'utilisation", async () => {
        const { message, statut } = await toggleListed(page, 'Actif');
        expect(message).toMatch(/en cours d.utilisation/i);
        expect(statut, 'Toujours actif').toBe('Actif');
      });
      await test.step(`Facturer "${listed.nom}" (5000, sans prise en charge)`, async () => {
        const invoice = await openBilling(page);
        await invoice.setActAmount(listed.nom, 5000);
        await invoice.proceedToBilling();
        await invoice.generateInvoice();
      });
      await test.step('Acte facturé : la désactivation est acceptée', async () => {
        const { message, statut } = await toggleListed(page, 'Actif');
        expect(message).toMatch(/réussi/i);
        expect(statut, 'Désactivé').toBe('Inactif');
      });
      await test.step('La réactivation est acceptée', async () => {
        const { message, statut } = await toggleListed(page, 'Inactif');
        expect(message).toMatch(/réussi/i);
        expect(statut, 'Réactivé').toBe('Actif');
      });
    });
  });

  // ======================================================================
  // Rémunération médecin (profils de rémunération par acte)
  // ======================================================================
  test.describe('Rémunération médecin', () => {
    // Règles (front + backend) : une seule rémunération par acte (code + type) ; taux (0,01 à 100 %)
    // ou montant fixe, l'un vide l'autre ; date de début obligatoire, date de fin facultative et
    // pas avant le début ; en modification, spécialité et acte sont verrouillés ; désactiver l'acte
    // désactive sa rémunération, qui ne peut pas être réactivée tant que l'acte est inactif ;
    // recréer la rémunération d'un acte dont la rémunération est désactivée la réactive.
    // Les tests partent d'un acte ajouté à la structure pour l'occasion (sans rémunération ni facture).
    test.describe.configure({ mode: 'serial' });
    let speciality = '';
    let otherSpeciality = '';
    let act = '';
    let profileType = '';

    /** Date du jour décalée : "AAAA-MM-JJ" (champ date) et "JJ/MM/AAAA" (tableau). */
    const day = (offset: number) => {
      const d = new Date(Date.now() + offset * 86400000);
      const pad = (n: number) => String(n).padStart(2, '0');
      return { iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, fr: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` };
    };
    const digits = (text: string) => text.replace(/[^\d]/g, '');

    async function openProfiles(page: Page) {
      const profiles = new RemunerationProfilePage(page);
      await profiles.open();
      return profiles;
    }

    /** Rémunération de l'acte dans la liste (tous états confondus). */
    async function profileRows(profiles: RemunerationProfilePage) {
      const rows = [];
      for (const etat of ['Actif', 'Inactif'] as const) {
        await profiles.search({ nom: act, etat });
        rows.push(...await profiles.rowsOf(act));
      }
      return rows;
    }

    test("Préparer un acte de la structure sans rémunération", async ({ page }) => {
      const acts = new BillableActConfigPage(page);
      await acts.open();
      await acts.openNew();
      const isAll = (s: string) => /^TOUTES LES SP/.test(normalizeLabel(s));
      for (const candidate of (await acts.specialities()).filter(s => s && !isAll(s))) {
        const proposed = await acts.chooseSpeciality(candidate);
        if (proposed.length > 0 && !speciality) { speciality = candidate; act = proposed[0]; }
        else if (speciality && !otherSpeciality && candidate !== speciality) otherSpeciality = candidate;
        if (speciality && otherSpeciality) break;
      }
      expect(speciality, 'Une spécialité avec un acte libre').toBeTruthy();
      await acts.chooseSpeciality(speciality);
      await acts.chooseAct(act);
      expect(await acts.save(), "Message de l'application").toMatch(/enregistrement a\s+r[ée]ussi/i);
      await acts.search({ nom: act });
      const row = (await acts.rows()).find(r => normalizeLabel(r.nom) === normalizeLabel(act));
      expect(row, `Acte "${act}" ajouté`).toBeDefined();

    });

    test('Nouvelle rémunération : spécialité et acte obligatoires', async ({ page }) => {
      const profiles = await openProfiles(page);
      await profiles.openNew();
      await expect(profiles.saveButton, 'Enregistrer inactif sans spécialité ni acte').toBeDisabled();
      await profiles.chooseSpeciality(speciality);
      await expect(profiles.saveButton, 'Enregistrer inactif sans acte').toBeDisabled();
      await profiles.close();
    });

    test('Taux ou montant obligatoire, taux limité à 100 %, taux et montant s\'excluent', async ({ page }) => {
      const profiles = await openProfiles(page);
      await profiles.openNew();
      expect(await profiles.chooseSpeciality(speciality), "L'acte de la spécialité est proposé").toContainEqual(expect.stringMatching(accentInsensitive(act)));
      await profiles.chooseAct(act);
      await expect(profiles.startInput(act), 'Début : aujourd\'hui par défaut').toHaveValue(day(0).iso);
      await expect(profiles.saveButton, 'Ni taux ni montant').toBeDisabled();
      await test.step('Taux de 150 % refusé', async () => {
        await profiles.rateInput(act).fill('150');
        await expect(profiles.actLine(act).getByText('Le taux ne peut pas dépasser 100%')).toBeVisible();
        await expect(profiles.saveButton).toBeDisabled();
      });
      await test.step('Taux de 15 % accepté', async () => {
        await profiles.rateInput(act).fill('15');
        await expect(profiles.saveButton).toBeEnabled();
      });
      await test.step('Saisir un montant vide le taux, et inversement', async () => {
        await profiles.amountInput(act).pressSequentially('5000');
        await expect(profiles.rateInput(act)).toHaveValue('');
        await profiles.rateInput(act).fill('10');
        await expect(profiles.amountInput(act)).toHaveValue('');
      });
      await profiles.close();
    });

    test('Dates : début obligatoire, fin pas avant le début', async ({ page }) => {
      const profiles = await openProfiles(page);
      await profiles.openNew();
      await profiles.chooseSpeciality(speciality);
      await profiles.chooseAct(act);
      await profiles.rateInput(act).fill('15');
      await test.step('Fin la veille du début refusée', async () => {
        await profiles.endInput(act).fill(day(-1).iso);
        await expect(profiles.actLine(act).getByText('La date de fin doit être après la date de début')).toBeVisible();
        await expect(profiles.saveButton).toBeDisabled();
      });
      await test.step('Fin le même jour acceptée', async () => {
        await profiles.endInput(act).fill(day(0).iso);
        await expect(profiles.saveButton).toBeEnabled();
      });
      await test.step('Début vidé refusé', async () => {
        await profiles.startInput(act).fill('');
        await expect(profiles.actLine(act).getByText('Date obligatoire')).toBeVisible();
        await expect(profiles.saveButton).toBeDisabled();
      });
      await profiles.close();
    });

    test('Créer une rémunération à taux', async ({ page }) => {
      const profiles = await openProfiles(page);
      await profiles.openNew();
      await profiles.chooseSpeciality(speciality);
      await profiles.chooseAct(act);
      await profiles.rateInput(act).fill('15');
      await profiles.endInput(act).fill(day(30).iso);
      expect(await profiles.save(), "Message de l'application").toMatch(/créé avec succès/i);
      await profiles.search({ nom: act });
      const rows = await profiles.rowsOf(act);
      expect(rows, 'Une rémunération pour l\'acte').toHaveLength(1);
      expect.soft(normalizeLabel(rows[0].specialite)).toBe(normalizeLabel(speciality));
      profileType = rows[0].type;
      expect.soft(rows[0].taux).toBe('15%');
      expect.soft(rows[0].montant).toBe('-');
      expect.soft(rows[0].debut).toBe(day(0).fr);
      expect.soft(rows[0].fin).toBe(day(30).fr);
      expect.soft(rows[0].statut).toBe('Actif');
    });

    test("Un acte déjà rémunéré n'est plus proposé, même si la liste affichée est filtrée", async ({ page }) => {
      const profiles = await openProfiles(page);
      await test.step('Liste non filtrée', async () => {
        await profiles.openNew();
        expect(await profiles.chooseSpeciality(speciality)).not.toContainEqual(expect.stringMatching(accentInsensitive(act)));
        await profiles.close();
      });
      await test.step(`Liste filtrée sur une autre spécialité (${otherSpeciality})`, async () => {
        await profiles.search({ specialite: otherSpeciality });
        await profiles.openNew();
        expect(await profiles.chooseSpeciality(speciality)).not.toContainEqual(expect.stringMatching(accentInsensitive(act)));
        await profiles.close();
      });
    });

    test('Filtrer par acte, spécialité, type et état', async ({ page }) => {
      const profiles = await openProfiles(page);
      await profiles.search({ nom: act });
      expect.soft(await profiles.rowsOf(act), 'Par acte').toHaveLength(1);
      await profiles.search({ specialite: speciality });
      const bySpeciality = await profiles.listRows();
      expect.soft(bySpeciality.every(r => normalizeLabel(r.specialite) === normalizeLabel(speciality)), 'Par spécialité').toBe(true);
      await profiles.search({ type: profileType });
      const byType = await profiles.listRows();
      expect.soft(byType.every(r => normalizeLabel(r.type) === normalizeLabel(profileType)), 'Par type').toBe(true);
      for (const etat of ['Actif', 'Inactif'] as const) {
        await profiles.search({ etat });
        expect.soft((await profiles.listRows()).every(r => r.statut === etat), `Par état "${etat}"`).toBe(true);
      }
    });

    test('Modifier : spécialité et acte verrouillés, passage du taux au montant fixe', async ({ page }) => {
      const profiles = await openProfiles(page);
      await profiles.search({ nom: act });
      await profiles.openEdit(act);
      await expect(profiles.specialitySelect, 'Spécialité verrouillée').toHaveClass(/ng-select-disabled/);
      await expect(profiles.actsSelect, 'Acte verrouillé').toHaveClass(/ng-select-disabled/);
      await expect(profiles.rateInput(act), 'Taux repris').toHaveValue('15');
      await expect(profiles.endInput(act), 'Fin reprise').toHaveValue(day(30).iso);
      await profiles.amountInput(act).pressSequentially('7500');
      await expect(profiles.rateInput(act), 'Taux vidé').toHaveValue('');
      expect(await profiles.save(), "Message de l'application").toMatch(/modifié avec succès/i);
      await profiles.search({ nom: act });
      const rows = await profiles.rowsOf(act);
      expect(rows, 'Toujours une seule rémunération').toHaveLength(1);
      expect.soft(rows[0].taux).toBe('-');
      expect.soft(digits(rows[0].montant)).toBe('7500');
      expect.soft(rows[0].fin).toBe(day(30).fr);
    });

    test('Désactiver puis réactiver la rémunération', async ({ page }) => {
      const profiles = await openProfiles(page);
      await profiles.search({ nom: act, etat: 'Actif' });
      expect(await profiles.toggle(act)).toMatch(/désactivée avec succès/);
      expect((await profileRows(profiles)).map(r => r.statut), 'Désactivée').toEqual(['Inactif']);
      await profiles.search({ nom: act, etat: 'Inactif' });
      expect(await profiles.toggle(act)).toMatch(/activée avec succès/);
      expect((await profileRows(profiles)).map(r => r.statut), 'Réactivée').toEqual(['Actif']);
    });

    test("Désactiver l'acte désactive sa rémunération, qui ne peut pas être réactivée tant que l'acte est inactif", async ({ page }) => {
      const acts = new BillableActConfigPage(page);
      const toggleAct = async (from: 'Actif' | 'Inactif') => {
        await acts.open();
        await acts.search({ nom: act, etat: from });
        expect(await acts.toggle(act)).toMatch(/réussi/i);
      };
      await test.step("Désactiver l'acte", async () => toggleAct('Actif'));
      await test.step('Sa rémunération est désactivée', async () => {
        const profiles = await openProfiles(page);
        expect((await profileRows(profiles)).map(r => r.statut)).toEqual(['Inactif']);
      });
      await test.step("Réactivation de la rémunération refusée : l'acte n'est plus valable", async () => {
        const profiles = await openProfiles(page);
        await profiles.search({ nom: act, etat: 'Inactif' });
        expect(await profiles.toggle(act)).toMatch(/n'est plus valable/);
        expect((await profileRows(profiles)).map(r => r.statut)).toEqual(['Inactif']);
      });
      await test.step("Réactiver l'acte : la rémunération reste désactivée", async () => {
        await toggleAct('Inactif');
        const profiles = await openProfiles(page);
        expect((await profileRows(profiles)).map(r => r.statut)).toEqual(['Inactif']);
      });
      await test.step('La rémunération peut alors être réactivée', async () => {
        const profiles = await openProfiles(page);
        await profiles.search({ nom: act, etat: 'Inactif' });
        expect(await profiles.toggle(act)).toMatch(/activée avec succès/);
        expect((await profileRows(profiles)).map(r => r.statut)).toEqual(['Actif']);
      });
    });

    test("Recréer la rémunération d'un acte dont la rémunération est désactivée la réactive avec les nouvelles valeurs", async ({ page }) => {
      const profiles = await openProfiles(page);
      await profiles.search({ nom: act, etat: 'Actif' });
      expect(await profiles.toggle(act)).toMatch(/désactivée avec succès/);
      await profiles.search();
      await profiles.openNew();
      expect(await profiles.chooseSpeciality(speciality), 'Acte de nouveau proposé').toContainEqual(expect.stringMatching(accentInsensitive(act)));
      await profiles.chooseAct(act);
      await profiles.amountInput(act).pressSequentially('3000');
      expect(await profiles.save(), "Message de l'application").toMatch(/créé avec succès/i);
      const rows = await profileRows(profiles);
      expect(rows, 'Une seule rémunération, réactivée').toHaveLength(1);
      expect.soft(rows[0].statut).toBe('Actif');
      expect.soft(digits(rows[0].montant)).toBe('3000');
      expect.soft(rows[0].taux).toBe('-');
      expect.soft(rows[0].fin, 'Sans date de fin').toBe('Non définie');
    });

    test('Nettoyage : désactiver la rémunération de test', async ({ page }) => {
      const profiles = await openProfiles(page);
      await profiles.search({ nom: act, etat: 'Actif' });
      expect(await profiles.toggle(act)).toMatch(/désactivée avec succès/);
    });
  });

  // ======================================================================
  // Configuration de consentement
  // ======================================================================
  test.describe('Consentement', () => {
    // Une configuration par profil ; le profil impose type et mode (PATIENT → ELECTRONIC / EMAIL,
    // personnel → MANUAL / AUCUN). Les tests modifient, retirent puis recréent les configurations
    // Secrétaire médicale et Patient, et remettent toujours le texte d'origine.
    test.describe.configure({ mode: 'serial' });
    const EXPECTED = {
      PATIENT: { type: 'ELECTRONIC', mode: 'EMAIL', defaultText: /Bonjour cher\/chère patient/ },
      MEDICAL_SECRETAIRE: { type: 'MANUAL', mode: 'AUCUN', defaultText: /En donnant mon avis, je déclare/ },
    } as const;
    type Profil = keyof typeof EXPECTED;
    const originals: Partial<Record<Profil, string>> = {};
    /** HTML comparé sans les espaces (l'éditeur reformate les retours à la ligne). */
    const compact = (html: string) => html.replace(/\s+/g, '');

    async function openConsents(page: Page) {
      const consents = new ConsentConfigPage(page);
      await consents.open();
      return consents;
    }

    /** Recrée la configuration du profil avec son texte d'origine si elle a été retirée. */
    async function ensureConfig(page: Page, profil: Profil) {
      const consents = await openConsents(page);
      if ((await consents.rows()).some(r => r.profil === profil)) return;
      await consents.chooseProfile(profil);
      await consents.editorContent(consents.form, originals[profil]);
      await consents.save();
    }

    test('Liste : une configuration par profil, aucun profil libre', async ({ page }) => {
      const consents = await openConsents(page);
      const rows = await consents.rows();
      const profils = rows.map(r => r.profil);
      expect(new Set(profils).size, 'Un seul enregistrement par profil').toBe(profils.length);
      expect(profils.sort()).toEqual(['CAREGIVER', 'HI_ADMINISTRATOR', 'MEDICAL_SECRETAIRE', 'PATIENT']);
      for (const row of rows) {
        const expected = row.profil === 'PATIENT' ? EXPECTED.PATIENT : EXPECTED.MEDICAL_SECRETAIRE;
        expect.soft(`${row.type} / ${row.mode}`, `Type et mode de ${row.profil}`).toBe(`${expected.type} / ${expected.mode}`);
      }
      expect(await consents.proposedProfiles(), 'Aucun profil à configurer').toEqual([]);
      await expect(consents.saveButton, 'Enregistrer inactif').toBeDisabled();
      for (const profil of Object.keys(EXPECTED) as Profil[]) {
        await consents.openEdit(profil);
        originals[profil] = await consents.editorContent(consents.editModal);
        expect(originals[profil], `Texte de ${profil}`).toBeTruthy();
        await consents.closeEdit();
      }
      // Copie de secours, pour restaurer à la main si le run s'arrête entre un retrait et sa recréation
      fs.mkdirSync('test-results', { recursive: true });
      fs.writeFileSync('test-results/consent-originals.json', JSON.stringify(originals, null, 2));
    });

    test('Modifier le texte de la configuration Secrétaire médicale', async ({ page }) => {
      const marker = `Test automatique ${Date.now()}`;
      try {
        const consents = await openConsents(page);
        await consents.openEdit('MEDICAL_SECRETAIRE');
        await test.step('Profil, type et mode verrouillés', async () => {
          for (const select of ['ng-select#type', 'ng-select[formcontrolname="consent_ident"]', 'ng-select#sendMode']) {
            await expect(consents.editModal.locator(select)).toHaveClass(/ng-select-disabled/);
          }
        });
        await test.step('Texte vide refusé', async () => {
          await consents.editorContent(consents.editModal, '');
          await expect(consents.editSaveButton).toBeDisabled();
        });
        await test.step('Texte modifié enregistré', async () => {
          await consents.editorContent(consents.editModal, `${originals.MEDICAL_SECRETAIRE}<p>${marker}</p>`);
          await consents.saveEdit();
        });
        await test.step('Le nouveau texte est repris à la réouverture', async () => {
          const reopened = await openConsents(page);
          await reopened.openEdit('MEDICAL_SECRETAIRE');
          expect(await reopened.editorContent(reopened.editModal)).toContain(marker);
          await reopened.closeEdit();
          expect((await reopened.rows()).filter(r => r.profil === 'MEDICAL_SECRETAIRE'), 'Toujours une seule configuration').toHaveLength(1);
        });
      } finally {
        await test.step("Remettre le texte d'origine", async () => {
          const consents = await openConsents(page);
          await consents.openEdit('MEDICAL_SECRETAIRE');
          if (compact(await consents.editorContent(consents.editModal)) === compact(originals.MEDICAL_SECRETAIRE!)) {
            await consents.closeEdit();
          } else {
            await consents.editorContent(consents.editModal, originals.MEDICAL_SECRETAIRE);
            await consents.saveEdit();
          }
          const check = await openConsents(page);
          await check.openEdit('MEDICAL_SECRETAIRE');
          expect(compact(await check.editorContent(check.editModal)), "Texte d'origine").toBe(compact(originals.MEDICAL_SECRETAIRE!));
          await check.closeEdit();
        });
      }
    });

    for (const profil of ['MEDICAL_SECRETAIRE', 'PATIENT'] as const) {
      test(`Retirer puis recréer la configuration ${profil}`, async ({ page }) => {
        const expected = EXPECTED[profil];
        try {
          await test.step('Retirer la configuration', async () => {
            const consents = await openConsents(page);
            expect(await consents.remove(profil)).toMatch(/reussi/);
            await expect(consents.row(profil), 'Plus listée').toHaveCount(0);
          });
          await test.step('Enregistrer sans profil est refusé', async () => {
            const consents = await openConsents(page);
            await consents.saveButton.click();
            await expect(consents.form.getByText('Au moins un rôle est obligatoire')).toBeVisible();
          });
          await test.step(`Le profil est de nouveau proposé ; type ${expected.type} et mode ${expected.mode} imposés`, async () => {
            const consents = await openConsents(page);
            expect(await consents.proposedProfiles()).toContain(profil);
            await consents.chooseProfile(profil);
            expect.soft(await consents.shown(consents.typeSelect), 'Type').toBe(expected.type);
            expect.soft(await consents.shown(consents.modeSelect), 'Mode').toBe(expected.mode);
            await expect(consents.typeSelect, 'Type non modifiable').toHaveClass(/ng-select-disabled/);
            await expect(consents.modeSelect, 'Mode non modifiable').toHaveClass(/ng-select-disabled/);
            expect(await consents.editorText(consents.form), 'Texte par défaut').toMatch(expected.defaultText);
          });
          await test.step("Recréer avec le texte d'origine", async () => {
            const consents = await openConsents(page);
            await consents.chooseProfile(profil);
            await consents.editorContent(consents.form, originals[profil]);
            await consents.save();
          });
          await test.step('La configuration est de nouveau listée, avec son texte', async () => {
            const consents = await openConsents(page);
            const rows = (await consents.rows()).filter(r => r.profil === profil);
            expect(rows, 'Une seule configuration').toHaveLength(1);
            expect.soft(`${rows[0].type} / ${rows[0].mode}`).toBe(`${expected.type} / ${expected.mode}`);
            expect(await consents.proposedProfiles(), 'Plus proposé').not.toContain(profil);
            await consents.openEdit(profil);
            expect(compact(await consents.editorContent(consents.editModal)), "Texte d'origine").toBe(compact(originals[profil]!));
            await consents.closeEdit();
          });
        } finally {
          await test.step('Remise en état si besoin', async () => ensureConfig(page, profil));
        }
      });
    }
  });
});
