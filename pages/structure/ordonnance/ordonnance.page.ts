// pages/structure/ordonnance/ordonnance.page.ts
import { type Page, type Locator, expect } from '@playwright/test';
import { openFromDashboard } from '../patient/care-pathway.page';

export interface OrdonnanceData {
  title: string;
  medicationName: string;
  posologie: string;
  remarques: string;
  recommandations: string;
}

export class OrdonnancePage {
  // Lien d'accès rapide depuis le dashboard patient (classe statique dédiée dans le template).
  readonly quickActionLink: Locator;

  // En-tête / liste des ordonnances du patient
  readonly listHeading: Locator;
  readonly newOrdonnanceButton: Locator;
  readonly firstOrdonnanceHeader: Locator;
  readonly ordonnanceItemBody: Locator;

  // Modale "Nouvelle ordonnance" (#chooseOrdonnanceSimple)
  readonly modal: Locator;
  readonly modalHeading: Locator;
  // Seul ng-select de la modale (le formulaire de médicaments n'utilise que des <select> natifs) :
  // pas de formControlName ici, le champ est piloté par [(ngModel)].
  readonly prescripteurSelect: Locator;

  // app-medication-prescription, embarqué dans la modale de création
  readonly medicationPrescription: Locator;
  readonly titreInput: Locator;
  readonly medicamentInput: Locator;
  readonly posologieInput: Locator;
  readonly remarquesInput: Locator;
  readonly recommandationsTextarea: Locator;
  readonly enregistrerOrdonnanceButton: Locator;

  // Modale de confirmation partagée (app-modal), texte re-casé en minuscules par
  // ModalComponent.titleCaseWord() -- ne pas dépendre de la casse pour ces libellés.
  readonly saveConfirmHeading: Locator;
  readonly deleteConfirmHeading: Locator;
  readonly confirmButton: Locator;

  // Ordonnance dépliée (app-ordonnance-simple-item) : suppression
  readonly supprimerOrdonnanceButton: Locator;

  // Toasts de succès
  readonly ordonnanceSavedToast: Locator;
  readonly ordonnanceDeletedToast: Locator;

  constructor(private readonly page: Page) {
    this.quickActionLink = page.locator('a.qa-ordonnance');

    // Titre de la liste : "Ordonnances (N)" (anciennement "Liste des ordonnances").
    this.listHeading = page.getByRole('heading', { name: /^(Liste des ordonnances|Ordonnances \(\d+\))/ });
    this.newOrdonnanceButton = page.locator('button.btn-action-new');
    this.firstOrdonnanceHeader = page.locator('.ordonnance-item-header').first();
    this.ordonnanceItemBody = page.locator('.ordonnance-item-body');

    this.modal = page.locator('#chooseOrdonnanceSimple');
    this.modalHeading = this.modal.getByRole('heading', { name: 'Nouvelle ordonnance' });
    this.prescripteurSelect = this.modal.locator('ng-select');

    this.medicationPrescription = this.modal.locator('app-medication-prescription');
    this.titreInput = this.medicationPrescription.getByPlaceholder('Ex: Traitement antibiotique, Traitement de fond...');
    // Table de médicaments : une ligne est déjà présente par défaut (addMedication() dans
    // ngOnInit), pas de formArrayName -- les champs sont ciblés par leur placeholder, sur la
    // première ligne.
    this.medicamentInput = this.medicationPrescription.getByPlaceholder('Nom du médicament').first();
    this.posologieInput = this.medicationPrescription.getByPlaceholder('Ex: 1 cp matin et soir').first();
    this.remarquesInput = this.medicationPrescription.getByPlaceholder('Remarques optionnelles').first();
    this.recommandationsTextarea = this.medicationPrescription.getByPlaceholder(/Entrez vos recommandations médicales/);
    this.enregistrerOrdonnanceButton = this.medicationPrescription.getByRole('button', { name: /Enregistrer l'ordonnance/ });

    this.saveConfirmHeading = this.page.getByRole('heading', { name: /Enregistrer l'ordonnance/i });
    this.deleteConfirmHeading = this.page.getByRole('heading', { name: /Supprimer l'ordonnance/i });
    this.confirmButton = page.getByRole('button', { name: 'Confirmer' });

    this.supprimerOrdonnanceButton = this.ordonnanceItemBody.getByRole('button', { name: /Supprimer l'ordonnance/ });

    this.ordonnanceSavedToast = page.getByText(/Ordonnance enregistrée avec succès/i);
    this.ordonnanceDeletedToast = page.getByText(/Ordonnance supprimée avec succès/i);
  }

  /**
   * Accède à l'écran des ordonnances du patient depuis son dashboard.
   */
  async gotoFromPatientDashboard() {
    // Le raccourci "Ordonnance" n'apparaît sur le dashboard que si le patient a déjà une
    // ordonnance : sinon la page est ouverte par son URL.
    await openFromDashboard(this.page, 'ordonnance/ordonnances');
    await expect(this.listHeading).toBeVisible();
  }

  async openNewOrdonnanceModal() {
    await this.newOrdonnanceButton.click();
    await expect(this.modalHeading).toBeVisible();
  }

  /**
   * Remplit le prescripteur (première option disponible, le référentiel des médecins dépend de la
   * structure) puis la ligne de médicament déjà présente par défaut.
   */
  async fillOrdonnanceForm(data: OrdonnanceData) {
    await this.selectFirstNgOption(this.prescripteurSelect);
    await this.titreInput.fill(data.title);
    await this.medicamentInput.fill(data.medicationName);
    await this.posologieInput.fill(data.posologie);
    await this.remarquesInput.fill(data.remarques);
    await this.recommandationsTextarea.fill(data.recommandations);
  }

  async submitOrdonnance() {
    await this.enregistrerOrdonnanceButton.click();
    await expect(this.saveConfirmHeading).toBeVisible();
    await this.confirmButton.click();
    await expect(this.ordonnanceSavedToast).toBeVisible();
  }

  async createOrdonnance(data: OrdonnanceData) {
    await this.openNewOrdonnanceModal();
    await this.fillOrdonnanceForm(data);
    await this.submitOrdonnance();
  }

  /**
   * Déplie la première ordonnance de la liste (la plus récente en tête de liste).
   */
  async openFirstOrdonnance() {
    await expect(this.firstOrdonnanceHeader).toBeVisible();
    await this.firstOrdonnanceHeader.click();
    await expect(this.ordonnanceItemBody).toBeVisible();
  }

  /**
   * Supprime la première ordonnance de la liste (la déplie si besoin).
   */
  async deleteFirstOrdonnance() {
    await this.openFirstOrdonnance();
    await this.supprimerOrdonnanceButton.click();
    await expect(this.deleteConfirmHeading).toBeVisible();
    await this.confirmButton.click();
    await expect(this.ordonnanceDeletedToast).toBeVisible();
  }

  // ======================== HELPERS ========================
  // Même technique que ConsultationPage.selectAndVerify (boucle sur les .ng-option, attente de la
  // fermeture du panneau) mais simplifiée : le référentiel des prescripteurs dépend de la
  // structure, on sélectionne donc la première option disponible plutôt qu'un libellé connu.
  private async selectFirstNgOption(ngSelectLocator: Locator) {
    await ngSelectLocator.click();
    const panel = this.page.locator('.ng-dropdown-panel:visible');
    await panel.waitFor({ state: 'visible', timeout: 5000 });
    await panel.locator('.ng-option').first().click();
    await panel.waitFor({ state: 'hidden', timeout: 3000 });
  }
}
