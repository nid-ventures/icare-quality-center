// tests/pages/consultation.page.ts
import { type Page, type Locator, expect } from '@playwright/test';
import { ConsultationData } from '../generator/consultation-standard-data-generator';

export class ConsultationPage {
  page: Page;

  // Onglet Consultation (à adapter selon votre application)
  consultationTab: Locator;
  consultationLink: Locator;

  // Liste des consultations
  consultationsHeading: Locator;
  newConsultationButton: Locator;
  filterByTypeText: Locator;

  // Modal Nouvelle consultation
  newConsultationModalHeading: Locator;
  specialtySelect: Locator;
  consultationTypeSelect: Locator;
  createConsultationButton: Locator;
  cancelButton: Locator;

  // Formulaire consultation médicale
  medicalConsultationHeading: Locator;
  caregiverSelect: Locator;
  weightInput: Locator;
  heightInput: Locator;
  temperatureInput: Locator;
  tensionInput: Locator;
  pulseInput: Locator;
  reportInput: Locator;
  summaryInput: Locator;
  prescriptionInput: Locator;
  actsSelect: Locator;        // ng-select pour les actes
  saveConsultationButton: Locator;
  confirmButton: Locator;
  annulerButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Onglet / lien Consultation
    this.consultationTab = page.getByRole('link', { name: 'Consultation', exact: true }).first();
    this.consultationLink = page.getByRole('link', { name: 'Consultation', exact: true }).first();

    // Liste des consultations
    this.consultationsHeading = page.getByRole('heading', { name: 'Liste des consultations' });
    this.newConsultationButton = page.getByRole('button', { name: ' Nouvelle consultation' });
    this.filterByTypeText = page.getByText('Filtrer par type :');

    // Modal Nouvelle consultation
    this.newConsultationModalHeading = page.getByRole('heading', { name: 'Nouvelle consultation' });
    this.specialtySelect = page.locator('ng-select').filter({ hasText: 'Sélectionner une spécialité' }).getByRole('textbox');
    this.consultationTypeSelect = page.locator('ng-select').filter({ hasText: 'Sélectionner un type' }).getByRole('textbox');
    this.createConsultationButton = page.getByRole('button', { name: ' Créer la consultation' });
    this.cancelButton = page.getByRole('button', { name: ' Annuler' });

    // Formulaire consultation médicale
    this.medicalConsultationHeading = page.getByRole('heading', { name: ' Consultation Médicale' });
    this.caregiverSelect = page.locator('#caregiverId').getByRole('textbox');
    this.weightInput = page.locator('#weight');
    this.heightInput = page.locator('#taille');
    this.temperatureInput = page.locator('#temperature');
    this.tensionInput = page.locator('#tension');
    this.pulseInput = page.locator('#pulse');
    this.reportInput = page.getByRole('textbox', { name: /Décrivez le compte-rendu dé/i });
    this.summaryInput = page.getByRole('textbox', { name: /Synthèse et points clés de la/i });
    this.prescriptionInput = page.getByRole('textbox', { name: /Prescriptions médicamenteuses/i });
    // Nouveau sélecteur (cible le premier input non désactivé)
    this.actsSelect = page
      .locator('ng-select')
      .filter({ hasText: /Sélectionnez les actes à/i })
      .locator('input[type="text"]:not([disabled])')
      .first();
    this.saveConsultationButton = page.getByRole('button', { name: ' Enregistrer la consultation' });
    this.confirmButton = page.getByRole('button', { name: 'Confirmer' });
    this.annulerButton = page.getByRole('button', { name: ' Annuler' });
  }

  /**
   * Accède à l'onglet Consultation (après être sur le dashboard patient)
   */
  async goToConsultationTab() {
    await expect(this.consultationLink).toBeVisible();
    await this.consultationLink.click();
  }

  /**
   * Vérifie que la page Liste des consultations est chargée
   */
  async expectConsultationsListLoaded() {
    await expect(this.consultationsHeading).toBeVisible();
    await expect(this.filterByTypeText).toBeVisible();
    await expect(this.newConsultationButton).toBeVisible();
  }

  /**
   * Ouvre le modal de nouvelle consultation
   */
  async openNewConsultationModal() {
    await this.newConsultationButton.click();
    await expect(this.newConsultationModalHeading).toBeVisible();
  }

  /**
   * Remplit la première partie du formulaire (spécialité et type)
   */
  // consultation.page.ts

  async fillConsultationBasics(data: { specialty: string; consultationType: string }) {
    // Sélection de la spécialité
    await this.specialtySelect.click();
    await this.page.waitForSelector('.ng-dropdown-panel .ng-option', { timeout: 5000 });
    const specialtyOption = this.page
      .locator('.ng-dropdown-panel .ng-option')
      .filter({ hasText: new RegExp(data.specialty, 'i') })
      .first();
    await specialtyOption.click();

    // Sélection du type de consultation
    await this.consultationTypeSelect.click();
    await this.page.waitForSelector('.ng-dropdown-panel .ng-option', { timeout: 5000 });
    const typeOption = this.page
      .locator('.ng-dropdown-panel .ng-option')
      .filter({ hasText: new RegExp(data.consultationType, 'i') })
      .first();
    await typeOption.click();
  }


  /**
   * Crée la consultation (bouton "Créer la consultation") et attend le formulaire détaillé
   */
  async createConsultation() {
    await this.createConsultationButton.click();
    await expect(this.medicalConsultationHeading).toBeVisible();
  }

  /**
   * Remplit le formulaire détaillé de la consultation médicale
   */
  async fillMedicalConsultationForm(data: ConsultationData) {
    // Soignant
    await this.caregiverSelect.click();
    await this.page.getByText(data.caregiver).click();

    // Signes vitaux
    await this.weightInput.fill(data.weight);
    await this.heightInput.fill(data.height);
    await this.temperatureInput.fill(data.temperature);
    await this.tensionInput.fill(data.tension);
    await this.pulseInput.fill(data.pulse);

    // Textes
    await this.reportInput.fill(data.report);
    await this.summaryInput.fill(data.summary);
    await this.prescriptionInput.fill(data.prescription);

    // Actes médicaux (sélection multiple)
    for (const act of data.acts) {
      await this.actsSelect.click();
      await this.page.getByRole('option', { name: act }).click();
    }
  }

  /**
   * Sauvegarde la consultation et confirme la modale
   */
  async saveConsultation() {
    await this.saveConsultationButton.click();
    await expect(this.confirmButton).toBeVisible();
    await this.confirmButton.click();

  }

  /**
   * Annule la création (si besoin)
   */
  async cancelConsultation() {
    await this.annulerButton.click();
  }

  /**
   * Filtre la liste des consultations par type (exemple après création)
   */
  async filterByConsultationType(type: string) {
    const filterSelect = this.page.locator('app-consultations').getByRole('textbox');
    await filterSelect.click();
    await this.page.getByRole('option', { name: type.toUpperCase() }).click();

  }
  /**
   * Sélectionne la première consultation dans la liste (filtre préalable possible)
   * Retourne le bouton de la consultation pour cliquer dessus
   */
  async selectFirstConsultation() {
    const firstConsultationButton = this.page
      .locator('app-consultations button')
      .filter({ hasText: /Consultation/ })
      .first();
    await firstConsultationButton.click();
  }

  /**
   * Active le formulaire de modification (bouton "Activer")
   */
  async activateForm() {
    const activateButton = this.page.getByRole('button', { name: ' Activer' });
    await expect(activateButton).toBeVisible();
    await activateButton.click();

    // Attendre que le champ soit enabled
    await expect(this.reportInput).toBeEnabled({ timeout: 10000 });
    await expect(this.summaryInput).toBeEnabled();
  }
  /**
   * Remplit les champs modifiables avec de nouvelles données
   */
  async fillUpdatedForm(data: Partial<ConsultationData>) {
    if (data.report) await this.reportInput.fill(data.report);
    if (data.summary) await this.summaryInput.fill(data.summary);
    if (data.prescription) await this.prescriptionInput.fill(data.prescription);
    if (data.acts && data.acts.length > 0) {
      // Pour les actes, il faut peut-être d'abord supprimer ceux existants
      // Ici on suppose qu'on peut en ajouter d'autres (à adapter selon l'UI)
      for (const act of data.acts) {
        await this.actsSelect.click();
        await this.page.getByRole('option', { name: act }).click();
      }
    }
  }

  /**
   * Sauvegarde la modification (bouton "Mettre à jour")
   */
  async updateConsultation() {
    const updateButton = this.page.getByRole('button', { name: ' Mettre à jour la' });
    await updateButton.click();
    await expect(this.confirmButton).toBeVisible();
    await this.confirmButton.click();

  }
  // consultation.page.ts

  /**
   * Supprime la consultation actuellement ouverte (après l'avoir sélectionnée)
   */
  async deleteConsultation() {
    const deleteButton = this.page.getByRole('button', { name: ' Supprimer' });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    await expect(this.page.getByText('Voulez-vous supprimer cette')).toBeVisible();
    await expect(this.confirmButton).toBeVisible();

    // Masquer le filtre qui intercepte les clics
    await this.page.locator('.filter-container').evaluate(el => el.style.display = 'none');
    await this.confirmButton.click();

  }

  /**
   * Ouvre la première consultation de la liste (après filtre éventuel)
   */
  async openFirstConsultation() {
    const firstConsultationButton = this.page
      .locator('app-consultations button')
      .filter({ hasText: /Consultation/ })
      .first();
    await firstConsultationButton.click();
  }
}