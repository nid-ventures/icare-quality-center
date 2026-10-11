// pages/structure/account/account-list.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

export class AccountListPage {
  private readonly usersNavLink: Locator;

  // Formulaire de recherche
  private readonly searchLoginInput: Locator;
  private readonly searchNomInput: Locator;
  private readonly searchPrenomInput: Locator;
  private readonly searchDateCreationInput: Locator;
  private readonly searchRoleSelect: Locator;
  private readonly searchEtatSelect: Locator;
  private readonly searchTailleSelect: Locator;
  private readonly resetButton: Locator;
  private readonly searchButton: Locator;

  // En-tête et tableau
  private readonly listHeading: Locator;
  private readonly newUserButton: Locator;
  private readonly table: Locator;
  private readonly columnheaderLogin: Locator;
  private readonly columnheaderNom: Locator;
  private readonly columnheaderPrenom: Locator;
  private readonly columnheaderRoles: Locator;
  private readonly columnheaderEtatActuel: Locator;
  private readonly columnheaderDateCreation: Locator;
  private readonly columnheaderMiseAJour: Locator;
  private readonly columnheaderChangerEtat: Locator;
  private readonly columnheaderMotDePasse: Locator;

  // Modal changement d'état (confirmation générique)
  private readonly confirmModalBody: Locator;
  private readonly confirmButton: Locator;
  private readonly fermerConfirmButton: Locator;

  constructor(private readonly page: Page) {
    // Entrée "Utilisateurs" du menu latéral du module Administration.
    this.usersNavLink = page.locator('nav.iq-sidebar-menu').getByRole('link', { name: /Utilisateurs$/ });

    this.searchLoginInput = page.getByPlaceholder('Login...');
    // "Nom..." sans exact:true matche aussi le placeholder "Prénom..." (substring "nom...").
    this.searchNomInput = page.getByPlaceholder('Nom...', { exact: true });
    this.searchPrenomInput = page.getByPlaceholder('Prénom...');
    this.searchDateCreationInput = page.locator('.search-form input[name="createdDate"]');
    // ng-select n'expose pas de rôle accessible standard : ciblage CSS via l'attribut name statique.
    this.searchRoleSelect = page.locator('.search-form ng-select[name="roleId"]');
    this.searchEtatSelect = page.locator('.search-form ng-select[name="active"]');
    this.searchTailleSelect = page.locator('.search-form ng-select[name="size"]');
    // Icônes précédant le texte des boutons : usage d'une regex partielle plutôt qu'un nom exact.
    this.resetButton = page.getByRole('button', { name: /Réinitialiser/ });
    this.searchButton = page.getByRole('button', { name: /Rechercher/ });

    this.listHeading = page.getByRole('heading', { name: /Liste des utilisateurs/ });
    this.newUserButton = page.getByRole('button', { name: /Nouvel utilisateur/ });
    this.table = page.locator('table.table-modern');
    this.columnheaderLogin = page.getByRole('columnheader', { name: 'Login' });
    this.columnheaderNom = page.getByRole('columnheader', { name: 'Nom', exact: true });
    this.columnheaderPrenom = page.getByRole('columnheader', { name: 'Prénom' });
    this.columnheaderRoles = page.getByRole('columnheader', { name: 'Rôle(s)' });
    this.columnheaderEtatActuel = page.getByRole('columnheader', { name: 'État actuel' });
    this.columnheaderDateCreation = page.getByRole('columnheader', { name: 'Date de création' });
    this.columnheaderMiseAJour = page.getByRole('columnheader', { name: 'Mise à jour' });
    this.columnheaderChangerEtat = page.getByRole('columnheader', { name: 'Changer état' });
    this.columnheaderMotDePasse = page.getByRole('columnheader', { name: 'Mot de passe' });

    this.confirmModalBody = page.getByText(/voulez-vous changer l.état/i);
    this.confirmButton = page.getByRole('button', { name: 'Confirmer' });
    this.fermerConfirmButton = page.getByRole('button', { name: 'Fermer' });
  }

  /**
   * Accède à la liste des utilisateurs depuis le dashboard (module "Utilisateurs")
   */
  async goto() {
    await expect(this.usersNavLink).toBeVisible();
    await this.usersNavLink.click();
    await this.page.waitForURL('**/account/accounts');
  }

  /**
   * Vérifie que la page "Liste des utilisateurs" est bien chargée avec ses éléments principaux
   */
  async expectListLoaded() {
    await expect(this.listHeading).toBeVisible();
    await expect(this.newUserButton).toBeVisible();

    await expect(this.searchLoginInput).toBeVisible();
    await expect(this.searchNomInput).toBeVisible();
    await expect(this.searchPrenomInput).toBeVisible();
    await expect(this.searchDateCreationInput).toBeVisible();
    await expect(this.searchRoleSelect).toBeVisible();
    await expect(this.searchEtatSelect).toBeVisible();
    await expect(this.searchTailleSelect).toBeVisible();
    await expect(this.resetButton).toBeVisible();
    await expect(this.searchButton).toBeVisible();

    await expect(this.columnheaderLogin).toBeVisible();
    await expect(this.columnheaderNom).toBeVisible();
    await expect(this.columnheaderPrenom).toBeVisible();
    await expect(this.columnheaderRoles).toBeVisible();
    await expect(this.columnheaderEtatActuel).toBeVisible();
    await expect(this.columnheaderDateCreation).toBeVisible();
    await expect(this.columnheaderMiseAJour).toBeVisible();
    await expect(this.columnheaderChangerEtat).toBeVisible();
    await expect(this.columnheaderMotDePasse).toBeVisible();
  }

  /**
   * Recherche un utilisateur par son login puis lance la recherche
   */
  async searchByLogin(login: string) {
    await this.searchLoginInput.fill(login);
    await this.searchButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Recherche par login avec le filtre "État" (Active / Désactive). Le filtre vaut "Active" par
   * défaut : un utilisateur désactivé n'apparaît qu'avec "Désactive".
   */
  async searchByLoginAndState(login: string, state: 'Active' | 'Désactive') {
    const stateSelect = this.page.locator('ng-select[name="active"]');
    await stateSelect.click();
    await this.page.getByRole('option', { name: state, exact: true }).click();
    await this.searchByLogin(login);
  }

  async resetSearch() {
    await this.resetButton.click();
  }

  /**
   * Retourne la ligne du tableau correspondant à un login donné (recherche préalable conseillée)
   */
  getRowByLogin(login: string): Locator {
    return this.table.locator('tbody tr').filter({ hasText: login });
  }

  /**
   * Vérifie qu'un utilisateur avec ce login est bien présent dans le tableau
   */
  async expectUserInList(login: string) {
    await expect(this.getRowByLogin(login)).toBeVisible();
  }

  /**
   * Ouvre le popup de création d'un nouvel utilisateur
   */
  async openCreateModal() {
    await this.newUserButton.click();
    await this.page.locator('.bd-prsnl-modal-lg.show, .bd-prsnl-modal-lg.in').waitFor({ state: 'visible' });
  }

  /**
   * Ouvre le popup de modification d'un utilisateur à partir de son login (recherche préalable conseillée)
   */
  async openUpdateModal(login: string) {
    const row = this.getRowByLogin(login);
    await expect(row).toBeVisible();
    // 3 boutons d'action par ligne partagent la classe "btn-icon-modern" : Mise à jour (0), Changer état (1), Mot de passe (2)
    await row.locator('button.btn-icon-modern').nth(0).click();
    await this.page.locator('.bd-update-prsnl-modal-lg.show, .bd-update-prsnl-modal-lg.in').waitFor({ state: 'visible' });
  }

  /**
   * Ouvre le popup de changement de mot de passe d'un utilisateur à partir de son login
   */
  async openPasswordModal(login: string) {
    const row = this.getRowByLogin(login);
    await expect(row).toBeVisible();
    await row.locator('button.btn-icon-modern').nth(2).click();
    await this.page.locator('.bd-update-pwd-modal-lg.show, .bd-update-pwd-modal-lg.in').waitFor({ state: 'visible' });
  }

  /**
   * Récupère le texte de l'état actuel affiché ("Active" / "Désactive") pour un login donné
   */
  async getEtatText(login: string): Promise<string> {
    const row = this.getRowByLogin(login);
    const text = await row.locator('td').nth(4).innerText();
    return text.trim();
  }

  /**
   * Change l'état (Active/Désactive) d'un utilisateur via l'icône cadenas de sa ligne,
   * puis confirme la popup d'avertissement. La sauvegarde entraîne un rechargement complet
   * de la page (window.location.reload() côté application).
   */
  async toggleState(login: string) {
    const row = this.getRowByLogin(login);
    await expect(row).toBeVisible();
    await row.locator('button.btn-icon-modern').nth(1).click();

    await expect(this.confirmModalBody).toBeVisible();
    await expect(this.confirmButton).toBeVisible();
    await this.confirmButton.click();

    // L'application recharge entièrement la page après le changement d'état.
    await this.page.waitForLoadState('load');
    await this.usersNavLink.waitFor({ state: 'visible' });
  }

  /**
   * Sélectionne une option dans un ng-select en normalisant le texte comparé
   * (technique reprise de ConsultationPage.selectAndVerify)
   */
  async selectSearchNgOption(ngSelect: Locator, value: string, fieldName: string) {
    await ngSelect.click();
    const panel = this.page.locator('.ng-dropdown-panel:visible');
    await panel.waitFor({ state: 'visible', timeout: 5000 });
    const options = this.page.locator('.ng-dropdown-panel .ng-option');

    const normalizedValue = value.replace(/\s+/g, ' ').trim();

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
      throw new Error(`Option "${value}" introuvable dans ${fieldName}. Trouvé : ${JSON.stringify(allTexts)}`);
    }

    await this.page.locator('.ng-dropdown-panel:visible').waitFor({ state: 'hidden', timeout: 3000 });
  }

  get roleSelect(): Locator {
    return this.searchRoleSelect;
  }

  get etatSelect(): Locator {
    return this.searchEtatSelect;
  }
}
