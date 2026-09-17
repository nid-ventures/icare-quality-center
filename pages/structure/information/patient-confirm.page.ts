// pages/structure/information/patient-confirm.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page object pour le module public "information" (aucune authentification requise,
 * cf. src/app/app.routes.ts : { path: 'information', ... } n'a PAS de canActivate).
 *
 * Couvre :
 *  - /information/consentement_patient/:id       (PatientConfirmComponent)
 *  - /information/consentement_approved          (PatientApprovedComponent)
 *  - /information/consentement_refused           (PatientRefusedComponent)
 *  - /information/consentement_expired           (PatientExpiredComponent)
 *  - /information/consentement_already           (PatientAlreadyResponseComponent)
 *  - /information                                (InfosComponent, route index)
 *
 * Ne dépend volontairement pas de LoginPage : ces écrans sont accessibles sans connexion.
 */
export class PatientConfirmPage {
  private readonly baseUrl = process.env.BASE_URL + '/information';

  // Écran de confirmation du consentement (patient-confirm.component.html)
  private readonly pageTitle: Locator;
  private readonly acceptRadio: Locator;
  private readonly refuseRadio: Locator;
  private readonly confirmButton: Locator;

  // Écrans statiques atteints après soumission (ou via navigation directe)
  private readonly approvedText: Locator;
  private readonly refusedHeading: Locator;
  private readonly expiredHeading: Locator;
  private readonly alreadyHeading: Locator;
  private readonly infosHeading: Locator;

  constructor(private readonly page: Page) {
    this.pageTitle = page.getByRole('heading', { name: 'Politique de confidentialité', exact: true });
    this.acceptRadio = page.locator('#approved');
    this.refuseRadio = page.locator('#refused');
    this.confirmButton = page.getByRole('button', { name: 'Confirmer' });

    this.approvedText = page.getByText(/Nous avons bien reçu votre validation/);
    this.refusedHeading = page.getByRole('heading', { name: 'Consentement non accordé !' });
    // Le HTML source contient un double espace ("non pris en  compte") : on tolère \s+.
    this.expiredHeading = page.getByRole('heading', { name: /Consentement non pris en\s+compte\s*!/ });
    this.alreadyHeading = page.getByRole('heading', { name: 'Politique de confidentialité validée !' });
    this.infosHeading = page.getByRole('heading', { name: /Nous vous remercions pour la confiance/ });
  }

  /**
   * Construit un id volontairement mal formé (pas de séparateur "=" une fois décodé en
   * base64) afin de déclencher le chemin `invalidCredentials` de PatientConfirmComponent,
   * sans dépendre d'un vrai couple hi_code/UUID patient de la base live (non accessible
   * depuis ce contexte de test statique).
   *
   * PatientConfirmComponent fait : decode(param).split("=") — un simple encodage base64
   * standard (équivalent à Buffer.from(...).toString('base64') pour de l'ASCII, comme le
   * fait js-base64 `encode`/`decode` côté Angular) d'une chaîne sans "=" donne un tableau
   * de longueur 1, ce qui force invalidCredentials = true.
   */
  static buildInvalidId(): string {
    return Buffer.from('identifiant-malforme').toString('base64');
  }

  /**
   * Encode un id "hi_code=uuid" avec le même encodage que PatientConfirmComponent.
   * Prête à l'emploi si un vrai couple hi_code/UUID patient (par ex. issu d'un patient
   * créé par un autre test) devient disponible pour tester le parcours complet.
   */
  static buildConsentId(hiCode: string, patientUUID: string): string {
    return Buffer.from(`${hiCode}=${patientUUID}`).toString('base64');
  }

  async gotoConsentement(id: string) {
    await this.page.goto(`${this.baseUrl}/consentement_patient/${encodeURIComponent(id)}`);
  }

  async gotoApproved() {
    await this.page.goto(`${this.baseUrl}/consentement_approved`);
  }

  async gotoRefused() {
    await this.page.goto(`${this.baseUrl}/consentement_refused`);
  }

  async gotoExpired() {
    await this.page.goto(`${this.baseUrl}/consentement_expired`);
  }

  async gotoAlready() {
    await this.page.goto(`${this.baseUrl}/consentement_already`);
  }

  async gotoInfos() {
    await this.page.goto(this.baseUrl);
  }

  async expectConfirmScreenLoaded() {
    await expect(this.pageTitle).toBeVisible();
    await expect(this.acceptRadio).toBeVisible();
    await expect(this.refuseRadio).toBeVisible();
    await expect(this.confirmButton).toBeVisible();
  }

  async selectAccept() {
    await this.acceptRadio.click();
  }

  async selectRefuse() {
    await this.refuseRadio.click();
  }

  async expectConfirmButtonDisabled() {
    await expect(this.confirmButton).toBeDisabled();
  }

  async expectApprovedContent() {
    await expect(this.approvedText).toBeVisible();
  }

  async expectRefusedContent() {
    await expect(this.refusedHeading).toBeVisible();
  }

  async expectExpiredContent() {
    await expect(this.expiredHeading).toBeVisible();
  }

  async expectAlreadyContent() {
    await expect(this.alreadyHeading).toBeVisible();
  }

  async expectInfosContent() {
    await expect(this.infosHeading).toBeVisible();
  }
}
