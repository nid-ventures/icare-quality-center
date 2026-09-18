// pages/structure/analyse/laboratory-worklist.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

export class LaboratoryWorklistPage {
  private readonly laboratoireNavLink: Locator;
  private readonly lastNameInput: Locator;
  private readonly firstNameInput: Locator;
  private readonly bulletinInput: Locator;
  private readonly folderOrderInput: Locator;
  private readonly typeSelect: Locator;
  private readonly prescriberSelect: Locator;
  private readonly dateInput: Locator;
  private readonly resetButton: Locator;
  private readonly searchButton: Locator;
  private readonly listHeading: Locator;
  private readonly loadingState: Locator;
  private readonly tableRows: Locator;
  private readonly emptyRowText: Locator;
  private readonly selectAllCheckbox: Locator;
  private readonly selectionBar: Locator;
  private readonly printSelectionButton: Locator;
  private readonly deselectButton: Locator;

  constructor(private readonly page: Page) {
    // Lien "Laboratoire" du menu latéral (icône dans le lien -> nom accessible non fiable, on
    // utilise donc une regex partielle plutôt qu'une correspondance exacte).
    this.laboratoireNavLink = page.getByRole('link', { name: /Laboratoire/ });

    const searchForm = page.locator('form.search-form');
    this.lastNameInput = page.locator('#criteria-lastName');
    this.firstNameInput = page.locator('#criteria-firstName');
    this.bulletinInput = page.locator('#criteria-bulletin');
    this.folderOrderInput = page.locator('#criteria-folderOrder');
    this.typeSelect = page.locator('#criteria-type');
    // ng-select ciblé par son id (pas de nom accessible standard exploitable).
    this.prescriberSelect = page.locator('ng-select#caregiver-select');
    this.dateInput = page.locator('#criteria-date');
    this.resetButton = searchForm.getByRole('button', { name: /Annuler/ });
    this.searchButton = searchForm.getByRole('button', { name: /Rechercher/ });

    this.listHeading = page.getByRole('heading', { name: /Liste des bilans d'analyses/ });
    this.loadingState = page.locator('.loading-state');
    this.tableRows = page.locator('table.compact-table tbody tr.table-row');
    this.emptyRowText = page.getByText('Aucun enregistrement');

    this.selectAllCheckbox = page.getByTitle('Tout sélectionner');
    this.selectionBar = page.locator('.selection-bar');
    this.printSelectionButton = this.selectionBar.getByRole('button', { name: /Imprimer la sélection/ });
    this.deselectButton = this.selectionBar.getByRole('button', { name: /Désélectionner/ });
  }

  async gotoWorklist() {
    await this.laboratoireNavLink.click();
    await expect(this.listHeading).toBeVisible();
    await this.waitForResults();
  }

  async searchByLastName(value: string) {
    await this.lastNameInput.fill(value);
    await this.search();
  }

  async searchByFirstName(value: string) {
    await this.firstNameInput.fill(value);
    await this.search();
  }

  async search() {
    await this.searchButton.click();
    await this.waitForResults();
  }

  async reset() {
    await this.resetButton.click();
    await this.waitForResults();
  }

  async expectEmptyResults() {
    await expect(this.emptyRowText).toBeVisible();
  }

  /**
   * Sélectionne la première option réelle (hors "Tous les types") du select natif "Type de bilan"
   * et lance la recherche. Retourne le libellé sélectionné.
   */
  async filterByFirstAvailableType(): Promise<string> {
    const optionsCount = await this.typeSelect.locator('option').count();
    expect(optionsCount).toBeGreaterThan(1);
    const label = (await this.typeSelect.locator('option').nth(1).textContent())?.replace(/\s+/g, ' ').trim() || '';
    await this.typeSelect.selectOption({ index: 1 });
    await this.search();
    return label;
  }

  /**
   * Sélectionne la première option du ng-select "Prescripteur" et lance la recherche.
   * Retourne le nom complet sélectionné.
   */
  async filterByFirstAvailablePrescriber(): Promise<string> {
    const label = await this.selectFirstNgOption(this.prescriberSelect);
    await this.search();
    return label;
  }

  async expectResultsMatchType(typeLabel: string) {
    const rows = await this.tableRows.count();
    if (rows === 0) {
      await this.expectEmptyResults();
      return;
    }
    for (let i = 0; i < rows; i++) {
      await expect(this.tableRows.nth(i).locator('td').nth(7)).toContainText(typeLabel, { ignoreCase: true });
    }
  }

  /**
   * Vérifie que chaque ligne affichée correspond bien au nom de patient recherché (colonne
   * "Patient"), ou que le tableau est vide si aucun bilan ne concerne ce patient.
   */
  async expectResultsMatchLastName(lastName: string) {
    const rows = await this.tableRows.count();
    if (rows === 0) {
      await this.expectEmptyResults();
      return;
    }
    for (let i = 0; i < rows; i++) {
      await expect(this.tableRows.nth(i).locator('td').nth(1)).toContainText(lastName, { ignoreCase: true });
    }
  }

  async expectResultsMatchPrescriber(prescriberLabel: string) {
    const rows = await this.tableRows.count();
    if (rows === 0) {
      await this.expectEmptyResults();
      return;
    }
    for (let i = 0; i < rows; i++) {
      await expect(this.tableRows.nth(i).locator('td').nth(8)).toContainText(prescriberLabel, { ignoreCase: true });
    }
  }

  async getRowCount(): Promise<number> {
    return this.tableRows.count();
  }

  async selectRow(index: number) {
    // Le flyout de la sidebar ("Imagerie") peut s'ouvrir au survol et rester affiché par-dessus
    // la colonne de gauche : un clic positionnel (même forcé) atterrit sur le flyout, pas sur la
    // checkbox. On invoque directement .click() sur l'élément DOM pour contourner le hit-test.
    const checkbox = this.tableRows.nth(index).locator('input[type="checkbox"]');
    await checkbox.evaluate((el: HTMLInputElement) => el.click());
    await expect(checkbox).toBeChecked();
  }

  async selectAllVisible() {
    await this.selectAllCheckbox.check();
  }

  async expectSelectionBarVisible(count: number) {
    await expect(this.selectionBar).toBeVisible();
    await expect(this.selectionBar).toContainText(`${count} bilan(s) sélectionné(s)`);
    await expect(this.printSelectionButton).toBeVisible();
    await expect(this.printSelectionButton).toBeEnabled();
  }

  async deselectAll() {
    await this.deselectButton.click();
    await expect(this.selectionBar).toBeHidden();
  }

  async openFirstResult() {
    const firstRow = this.tableRows.first();
    await expect(firstRow).toBeVisible();
    // La navigation se fait via [routerLink] sur les cellules (title="Cliquer pour voir le détail"),
    // il n'y a pas de bouton "Voir" dédié.
    await firstRow.locator('td').first().click();
  }

  private async waitForResults() {
    await expect(this.loadingState).toHaveCount(0, { timeout: 10000 });
  }

  /**
   * Ouvre un ng-select et clique sur la première option disponible du panneau déroulant.
   * Retourne le libellé de l'option sélectionnée. Réutilise la technique robuste de sélection
   * d'options ng-select déjà utilisée dans ConsultationPage.
   */
  private async selectFirstNgOption(ngSelect: Locator): Promise<string> {
    await ngSelect.locator('.ng-select-container').click();
    const panel = this.page.locator('.ng-dropdown-panel:visible');
    await panel.waitFor({ state: 'visible', timeout: 5000 });
    const option = this.page.locator('.ng-dropdown-panel .ng-option').first();
    await expect(option).toBeVisible();
    const label = (await option.textContent())?.replace(/\s+/g, ' ').trim() || '';
    await option.click();
    await panel.waitFor({ state: 'hidden', timeout: 3000 });
    return label;
  }
}
