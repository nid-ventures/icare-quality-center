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

    /** Choisit l'option d'un ng-select dont le libellé correspond (sans tenir compte de la casse). */
    private async selectNgOptionByText(ngSelect: Locator, text: string): Promise<void> {
        await ngSelect.click();
        const input = ngSelect.locator('input[type="text"]');
        // Filtre sur le premier mot : les libellés peuvent contenir des espaces multiples.
        if (await input.isEditable().catch(() => false)) await input.fill(text.trim().split(/\s+/)[0]);
        const panel = this.page.locator('.ng-dropdown-panel:visible');
        const option = panel.locator('.ng-option:not(.ng-option-disabled):not(.ng-optgroup)')
            // Les libellés de l'application contiennent parfois des espaces multiples.
            .filter({ hasText: new RegExp(`^\\s*${text.replace(/\s+/g, ' ').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')}\\s*$`, 'i') }).first();
        await expect(option, `Option "${text}" proposée`).toBeVisible({ timeout: 10000 });
        await option.click();
        await panel.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => { });
    }

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

    // ======================== Actes et prise en charge précis ========================

    /**
     * Ajoute un acte précis au patient courant (premier praticien proposé). Pour une chambre,
     * `days` jours : entrée à 10:00 il y a `days − 1` jours, sortie aujourd'hui à 10:00 (avant 18 h,
     * donc chaque jour calendaire compte), et la quantité calculée doit valoir `days`.
     */
    async addAct(act: { category: string; act: string; days?: number }): Promise<void> {
        await this.openAddActModal();
        await this.selectNgOptionByText(this.addActCategorySelect, act.category);
        await this.selectNgOptionByText(this.addActBillableActsSelect, act.act);
        await this.selectFirstNgOption(this.addActCaregiverSelect);
        if (act.days) {
            await this.setRoomStay(dateTimeLocal(-(act.days - 1), '10:00'), dateTimeLocal(0, '10:00'));
            await expect(this.roomQuantity, `Chambre : ${act.days} jour(s)`).toHaveValue(String(act.days));
        }
        await this.submitAddActForm();
    }

    // ======================== Chambre : séjour ========================

    /** Quantité (nombre de jours) calculée par la fenêtre "Ajouter un acte" pour une chambre. */
    get roomQuantity(): Locator {
        return this.page.locator('#quantity');
    }

    /** Message affiché quand la date de sortie n'est pas après la date d'entrée. */
    get roomStayError(): Locator {
        return this.page.getByText(/date de sortie doit\s+être supérieure à la date\s+d'entrée/i);
    }

    get addActSaveButton(): Locator {
        return this.addActEnregistrerButton;
    }

    /**
     * Ouvre la fenêtre "Ajouter un acte" sur une chambre (catégorie ACTE DE CHAMBRE), praticien
     * choisi : seules les dates restent à saisir.
     */
    async openRoomForm(room = 'CHAMBRE CATÉGORIE 1'): Promise<void> {
        await this.openAddActModal();
        await this.selectNgOptionByText(this.addActCategorySelect, 'ACTE DE CHAMBRE');
        await this.selectNgOptionByText(this.addActBillableActsSelect, room);
        await this.selectFirstNgOption(this.addActCaregiverSelect);
        await expect(this.addActCaregiverSelect.locator('.ng-value'), 'Praticien choisi').toBeVisible();
        await expect(this.page.locator('#endDate'), 'Date de sortie demandée pour une chambre').toBeVisible();
    }

    /** Saisit les dates d'entrée et de sortie ("AAAA-MM-JJTHH:mm") d'un séjour en chambre. */
    async setRoomStay(entry: string, exit: string): Promise<void> {
        await this.page.locator('#date').fill(entry);
        await this.page.locator('#endDate').fill(exit);
        await this.page.locator('#endDate').dispatchEvent('change');
    }

    /**
     * Ligne d'une chambre en attente de facturation (onglet "Actes Médicaux"), retrouvée par son
     * entrée "JJ/MM/AAAA HH:mm" en parcourant les onglets de catégories. Colonnes : case, acte,
     * quantité, consultant, date d'entrée, date de sortie, montant journalier.
     */
    async findPendingRoom(room: string, entry: string): Promise<Locator> {
        const parentTabs = this.page.locator('.modern-tabs ul.nav-pills > li.nav-item > button.nav-link');
        const name = new RegExp(escapeRegExp(room).replace(/\s+/g, '\\s+'), 'i');
        await expect(parentTabs.first(), 'Actes en attente affichés').toBeVisible({ timeout: 15000 });
        for (let i = 0; i < await parentTabs.count(); i++) {
            await parentTabs.nth(i).click();
            const subTabs = this.page.locator('.tab-pane.show.active .nav-tabs-custom .nav-link');
            const subCount = await subTabs.count();
            for (let j = 0; j < Math.max(subCount, 1); j++) {
                if (subCount > 0) await subTabs.nth(j).click();
                const row = this.page.locator('app-billing-space-prestation-medical:visible tbody tr')
                    .filter({ hasText: name }).filter({ hasText: entry });
                if (await row.count() > 0) return row.first();
            }
        }
        throw new Error(`Chambre "${room}" entrée le ${entry} introuvable dans l'onglet Actes Médicaux`);
    }

    /** Actes proposés pour une catégorie dans "Ajouter un acte" (fenêtre refermée sans enregistrer). */
    async proposedActs(category: string): Promise<string[]> {
        await this.openAddActModal();
        await this.selectNgOptionByText(this.addActCategorySelect, category);
        await this.addActBillableActsSelect.click();
        const options = this.page.locator('.ng-dropdown-panel:visible .ng-option:not(.ng-optgroup):not(.ng-option-disabled)');
        await options.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
        const names = (await options.allTextContents()).map(s => s.replace(/\s+/g, ' ').trim()).filter(n => n && !/No items found/i.test(n));
        await this.page.keyboard.press('Escape');
        await this.closeAddActModal();
        return names;
    }

    /** Ferme la fenêtre "Ajouter un acte" sans enregistrer. */
    async closeAddActModal(): Promise<void> {
        await this.page.locator('.ama-footer').getByRole('button', { name: 'Fermer' }).click();
        await expect(this.addActHeading).toBeHidden();
    }

    /**
     * Affiche, dans l'onglet "Actes Médicaux", la ligne à facturer d'un acte (première dont le
     * montant n'est pas saisi, sauf `anyRow`) en parcourant les onglets de catégories ; null si absente.
     */
    async showPendingAct(act: string, anyRow = false): Promise<Locator | null> {
        const parentTabs = this.page.locator('.modern-tabs ul.nav-pills > li.nav-item > button.nav-link');
        const name = new RegExp(escapeRegExp(act).replace(/\s+/g, '\\s+'), 'i');
        if (!await parentTabs.first().isVisible().catch(() => false)) return null;
        for (let i = 0; i < await parentTabs.count(); i++) {
            await parentTabs.nth(i).click();
            const subTabs = this.page.locator('.tab-pane.show.active .nav-tabs-custom .nav-link');
            const subCount = await subTabs.count();
            for (let j = 0; j < Math.max(subCount, 1); j++) {
                if (subCount > 0) await subTabs.nth(j).click();
                const rows = this.page.locator('app-billing-space-prestation-medical:visible tbody tr').filter({ hasText: name });
                for (let k = 0; k < await rows.count(); k++) {
                    if (anyRow || (await rows.nth(k).locator('input[type="text"]').inputValue()) === '') return rows.nth(k);
                }
            }
        }
        return null;
    }

    /**
     * Saisit le montant (journalier pour une chambre) d'un acte non encore saisi, en parcourant les
     * onglets de catégories : la saisie coche l'acte pour la facturation.
     */
    async setActAmount(act: string, amount: number): Promise<void> {
        const row = await this.showPendingAct(act);
        if (!row) throw new Error(`Acte "${act}" à facturer introuvable (ou déjà saisi) dans l'onglet Actes Médicaux`);
        const input = row.locator('input[type="text"]');
        await row.locator('td').nth(1).click();
        await expect(input).toBeEnabled({ timeout: 3000 });
        await input.fill(String(amount));
    }

    /** Compteurs de l'en-tête patient : actes à facturer et actes dans la facture en cours. */
    async counters(): Promise<{ toBill: number; inInvoice: number }> {
        const read = async (selector: string) => Number(((await this.page.locator(selector).first().innerText()).match(/\d+/) ?? ['0'])[0]);
        return {
            toBill: await read('.patient-badge-header.notification-global'),
            inInvoice: await read('.patient-badge-header.notification-global-invoice'),
        };
    }

    get proceedButton(): Locator {
        return this.procederFacturationButton;
    }

    /** Étape Facturation : ligne d'un acte de la facture en cours (avec sa case à cocher). */
    invoiceLine(act: string): Locator {
        return this.page.locator('app-billing-space-facturation-item ul')
            .filter({ has: this.page.locator('input[type="checkbox"]') })
            .filter({ hasText: new RegExp(escapeRegExp(act).replace(/\s+/g, '\\s+'), 'i') });
    }

    /** Étape Facturation : retire les actes indiqués de la facture en cours (case + "Retirer"). */
    async removeFromInvoice(acts: string[]): Promise<void> {
        for (const act of acts) await this.invoiceLine(act).first().locator('input[type="checkbox"]').check();
        await this.page.getByRole('button', { name: 'Retirer' }).click();
        await expect(this.page.getByText(/voulez-vous retirer/i)).toBeVisible();
        await this.confirmerButton.click();
        await expect(this.page.getByText(/retrait.*r[ée]ussi/i).first()).toBeVisible({ timeout: 15000 });
    }

    /** Étape Facturation : bouton d'affichage d'une liste d'exceptions de la prise en charge. */
    exceptionsButton(list: 'Actes Exclus' | 'Cas Spécifiques'): Locator {
        return this.page.getByRole('button', { name: new RegExp(`^\\W*${list}\\s*$`) });
    }

    /** Étape Facturation : tableau "Liste des actes exclus" ou "Liste des cas spécifiques". */
    exceptionsTable(list: 'actes exclus' | 'cas spécifiques'): Locator {
        return this.page.locator('div').filter({ has: this.page.getByRole('heading', { name: new RegExp(`Liste des ${list}`, 'i') }) }).locator('table').last();
    }

    /** Étape Facturation : retire la prise en charge choisie (croix du sélecteur). */
    async clearCover(): Promise<void> {
        await this.assuranceSelect.locator('.ng-clear-wrapper').click();
        await expect(this.assuranceSelect.locator('.ng-value')).toHaveCount(0);
    }

    /** Onglet "Facturation" de l'assistant (facture en cours). */
    async openInvoiceTab(): Promise<void> {
        await this.facturationTabButton.click();
        await expect(this.facturationTabButton).toHaveClass(/active/, { timeout: 10000 });
    }

    /** Onglet "Actes Médicaux" de l'assistant (actes à facturer). */
    async openActsTab(): Promise<void> {
        await this.actesTabButton.first().click();
        await expect(this.actesTabButton.first()).toHaveClass(/active/, { timeout: 10000 });
    }

    /** Étape Facturation : choisit la prise en charge de l'assureur indiqué. */
    async chooseCover(insurer: string): Promise<void> {
        await this.assuranceSelect.click();
        const option = this.page.locator('.ng-dropdown-panel:visible .ng-option').filter({ hasText: insurer }).first();
        await expect(option, `Prise en charge "${insurer}" proposée`).toBeVisible({ timeout: 10000 });
        await option.click();
    }

    /** Étape Facturation : taux, plafond et quote-parts affichés (montants convertis en nombres). */
    async coverSummary(): Promise<{ rate: number; cap: number; garant: number; patient: number }> {
        const read = async (id: string) => Number(((await this.page.locator(`#${id}`).inputValue()) || '0').replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
        return { rate: await read('rate'), cap: await read('coverateMount'), garant: await read('mountGarant'), patient: await read('mountPatient') };
    }

    // ======================== Flux complet ========================

    /**
     * Enchaîne l'ensemble du parcours de création de facture pour un patient identifié par
     * `patientIdentifier` : recherche + sélection du patient, ajout d'un acte facturable de
     * test (pour contourner le problème de données connu), saisie de son montant, passage à la
     * facturation, tentative d'application d'une prise en charge puis génération de la facture.
     */
    /**
     * Facture au patient (recherché par identifiant) l'acte par défaut (première catégorie,
     * premier acte) réalisé par le praticien indiqué, puis génère la facture.
     */
    async createInvoiceForPractitioner(
        patientIdentifier: string,
        practitioner: string,
        act?: { category: string; act: string },
        amount: string = '5000',
    ): Promise<void> {
        await this.searchPatientByIdentifier(patientIdentifier);
        expect(await this.getSearchResultsCount()).toBeGreaterThan(0);
        await this.selectFirstSearchResult();

        await this.openAddActModal();
        if (act) {
            await this.selectNgOptionByText(this.addActCategorySelect, act.category);
            await this.selectNgOptionByText(this.addActBillableActsSelect, act.act);
        } else {
            await this.selectFirstNgOption(this.addActCategorySelect);
            await this.selectFirstNgOption(this.addActBillableActsSelect);
        }
        await this.addActCaregiverSelect.click();
        const panel = this.page.locator('.ng-dropdown-panel:visible');
        const option = panel.locator('.ng-option:not(.ng-option-disabled)')
            .filter({ hasText: new RegExp(practitioner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
        await expect(option, `Praticien "${practitioner}" proposé`).toBeVisible({ timeout: 10000 });
        await option.click();
        await this.submitAddActForm();

        expect(await this.fillFirstAvailableActAmount(amount)).toBeTruthy();
        await this.proceedToBilling();
        await this.tryApplyFirstAvailableInsurance();
        await this.generateInvoice();
    }

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

/** Date-heure locale "AAAA-MM-JJTHH:mm" à `offsetDays` jours d'aujourd'hui (champ datetime-local). */
export function dateTimeLocal(offsetDays: number, time: string): string {
    const d = new Date(Date.now() + offsetDays * 86400000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${time}`;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
