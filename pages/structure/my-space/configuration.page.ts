// pages/structure/my-space/configuration.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Espace paramétrage (`/my-space/configuration`, `MyConfigurationComponent`) : accordéon de 8
 * cartes repliables. Seules 2 cartes sont manipulées ici (hors périmètre pour les 6 autres) :
 * "Détails de la structure" (`app-hi-details`) et "Configuration de facture" (`app-invoice`).
 *
 * Chaque carte a un en-tête cliquable (`.config-card-header`) qui bascule la classe `expanded`
 * sur `.config-card-body` (transition CSS de 0.4s sur max-height : `expect(...).toBeVisible()`
 * attend nativement la fin de la transition grâce au polling de Playwright).
 *
 * IMPORTANT — soumission des formulaires : confirmer la modale d'avertissement qui suit un clic
 * sur "Enregistrer" déclenche une VRAIE mise à jour en base ET une déconnexion forcée
 * (`authService.logout()` dans hi-details/invoice.component.ts en cas de succès). Comme pour la
 * modale d'export ("ne pas cliquer Télécharger"), ces tests vérifient que la modale de
 * confirmation apparaît avec le bon message, puis l'annulent via "Fermer" — jamais "Confirmer".
 */
export class MyConfigurationPage {
  private readonly page: Page;

  private readonly heading: Locator;

  private readonly detailsCard: Locator;
  private readonly detailsHeader: Locator;
  private readonly detailsBody: Locator;

  private readonly invoiceCard: Locator;
  private readonly invoiceHeader: Locator;
  private readonly invoiceBody: Locator;

  // app-hi-details
  private readonly hiDetailsRoot: Locator;
  private readonly hiDetailsEditButton: Locator;
  private readonly hiDetailsNameInput: Locator;
  private readonly hiDetailsEmailInput: Locator;
  private readonly hiDetailsCancelButton: Locator;
  private readonly hiDetailsSaveButton: Locator;

  // app-invoice
  private readonly invoiceRoot: Locator;
  private readonly invoiceEditButton: Locator;
  private readonly invoiceHeaderInput: Locator;
  private readonly invoiceFooterInput: Locator;
  private readonly invoiceCancelButton: Locator;
  private readonly invoiceSaveButton: Locator;

  // Modale d'avertissement partagée (ModalWarningComponent), montée dans le composant actif
  private readonly warningModalTitle: Locator;
  private readonly warningModalBody: Locator;
  private readonly warningModalCloseButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole('heading', { name: 'Espace paramétrage' });

    this.detailsCard = page.locator('.config-card').filter({ hasText: 'Détails de la structure' });
    this.detailsHeader = this.detailsCard.locator('.config-card-header');
    this.detailsBody = this.detailsCard.locator('.config-card-body');

    this.invoiceCard = page.locator('.config-card').filter({ hasText: 'Configuration de facture' });
    this.invoiceHeader = this.invoiceCard.locator('.config-card-header');
    this.invoiceBody = this.invoiceCard.locator('.config-card-body');

    this.hiDetailsRoot = page.locator('app-hi-details');
    this.hiDetailsEditButton = this.hiDetailsRoot.getByRole('button', { name: /Modifier/ });
    this.hiDetailsNameInput = this.hiDetailsRoot.locator('input[formcontrolname="name"]');
    this.hiDetailsEmailInput = this.hiDetailsRoot.locator('input[formcontrolname="primaryEmail"]');
    this.hiDetailsCancelButton = this.hiDetailsRoot.getByRole('button', { name: /Annuler/ });
    this.hiDetailsSaveButton = this.hiDetailsRoot.getByRole('button', { name: /Enregistrer/ });

    this.invoiceRoot = page.locator('app-invoice');
    this.invoiceEditButton = this.invoiceRoot.getByRole('button', { name: /Activer la modification/ });
    this.invoiceHeaderInput = this.invoiceRoot.locator('input[formcontrolname="header"]');
    this.invoiceFooterInput = this.invoiceRoot.locator('input[formcontrolname="footer"]');
    this.invoiceCancelButton = this.invoiceRoot.getByRole('button', { name: /Annuler/ });
    this.invoiceSaveButton = this.invoiceRoot.getByRole('button', { name: /Enregistrer/ });

    this.warningModalTitle = page.getByText('AVERTISSEMENT');
    this.warningModalBody = page.locator('.warning-modal-body');
    this.warningModalCloseButton = page.getByRole('button', { name: /Fermer/ });
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.detailsHeader).toBeVisible();
    await expect(this.invoiceHeader).toBeVisible();
  }

  // ===== Cartes génériques de l'espace paramétrage (accordéon .config-card) =====

  /** Carte de l'espace paramétrage par son titre (ex: "Modules de la structure"). */
  configCard(title: string): Locator {
    return this.page.locator('.config-card').filter({
      has: this.page.locator('.config-card-header h3', { hasText: new RegExp(`^\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }),
    });
  }

  async expectSectionsVisible(titles: string[]) {
    for (const title of titles) {
      await expect(this.configCard(title).locator('.config-card-header')).toBeVisible();
    }
  }

  async openSection(title: string) {
    const card = this.configCard(title);
    const body = card.locator('.config-card-body');
    if (!((await body.getAttribute('class')) ?? '').includes('expanded')) {
      await card.locator('.config-card-header').click();
    }
    await expect(body).toHaveClass(/expanded/);
  }

  // ===== Modules de la structure (activation stockée dans le navigateur, par structure) =====

  private moduleRow(name: string): Locator {
    return this.configCard('Modules de la structure').locator('ul.ms-list > li').filter({
      has: this.page.locator('strong', { hasText: new RegExp(`^${name}$`) }),
    });
  }

  moduleSwitch(name: string): Locator {
    return this.moduleRow(name).locator('input[type="checkbox"]');
  }

  async expectModuleAlwaysActive(name: string) {
    await expect(this.moduleRow(name).getByText('Toujours actif')).toBeVisible();
  }

  async setModuleEnabled(name: string, enabled: boolean) {
    const input = this.moduleSwitch(name);
    if ((await input.isChecked()) !== enabled) {
      // La case est masquée derrière un curseur stylé (label.ms-switch) : on clique sur le label.
      await this.moduleRow(name).locator('label.ms-switch').click();
    }
    await expect(input).toBeChecked({ checked: enabled });
  }

  // ===== Accordéon =====

  async isDetailsSectionOpen(): Promise<boolean> {
    return (await this.detailsBody.getAttribute('class'))?.includes('expanded') ?? false;
  }

  async openDetailsSection() {
    if (!(await this.isDetailsSectionOpen())) {
      await this.detailsHeader.click();
    }
    await expect(this.detailsBody).toHaveClass(/expanded/);
    await expect(this.hiDetailsRoot.getByRole('heading', { name: 'Informations de la structure' })).toBeVisible();
  }

  async closeDetailsSection() {
    if (await this.isDetailsSectionOpen()) {
      await this.detailsHeader.click();
    }
    await expect(this.detailsBody).not.toHaveClass(/expanded/);
  }

  async isInvoiceSectionOpen(): Promise<boolean> {
    return (await this.invoiceBody.getAttribute('class'))?.includes('expanded') ?? false;
  }

  async openInvoiceSection() {
    if (!(await this.isInvoiceSectionOpen())) {
      await this.invoiceHeader.click();
    }
    await expect(this.invoiceBody).toHaveClass(/expanded/);
    await expect(this.invoiceRoot.getByRole('heading', { name: 'Configuration de la facture' })).toBeVisible();
  }

  async closeInvoiceSection() {
    if (await this.isInvoiceSectionOpen()) {
      await this.invoiceHeader.click();
    }
    await expect(this.invoiceBody).not.toHaveClass(/expanded/);
  }

  // ===== app-hi-details =====

  async enableHiDetailsForm() {
    await this.hiDetailsEditButton.click();
    await expect(this.hiDetailsNameInput).toBeEditable();
  }

  async getHiDetailsName(): Promise<string> {
    return this.hiDetailsNameInput.inputValue();
  }

  async fillHiDetailsName(value: string) {
    await this.hiDetailsNameInput.fill(value);
  }

  /**
   * Sur cette structure de test, "primaryEmail" est vide en base : le champ est requis et rend
   * le formulaire invalide (bouton "Enregistrer" désactivé) même sans y toucher. On le renseigne
   * uniquement s'il est vide, pour ne pas écraser une vraie valeur existante.
   */
  async ensureHiDetailsEmailFilled(value: string) {
    if ((await this.hiDetailsEmailInput.inputValue()) === '') {
      await this.hiDetailsEmailInput.fill(value);
    }
  }

  /** Clique "Enregistrer" et vérifie l'apparition de la modale de confirmation (ne confirme jamais). */
  async saveHiDetailsAndExpectConfirmation() {
    await this.hiDetailsSaveButton.click();
    await expect(this.warningModalTitle).toBeVisible();
    await expect(this.warningModalBody).toContainText(/modifier les détails/i);
  }

  /** Annule la modale de confirmation via "Fermer" (jamais "Confirmer" : voir avertissement de classe). */
  async dismissWarningModal() {
    await this.warningModalCloseButton.click();
    await expect(this.warningModalTitle).toBeHidden();
  }

  /** Annule l'édition du formulaire (bouton "Annuler" du formulaire, recharge les données d'origine). */
  async cancelHiDetailsEdit() {
    await this.hiDetailsCancelButton.click();
    await expect(this.hiDetailsNameInput).toBeDisabled();
  }

  // ===== app-invoice =====

  async enableInvoiceForm() {
    await this.invoiceEditButton.click();
    await expect(this.invoiceHeaderInput).toBeEditable();
  }

  async getInvoiceFooter(): Promise<string> {
    return this.invoiceFooterInput.inputValue();
  }

  async fillInvoiceHeaderAndFooter(header: string, footer: string) {
    await this.invoiceHeaderInput.fill(header);
    await this.invoiceFooterInput.fill(footer);
  }

  /** Clique "Enregistrer" et vérifie l'apparition de la modale de confirmation (ne confirme jamais). */
  async saveInvoiceAndExpectConfirmation() {
    await this.invoiceSaveButton.click();
    await expect(this.warningModalTitle).toBeVisible();
    await expect(this.warningModalBody).toContainText(/modifier les détails/i);
  }

  async cancelInvoiceEdit() {
    await this.invoiceCancelButton.click();
    await expect(this.invoiceHeaderInput).toBeDisabled();
  }
}
