import { type Page, type Locator, expect } from '@playwright/test';
import { MyConfigurationPage } from './configuration.page';
import { accentInsensitive, normalizeLabel } from './billable-act-config.page';

export interface RemunerationProfileData {
  speciality: string;   // libellé de la spécialité (ex: "pédiatrie")
  act: string;          // libellé de l'acte facturable
  coverage?: string;    // taux (%) ; les deux champs s'excluent : saisir l'un vide l'autre
  mount?: string;       // montant fixe (F CFA)
  startDate: string;    // AAAA-MM-JJ
  endDate: string;      // AAAA-MM-JJ
}

/**
 * Administration > Paramètres > "Rémunération médecin" : profils de rémunération par spécialité
 * et par acte. Un médecin n'apparaît dans les relevés d'honoraires que si un profil existe pour
 * l'une de ses spécialités (ReleveHonoraireService.getReleveHonoraireMedecins).
 */
export class RemunerationProfilePage {
  private readonly config: MyConfigurationPage;
  readonly section: Locator;
  readonly modal: Locator;

  constructor(private readonly page: Page) {
    this.config = new MyConfigurationPage(page);
    this.section = this.config.configCard('Rémunération médecin');
    this.modal = page.locator('.modal-modern-container').filter({ visible: true });
  }

  async open() {
    await this.config.openSection('Rémunération médecin');
    await expect(this.section.getByRole('columnheader', { name: 'Spécialité' })).toBeVisible();
  }

  rows(): Locator {
    return this.section.locator('table tbody tr').filter({ hasNot: this.page.getByText('Aucune rémunération') });
  }

  /** Ligne active correspondant à la spécialité et à l'acte (libellés en majuscules dans le tableau). */
  activeProfile(speciality: string, act: string): Locator {
    return this.rows()
      .filter({ hasText: new RegExp(looseText(speciality), 'i') })
      .filter({ hasText: new RegExp(looseText(act), 'i') })
      .filter({ hasText: /Actif/ });
  }

  /**
   * Le tableau est paginé : on filtre d'abord par spécialité via la recherche avancée de la
   * section, puis on cherche la ligne active de l'acte.
   */
  async hasActiveProfile(speciality: string, act: string): Promise<boolean> {
    const specialityFilter = this.section.locator('ng-select').first();
    await this.selectOption(specialityFilter, speciality);
    await this.section.getByRole('button', { name: /Rechercher/ }).first().click();
    await this.page.locator('app-loader .backdrop.full-screen').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await expect(this.section.locator('table tbody tr').first()).toBeVisible();
    return (await this.activeProfile(speciality, act).count()) > 0;
  }

  /** `search` : saisir le libellé pour filtrer (désactivé pour la liste multiple groupée des actes). */
  private async selectOption(select: Locator, label: string, search = true) {
    await select.locator('.ng-select-container').click();
    const input = select.locator('input[type="text"]');
    if (search && await input.isEditable().catch(() => false)) await input.fill(label);
    const option = this.page.locator('.ng-dropdown-panel .ng-option:not(.ng-optgroup)')
      .filter({ hasText: new RegExp(`^\\s*${looseText(label)}\\s*$`, 'i') }).first();
    await expect(option, `Option "${label}" proposée`).toBeVisible({ timeout: 10000 });
    await option.click({ timeout: 5000 }).catch(() => option.dispatchEvent('click', undefined, { timeout: 5000 }));
    await this.page.keyboard.press('Escape');
  }

  /**
   * Profil actif existant pour la spécialité (filtre de recherche de la section) : renvoie son acte
   * et son type (= catégorie de l'acte en facturation), ou null s'il n'y en a pas.
   */
  async findActiveProfile(speciality: string): Promise<{ category: string; act: string } | null> {
    await this.selectOption(this.section.locator('ng-select').first(), speciality);
    await this.section.getByRole('button', { name: /Rechercher/ }).first().click();
    await this.page.locator('app-loader .backdrop.full-screen').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await expect(this.section.locator('table tbody tr').first()).toBeVisible();
    const row = this.rows().filter({ hasText: new RegExp(looseText(speciality), 'i') }).filter({ hasText: /Actif/ }).first();
    if (await row.count() === 0) return null;
    const act = ((await row.locator('td[data-label="Acte"]').textContent()) ?? '').replace(/\s+/g, ' ').trim();
    const category = ((await row.locator('td[data-label="Type"]').textContent()) ?? '').replace(/\s+/g, ' ').trim();
    return { category, act };
  }

  /**
   * Premier acte proposé pour une spécialité (les actes proposés sont ceux paramétrés pour cette
   * spécialité dans Paramètres > Actes) : renvoie sa catégorie (groupe) et son libellé, sans
   * rien enregistrer.
   */
  async firstProposition(speciality: string): Promise<{ category: string; act: string }> {
    await this.section.locator('button[title="Nouvelle rémunération"]').click();
    await expect(this.modal).toBeVisible();
    await this.selectOption(this.modal.locator('ng-select[formcontrolname="specialities"]'), speciality);
    const acts = this.modal.locator('ng-select[formcontrolname="billableActs"]');
    await acts.locator('.ng-select-container').click();
    const panel = this.page.locator('.ng-dropdown-panel');
    const firstOption = panel.locator('.ng-option:not(.ng-optgroup):not(.ng-option-disabled)').first();
    await expect(firstOption, `Un acte doit être paramétré pour la spécialité "${speciality}"`).toBeVisible();
    const act = ((await firstOption.textContent()) ?? '').replace(/\s+/g, ' ').trim();
    const category = ((await panel.locator('.ng-optgroup').first().locator('strong').textContent()) ?? '').replace(/\s+/g, ' ').trim();
    await this.page.keyboard.press('Escape');
    await this.modal.getByRole('button', { name: /Fermer/ }).click();
    await expect(this.modal).toBeHidden();
    return { category, act };
  }

  /**
   * Profils actifs d'une spécialité (première page après filtre) : acte, type (catégorie de
   * facturation), taux (%) et montant fixe (F CFA), null quand non renseigné.
   */
  async activeProfiles(speciality: string): Promise<{ act: string; category: string; rate: number | null; amount: number | null }[]> {
    await this.selectOption(this.section.locator('ng-select').first(), speciality);
    await this.section.getByRole('button', { name: /Rechercher/ }).first().click();
    await this.page.locator('app-loader .backdrop.full-screen').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await expect(this.section.locator('table tbody tr').first()).toBeVisible();
    const rows = this.rows().filter({ hasText: /Actif/ });
    const result = [];
    for (const row of await rows.all()) {
      const cell = async (label: string) => ((await row.locator(`td[data-label="${label}"]`).textContent()) ?? '').replace(/\s+/g, ' ').trim();
      // "15 %", "5 000 F CFA" ou "-" : seuls les chiffres (et une éventuelle décimale) comptent
      const num = (text: string) => /\d/.test(text) ? Number(text.replace(/[^\d,]/g, '').replace(',', '.')) : null;
      result.push({ act: await cell('Acte'), category: await cell('Type'), rate: num(await cell('Taux')), amount: num(await cell('Montant')) });
    }
    return result;
  }

  /** Comme firstProposition, mais renvoie null (fenêtre refermée) si aucun acte n'est encore libre. */
  async tryFirstProposition(speciality: string): Promise<{ category: string; act: string } | null> {
    try {
      return await this.firstProposition(speciality);
    } catch {
      await this.page.keyboard.press('Escape').catch(() => {});
      const close = this.modal.getByRole('button', { name: /Fermer/ });
      if (await close.isVisible().catch(() => false)) await close.click();
      await expect(this.modal).toBeHidden();
      return null;
    }
  }

  async create(data: RemunerationProfileData) {
    await this.section.locator('button[title="Nouvelle rémunération"]').click();
    await expect(this.modal).toBeVisible();
    await this.selectOption(this.modal.locator('ng-select[formcontrolname="specialities"]'), data.speciality);
    await this.selectOption(this.modal.locator('ng-select[formcontrolname="billableActs"]'), data.act, false);

    const row = this.modal.locator('table tbody tr').filter({ hasText: new RegExp(looseText(data.act), 'i') }).first();
    await expect(row, "Ligne de l'acte choisi").toBeVisible();
    if (data.coverage) await row.getByPlaceholder('Ex: 15').fill(data.coverage);
    if (data.mount) await row.getByPlaceholder('Ex: 5 000').fill(data.mount);
    const dates = row.locator('input[type="date"]');
    await dates.nth(0).fill(data.startDate);
    await dates.nth(1).fill(data.endDate);

    const save = this.modal.getByRole('button', { name: /Enregistrer/ });
    await expect(save).toBeEnabled();
    await save.click();
    await expect(this.modal).toBeHidden({ timeout: 20000 });
    await expect(this.activeProfile(data.speciality, data.act).first()).toBeVisible({ timeout: 15000 });
  }

  // ======================== Gestion complète (Administration > Rémunération médecin) ========================

  /** Lignes du tableau (première page) : textes des colonnes, espaces normalisés. */
  async listRows(): Promise<RemunerationRow[]> {
    const result: RemunerationRow[] = [];
    for (const row of await this.rows().all()) {
      const cell = async (label: string) => ((await row.locator(`td[data-label="${label}"]`).textContent()) ?? '').replace(/\s+/g, ' ').trim();
      result.push({
        acte: await cell('Acte'), specialite: await cell('Spécialité'), type: await cell('Type'), taux: await cell('Taux'),
        montant: await cell('Montant'), debut: await cell('Début'), fin: await cell('Fin'), statut: await cell('Statut'),
      });
    }
    return result;
  }

  /** Ligne du tableau d'un acte (libellé complet, sans tenir compte des accents ni des espaces). */
  row(act: string): Locator {
    return this.rows().filter({ has: this.page.locator('td[data-label="Acte"]', { hasText: accentInsensitive(act) }) });
  }

  /** Lignes du tableau pour un acte. */
  async rowsOf(act: string): Promise<RemunerationRow[]> {
    const target = normalizeLabel(act);
    return (await this.listRows()).filter(r => normalizeLabel(r.acte) === target);
  }

  /** Recherche avancée : nom d'acte, spécialité, type, état (un filtre absent est vidé). */
  async search(filters: { nom?: string; specialite?: string; type?: string; etat?: 'Actif' | 'Inactif' } = {}) {
    await this.section.getByRole('button', { name: /Réinitialiser/ }).click();
    await this.waitForList();
    // Filtres dans l'ordre : Spécialité, Type, État
    const selects = this.section.locator('.form-grid ng-select');
    // Le backend cherche dans le nom seul : le préfixe de type ("Consultation ", "Visite ") est retiré
    if (filters.nom) await this.section.getByPlaceholder("Nom de l'acte...").fill(filters.nom.replace(/^(CONSULTATION|VISITE)\s+/i, ''));
    if (filters.specialite) await this.pickExact(selects.nth(0), filters.specialite);
    if (filters.type) await this.pickExact(selects.nth(1), filters.type);
    if (filters.etat) await this.pickExact(selects.nth(2), filters.etat);
    await this.section.getByRole('button', { name: /^\W*Rechercher$/ }).click();
    await this.waitForList();
  }

  private async waitForList() {
    await this.page.waitForTimeout(500);
    await this.page.locator('app-loader .backdrop.full-screen').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    await expect(this.section.locator('table tbody tr').first()).toBeVisible();
  }

  /** Option au libellé exact (accents et espaces ignorés) ; la liste peut passer sous la carte suivante. */
  private async pickExact(select: Locator, label: string) {
    await select.locator('.ng-select-container').click();
    const option = this.page.locator('.ng-dropdown-panel .ng-option:not(.ng-optgroup)').filter({ hasText: accentInsensitive(label) }).first();
    await expect(option, `Option "${label}"`).toBeVisible({ timeout: 10000 });
    await option.click({ timeout: 5000 }).catch(() => option.dispatchEvent('click'));
    if (await this.page.locator('.ng-dropdown-panel').isVisible().catch(() => false)) await select.locator('.ng-arrow-wrapper').click();
  }

  get specialitySelect(): Locator { return this.modal.locator('ng-select[formcontrolname="specialities"]'); }
  get actsSelect(): Locator { return this.modal.locator('ng-select[formcontrolname="billableActs"]'); }
  /** "Enregistrer" en création, "Modifier" en modification. */
  get saveButton(): Locator { return this.modal.locator('.modal-modern-footer button.btn-primary'); }

  async openNew() {
    // À l'ouverture, le front charge toutes les rémunérations actives pour exclure leurs actes
    const loaded = this.page.waitForResponse(r => r.url().includes('/renumerations/profiles?active=true'), { timeout: 30000 });
    await this.section.locator('button[title="Nouvelle rémunération"]').click();
    await expect(this.modal).toBeVisible();
    await loaded;
  }

  async openEdit(act: string) {
    await this.row(act).first().locator('button.action-edit').click();
    await expect(this.modal).toBeVisible();
  }

  async close() {
    await this.modal.getByRole('button', { name: /Fermer|Annuler/ }).first().click();
    await expect(this.modal).toBeHidden();
  }

  /** Choisit la spécialité de la fenêtre et renvoie les actes proposés pour elle. */
  async chooseSpeciality(speciality: string): Promise<string[]> {
    await this.pickExact(this.specialitySelect, speciality);
    await this.actsSelect.locator('.ng-select-container').click();
    const names = (await this.page.locator('.ng-dropdown-panel .ng-option:not(.ng-optgroup):not(.ng-option-disabled)').allTextContents())
      .map(s => s.replace(/\s+/g, ' ').trim()).filter(n => n && !/No items found/i.test(n));
    await this.actsSelect.locator('.ng-arrow-wrapper').click();
    return names;
  }

  async chooseAct(act: string) {
    await this.pickExact(this.actsSelect, act);
  }

  /** Ligne de saisie d'un acte choisi dans la fenêtre (taux, montant, dates). */
  actLine(act: string): Locator {
    return this.modal.locator('table tbody tr').filter({ has: this.page.locator('td[data-label="Acte"]', { hasText: accentInsensitive(act) }) });
  }

  rateInput(act: string): Locator { return this.actLine(act).getByPlaceholder('Ex: 15'); }
  amountInput(act: string): Locator { return this.actLine(act).getByPlaceholder('Ex: 5 000'); }
  startInput(act: string): Locator { return this.actLine(act).locator('input[type="date"]').nth(0); }
  endInput(act: string): Locator { return this.actLine(act).locator('input[type="date"]').nth(1); }

  /** Enregistre et renvoie le message de l'application ('' si aucun). */
  async save(): Promise<string> {
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    const toast = this.page.locator('.toast-success, .toast-error').first();
    return (await toast.waitFor({ state: 'visible', timeout: 15000 }).then(() => toast.innerText(), () => '')).replace(/\s+/g, ' ').trim();
  }

  /** Active ou désactive la rémunération de l'acte (confirmation comprise) et renvoie le message. */
  async toggle(act: string): Promise<string> {
    await this.row(act).first().locator('button.action-toggle').click();
    await expect(this.page.getByText(/Êtes-vous sûr de vouloir (désactiver|activer) cette rémunération/)).toBeVisible();
    await this.page.getByRole('button', { name: 'Confirmer' }).click();
    const message = this.page.getByText(/Rémunération (désactivée|activée) avec succès|n'est plus valable|mise à jour de l'état a échoué/).first();
    await expect(message).toBeVisible({ timeout: 15000 });
    return ((await message.textContent()) ?? '').replace(/\s+/g, ' ').trim();
  }
}

export type RemunerationRow = { acte: string; specialite: string; type: string; taux: string; montant: string; debut: string; fin: string; statut: string };

/** Expression régulière tolérant les espaces multiples des libellés de l'application. */
function looseText(value: string): string {
  return escapeRegExp(value.replace(/\s+/g, ' ').trim()).replace(/ /g, '\\s+');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
