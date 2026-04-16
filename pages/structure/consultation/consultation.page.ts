// tests/pages/consultation.page.ts
import { type Page, type Locator, expect } from '@playwright/test';
import { ConsultationData } from '../generator/consultation-data-generator';

export class ConsultationPage {
  private readonly page: Page;

  // Onglet Consultation (à adapter selon votre application)
  private readonly consultationTab: Locator;
  private readonly consultationLink: Locator;

  // Liste des consultations
  private readonly consultationsHeading: Locator;
  private readonly newConsultationButton: Locator;
  private readonly filterByTypeText: Locator;

  // Modal Nouvelle consultation
  private readonly newConsultationModalHeading: Locator;
  private readonly specialtySelect: Locator;
  private readonly consultationTypeSelect: Locator;
  private readonly createConsultationButton: Locator;
  private readonly cancelButton: Locator;

  // Formulaire consultation médicale
  private readonly medicalConsultationHeading: Locator;
  private readonly caregiverSelect: Locator;
  private readonly weightInput: Locator;
  private readonly heightInput: Locator;
  private readonly temperatureInput: Locator;
  private readonly tensionInput: Locator;
  private readonly pulseInput: Locator;
  private readonly reportInput: Locator;
  private readonly summaryInput: Locator;
  private readonly prescriptionInput: Locator;
  private readonly actsSelect: Locator;        // ng-select pour les actes
  private readonly saveConsultationButton: Locator;
  private readonly confirmButton: Locator;
  private readonly annulerButton: Locator;

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
    this.reportInput = page.getByRole('textbox', { name: 'Décrivez le compte-rendu dé' });
    this.summaryInput = page.getByRole('textbox', { name: 'Synthèse et points clés de la' });
    this.prescriptionInput = page.getByRole('textbox', { name: 'Prescriptions médicamenteuses' });
    this.actsSelect = page.locator('ng-select').filter({ hasText: 'Sélectionnez les actes à' }).locator('input[type="text"]');
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
  async fillConsultationBasics(data: ConsultationData) {
    await this.specialtySelect.click();
    await this.page.getByText(data.specialty, { exact: true }).click();

    await this.consultationTypeSelect.click();
    await this.page.getByText(data.consultationType, { exact: true }).click();
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
}