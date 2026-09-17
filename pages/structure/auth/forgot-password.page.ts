// pages/structure/auth/forgot-password.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page object pour /auth/forgot-password (non guardée : accessible sans connexion).
 */
export class ForgotPasswordPage {
  private readonly heading: Locator;
  private readonly emailField: Locator;
  private readonly sendButton: Locator;
  private readonly backToLoginLink: Locator;
  private readonly successHeading: Locator;
  private readonly successMessage: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Mot de passe oublié' });
    this.emailField = page.getByLabel('Adresse email');
    // Le bouton n'affiche un spinner qu'en cours de chargement : match partiel par prudence.
    this.sendButton = page.getByRole('button', { name: /Envoyer le lien/ });
    // Le lien est précédé d'un caractère flèche "⬅" : match partiel obligatoire.
    this.backToLoginLink = page.getByRole('link', { name: /Retour à la connexion/ });
    this.successHeading = page.getByRole('heading', { name: 'E-mail envoyé' });
    // Le message de succès peut être précédé d'une icône ("✅") : match partiel.
    // L'application tutoie l'utilisateur ("t'être", pas "vous être").
    this.successMessage = page.getByText(/Si cet email existe, un mail vient de t'être envoyé\.?/);
  }

  async goto() {
    await this.page.goto(process.env.BASE_URL + '/auth/forgot-password');
  }

  async expectFormLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.emailField).toBeVisible();
    await expect(this.sendButton).toBeVisible();
    await expect(this.backToLoginLink).toBeVisible();
  }

  async submitEmail(email: string) {
    await this.emailField.fill(email);
    await this.sendButton.click();
  }

  async expectSuccessMessageVisible() {
    await expect(this.successHeading).toBeVisible();
    await expect(this.successMessage).toBeVisible();
  }
}
