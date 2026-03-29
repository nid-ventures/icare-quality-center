import { type Page, type Locator, expect } from '@playwright/test';

export class UtilisateursPage {
  private readonly tableBody: Locator;
  private readonly addAdminButton: Locator;
  private readonly nomField: Locator;
  private readonly prenomField: Locator;
  private readonly usernameField: Locator;
  private readonly passwordField: Locator;
  private readonly submitButton: Locator;

  constructor(private readonly page: Page) {
    this.tableBody = page.locator('tbody');
    this.addAdminButton = page.getByRole('button', { name: 'Ajouter un admininistrateur' });
    this.nomField = page.getByRole('textbox', { name: 'Entrer le nom', exact: true });
    this.prenomField = page.getByRole('textbox', { name: 'Entrer le prenom' });
    this.usernameField = page.getByRole('textbox', { name: "Entrer le nom d'utilisateur" });
    this.passwordField = page.getByRole('textbox', { name: 'Entrer le mot de passe' });
    this.submitButton = page.getByRole('button', { name: 'Ajouter' });
  }

  async expectUserVisible(userName: string) {
    await expect(this.tableBody).toContainText(userName);
  }

  async addAdmin(data: { nom: string; prenom: string; structure: string; username: string; password: string }) {
    await this.addAdminButton.click();
    await this.nomField.fill(data.nom);
    await this.prenomField.fill(data.prenom);
    // Structure dropdown (react-select)
    await this.page.locator('div:nth-child(4) > .focus\\:border-\\[\\#ff8041\\] > .css-13cymwt-control > .css-hlgwow > .css-19bb58m').click();
    await this.page.getByRole('option', { name: data.structure }).click();
    await this.usernameField.fill(data.username);
    await this.passwordField.fill(data.password);
    await this.submitButton.click();
  }
}
