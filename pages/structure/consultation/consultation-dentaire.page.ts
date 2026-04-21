import { type Page, type Locator, expect } from '@playwright/test';
import { ConsultationPage } from './consultation.page';
import { ConsultationDentaireData } from '../generator/consultation-dentaire-data-generator';

export class ConsultationDentairePage extends ConsultationPage {
    private dentaireHeading: Locator;
    private container: Locator;

    // Champs dentaires
    private toothButtons: (toothNumber: string) => Locator;
    private diagnosticSelect: Locator;
    private treatmentSelect: Locator;
    private surfaceOptions: Locator;
    private observationsInput: Locator;
    private addToothRecordButton: Locator;
    private conclusionInput: Locator;

    constructor(page: Page) {
        super(page);
        this.container = page.locator('#tabConsultationSimple, .consultation-standard-container').first();
        this.dentaireHeading = page.getByRole('heading', { name: /Consultation Dentaire/i });

        // Redéfinir les champs hérités pour qu'ils pointent vers ce conteneur
        this.weightInput = this.container.locator('#weight');
        this.heightInput = this.container.locator('#taille');
        this.temperatureInput = this.container.locator('#temperature');
        this.tensionInput = this.container.locator('#tension');
        this.pulseInput = this.container.locator('#pulse');
        this.caregiverSelect = this.container.locator('#caregiverId').getByRole('textbox');
        this.actsSelect = this.container.locator('ng-select[formControlName="billableActs"] input[type="text"]').first();

        // Champs dentaires
        this.diagnosticSelect = this.container.locator('select').filter({ hasText: /Diagnostic/i }).first();
        this.treatmentSelect = this.container.locator('select').filter({ hasText: /Traitement/i }).first();
        this.surfaceOptions = this.container.locator('div.surface-options, .surface-checkbox');
        this.observationsInput = this.container.locator('#observations, input[placeholder*="Observations"]');
        this.addToothRecordButton = this.container.getByRole('button', { name: ' Enregistrer', exact: true });
        this.conclusionInput = this.container.locator('#conclusion');

        this.toothButtons = (toothNumber: string) =>
            this.container.locator(`button:has-text("${toothNumber}"), .tooth-number:has-text("${toothNumber}")`).first();
    }

    async expectDentaireFormLoaded() {
        await expect(this.dentaireHeading).toBeVisible();
    }

    /**
     * Remplit le formulaire dentaire (méthode spécifique, n'override pas celle du parent)
     */
    async fillDentaireConsultationForm(data: ConsultationDentaireData) {
        // Soignant
        await this.caregiverSelect.click();
        await this.page.locator('.ng-dropdown-panel .ng-option').filter({ hasText: data.caregiver }).first().click();

        // Signes vitaux
        await this.weightInput.fill(data.weight);
        await this.heightInput.fill(data.height);
        await this.temperatureInput.fill(data.temperature);
        await this.tensionInput.fill(data.tension);
        await this.pulseInput.fill(data.pulse);

        // Ajout des dents
        for (const tooth of data.teeth) {
            await this.addTooth(tooth);
        }

        // Conclusion
        await this.conclusionInput.fill(data.conclusion);

        // Actes
        if (data.acts && data.acts.length > 0) {
            await expect(this.actsSelect).toBeEnabled({ timeout: 5000 });
            for (const act of data.acts) {
                await this.actsSelect.click();
                await this.page.getByRole('option', { name: act }).click();
            }
        }
    }

    private async addTooth(tooth: { toothNumber: string; diagnostic: string; treatment: string; surfaces: string[]; observations: string }) {
        await this.toothButtons(tooth.toothNumber).click();
        await this.diagnosticSelect.selectOption({ label: tooth.diagnostic });
        await this.treatmentSelect.selectOption({ label: tooth.treatment });
        for (const surface of tooth.surfaces) {
            const surfaceElement = this.container.locator(`text="${surface}"`).first();
            await surfaceElement.click();
        }
        await this.observationsInput.fill(tooth.observations);
        await this.addToothRecordButton.click();
        await this.page.waitForTimeout(500);
    }

    async fillUpdatedDentaireForm(data: Partial<ConsultationDentaireData>) {
        if (data.conclusion) await this.conclusionInput.fill(data.conclusion);
        if (data.acts && data.acts.length > 0) {
            await expect(this.actsSelect).toBeEnabled({ timeout: 5000 });
            for (const act of data.acts) {
                await this.actsSelect.click();
                await this.page.getByRole('option', { name: act }).click();
            }
        }
    }
}