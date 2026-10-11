import { type Page, type Locator, expect } from '@playwright/test';
import { ConsultationFormPage, type FilledValues } from './consultation-form.page';

export interface MedicationPrescriptionData {
  title: string;
  medicationName: string;
  posologie: string;
  recommandations?: string;
}

export type PrescriptionKind = 'Ordonnance' | 'Analyses' | 'Imagerie';

/**
 * Gestionnaire de prescriptions intégré aux formulaires de consultation
 * (`app-prescription-manager`) : 3 panneaux (Ordonnance / Analyses / Imagerie). Les
 * prescriptions sont un brouillon en mémoire, enregistré avec la consultation.
 */
export class PrescriptionManagerPage {
  readonly root: Locator;

  constructor(private readonly page: Page) {
    this.root = page.locator('app-prescription-manager').filter({ visible: true }).first();
  }

  private panel(kind: PrescriptionKind): Locator {
    return this.root.locator('.rx-panel').filter({
      has: this.page.locator('.rx-panel-header h6', { hasText: new RegExp(`^\\s*${kind}\\s*$`) }),
    });
  }

  private panelHeader(kind: PrescriptionKind): Locator {
    return this.panel(kind).locator('.rx-panel-header');
  }

  panelCount(kind: PrescriptionKind): Locator {
    return this.panelHeader(kind).locator('.rx-panel-count');
  }

  rows(kind: PrescriptionKind): Locator {
    return this.panel(kind).locator('.rx-row');
  }

  async expectCount(kind: PrescriptionKind, count: number) {
    await expect(this.panelCount(kind), `Nombre de prescriptions "${kind}"`).toHaveText(String(count));
    await expect(this.rows(kind)).toHaveCount(count);
  }

  private async openCreator(kind: PrescriptionKind) {
    await this.panelHeader(kind).scrollIntoViewIfNeeded();
    await this.panelHeader(kind).click();
  }

  /** Ajoute une ordonnance (un médicament). */
  async addMedicationPrescription(data: MedicationPrescriptionData) {
    const before = Number(await this.panelCount('Ordonnance').innerText());
    await this.openCreator('Ordonnance');
    const form = this.root.locator('app-medication-prescription');
    await expect(form).toBeVisible();

    await form.getByPlaceholder('Ex: Traitement antibiotique, Traitement de fond...').fill(data.title);
    const medicationName = form.getByPlaceholder('Nom du médicament');
    if (await medicationName.count() === 0) {
      await form.getByRole('button', { name: /Médicament/ }).click();
    }
    await medicationName.first().fill(data.medicationName);
    await form.getByPlaceholder('Ex: 1 cp matin et soir').first().fill(data.posologie);
    if (data.recommandations) {
      await form.locator('textarea').last().fill(data.recommandations);
    }

    await form.getByRole('button', { name: /Enregistrer l'ordonnance/ }).click();
    await expect(form).toBeHidden();
    await this.expectCount('Ordonnance', before + 1);
  }

  /** Une ordonnance sans médicament ne peut pas être enregistrée (bouton désactivé). */
  async expectMedicationRequiresAMedication(title: string) {
    await this.openCreator('Ordonnance');
    const form = this.root.locator('app-medication-prescription');
    await expect(form).toBeVisible();
    await form.getByPlaceholder('Ex: Traitement antibiotique, Traitement de fond...').fill(title);
    await expect(form.getByRole('button', { name: /Enregistrer l'ordonnance/ })).toBeDisabled();
    await form.getByRole('button', { name: /Annuler/ }).click();
    await expect(form).toBeHidden();
  }

  /** Ajoute une prescription d'analyses (prescripteur, type de bilan, 2 analyses, diagnostic). */
  async addLaboratoryPrescription(diagnostic: string): Promise<FilledValues> {
    const before = Number(await this.panelCount('Analyses').innerText());
    await this.openCreator('Analyses');
    const form = this.root.locator('app-laboratory-prescription');
    await expect(form).toBeVisible();
    const filled = await new ConsultationFormPage(this.page, form).fill([
      { name: 'caregiverId', kind: 'select' },
      { name: 'typeBilan', kind: 'select' },
      { name: 'analyses', kind: 'multiselect', count: 2 },
      { name: 'diagnostic', kind: 'textarea', value: diagnostic },
    ]);
    await form.getByRole('button', { name: /^\W*Enregistrer$/ }).click();
    await expect(form).toBeHidden();
    await this.expectCount('Analyses', before + 1);
    return filled;
  }

  /** Ajoute une prescription d'imagerie (type d'imagerie, examen, docteur, date, région, diagnostic). */
  async addImagingPrescription(notice: string, date: string): Promise<FilledValues> {
    const before = Number(await this.panelCount('Imagerie').innerText());
    await this.openCreator('Imagerie');
    const form = this.root.locator('app-imaging-prescription');
    await expect(form).toBeVisible();
    // Type d'imagerie : ng-select sans formControlName (ngModel), premier de la liste.
    await form.locator('ng-select').first().locator('.ng-select-container').click();
    await this.page.locator('.ng-dropdown-panel .ng-option:not(.ng-option-disabled)').first().click();
    const filled = await new ConsultationFormPage(this.page, form).fill([
      { name: 'type', kind: 'select' },
      { name: 'caregiverId', kind: 'select' },
      { name: 'date', kind: 'date', value: date },
      { name: 'region', kind: 'select' },
      { name: 'notice', kind: 'textarea', value: notice },
    ]);
    await form.getByRole('button', { name: /Enregistrer la prescription/ }).click();
    await expect(form).toBeHidden();
    await this.expectCount('Imagerie', before + 1);
    return filled;
  }

  /** Modifie la posologie de la première ordonnance. */
  async editFirstMedication(posologie: string) {
    await this.rows('Ordonnance').first().locator('button[title="Modifier"]').click();
    const form = this.root.locator('app-medication-prescription');
    await expect(form).toBeVisible();
    await form.getByPlaceholder('Ex: 1 cp matin et soir').first().fill(posologie);
    await form.getByRole('button', { name: /Enregistrer l'ordonnance/ }).click();
    await expect(form).toBeHidden();
  }

  /** Supprime la première prescription du type donné, en confirmant. */
  async removeFirst(kind: PrescriptionKind) {
    const before = Number(await this.panelCount(kind).innerText());
    await this.rows(kind).first().locator('button[title="Supprimer"]').click();
    // Fenêtre d'avertissement de l'application (ModalComponent : "Fermer" / "Confirmer").
    await this.page.locator('.warning-modal-card').getByRole('button', { name: /Confirmer/ }).click();
    await this.expectCount(kind, before - 1);
  }

  /** Vérifie qu'une prescription contenant ce texte est présente (après réouverture). */
  async expectPrescriptionText(kind: PrescriptionKind, text: string) {
    await expect(this.rows(kind).filter({ hasText: text }).first()).toBeVisible();
  }

  /**
   * Vérifie un détail (ex: posologie) affiché seulement quand la ligne est dépliée : déplie la
   * prescription dont le titre est donné puis contrôle son contenu.
   */
  async expectPrescriptionDetail(kind: PrescriptionKind, title: string, detail: string) {
    const row = this.rows(kind).filter({ hasText: title }).first();
    await expect(row).toBeVisible();
    if (!/\bexpanded\b/.test((await row.getAttribute('class')) ?? '')) {
      await row.locator('.rx-row-header').click();
    }
    await expect(row).toContainText(detail);
  }
}
