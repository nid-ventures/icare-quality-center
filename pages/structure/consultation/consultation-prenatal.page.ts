// tests/pages/structure/consultation/consultation-prenatal.page.ts
import { type Page, type Locator, expect } from '@playwright/test';
import { ConsultationPage } from './consultation.page';
import { ConsultationPrenatalData } from '../generator/consultation-prenatal-data-generator';

export class ConsultationPrenatalPage extends ConsultationPage {
    private prenatalHeading: Locator;
    private previousConsultationsCountInput: Locator;
    private ddrInput: Locator;
    private weightGainInput: Locator;
    private pbInput: Locator;
    private symptomesSelect: Locator;
    private autresSymptomesInput: Locator;
    private mafSelect: Locator;
    private signeParticulierInput: Locator;
    private appearanceInput: Locator;
    private examensCliniquesSelect: Locator;
    private bandeletteTestsSelect: Locator;
    private echoDate1Input: Locator;
    private echoDate2Input: Locator;
    private echoDate3Input: Locator;
    private echoDateLastInput: Locator;
    private echoPoidsBebeInput: Locator;
    private echoBipInput: Locator;
    private echoPerimetreCranienInput: Locator;
    private echoRythmeCardiaqueInput: Locator;
    private echoAutresMesuresInput: Locator;
    private echoPrecisionAnomaliesInput: Locator;
    private traitementsConseilsSelect: Locator;
    private dateNextRdvConsultationInput: Locator;
    private dateNextRdvEchoInput: Locator;
    private termRDVInput: Locator;
    private monitoringEndPregnancyInput: Locator;

    constructor(page: Page) {
        super(page);
        const container = page.locator('.iq-card.consultation-prenatal-modern').first();

        this.prenatalHeading = container.getByRole('heading', { name: /Consultation Prénatale/i });
        this.caregiverSelect = container
            .locator('ng-select[placeholder="Sélectionner un consultant"]')
            .getByRole('textbox')
            .first();
        this.heightInput = container.getByPlaceholder('Taille');
        this.weightInput = container.getByPlaceholder('Poids').first();
        this.weightGainInput = container.getByPlaceholder('Prise de poids');
        this.temperatureInput = container.getByRole('textbox', { name: 'Température' });
        this.tensionInput = container.locator('input[formcontrolname="ta"]').first();
        this.pulseInput = container.getByRole('textbox', { name: 'Fréquence cardiaque' });
        this.pbInput = container.locator('#pb');
        this.ddrInput = container.locator('input[formcontrolname="dateDerniereRegle"]').first();
        this.previousConsultationsCountInput = container.locator(
            'input[formcontrolname="previousConsultationsCount"]'
        );
        this.symptomesSelect = container
            .locator('ng-select[formcontrolname="symptomes"]')
            .locator('input[type="text"]')
            .first();
        this.autresSymptomesInput = container.locator('input[formcontrolname="autresSymptomes"]');
        this.mafSelect = container
            .locator('ng-select[formcontrolname="maf"]')
            .locator('input[type="text"]')
            .first();
        this.signeParticulierInput = container.locator('input[formcontrolname="signeParticulier"]');
        this.appearanceInput = container.locator('input[formcontrolname="appearance"]');
        this.examensCliniquesSelect = container
            .locator('.modern-select.examens-select input[type="text"]')
            .first();
        this.bandeletteTestsSelect = container
            .locator('.modern-select.bandelette-select input[type="text"]')
            .first();
        this.echoDate1Input = container.locator('input[formcontrolname="echoDate1"]');
        this.echoDate2Input = container.locator('input[formcontrolname="echoDate2"]');
        this.echoDate3Input = container.locator('input[formcontrolname="echoDate3"]');
        this.echoDateLastInput = container.locator('input[formcontrolname="echoDateLast"]');
        this.echoPoidsBebeInput = container.locator('input[formcontrolname="echoPoidsBebe"]');
        this.echoBipInput = container.locator('input[formcontrolname="echoBip"]');
        this.echoPerimetreCranienInput = container.locator('input[formcontrolname="echoPerimetreCranien"]');
        this.echoRythmeCardiaqueInput = container.locator('input[formcontrolname="echoRythmeCardiaque"]');
        this.echoAutresMesuresInput = container.locator('input[formcontrolname="echoAutresMesures"]');
        this.echoPrecisionAnomaliesInput = container.locator('input[formcontrolname="echoPrecisionAnomalies"]');
        this.traitementsConseilsSelect = container
            .locator('.modern-select.traitements-select input[type="text"]')
            .first();
        this.dateNextRdvConsultationInput = container.locator('input[formcontrolname="dateNextRdvConsultation"]');
        this.dateNextRdvEchoInput = container.locator('input[formcontrolname="dateNextRdvConsultationEcho"]');
        this.termRDVInput = container.locator('input[formcontrolname="termRDV"]');
        this.monitoringEndPregnancyInput = container.locator('input[formcontrolname="monitoringEndPregnancy"]');
        this.actsSelect = container.locator('.modern-select.billing-select input[type="text"]').first();
    }

    async expectPrenatalFormLoaded() {
        await expect(this.prenatalHeading).toBeVisible({ timeout: 10000 });
        await expect(this.caregiverSelect).toBeVisible({ timeout: 10000 });
    }

    // ********************************************
    // CRÉATION
    // ********************************************
    async fillPrenatalForm(data: ConsultationPrenatalData) {
        // Consultant
        await this.caregiverSelect.click();
        await this.page.getByRole('option', { name: data.consultant }).click();

        // Première consultation (radio)
        const firstConsultGroup = this.page
            .locator('.form-group-modern')
            .filter({ hasText: /Première consultation prénatale/i });
        const firstValue = data.firstConsultation === 'oui' ? 'Oui' : 'Non';
        await firstConsultGroup
            .locator('.radio-label', { hasText: firstValue })
            .locator('.radio-circle')
            .click();

        if (data.firstConsultation === 'non' && data.previousConsultationsCount) {
            await this.previousConsultationsCountInput.fill(data.previousConsultationsCount);
        }

        if (data.dateDerniereRegle) await this.ddrInput.fill(data.dateDerniereRegle);

        // Urgence
        const emergencyGroup = this.page.locator('.form-group-modern').filter({ hasText: /Urgence/i });
        const emergencyValue = data.emergency === 'oui' ? 'Oui' : 'Non';
        await emergencyGroup
            .locator('.radio-label', { hasText: emergencyValue })
            .locator('.radio-circle')
            .click();

        // Constantes
        await this.heightInput.fill(data.height);
        await this.weightInput.fill(data.weight);
        if (data.weightGain) await this.weightGainInput.fill(data.weightGain);
        await this.temperatureInput.fill(data.temperature);
        await this.tensionInput.fill(data.bloodPressure);
        await this.pulseInput.fill(data.heartRate);
        if (data.pb) await this.pbInput.fill(data.pb);

        // Symptômes
        if (data.symptomes?.length) {
            for (const symptome of data.symptomes) {
                await this.symptomesSelect.click();
                await this.page.getByRole('option', { name: symptome }).click();
            }
        }
        if (data.autresSymptomes) {
            const autresInput = this.page.locator('input[formcontrolname="autresSymptomes"]');
            if (await autresInput.isVisible().catch(() => false)) {
                await autresInput.fill(data.autresSymptomes);
            }
        }
        if (data.maf) {
            await this.mafSelect.click();
            await this.page.waitForSelector('.ng-dropdown-panel:visible');
            await this.page.getByRole('option', { name: data.maf }).click();
        }
        if (data.signeParticulier) await this.signeParticulierInput.fill(data.signeParticulier);
        if (data.appearance) await this.appearanceInput.fill(data.appearance);

        // Examens cliniques
        if (data.examensCliniques?.length) {
            for (const examen of data.examensCliniques) {
                await this.examensCliniquesSelect.click();
                await this.page.getByRole('option', { name: examen.label }).click();
                const resultInput = this.page.locator(`input[formcontrolname="${examen.code}"]`);
                if (await resultInput.isVisible()) await resultInput.fill(examen.resultat);
            }
        }

        // Bandelette urinaire
        if (data.bandeletteTests?.length) {
            for (const test of data.bandeletteTests) {
                await this.bandeletteTestsSelect.click();
                await this.page.getByRole('option', { name: test.label }).click();
                const resultInput = this.page.locator(`input[formcontrolname="${test.code}"]`);
                if (await resultInput.isVisible()) await resultInput.fill(test.resultat);
            }
        }

        // Échographie
        if (data.echoDate1) await this.echoDate1Input.fill(data.echoDate1);
        if (data.echoDate2) await this.echoDate2Input.fill(data.echoDate2);
        if (data.echoDate3) await this.echoDate3Input.fill(data.echoDate3);
        if (data.echoDateLast) await this.echoDateLastInput.fill(data.echoDateLast);
        if (data.echoPoidsBebe) await this.echoPoidsBebeInput.fill(data.echoPoidsBebe);
        if (data.echoBip) await this.echoBipInput.fill(data.echoBip);
        if (data.echoPerimetreCranien) await this.echoPerimetreCranienInput.fill(data.echoPerimetreCranien);
        if (data.echoRythmeCardiaque) await this.echoRythmeCardiaqueInput.fill(data.echoRythmeCardiaque);
        if (data.echoAutresMesures) await this.echoAutresMesuresInput.fill(data.echoAutresMesures);

        // Position bébé (radio)
        if (data.echoPositionBebe) {
            const posGroup = this.page.locator('.form-group-modern').filter({ hasText: /Position du bébé/i });
            const posText =
                data.echoPositionBebe === 'tete'
                    ? 'Tête en bas'
                    : data.echoPositionBebe === 'siege'
                        ? 'Siège'
                        : 'Autre';
            await posGroup
                .locator('.radio-label', { hasText: posText })
                .locator('.radio-circle')
                .click();
        }

        // Anomalies (radio)
        if (data.echoAnomalies) {
            const anomGroup = this.page.locator('.form-group-modern').filter({ hasText: /Présence d'anomalies/i });
            const anomValue = data.echoAnomalies === 'oui' ? 'Oui' : 'Non';
            await anomGroup
                .locator('.radio-label', { hasText: anomValue })
                .locator('.radio-circle')
                .click();
            if (data.echoAnomalies === 'oui' && data.echoPrecisionAnomalies) {
                await this.echoPrecisionAnomaliesInput.fill(data.echoPrecisionAnomalies);
            }
        }

        // Traitements et conseils
        if (data.traitementsConseils?.length) {
            for (const traitement of data.traitementsConseils) {
                await this.traitementsConseilsSelect.click();
                await this.page.getByRole('option', { name: traitement }).click();
            }
        }

        // Rendez-vous
        if (data.dateNextRdvConsultation) await this.dateNextRdvConsultationInput.fill(data.dateNextRdvConsultation);
        if (data.dateNextRdvEcho) await this.dateNextRdvEchoInput.fill(data.dateNextRdvEcho);
        if (data.termRDV) await this.termRDVInput.fill(data.termRDV);
        if (data.monitoringEndPregnancy) await this.monitoringEndPregnancyInput.fill(data.monitoringEndPregnancy);

        // Voie d'accouchement validée (radio)
        if (data.childbirthValidatedWay) {
            const childbirthGroup = this.page
                .locator('.form-group-modern')
                .filter({ hasText: /Voie d'accouchement validée/i });
            const childbirthValue = data.childbirthValidatedWay === 'oui' ? 'Oui' : 'Non';
            await childbirthGroup
                .locator('.radio-label', { hasText: childbirthValue })
                .locator('.radio-circle')
                .click();
        }

        // Consultation anesthésie (radio)
        if (data.consultationAnesthesia) {
            const anesthesiaGroup = this.page
                .locator('.form-group-modern')
                .filter({ hasText: /Consultation anesthésie/i });
            const anesthesiaValue = data.consultationAnesthesia === 'oui' ? 'Oui' : 'Non';
            await anesthesiaGroup
                .locator('.radio-label', { hasText: anesthesiaValue })
                .locator('.radio-circle')
                .click();
        }

        // Actes facturables
        for (const act of data.acts) {
            await this.actsSelect.click();
            await this.page.getByRole('option', { name: act }).click();
        }
    }

    // ********************************************
    // MODIFICATION
    // ********************************************
    async activateForm() {
        const activateButton = this.page.getByRole('button', { name: 'Activer' });
        await expect(activateButton).toBeVisible();
        await activateButton.click();
        // Attendre qu'un champ modifiable devienne actif
        await expect(this.monitoringEndPregnancyInput).toBeEnabled({ timeout: 10000 });
    }


    async fillUpdatedPrenatalForm(data: Partial<ConsultationPrenatalData>) {
        if (data.weightGain) await this.weightGainInput.fill(data.weightGain);
        if (data.temperature) await this.temperatureInput.fill(data.temperature);
        if (data.bloodPressure) await this.tensionInput.fill(data.bloodPressure);
        if (data.signeParticulier) await this.signeParticulierInput.fill(data.signeParticulier);
        if (data.monitoringEndPregnancy) await this.monitoringEndPregnancyInput.fill(data.monitoringEndPregnancy);

        // Ajout des nouveaux actes (les anciens restent, ce qui est acceptable pour le test)
        if (data.acts && data.acts.length > 0) {
            for (const act of data.acts) {
                await this.actsSelect.click();
                await this.page.getByRole('option', { name: act }).click();
            }
        }
    }

    async updateConsultation() {
        // Fermer tout dropdown potentiellement ouvert (ex: actes)
        await this.page.keyboard.press('Escape');
        // Attendre que le bouton soit activé
        const updateButton = this.page.getByRole('button', { name: 'Mettre à jour' });
        await expect(updateButton).toBeEnabled({ timeout: 10000 });
        // Forcer le clic pour contourner les overlays
        await updateButton.click({ force: true });
        await expect(this.confirmButton).toBeVisible({ timeout: 10000 });
        await this.confirmButton.click();
    }

    // ********************************************
    // SUPPRESSION
    // ********************************************
    async deleteConsultation() {
        const deleteButton = this.page.getByRole('button', { name: 'Supprimer' });
        await expect(deleteButton).toBeVisible();
        await deleteButton.click();
        await expect(this.page.getByText('Voulez-vous supprimer cette')).toBeVisible();
        await expect(this.confirmButton).toBeVisible();
        await this.confirmButton.click();
    }

    // ********************************************
    // FILTRAGE (évite l'ambiguïté)
    // ********************************************
    async filterByConsultationType(type: string) {
        const filterSelect = this.page.locator('app-consultations ng-select').first().getByRole('textbox');
        await filterSelect.click();
        await this.page.getByRole('option', { name: type.toUpperCase(), exact: true }).click();
    }
}