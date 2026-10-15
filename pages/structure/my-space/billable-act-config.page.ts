import { type Page, type Locator, expect } from '@playwright/test';
import { MyConfigurationPage } from './configuration.page';

export type BillableActRow = { nom: string; type: string; specialite: string; statut: string };

/**
 * Administration > Paramètres > "Actes" : actes facturables de la structure, choisis dans le
 * référentiel par spécialité. Un acte déjà ajouté n'est plus proposé à l'ajout ; un acte qui a
 * encore des actes à facturer (non facturés) ne peut pas être désactivé ; le désactiver désactive
 * aussi la rémunération paramétrée dessus.
 */
export class BillableActConfigPage {
  private readonly config: MyConfigurationPage;
  readonly section: Locator;
  /** Fenêtre "Nouvel acte" ou modification (carte entière, boutons compris). */
  readonly modal: Locator;

  constructor(private readonly page: Page) {
    this.config = new MyConfigurationPage(page);
    this.section = this.config.configCard('Actes');
    this.modal = page.locator('.modal-modern-card').filter({ has: page.locator('[formcontrolname="billableActs"]') }).last();
  }

  async open() {
    await this.config.openSection('Actes');
    await expect(this.section.getByRole('columnheader', { name: 'Spécialité' })).toBeVisible();
  }

  async rows(): Promise<BillableActRow[]> {
    const result: BillableActRow[] = [];
    for (const row of await this.section.locator('table tbody tr').filter({ hasNot: this.page.getByText('Aucun acte facturable') }).all()) {
      const cell = async (label: string) => ((await row.locator(`td[data-label="${label}"]`).textContent()) ?? '').replace(/\s+/g, ' ').trim();
      result.push({ nom: await cell('Nom'), type: await cell('Type'), specialite: await cell('Spécialité'), statut: await cell('Statut') });
    }
    return result;
  }

  row(nom: string): Locator {
    return this.section.locator('table tbody tr').filter({
      has: this.page.locator('td[data-label="Nom"]', { hasText: accentInsensitive(nom) }),
    });
  }

  private async pick(select: Locator, label: string) {
    await select.locator('.ng-select-container').click();
    // Libellés comparés sans accents : "TOUTES LES SPECIALITES" (ajout) = "Toutes les spécialités" (filtre)
    const option = this.page.locator('.ng-dropdown-panel .ng-option:not(.ng-optgroup)').filter({ hasText: accentInsensitive(label) }).first();
    await expect(option, `Option "${label}"`).toBeVisible({ timeout: 10000 });
    // La liste des filtres peut passer sous l'en-tête de la carte suivante, qui intercepte le clic
    await option.click({ timeout: 5000 }).catch(() => option.dispatchEvent('click'));
    const panel = this.page.locator('.ng-dropdown-panel');
    if (await panel.isVisible().catch(() => false)) await select.locator('.ng-arrow-wrapper').click();
  }

  /** Filtres (nom, type, spécialité, état) puis recherche ; un filtre absent est vidé. */
  async search(filters: { nom?: string; type?: string; specialite?: string; etat?: 'Actif' | 'Inactif' } = {}) {
    await this.section.getByRole('button', { name: /Réinitialiser/ }).click();
    // Filtres de la recherche avancée, dans l'ordre : Type, Spécialité, État
    const selects = this.section.locator('.section-search ng-select');
    if (filters.nom) await this.section.getByPlaceholder("Nom de l'acte...").fill(filters.nom); // nom affiché tel quel (le front retire le préfixe de type)
    if (filters.type) await this.pick(selects.nth(0), filters.type);
    if (filters.specialite) await this.pick(selects.nth(1), filters.specialite);
    if (filters.etat) await this.pick(selects.nth(2), filters.etat);
    await this.section.getByRole('button', { name: /^\W*Rechercher$/ }).click();
    await this.page.waitForTimeout(1500);
  }

  async openNew() {
    // À l'ouverture, le front recharge tous les actes de la structure (actifs puis inactifs) pour
    // ne proposer que ceux pas encore ajoutés : la liste n'est juste qu'après ces deux réponses.
    const allActs = (active: boolean) => this.page.waitForResponse(r =>
      r.url().includes('/his/billableacts/search') && (r.request().postData() ?? '').includes(`"active":${active}`)
      && (r.request().postData() ?? '').includes('"size":100000'), { timeout: 30000 });
    const loaded = Promise.all([allActs(true), allActs(false)]);
    await this.section.getByTitle('Nouvel acte').click();
    await expect(this.modal).toBeVisible();
    await loaded;
  }

  async openEdit(nom: string) {
    await this.row(nom).first().locator('button.action-edit').click();
    await expect(this.modal).toBeVisible();
  }

  async close() {
    await this.modal.getByRole('button', { name: /Fermer|Annuler/ }).first().click();
    await expect(this.modal).toBeHidden();
  }

  /** Spécialités proposées dans "Nouvel acte". */
  async specialities(): Promise<string[]> {
    const select = this.modal.locator('[formcontrolname="speciality"]');
    await select.locator('.ng-select-container').click();
    const names = (await this.page.locator('.ng-dropdown-panel .ng-option').allTextContents()).map(s => s.replace(/\s+/g, ' ').trim());
    await select.locator('.ng-arrow-wrapper').click();
    return names;
  }

  /**
   * Spécialités du soignant connecté (libellés). La facturation ne propose que les actes de ses
   * spécialités ou de "toutes les spécialités" (sauf rôles 63/66).
   */
  async userSpecialities(): Promise<string[]> {
    return this.page.evaluate(() => {
      const user = JSON.parse(localStorage.getItem('currentUser') ?? '{}');
      const refs: { code: number; display: string }[] = JSON.parse(localStorage.getItem('SPECIALITY') ?? '[]');
      return refs.filter(r => (user.specialities ?? []).includes(r.code)).map(r => r.display);
    });
  }

  /** Choisit la spécialité puis renvoie les actes proposés pour elle. */
  async chooseSpeciality(speciality: string): Promise<string[]> {
    await this.pick(this.modal.locator('[formcontrolname="speciality"]'), speciality);
    const acts = this.modal.locator('[formcontrolname="billableActs"]');
    await acts.locator('.ng-select-container').click();
    const names = (await this.page.locator('.ng-dropdown-panel .ng-option:not(.ng-optgroup):not(.ng-option-disabled)').allTextContents())
      .map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    await acts.locator('.ng-arrow-wrapper').click();
    return names;
  }

  async chooseAct(act: string) {
    await this.pick(this.modal.locator('[formcontrolname="billableActs"]'), act);
  }

  /** Spécialités (modification) : ajoute celle indiquée à la liste. */
  async addSpeciality(speciality: string) {
    await this.pick(this.modal.locator('[formcontrolname="specialities"]'), speciality);
  }

  /** Enregistre et renvoie le message de l'application ('' si aucun). */
  async save(): Promise<string> {
    await this.modal.getByRole('button', { name: /Enregistrer|Modifier|Valider/ }).last().click();
    const toast = this.page.locator('.toast-success, .toast-error').first();
    return (await toast.waitFor({ state: 'visible', timeout: 10000 }).then(() => toast.innerText(), () => '')).replace(/\s+/g, ' ').trim();
  }

  /** Active ou désactive l'acte (confirmation comprise) et renvoie le message affiché. */
  async toggle(nom: string): Promise<string> {
    await this.row(nom).first().locator('button.action-toggle').click();
    await expect(this.page.getByText(/rémunération paramétrée sur cet acte/i)).toBeVisible();
    await this.page.getByRole('button', { name: 'Confirmer' }).click();
    const message = this.page.getByText(/changement d.état a réussi|en cours d.utilisation|Échec de changement d.état/i).first();
    await expect(message).toBeVisible({ timeout: 15000 });
    return ((await message.textContent()) ?? '').replace(/\s+/g, ' ').trim();
  }
}

/** Sans accents ni casse, pour comparer les libellés de spécialité écrits différemment selon l'écran. */
export function normalizeLabel(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

/** Expression du libellé entier, chaque lettre acceptant ses variantes accentuées. */
export function accentInsensitive(label: string): RegExp {
  const variants: Record<string, string> = { A: 'aàâä', C: 'cç', E: 'eéèêë', I: 'iîï', O: 'oôö', U: 'uùûü' };
  // Accents précomposés ("é") ou décomposés ("e" + accent combinant, présents dans le référentiel)
  // Espaces multiples acceptés : les visites sont nommées "Visite  " + nom (deux espaces)
  const body = [...normalizeLabel(label)].map(c => c === ' ' ? '\\s+' : (variants[c] ? `[${variants[c]}]` : escapeRegExp(c)) + '[\\u0300-\\u036f]*').join('');
  return new RegExp(`^\\s*${body}\\s*$`, 'i');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
