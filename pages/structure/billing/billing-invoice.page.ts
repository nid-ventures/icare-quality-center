// pages/structure/billing/billing-invoice.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page object pour l'assistant de création de facture (`/billing/billings-create`,
 * `BillingInvoiceComponent`), organisé en 3 onglets :
 *   1. "Recherche Patient"  -> sélectionner un patient (clic sur une ligne de résultat,
 *      ce qui bascule automatiquement vers l'onglet "Actes Médicaux").
 *   2. "Actes Médicaux"     -> choisir/saisir un montant sur un acte non facturé du patient,
 *      ce qui fait apparaître le bouton flottant "Procéder à la facturation".
 *   3. "Facturation"        -> sélectionner (facultativement) une prise en charge puis
 *      "Générer la facture".
 *
 * PROBLÈME DE DONNÉES CONNU : un patient fraîchement sélectionné n'a en général aucun acte
 * médical NON FACTURÉ en attente dans l'onglet "Actes Médicaux" (tableau vide -> le bouton
 * "Procéder à la facturation" n'apparaît jamais). Pour fiabiliser le test de bout en bout,
 * cette page ajoute d'abord un acte facturable au patient via la modale "Ajouter un acte"
 * (`AddMedicalActToBillingComponent`) avant de poursuivre le flux à 3 onglets - voir
 * `seedBillableAct()` et `createInvoiceForPatient()`.
 */
export class BillingInvoicePage {
    private readonly page: Page;

    // Onglets
    private readonly rechercheTabButton: Locator;
    private readonly actesTabButton: Locator;
    private readonly facturationTabButton: Locator;

    // Onglet "Recherche Patient"
    private readonly identifiantInput: Locator;
    private readonly naissanceInput: Locator;
    private readonly telephoneInput: Locator;
    private readonly initialiserButton: Locator;
    private readonly rechercherButton: Locator;
    private readonly resultRows: Locator;

    // Onglet "Actes Médicaux"
    private readonly ajouterActeButton: Locator;
    private readonly procederFacturationButton: Locator;

    // Modale "Ajouter un acte" (AddMedicalActToBillingComponent, insérée dynamiquement)
    private readonly addActHeading: Locator;
    private readonly addActCategorySelect: Locator;
    private readonly addActBillableActsSelect: Locator;
    private readonly addActCaregiverSelect: Locator;
    private readonly addActEnregistrerButton: Locator;

    // Modale de confirmation partagée (ModalComponent)
    private readonly confirmerButton: Locator;

    // Onglet "Facturation"
    private readonly assuranceSelect: Locator;
    private readonly genererFactureButton: Locator;

    constructor(page: Page) {
        this.page = page;

        this.rechercheTabButton = page.getByRole('button', { name: /Recherche Patient/ });
        this.actesTabButton = page.getByRole('button', { name: /Actes Médicaux/ });
        // Libellé exact de l'étape : le bouton "Changer de module Facturation" contient aussi "Facturation".
        // Onglet de l'assistant (le libellé peut être suivi d'un compteur d'actes, et l'onglet existe
        // en double pour l'affichage mobile) : on prend le bouton visible.
        this.facturationTabButton = page.locator('button.nav-tab-integrated').filter({ hasText: /^\s*Facturation/ }).filter({ visible: true });

        this.identifiantInput = page.getByPlaceholder('Identifiant patient...');
        this.naissanceInput = page.getByPlaceholder('Date de naissance');
        this.telephoneInput = page.getByPlaceholder('Entrez le numéro');
        this.initialiserButton = page.getByRole('button', { name: /Initialiser/ });
        this.rechercherButton = page.getByRole('button', { name: /Rechercher/ });
        this.resultRows = page.locator('table.table-modern-compact tbody tr.patient-row-compact');

        // Bouton avec attribut title -> ciblage par getByTitle (cf. consigne locators fiables)
        this.ajouterActeButton = page.getByTitle('Ajouter un acte');
        this.procederFacturationButton = page.getByRole('button', { name: /Procéder à la facturation/ });

        this.addActHeading = page.getByRole('heading', { name: 'Nouvel acte à ajouter' });
        this.addActCategorySelect = page.locator('ng-select[formcontrolname="category"]');
        this.addActBillableActsSelect = page.locator('ng-select[formcontrolname="billableActs"]');
        this.addActCaregiverSelect = page.locator('ng-select[formcontrolname="caregiverId"]');
        this.addActEnregistrerButton = page.getByRole('button', { name: 'Enregistrer' });

        this.confirmerButton = page.getByRole('button', { name: 'Confirmer' });

        this.assuranceSelect = page.locator('ng-select#insurance');
        this.genererFactureButton = page.getByRole('button', { name: /Générer la facture/ });
    }

    // ======================== Onglet Recherche Patient ========================

    async searchPatientByIdentifier(identifier: string): Promise<void> {
        await expect(this.rechercheTabButton).toBeVisible();
        await this.identifiantInput.fill(identifier);
        await this.rechercherButton.click();
        // L'appel /patients/getAll peut être lent sur le backend local (jusqu'à plusieurs
        // secondes à froid) : on attend la disparition de l'indicateur de chargement plutôt
        // qu'un délai fixe trop court.
        await this.page.locator('.loading-compact').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => { });
    }

    async getSearchResultsCount(): Promise<number> {
        return this.resultRows.count();
    }

    /** Sélectionne le premier résultat de recherche : bascule automatiquement vers l'onglet "Actes Médicaux". */
    async selectFirstSearchResult(): Promise<void> {
        await this.resultRows.first().click();
        await expect(this.actesTabButton).toHaveClass(/active/, { timeout: 10000 });
    }

    // ======================== Modale "Ajouter un acte" ========================

    /** Sélectionne la première option disponible (non-groupe, non désactivée) d'un ng-select. */
    private async selectFirstNgOption(ngSelect: Locator): Promise<void> {
        await ngSelect.click();
        const panel = this.page.locator('.ng-dropdown-panel:visible');
        await panel.waitFor({ state: 'visible', timeout: 5000 });
        const option = panel.locator('.ng-option:not(.ng-option-disabled):not(.ng-optgroup)').first();
        await option.waitFor({ state: 'visible', timeout: 5000 });
        await option.click();
        await panel.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => { });
    }

    async openAddActModal(): Promise<void> {
        await this.ajouterActeButton.click();
        await expect(this.addActHeading).toBeVisible();
    }

    /**
     * Remplit la modale "Ajouter un acte" en choisissant systématiquement la première option
     * disponible pour la catégorie, l'acte puis le praticien. Les autres champs (date, date de
     * sortie, quantité) ont déjà des valeurs par défaut valides posées par le composant Angular
     * (`AddMedicalActToBillingComponent.ngOnInit`), il n'est donc pas nécessaire d'y toucher.
     */
    async fillAddActFormWithFirstAvailableOptions(): Promise<void> {
        await this.selectFirstNgOption(this.addActCategorySelect);
        await this.selectFirstNgOption(this.addActBillableActsSelect);
        await this.selectFirstNgOption(this.addActCaregiverSelect);
    }

    async submitAddActForm(): Promise<void> {
        await this.addActEnregistrerButton.click();
        // L'appel POST createBillableToInvoices (fermeture de la modale dans son callback subscribe)
        // peut être lent sur le backend local, comme d'autres appels observés dans ce module.
        await expect(this.addActHeading).toBeHidden({ timeout: 30000 });
    }

    /** Ajoute un acte facturable au patient courant (catégorie/acte/praticien = première option disponible). */
    async seedBillableAct(): Promise<void> {
        await this.openAddActModal();
        await this.fillAddActFormWithFirstAvailableOptions();
        await this.submitAddActForm();
    }

    // ======================== Onglet Actes Médicaux ========================

    /**
     * Parcourt les onglets de catégories (`nav-pills`) puis, le cas échéant, les sous-onglets
     * de sous-catégories à la recherche de la première ligne exploitable (typiquement celle
     * qui vient d'être ajoutée via `seedBillableAct`). `app-billing-space-prestation-medical:visible`
     * cible directement l'instance actuellement affichée, quel que soit l'onglet actif (les
     * onglets Bootstrap inactifs ont `display:none`, donc invisibles pour Playwright).
     * Cliquer sur la ligne (hors cellule de saisie) l'active, puis on saisit un montant dans
     * son champ : `onMountInput` active alors automatiquement l'acte pour la facturation.
     */
    async fillFirstAvailableActAmount(amount: string = '5000'): Promise<boolean> {
        const parentTabs = this.page.locator('.modern-tabs ul.nav-pills > li.nav-item > button.nav-link');
        const parentCount = await parentTabs.count();

        for (let i = 0; i < parentCount; i++) {
            await parentTabs.nth(i).click();
            const subTabs = this.page.locator('.tab-pane.show.active .nav-tabs-custom .nav-link');
            const subCount = await subTabs.count();
            const attempts = Math.max(subCount, 1);

            for (let j = 0; j < attempts; j++) {
                if (subCount > 0) {
                    await subTabs.nth(j).click();
                }
                const row = this.page.locator('app-billing-space-prestation-medical:visible tbody tr').first();
                if ((await row.count()) === 0) continue;
                // La ligne "Aucun enregistrement" n'a qu'une seule <td colspan="7">.
                const cellCount = await row.locator('td').count();
                if (cellCount < 2) continue;

                await row.locator('td').nth(1).click();
                const amountInput = row.locator('input[type="text"]');
                await expect(amountInput).toBeEnabled({ timeout: 3000 });
                await amountInput.fill(amount);
                return true;
            }
        }
        return false;
    }

    /** Clique sur "Procéder à la facturation" puis confirme la modale associée. */
    async proceedToBilling(): Promise<void> {
        await expect(this.procederFacturationButton).toBeVisible({ timeout: 10000 });
        await this.procederFacturationButton.click();
        await expect(this.page.getByText(/Confirmez-vous la facturation/i)).toBeVisible();
        await this.confirmerButton.click();
        await expect(this.facturationTabButton).toHaveClass(/active/, { timeout: 15000 });
    }

    // ======================== Onglet Facturation ========================

    /**
     * Sélectionne, si disponible, la première prise en charge de la liste "Prise en charge à
     * appliquer". Purement facultatif (best-effort) : le bouton "Générer la facture" ne dépend
     * que des actes sélectionnés, pas d'une assurance choisie.
     */
    async tryApplyFirstAvailableInsurance(): Promise<void> {
        await this.assuranceSelect.click();
        const panel = this.page.locator('.ng-dropdown-panel:visible');
        const hasPanel = await panel
            .waitFor({ state: 'visible', timeout: 3000 })
            .then(() => true)
            .catch(() => false);
        if (!hasPanel) return;

        const options = panel.locator('.ng-option:not(.ng-option-disabled)');
        if ((await options.count()) > 0) {
            await options.first().click();
        } else {
            await this.page.keyboard.press('Escape');
        }
    }

    async expectGenerateButtonEnabled(): Promise<void> {
        await expect(this.genererFactureButton).toBeEnabled({ timeout: 10000 });
    }

    /** Clique sur "Générer la facture", confirme la modale associée puis attend le retour à la liste des factures patients. */
    async generateInvoice(): Promise<void> {
        await this.expectGenerateButtonEnabled();
        await this.genererFactureButton.click();
        await expect(this.page.getByText(/Voulez-vous facturer/i)).toBeVisible();
        await this.confirmerButton.click();
        await this.page.waitForURL('**/billing/billings-patients', { timeout: 15000 });
    }

    // ======================== Flux complet ========================

    /**
     * Enchaîne l'ensemble du parcours de création de facture pour un patient identifié par
     * `patientIdentifier` : recherche + sélection du patient, ajout d'un acte facturable de
     * test (pour contourner le problème de données connu), saisie de son montant, passage à la
     * facturation, tentative d'application d'une prise en charge puis génération de la facture.
     */
    async createInvoiceForPatient(patientIdentifier: string, amount: string = '5000'): Promise<void> {
        await this.searchPatientByIdentifier(patientIdentifier);
        expect(await this.getSearchResultsCount(), `Aucun patient trouvé pour l'identifiant "${patientIdentifier}"`).toBeGreaterThan(0);
        await this.selectFirstSearchResult();

        await this.seedBillableAct();

        const filled = await this.fillFirstAvailableActAmount(amount);
        expect(filled, "Aucune ligne d'acte facturable exploitable trouvée dans l'onglet Actes Médicaux après l'ajout de l'acte de test.").toBeTruthy();

        await this.proceedToBilling();
        await this.tryApplyFirstAvailableInsurance();
        await this.generateInvoice();
    }
}
