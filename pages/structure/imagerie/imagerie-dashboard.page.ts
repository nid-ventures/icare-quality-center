// pages/structure/imagerie/imagerie-dashboard.page.ts
import { type Page, type Locator, expect } from '@playwright/test';
import { EchographieData } from '../generator/imaging-data-generator';

export type ImagingActeKind = 'ECHOGRAPHIE' | 'SCANNER' | 'IRM' | 'RADIOGRAPHIE';

export class ImagerieDashboardPage {
  // Lien d'accès rapide depuis le dashboard patient (classe statique dédiée dans le template).
  readonly imagerieQuickActionLink: Locator;

  // En-tête / liste des actes d'imagerie du patient
  readonly listHeading: Locator;
  readonly newActeButton: Locator;
  readonly cancelActeButton: Locator;

  // Modale "Veuillez choisir le type d'acte d'imagerie"
  readonly chooseTypeModal: Locator;
  readonly chooseTypeModalHeading: Locator;
  readonly typeSelect: Locator;
  readonly subTypeSelect: Locator;
  readonly fermerModalButton: Locator;
  readonly validerButton: Locator;

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
    this.newActeButton = page.locator('button.btn-action-new');
    this.cancelActeButton = page.locator('button.btn-action-cancel');

    this.chooseTypeModal = page.locator('#chooseTypeOfEchographieSimple');
    this.chooseTypeModalHeading = this.chooseTypeModal.getByRole('heading', { name: "Veuillez choisir le type d'acte d'imagerie" });
    // Premier ng-select de la modale = type d'acte, second (optionnel) = sous-type.
    this.typeSelect = this.chooseTypeModal.locator('ng-select').first();
    this.subTypeSelect = this.chooseTypeModal.locator('ng-select').nth(1);
    this.fermerModalButton = this.chooseTypeModal.locator('button.btn-modal-secondary');
    this.validerButton = this.chooseTypeModal.locator('button.btn-modal-primary');

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

  async openNewActeModal() {
    await this.newActeButton.click();
    await expect(this.chooseTypeModalHeading).toBeVisible();
  }

  // Choisit le type d'acte d'imagerie dans la modale, sélectionne un sous-type quand le
  // sélecteur "Acte d'imagerie" apparaît (échographie : Standard/T1/T2/T3), puis valide.
  async chooseType(kind: ImagingActeKind) {
    await this.selectNgOptionByText(this.typeSelect, kind);

    if (await this.subTypeSelect.isVisible().catch(() => false)) {
      await this.selectFirstNgOption(this.subTypeSelect);
    }

    await this.validerButton.click();
    await expect(this.chooseTypeModal).toBeHidden();
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
