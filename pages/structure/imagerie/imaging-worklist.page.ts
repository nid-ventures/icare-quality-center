// pages/structure/imagerie/imaging-worklist.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

export type ImagingRowKind = 'echographie' | 'imaging';

export class ImagingWorklistPage {
  // Navigation (le lien du menu latéral n'a pas de classe distinctive : on cible le href
  // résolu par RouterLink, plus robuste que le texte qui peut porter une icône collée).
  readonly worklistNavLink: Locator;

  // Formulaire de recherche
  readonly searchFormToggleButton: Locator;
  readonly folderOrderInput: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly doBInput: Locator;
  readonly caregiverSelect: Locator;
  readonly pageSizeSelect: Locator;
  readonly cancelButton: Locator;
  readonly searchButton: Locator;
  readonly refreshButton: Locator;

  // Liste des résultats
  readonly listHeading: Locator;
  readonly errorAlert: Locator;
  readonly loadingIndicator: Locator;
  readonly columnPatient: Locator;
  readonly columnFolderOrder: Locator;
  readonly columnDateNaissance: Locator;
  readonly columnExamen: Locator;
  readonly columnPrescripteur: Locator;
  readonly columnDate: Locator;
  readonly columnActions: Locator;
  readonly tableRows: Locator;
  readonly emptyRow: Locator;

  // Modale de confirmation générique (src/app/shared/modal/modal.component.html)
  readonly confirmButton: Locator;
  readonly fermerConfirmationButton: Locator;

  constructor(private readonly page: Page) {
    this.worklistNavLink = page.locator('a[href*="imagerie/worklist"]');

    this.searchFormToggleButton = page.locator('button.btn-search-toggle');
    this.folderOrderInput = page.locator('#criteria-folderOrder');
    this.firstNameInput = page.locator('#criteria-firstName');
    this.lastNameInput = page.locator('#criteria-lastName');
    this.doBInput = page.locator('#criteria-doB');
    // ng-select (Angular) sans nom accessible dédié -> ciblage CSS par id.
    this.caregiverSelect = page.locator('ng-select#caregiver-select');
    this.pageSizeSelect = page.locator('#pageSizeSelect');
    // "Annuler" et "Actualiser" partagent la même classe .btn-modern et la même icône
    // ri-refresh-line : on les distingue par leur conteneur (.search-actions vs .compact-controls).
    this.cancelButton = page.locator('.search-actions button.btn-modern');
    this.searchButton = page.locator('.search-actions button.btn-save-modern');
    this.refreshButton = page.locator('.compact-controls button.btn-modern');

    this.listHeading = page.getByRole('heading', { name: /Liste des actes d'Imagerie/ });
    this.errorAlert = page.locator('.alert-danger');
    this.loadingIndicator = page.locator('.loading-state');
    this.columnPatient = page.getByRole('columnheader', { name: 'Patient' });
    this.columnFolderOrder = page.getByRole('columnheader', { name: 'N° dossier' });
    this.columnDateNaissance = page.getByRole('columnheader', { name: 'Date naiss.' });
    this.columnExamen = page.getByRole('columnheader', { name: 'Examen' });
    this.columnPrescripteur = page.getByRole('columnheader', { name: 'Prescripteur' });
    this.columnDate = page.getByRole('columnheader', { name: 'Date', exact: true });
    this.columnActions = page.getByRole('columnheader', { name: 'Actions' });
    // Table HTML classique sans rôle de ligne dédié -> ciblage CSS.
    this.tableRows = page.locator('table.compact-table tbody tr.table-row');
    this.emptyRow = page.getByText('Aucune demande correspondant aux critères.');

    this.confirmButton = page.getByRole('button', { name: 'Confirmer' });
    this.fermerConfirmationButton = page.getByRole('button', { name: 'Fermer', exact: true });
  }

  async goto() {
    await this.worklistNavLink.click();
    await this.page.waitForURL('**/imagerie/worklist');
    await expect(this.listHeading).toBeVisible();
    await this.waitForSettled();
  }

  async expectSearchFormVisible() {
    await expect(this.folderOrderInput).toBeVisible();
    await expect(this.firstNameInput).toBeVisible();
    await expect(this.lastNameInput).toBeVisible();
    await expect(this.doBInput).toBeVisible();
    await expect(this.caregiverSelect).toBeVisible();
    await expect(this.pageSizeSelect).toBeVisible();
  }

  async expectResultsTableVisible() {
    await expect(this.listHeading).toBeVisible();
    await expect(this.columnPatient).toBeVisible();
    await expect(this.columnFolderOrder).toBeVisible();
    await expect(this.columnDateNaissance).toBeVisible();
    await expect(this.columnExamen).toBeVisible();
    await expect(this.columnPrescripteur).toBeVisible();
    await expect(this.columnDate).toBeVisible();
    await expect(this.columnActions).toBeVisible();
  }

  // Attend la fin du chargement puis vérifie qu'aucune erreur n'est survenue et que la liste
  // s'est bien stabilisée (soit des lignes, soit le message "aucune demande").
  async waitForSettled() {
    await expect(this.loadingIndicator).toBeHidden({ timeout: 15000 });
    await expect(this.errorAlert).not.toBeVisible();
    await expect(this.tableRows.first().or(this.emptyRow)).toBeVisible();
  }

  async searchByFolderOrder(folderOrder: string) {
    await this.folderOrderInput.fill(folderOrder);
    await this.searchButton.click();
    await this.waitForSettled();
  }

  async searchByFirstName(firstName: string) {
    await this.firstNameInput.fill(firstName);
    await this.searchButton.click();
    await this.waitForSettled();
  }

  async searchByLastName(lastName: string) {
    await this.lastNameInput.fill(lastName);
    await this.searchButton.click();
    await this.waitForSettled();
  }

  async searchByFirstAndLastName(firstName: string, lastName: string) {
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.searchButton.click();
    await this.waitForSettled();
  }

  async searchByDateNaissance(isoDate: string) {
    await this.doBInput.fill(isoDate);
    await this.searchButton.click();
    await this.waitForSettled();
  }

  // Sélectionne le premier prescripteur disponible dans la liste (le référentiel du personnel
  // n'étant pas connu à l'avance) et retourne son libellé affiché.
  async searchByFirstAvailablePrescripteur(): Promise<string> {
    await this.caregiverSelect.click();
    const panel = this.page.locator('.ng-dropdown-panel');
    await panel.waitFor({ state: 'visible', timeout: 5000 });
    const firstOption = this.page.locator('.ng-dropdown-panel .ng-option').first();
    const label = (await firstOption.textContent())?.trim() ?? '';
    await firstOption.click();
    await this.searchButton.click();
    await this.waitForSettled();
    return label;
  }

  async resetSearch() {
    await this.cancelButton.click();
    await this.waitForSettled();
  }

  async refresh() {
    await this.refreshButton.click();
    await this.waitForSettled();
  }

  async getResultsCount(): Promise<number> {
    return await this.tableRows.count();
  }

  // Boutons "Consulter"/"Fermer" identifiés par leur attribut title -> getByTitle.
  async expandRow(row: Locator) {
    await row.getByTitle('Consulter').click();
  }

  async closeRow(row: Locator) {
    await row.getByTitle('Fermer').click();
  }

  // La ligne dépliée (formulaire inline) est la <tr> juste après la ligne cliquée.
  getExpandedRow(row: Locator): Locator {
    return row.locator('xpath=following-sibling::tr[1]');
  }

  // Parcourt les lignes visibles (dans la limite indiquée) et retourne la première dont le
  // formulaire déplié correspond au type d'imagerie recherché (app-echographie-simple-item ou
  // app-imaging-item), en repliant les lignes qui ne correspondent pas.
  //
  // Le endpoint `/imageries/filtering` interrogé par ce worklist est indexé de façon quasi
  // temps réel (pas immédiate) côté backend : juste après une création, l'acte peut ne pas
  // encore apparaître dans la liste. On retente donc quelques fois avec un rafraîchissement
  // entre chaque essai avant de conclure à une absence.
  async findFirstRowOfKind(
    kind: ImagingRowKind,
    limit: number = 10,
    retries: number = 5,
    retryDelayMs: number = 1500
  ): Promise<{ row: Locator; expandedRow: Locator } | null> {
    const componentSelector = kind === 'echographie' ? 'app-echographie-simple-item' : 'app-imaging-item';

    for (let attempt = 0; attempt <= retries; attempt++) {
      const count = Math.min(await this.tableRows.count(), limit);

      for (let i = 0; i < count; i++) {
        const row = this.tableRows.nth(i);
        await this.expandRow(row);
        const expandedRow = this.getExpandedRow(row);
        const matches = await expandedRow.locator(componentSelector).count();
        if (matches > 0) {
          return { row, expandedRow };
        }
        await this.closeRow(row);
      }

      if (attempt < retries) {
        await this.page.waitForTimeout(retryDelayMs);
        await this.refresh();
      }
    }
    return null;
  }

  private async selectNgOptionByText(ngSelectLocator: Locator, optionText: string) {
    await ngSelectLocator.click();
    await this.page.waitForSelector('.ng-dropdown-panel .ng-option', { timeout: 5000 });
    await this.page.locator(`.ng-dropdown-panel .ng-option:has-text("${optionText}")`).first().click();
  }

  // ===== Formulaire échographie déplié (app-echographie-simple-item) =====
  echoResumeInput(expandedRow: Locator): Locator {
    return expandedRow.locator('input[formcontrolname="conclusion"]');
  }
  echoCompteRenduTextarea(expandedRow: Locator): Locator {
    return expandedRow.locator('textarea[formcontrolname="notice"]');
  }
  // Bouton "Activer"/"Verrouiller" sans title -> le texte change dynamiquement, on matche les deux.
  echoActiverButton(expandedRow: Locator): Locator {
    return expandedRow.getByRole('button', { name: /Activer|Verrouiller/ });
  }
  echoSubmitButton(expandedRow: Locator): Locator {
    return expandedRow.getByRole('button', { name: /Mettre à jour l'échographie/ });
  }
  echoSupprimerButton(expandedRow: Locator): Locator {
    return expandedRow.getByRole('button', { name: /Supprimer/ });
  }

  // ===== Formulaire imagerie partagé déplié (app-imaging-item : scanner/irm/radiographie) =====
  imagingActiverButton(expandedRow: Locator): Locator {
    return expandedRow.getByRole('button', { name: /Activer|Verrouiller/ });
  }
  imagingSubmitButton(expandedRow: Locator): Locator {
    return expandedRow.getByRole('button', { name: /Mettre à jour/ });
  }
  imagingSupprimerButton(expandedRow: Locator): Locator {
    return expandedRow.getByRole('button', { name: /Supprimer/ });
  }

  // ===== Modale de confirmation partagée (AVERTISSEMENT / Fermer / Confirmer) =====
  async confirmModal() {
    await expect(this.confirmButton).toBeVisible();
    await this.confirmButton.click();
  }
}
