// pages/structure/imagerie/imagerie-dashboard.page.ts
import { type Page, type Locator, expect } from '@playwright/test';
import { EchographieData } from '../generator/imaging-data-generator';

export type ImagingActeKind = 'ECHOGRAPHIE' | 'SCANNER' | 'IRM' | 'RADIOGRAPHIE';

/** Libellé de chaque type sur sa pastille (IMAGING_KIND_LABELS de imagerie-dashboard.component.ts). */
const IMAGING_KIND_LABELS: Record<ImagingActeKind, string> = {
  ECHOGRAPHIE: 'Échographie',
  SCANNER: 'Scanner',
  IRM: 'IRM',
  RADIOGRAPHIE: 'Radiographie',
};

export class ImagerieDashboardPage {
  // Lien d'accès rapide depuis le dashboard patient (classe statique dédiée dans le template).
  readonly imagerieQuickActionLink: Locator;

  // En-tête / liste des actes d'imagerie du patient
  readonly listHeading: Locator;
  /** Bandeau "Nouvel acte d'imagerie" (types en pastilles, sous-types en boutons, recherche) */
  readonly newActeButton: Locator;
  readonly kindPills: Locator;
  readonly subTypeChips: Locator;
  readonly searchInput: Locator;
  /** Rappel de l'acte choisi pendant la saisie, avec son bouton "Annuler" */
  readonly currentTypeBar: Locator;
  readonly cancelActeButton: Locator;

  // Formulaire de création échographie (app-echographie-simple-static)
  readonly echoForm: Locator;
  readonly echoDoctorSelect: Locator;
  readonly echoDateInput: Locator;
  readonly echoRegionSelect: Locator;
  readonly echoResumeInput: Locator;
  readonly echoCompteRenduTextarea: Locator;
  readonly echoSubmitButton: Locator;

  // Formulaire de création scanner (app-scanner-static)
  readonly scannerForm: Locator;
  readonly scannerDoctorSelect: Locator;
  readonly scannerDatePrescriptionInput: Locator;
  readonly scannerDateExamInput: Locator;
  readonly scannerRegionSelect: Locator;
  readonly scannerSubmitButton: Locator;

  // Modale de confirmation partagée (AVERTISSEMENT / Fermer / Confirmer)
  readonly confirmButton: Locator;

  constructor(private readonly page: Page) {
    this.imagerieQuickActionLink = page.locator('a.qa-imagerie');

    this.listHeading = page.getByRole('heading', { name: /Liste des actes d'Imagerie/ });
    // Plus de bouton ni de fenêtre de choix : le bandeau est affiché sur la page
    this.newActeButton = page.locator('.new-consultation-bar').filter({ hasText: "Nouvel acte d'imagerie" });
    this.kindPills = this.newActeButton.locator('.ncb-pills .speciality-pill');
    this.subTypeChips = this.newActeButton.locator('.ncb-types .type-chip');
    this.searchInput = this.newActeButton.getByRole('textbox', { name: "Rechercher un acte d'imagerie" });
    this.currentTypeBar = page.locator('.current-type-bar');
    this.cancelActeButton = this.currentTypeBar.getByRole('button', { name: /Annuler/ });

    this.echoForm = page.locator('app-echographie-simple-static');
    this.echoDoctorSelect = this.echoForm.locator('ng-select[formcontrolname="caregiverId"]');
    this.echoDateInput = this.echoForm.locator('input[formcontrolname="date"]');
    this.echoRegionSelect = this.echoForm.locator('ng-select[formcontrolname="region"]');
    this.echoResumeInput = this.echoForm.locator('input[formcontrolname="conclusion"]');
    this.echoCompteRenduTextarea = this.echoForm.locator('textarea[formcontrolname="notice"]');
    this.echoSubmitButton = this.echoForm.getByRole('button', { name: /Enregistrer l'échographie/ });

    this.scannerForm = page.locator('app-scanner-static');
    this.scannerDoctorSelect = this.scannerForm.locator('ng-select[formcontrolname="caregiverId"]');
    this.scannerDatePrescriptionInput = this.scannerForm.locator('input[formcontrolname="date"]');
    this.scannerDateExamInput = this.scannerForm.locator('input[formcontrolname="dateExam"]');
    this.scannerRegionSelect = this.scannerForm.locator('ng-select[formcontrolname="region"]');
    this.scannerSubmitButton = this.scannerForm.getByRole('button', { name: /Enregistrer le scanner/ });

    this.confirmButton = page.getByRole('button', { name: 'Confirmer' });
  }

  async gotoFromPatientDashboard() {
    await expect(this.imagerieQuickActionLink).toBeVisible();
    await this.imagerieQuickActionLink.click();
    await this.page.waitForURL('**/imagerie/imageries/**');
    await expect(this.listHeading).toBeVisible();
  }

  /** Affiche le bandeau "Nouvel acte d'imagerie" (il remplace l'ancienne fenêtre : rien à ouvrir). */
  async openNewActeModal() {
    await this.page.locator('app-loader .backdrop.full-screen').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await expect(this.newActeButton).toBeVisible();
  }

  // Choisit le type d'acte (pastille) : scanner, IRM et radiographie ouvrent directement leur
  // formulaire ; l'échographie propose ses sous-types en boutons ("Standard" en premier, comme
  // l'ancienne présélection) et le premier est choisi.
  async chooseType(kind: ImagingActeKind) {
    const pill = this.kindPills.filter({ hasText: new RegExp(`^\\s*${IMAGING_KIND_LABELS[kind]}\\s*\\d*\\s*$`, 'i') });
    await expect(pill, `Type "${IMAGING_KIND_LABELS[kind]}" proposé`).toHaveCount(1);
    await pill.click();
    await expect(this.currentTypeBar.or(this.subTypeChips.first()).first()).toBeVisible();
    if (!await this.currentTypeBar.isVisible()) await this.subTypeChips.first().click();
    await expect(this.currentTypeBar).toBeVisible();
  }

  /** Recherche un acte d'imagerie dans le bandeau (sans tenir compte des accents). */
  async searchActe(term: string) {
    await this.searchInput.fill(term);
  }

  /** Ferme le formulaire en cours (bouton "Annuler" du rappel de l'acte) : le bandeau revient. */
  async cancelNewActe() {
    await this.cancelActeButton.click();
    await expect(this.currentTypeBar).toBeHidden();
    await expect(this.newActeButton).toBeVisible();
  }

  async fillEchographieCreateForm(data: EchographieData) {
    await this.selectFirstNgOption(this.echoDoctorSelect);
    const dateValue = await this.currentDateValueOrToday(this.echoDateInput);
    await this.echoDateInput.fill(dateValue);
    await this.selectNgOptionByText(this.echoRegionSelect, 'Abdomen');

    if (await this.echoResumeInput.isVisible().catch(() => false)) {
      await this.echoResumeInput.fill(data.resume);
    }
    if (await this.echoCompteRenduTextarea.isVisible().catch(() => false)) {
      await this.echoCompteRenduTextarea.fill(data.compteRendu);
    }
  }

  async submitEchographieCreateForm() {
    await this.echoSubmitButton.click();
    await this.confirmButton.waitFor({ state: 'visible' });
    await this.confirmButton.click();
  }

  async fillScannerCreateForm() {
    await this.selectFirstNgOption(this.scannerDoctorSelect);
    await this.selectNgOptionByText(this.scannerRegionSelect, 'Abdomen');
  }

  async submitScannerCreateForm() {
    await this.scannerSubmitButton.click();
    await this.confirmButton.waitFor({ state: 'visible' });
    await this.confirmButton.click();
  }

  // L'input date est déjà pré-rempli avec la date du jour par le composant (voir
  // echographie-simple-static.component.ts) : on se contente de le laisser tel quel s'il a
  // déjà une valeur, sinon on force la date du jour.
  private async currentDateValueOrToday(input: Locator): Promise<string> {
    const current = await input.inputValue().catch(() => '');
    if (current) return current;
    return new Date().toISOString().split('T')[0];
  }

  private async selectFirstNgOption(ngSelectLocator: Locator) {
    await ngSelectLocator.click();
    await this.page.waitForSelector('.ng-dropdown-panel .ng-option', { timeout: 5000 });
    await this.page.locator('.ng-dropdown-panel .ng-option').first().click();
  }

  private async selectNgOptionByText(ngSelectLocator: Locator, optionText: string) {
    await ngSelectLocator.click();
    await this.page.waitForSelector('.ng-dropdown-panel .ng-option', { timeout: 5000 });
    await this.page.locator(`.ng-dropdown-panel .ng-option:has-text("${optionText}")`).first().click();
  }
}
