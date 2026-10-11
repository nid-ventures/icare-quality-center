import { test, expect } from '../../fixtures/structure.fixture';
import { LoginPage } from '../../pages/structure/patient/login.page';
import { PortalPage } from '../../pages/structure/portal/portal.page';
import { ForgotPasswordPage } from '../../pages/structure/auth/forgot-password.page';
import { ChangePasswordPage } from '../../pages/structure/auth/change-password.page';
import { PatientConfirmPage } from '../../pages/structure/information/patient-confirm.page';
import { PrsnlInfosPage } from '../../pages/structure/prsnl-infos/prsnl-infos.page';
import { adminUser } from '../../test-data/structure-users';

test.describe('Module Authentification & pages publiques', () => {

  // ======================================================================
  // Connexion : ces tests partent d'un navigateur non connecté
  // ======================================================================
  test.describe('Connexion', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('Afficher le formulaire de connexion', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.expectLoginPageIsFullyLoaded();
      await expect(loginPage.rememberMeCheckbox()).toBeVisible();
    });

    test('Se connecter avec un compte multi-structures et arriver sur le portail', async ({ page }) => {
      const loginPage = new LoginPage(page);
      const portal = new PortalPage(page);

      await test.step('Saisir les identifiants valides', async () => {
        await loginPage.goto();
        await loginPage.login(adminUser.username, adminUser.password);
      });

      await test.step(`Choisir la structure "${adminUser.hi}"`, async () => {
        await loginPage.selectStructure(adminUser.hi);
      });

      await test.step('Vérifier l\'arrivée sur le portail des modules', async () => {
        await portal.expectLoaded();
        await expect(portal.greetingHeading).toContainText(adminUser.fullName);
      });
    });

    test('Bloquer la connexion tant que les champs obligatoires sont vides', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.expectLoginButtonDisabled();
      await loginPage.fillUsername(adminUser.username);
      await loginPage.expectLoginButtonDisabled();
      await loginPage.fillPassword(adminUser.password);
      await loginPage.expectLoginButtonEnabled();
    });

    test('Refuser la connexion avec un mot de passe incorrect', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(adminUser.username, 'MauvaisMotDePasse!1');
      await loginPage.expectBadCredentialsError();
    });

    test('Afficher puis masquer le mot de passe saisi', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.fillPassword('secret123');
      await loginPage.expectPasswordType('password');
      await loginPage.togglePasswordVisibility();
      await loginPage.expectPasswordType('text');
      await loginPage.togglePasswordVisibility();
      await loginPage.expectPasswordType('password');
    });

    test('Annuler le choix de la structure reste sur la page de connexion', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(adminUser.username, adminUser.password);
      await loginPage.cancelStructureSelection();
      await expect(page).toHaveURL(/\/auth\/login/);
    });

    test('Une page protégée redirige vers la connexion sans session', async ({ page }) => {
      await page.goto('/patient/patients');
      await page.waitForURL('**/auth/**');
      await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    });
  });

  // ======================================================================
  // Mot de passe oublié (route publique)
  // ======================================================================
  test.describe('Mot de passe oublié', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('Ouvrir la page depuis le lien de connexion puis y revenir', async ({ page }) => {
      const loginPage = new LoginPage(page);
      const forgotPasswordPage = new ForgotPasswordPage(page);
      await loginPage.goto();
      await loginPage.openForgotPassword();
      await forgotPasswordPage.expectFormLoaded();
      await forgotPasswordPage.backToLogin();
      await loginPage.expectLoginPageIsFullyLoaded();
    });

    test('Valider le format de l\'adresse email', async ({ page }) => {
      const forgotPasswordPage = new ForgotPasswordPage(page);
      await forgotPasswordPage.goto();

      await test.step('Email vide : envoi impossible', async () => {
        await forgotPasswordPage.expectSendButtonDisabled();
      });

      await test.step('Email mal formé : envoi impossible', async () => {
        await forgotPasswordPage.fillEmail('adresse-invalide');
        await forgotPasswordPage.expectSendButtonDisabled();
      });

      await test.step('Email valide : envoi possible', async () => {
        await forgotPasswordPage.fillEmail(adminUser.username);
        await forgotPasswordPage.expectSendButtonEnabled();
      });
    });

    test("Envoyer le lien de réinitialisation à une adresse valide", async ({ page }) => {
      const forgotPasswordPage = new ForgotPasswordPage(page);
      await forgotPasswordPage.goto();
      await forgotPasswordPage.expectFormLoaded();
      await forgotPasswordPage.submitEmail(adminUser.username);
      await forgotPasswordPage.expectSuccessMessageVisible();
    });
  });

  // ======================================================================
  // Changement de mot de passe (connecté)
  // IMPORTANT : on ne soumet JAMAIS un formulaire valide, sinon le mot de passe du compte
  // partagé par toute la suite serait réellement modifié.
  // ======================================================================
  test.describe('Changement de mot de passe', () => {
    test('Vérifier les règles de validation du formulaire', async ({ portal, page }) => {
      const changePasswordPage = new ChangePasswordPage(page);

      await test.step('Ouvrir le formulaire depuis le portail', async () => {
        await portal.changePasswordLink.click();
        await changePasswordPage.expectFormLoaded();
      });

      await test.step('Deux mots de passe différents', async () => {
        await changePasswordPage.fillPasswords('Passw0rd1', 'Passw0rd2');
        await changePasswordPage.submit();
        await changePasswordPage.expectMismatchErrorVisible();
        await changePasswordPage.expectNoSuccessMessage();
      });

      await test.step('Mot de passe trop court', async () => {
        await changePasswordPage.fillPasswords('a1', 'a1');
        await changePasswordPage.submit();
        await changePasswordPage.expectMinLengthErrorVisible();
        await changePasswordPage.expectNoSuccessMessage();
      });
    });
  });

  // ======================================================================
  // Politique de confidentialité & CGU (connecté)
  // ======================================================================
  test.describe('Politique de confidentialité et CGU', () => {
    test('Consulter la politique de confidentialité puis les CGU', async ({ portal, page }) => {
      const prsnlInfosPage = new PrsnlInfosPage(page);

      await test.step('Entrer dans un module pour afficher le pied de page', async () => {
        await portal.enterModule('Base patients');
      });

      await test.step('Ouvrir la politique via le lien de pied de page', async () => {
        await prsnlInfosPage.openFromFooterLink();
        await prsnlInfosPage.expectPcdTabContentVisible();
      });

      await test.step("Ouvrir l'onglet Conditions générales d'utilisation", async () => {
        await prsnlInfosPage.openCguTab();
        await prsnlInfosPage.expectCguTabContentVisible();
      });
    });
  });

  // ======================================================================
  // Consentement patient (routes publiques /information/**)
  // ======================================================================
  test.describe('Consentement patient', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('Bloquer la confirmation avec un lien de consentement invalide', async ({ page }) => {
      const patientConfirmPage = new PatientConfirmPage(page);
      await patientConfirmPage.gotoConsentement(PatientConfirmPage.buildInvalidId());
      await patientConfirmPage.expectConfirmScreenLoaded();
      await patientConfirmPage.selectAccept();
      await patientConfirmPage.expectConfirmButtonDisabled();
    });

    test('Afficher les écrans de réponse au consentement', async ({ page }) => {
      const patientConfirmPage = new PatientConfirmPage(page);

      await test.step('Consentement accepté', async () => {
        await patientConfirmPage.gotoApproved();
        await patientConfirmPage.expectApprovedContent();
      });
      await test.step('Consentement refusé', async () => {
        await patientConfirmPage.gotoRefused();
        await patientConfirmPage.expectRefusedContent();
      });
      await test.step('Consentement expiré', async () => {
        await patientConfirmPage.gotoExpired();
        await patientConfirmPage.expectExpiredContent();
      });
      await test.step('Consentement déjà pris en compte', async () => {
        await patientConfirmPage.gotoAlready();
        await patientConfirmPage.expectAlreadyContent();
      });
      await test.step("Page d'information", async () => {
        await patientConfirmPage.gotoInfos();
        await patientConfirmPage.expectInfosContent();
      });
    });
  });
});
