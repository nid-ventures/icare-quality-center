import { type Page, type Locator, expect } from '@playwright/test';

export class LoginPage {
  private readonly usernameField: Locator;
  private readonly hiCodeField: Locator;
  private readonly passwordField: Locator;
  private readonly loginButton: Locator;
  private readonly forgotPasswordLink: Locator;
  private readonly headingConnexion: Locator;
  private readonly identifiantText: Locator;
  private readonly passwordText: Locator;
  private readonly menuButton: Locator;

  constructor(private readonly page: Page) {
    // Sélecteurs basés sur les rôles et textes, comme dans l'exemple
    this.headingConnexion = page.getByRole('heading', { name: 'Connexion' });
    this.identifiantText = page.getByText('Identifiant', { exact: true });
    this.passwordText = page.getByText('Mot de passe', { exact: true });
    this.forgotPasswordLink = page.getByRole('link', { name: 'Mot de passe oublié ?' });
    this.usernameField = page.getByRole('textbox', { name: 'Identifiant' });
    this.hiCodeField = page.getByRole('textbox', { name: 'Votre HI CODE' });
    this.passwordField = page.getByRole('textbox', { name: 'Mot de passe' });
    this.loginButton = page.getByRole('button', { name: 'Connexion' });
    this.menuButton = page.getByText('Menu').nth(1);

  }

  async goto() {
    await this.page.goto(process.env.BASE_URL + '/auth/login');
  }

  /**
   * Vérifie que tous les éléments essentiels de la page de connexion sont visibles
   */
  async expectLoginPageIsFullyLoaded() {
    await expect(this.headingConnexion).toBeVisible();
    await expect(this.identifiantText).toBeVisible();
    await expect(this.passwordText).toBeVisible();
    await expect(this.forgotPasswordLink).toBeVisible();
    await expect(this.usernameField).toBeVisible();
    await expect(this.passwordField).toBeVisible();
    await expect(this.loginButton).toBeVisible();
  }

  async fillUsername(username: string) {
    await this.usernameField.fill(username);
  }

  async fillHiCode(hicode: string) {
    await this.hiCodeField.fill(hicode);
  }

  async fillPassword(password: string) {
    await this.passwordField.fill(password);
  }

  async clickLogin() {
    await this.loginButton.click();
  }

  /**
   * Méthode de connexion complète avec vérification intermédiaire
   */
  async login(identifiant: string, password: string) {
    await this.expectLoginPageIsFullyLoaded();
    await this.fillUsername(identifiant);
    await this.fillPassword(password);
    await this.clickLogin();

  }

  /**
   * Gère la modale de sélection de structure après connexion.
   * Un compte associé à une seule structure/HI code passe directement au dashboard
   * sans que la modale n'apparaisse : dans ce cas, cette méthode ne fait rien.
   */
  async selectStructure(structureName: string = 'NEST FOR ALL') {
    const structureModalHeading = this.page.getByRole('heading', { name: '🔑 Sélectionnez votre é' });
    const modalAppeared = await structureModalHeading
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!modalAppeared) {
      // Le clic sur "Menu" ouvre la barre latérale (hors-écran par défaut) : nécessaire
      // même sans modale, sinon les liens de navigation restent inatteignables.
      await this.menuButton.click();
      return;
    }

    await expect(this.page.getByText('Plusieurs structures sont')).toBeVisible();

    // Sélection de la structure (bouton dynamique)
    const structureButton = this.page.getByRole('button', { name: new RegExp(structureName, 'i') });
    await expect(structureButton).toBeVisible();
    await structureButton.click();

    // Validation
    const validateButton = this.page.getByRole('button', { name: 'Valider et continuer' });
    await expect(validateButton).toBeVisible();
    await validateButton.click();
    await this.menuButton.click();

  }
}