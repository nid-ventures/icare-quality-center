import { type Page } from '@playwright/test';
import { test, expect } from '../../fixtures/structure.fixture';
import { AccountListPage } from '../../pages/structure/account/account-list.page';
import { AccountCreateUpdatePage } from '../../pages/structure/account/account-create-update.page';
import { AccountUpdatePwdPage } from '../../pages/structure/account/account-update-pwd.page';
import { MyConfigurationPage } from '../../pages/structure/my-space/configuration.page';
import { AccountDataGenerator } from '../../pages/structure/generator/account-data-generator';
import { adminUser } from '../../test-data/structure-users';

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
});
