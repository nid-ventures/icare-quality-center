import { type Page, type Locator, expect } from '@playwright/test';
import { MyConfigurationPage } from './configuration.page';
import { LoginPage } from '../patient/login.page';
import { PortalPage } from '../portal/portal.page';
import { adminUser } from '../../../test-data/structure-users';

export type StructureDetails = { name: string; primaryEmail: string; primaryStreet: string; postalCode: string };
export type InvoiceSettings = { policy: string; color: string; header: string; footer: string };

/**
 * Administration > Paramètres : "Détails de la structure" (app-hi-details) et "Configuration de
 * facture" (app-invoice). Les formulaires sont en lecture seule jusqu'à "Activer la modification" ;
 * enregistrer demande une confirmation, met à jour la base puis DÉCONNECTE l'utilisateur
 * (authService.logout : stockage du navigateur vidé, retour à /auth/login). La session partagée
 * des autres tests n'est pas touchée ; ici on se reconnecte après chaque enregistrement.
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
    await this.details.locator('button.edit-btn').click();
    await expect(this.detailsSave).toBeVisible();
  }

  async enableInvoice() {
    await this.invoice.getByRole('button', { name: /Activer la modification/ }).click();
    await expect(this.invoiceSave).toBeVisible();
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
   * Enregistre (bouton du formulaire), confirme l'avertissement de déconnexion, attend le retour à
   * l'écran de connexion puis se reconnecte et revient dans Administration.
   */
  async saveAndRelogin(save: Locator) {
    await save.click();
    const warning = this.page.locator('.warning-modal-card');
    // Le texte passe par titleCaseWord : casse non garantie
    await expect(warning.locator('.warning-modal-body')).toHaveText(/vous serez déconnecté/i);
    await warning.getByRole('button', { name: /Confirmer/ }).click();
    await this.page.waitForURL('**/auth/login', { timeout: 30000 });
    const login = new LoginPage(this.page);
    await login.login(adminUser.username, adminUser.password);
    await login.selectStructure(adminUser.hi);
    const portal = new PortalPage(this.page);
    await portal.expectLoaded();
    await portal.enterModule('Administration');
    await this.page.waitForURL('**/my-space/configuration');
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
