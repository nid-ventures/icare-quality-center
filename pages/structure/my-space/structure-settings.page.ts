import { type Page, type Locator, expect } from '@playwright/test';
import { MyConfigurationPage } from './configuration.page';

export type StructureDetails = { name: string; primaryEmail: string; primaryStreet: string; postalCode: string };
export type InvoiceSettings = { policy: string; color: string; header: string; footer: string };

/**
 * Administration > Paramètres : "Détails de la structure" (app-hi-details) et "Configuration de
 * facture" (app-invoice). Les formulaires sont en lecture seule jusqu'à "Activer la modification" ;
 * enregistrer demande une confirmation, met à jour la base et le cache du navigateur : l'utilisateur
 * reste connecté et le formulaire repasse en lecture seule.
 */
export class StructureSettingsPage {
  private readonly config: MyConfigurationPage;
  readonly details: Locator;
  readonly invoice: Locator;

  constructor(private readonly page: Page) {
    this.config = new MyConfigurationPage(page);
    this.details = page.locator('app-hi-details');
    this.invoice = page.locator('app-invoice');
  }

  async openDetails() {
    await this.config.openSection('Détails de la structure');
    await expect(this.details.locator('input[formcontrolname="name"]')).toBeVisible();
  }

  async openInvoice() {
    await this.config.openSection('Configuration de facture');
    await expect(this.invoice.locator('input[formcontrolname="header"]')).toBeVisible();
  }

  detailsInput(name: keyof StructureDetails | 'hiCode'): Locator { return this.details.locator(`input[formcontrolname="${name}"]`); }
  invoiceInput(name: keyof InvoiceSettings): Locator { return this.invoice.locator(`input[formcontrolname="${name}"]`); }
  get detailsSave(): Locator { return this.details.locator('.form-actions button.btn-save-modern'); }
  get invoiceSave(): Locator { return this.invoice.locator('.form-actions button.btn-save-modern'); }
  get logoInput(): Locator { return this.details.locator('input[type="file"]'); }

  async enableDetails() {
    await this.enable(this.details.locator('button.edit-btn'), this.detailsSave);
  }

  async enableInvoice() {
    await this.enable(this.invoice.getByRole('button', { name: /Activer la modification/ }), this.invoiceSave);
  }

  /**
   * "Activer la modification" puis attente du bouton Enregistrer. Un clic arrivé avant la fin du
   * chargement de la section reste sans effet (vu en mode visuel) : un second clic est alors fait.
   */
  private async enable(button: Locator, save: Locator) {
    const wait = Number(process.env.SLOWMO) > 0 ? 20000 : 10000;
    await this.page.locator('app-loader .backdrop.full-screen').waitFor({ state: 'hidden', timeout: wait }).catch(() => {});
    await button.click();
    if (await save.waitFor({ state: 'visible', timeout: wait }).then(() => false, () => true)) {
      await button.click();
    }
    await expect(save, 'Formulaire en modification').toBeVisible({ timeout: wait });
  }

  /**
   * Formulaire en modification : remplit les champs obligatoires restés vides dans la fiche de la
   * structure (e-mail, pays, téléphone), sans enregistrer. Une fiche incomplète (vu sur un serveur
   * partagé) laisse sinon "Enregistrer" grisé, ou empêche la confirmation faute de téléphone.
   */
  async completeRequiredDetails() {
    const email = this.detailsInput('primaryEmail');
    if (!(await email.inputValue()).trim()) await email.fill('qa-structure@icaresenegal.com');
    const country = this.details.locator('ng-select[formcontrolname="primaryCountry"]');
    if (await country.locator('.ng-value').count() === 0) {
      await country.locator('.ng-select-container').click();
      await this.page.locator('.ng-dropdown-panel .ng-option').first().click();
    }
    const phone = this.details.getByRole('textbox', { name: 'Entrez le numéro' });
    if (await phone.isVisible().catch(() => false) && !(await phone.inputValue()).trim()) await phone.fill('771234567');
  }

  async cancelDetails() { await this.details.locator('.form-actions').getByRole('button', { name: 'Annuler' }).click(); }
  async cancelInvoice() { await this.invoice.locator('.form-actions').getByRole('button', { name: /Annuler/ }).click(); }

  async readDetails(): Promise<StructureDetails> {
    return {
      name: await this.detailsInput('name').inputValue(),
      primaryEmail: await this.detailsInput('primaryEmail').inputValue(),
      primaryStreet: await this.detailsInput('primaryStreet').inputValue(),
      postalCode: await this.detailsInput('postalCode').inputValue(),
    };
  }

  async readInvoice(): Promise<InvoiceSettings> {
    return {
      policy: await this.invoiceInput('policy').inputValue(),
      color: await this.invoiceInput('color').inputValue(),
      header: await this.invoiceInput('header').inputValue(),
      footer: await this.invoiceInput('footer').inputValue(),
    };
  }

  async fillDetails(values: Partial<StructureDetails>) {
    for (const [name, value] of Object.entries(values)) await this.detailsInput(name as keyof StructureDetails).fill(value ?? '');
  }

  async fillInvoice(values: Partial<InvoiceSettings>) {
    for (const [name, value] of Object.entries(values)) await this.invoiceInput(name as keyof InvoiceSettings).fill(value ?? '');
  }

  /**
   * Enregistre (bouton du formulaire) et confirme : message de succès, l'utilisateur reste connecté
   * dans Administration (plus de déconnexion forcée).
   */
  async save(save: Locator) {
    await save.click();
    const warning = this.page.locator('.warning-modal-card');
    await expect(warning.locator('.warning-modal-body')).toHaveText(/Voulez-vous modifier les détails \?/i);
    await expect(warning.locator('.warning-modal-body'), "Plus d'annonce de déconnexion").not.toHaveText(/déconnect/i);
    await warning.getByRole('button', { name: /Confirmer/ }).click();
    await expect(this.page.getByText(/Les détails ont été bien modifiés? avec succès/i).first()).toBeVisible({ timeout: 30000 });
    await expect(this.page, 'Toujours connecté').toHaveURL(/\/my-space\/configuration/);
  }

  /** Image PNG générée dans le navigateur (largeur × hauteur), en octets. */
  async png(width: number, height: number): Promise<Buffer> {
    const base64 = await this.page.evaluate(([w, h]) => {
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#2a7'; ctx.fillRect(0, 0, w, h);
      return canvas.toDataURL('image/png').split(',')[1];
    }, [width, height]);
    return Buffer.from(base64, 'base64');
  }
}
