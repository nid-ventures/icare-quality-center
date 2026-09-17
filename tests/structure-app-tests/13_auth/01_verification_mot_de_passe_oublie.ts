// tests/structure-app-tests/13_auth/01_verification_mot_de_passe_oublie.ts
import { test } from '@playwright/test';
import { ForgotPasswordPage } from '../../../pages/structure/auth/forgot-password.page';

test("Vérification de l'envoi du lien de réinitialisation de mot de passe", async ({ page }) => {
  const forgotPasswordPage = new ForgotPasswordPage(page);

  await test.step('Ouverture de la page mot de passe oublié', async () => {
    await forgotPasswordPage.goto();
    await forgotPasswordPage.expectFormLoaded();
  });

  await test.step('Soumettre une adresse email valide', async () => {
    // Réutilise le compte de test partagé (déjà utilisé pour la connexion ailleurs dans
    // la suite) plutôt qu'une adresse email personnelle.
    await forgotPasswordPage.submitEmail('hi-admin@gmail.com');
  });

  await test.step('Vérifier le message générique de confirmation', async () => {
    await forgotPasswordPage.expectSuccessMessageVisible();
  });
});
