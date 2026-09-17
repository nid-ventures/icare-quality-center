// pages/structure/account/account-create-update.page.ts
import { type Page, type Locator, expect } from '@playwright/test';
import { AccountData } from '../generator/account-data-generator';

export type AccountFormMode = 'create' | 'update';

/**
 * Page object pour le formulaire de création/modification d'utilisateur
 * (composant unique `app-account-create-update`, instancié une fois par modal
 * dans account-list : ".bd-prsnl-modal-lg" pour la création et
 * ".bd-update-prsnl-modal-lg" pour la modification).
 *
 * Les deux instances du composant sont toujours présentes dans le DOM
 * (seule leur visibilité bascule via Bootstrap), d'où le scoping systématique
 * des locators sur la racine du modal concerné pour éviter toute ambiguïté
 * (ids "username", "firstName", ... dupliqués entre les deux instances).
 */
export class AccountCreateUpdatePage {
  private readonly root: Locator;
  private readonly modalTitle: Locator;
  private readonly loginInput: Locator;
  private readonly firstNameInput: Locator;
  private readonly lastNameInput: Locator;
  private readonly roleSelect: Locator;
  private readonly passwordInput: Locator;
  private readonly repasswordInput: Locator;
  private readonly saveButton: Locator;
  private readonly closeButton: Locator;

  constructor(private readonly page: Page, private readonly mode: AccountFormMode) {
    this.root = page.locator(mode === 'create' ? '.bd-prsnl-modal-lg' : '.bd-update-prsnl-modal-lg');
    this.modalTitle = this.root.getByRole('heading', {
      name: mode === 'create' ? 'Nouvel utilisateur' : 'Modifier utilisateur',
    });
    this.loginInput = this.root.locator('#username');
    this.firstNameInput = this.root.locator('#firstName');
    this.lastNameInput = this.root.locator('#lastName');
    // ng-select multiple sans id : ciblage via l'attribut "name" statique conservé dans le DOM.
    this.roleSelect = this.root.locator('ng-select[name="prsnlRoleIds"]');
    this.passwordInput = this.root.locator('#password');
    this.repasswordInput = this.root.locator('#repassword');
    // Icône précédant le texte "Enregistrer" : usage d'une regex partielle.
    this.saveButton = this.root.getByRole('button', { name: /Enregistrer/ });
    this.closeButton = this.root.getByRole('button', { name: 'Fermer' });
  }

  async expectOpen() {
    await expect(this.modalTitle).toBeVisible();
  }

  async fillIdentity(data: { login?: string; firstName?: string; lastName?: string }) {
    if (data.login !== undefined) await this.loginInput.fill(data.login);
    if (data.firstName !== undefined) await this.firstNameInput.fill(data.firstName);
    if (data.lastName !== undefined) await this.lastNameInput.fill(data.lastName);
  }

  /**
   * Sélectionne un rôle dans le ng-select multiple "Choisir le(s) rôle(s)"
   * (technique de recherche normalisée reprise de ConsultationPage.selectAndVerify,
   * avec fermeture explicite du panneau via Échap car le ng-select est multiple).
   */
  async selectRole(roleName: string) {
    await this.roleSelect.click();
    const panel = this.page.locator('.ng-dropdown-panel:visible');
    await panel.waitFor({ state: 'visible', timeout: 5000 });
    const options = this.page.locator('.ng-dropdown-panel .ng-option');

    const normalizedValue = roleName.replace(/\s+/g, ' ').trim();
    let optionFound = false;
    const optionCount = await options.count();
    for (let i = 0; i < optionCount; i++) {
      const option = options.nth(i);
      const text = await option.textContent();
      const normalizedText = text?.replace(/\s+/g, ' ').trim();
      if (normalizedText?.toLowerCase() === normalizedValue.toLowerCase()) {
        await option.click();
        optionFound = true;
        break;
      }
    }

    if (!optionFound) {
      const allTexts = await options.allTextContents();
      throw new Error(`Rôle "${roleName}" introuvable dans le sélecteur. Trouvé : ${JSON.stringify(allTexts)}`);
    }

    // Ferme le panneau (le ng-select multiple ne se ferme pas seul après sélection).
    await this.page.keyboard.press('Escape');
    await expect(this.roleSelect).toContainText(roleName, { ignoreCase: true, timeout: 3000 });
  }

  /**
   * Renseigne le mot de passe et sa confirmation (section "Sécurité", création uniquement)
   */
  async fillPasswords(password: string) {
    await this.passwordInput.fill(password);
    await this.repasswordInput.fill(password);
  }

  /**
   * Remplit l'ensemble du formulaire de création avec un rôle non-soignant
   * (le rôle "soignant" est de toute façon absent de ce sélecteur, ce qui
   * évite l'apparition du champ "Choisir le(s) spécialité(s)")
   */
  async fillCreationForm(data: AccountData, roleName: string) {
    await this.fillIdentity({ login: data.login, firstName: data.firstName, lastName: data.lastName });
    await this.selectRole(roleName);
    await this.fillPasswords(data.password);
  }

  /**
   * Enregistre le formulaire.
   * - En création, un succès entraîne un rechargement complet de la page (côté app).
   * - En modification, le modal se ferme simplement (pas de rechargement complet).
   */
  async save() {
    if (this.mode === 'create') {
      // Le clic déclenche un window.location.reload() sur la même URL : il faut enregistrer
      // l'attente AVANT le clic, sinon waitForLoadState/waitForURL peuvent se résoudre
      // instantanément sur l'état de chargement déjà atteint par la page courante (aucune
      // navigation détectée), et le test continue alors qu'un rechargement est en cours.
      await Promise.all([
        this.page.waitForURL('**/account/accounts', { waitUntil: 'load' }),
        this.saveButton.click(),
      ]);
    } else {
      await this.saveButton.click();
      await this.root.waitFor({ state: 'hidden', timeout: 10000 });
    }
  }

  async close() {
    await this.closeButton.click();
  }
}
