// tests/structure-app-tests/13_auth/02_verification_changer_mot_de_passe_validation.ts
import { test } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { ChangePasswordPage } from '../../../pages/structure/auth/change-password.page';

// Données de test
const adminUser = {
  username: 'hi-admin@gmail.com',
  hi: 'NEST FOR ALL',
  password: 'BcIsX7V&ZRh7',
  role: 'Administrateur'
};

// IMPORTANT : ce test ne doit JAMAIS aboutir à une soumission valide du formulaire, car
// cela changerait réellement le mot de passe du compte adminUser partagé par l'ensemble
// des autres fichiers de test (qui se connectent avec ces identifiants codés en dur). On
// ne vérifie donc que les erreurs de validation côté client (ReactiveForms), qui
// empêchent onSubmit() d'appeler AccountService.changePwd(...) :
//  - les deux mots de passe saisis restent volontairement différents dans le 1er cas ;
//  - le mot de passe est volontairement trop court (mais identique des deux côtés, pour
//    ne pas déclencher en plus l'erreur de non-correspondance) dans le 2e cas.
test('Vérification des règles de validation du formulaire de changement de mot de passe', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const changePasswordPage = new ChangePasswordPage(page);

  await test.step('Ouverture de la page de connexion', async () => {
    await loginPage.goto();
  });
  await test.step('connexion', async () => {
    await loginPage.login(adminUser.username, adminUser.password);
  });
  await test.step('Sélection de la structure', async () => {
    await loginPage.selectStructure(adminUser.hi);
  });

  await test.step('Ouverture du formulaire de changement de mot de passe', async () => {
    await changePasswordPage.goto();
    await changePasswordPage.expectFormLoaded();
  });

  await test.step('Soumettre deux mots de passe différents', async () => {
    await changePasswordPage.fillPasswords('Passw0rd1', 'Passw0rd2');
    await changePasswordPage.submit();
  });

  await test.step('Vérifier l\'erreur de non-correspondance des mots de passe', async () => {
    await changePasswordPage.expectMismatchErrorVisible();
    await changePasswordPage.expectNoSuccessMessage();
  });

  await test.step('Soumettre un mot de passe trop court (mais identique des deux côtés)', async () => {
    await changePasswordPage.fillPasswords('a1', 'a1');
    await changePasswordPage.submit();
  });

  await test.step('Vérifier l\'erreur de longueur minimale', async () => {
    await changePasswordPage.expectMinLengthErrorVisible();
    await changePasswordPage.expectNoSuccessMessage();
  });
});
