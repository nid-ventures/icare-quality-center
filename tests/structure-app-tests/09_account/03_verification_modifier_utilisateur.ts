import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { AccountListPage } from '../../../pages/structure/account/account-list.page';
import { AccountCreateUpdatePage } from '../../../pages/structure/account/account-create-update.page';
import { AccountDataGenerator } from '../../../pages/structure/generator/account-data-generator';

// Données de test
const adminUser = {
  username: 'hi-admin@gmail.com',
  hi: 'NEST FOR ALL',
  password: 'BcIsX7V&ZRh7',
  // Libellé réel du rôle dans le ng-select (le sélecteur n'affiche plus "Administrateur").
  role: 'HI-ADMINISTRATOR'
};

test('Modifier un utilisateur existant', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);
  const accountListPage = new AccountListPage(page);
  const accountCreatePage = new AccountCreateUpdatePage(page, 'create');
  const accountUpdatePage = new AccountCreateUpdatePage(page, 'update');

  await test.step('Ouverture de la page de connexion', async () => {
    await loginPage.goto();
  })
  await test.step('connexion', async () => {
    await loginPage.login(adminUser.username, adminUser.password);
  })
  await test.step('Sélection de la structure', async () => {
    await loginPage.selectStructure(adminUser.hi);
  });
  await test.step('Vérifier que le dashboard affiche les statistiques', async () => {
    await dashboardPage.statisticIsVisible();
  })

  await test.step('Accéder à la liste des utilisateurs', async () => {
    await accountListPage.goto();
  });

  const accountData = AccountDataGenerator.generate();

  await test.step('Créer un utilisateur à modifier', async () => {
    await accountListPage.openCreateModal();
    await accountCreatePage.expectOpen();
    await accountCreatePage.fillCreationForm(accountData, adminUser.role);
    await accountCreatePage.save();
  });

  await test.step('Retrouver l\'utilisateur créé dans la liste', async () => {
    await accountListPage.expectListLoaded();
    await accountListPage.searchByLogin(accountData.login);
    await accountListPage.expectUserInList(accountData.login);
  });

  const updatedData = AccountDataGenerator.generate();

  await test.step('Ouvrir le popup de modification de l\'utilisateur', async () => {
    await accountListPage.openUpdateModal(accountData.login);
    await accountUpdatePage.expectOpen();
  });

  await test.step('Modifier le prénom et le nom de l\'utilisateur', async () => {
    await accountUpdatePage.fillIdentity({
      firstName: updatedData.firstName,
      lastName: updatedData.lastName
    });
  });

  await test.step('Enregistrer les modifications', async () => {
    await accountUpdatePage.save();
  });

  await test.step('Vérifier que les modifications sont bien prises en compte', async () => {
    await accountListPage.searchByLogin(accountData.login);
    const row = accountListPage.getRowByLogin(accountData.login);
    await expect(row).toContainText(updatedData.lastName);
    await expect(row).toContainText(updatedData.firstName);
  });
});
