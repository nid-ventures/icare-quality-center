// patient-care.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

export interface CareData {
    insurerName: string;           // ex: 'AMSA ASSURANCE (ASSURANCE)'
    startingDate: string;          // format YYYY-MM-DD
    endingDate: string;            // format YYYY-MM-DD
    insuranceNumber: string;
    cardNumber: string;
    coverageRate: string;          // taux (ex: '25')
    paymentCap: string;            // plafond (ex: '70')
    benefits: Array<{
        locator: string,
        name: string;                // ex: 'SALLE D'ACCOUCHEMENT'
        taux?: string;               // ex: '10'
        montant?: string;            // ex: '4000'
    }>;
}

export class PatientCarePage {
    // Onglet Prise en charge
    private readonly priseEnChargeTab: Locator;
    private readonly addCareLink: Locator;
    private readonly modalHeading: Locator;

    // Champs du formulaire
    private readonly insurerSelect: Locator;
    private readonly startingDateInput: Locator;
    private readonly endingDateInput: Locator;
    private readonly insuranceNumberInput: Locator;
    private readonly cardNumberInput: Locator;
    private readonly coverageRateInput: Locator;
    private readonly paymentCapInput: Locator;

    // Prestations (benefits) - sélecteurs dynamiques
    private readonly benefitsSelect: Locator;      // le ng-select principal pour les prestations

    // Boutons
    private readonly closeButton: Locator;
    private readonly saveButton: Locator;
    private readonly actionButtonFirst: Locator;      // s'il y a une confirmation après enregistrement

    // En-têtes du tableau (vérifications)
    private readonly columnHeaders: { [key: string]: Locator };
    // Sélecteurs pour le modal de modification
    private readonly modifyModalHeading: Locator;
    private readonly modifyInsurerSelect: Locator;   // #minsurerid
    private readonly modifyEndingDateInput: Locator; // #mendingDate
    private readonly modifyButton: Locator;          // bouton "Modifier"

    private readonly viewModalHeading: Locator;
    private readonly viewCloseButton: Locator;



    constructor(private readonly page: Page) {
        // Onglet et bouton d'ajout
        this.priseEnChargeTab = page.getByRole('tab', { name: 'Prise en charge' });
        this.addCareLink = page.getByRole('link', { name: 'Ajouter une prise en charge' });
        this.modalHeading = page.getByRole('heading', { name: 'Ajouter prise en charge' });

        // Champs du formulaire
        this.insurerSelect = page.locator('#insurerId').getByRole('textbox');
        this.startingDateInput = page.locator('#startingDate');
        this.endingDateInput = page.locator('#endingDate');
        this.insuranceNumberInput = page.locator('#insuranceNumber');
        this.cardNumberInput = page.locator('#cardNumber');
        this.coverageRateInput = page.locator('#coverateRate');
        this.paymentCapInput = page.locator('#paymentCap');

        // Prestations (selecteur multiple)
        this.benefitsSelect = page.locator('ng-select.ng-select-multiple').first(); // à ajuster si besoin

        // Boutons
        this.closeButton = page.getByRole('button', { name: 'Fermer' });
        this.saveButton = page.getByRole('button', { name: 'Enregistrer' });

        // En-têtes du tableau pour vérification
        this.columnHeaders = {
            assureur: page.getByRole('columnheader', { name: 'Assureur' }),
            souscripteur: page.getByRole('columnheader', { name: 'Souscripteur' }),
            debutValidite: page.getByRole('columnheader', { name: 'Début validité' }),
            finValidite: page.getByRole('columnheader', { name: 'Fin validité' }),
            numeroAssure: page.getByRole('columnheader', { name: 'Numéro assuré' }),
            numeroCarte: page.getByRole('columnheader', { name: 'Numéro carte' }),
            taux: page.getByRole('columnheader', { name: 'Taux' }),
            plafond: page.getByRole('columnheader', { name: 'Plafond (FCFA)' }),
            actions: page.getByRole('columnheader', { name: 'Actions' }),
        };
        this.modifyModalHeading = page.getByRole('heading', { name: 'Modifier prise en charge' });
        this.modifyInsurerSelect = page.locator('#minsurerid').getByRole('textbox');
        this.modifyEndingDateInput = page.locator('#mendingDate');
        this.modifyButton = page.getByRole('button', { name: 'Modifier' });
        this.viewModalHeading = page.getByRole('heading', { name: 'Voir prise en charge' });
        this.viewCloseButton = page.getByRole('button', { name: 'Fermer' });
        this.actionButtonFirst = page.getByRole('button', { name: 'Action' }).first();

    }

    /**
     * Ouvre l'onglet "Prise en charge"
     */
    async goToCareTab() {
        await this.priseEnChargeTab.click();
        await expect(this.addCareLink).toBeVisible();
        // Vérifier que les en-têtes sont présents (optionnel)
        for (const header of Object.values(this.columnHeaders)) {
            await expect(header).toBeVisible();
        }
    }

    /**
     * Ouvre le modal d'ajout d'une prise en charge
     */
    async openAddCareModal() {
        await this.addCareLink.click();
        await expect(this.modalHeading).toBeVisible();
    }

    /**
     * Remplit le formulaire d'ajout de prise en charge avec des données dynamiques
     * @param data - Les données de la prise en charge
     */
    async fillCareForm(data: CareData) {
        // Sélection de l'assureur
        await this.insurerSelect.click();
        await this.page.getByRole('option', { name: data.insurerName }).click();

        // Dates
        await this.startingDateInput.fill(data.startingDate);
        await this.endingDateInput.fill(data.endingDate);

        // Numéros
        await this.insuranceNumberInput.fill(data.insuranceNumber);
        await this.cardNumberInput.fill(data.cardNumber);

        // Taux et plafond
        await this.coverageRateInput.fill(data.coverageRate);
        await this.paymentCapInput.fill(data.paymentCap);

        // Ajout des prestations (bénéfices) : le catalogue d'actes proposé varie selon le patient/la
        // structure (constaté en pratique), donc on sélectionne dynamiquement les 3 premières options
        // réellement disponibles plutôt que des libellés figés en dur.
        // Angular ng-select ne rend pas de rôle ARIA accessible pour son input interne,
        // d'où l'usage d'un sélecteur CSS stable (formcontrolname) ci-dessous ; on reclique
        // le même ng-select à chaque sélection pour ajouter les valeurs suivantes (multi-select).
        const benefitsMultiSelect = this.page.locator('#formAddPriseEnCharge ng-select[formcontrolname="billableActs"]');
        await benefitsMultiSelect.click();
        const availableOptions = this.page.locator('.ng-dropdown-panel .ng-option:not(.ng-option-disabled)');
        await availableOptions.first().waitFor({ state: 'visible' });
        const optionCount = Math.min(3, await availableOptions.count());
        for (let i = 0; i < optionCount; i++) {
            if (i > 0) await benefitsMultiSelect.click();
            await this.page.locator('.ng-dropdown-panel .ng-option:not(.ng-option-disabled)').first().click();
        }

        // Renseigne taux et plafond pour chaque acte ajouté au tableau, quelle que soit sa ligne exacte.
        const tauxInputs = this.page.locator('#formAddPriseEnCharge #table input[type="number"]');
        const montantInputs = this.page.locator('#formAddPriseEnCharge #table input[type="text"].text-end');
        const rowCount = await tauxInputs.count();
        for (let i = 0; i < rowCount; i++) {
            await tauxInputs.nth(i).fill('10');
            await montantInputs.nth(i).fill('4000');
        }
    }

    /**
     * Sauvegarde la prise en charge et attend la fermeture du modal
     */
    async saveCare() {
        await expect(this.closeButton).toBeVisible();
        await expect(this.saveButton).toBeVisible();
        await this.saveButton.click();
        // L'enregistrement peut prendre plus de temps que le timeout par défaut sous charge.
        await expect(this.modalHeading).toBeHidden({ timeout: 15000 });
    }

    /**
     * Ferme le modal sans sauvegarder
     */
    async closeModal() {
        await this.closeButton.click();
        await expect(this.modalHeading).not.toBeVisible();
    }

    /**
     * Vérifie la présence d'une prise en charge dans le tableau
     * @param insurerName - Nom de l'assureur recherché
     */
    async isCarePresent(insurerName: string): Promise<boolean> {
        const row = this.page.locator(`tbody tr:has-text("${insurerName}")`);
        return await row.isVisible();
    }

    /**
     * Récupère la première ligne du tableau des prises en charge
     */
    async getFirstCareRow(): Promise<Locator> {
        return this.page.locator('tbody tr:first-child');
    }

    /**
     * Supprime la première prise en charge
     */
    async deleteFirstCare() {
        const firstRow = await this.getFirstCareRow();
        const actionButton = firstRow.locator('button:has-text("Action")')
        await actionButton.click();
        await this.page.getByRole('link', { name: 'Supprimer' }).click();
        await this.page.getByRole('button', { name: 'Supprimer' }).click();
        await expect(this.page.getByText('La suppression a réussi avec succès')).toBeVisible();
    }
    /**
 * Modifie la première prise en charge de la liste
 * @param newInsurerName - Nouvel assureur (ex: 'Ascoma Assurance (ASSURANCE)')
 * @param newEndingDate - Nouvelle date de fin (format YYYY-MM-DD)
 */
    async modifyFirstCare(newInsurerName: string, newEndingDate: string) {
        // Cliquer sur le bouton Action de cette ligne
        await this.actionButtonFirst.click();
        // Cliquer sur Modifier
        await this.page.getByRole('link', { name: 'Modifier' }).click();
        // Vérifier que le modal de modification est visible
        await expect(this.modifyModalHeading).toBeVisible();
        // Modifier l'assureur
        await this.modifyInsurerSelect.click();
        await this.page.getByRole('option', { name: newInsurerName }).click();
        // Modifier la date de fin
        await this.modifyEndingDateInput.fill(newEndingDate);
        // Cliquer sur Modifier (bouton de confirmation)
        await this.modifyButton.click();
        // Attendre la fermeture du modal (l'enregistrement peut prendre plus de temps sous charge).
        await expect(this.modifyModalHeading).not.toBeVisible({ timeout: 15000 });

    }
    /**
 * Ouvre les détails de la première prise en charge (Voir les détails)
 */
    async viewFirstCareDetails() {
        const firstRow = await this.getFirstCareRow();
        const actionButton = firstRow.getByRole('button', { name: 'Action' });
        await actionButton.click();
        await this.page.getByRole('link', { name: 'Voir les détails' }).click();
        await expect(this.viewModalHeading).toBeVisible();
    }

    /**
     * Ferme le modal de visualisation
     */
    async closeViewModal() {
        await this.viewCloseButton.click();
        await expect(this.viewModalHeading).not.toBeVisible();
    }
}