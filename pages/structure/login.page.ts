import { type Page, type Locator } from '@playwright/test';

export class LoginPage {
  private readonly usernameField: Locator;
  private readonly x_hi_codeField: Locator;
  private readonly passwordField: Locator;
  private readonly loginButton: Locator;
  private readonly menuButton: Locator;

  constructor(private readonly page: Page) {
    this.usernameField = page.getByRole('textbox', { name: 'Votre identifiant' });
    this.x_hi_codeField = page.getByRole('textbox', { name: 'Votre HI CODE' });
    this.passwordField = page.getByRole('textbox', { name: 'Votre mot de passe' });
    this.loginButton = page.getByRole('button', { name: 'Connexion' });
    this.menuButton = page.getByText('Menu').nth(1);

  }
  async goto() {
    await this.page.goto('https://pro-icare.com/auth/login');
  }
  async login(identifiant: string,hicode: string,password: string) {
    await this.usernameField.fill(identifiant);
    await this.x_hi_codeField.fill(hicode);
    await this.passwordField.fill(password);
    await this.loginButton.click();
    await this.menuButton.click();
  }
}
