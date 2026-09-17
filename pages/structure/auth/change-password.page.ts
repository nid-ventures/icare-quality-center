// pages/structure/auth/change-password.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page object pour /auth/change-password.
 *
 * ChangePasswordComponent lit `localStorage.getItem('username')` dans son constructeur :
 * il faut donc être connecté avant de naviguer vers cette page.
 *
 * Ce page object n'expose volontairement que les actions nécessaires pour tester la
 * validation côté client (ReactiveForms) : aucune méthode ne doit permettre de finaliser
 * une soumission valide, afin de ne jamais changer réellement le mot de passe du compte
 * partagé utilisé par le reste de la suite.
 */
export class ChangePasswordPage {
  private readonly heading: Locator;
  private readonly newPasswordField: Locator;
  private readonly confirmPasswordField: Locator;
  private readonly submitButton: Locator;
  private readonly mismatchError: Locator;
  private readonly minLengthError: Locator;
  private readonly successMessage: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Changer mon mot de passe' });
    this.newPasswordField = page.locator('#newPassword');
    this.confirmPasswordField = page.locator('#confirmPassword');
    // Un spinner précède le texte pendant le chargement : match partiel par prudence.
    this.submitButton = page.getByRole('button', { name: /Modifier le mot de passe/ });
    this.mismatchError = page.getByText('Les mots de passe ne correspondent pas.');
    this.minLengthError = page.getByText('Doit contenir au moins 6 caractères.');
    this.successMessage = page.getByText('Votre mot de passe a été modifié avec succès.');
  }

  async goto() {
    await this.page.goto(process.env.BASE_URL + '/auth/change-password');
  }

  async expectFormLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.newPasswordField).toBeVisible();
    await expect(this.confirmPasswordField).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async fillPasswords(newPassword: string, confirmPassword: string) {
    await this.newPasswordField.fill(newPassword);
    await this.confirmPasswordField.fill(confirmPassword);
  }

  async submit() {
    await this.submitButton.click();
  }

  async expectMismatchErrorVisible() {
    await expect(this.mismatchError).toBeVisible();
  }

  async expectMinLengthErrorVisible() {
    await expect(this.minLengthError).toBeVisible();
  }

  async expectNoSuccessMessage() {
    await expect(this.successMessage).toHaveCount(0);
  }
}
