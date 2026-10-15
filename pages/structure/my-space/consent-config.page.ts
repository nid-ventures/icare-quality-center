import { type Page, type Locator, expect } from '@playwright/test';
import { MyConfigurationPage } from './configuration.page';

export type ConsentRow = { type: string; profil: string; mode: string; date: string };

/**
 * Administration > Paramètres > "Configuration de consentement" : une configuration par profil
 * (PATIENT, CAREGIVER, MEDICAL_SECRETAIRE, HI_ADMINISTRATOR). Le profil impose le type et le mode :
 * PATIENT → ELECTRONIC / EMAIL, personnel → MANUAL / AUCUN. "Modifier" ne change que le texte
 * (même configuration) ; "Retirer" la supprime en base. Enregistrer et modifier rechargent la page.
 * Le texte se saisit dans un CKEditor 4 : il est lu et rempli par l'API de l'éditeur.
 */
export class ConsentConfigPage {
  private readonly config: MyConfigurationPage;
  readonly section: Locator;
  readonly form: Locator;
  /** Fenêtre "Configuration du consentement" (bouton Modifier d'une ligne). */
  readonly editModal: Locator;

  constructor(private readonly page: Page) {
    this.config = new MyConfigurationPage(page);
    this.section = this.config.configCard('Configuration de consentement');
    this.form = this.section.locator('form.section-identite');
    this.editModal = page.locator('.modal-modern-card').filter({ hasText: 'Configuration du consentement' });
  }

  async open() {
    await this.config.openSection('Configuration de consentement');
    await expect(this.section.getByRole('columnheader', { name: 'Mode de demande' })).toBeVisible();
    await this.page.locator('app-loader .backdrop.full-screen').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  }

  get profileSelect(): Locator { return this.form.locator('ng-select#type'); }
  get typeSelect(): Locator { return this.form.locator('ng-select[formcontrolname="consent_ident"]'); }
  get modeSelect(): Locator { return this.form.locator('ng-select#sendMode'); }
  get saveButton(): Locator { return this.form.getByRole('button', { name: /Enregistrer/ }); }

  async rows(): Promise<ConsentRow[]> {
    const result: ConsentRow[] = [];
    for (const row of await this.section.locator('table tbody tr').filter({ hasNot: this.page.getByText('Aucun enregistrement') }).all()) {
      const cells = (await row.locator('td').allTextContents()).map(s => s.replace(/\s+/g, ' ').trim());
      result.push({ type: cells[0], profil: cells[1], mode: cells[2], date: cells[3] });
    }
    return result;
  }

  row(profil: string): Locator {
    return this.section.locator('table tbody tr').filter({ has: this.page.locator('td').nth(1).filter({ hasText: new RegExp(`^\\s*${profil}\\s*$`) }) });
  }

  /** Profils proposés dans "Nouvelle configuration". */
  async proposedProfiles(): Promise<string[]> {
    await this.profileSelect.locator('.ng-select-container').click();
    const names = (await this.page.locator('.ng-dropdown-panel .ng-option').allTextContents())
      .map(s => s.replace(/\s+/g, ' ').trim()).filter(n => n && !/No items found/i.test(n));
    await this.page.keyboard.press('Escape');
    return names;
  }

  async chooseProfile(profil: string) {
    await this.profileSelect.locator('.ng-select-container').click();
    await this.page.locator('.ng-dropdown-panel .ng-option').filter({ hasText: new RegExp(`^\\s*${profil}\\s*$`) }).first().click();
  }

  /** Valeur affichée d'une liste déroulante. */
  async shown(select: Locator): Promise<string> {
    // L'icône de retrait "×" fait partie de la valeur affichée
    return ((await select.locator('.ng-value').first().textContent().catch(() => '')) ?? '').replace(/×/g, '').replace(/\s+/g, ' ').trim();
  }

  private readEditor(host: Locator): Promise<string> {
    return host.evaluate(el => {
      const editors = (window as any).CKEDITOR?.instances ?? {};
      for (const name of Object.keys(editors)) {
        const editor = editors[name];
        if (el.contains(editor.container?.$)) return editor.getData() as string;
      }
      throw new Error('Éditeur introuvable');
    });
  }

  /** Texte brut de l'éditeur situé dans `scope` (sans balises ni entités HTML). */
  async editorText(scope: Locator): Promise<string> {
    const host = scope.locator('ckeditor').first();
    await expect(host.locator('.cke').first(), 'Éditeur chargé').toBeVisible({ timeout: 30000 });
    return host.evaluate(el => {
      const editors = (window as any).CKEDITOR?.instances ?? {};
      for (const name of Object.keys(editors)) {
        const editor = editors[name];
        if (el.contains(editor.container?.$)) return (editor.editable().getText() as string).replace(/\s+/g, ' ').trim();
      }
      throw new Error('Éditeur introuvable');
    });
  }

  /** Texte de l'éditeur situé dans `scope` ; le remplace d'abord si `html` est fourni. */
  async editorContent(scope: Locator, html?: string): Promise<string> {
    const host = scope.locator('ckeditor').first();
    await expect(host.locator('.cke').first(), 'Éditeur chargé').toBeVisible({ timeout: 30000 });
    if (html === undefined) {
      // Lecture : l'éditeur peut être affiché avant de recevoir le texte de la configuration
      let text = '';
      await expect(async () => {
        text = await this.readEditor(host);
        expect(text, 'Texte chargé dans l\'éditeur').not.toBe('');
      }).toPass({ timeout: 15000 }).catch(() => {});
      return text;
    }
    return host.evaluate((el, value) => {
      const editors = (window as any).CKEDITOR?.instances ?? {};
      for (const name of Object.keys(editors)) {
        const editor = editors[name];
        if (el.contains(editor.container?.$)) {
          if (value !== undefined) { editor.setData(value); editor.fire('change'); }
          return editor.getData() as string;
        }
      }
      throw new Error('Éditeur introuvable');
    }, html);
  }

  /** Enregistre la nouvelle configuration (confirmation comprise) ; la page se recharge. */
  async save() {
    await this.saveButton.click();
    await expect(this.page.getByText(/voulez-vous enregistrer cette configuration/i)).toBeVisible();
    const created = this.page.waitForResponse(r => /\/consents$/.test(r.url().split('?')[0]) && r.request().method() === 'POST', { timeout: 30000 });
    await this.page.getByRole('button', { name: 'Confirmer' }).click();
    const response = await created;
    // La page se recharge aussitôt : le corps de la réponse n'est plus lisible, le résultat est vérifié en rouvrant
    expect(response.ok(), `Configuration enregistrée (HTTP ${response.status()})`).toBe(true);
    await this.page.waitForLoadState('load');
  }

  /** Retire la configuration du profil (confirmation comprise) et renvoie le message. */
  async remove(profil: string): Promise<string> {
    await this.row(profil).first().locator('button.action-delete').click();
    await expect(this.page.getByText(/voulez-vous retirer cette configuration/i)).toBeVisible();
    await this.page.getByRole('button', { name: 'Confirmer' }).click();
    const message = this.page.getByText(/Le retrait\s+a (reussi|échoué)/).first();
    await expect(message).toBeVisible({ timeout: 15000 });
    return ((await message.textContent()) ?? '').replace(/\s+/g, ' ').trim();
  }

  async openEdit(profil: string) {
    await this.row(profil).first().locator('button.action-edit').click();
    await expect(this.editModal).toBeVisible();
  }

  get editSaveButton(): Locator { return this.editModal.locator('.modal-modern-footer button.btn-primary'); }

  /** Enregistre la modification du texte ; la page se recharge. */
  async saveEdit() {
    const updated = this.page.waitForResponse(r => /\/consents$/.test(r.url().split('?')[0]) && r.request().method() === 'PUT', { timeout: 30000 });
    await this.editSaveButton.click();
    const response = await updated;
    expect(response.ok(), `Texte modifié (HTTP ${response.status()})`).toBe(true);
    await this.page.waitForLoadState('load');
  }

  async closeEdit() {
    await this.editModal.getByRole('button', { name: /Fermer/ }).click();
    await expect(this.editModal).toBeHidden();
  }
}
