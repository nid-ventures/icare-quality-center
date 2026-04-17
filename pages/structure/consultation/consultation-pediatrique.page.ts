// tests/pages/consultation-pediatrique.page.ts
import { type Page, type Locator, expect } from '@playwright/test';
import { ConsultationPage } from './consultation.page';
import { ConsultationPediatriqueData } from '../generator/consultation-pediatrique-data-generator';

export class ConsultationPediatriquePage extends ConsultationPage {
    private pediatriqueHeading: Locator;
    private pcInput: Locator;
    private pbInput: Locator;
    private container: Locator; // Conteneur du formulaire

    constructor(page: Page) {
        super(page);
        // Conteneur principal du formulaire pédiatrique (ajustez selon le HTML)
        this.container = page.locator('#tabConsultationSimple, .consultation-standard-container').first();

        // Redéfinir les champs hérités pour qu'ils pointent vers ce conteneur
        this.weightInput = this.container.locator('#weight');
        this.heightInput = this.container.locator('#taille');
        this.temperatureInput = this.container.locator('#temperature');
        this.tensionInput = this.container.locator('#tension');
        this.pulseInput = this.container.locator('#pulse');
        this.reportInput = this.container.locator('#report');
        this.summaryInput = this.container.locator('#synthesis');
        this.prescriptionInput = this.container.locator('#description');
        this.actsSelect = this.container.locator('ng-select[formControlName="billableActs"] input[type="text"]').first();
        this.caregiverSelect = this.container.locator('#caregiverId').getByRole('textbox');

        // Champs pédiatriques spécifiques
        this.pcInput = this.container.locator('#pc');
        this.pbInput = this.container.locator('#pb');
        this.pediatriqueHeading = page.getByRole('heading', { name: /Consultation Médicale Pé/i });
    }

    async expectPediatriqueFormLoaded() {
        await expect(this.pediatriqueHeading).toBeVisible();
    }

    async fillMedicalConsultationForm(data: ConsultationPediatriqueData) {
        // Soignant
        await this.caregiverSelect.click();
        await this.page.locator('.ng-dropdown-panel .ng-option').filter({ hasText: data.caregiver }).first().click();

        // Signes vitaux communs
        await this.weightInput.fill(data.weight);
        await this.heightInput.fill(data.height);
        await this.temperatureInput.fill(data.temperature);
        await this.tensionInput.fill(data.tension);
        await this.pulseInput.fill(data.pulse);

        // Champs pédiatriques spécifiques
        await this.pcInput.fill(data.pc);
        await this.pbInput.fill(data.pb);

        // Textes
        await this.reportInput.fill(data.report);
        await this.summaryInput.fill(data.summary);
        await this.prescriptionInput.fill(data.prescription);

        // Actes
        if (data.acts && data.acts.length > 0) {
            await expect(this.actsSelect).toBeEnabled({ timeout: 5000 });
            for (const act of data.acts) {
                await this.actsSelect.click();
                await this.page.getByRole('option', { name: act }).click();
            }
        }
    }

    async fillUpdatedPediatriqueForm(data: Partial<ConsultationPediatriqueData>) {
        if (data.report) await this.reportInput.fill(data.report);
        if (data.summary) await this.summaryInput.fill(data.summary);
        if (data.prescription) await this.prescriptionInput.fill(data.prescription);
        if (data.acts && data.acts.length > 0) {
            await expect(this.actsSelect).toBeEnabled({ timeout: 5000 });
            for (const act of data.acts) {
                await this.actsSelect.click();
                await this.page.getByRole('option', { name: act }).click();
            }
        }
    }
}