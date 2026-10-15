// pages/structure/my-space/reporting.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Reporting médical (`/my-space/reporting/prestations`, `MedicalActsComponent`) : 4 onglets
 * (Consultations/Imagerie/Bilans/Vaccinations) et la modale d'export commune aux 4 sources.
 * Seul l'onglet Consultations est manipulé par les tests de ce module (les 3 autres onglets
 * restent visibles/dénombrés mais leurs filtres ne sont pas exercés ici).
 */
export class MedicalActsReportingPage {
  private readonly page: Page;

  private readonly heading: Locator;
  private readonly exportButton: Locator;

  private readonly tabConsultations: Locator;
  private readonly tabImagerie: Locator;
  private readonly tabBilans: Locator;
  private readonly tabVaccinations: Locator;

  // Onglet Consultations : filtres (le pane est identifié par son en-tête "Filtres des consultations"
  // afin d'éviter toute ambiguïté avec les 3 autres tab-panes, tous présents dans le DOM en même temps).
  private readonly consultationPane: Locator;
  private readonly consultantSelect: Locator;
  private readonly dateDebutInput: Locator;
  private readonly dateFinInput: Locator;
  private readonly tailleListeSelect: Locator;
  private readonly typeConsultationSelect: Locator;
  private readonly rechercherConsultationsButton: Locator;
  private readonly reinitialiserConsultationsButton: Locator;
  private readonly consultationValidationMessage: Locator;

  // Modale d'export ("Options d'exportation")
  private readonly exportModal: Locator;
  private readonly exportModalHeading: Locator;
  private readonly exportDateStartInput: Locator;
  private readonly exportDateEndInput: Locator;
  private readonly dhis2Fields: Locator;
  private readonly exportSummary: Locator;
  private readonly exportAnnulerButton: Locator;
  private readonly exportTelechargerButton: Locator;
  private readonly exportSubCategoryLabel: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole('heading', { name: 'Reporting Médical' });
    this.exportButton = page.getByRole('button', { name: /Exporter/ });

    this.tabConsultations = page.locator('.tabs-nav .tab-btn').filter({ hasText: 'Consultations' });
    this.tabImagerie = page.locator('.tabs-nav .tab-btn').filter({ hasText: 'Imagerie' });
    this.tabBilans = page.locator('.tabs-nav .tab-btn').filter({ hasText: 'Bilans' });
    this.tabVaccinations = page.locator('.tabs-nav .tab-btn').filter({ hasText: 'Vaccinations' });

    this.consultationPane = page.locator('.tab-pane').filter({ hasText: 'Filtres des consultations' });
    this.consultantSelect = this.consultationPane.locator('ng-select').nth(0);
    this.dateDebutInput = page.locator('#dateStard');
    this.dateFinInput = page.locator('#dateEnd');
    this.tailleListeSelect = this.consultationPane.locator('ng-select').nth(1);
    this.typeConsultationSelect = this.consultationPane.locator('ng-select').nth(2);
    this.rechercherConsultationsButton = page.getByRole('button', { name: /Rechercher consultations/ });
    this.reinitialiserConsultationsButton = this.consultationPane.getByRole('button', { name: /Réinitialiser/ });
    this.consultationValidationMessage = this.consultationPane.locator('.validation-message');

    this.exportModal = page.locator('.export-modal');
    this.exportModalHeading = this.exportModal.getByRole('heading', { name: "Options d'exportation" });
    this.exportDateStartInput = this.exportModal.locator('input[name="exportDateStart"]');
    this.exportDateEndInput = this.exportModal.locator('input[name="exportDateEnd"]');
    this.dhis2Fields = this.exportModal.locator('.dhis2-fields');
    this.exportSummary = this.exportModal.locator('.export-summary');
    this.exportAnnulerButton = this.exportModal.getByRole('button', { name: /Annuler/ });
    this.exportTelechargerButton = this.exportModal.getByRole('button', { name: /Télécharger/ });
    this.exportSubCategoryLabel = this.exportModal.getByText('Sous-catégorie');
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.tabConsultations).toBeVisible();
    await expect(this.tabImagerie).toBeVisible();
    await expect(this.tabBilans).toBeVisible();
    await expect(this.tabVaccinations).toBeVisible();
    await expect(this.exportButton).toBeVisible();
  }

  async fillConsultationDateRange(dateStart: string, dateEnd: string) {
    await this.dateDebutInput.fill(dateStart);
    await this.dateFinInput.fill(dateEnd);
  }

  async searchConsultations() {
    await this.rechercherConsultationsButton.click();
  }

  async resetConsultationFilters() {
    await this.reinitialiserConsultationsButton.click();
  }

  async expectConsultationValidationMessage(pattern: RegExp) {
    await expect(this.consultationValidationMessage).toBeVisible();
    await expect(this.consultationValidationMessage).toHaveText(pattern);
  }

  /**
   * Sélectionne la première option disponible d'un ng-select et retourne son libellé
   * (technique reprise de ConsultationPage.selectAndVerify / HealthCheckPage.selectFirstOption :
   * on ne peut pas viser un libellé précis, le référentiel étant chargé dynamiquement).
   */
  private async selectFirstOption(ngSelect: Locator): Promise<string> {
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

  async selectFirstConsultationType(): Promise<string> {
    return this.selectFirstOption(this.typeConsultationSelect);
  }

  async selectFirstConsultant(): Promise<string> {
    return this.selectFirstOption(this.consultantSelect);
  }

  // ===== Modale d'export =====

  async openExportModal() {
    await this.exportButton.click();
    await expect(this.exportModalHeading).toBeVisible();
  }

  private exportSourceCard(label: string): Locator {
    return this.exportModal.locator('.export-card').filter({ hasText: label });
  }

  async selectExportSource(label: string) {
    await this.exportSourceCard(label).click();
  }

  async expectExportSourceActive(label: string) {
    await expect(this.exportSourceCard(label)).toHaveClass(/active/);
  }

  async expectExportSubCategorySelectVisible() {
    await expect(this.exportSubCategoryLabel).toBeVisible();
  }

  private exportPeriodPresetButton(label: string): Locator {
    return this.exportModal.locator('.period-preset-btn').filter({ hasText: label });
  }

  async selectExportPeriodPreset(label: string) {
    await this.exportPeriodPresetButton(label).click();
  }

  async getExportDateRange(): Promise<{ start: string; end: string }> {
    return {
      start: await this.exportDateStartInput.inputValue(),
      end: await this.exportDateEndInput.inputValue(),
    };
  }

  private exportFormatButton(label: string): Locator {
    return this.exportModal.locator('.export-format-btn').filter({ hasText: label });
  }

  async selectExportFormat(label: string) {
    await this.exportFormatButton(label).click();
  }

  async expectExportFormatActive(label: string) {
    await expect(this.exportFormatButton(label)).toHaveClass(/active/);
  }

  async expectDhis2FieldsVisible() {
    await expect(this.dhis2Fields).toBeVisible();
  }

  async expectDhis2FieldsHidden() {
    await expect(this.dhis2Fields).toBeHidden();
  }

  async expectExportSummary(pattern: RegExp) {
    await expect(this.exportSummary).toHaveText(pattern);
  }

  /**
   * Ferme la modale via "Annuler" : on ne clique JAMAIS "Télécharger" dans les tests (déclencherait
   * un vrai export/téléchargement), à l'instar des autres modales destructives de cette suite.
   */
  async closeExportModalViaAnnuler() {
    await this.exportAnnulerButton.click();
    await expect(this.exportModal).toBeHidden();
  }
}

/** Liste des actes facturables (`/my-space/reporting/billable-billing`, `BillableBillingComponent`). */
export class BillableBillingReportingPage {
  private readonly page: Page;

  private readonly heading: Locator;
  private readonly invoicePatientOrderInput: Locator;
  private readonly invoiceGarantOrderInput: Locator;
  private readonly patientFirstnameInput: Locator;
  private readonly patientLastnameInput: Locator;
  private readonly patientIdentifierInput: Locator;
  private readonly billedByInput: Locator;
  private readonly caregiverFullnameInput: Locator;
  private readonly dobInput: Locator;
  private readonly dateStartInput: Locator;
  private readonly dateEndInput: Locator;
  private readonly statusSelect: Locator;
  private readonly reinitialiserButton: Locator;
  private readonly rechercherButton: Locator;
  private readonly rows: Locator;
  private readonly emptyRow: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole('heading', { name: /Liste des actes/ });
    this.invoicePatientOrderInput = page.locator('input[formcontrolname="invoicePatientOrder"]');
    this.invoiceGarantOrderInput = page.locator('input[formcontrolname="invoiceGarantOrder"]');
    this.patientFirstnameInput = page.locator('input[formcontrolname="patientFirstname"]');
    this.patientLastnameInput = page.locator('input[formcontrolname="patientLastname"]');
    // Un second input caché partage le même formcontrolname (binding interne du composant) : on ne cible que le champ visible.
    this.patientIdentifierInput = page.locator('input[formcontrolname="patientIdentifier"]:visible');
    this.billedByInput = page.locator('input[formcontrolname="billedBy"]');
    this.caregiverFullnameInput = page.locator('input[formcontrolname="caregiverFullname"]');
    this.dobInput = page.locator('input[formcontrolname="dob"]');
    this.dateStartInput = page.locator('input[formcontrolname="dateStart"]');
    this.dateEndInput = page.locator('input[formcontrolname="dateEnd"]');
    this.statusSelect = page.locator('select[formcontrolname="status"]');
    this.reinitialiserButton = page.getByRole('button', { name: /Réinitialiser/ });
    this.rechercherButton = page.getByRole('button', { name: /Rechercher/ });
    this.rows = page.locator('table.table-modern tbody tr.table-row');
    // Un modal caché (#add-modal-lg) contient sa propre ligne "Aucun enregistrement" : on ne cible que celle visible.
    this.emptyRow = page.locator('td.empty-row:visible', { hasText: 'Aucun enregistrement' });
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.invoicePatientOrderInput).toBeVisible();
    await expect(this.statusSelect).toBeVisible();
    await expect(this.reinitialiserButton).toBeVisible();
    await expect(this.rechercherButton).toBeVisible();
  }

  async fillPatientFirstname(value: string) {
    await this.patientFirstnameInput.fill(value);
  }

  async fillPatientLastname(value: string) {
    await this.patientLastnameInput.fill(value);
  }

  async fillPatientIdentifier(value: string) {
    await this.patientIdentifierInput.fill(value);
  }

  async fillCaregiverFullname(value: string) {
    await this.caregiverFullnameInput.fill(value);
  }

  async fillBilledBy(value: string) {
    await this.billedByInput.fill(value);
  }

  async fillDateRange(dateStart: string, dateEnd: string) {
    await this.dateStartInput.fill(dateStart);
    await this.dateEndInput.fill(dateEnd);
  }

  async selectStatus(label: 'Tous les statuts' | 'Facturé' | 'Non Facturé') {
    await this.statusSelect.selectOption({ label });
  }

  async search() {
    await this.rechercherButton.click();
    await this.page.waitForTimeout(300);
  }

  async reset() {
    await this.reinitialiserButton.click();
    await this.page.waitForTimeout(300);
  }

  async getRowCount(): Promise<number> {
    return this.rows.count();
  }

  /** Vérifie que la liste a réagi à la recherche : soit des lignes de résultat, soit le message "Aucun enregistrement". */
  async expectResultsRendered() {
    const rowCount = await this.rows.count();
    if (rowCount === 0) {
      await expect(this.emptyRow).toBeVisible();
    } else {
      await expect(this.rows.first()).toBeVisible();
    }
  }

  async expectNoResults() {
    await expect(this.emptyRow).toBeVisible();
  }

  /**
   * Recherche avec les critères donnés (formulaire réinitialisé avant) et renvoie les lignes
   * trouvées, une fois la liste stabilisée.
   */
  async searchActs(criteria: Partial<Record<'patientIdentifier' | 'invoicePatientOrder' | 'invoiceGarantOrder' | 'patientFirstname'
    | 'patientLastname' | 'caregiverFullname' | 'billedBy', string>> & { status?: 'Tous les statuts' | 'Facturé' | 'Non Facturé' }): Promise<ReportingActRow[]> {
    await this.reset();
    const inputs = {
      patientIdentifier: this.patientIdentifierInput, invoicePatientOrder: this.invoicePatientOrderInput,
      invoiceGarantOrder: this.invoiceGarantOrderInput, patientFirstname: this.patientFirstnameInput,
      patientLastname: this.patientLastnameInput, caregiverFullname: this.caregiverFullnameInput, billedBy: this.billedByInput,
    };
    for (const [key, value] of Object.entries(criteria)) {
      if (key !== 'status' && value) await inputs[key as keyof typeof inputs].fill(value);
    }
    if (criteria.status) await this.selectStatus(criteria.status);
    await this.rechercherButton.click();
    await expect(this.rows.first().or(this.emptyRow)).toBeVisible({ timeout: 15000 });
    await this.page.waitForTimeout(1000);
    return this.readRows();
  }

  /** Lignes affichées : patient, médecin, N° de factures, montant, acte, statut et action. */
  async readRows(): Promise<ReportingActRow[]> {
    const result: ReportingActRow[] = [];
    for (const row of await this.rows.all()) {
      const cells = (await row.locator('td').allInnerTexts()).map(c => c.replace(/\s+/g, ' ').trim());
      result.push({
        row,
        lastname: cells[0], firstname: cells[1], identifier: cells[2], caregiver: cells[4],
        invoicePatient: cells[5], invoiceGarant: cells[6], amount: Number(cells[7].replace(/[^\d]/g, '')) || 0,
        act: cells[8], status: cells[10],
        deletable: await row.locator('button.btn-danger-modern').isEnabled(),
      });
    }
    return result;
  }

  /** Supprime l'acte de la ligne (bouton de suppression puis confirmation). */
  async deleteAct(row: Locator) {
    await row.locator('button.btn-danger-modern').click();
    await expect(this.page.getByText(/voulez-vous supprimer cet acte/i)).toBeVisible();
    await this.page.getByRole('button', { name: 'Confirmer' }).click();
  }
}

export type ReportingActRow = {
  row: Locator; lastname: string; firstname: string; identifier: string; caregiver: string;
  invoicePatient: string; invoiceGarant: string; amount: number; act: string; status: string; deletable: boolean;
};

export type PrestationsTab = 'Consultations' | 'Imagerie' | 'Bilans' | 'Vaccinations';
export type PrestationHeader = { type: string; date: string; caregiver: string };

/**
 * Reporting > Prestations, onglet par onglet : filtres (consultant, période, type, taille), recherche,
 * en-têtes des résultats (type, date, consultant : le patient n'y figure pas) et fenêtre d'export.
 * Chaque onglet a ses propres champs : tout est cherché dans l'onglet actif.
 */
export class PrestationsReportingPage {
  constructor(private readonly page: Page) {}

  get pane(): Locator { return this.page.locator('.tab-pane.active'); }
  get message(): Locator { return this.pane.locator('.validation-message'); }

  async openTab(tab: PrestationsTab) {
    await this.page.locator('.tabs-nav .tab-btn').filter({ hasText: tab }).click();
    await expect(this.pane.locator('.tab-filters-header h5')).toBeVisible();
    await this.waitLoaded();
  }

  private async waitLoaded() {
    await this.page.waitForTimeout(500);
    await this.pane.locator('.btn-search:disabled').waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
  }

  /** Liste déroulante d'un filtre de l'onglet actif, repérée par son libellé. */
  filter(label: RegExp): Locator {
    return this.pane.locator('.filter-group').filter({ has: this.page.locator('.filter-label', { hasText: label }) }).locator('ng-select');
  }

  /** Options proposées par un filtre. */
  async options(label: RegExp): Promise<string[]> {
    const select = this.filter(label);
    await select.locator('.ng-select-container').click();
    const names = (await this.page.locator('.ng-dropdown-panel .ng-option').allTextContents()).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    await this.page.keyboard.press('Escape');
    return names;
  }

  /** Choisit une option (libellé exact, accents et casse ignorés). */
  async choose(label: RegExp, option: string) {
    const select = this.filter(label);
    await select.locator('.ng-select-container').click();
    const wanted = normalize(option);
    const options = this.page.locator('.ng-dropdown-panel .ng-option');
    const texts = (await options.allTextContents()).map(normalize);
    const index = texts.findIndex(t => t === wanted);
    if (index < 0) throw new Error(`Option "${option}" absente : ${JSON.stringify(texts)}`);
    await options.nth(index).click();
  }

  async clear(label: RegExp) {
    const clear = this.filter(label).locator('.ng-clear-wrapper');
    if (await clear.isVisible().catch(() => false)) await clear.click();
  }

  async setDates(start: string, end: string) {
    const dates = this.pane.locator('input[type="date"]');
    await dates.nth(0).fill(start);
    await dates.nth(1).fill(end);
  }

  /** Lance la recherche de l'onglet et renvoie le message affiché. */
  async search(): Promise<string> {
    await this.pane.locator('.btn-search').click();
    await this.waitLoaded();
    await expect(this.message).toBeVisible({ timeout: 60000 });
    return ((await this.message.textContent()) ?? '').replace(/\s+/g, ' ').trim();
  }

  async reset() {
    await this.pane.locator('.btn-reset').click();
    await this.waitLoaded();
  }

  /** Nombre de résultats annoncé par le message ("N consultation(s) trouvée(s)"), 0 sinon. */
  static countOf(message: string): number {
    return Number(message.match(/^(\d+)\s/)?.[1] ?? 0);
  }

  /** En-têtes des résultats affichés. */
  async headers(): Promise<PrestationHeader[]> {
    const result: PrestationHeader[] = [];
    for (const item of await this.pane.locator('.reporting-item-header').all()) {
      const meta = (await item.locator('.reporting-item-meta > span').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim());
      result.push({ type: ((await item.locator('.reporting-item-type').innerText()) ?? '').replace(/\s+/g, ' ').trim(), date: meta[0] ?? '', caregiver: meta[1] ?? '' });
    }
    return result;
  }

  // ======================== Export ========================

  get exportModal(): Locator { return this.page.locator('.export-modal'); }
  get exportMessage(): Locator { return this.exportModal.locator('.validation-message'); }
  exportDate(index: 0 | 1): Locator { return this.exportModal.locator('input[type="date"]').nth(index); }

  async openExport() {
    await this.page.getByRole('button', { name: /Exporter/ }).click();
    await expect(this.exportModal).toBeVisible();
  }

  async exportCategory(label: 'Consultations' | 'Imagerie' | 'Bilans' | 'Vaccinations') {
    await this.exportModal.locator('.export-card').filter({ hasText: label }).click();
  }

  async exportFormat(label: RegExp) {
    await this.exportModal.locator('.export-format-btn').filter({ hasText: label }).click();
  }

  async exportDates(start: string, end: string) {
    await this.exportDate(0).fill(start);
    await this.exportDate(1).fill(end);
  }

  /** Clique sur Télécharger sans attendre de fichier ; renvoie le message affiché. */
  async exportExpectingMessage(): Promise<string> {
    await this.exportModal.getByRole('button', { name: /Télécharger/ }).click();
    await expect(this.exportMessage).toBeVisible({ timeout: 60000 });
    return ((await this.exportMessage.textContent()) ?? '').replace(/\s+/g, ' ').trim();
  }

  /** Clique sur Télécharger et renvoie le fichier produit (nom et contenu), capté par le test. */
  async exportFile(): Promise<{ name: string; content: Buffer }> {
    const download = this.page.waitForEvent('download', { timeout: 120000 });
    await this.exportModal.getByRole('button', { name: /Télécharger/ }).click();
    const file = await download;
    const path = await file.path();
    const fs = await import('fs');
    return { name: file.suggestedFilename(), content: fs.readFileSync(path) };
  }
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}
