import { type Page, type Locator, expect } from '@playwright/test';
import { ConsultationPage } from './consultation.page';
import { ConsultationDentaireData } from '../generator/consultation-dentaire-data-generator';

export class ConsultationDentairePage extends ConsultationPage {
    private dentaireHeading: Locator;
    private container: Locator;
    private toothButtons: (toothNumber: string) => Locator;
    private diagnosticSelect: Locator;
    private treatmentSelect: Locator;
    private surfaceOptions: Locator;
    private observationsInput: Locator;
    private addToothRecordButton: Locator;
    private conclusionInput: Locator;
    private patientTypeAdultButton: Locator;
    private patientTypeChildButton: Locator;

    constructor(page: Page) {
        super(page);
        this.container = page.locator('.iq-card.dental-consultation-container').first();
        this.dentaireHeading = this.container.getByRole('heading', { name: /Consultation Dentaire/i });

        // Surcharge des champs hérités
        this.weightInput = this.container.locator('input[formcontrolname="weight"]');
        this.heightInput = this.container.locator('input[formcontrolname="taille"]');
        this.temperatureInput = this.container.locator('input[formcontrolname="temperature"]');
        this.tensionInput = this.container.locator('input[formcontrolname="tension"]');
        this.pulseInput = this.container.locator('input[formcontrolname="pulse"]');
        this.actsSelect = this.container.locator('ng-select[formcontrolname="billableActs"] input[type="text"]').first();

        // Consultant
        this.caregiverSelect = this.container
            .locator('ng-select[placeholder="Sélectionnez un consultant"]')
            .getByRole('textbox')
            .first();

        // Type de patient
        this.patientTypeAdultButton = this.container.getByRole('button', { name: /Adulte/ });
        this.patientTypeChildButton = this.container.getByRole('button', { name: /Enfant/ });

        // Champs dentaires
        this.diagnosticSelect = this.container.locator('select').filter({ hasText: /Diagnostic/i }).first();
        this.treatmentSelect = this.container.locator('select').filter({ hasText: /Traitement/i }).first();
        this.surfaceOptions = this.container.locator('.surface-selector-grid .surface-btn');
        this.observationsInput = this.container.locator('.tooth-detail-card textarea').first();
        this.addToothRecordButton = this.container.getByRole('button', { name: /Enregistrer/ }).last();
        this.conclusionInput = this.container.locator('#conclusion');

        this.toothButtons = (toothNumber: string) =>
            this.container.locator(`.tooth:has-text("${toothNumber}")`).first();
    }

    // Ferme toute modale persistante (ex: #sharedModal)
    private async closeAnyModal() {
        const modal = this.page.locator('#sharedModal');
        if (await modal.isVisible()) {
            const cancelBtn = modal.getByRole('button', { name: /Annuler|Fermer/ });
            if (await cancelBtn.isVisible()) {
                await cancelBtn.click();
            } else {
                await this.page.keyboard.press('Escape');
            }
            await expect(modal).not.toBeVisible({ timeout: 3000 }).catch(() => { });
        }
    }

    async expectDentaireFormLoaded() {
        await expect(this.dentaireHeading).toBeVisible({ timeout: 10000 });
        await expect(this.caregiverSelect).toBeVisible({ timeout: 5000 });
    }

    async selectPatientType(type: 'adult' | 'child') {
        if (type === 'adult') {
            await this.patientTypeAdultButton.click();
            // Attendre qu'une dent adulte typique apparaisse (ex: 11)
            await expect(this.toothButtons('11')).toBeVisible({ timeout: 10000 });
        } else {
            await this.patientTypeChildButton.click();
            // Attendre qu'une dent enfant typique apparaisse (ex: 51)
            await expect(this.toothButtons('51')).toBeVisible({ timeout: 10000 });
        }
    }

    async fillDentaireConsultationForm(data: ConsultationDentaireData) {
        // Soignant
        await this.caregiverSelect.click();
        await this.page.locator('.ng-dropdown-panel .ng-option').filter({ hasText: data.caregiver }).first().click();

        // Type de patient
        await this.selectPatientType(data.patientType);

        // Signes vitaux (avec protection)
        if (await this.weightInput.isVisible()) await this.weightInput.fill(data.weight);
        if (await this.heightInput.isVisible()) await this.heightInput.fill(data.height);
        if (await this.temperatureInput.isVisible()) await this.temperatureInput.fill(data.temperature);
        if (await this.tensionInput.isVisible()) await this.tensionInput.fill(data.tension);
        if (await this.pulseInput.isVisible()) await this.pulseInput.fill(data.pulse);

        // Ajout des dents
        for (const tooth of data.teeth) {
            await this.closeAnyModal(); // Fermer modale avant chaque dent
            await this.addTooth(tooth);
        }

        // Conclusion
        await this.conclusionInput.fill(data.conclusion);

        // Actes facturables
        if (data.acts && data.acts.length > 0) {
            await this.closeAnyModal();
            await this.page.keyboard.press('Escape');
            await expect(this.actsSelect).toBeEnabled({ timeout: 5000 });
            for (const act of data.acts) {
                await this.actsSelect.click();
                await this.page.getByRole('option', { name: act }).click();
            }
        }
    }

    private async addTooth(tooth: { toothNumber: string; diagnostic: string; treatment: string; surfaces: string[]; observations: string }) {
        const toothEl = this.toothButtons(tooth.toothNumber);
        await expect(toothEl).toBeVisible({ timeout: 5000 });
        await toothEl.click({ force: true });

        await expect(this.diagnosticSelect).toBeVisible({ timeout: 5000 });
        await this.diagnosticSelect.selectOption({ label: tooth.diagnostic });
        await this.treatmentSelect.selectOption({ label: tooth.treatment });

        for (const surface of tooth.surfaces) {
            const surfaceBtn = this.surfaceOptions.filter({ hasText: surface }).first();
            if (await surfaceBtn.isVisible()) {
                await surfaceBtn.click({ force: true });
            }
        }

        if (tooth.observations) {
            await expect(this.observationsInput).toBeVisible({ timeout: 5000 });
            await this.observationsInput.fill(tooth.observations);
        }

        await this.addToothRecordButton.click();
        // Attendre que le panneau d'édition se referme
        await expect(this.diagnosticSelect).not.toBeVisible({ timeout: 5000 }).catch(() => { });
        await this.page.waitForTimeout(500);
    }

    async fillUpdatedDentaireForm(data: Partial<ConsultationDentaireData>) {
        if (data.conclusion) await this.conclusionInput.fill(data.conclusion);
        if (data.acts && data.acts.length > 0) {
            await this.closeAnyModal();
            await expect(this.actsSelect).toBeEnabled({ timeout: 5000 });
            for (const act of data.acts) {
                await this.actsSelect.click();
                await this.page.getByRole('option', { name: act }).click();
            }
        }
    }

    // Ajoutez ces méthodes à la classe ConsultationDentairePage

    async activateForm() {
        const activateButton = this.page.getByRole('button', { name: 'Activer' });
        await expect(activateButton).toBeVisible();
        await activateButton.click();
        // Attendre que le formulaire soit activé (par exemple, champ conclusion devient enabled)
        await expect(this.conclusionInput).toBeEnabled({ timeout: 10000 });
    }

    async updateConsultation() {
        // Le bouton de mise à jour a le libellé "Mettre à jour la consultation"
        const updateButton = this.page.getByRole('button', { name: 'Mettre à jour la consultation' });
        await expect(updateButton).toBeEnabled({ timeout: 10000 });
        await updateButton.click();
        await expect(this.confirmButton).toBeVisible({ timeout: 10000 });
        await this.confirmButton.click();
    }

    async deleteConsultation() {
        const deleteButton = this.page.getByRole('button', { name: 'Supprimer' });
        await expect(deleteButton).toBeVisible();
        await deleteButton.click();
        await expect(this.page.getByText('Confirmez-vous la suppression')).toBeVisible();
        await expect(this.confirmButton).toBeVisible();
        await this.confirmButton.click();
    }
}