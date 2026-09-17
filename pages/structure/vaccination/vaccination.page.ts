// pages/structure/vaccination/vaccination.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

export interface VaccinationData {
  date: string;
  lot: string;
  commentary: string;
}

export interface DoseData {
  date: string;
  lot: string;
}

export class VaccinationPage {
  // Lien d'accès rapide depuis le dashboard patient (classe statique dédiée dans le template).
  readonly quickActionLink: Locator;

  // En-tête / liste des vaccinations du patient
  readonly listHeading: Locator;
  readonly newVaccinationButton: Locator;
  readonly firstVaccinationHeader: Locator;
  readonly vaccinationItemBody: Locator;

  // Modale "Veuillez choisir le type de vaccination" (#chooseTypeOfVaccinationSimple)
  readonly modal: Locator;
  readonly modalHeading: Locator;
  readonly typeSelect: Locator;
  readonly consultantSelect: Locator;
  readonly doseSelect: Locator;
  readonly dateInput: Locator;
  readonly lotInput: Locator;
  readonly commentaryTextarea: Locator;
  readonly fermerButton: Locator;
  readonly validerButton: Locator;

  // Vaccination dépliée (app-vaccination-simple-item) : suppression
  readonly supprimerButton: Locator;

  // Section "Liste des doses" de la vaccination dépliée : formulaire d'ajout
  // (app-vaccination-simple-item-static, affiché après clic sur "Nouvelle dose")
  readonly nouvelleDoseButton: Locator;
  readonly doseForm: Locator;
  readonly doseDateInput: Locator;
  readonly doseDoseSelect: Locator;
  readonly doseLotInput: Locator;
  readonly enregistrerDoseButton: Locator;

  // Modale de confirmation partagée (app-modal : AVERTISSEMENT / Fermer / Confirmer)
  readonly confirmButton: Locator;

  // Toasts de succès
  readonly vaccinationDeletedToast: Locator;
  readonly doseAddedToast: Locator;

  constructor(private readonly page: Page) {
    this.quickActionLink = page.locator('a.qa-vaccination');

    this.listHeading = page.getByRole('heading', { name: /Liste des vaccinations/ });
    this.newVaccinationButton = page.locator('button.btn-action-new');
    this.firstVaccinationHeader = page.locator('.vaccination-item-header').first();
    this.vaccinationItemBody = page.locator('.vaccination-item-body');

    this.modal = page.locator('#chooseTypeOfVaccinationSimple');
    this.modalHeading = this.modal.getByRole('heading', { name: 'Veuillez choisir le type de vaccination' });
    // ng-select (Angular) : ciblage par l'attribut formcontrolname (rendu en minuscule dans le DOM),
    // plusieurs ng-select cohabitant dans la même modale sans nom accessible distinct.
    this.typeSelect = this.modal.locator('ng-select[formcontrolname="type"]');
    this.consultantSelect = this.modal.locator('ng-select[formcontrolname="caregiverId"]');
    this.doseSelect = this.modal.locator('ng-select[formcontrolname="dose"]');
    this.dateInput = this.modal.locator('input[formcontrolname="date"]');
    this.lotInput = this.modal.locator('input[formcontrolname="lot"]');
    this.commentaryTextarea = this.modal.locator('textarea[formcontrolname="commentary"]');
    this.fermerButton = this.modal.getByRole('button', { name: /Fermer/ });
    this.validerButton = this.modal.getByRole('button', { name: /Valider/ });

    // Bouton de suppression dans l'en-tête de l'item déplié (classe btn-danger, texte précédé d'une icône).
    this.supprimerButton = this.vaccinationItemBody.locator('button.btn-danger');

    // Formulaire d'ajout de dose : composant dédié, distinct du formulaire d'édition de la
    // vaccination qui partage les mêmes noms de formcontrolname ("date", "lot") dans le même item
    // déplié -- on scope donc systématiquement sous <app-vaccination-simple-item-static> pour éviter
    // toute ambiguïté avec le formulaire d'édition.
    this.nouvelleDoseButton = this.vaccinationItemBody.getByRole('button', { name: /Nouvelle dose/ });
    this.doseForm = page.locator('app-vaccination-simple-item-static');
    this.doseDateInput = this.doseForm.locator('input[formcontrolname="date"]');
    this.doseDoseSelect = this.doseForm.locator('ng-select[formcontrolname="dose"]');
    this.doseLotInput = this.doseForm.locator('input[formcontrolname="lot"]');
    this.enregistrerDoseButton = this.doseForm.getByRole('button', { name: /Enregistrer la dose/ });

    this.confirmButton = page.getByRole('button', { name: 'Confirmer' });

    this.vaccinationDeletedToast = page.getByText('La suppression de la vaccination a réussi');
    // Message exact du service : "L'ajout de cette dose a  reussi " (double espace, sans accent,
    // espace final) -- on matche donc en tolérant les espaces et la casse.
    this.doseAddedToast = page.getByText(/ajout de cette dose.*reussi/i);
  }

  /**
   * Accède à l'écran des vaccinations du patient depuis son dashboard.
   */
  async gotoFromPatientDashboard() {
    await expect(this.quickActionLink).toBeVisible();
    await this.quickActionLink.click();
    await this.page.waitForURL('**/vaccination/vaccinations/**');
    await expect(this.listHeading).toBeVisible();
  }

  async openNewVaccinationModal() {
    await this.newVaccinationButton.click();
    await expect(this.modalHeading).toBeVisible();
  }

  /**
   * Remplit le formulaire de nouvelle vaccination. Le type, le consultant et la dose sont
   * pilotés par des référentiels qui varient selon la structure : on sélectionne simplement la
   * première option disponible pour chacun, ce qui suffit à valider le formulaire.
   */
  async fillVaccinationForm(data: VaccinationData) {
    await this.selectFirstNgOption(this.typeSelect);
    await this.selectFirstNgOption(this.consultantSelect);
    await this.selectFirstNgOption(this.doseSelect);
    await this.dateInput.fill(data.date);
    await this.lotInput.fill(data.lot);
    await this.commentaryTextarea.fill(data.commentary);
  }

  async submitVaccinationForm() {
    await this.validerButton.click();
    await expect(this.modal).toBeHidden();
  }

  async createVaccination(data: VaccinationData) {
    await this.openNewVaccinationModal();
    await this.fillVaccinationForm(data);
    await this.submitVaccinationForm();
  }

  /**
   * Déplie la première vaccination de la liste (la plus récente en tête de liste).
   */
  async openFirstVaccination() {
    await expect(this.firstVaccinationHeader).toBeVisible();
    await this.firstVaccinationHeader.click();
    await expect(this.vaccinationItemBody).toBeVisible();
  }

  /**
   * Ajoute une dose à la première vaccination de la liste (la déplie si besoin).
   */
  async addDoseToFirstVaccination(data: DoseData) {
    await this.openFirstVaccination();
    await this.nouvelleDoseButton.click();
    await expect(this.doseForm).toBeVisible();

    await this.doseDateInput.fill(data.date);
    await this.selectFirstNgOption(this.doseDoseSelect);
    if (data.lot) {
      await this.doseLotInput.fill(data.lot);
    }

    await this.enregistrerDoseButton.click();
    await expect(this.page.getByText('Voulez-vous ajouter cette dose')).toBeVisible();
    await this.confirmButton.click();
    await expect(this.doseAddedToast).toBeVisible();
  }

  /**
   * Supprime la première vaccination de la liste (la déplie si besoin).
   */
  async deleteFirstVaccination() {
    await this.openFirstVaccination();
    await this.supprimerButton.click();
    await expect(this.page.getByText('Voulez-vous supprimer cette vaccination')).toBeVisible();
    await this.confirmButton.click();
    await expect(this.vaccinationDeletedToast).toBeVisible();
  }

  // ======================== HELPERS ========================
  // Même technique que ConsultationPage.selectAndVerify (boucle sur les .ng-option, attente de la
  // fermeture du panneau) mais simplifiée : les référentiels de vaccination dépendent de la
  // structure, on sélectionne donc la première option disponible plutôt qu'un libellé connu.
  private async selectFirstNgOption(ngSelectLocator: Locator) {
    await ngSelectLocator.click();
    const panel = this.page.locator('.ng-dropdown-panel:visible');
    await panel.waitFor({ state: 'visible', timeout: 5000 });
    await panel.locator('.ng-option').first().click();
    await panel.waitFor({ state: 'hidden', timeout: 3000 });
  }
}
