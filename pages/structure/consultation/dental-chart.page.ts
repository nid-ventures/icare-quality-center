import { type Page, type Locator, expect } from '@playwright/test';

/** État d'une dent tel que calculé par l'application (ConsultationToothComponent.getToothState). */
export type ToothState = 'healthy' | 'caries' | 'filling' | 'crown' | 'implant' | 'missing';
export type Surface = 'O' | 'M' | 'D' | 'V' | 'L';

export interface ToothEntry {
  number: string;
  diagnostic?: string;
  treatment?: string;
  surfaces?: Surface[];
  observations?: string;
}

export const ADULT_TEETH = [
  '11', '12', '13', '14', '15', '16', '17', '18', '21', '22', '23', '24', '25', '26', '27', '28',
  '31', '32', '33', '34', '35', '36', '37', '38', '41', '42', '43', '44', '45', '46', '47', '48',
];
export const CHILD_TEETH = [
  '51', '52', '53', '54', '55', '61', '62', '63', '64', '65',
  '71', '72', '73', '74', '75', '81', '82', '83', '84', '85',
];

/**
 * Odontogramme des consultations dentaires (création et modification) : schéma des dents,
 * panneau d'édition d'une dent (diagnostic, traitement, surfaces, observations), statistiques.
 */
export class DentalChartPage {
  readonly root: Locator;
  readonly detailCard: Locator;
  readonly diagnosticSelect: Locator;
  readonly treatmentSelect: Locator;
  readonly observationsInput: Locator;
  readonly saveToothButton: Locator;
  readonly cancelToothButton: Locator;
  readonly clearToothButton: Locator;
  readonly stats: Locator;

  constructor(private readonly page: Page, root?: Locator) {
    this.root = root ?? page.locator('app-consultation-tooth, app-consultation-tooth-edit').filter({ visible: true }).first();
    this.detailCard = this.root.locator('.tooth-detail-card');
    this.diagnosticSelect = this.detailCard.locator('select').nth(0);
    this.treatmentSelect = this.detailCard.locator('select').nth(1);
    this.observationsInput = this.detailCard.locator('textarea');
    this.saveToothButton = this.detailCard.getByRole('button', { name: /Enregistrer|Valider/ });
    this.cancelToothButton = this.detailCard.getByRole('button', { name: /Annuler/ });
    this.clearToothButton = this.detailCard.getByRole('button', { name: /Effacer/ });
    this.stats = this.root.locator('.stats-container');
  }

  /** Case de la dent dans le schéma (élément portant les classes d'état). */
  tooth(number: string): Locator {
    return this.root.locator(`.tooth-container[title^="Dent ${number} -"] .tooth`);
  }

  allTeeth(): Locator {
    return this.root.locator('.tooth-container');
  }

  async selectPatientType(type: 'adult' | 'child') {
    await this.root.locator('.patient-type-toggle').getByRole('button', { name: type === 'adult' ? /Adulte/ : /Enfant/ }).click();
  }

  async expectTeeth(numbers: string[]) {
    await expect(this.allTeeth()).toHaveCount(numbers.length);
    for (const number of numbers) {
      await expect(this.tooth(number), `Dent ${number}`).toBeVisible();
    }
  }

  async openTooth(number: string) {
    await this.tooth(number).click();
    await expect(this.detailCard).toBeVisible();
    await expect(this.detailCard).toContainText(`Dent ${number}`);
  }

  async toggleSurface(surface: Surface) {
    // Le texte du bouton est lu d'un bloc ("OOcclusaleFace supérieure") : on cible son icône.
    await this.detailCard.locator('.surface-btn').filter({
      has: this.page.locator('.surface-icon', { hasText: new RegExp(`^\\s*${surface}\\s*$`) }),
    }).click();
  }

  /** Renseigne une dent dans le panneau d'édition puis l'enregistre dans le schéma. */
  async recordTooth(entry: ToothEntry) {
    await this.openTooth(entry.number);
    if (entry.diagnostic !== undefined) await this.diagnosticSelect.selectOption({ label: entry.diagnostic });
    if (entry.treatment !== undefined) await this.treatmentSelect.selectOption({ label: entry.treatment });
    for (const surface of entry.surfaces ?? []) await this.toggleSurface(surface);
    if (entry.observations !== undefined) await this.observationsInput.fill(entry.observations);
    await this.saveToothButton.click();
    await expect(this.detailCard).toBeHidden();
  }

  async expectToothState(number: string, state: ToothState) {
    const others: ToothState[] = ['caries', 'filling', 'crown', 'implant', 'missing'];
    if (state === 'healthy') {
      for (const s of others) await expect(this.tooth(number), `Dent ${number} saine`).not.toHaveClass(new RegExp(`\\b${s}\\b`));
    } else {
      await expect(this.tooth(number), `Dent ${number} : état ${state}`).toHaveClass(new RegExp(`\\b${state}\\b`));
    }
  }

  async expectSurfaces(number: string, surfaces: Surface[]) {
    const dots = this.tooth(number).locator('.surface-dot');
    await expect(dots).toHaveCount(surfaces.length);
    for (const surface of surfaces) {
      await expect(this.tooth(number).locator(`.surface-dot.surface-${surface}`)).toHaveCount(1);
    }
  }

  async expectNotesIndicator(number: string, visible: boolean) {
    await expect(this.tooth(number).locator('.notes-indicator')).toHaveCount(visible ? 1 : 0);
  }

  /** Valeur d'un compteur des statistiques ("Saines", "À traiter", "Traitements", "Extractions", "Manquantes"). */
  statValue(label: string): Locator {
    return this.stats.locator('.stat-item').filter({ hasText: label }).locator('.stat-value');
  }

  async expectStats(expected: { examined: number; caries?: number; treatments?: number; extractions?: number; missing?: number }) {
    await expect(this.stats.locator('.badge')).toContainText(`${expected.examined} dent(s) examinée(s)`);
    if (expected.caries !== undefined) await expect(this.statValue('À traiter')).toHaveText(String(expected.caries));
    if (expected.treatments !== undefined) await expect(this.statValue('Traitements')).toHaveText(String(expected.treatments));
    if (expected.extractions !== undefined) await expect(this.statValue('Extractions')).toHaveText(String(expected.extractions));
    if (expected.missing !== undefined) await expect(this.statValue('Manquantes')).toHaveText(String(expected.missing));
  }

  /** Fenêtre d'avertissement de l'application (ModalService / ModalComponent). */
  warningModal(): Locator {
    return this.page.locator('.warning-modal-card');
  }

  async confirmModal() {
    await this.warningModal().getByRole('button', { name: /Confirmer/ }).click();
    await expect(this.warningModal()).toBeHidden();
  }

  async cancelModal() {
    await this.warningModal().getByRole('button', { name: 'Fermer' }).click();
    await expect(this.warningModal()).toBeHidden();
  }
}
