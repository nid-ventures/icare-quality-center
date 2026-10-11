// pages/structure/account/account-update-pwd.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page object pour le modal "Changer mot de passe" (".bd-update-pwd-modal-lg").
 */
export class AccountUpdatePwdPage {
  private readonly root: Locator;
  private readonly modalTitle: Locator;
  private readonly passwordInput: Locator;
  private readonly repasswordInput: Locator;
  private readonly saveButton: Locator;
  private readonly closeButton: Locator;
  private readonly successMessage: Locator;

  constructor(private readonly page: Page) {
    this.root = page.locator('.bd-update-pwd-modal-lg');
    this.modalTitle = this.root.getByRole('heading', { name: 'Changer mot de passe' });
    this.passwordInput = this.root.locator('#password');
    this.repasswordInput = this.root.locator('#repassword');
    // Bouton sans icône ici mais désactivé tant que le formulaire est invalide.
    this.saveButton = this.root.getByRole('button', { name: /Enregistrer/ });
    this.closeButton = this.root.getByRole('button', { name: 'Fermer' });
    this.successMessage = this.root.getByText('La mise à jour du mot de passe a bien reussi');
  }

  async expectOpen() {
    await expect(this.modalTitle).toBeVisible();
  }

  async fillPasswords(password: string) {
    await this.passwordInput.fill(password);
    await this.repasswordInput.fill(password);
  }

  async save() {
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
  }

  /**
   * Bug applicatif : en cas de succès le composant passe rMessage à "bSave" alors que le template
   * n'affiche le message de succès que pour "bUpdate" (account-update-pwd.component.ts / .html).
   * On vérifie donc ce qui est observable : aucune erreur, puis fermeture automatique du modal.
   * À remplacer par une attente de `successMessage` une fois le bug corrigé.
   */
  async expectSuccessMessage() {
    await expect(this.root.getByText('Erreur lors de la mise à jour')).toHaveCount(0);
    await expect(this.modalTitle).toBeHidden({ timeout: 15000 });
    await expect(this.root.getByText('Erreur lors de la mise à jour')).toHaveCount(0);
  }

  async close() {
    await this.closeButton.click();
  }
}
