import { type Page, type Locator, expect } from '@playwright/test';
import { MyConfigurationPage } from './configuration.page';

export type ActDomain = 'Consultation' | 'Échographie' | 'Vaccination' | 'Bilan';
export const ACT_DOMAINS: ActDomain[] = ['Consultation', 'Échographie', 'Vaccination', 'Bilan'];

export interface TemplateStep {
  plannedPeriod: string;
  /** Types d'actes de l'étape ; `acts: 'all'` = tous les actes du catalogue du type. */
  groups: { domain: ActDomain; acts: 'all' | number }[];
}

export interface CarePathwayTemplate {
  name: string;
  description: string;
  targetSex: 'Tous les sexes' | 'Femmes uniquement' | 'Hommes uniquement';
  startDateLabel?: string;
  steps: TemplateStep[];
}

/** Actes réellement retenus, par étape (index 0..n-1), pour les vérifications ultérieures. */
export type SelectedActs = string[][];

/**
 * Administration > Paramètres > "Parcours de soins" : modèles de parcours (nom, description,
 * sexe ciblé, libellé de date de début, étapes avec types d'actes et actes médicaux prévus).
 */
export class CarePathwayTemplatePage {
  private readonly config: MyConfigurationPage;
  readonly section: Locator;
  readonly modal: Locator;

  constructor(private readonly page: Page) {
    this.config = new MyConfigurationPage(page);
    this.section = this.config.configCard('Parcours de soins');
    this.modal = page.locator('.modal-modern-card').filter({ has: page.locator('.steps-list') });
  }

  async open() {
    await this.config.openSection('Parcours de soins');
    await expect(this.section.getByRole('button', { name: /Nouveau type de parcours/ })).toBeVisible();
  }

  row(name: string): Locator {
    return this.section.locator('.cpt-row').filter({
      has: this.page.locator('.cpt-row-title', { hasText: new RegExp(`^\\s*${escapeRegExp(name)}\\b`) }),
    });
  }

  private async pickOptions(select: Locator, mode: 'all' | number): Promise<string[]> {
    await select.locator('.ng-select-container').click();
    const panel = this.modal.locator('.ng-dropdown-panel');
    await expect(panel).toBeVisible();
    const free = panel.locator('.ng-option:not(.ng-option-disabled):not(.ng-option-selected)');
    const labels: string[] = [];
    const total = mode === 'all' ? await free.count() : mode;
    for (let i = 0; i < total; i++) {
      const option = free.first();
      labels.push(((await option.textContent()) ?? '').replace(/\s+/g, ' ').trim());
      await option.click({ timeout: 5000 }).catch(() => option.dispatchEvent('click'));
    }
    await this.page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    return labels;
  }

  private async pickSingle(select: Locator, label: string) {
    await select.locator('.ng-select-container').click();
    const option = this.modal.locator('.ng-dropdown-panel .ng-option').filter({ hasText: new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`) }).first();
    await option.click({ timeout: 5000 }).catch(() => option.dispatchEvent('click'));
    await expect(select.locator('.ng-value')).toContainText(label);
  }

  /** Remplit le formulaire de modèle (ouvert) et renvoie les actes choisis par étape. */
  private async fillForm(template: CarePathwayTemplate): Promise<SelectedActs> {
    await this.modal.locator('[formcontrolname="careplanType"]').fill(template.name);
    await this.modal.locator('[formcontrolname="description"]').fill(template.description);
    await this.pickSingle(this.modal.locator('ng-select[formcontrolname="targetSex"]'), template.targetSex);
    if (template.startDateLabel !== undefined) {
      await this.modal.locator('[formcontrolname="startDateLabel"]').fill(template.startDateLabel);
    }

    const selected: SelectedActs = [];
    const steps = this.modal.locator('.step-card');
    for (let i = 0; i < template.steps.length; i++) {
      if (await steps.count() <= i) await this.modal.getByRole('button', { name: /Ajouter une étape/ }).click();
      const step = steps.nth(i);
      await step.locator('[formcontrolname="plannedPeriod"]').fill(template.steps[i].plannedPeriod);
      const stepActs: string[] = [];
      const groups = step.locator('.act-group');
      for (let j = 0; j < template.steps[i].groups.length; j++) {
        if (await groups.count() <= j) await step.getByRole('button', { name: /Ajouter un type d'acte/ }).click();
        const group = groups.nth(j);
        await this.pickSingle(group.locator('ng-select[formcontrolname="domain"]'), template.steps[i].groups[j].domain);
        stepActs.push(...await this.pickOptions(group.locator('ng-select[formcontrolname="acts"]'), template.steps[i].groups[j].acts));
      }
      selected.push(stepActs);
    }
    return selected;
  }

  async create(template: CarePathwayTemplate): Promise<SelectedActs> {
    await this.section.getByRole('button', { name: /Nouveau type de parcours/ }).click();
    await expect(this.modal).toBeVisible();
    await expect(this.modal.getByRole('heading', { name: /Nouveau modèle de parcours/ })).toBeVisible();
    const selected = await this.fillForm(template);
    await this.save();
    await expect(this.row(template.name)).toBeVisible({ timeout: 15000 });
    await expect(this.row(template.name)).toContainText(`${template.steps.length} étape(s) configurée(s)`);
    return selected;
  }

  async openEdit(name: string) {
    await this.row(name).getByRole('button', { name: /Modifier/ }).click();
    await expect(this.modal.getByRole('heading', { name: /Modifier le modèle de parcours/ })).toBeVisible();
  }

  /** Ajoute une étape au modèle ouvert en modification et modifie sa description. */
  async addStepAndDescribe(description: string, step: TemplateStep): Promise<string[]> {
    await this.modal.locator('[formcontrolname="description"]').fill(description);
    await this.modal.getByRole('button', { name: /Ajouter une étape/ }).click();
    const card = this.modal.locator('.step-card').last();
    await card.locator('[formcontrolname="plannedPeriod"]').fill(step.plannedPeriod);
    const acts: string[] = [];
    for (let j = 0; j < step.groups.length; j++) {
      const groups = card.locator('.act-group');
      if (await groups.count() <= j) await card.getByRole('button', { name: /Ajouter un type d'acte/ }).click();
      await this.pickSingle(groups.nth(j).locator('ng-select[formcontrolname="domain"]'), step.groups[j].domain);
      acts.push(...await this.pickOptions(groups.nth(j).locator('ng-select[formcontrolname="acts"]'), step.groups[j].acts));
    }
    return acts;
  }

  async save() {
    await this.modal.getByRole('button', { name: /Enregistrer/ }).click();
    await expect(this.modal).toBeHidden({ timeout: 20000 });
  }

  /** Demande la suppression et confirme l'avertissement (sans présumer du résultat). */
  async requestRemoval(name: string) {
    await this.row(name).locator('button.cpt-btn--danger').click();
    const warning = this.page.locator('.warning-modal-card');
    // Le message est affiché en minuscules (titleCaseWord) : comparaison sans casse.
    await expect(warning).toContainText(name, { ignoreCase: true });
    await warning.getByRole('button', { name: /Confirmer/ }).click();
  }

  /**
   * Supprime un modèle non utilisé. La liste n'est pas rafraîchie après une suppression réussie
   * (le composant teste response.result.code au lieu de response.code) : on recharge la page
   * pour constater le résultat réel.
   */
  async remove(name: string) {
    await this.requestRemoval(name);
    await this.page.locator('.toast-success, .toast-error').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await this.page.reload();
    await this.open();
    await expect(this.row(name), `Le modèle "${name}" doit être supprimé`).toHaveCount(0, { timeout: 15000 });
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
