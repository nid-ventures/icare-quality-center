import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { AccountListPage } from '../../../pages/structure/account/account-list.page';
import { AccountCreateUpdatePage } from '../../../pages/structure/account/account-create-update.page';
import { AccountUpdatePwdPage } from '../../../pages/structure/account/account-update-pwd.page';
import { AccountDataGenerator } from '../../../pages/structure/generator/account-data-generator';

// Données de test
const adminUser = {
  username: 'hi-admin@gmail.com',
  hi: 'NEST FOR ALL',
  password: 'BcIsX7V&ZRh7',
  // Libellé réel du rôle dans le ng-select (le sélecteur n'affiche plus "Administrateur").
  role: 'HI-ADMINISTRATOR'
};

test('Changer le mot de passe d\'un utilisateur existant', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);
  const accountListPage = new AccountListPage(page);
  const accountCreatePage = new AccountCreateUpdatePage(page, 'create');
  const accountUpdatePwdPage = new AccountUpdatePwdPage(page);

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

  await test.step('Créer un utilisateur pour lequel changer le mot de passe', async () => {
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

  const newAccountData = AccountDataGenerator.generate();

  await test.step('Ouvrir le popup de changement de mot de passe', async () => {
    await accountListPage.openPasswordModal(accountData.login);
    await accountUpdatePwdPage.expectOpen();
  });

  await test.step('Renseigner le nouveau mot de passe', async () => {
    await accountUpdatePwdPage.fillPasswords(newAccountData.password);
  });

  await test.step('Enregistrer le nouveau mot de passe', async () => {
    await accountUpdatePwdPage.save();
  });

  await test.step('Vérifier le message de succès de la mise à jour du mot de passe', async () => {
    await accountUpdatePwdPage.expectSuccessMessage();
  });
});
