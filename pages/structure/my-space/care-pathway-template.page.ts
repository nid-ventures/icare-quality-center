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
  async fillForm(template: CarePathwayTemplate): Promise<SelectedActs> {
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

  /** Ouvre le formulaire d'un nouveau modèle. */
  async openNew() {
    await this.section.getByRole('button', { name: /Nouveau type de parcours/ }).click();
    await expect(this.modal).toBeVisible();
    await expect(this.modal.getByRole('heading', { name: /Nouveau modèle de parcours/ })).toBeVisible();
  }

  async create(template: CarePathwayTemplate): Promise<SelectedActs> {
    await this.openNew();
    const selected = await this.fillForm(template);
    await this.save();
    await expect(this.row(template.name)).toBeVisible({ timeout: 15000 });
    await expect(this.row(template.name)).toContainText(`${template.steps.length} étape(s) configurée(s)`);
    await expect(this.status(template.name), 'Nouveau modèle actif').toHaveText('Actif');
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
    // Après l'enregistrement, l'écran recharge tous les modèles (recherche sans pagination) dans le
    // cache du navigateur lu par le dashboard patient : on attend cette réponse, sinon un dossier
    // ouvert juste après ne propose pas encore le modèle.
    const cacheRefreshed = this.page.waitForResponse(r => r.url().includes('/careplantemplates/search')
      && r.request().method() === 'POST' && /"size":\s*9999/.test(r.request().postData() ?? ''), { timeout: 60000 });
    cacheRefreshed.catch(() => {});
    const { status, body, summary } = await this.submit();
    // En cas de refus, code et motif (toast trop bref pour la capture d'échec) sont dans l'erreur.
    if (status >= 400 || ![200, 201].includes(body?.code)) throw new Error(`Enregistrement refusé : ${summary}`);
    await expect(this.modal).toBeHidden({ timeout: 20000 });
    await cacheRefreshed;
  }

  /**
   * Clique sur "Enregistrer" et renvoie la réponse du backend à la création (POST) / modification
   * (PUT) du modèle, sans présumer du résultat.
   */
  async submit(): Promise<{ status: number; body: any; summary: string }> {
    const saved = this.page.waitForResponse(r => /\/careplantemplates\/?(\d+)?(\?.*)?$/.test(r.url())
      && ['POST', 'PUT'].includes(r.request().method()), { timeout: 20000 });
    await this.modal.getByRole('button', { name: /Enregistrer/ }).click();
    const response = await saved.catch(() => null);
    if (!response) throw new Error("Aucune requête d'enregistrement envoyée (formulaire jugé invalide ?)");
    const body = await response.json().catch(() => null);
    const summary = `HTTP ${response.status()}, code ${body?.code}, ${JSON.stringify(body?.result ?? body?.message ?? body)}`;
    return { status: response.status(), body, summary };
  }

  /** Badge de statut ("Actif" / "Désactivé") d'un modèle de la liste. */
  status(name: string): Locator {
    return this.row(name).locator('.cpt-status-tag');
  }

  /** Filtre de statut de la liste (actifs par défaut) ; `Tous` vide le filtre (actifs et désactivés). */
  async filterStatus(status: 'Actif' | 'Désactivé' | 'Tous') {
    const select = this.section.locator('ng-select.cpt-status-select');
    // Attend la nouvelle recherche : sans cela, la liste précédente serait vérifiée à sa place.
    const searched = this.page.waitForResponse(r => r.url().includes('/careplantemplates/search') && r.request().method() === 'POST');
    if (status === 'Tous') {
      await select.locator('.ng-clear-wrapper').click();
      await expect(select.locator('.ng-value')).toHaveCount(0);
    } else {
      await select.locator('.ng-select-container').click();
      await this.page.locator('.ng-dropdown-panel .ng-option').filter({ hasText: new RegExp(`^\\s*${status}\\s*$`) }).first().click();
      await expect(select.locator('.ng-value')).toContainText(status);
    }
    await searched;
    await expect(this.section.locator('.cpt-row').or(this.section.locator('.cpt-empty')).first()).toBeVisible({ timeout: 15000 });
  }

  /** Ligne d'utilisation : "Jamais utilisé" ou "Utilisé par N parcours (dont M en cours | archivés)". */
  usage(name: string): Locator {
    return this.row(name).locator('.cpt-row-meta').filter({ hasText: /Utilisé|Jamais utilisé/ });
  }

  /** Bouton de suppression : affiché seulement pour un modèle jamais utilisé. */
  deleteButton(name: string): Locator {
    return this.row(name).locator('button.cpt-btn--danger');
  }

  deactivateButton(name: string): Locator {
    return this.row(name).getByRole('button', { name: /Désactiver/ });
  }

  activateButton(name: string): Locator {
    return this.row(name).getByRole('button', { name: /^\W*Activer$/ });
  }

  /** Toasts d'une action précédente refermés : la réponse lue ensuite est bien la nôtre. */
  private async noToast() {
    await expect(this.page.locator('.toast-success, .toast-error')).toHaveCount(0, { timeout: 15000 });
  }

  /** Réponse de l'application à une action sur `name` : un toast de succès portant `message`. */
  private async expectSuccess(name: string, message: RegExp) {
    const toast = this.page.locator('.toast-success, .toast-error').first();
    await expect(toast, `Réponse à l'action sur "${name}"`).toBeVisible({ timeout: 15000 });
    await expect(toast, `Action sur "${name}" acceptée`).toHaveClass(/toast-success/);
    await expect(toast).toContainText(message);
  }

  /** Confirme la modale d'avertissement, qui doit citer le modèle et contenir `text`. */
  private async confirmWarning(name: string, text: RegExp) {
    const warning = this.page.locator('.warning-modal-card');
    // Le message est affiché en minuscules (titleCaseWord) : comparaison sans casse.
    await expect(warning).toContainText(name, { ignoreCase: true });
    await expect(warning).toContainText(text);
    await warning.getByRole('button', { name: /Confirmer/ }).click();
  }

  /** Supprime définitivement un modèle jamais utilisé : succès puis liste rafraîchie sans lui. */
  async remove(name: string) {
    await this.noToast();
    await this.deleteButton(name).click();
    await this.confirmWarning(name, /supprimer définitivement/i);
    await this.expectSuccess(name, /supprimé avec succès/);
    await expect(this.row(name), `Le modèle "${name}" doit être supprimé`).toHaveCount(0, { timeout: 15000 });
  }

  /**
   * Désactive un modèle (plus proposé à la création, parcours existants conservés) : il quitte la
   * liste des actifs (filtre par défaut).
   */
  async deactivate(name: string) {
    await this.noToast();
    await this.deactivateButton(name).click();
    await this.confirmWarning(name, /ne sera plus proposé/);
    await this.expectSuccess(name, new RegExp(`"${escapeRegExp(name)}" désactivé`));
    await expect(this.row(name), `"${name}" ne doit plus être listé parmi les actifs`).toHaveCount(0, { timeout: 15000 });
  }

  /** Réactive un modèle désactivé (liste filtrée sur "Désactivé" ou "Tous"), sans confirmation. */
  async activate(name: string) {
    await this.noToast();
    await this.activateButton(name).click();
    await this.expectSuccess(name, new RegExp(`"${escapeRegExp(name)}" activé`));
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
