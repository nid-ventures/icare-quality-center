import { type Page, type Locator, expect } from '@playwright/test';
import { ConsultationFormPage, type FilledValues } from './consultation-form.page';

/** Titre d'une ordonnance (champ masqué depuis le 2026-11-20) : « Ordonnance jj/mm/aaaa » par défaut. */
export const DEFAULT_MEDICATION_TITLE = /^\s*Ordonnance \d{2}\/\d{2}\/\d{4}\s*$/;
const TITLE_PLACEHOLDER = 'Ex: Traitement antibiotique, Traitement de fond...';

export interface MedicationPrescriptionData {
  /** Saisi seulement si le champ titre est affiché (masqué depuis le 2026-11-20). */
  title?: string;
  medicationName: string;
  posologie: string;
  recommandations?: string;
  /** Durée libre : nombre + unité, recomposés par l'app (ex. 10 + Jours -> « 10 jours »). */
  duree?: { nombre: number; unite: 'Jours' | 'Semaines' | 'Mois' | 'Ans' };
}

export type PrescriptionKind = 'Ordonnance' | 'Analyses' | 'Imagerie';

/**
 * Gestionnaire de prescriptions intégré aux formulaires de consultation
 * (`app-prescription-manager`) : 3 panneaux (Ordonnance / Analyses / Imagerie). Les
 * prescriptions sont un brouillon en mémoire, enregistré avec la consultation.
 */
export class PrescriptionManagerPage {
  readonly root: Locator;

  /** `scope` : zone contenant le gestionnaire (ex. l'acte d'un parcours), sinon toute la page. */
  constructor(private readonly page: Page, scope?: Locator) {
    this.root = (scope ?? page).locator('app-prescription-manager').filter({ visible: true }).first();
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

    const titleInput = form.getByPlaceholder(TITLE_PLACEHOLDER);
    if (data.title && await titleInput.isVisible()) await titleInput.fill(data.title);
    const medicationName = form.getByPlaceholder('Nom du médicament');
    if (await medicationName.count() === 0) {
      await form.getByRole('button', { name: /Médicament/ }).click();
    }
    await medicationName.first().fill(data.medicationName);
    await form.getByPlaceholder('Ex: 1 cp matin et soir').first().fill(data.posologie);
    if (data.duree) {
      // Plus de quantité : le pharmacien la déduit de la durée du traitement
      const line = form.locator('tbody tr').first();
      await line.getByPlaceholder('Nb').fill(String(data.duree.nombre));
      await line.locator('select').first().selectOption({ label: data.duree.unite });
    }
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
    const titleInput = form.getByPlaceholder(TITLE_PLACEHOLDER);
    if (await titleInput.isVisible()) await titleInput.fill(title);
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

  /**
   * Prescription d'analyses (2026-11-18) : prescripteur présaisi à l'ouverture ; refusée sans
   * diagnostic (vide ou espaces seuls), le reste étant rempli. Le formulaire est ensuite annulé.
   */
  async expectLaboratoryRequiresDiagnostic(diagnostic: string) {
    const before = Number(await this.panelCount('Analyses').innerText());
    await this.openCreator('Analyses');
    const form = this.root.locator('app-laboratory-prescription');
    await expect(form).toBeVisible();
    await expect(form.locator('ng-select[formcontrolname="caregiverId"] .ng-value-label'), 'Prescripteur présaisi').toHaveCount(1);
    await new ConsultationFormPage(this.page, form).fill([
      { name: 'typeBilan', kind: 'select' },
      { name: 'analyses', kind: 'multiselect', count: 2 },
      { name: 'diagnostic', kind: 'textarea', value: diagnostic },
    ]);
    await form.getByRole('button', { name: /^\W*Enregistrer$/ }).click();
    await expect(form.getByText('Le diagnostic est obligatoire').first(), 'Diagnostic signalé obligatoire').toBeVisible();
    await expect(form, 'Le formulaire reste ouvert').toBeVisible();
    await form.getByRole('button', { name: /Annuler/ }).click();
    await this.expectCount('Analyses', before);
  }

  /**
   * Prescription d'imagerie (2026-11-18) : prescripteur présaisi à l'ouverture ; refusée sans
   * diagnostic (vide ou espaces seuls), le reste étant rempli. Le formulaire est ensuite annulé.
   */
  async expectImagingRequiresDiagnostic(notice: string, date: string) {
    const before = Number(await this.panelCount('Imagerie').innerText());
    await this.openCreator('Imagerie');
    const form = this.root.locator('app-imaging-prescription');
    await expect(form).toBeVisible();
    await form.locator('ng-select').first().locator('.ng-select-container').click();
    await this.page.locator('.ng-dropdown-panel .ng-option:not(.ng-option-disabled)').first().click();
    await expect(form.locator('ng-select[formcontrolname="caregiverId"] .ng-value-label'), 'Prescripteur présaisi').toHaveCount(1);
    await new ConsultationFormPage(this.page, form).fill([
      { name: 'type', kind: 'select' },
      { name: 'date', kind: 'date', value: date },
      { name: 'region', kind: 'select' },
      { name: 'notice', kind: 'textarea', value: notice },
    ]);
    await form.getByRole('button', { name: /Enregistrer la prescription/ }).click();
    await expect(form.getByText('Le diagnostic est obligatoire').first(), 'Diagnostic signalé obligatoire').toBeVisible();
    await expect(form, 'Le formulaire reste ouvert').toBeVisible();
    await form.getByRole('button', { name: /Annuler/ }).click();
    await this.expectCount('Imagerie', before);
  }

  /** Ajoute une prescription d'imagerie (type d'imagerie, examen, docteur, date, région, diagnostic). */
  async addImagingPrescription(notice: string, date: string): Promise<FilledValues> {
    const before = Number(await this.panelCount('Imagerie').innerText());
    await this.openCreator('Imagerie');
    const form = this.root.locator('app-imaging-prescription');
    await expect(form).toBeVisible();
    // Type d'imagerie : ng-select sans formControlName (ngModel), premier de la liste.
    await form.locator('ng-select').first().locator('.ng-select-container').click();
    const kindOption = this.page.locator('.ng-dropdown-panel .ng-option:not(.ng-option-disabled)').first();
    const kind = ((await kindOption.textContent()) ?? '').replace(/\s+/g, ' ').trim();
    await kindOption.click();
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
    return { ...filled, kind };
  }

  // ---------------------------------------------------------------------------------------------
  // Conformité du contenu enregistré : résumé déplié de chaque prescription, puis formulaire de
  // modification rouvert (chaque champ restitué) et refermé sans enregistrer.
  // ---------------------------------------------------------------------------------------------

  /**
   * Résumé d'une ordonnance : une ligne par médicament, chaque colonne restituée (« -- » sans
   * remarque), et l'encadré « Recommandations » de l'ordonnance (absent s'il n'y en a pas).
   */
  async expectMedicationRow(medication: string, med: { nom: string; posologie: string; duree?: string; remarques?: string; recommandations?: string }) {
    const row = await this.row('Ordonnance', medication);
    // Titre masqué : celui par défaut, conservé tel quel
    await expect(row.locator('.rx-row-title'), "Titre par défaut de l'ordonnance").toHaveText(DEFAULT_MEDICATION_TITLE);
    const details = await this.details('Ordonnance', medication);
    const rows = details.locator('tbody tr');
    await expect(rows, `Ordonnance "${medication}" : un médicament`).toHaveCount(1);
    const cells = rows.first().locator('td');
    await expect(cells.nth(0), 'Médicament').toHaveText(med.nom);
    await expect(cells.nth(1), 'Posologie').toHaveText(med.posologie);
    if (med.duree !== undefined) await expect(cells.nth(2), 'Durée').toHaveText(new RegExp(`^\\s*${med.duree}\\s*$`, 'i'));
    await expect(cells.nth(3), 'Remarques').toHaveText(med.remarques ?? '--');
    const recommandations = details.locator('.alert');
    if (med.recommandations) await expect(recommandations, 'Recommandations').toHaveText(med.recommandations);
    else await expect(recommandations, 'Pas de recommandations').toHaveCount(0);
  }

  /** Résumé du bulletin d'analyses : exactement les analyses choisies, et le diagnostic. */
  async expectLaboratorySummary(filled: FilledValues) {
    const details = await this.details('Analyses', '');
    const analyses = (filled.analyses as string[]) ?? [];
    const items = details.locator('ul li strong');
    await expect(items, 'Analyses prescrites').toHaveCount(analyses.length);
    const shown = (await items.allTextContents()).map(t => t.replace(/\s+/g, ' ').trim().toLowerCase()).sort();
    expect(shown, 'Analyses prescrites').toEqual(analyses.map(a => a.toLowerCase()).sort());
    await expect(details.locator('.alert'), 'Diagnostic').toHaveText(filled.diagnostic as string);
  }

  /** Résumé du bulletin d'imagerie : type d'examen, région anatomique et diagnostic. */
  async expectImagingSummary(filled: FilledValues) {
    const details = await this.details('Imagerie', '');
    const exam = details.locator('ul li').first();
    await expect(exam, "Type d'imagerie").toContainText(filled.kind as string, { ignoreCase: true });
    await expect(exam, 'Région anatomique').toContainText(filled.region as string, { ignoreCase: true });
    await expect(details.locator('.alert'), 'Diagnostic').toHaveText(filled.notice as string);
  }

  /** Ouvre en modification la prescription (repérée comme dans `row`, sinon la première) ; consultation activée. */
  private async openEditor(kind: PrescriptionKind, selector: string, text = ''): Promise<Locator> {
    const row = await this.row(kind, text);
    await row.locator('button[title="Modifier"]').click();
    const form = this.root.locator(selector);
    await expect(form, `Formulaire de modification "${kind}"`).toBeVisible();
    return form;
  }

  private async closeEditor(form: Locator) {
    await form.getByRole('button', { name: /Annuler/ }).first().click();
    await expect(form).toBeHidden();
  }

  /** Formulaire de l'ordonnance rouvert : titre, médicament, posologie, durée, recommandations. */
  async expectMedicationForm(data: MedicationPrescriptionData) {
    const form = await this.openEditor('Ordonnance', 'app-medication-prescription', data.medicationName);
    const titleInput = form.getByPlaceholder(TITLE_PLACEHOLDER);
    // Titre saisi s'il est affiché, sinon celui par défaut, conservé
    if (data.title && await titleInput.isVisible()) await expect(titleInput, 'Titre').toHaveValue(data.title);
    else await expect(titleInput, 'Titre par défaut').toHaveValue(DEFAULT_MEDICATION_TITLE);
    await expect(form.getByPlaceholder('Nom du médicament'), 'Un médicament').toHaveCount(1);
    await expect(form.getByPlaceholder('Nom du médicament'), 'Médicament').toHaveValue(data.medicationName);
    await expect(form.getByPlaceholder('Ex: 1 cp matin et soir').first(), 'Posologie').toHaveValue(data.posologie);
    if (data.duree) {
      const line = form.locator('tbody tr').first();
      await expect(line.getByPlaceholder('Nb'), 'Durée : nombre').toHaveValue(String(data.duree.nombre));
      const unit = await line.locator('select').first().evaluate((el: HTMLSelectElement) => el.selectedOptions[0]?.textContent?.trim() ?? '');
      expect(unit, 'Durée : unité').toBe(data.duree.unite);
    }
    if (data.recommandations) await expect(form.locator('textarea').last(), 'Recommandations').toHaveValue(data.recommandations);
    await this.closeEditor(form);
  }

  /** Formulaire du bulletin d'analyses rouvert : prescripteur, type, analyses (exactement), diagnostic. */
  async expectLaboratoryForm(filled: FilledValues) {
    const form = await this.openEditor('Analyses', 'app-laboratory-prescription');
    await new ConsultationFormPage(this.page, form).expectValues([
      { name: 'caregiverId', kind: 'select' },
      { name: 'typeBilan', kind: 'select' },
      { name: 'analyses', kind: 'multiselect' },
      { name: 'diagnostic', kind: 'textarea', value: '' },
    ], filled, { exact: true });
    await this.closeEditor(form);
  }

  /** Formulaire du bulletin d'imagerie rouvert : type, examen, prescripteur, date, région, diagnostic. */
  async expectImagingForm(filled: FilledValues) {
    const form = await this.openEditor('Imagerie', 'app-imaging-prescription');
    await expect(form.locator('ng-select').first().locator('.ng-value'), "Type d'imagerie").toContainText(filled.kind as string, { ignoreCase: true });
    await new ConsultationFormPage(this.page, form).expectValues([
      { name: 'type', kind: 'select' },
      { name: 'caregiverId', kind: 'select' },
      { name: 'date', kind: 'date', value: '' },
      { name: 'region', kind: 'select' },
      { name: 'notice', kind: 'textarea', value: '' },
    ], filled);
    await this.closeEditor(form);
  }

  /** Relevé des prescriptions (en-tête de chaque ligne, par panneau) pour comparer avant / après. */
  async snapshot(): Promise<Record<PrescriptionKind, string[]>> {
    const read = async (kind: PrescriptionKind) =>
      (await this.rows(kind).locator('.rx-row-header').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim()).sort();
    return { Ordonnance: await read('Ordonnance'), Analyses: await read('Analyses'), Imagerie: await read('Imagerie') };
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
    await expect(await this.row(kind, text)).toBeVisible();
  }

  /**
   * Vérifie un détail (ex: posologie) affiché seulement quand la ligne est dépliée : déplie la
   * prescription dont le titre est donné puis contrôle son contenu.
   */
  async expectPrescriptionDetail(kind: PrescriptionKind, text: string, detail: string) {
    await expect(await this.details(kind, text)).toContainText(detail);
  }

  /** Déplie la ligne de la prescription (repérée comme dans `row`) et renvoie son détail. */
  async details(kind: PrescriptionKind, text: string): Promise<Locator> {
    const row = await this.row(kind, text);
    await this.expand(row);
    return row.locator('.rx-row-details');
  }

  private async expand(row: Locator) {
    await expect(row).toBeVisible();
    if (!/\bexpanded\b/.test((await row.getAttribute('class')) ?? '')) {
      await row.locator('.rx-row-header').click();
    }
    await expect(row.locator('.rx-row-details')).toBeVisible();
  }

  /**
   * Ligne d'une prescription. Ordonnance : repérée par le nom d'un de ses médicaments (titre
   * masqué depuis le 2026-11-20, le même « Ordonnance jj/mm/aaaa » pour toutes celles du jour) ou
   * par son titre ; autres types : par un texte de l'en-tête ; texte vide : la première.
   */
  async row(kind: PrescriptionKind, text = ''): Promise<Locator> {
    const rows = this.rows(kind);
    if (!text) return rows.first();
    if (kind !== 'Ordonnance') return rows.filter({ hasText: text }).first();
    await expect(rows.first(), 'Au moins une ordonnance').toBeVisible();
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      if (((await row.locator('.rx-row-title').textContent()) ?? '').includes(text)) return row;
      await this.expand(row);
      const names = (await row.locator('.rx-row-details tbody tr td:first-child').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim());
      if (names.includes(text)) return row;
    }
    throw new Error(`Ordonnance du médicament "${text}" introuvable`);
  }
}
