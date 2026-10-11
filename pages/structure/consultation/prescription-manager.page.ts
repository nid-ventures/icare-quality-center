import { type Page, type Locator, expect } from '@playwright/test';

export interface MedicationPrescriptionData {
  title: string;
  medicationName: string;
  posologie: string;
  recommandations?: string;
}

/**
 * Gestionnaire de prescriptions intégré aux formulaires de consultation
 * (`app-prescription-manager`) : 3 panneaux (Ordonnance / Analyses / Imagerie). Les
 * prescriptions sont un brouillon enregistré avec la consultation.
 */
export class PrescriptionManagerPage {
  readonly root: Locator;

  constructor(private readonly page: Page) {
    this.root = page.locator('app-prescription-manager').filter({ visible: true }).first();
  }

  private panelHeader(label: 'Ordonnance' | 'Analyses' | 'Imagerie'): Locator {
    return this.root.locator('.rx-panel-header').filter({
      has: this.page.locator('h6', { hasText: new RegExp(`^\\s*${label}\\s*$`) }),
    });
  }

  panelCount(label: 'Ordonnance' | 'Analyses' | 'Imagerie'): Locator {
    return this.panelHeader(label).locator('.rx-panel-count');
  }

  /** Ajoute une ordonnance (un médicament) au brouillon de prescriptions de la consultation. */
  async addMedicationPrescription(data: MedicationPrescriptionData) {
    await this.panelHeader('Ordonnance').scrollIntoViewIfNeeded();
    await this.panelHeader('Ordonnance').click();
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
    await expect(this.panelCount('Ordonnance')).toHaveText(/[1-9]/);
  }
}
