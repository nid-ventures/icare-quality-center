import { type Page, type Locator, expect } from '@playwright/test';

export class MedecinsPage {
  private readonly tableBody: Locator;
  private readonly firstNameField: Locator;
  private readonly searchButton: Locator;
  private readonly addDoctorButton: Locator;
  private readonly nomField: Locator;
  private readonly prenomField: Locator;
  private readonly tempsField: Locator;
  private readonly usernameField: Locator;
  private readonly passwordField: Locator;
  private readonly colorInput: Locator;
  private readonly submitButton: Locator;

  constructor(private readonly page: Page) {
    this.firstNameField = page.getByRole('textbox', { name: 'Rechercher par nom' });
    this.searchButton = page.getByRole('button', { name: 'Rechercher' });
    this.tableBody = page.locator('tbody');
    this.addDoctorButton = page.getByRole('button', { name: 'Ajouter un nouveau docteur' });
    this.nomField = page.getByRole('textbox', { name: 'Entrer le nom', exact: true });
    this.prenomField = page.getByRole('textbox', { name: 'Entrer le prenom' });
    this.tempsField = page.getByRole('textbox', { name: 'Entrer le temps' });
    this.usernameField = page.getByRole('textbox', { name: "Entrer le nom d'utilisateur" });
    this.passwordField = page.getByRole('textbox', { name: 'Entrer le mot de passe' });
    this.colorInput = page.locator('#color');
    this.submitButton = page.getByRole('button', { name: 'Ajouter' });
  }

  async searchMedecin(medecinName: string) {
    await this.firstNameField.fill(medecinName);
    await this.searchButton.click();
  }

  async expectMedecinVisible(medecinCompletName: string) {
    await expect(this.tableBody).toContainText(medecinCompletName);
  }

  async addMedecin(data: {
    nom: string;
    prenom: string;
    temps: string;
    specialite: string;
    structure: string;
    username: string;
    password: string;
    color: string;
  }) {
    await this.addDoctorButton.click();
    await this.nomField.fill(data.nom);
    await this.prenomField.fill(data.prenom);
    await this.tempsField.fill(data.temps);
    // Spécialité dropdown (react-select)
    await this.page.locator('div:nth-child(5) > div:nth-child(2) > .focus\\:border-\\[\\#ff8041\\] > .css-13cymwt-control > .css-hlgwow > .css-19bb58m').click();
    await this.page.getByRole('option', { name: data.specialite }).click();
    // Structure dropdown (react-select)
    await this.page.locator('div:nth-child(6) > .focus\\:border-\\[\\#ff8041\\] > .css-13cymwt-control > .css-hlgwow > .css-19bb58m').click();
    await this.page.getByRole('option', { name: data.structure }).click();
    await this.usernameField.fill(data.username);
    await this.passwordField.fill(data.password);
    await this.submitButton.click();
    // Color picker step
    await this.colorInput.fill(data.color);
    await this.submitButton.click();
  }
}
