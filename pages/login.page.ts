import { type Page, type Locator } from '@playwright/test';

export class LoginPage {
  private readonly usernameField: Locator;
  private readonly passwordField: Locator;
  private readonly loginButton: Locator;

  constructor(private readonly page: Page) {
    this.usernameField = page.getByRole('textbox', { name: "Nom d'utilisateur" });
    this.passwordField = page.getByRole('textbox', { name: 'Mot de passe' });
    this.loginButton = page.getByRole('button', { name: 'Se connecter' });
  }

  async goto() {
    await this.page.goto('/auth/login');
  }

  async login(email: string, password: string) {
    await this.usernameField.fill(email);
    await this.passwordField.fill(password);
    await this.loginButton.click();
  }
}
