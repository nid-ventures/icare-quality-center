// pages/structure/consultation/consultation.page.ts
import { type Page, type Locator, expect } from '@playwright/test';
import { ConsultationData } from '../generator/consultation-standard-data-generator';

export class ConsultationPage {
  // Onglet Consultation (à adapter selon votre application)
  consultationTab: Locator;
  consultationLink: Locator;

  // Liste des consultations
  consultationsHeading: Locator;
  newConsultationButton: Locator;
  filterByTypeText: Locator;

  // Bandeau "Nouvelle consultation" (spécialités en pastilles, types en boutons, recherche)
  newConsultationBar: Locator;
  specialtyPills: Locator;
  typeChips: Locator;
  typeSearchInput: Locator;
  /** Rappel du type choisi pendant la saisie, avec son bouton "Annuler" */
  currentTypeBar: Locator;
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

  constructor(protected readonly page: Page) {
    // Onglet / lien Consultation
    // Le lien porte une icône générant un espace insécable avant le texte
    // (nom accessible réel : " Consultation") -> pas de correspondance exacte.
    this.consultationTab = page.getByRole('link', { name: 'Consultation' }).first();
    this.consultationLink = page.getByRole('link', { name: 'Consultation' }).first();

    // Liste des consultations
    this.consultationsHeading = page.getByRole('heading', { name: 'Liste des consultations' });
    // Plus de bouton ni de fenêtre : le bandeau "Nouvelle consultation" est affiché sur la page
    this.newConsultationButton = page.locator('.new-consultation-bar').filter({ hasText: 'Nouvelle consultation' });
    this.filterByTypeText = page.locator('.consultation-filter ng-select');

    // Bandeau Nouvelle consultation
    this.newConsultationBar = this.newConsultationButton;
    this.specialtyPills = this.newConsultationBar.locator('.ncb-pills .speciality-pill');
    this.typeChips = this.newConsultationBar.locator('.ncb-types .type-chip');
    this.typeSearchInput = this.newConsultationBar.getByRole('textbox', { name: 'Rechercher un type de consultation' });
    this.currentTypeBar = page.locator('.current-type-bar');
    this.cancelButton = this.currentTypeBar.getByRole('button', { name: /Annuler/ });

    // Formulaire consultation médicale
    this.medicalConsultationHeading = page.getByRole('heading', { name: /^\W*Consultation Médicale/ });
    this.caregiverSelect = page.locator('#caregiverId').getByRole('textbox');
    this.weightInput = page.locator('#weight');
    this.heightInput = page.locator('#taille');
    this.temperatureInput = page.locator('#temperature');
    this.tensionInput = page.locator('#tension');
    this.pulseInput = page.locator('#pulse');
    this.reportInput = page.getByRole('textbox', { name: /Décrivez le compte-rendu dé/i });
    this.summaryInput = page.getByRole('textbox', { name: /Synthèse et points clés de la/i });
    this.prescriptionInput = page.getByRole('textbox', { name: /Prescriptions médicamenteuses/i });
    // ng-select n'expose pas de rôle accessible standard : on cible son input interne
    // (le premier non désactivé) via CSS.
    this.actsSelect = page
      .locator('ng-select')
      .filter({ hasText: /Sélectionnez les actes à/i })
      .locator('input[type="text"]:not([disabled])')
      .first();
    this.saveConsultationButton = page.getByRole('button', { name: /^\W*Enregistrer la consultation/ });
    this.confirmButton = page.getByRole('button', { name: 'Confirmer' });
    this.annulerButton = page.getByRole('button', { name: /^\W*Annuler/ });
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
   * Affiche le bandeau "Nouvelle consultation" (il remplace l'ancienne fenêtre : rien à ouvrir).
   */
  async openNewConsultationModal() {
    // Le loader plein écran d'un chargement précédent peut encore masquer le bandeau.
    await this.page.locator('app-loader .backdrop.full-screen').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await expect(this.newConsultationBar).toBeVisible();
  }

  /**
   * Choisit la spécialité (pastille) puis le type (bouton). Une spécialité à type unique
   * (pédiatrie, dentiste…) ouvre directement le formulaire, sans bouton de type.
   */
  async fillConsultationBasics(data: { specialty: string; consultationType: string }) {
    const pill = this.specialtyPills.filter({ hasText: exactLabel(data.specialty, true) });
    await expect(pill, `Spécialité "${data.specialty}" proposée`).toHaveCount(1);
    await pill.click();
    const chip = this.typeChips.filter({ hasText: exactLabel(data.consultationType) });
    // Formulaire ouvert directement (type unique) ou boutons des types de la spécialité
    await expect(this.currentTypeBar.or(chip).first()).toBeVisible();
    if (!await this.currentTypeBar.isVisible()) {
      await expect(chip, `Type "${data.consultationType}" proposé`).toHaveCount(1);
      await chip.click();
    }
  }

  /**
   * Le formulaire du type choisi est ouvert : plus de bouton "Créer la consultation", le choix
   * du type suffit ; le rappel du type reste affiché pendant la saisie.
   */
  async createConsultation() {
    await expect(this.currentTypeBar).toBeVisible();
  }

  /** Recherche un type de consultation dans le bandeau (sans tenir compte des accents). */
  async searchConsultationType(term: string) {
    await this.typeSearchInput.fill(term);
  }

  /** Ferme le formulaire en cours (bouton "Annuler" du rappel du type) : le bandeau revient. */
  async cancelNewConsultation() {
    await this.cancelButton.click();
    await expect(this.currentTypeBar).toBeHidden();
    await expect(this.newConsultationBar).toBeVisible();
  }

  /**
   * Remplit le formulaire détaillé de la consultation médicale
   */
  async fillMedicalConsultationForm(data: ConsultationData) {
    // Soignant : le catalogue de soignants dépend de l'environnement (données différentes en
    // local vs distant), on prend donc le premier disponible plutôt qu'un nom précis figé.
    await this.caregiverSelect.click();
    const caregiverPanel = this.page.locator('.ng-dropdown-panel:visible');
    await caregiverPanel.waitFor({ state: 'visible', timeout: 5000 });
    await this.page.locator('.ng-dropdown-panel .ng-option').first().click();

    // Signes vitaux
    await this.weightInput.fill(data.weight);
    await this.heightInput.fill(data.height);
    await this.temperatureInput.fill(data.temperature);
    await this.tensionInput.fill(data.tension);
    await this.pulseInput.fill(data.pulse);

    // Textes
    await this.reportInput.fill(data.report);
    await this.summaryInput.fill(data.summary);
    // « Ordonnance de la consultation » : plus proposée à la création (ordonnances via les prescriptions)

    // Actes médicaux (sélection multiple)
    for (const act of data.acts) {
      await this.actsSelect.click();
      const actsPanel = this.page.locator('.ng-dropdown-panel:visible');
      await actsPanel.waitFor({ state: 'visible', timeout: 5000 });
      const exactActOption = this.page.getByRole('option', { name: act, exact: true });
      if (await exactActOption.isVisible().catch(() => false)) {
        await exactActOption.click();
      } else {
        await actsPanel.locator('.ng-option').first().click();
      }
    }
  }

  /** Noms des `count` premiers actes à facturer proposés par la structure (liste refermée ensuite). */
  async availableActs(count: number): Promise<string[]> {
    await this.actsSelect.click();
    const actsPanel = this.page.locator('.ng-dropdown-panel:visible');
    await actsPanel.locator('.ng-option:not(.ng-optgroup)').first().waitFor({ state: 'visible', timeout: 15000 });
    const names = (await actsPanel.locator('.ng-option:not(.ng-optgroup)').allInnerTexts()).map(t => t.trim()).filter(Boolean);
    await this.page.keyboard.press('Escape');
    return [...new Set(names)].slice(0, count);
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
      .locator('app-consultations')
      .getByRole('button', { name: /Consultation/ })
      .first();
    await firstConsultationButton.click();
  }

  /**
   * Active le formulaire de modification (bouton "Activer")
   */
  async activateForm() {
    const activateButton = this.page.getByRole('button', { name: /^\W*Activer/ });
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
    // Affichée en modification seulement si la consultation contient déjà une ordonnance
    if (data.prescription && await this.prescriptionInput.isVisible()) await this.prescriptionInput.fill(data.prescription);
    if (data.acts && data.acts.length > 0) {
      // Pour les actes, il faut peut-être d'abord supprimer ceux existants
      // Ici on suppose qu'on peut en ajouter d'autres (à adapter selon l'UI)
      for (const act of data.acts) {
        await this.actsSelect.click();
        const actsPanel = this.page.locator('.ng-dropdown-panel:visible');
        await actsPanel.waitFor({ state: 'visible', timeout: 5000 });
        const exactActOption = this.page.getByRole('option', { name: act, exact: true });
        if (await exactActOption.isVisible().catch(() => false)) {
          await exactActOption.click();
        } else {
          await actsPanel.locator('.ng-option').first().click();
        }
      }
    }
  }

  /**
   * Sauvegarde la modification (bouton "Mettre à jour")
   */
  async updateConsultation() {
    const updateButton = this.page.getByRole('button', { name: /^\W*Mettre à jour la/ });
    await updateButton.click();
    await expect(this.confirmButton).toBeVisible();
    await this.confirmButton.click();
  }

  /**
   * Supprime la consultation actuellement ouverte (après l'avoir sélectionnée)
   */
  async deleteConsultation() {
    const deleteButton = this.page.getByRole('button', { name: /^\W*Supprimer/ });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    await expect(this.page.getByText('Voulez-vous supprimer cette')).toBeVisible();
    await expect(this.confirmButton).toBeVisible();

    // Le `.consultation-filter` (filtres de la liste des consultations, positionné en overlay)
    // intercepte le clic sur le bouton de confirmation même quand la modale est au-dessus.
    // On le masque temporairement via evaluate() pour contourner ce bug de superposition,
    // le temps de cliquer sur "Confirmer".
    await this.page.locator('.consultation-filter').evaluate(el => (el as HTMLElement).style.display = 'none').catch(() => { });
    await this.confirmButton.click();
  }

  /**
   * Ouvre la première consultation de la liste (après filtre éventuel)
   */
  async openFirstConsultation() {
    const firstConsultationButton = this.page
      .locator('app-consultations')
      .getByRole('button', { name: /Consultation/ })
      .first();
    await firstConsultationButton.click();
  }
}

/** Libellé exact (casse ignorée), suivi éventuellement du nombre de types affiché sur la pastille. */
export function exactLabel(label: string, withCount = false): RegExp {
  const escaped = label.replace(/\s+/g, ' ').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  return new RegExp(`^\\s*${escaped}\\s*${withCount ? '\\d*\\s*' : ''}$`, 'i');
}
