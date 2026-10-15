import { type Page, type Locator, expect } from '@playwright/test';
import { MyConfigurationPage } from './configuration.page';

export type GarantRow = { nom: string; type: string; contact: string; telephone: string; email: string; statut: string };
export type GarantContact = { contact?: string; phone?: string; email?: string };

/**
 * Administration > Paramètres > "Garants" : assureurs et IPM de la structure (choisis dans la liste
 * générale des assureurs), avec la personne à contacter. Les garants actifs sont ceux proposés
 * dans la prise en charge d'un patient ; un garant utilisé par une prise en charge ne peut pas
 * être désactivé.
 */
export class GarantPage {
  private readonly config: MyConfigurationPage;
  readonly section: Locator;
  /** Fenêtre "Nouveau garant" / modification. */
  readonly form: Locator;

  constructor(private readonly page: Page) {
    this.config = new MyConfigurationPage(page);
    this.section = this.config.configCard('Garants');
    // Carte entière de la fenêtre : les boutons Fermer / Enregistrer sont dans son pied, hors du <form>
    this.form = page.locator('.modal-modern-card').filter({ has: page.locator('ng-select[formcontrolname="code"]') }).last();
  }

  async open() {
    await this.config.openSection('Garants');
    await expect(this.section.getByRole('columnheader', { name: 'Nom' })).toBeVisible();
  }

  /** Lignes affichées, lues colonne par colonne. */
  async rows(): Promise<GarantRow[]> {
    const result: GarantRow[] = [];
    for (const row of await this.section.locator('table tbody tr').filter({ hasNot: this.page.getByText('Aucun garant') }).all()) {
      const cell = async (label: string) => ((await row.locator(`td[data-label="${label}"]`).textContent()) ?? '').replace(/\s+/g, ' ').trim();
      result.push({
        nom: await cell('Nom'), type: await cell('Type'), contact: await cell('Contact'),
        telephone: await cell('Téléphone'), email: await cell('Email'), statut: await cell('Statut'),
      });
    }
    return result;
  }

  /** Ligne du garant dont le nom (ex. "AMSA ASSURANCE (ASSURANCE)") est donné, sans tenir compte de la casse. */
  row(nom: string): Locator {
    return this.section.locator('table tbody tr').filter({
      has: this.page.locator('td[data-label="Nom"]', { hasText: new RegExp(`^\\s*${escapeRegExp(nom)}\\s*$`, 'i') }),
    });
  }

  private async pick(select: Locator, label: string) {
    await select.locator('.ng-select-container').click();
    const option = this.page.locator('.ng-dropdown-panel .ng-option').filter({ hasText: new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`, 'i') }).first();
    await expect(option, `Option "${label}"`).toBeVisible({ timeout: 10000 });
    await option.click();
  }

  /** Filtres de la liste (assureur, type, état) puis recherche ; un filtre absent est vidé. */
  async search(filters: { assureur?: string; type?: 'IPM' | 'ASSURANCE'; etat?: 'Actif' | 'Inactif' } = {}) {
    await this.section.getByRole('button', { name: /Réinitialiser/ }).click();
    // Filtres dans l'ordre : Assurance / IPM, Type, État
    const selects = this.section.locator('.section-filtres ng-select');
    if (filters.assureur) await this.pick(selects.nth(0), filters.assureur);
    if (filters.type) await this.pick(selects.nth(1), filters.type);
    if (filters.etat) await this.pick(selects.nth(2), filters.etat);
    await this.section.getByRole('button', { name: /^\W*Rechercher$/ }).click();
    await expect(this.section.getByRole('button', { name: /^\W*Rechercher$/ })).toBeEnabled({ timeout: 15000 });
    await this.page.waitForTimeout(1000);
  }

  /** Assureurs proposés à l'ajout d'un garant (liste générale), fenêtre refermée ensuite. */
  async proposedInsurers(): Promise<string[]> {
    await this.openNew();
    await this.form.locator('ng-select[formcontrolname="code"] .ng-select-container').click();
    const options = (await this.page.locator('.ng-dropdown-panel .ng-option:not(.ng-option-disabled)').allTextContents()).map(s => s.replace(/\s+/g, ' ').trim());
    await this.form.locator('ng-select[formcontrolname="code"] .ng-arrow-wrapper').click();
    await this.close();
    return options;
  }

  async openNew() {
    await this.section.getByTitle('Nouveau garant').click();
    await expect(this.form).toBeVisible();
  }

  async openEdit(nom: string) {
    await this.row(nom).first().getByTitle('Modifier').click();
    await expect(this.form).toBeVisible();
  }

  async close() {
    await this.form.getByRole('button', { name: /Fermer|Annuler/ }).first().click();
    await expect(this.form).toBeHidden();
  }

  /** Remplit la fenêtre ouverte : assureur (à l'ajout) et personne à contacter. */
  async fill(insurer: string | undefined, contact: GarantContact) {
    if (insurer) await this.pick(this.form.locator('ng-select[formcontrolname="code"]'), insurer);
    if (contact.contact !== undefined) await this.form.locator('[formcontrolname="personCoverFullname"]').fill(contact.contact);
    if (contact.phone !== undefined) {
      const phone = this.form.locator('app-intl-tel-input input[type="tel"], app-intl-tel-input input').first();
      await phone.fill(contact.phone);
      await phone.blur();
    }
    if (contact.email !== undefined) await this.form.locator('[formcontrolname="personCoverEmail"]').fill(contact.email);
  }

  /** Enregistre la fenêtre ouverte ; renvoie le texte du message de l'application (succès ou erreur). */
  async save(): Promise<string> {
    await this.form.getByRole('button', { name: /Enregistrer|Modifier|Valider/ }).last().click();
    const toast = this.page.locator('.toast-success, .toast-error').first();
    const message = await toast.waitFor({ state: 'visible', timeout: 10000 }).then(() => toast.innerText(), () => '');
    return message.replace(/\s+/g, ' ').trim();
  }

  /** Change l'état (Désactiver / Activer) d'un garant et renvoie le message affiché. */
  async toggle(nom: string): Promise<string> {
    const row = this.row(nom).first();
    await row.locator('button.action-toggle').click();
    await expect(this.page.getByText(/voulez-vous changer l.état de cet(te)? assurance/i)).toBeVisible();
    await this.page.getByRole('button', { name: 'Confirmer' }).click();
    const message = this.page.getByText(/mise à jour de l.état de cet(te)? assurance a\s+r[ée]ussi|encours d.utilisation|a échoué/i).first();
    await expect(message).toBeVisible({ timeout: 15000 });
    return ((await message.textContent()) ?? '').replace(/\s+/g, ' ').trim();
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
