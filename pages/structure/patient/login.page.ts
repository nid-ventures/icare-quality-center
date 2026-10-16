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

  // ======================== CAS D'ERREUR & OPTIONS DU FORMULAIRE ========================
  /** Le bouton Connexion reste désactivé tant que le formulaire est invalide (hors autofill). */
  async expectLoginButtonDisabled() {
    await expect(this.loginButton).toBeDisabled();
  }

  async expectLoginButtonEnabled() {
    await expect(this.loginButton).toBeEnabled();
  }

  async expectBadCredentialsError() {
    await expect(this.page.getByText('Erreur de connexion : identifiant ou mot de passe incorrect')).toBeVisible();
    await expect(this.page).toHaveURL(/\/auth\/login/);
  }

  // Le libellé du bouton alterne entre "Afficher le mot de passe" et "Masquer le mot de passe".
  async togglePasswordVisibility() {
    await this.page.getByRole('button', { name: /(Afficher|Masquer) le mot de passe/ }).click();
  }

  async expectPasswordType(type: 'password' | 'text') {
    await expect(this.passwordField).toHaveAttribute('type', type);
  }

  rememberMeCheckbox(): Locator {
    return this.page.getByRole('checkbox', { name: 'Se souvenir de moi' });
  }

  async openForgotPassword() {
    await this.forgotPasswordLink.click();
    await this.page.waitForURL('**/auth/forgot-password');
  }

  /** Annule la modale de choix de structure (comptes multi-structures uniquement). */
  async cancelStructureSelection() {
    const structureModalHeading = this.page.getByRole('heading', { name: /Sélectionnez votre établissement/ });
    await expect(structureModalHeading).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Valider et continuer' })).toBeDisabled();
    await this.page.getByRole('button', { name: 'Annuler' }).click();
    await expect(structureModalHeading).toBeHidden();
  }

  /**
   * Gère la modale de sélection de structure après connexion.
   * Un compte associé à une seule structure/HI code passe directement au dashboard
   * sans que la modale n'apparaisse : dans ce cas, cette méthode ne fait rien.
   */
  async selectStructure(structureName: string = 'NEST FOR ALL') {
    const structureModalHeading = this.page.getByRole('heading', { name: /Sélectionnez votre établissement/ });
    // Fenêtre de choix ou arrivée directe au portail (une seule structure) : la première des deux.
    // Un délai fixe court faisait conclure à tort « pas de choix » quand la connexion était lente.
    const modalAppeared = await Promise.race([
      structureModalHeading.waitFor({ state: 'visible', timeout: 30000 }).then(() => true, () => false),
      this.page.waitForURL('**/modules', { timeout: 30000 }).then(() => false, () => false),
    ]);
    if (!modalAppeared) {
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
  }
}