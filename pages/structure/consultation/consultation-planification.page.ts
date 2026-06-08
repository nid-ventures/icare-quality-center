// tests/pages/structure/consultation/consultation-planification.page.ts
import { type Page, type Locator, expect } from '@playwright/test';
import { ConsultationPage } from './consultation.page';
import { ConsultationPlanificationData } from '../generator/consultation-planification-data-generator';

export class ConsultationPlanificationPage extends ConsultationPage {
    private planificationHeading: Locator;
    private weightGainInput: Locator;
    private lastPeriodDateInput: Locator;
    private currentMethodSelect: Locator;
    private chosenMethodSelect: Locator;
    private observationsInput: Locator;
    private nextAppointmentDateInput: Locator;
    private pbInput: Locator;
    private correctUsageCheckbox: Locator;
    private sideEffectsCheckbox: Locator;
    private istPreventionCheckbox: Locator;

    constructor(page: Page) {
        super(page);

        // Titre de la consultation (modification)
        this.planificationHeading = page.getByRole('heading', { name: /Modification Consultation Planification Familiale/i });

        // Consultant
        this.caregiverSelect = page
            .locator('ng-select')
            .filter({ hasText: /Sélectionner un consultant/i })
            .getByRole('textbox')
            .first();

        // Champs des constantes
        this.heightInput = page.getByPlaceholder('Taille');
        this.weightInput = page.getByPlaceholder('Poids', { exact: true });
        this.weightGainInput = page.getByPlaceholder('Prise de poids');
        this.temperatureInput = page.getByRole('textbox', { name: 'Température' });
        this.tensionInput = page.locator('input[formcontrolname="ta"]').first();
        this.pulseInput = page.getByRole('textbox', { name: 'Fréquence' });
        this.pbInput = page.locator('input[formcontrolname="pb"]').first();

        // Date dernières règles (2ème input date)
        this.lastPeriodDateInput = page.locator('input[type="date"]').nth(1);

        // Méthode actuelle (ng-select)
        this.currentMethodSelect = page
            .locator('ng-select')
            .filter({ hasText: /Sélectionnez une ou plusieurs méthodes/i })
            .first()
            .locator('input[type="text"]');

        // Méthode choisie (ng-select avec formcontrolname)
        this.chosenMethodSelect = page
            .locator('ng-select[formcontrolname="methodeChoisie"]')
            .locator('input[type="text"]')
            .first();

        // Checkboxes
        this.correctUsageCheckbox = page.getByRole('checkbox', { name: 'Utilisation correcte expliquée' });
        this.sideEffectsCheckbox = page.getByRole('checkbox', { name: 'Effets secondaires discutés' });
        this.istPreventionCheckbox = page.getByRole('checkbox', { name: 'Prévention des IST abordée' });

        // Observations
        this.observationsInput = page.locator('textarea[formcontrolname="observations"]').first();

        // Date prochain rendez-vous (3ème input date)
        this.nextAppointmentDateInput = page.locator('input[type="date"]').nth(2);

        // Actes facturables
        this.actsSelect = page.locator('.modern-select.billing-select input[type="text"]').first();
    }



    async fillPlanificationForm(data: ConsultationPlanificationData) {
        // Consultant
        await this.caregiverSelect.click();
        await this.page.getByRole('option', { name: data.consultant }).click();

        // Constantes
        await this.heightInput.fill(data.height);
        await this.weightInput.fill(data.weight);
        if (data.weightGain) await this.weightGainInput.fill(data.weightGain);
        await this.temperatureInput.fill(data.temperature);
        await this.tensionInput.fill(data.bloodPressure);
        await this.pulseInput.fill(data.heartRate);
        if (data.pb) await this.pbInput.fill(data.pb);

        // DDR
        if (data.lastPeriodDate) await this.lastPeriodDateInput.fill(data.lastPeriodDate);

        // Désir de grossesse
        const desireLabelMap: Record<string, string> = { oui: 'Oui', non: 'Non', plusTard: 'Plus tard' };
        const desireLabel = desireLabelMap[data.desirePregnancy];
        const desireGroup = this.page.locator('.form-group-modern').filter({ hasText: /Désirez-vous une grossesse/i });
        await desireGroup.locator('.radio-group-modern .radio-label', { hasText: desireLabel }).locator('.radio-circle').click();

        // Utilisation d'une méthode contraceptive
        const usesLabelMap: Record<string, string> = { oui: 'Oui', non: 'Non' };
        const usesLabel = usesLabelMap[data.usesMethod];
        const usesGroup = this.page.locator('.form-group-modern').filter({ hasText: /Utilisez-vous actuellement/i });
        await usesGroup.locator('.radio-group-modern .radio-label', { hasText: usesLabel }).locator('.radio-circle').click();

        // Méthode actuelle (si "oui")
        if (data.usesMethod === 'oui' && data.currentMethods?.length) {
            await expect(this.currentMethodSelect.first()).toBeVisible({ timeout: 5000 });
            for (const method of data.currentMethods) {
                await this.currentMethodSelect.first().click();
                await this.page.getByRole('option', { name: method }).click();
            }
        }

        // Méthode(s) choisie(s)
        for (const method of data.chosenMethods) {
            await this.chosenMethodSelect.click();
            await this.page.getByRole('option', { name: method }).click();
        }

        // Conseils
        if (data.correctUsageExplained) await this.correctUsageCheckbox.check();
        if (data.sideEffectsDiscussed) await this.sideEffectsCheckbox.check();
        if (data.istPreventionDiscussed) await this.istPreventionCheckbox.check();

        // Observations
        if (data.observations) await this.observationsInput.fill(data.observations);

        // Date prochain rendez‑vous
        if (data.nextAppointmentDate) await this.nextAppointmentDateInput.fill(data.nextAppointmentDate);

        // Actes facturables
        for (const act of data.acts) {
            await this.actsSelect.click();
            await this.page.getByRole('option', { name: act }).click();
        }
    }

    // Surcharge pour la modification – activation du formulaire
    async activateForm() {
        const activateButton = this.page.getByRole('button', { name: 'Activer' });
        await expect(activateButton).toBeVisible();
        await activateButton.click();
        // Attendre que le formulaire soit activé (champ observations devient enabled)
        await expect(this.observationsInput).toBeEnabled({ timeout: 10000 });
    }

    // Surcharge pour la modification – mise à jour
    async updateConsultation() {
        const updateButton = this.page.getByRole('button', { name: 'Mettre à jour' });
        await expect(updateButton).toBeVisible();
        await updateButton.click();
        await expect(this.confirmButton).toBeVisible();
        await this.confirmButton.click();
    }

    async fillUpdatedPlanificationForm(data: Partial<ConsultationPlanificationData>) {
        if (data.observations) {
            await this.observationsInput.fill(data.observations);
        }
        if (data.nextAppointmentDate) {
            await this.nextAppointmentDateInput.fill(data.nextAppointmentDate);
        }
        if (data.acts && data.acts.length > 0) {
            for (const act of data.acts) {
                await this.actsSelect.click();
                await this.page.getByRole('option', { name: act }).click();
            }
        }
        if (data.weight) await this.weightInput.fill(data.weight);
        if (data.height) await this.heightInput.fill(data.height);
        if (data.weightGain) await this.weightGainInput.fill(data.weightGain);
        if (data.temperature) await this.temperatureInput.fill(data.temperature);
        if (data.bloodPressure) await this.tensionInput.fill(data.bloodPressure);
        if (data.heartRate) await this.pulseInput.fill(data.heartRate);
        if (data.pb) await this.pbInput.fill(data.pb);
        if (data.lastPeriodDate) await this.lastPeriodDateInput.fill(data.lastPeriodDate);
        if (data.desirePregnancy) {
            const desireLabelMap: Record<string, string> = { oui: 'Oui', non: 'Non', plusTard: 'Plus tard' };
            const desireLabel = desireLabelMap[data.desirePregnancy];
            const desireGroup = this.page.locator('.form-group-modern').filter({ hasText: /Désirez-vous une grossesse/i });
            await desireGroup.locator('.radio-group-modern .radio-label', { hasText: desireLabel }).locator('.radio-circle').click();
        }
        if (data.usesMethod) {
            const usesLabelMap: Record<string, string> = { oui: 'Oui', non: 'Non' };
            const usesLabel = usesLabelMap[data.usesMethod];
            const usesGroup = this.page.locator('.form-group-modern').filter({ hasText: /Utilisez-vous actuellement/i });
            await usesGroup.locator('.radio-group-modern .radio-label', { hasText: usesLabel }).locator('.radio-circle').click();
        }
        if (data.currentMethods && data.currentMethods.length > 0) {
            await expect(this.currentMethodSelect.first()).toBeVisible({ timeout: 5000 });
            for (const method of data.currentMethods) {
                await this.currentMethodSelect.first().click();
                await this.page.getByRole('option', { name: method }).click();
            }
        }
        if (data.chosenMethods && data.chosenMethods.length > 0) {
            for (const method of data.chosenMethods) {
                await this.chosenMethodSelect.click();
                await this.page.getByRole('option', { name: method }).click();
            }
        }
        if (data.correctUsageExplained !== undefined) {
            if (data.correctUsageExplained) await this.correctUsageCheckbox.check();
            else await this.correctUsageCheckbox.uncheck();
        }
        if (data.sideEffectsDiscussed !== undefined) {
            if (data.sideEffectsDiscussed) await this.sideEffectsCheckbox.check();
            else await this.sideEffectsCheckbox.uncheck();
        }
        if (data.istPreventionDiscussed !== undefined) {
            if (data.istPreventionDiscussed) await this.istPreventionCheckbox.check();
            else await this.istPreventionCheckbox.uncheck();
        }
    }
    // Surcharge pour cibler le filtre de type de consultation
    async filterByConsultationType(type: string) {
        const filterSelect = this.page.locator('app-consultations ng-select').first().getByRole('textbox');
        await filterSelect.click();
        await this.page.getByRole('option', { name: type.toUpperCase() }).click();
    }
}