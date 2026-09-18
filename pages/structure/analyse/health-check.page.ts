// pages/structure/analyse/health-check.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page objet pour la liste des bilans d'un patient (/health-check/health-checks/:id)
 * et le formulaire de création d'un bilan (modal #createBilanModal).
 */
export class HealthChecksListPage {
  private readonly bilanAnalysesQuickLink: Locator;
  private readonly listHeading: Locator;
  private readonly newBilanButton: Locator;
  private readonly tableRows: Locator;

  // Modal "Ajouter Bilan"
  private readonly modal: Locator;
  private readonly modalHeading: Locator;
  private readonly prescripteurSelect: Locator;
  private readonly typeBilanSelect: Locator;
  private readonly diagnosticInput: Locator;
  private readonly cancelButton: Locator;
  private readonly saveButton: Locator;
  private readonly successAlert: Locator;

  constructor(private readonly page: Page) {
    // Lien "Bilan d'analyses" du bloc "Prestation Médicale" du dashboard patient. Si le patient a
    // déjà un bilan, un second lien "Bilan d'analyses 1" (raccourci vers ce bilan précis) apparaît
    // et matche aussi la regex : on cible la classe stable "qa-bilan" du bouton générique.
    this.bilanAnalysesQuickLink = page.locator('a.qa-bilan');
    this.listHeading = page.getByRole('heading', { name: /Liste des bilans d'analyses/ });
    this.newBilanButton = page.getByRole('button', { name: /Nouveau bilan/ });
    this.tableRows = page.locator('table.data-table tbody tr');

    this.modal = page.locator('#createBilanModal');
    this.modalHeading = this.modal.getByRole('heading', { name: /Ajouter Bilan/ });
    // Les ng-select portent l'attribut "name" transmis tel quel sur l'élément hôte : ciblage
    // fiable, indépendant du placeholder affiché.
    this.prescripteurSelect = this.modal.locator('ng-select[name="caregiverId"]');
    this.typeBilanSelect = this.modal.locator('ng-select[name="type"]');
    this.diagnosticInput = this.modal.getByPlaceholder('Saisir le diagnostic');
    this.cancelButton = this.modal.getByRole('button', { name: /Annuler/ });
    this.saveButton = this.modal.getByRole('button', { name: /Enregistrer/ });
    this.successAlert = this.modal.getByText('Le bilan a été bien enregistré');
  }

  async goToHealthChecksList() {
    await this.bilanAnalysesQuickLink.click();
    await expect(this.listHeading).toBeVisible();
  }

  async openNewBilanModal() {
    await this.newBilanButton.click();
    await expect(this.modalHeading).toBeVisible();
  }

  /** Sélectionne la première option du ng-select "Prescripteur *" et retourne son libellé. */
  async selectFirstPrescripteur(): Promise<string> {
    return this.selectFirstNgOption(this.prescripteurSelect);
  }

  /** Sélectionne la première option du ng-select "Type de bilan *" et retourne son libellé. */
  async selectFirstTypeBilan(): Promise<string> {
    return this.selectFirstNgOption(this.typeBilanSelect);
  }

  async fillDiagnostic(text: string) {
    await this.diagnosticInput.fill(text);
  }

  async saveBilan() {
    await this.saveButton.click();
    await expect(this.successAlert).toBeVisible();
    // Le composant ferme la modale ~1s après le succès (setTimeout côté Angular).
    await expect(this.modal).toBeHidden({ timeout: 8000 });
  }

  /** Retourne la liste des N° de bulletin actuellement affichés (1ère colonne). */
  async getBilanOrderNumbers(): Promise<string[]> {
    const count = await this.tableRows.count();
    const numbers: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = (await this.tableRows.nth(i).locator('td').first().textContent())?.trim() || '';
      numbers.push(text);
    }
    return numbers;
  }

  /** Ouvre le détail du bilan identifié par son N° de bulletin (colonne "N°"). */
  async openBilanByOrderNumber(medicalOrder: string) {
    const row = this.tableRows.filter({ hasText: medicalOrder }).first();
    await expect(row).toBeVisible();
    // La navigation se fait via [routerLink] sur les cellules, il n'y a pas de bouton "Voir".
    await row.locator('td').first().click();
  }

  private async selectFirstNgOption(ngSelect: Locator): Promise<string> {
    await ngSelect.click();
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

/**
 * Page objet pour le détail d'un bilan (/health-check/health-check/:id/:healthcheckID),
 * incluant le bulletin d'analyses (app-analyses) : ajout et suppression d'une analyse.
 */
export class HealthCheckDetailPage {
  private readonly detailHeading: Locator;
  private readonly addAnalyseButton: Locator;
  private readonly analysesTableRows: Locator;
  private readonly confirmButton: Locator;
  private readonly deleteConfirmText: Locator;

  // Modal "Ajouter analyse"
  private readonly modal: Locator;
  private readonly modalHeading: Locator;
  private readonly consultantSelect: Locator;
  private readonly analysesMultiSelect: Locator;
  private readonly cancelButton: Locator;
  private readonly saveButton: Locator;
  private readonly successAlert: Locator;

  constructor(private readonly page: Page) {
    this.detailHeading = page.getByRole('heading', { name: /Détail bilan d'analyses/ });
    this.addAnalyseButton = page.locator('.analyses-modern').getByRole('button', { name: /Ajouter analyse/ });
    this.analysesTableRows = page.locator('.analyses-modern table.table-modern tbody tr.table-row');
    this.confirmButton = page.getByRole('button', { name: 'Confirmer' });
    this.deleteConfirmText = page.getByText(/retirer cette analyse/i);

    this.modal = page.locator('#createAnalyseModal');
    this.modalHeading = this.modal.getByRole('heading', { name: /Ajouter analyse/ });
    this.consultantSelect = this.modal.locator('ng-select[name="caregiverId"]');
    this.analysesMultiSelect = this.modal.locator('ng-select[name="analyses"]');
    this.cancelButton = this.modal.getByRole('button', { name: /Annuler/ });
    this.saveButton = this.modal.getByRole('button', { name: /Enregistrer/ });
    this.successAlert = this.modal.getByText("L'analyse a été bien enregistré");
  }

  async expectDetailLoaded() {
    await expect(this.detailHeading).toBeVisible();
  }

  async openAddAnalyseModal() {
    await this.addAnalyseButton.click();
    await expect(this.modalHeading).toBeVisible();
  }

  /** Sélectionne la première option du ng-select "Nom du Consultant *" et retourne son libellé. */
  async selectFirstConsultant(): Promise<string> {
    return this.selectFirstOption(this.consultantSelect, false);
  }

  /** Sélectionne la première option du ng-select multiple "Choisir des analyses *". */
  async selectFirstAnalyse(): Promise<string> {
    return this.selectFirstOption(this.analysesMultiSelect, true);
  }

  async saveAnalyse() {
    await this.saveButton.click();
    await expect(this.successAlert).toBeVisible();
    await expect(this.modal).toBeHidden({ timeout: 8000 });
  }

  async getAnalyseRowCount(): Promise<number> {
    return this.analysesTableRows.count();
  }

  /**
   * Attend (avec réessais, contrairement à getAnalyseRowCount) que le tableau des analyses
   * affiche exactement `count` lignes : la mise à jour de la liste après ajout/suppression
   * n'est pas garantie synchrone avec la fermeture de la modale ou du dialogue de confirmation.
   */
  async expectAnalyseRowCount(count: number, timeout = 10000) {
    await expect(this.analysesTableRows).toHaveCount(count, { timeout });
  }

  /**
   * Supprime la première analyse listée (confirmation via la modale d'avertissement générique).
   * Retourne le libellé (type) de l'analyse supprimée.
   */
  async deleteFirstAnalyse(): Promise<string> {
    const row = this.analysesTableRows.first();
    await expect(row).toBeVisible();
    const label = (await row.locator('td').first().textContent())?.trim() || '';
    await row.locator('button.btn-danger-modern').click();
    await expect(this.deleteConfirmText).toBeVisible();
    await this.confirmButton.click();
    return label;
  }

  private async selectFirstOption(ngSelect: Locator, multiple: boolean): Promise<string> {
    await ngSelect.click();
    const panel = this.page.locator('.ng-dropdown-panel:visible');
    await panel.waitFor({ state: 'visible', timeout: 5000 });
    const option = this.page.locator('.ng-dropdown-panel .ng-option').first();
    await expect(option).toBeVisible();
    const label = (await option.textContent())?.replace(/\s+/g, ' ').trim() || '';
    await option.click();
    if (multiple) {
      // Un ng-select multiple ne se referme pas automatiquement après un clic sur une option.
      // Contrairement au modal de création de compte (data-keyboard="false"), #createAnalyseModal
      // se ferme sur Échap : un clic ailleurs dans le modal (sans rien déclencher) est donc
      // préférable pour simplement fermer le panneau du ng-select sans fermer le modal parent.
      await this.modalHeading.click();
    } else {
      await panel.waitFor({ state: 'hidden', timeout: 3000 });
    }
    return label;
  }
}
