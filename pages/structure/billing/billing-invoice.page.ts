// pages/structure/billing/billing-invoice.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page "Nouvelle facture" (`/billing/billings-create`) : la facture tient sur une seule page.
 *   1. Recherche du patient (identifiant, prénom, nom…) puis clic sur sa ligne.
 *   2. Panier (`app-billing-cart`) : actes non facturés du patient, une ligne par acte, cochée dès
 *      qu'un prix est saisi ; à droite, le récapitulatif (prise en charge, part garant, net patient)
 *      et "Valider et émettre la facture" (confirmation, puis liste des factures du patient).
 *   "Ajouter un acte" ouvre la fenêtre "Ajouter des actes" : praticien et date communs, actes
 *   choisis par catégorie / recherche, chambres avec entrée, sortie et nombre de jours.
 * Les anciennes étapes "Actes Médicaux" puis "Facturation" n'existent plus : les méthodes qui les
 * représentaient (proceedToBilling, openInvoiceTab…) sont gardées sans effet pour les specs.
 */
export class BillingInvoicePage {
    private readonly page: Page;

    // Recherche du patient
    private readonly identifiantInput: Locator;
    private readonly rechercherButton: Locator;
    private readonly resultRows: Locator;

    // Panier
    readonly cart: Locator;
    private readonly lines: Locator;
    private readonly preview: Locator;
    private readonly coverSelect: Locator;
    readonly generateButton: Locator;

    // Fenêtre "Ajouter des actes"
    readonly addActModal: Locator;
    private readonly addActHeading: Locator;
    private readonly addActCaregiverSelect: Locator;
    private readonly addActSearch: Locator;
    private readonly addActSubmit: Locator;

    // Fenêtre de confirmation partagée (ModalComponent)
    private readonly confirmerButton: Locator;

    constructor(page: Page) {
        this.page = page;

        this.identifiantInput = page.getByPlaceholder('Identifiant patient…');
        this.rechercherButton = page.locator('.search-form').getByRole('button', { name: /Rechercher/ });
        this.resultRows = page.locator('table.patients-table tbody tr');

        this.cart = page.locator('app-billing-cart');
        this.lines = this.cart.locator('.acts-row.act');
        this.preview = this.cart.locator('aside.invoice-preview');
        this.coverSelect = this.preview.locator('ng-select');
        this.generateButton = this.preview.getByRole('button', { name: /Valider et émettre la facture/ });

        this.addActModal = page.locator('.ama-card');
        this.addActHeading = this.addActModal.getByRole('heading', { name: 'Ajouter des actes' });
        this.addActCaregiverSelect = this.addActModal.locator('.ama-row ng-select').first();
        this.addActSearch = this.addActModal.getByRole('textbox', { name: 'Rechercher un acte' });
        this.addActSubmit = this.addActModal.locator('.ama-footer').getByRole('button', { name: /^\W*Ajouter/ });

        this.confirmerButton = page.getByRole('button', { name: 'Confirmer' });
    }

    // ======================== Recherche du patient ========================

    async searchPatientByIdentifier(identifier: string): Promise<void> {
        // "Changer de patient" quand un patient est déjà choisi (le panier masque alors la recherche)
        const change = this.page.getByRole('button', { name: /Changer de patient/ });
        if (await change.isVisible().catch(() => false)) await change.click();
        await this.identifiantInput.fill(identifier);
        const searched = this.page.waitForResponse(r => r.url().includes('/patients/getAll') && r.request().method() === 'POST', { timeout: 30000 }).catch(() => null);
        await this.rechercherButton.click();
        await searched;
        await this.page.getByText('Recherche en cours…').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => { });
    }

    async getSearchResultsCount(): Promise<number> {
        return this.resultRows.count();
    }

    /** Choisit le premier patient trouvé : le panier de ses actes à facturer s'affiche. */
    async selectFirstSearchResult(): Promise<void> {
        await this.resultRows.first().click();
        await expect(this.cart, 'Panier du patient affiché').toBeVisible({ timeout: 15000 });
        await this.waitCartLoaded();
    }

    /** Attend la fin du chargement des actes du panier. */
    private async waitCartLoaded(): Promise<void> {
        await expect(this.cart.getByText('Chargement des actes…'), 'Actes du patient chargés').toBeHidden({ timeout: 30000 });
    }

    // ======================== Fenêtre "Ajouter des actes" ========================

    async openAddActModal(): Promise<void> {
        await this.page.locator('.patient-card').getByRole('button', { name: /Ajouter un acte/ }).click();
        await expect(this.addActHeading).toBeVisible();
    }

    /** Ferme la fenêtre "Ajouter des actes" sans enregistrer. */
    async closeAddActModal(): Promise<void> {
        await this.addActModal.locator('.ama-footer').getByRole('button', { name: 'Fermer' }).click();
        await expect(this.addActHeading).toBeHidden();
    }

    /** Praticien commun : celui demandé, sinon le premier proposé s'il n'y en a pas déjà un. */
    private async chooseCaregiver(practitioner?: string): Promise<void> {
        if (!practitioner && await this.addActCaregiverSelect.locator('.ng-value').count() > 0) return;
        await this.addActCaregiverSelect.locator('.ng-select-container').click();
        const options = this.page.locator('.ng-dropdown-panel:visible .ng-option:not(.ng-option-disabled)');
        const option = practitioner ? options.filter({ hasText: new RegExp(escapeRegExp(practitioner), 'i') }).first() : options.first();
        await expect(option, practitioner ? `Praticien "${practitioner}" proposé` : 'Un praticien proposé').toBeVisible({ timeout: 10000 });
        await option.click();
    }

    /** Pastille d'une catégorie ("ACTE DE CHAMBRE" → "Acte de chambre 3"). */
    private categoryPill(category: string): Locator {
        return this.addActModal.locator('.ama-cats .ama-cat').filter({ hasText: new RegExp(`^\\s*${pattern(category)}\\s*\\d*\\s*$`, 'i') });
    }

    /**
     * Bouton d'un acte proposé. Le libellé peut porter ou non le préfixe de domaine ("Consultation
     * cardiologique" / "Cardiologique") : les deux formes sont acceptées.
     */
    private actButton(act: string): Locator {
        const rest = act.replace(/^\s*(consultation|visite)\s+/i, '');
        return this.addActModal.locator('.ama-acts .ama-act')
            .filter({ hasText: new RegExp(`^\\s*((consultation|visite)\\s+)?${pattern(rest)}\\s*$`, 'i') });
    }

    /** Choisit un acte (catégorie puis recherche sur son nom, la liste d'une catégorie est limitée). */
    private async pickAct(category: string, act: string): Promise<void> {
        const pill = this.categoryPill(category);
        await expect(pill, `Catégorie "${category}" proposée`).toHaveCount(1);
        if (!(await pill.getAttribute('class'))?.includes('active')) await pill.click();
        await this.addActSearch.fill(act.replace(/^\s*(consultation|visite)\s+/i, '').replace(/\s+/g, ' ').trim());
        const button = this.actButton(act).first();
        await expect(button, `Acte "${act}" proposé`).toBeVisible({ timeout: 10000 });
        await button.click();
        await this.addActSearch.fill('');
    }

    /** "Ajouter" : l'acte est enregistré pour le patient (il arrive coché dans le panier) et la fenêtre se ferme. */
    async submitAddActForm(): Promise<void> {
        const saved = this.page.waitForResponse(r => r.url().includes('/billableacts') && r.request().method() === 'POST', { timeout: 30000 });
        await this.addActSubmit.click();
        const res = await saved;
        expect(res.status(), 'Ajout des actes : réponse du serveur').toBeLessThan(400);
        await expect(this.addActHeading).toBeHidden({ timeout: 30000 });
        await this.waitCartLoaded();
    }

    /** Ajoute au patient courant le premier acte de la première catégorie (premier praticien). */
    async seedBillableAct(): Promise<void> {
        await this.openAddActModal();
        await this.chooseCaregiver();
        await this.addActModal.locator('.ama-cats .ama-cat').first().click();
        await this.addActModal.locator('.ama-acts .ama-act').first().click();
        await this.submitAddActForm();
    }

    /**
     * Ajoute un acte précis au patient courant (premier praticien proposé). Pour une chambre,
     * `days` jours : entrée à 10:00 il y a `days − 1` jours, sortie aujourd'hui à 10:00 (avant 18 h,
     * donc chaque jour calendaire compte), et le nombre de jours calculé doit valoir `days`.
     */
    async addAct(act: { category: string; act: string; days?: number }, practitioner?: string): Promise<void> {
        await this.openAddActModal();
        await this.chooseCaregiver(practitioner);
        await this.pickAct(act.category, act.act);
        if (act.days) {
            await this.setRoomStay(dateTimeLocal(-(act.days - 1), '10:00'), dateTimeLocal(0, '10:00'));
            await expect(this.roomQuantity, `Chambre : ${act.days} jour(s)`).toHaveValue(String(act.days));
        }
        await this.submitAddActForm();
    }

    /** Actes proposés pour une catégorie dans "Ajouter des actes" (fenêtre refermée sans enregistrer). */
    async proposedActs(category: string): Promise<string[]> {
        await this.openAddActModal();
        const pill = this.categoryPill(category);
        // Catégorie absente (ses actes sont tous désactivés, par exemple) : aucun acte proposé
        if (await pill.count() === 0) {
            await this.closeAddActModal();
            return [];
        }
        await pill.click();
        const buttons = this.addActModal.locator('.ama-acts .ama-act');
        await buttons.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => { });
        const names = (await buttons.allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
        await this.closeAddActModal();
        return names;
    }

    // ======================== Chambre : séjour ========================

    /** Ligne de la chambre choisie dans la fenêtre (entrée, sortie, jours). */
    private get roomBlock(): Locator {
        return this.addActModal.locator('.ama-room').first();
    }

    /** Nombre de jours calculé par la fenêtre pour une chambre. */
    get roomQuantity(): Locator {
        return this.roomBlock.locator('.ama-qty input');
    }

    /** Message affiché quand la sortie n'est pas après l'entrée. */
    get roomStayError(): Locator {
        return this.addActModal.getByText(/La sortie doit être après l'entrée/i);
    }

    get addActSaveButton(): Locator {
        return this.addActSubmit;
    }

    /** Ouvre "Ajouter des actes" avec une chambre choisie (praticien choisi) : seules les dates restent à saisir. */
    async openRoomForm(room = 'CHAMBRE CATÉGORIE 1'): Promise<void> {
        await this.openAddActModal();
        await this.chooseCaregiver();
        await this.pickAct('ACTE DE CHAMBRE', room);
        await expect(this.roomBlock, 'Entrée et sortie demandées pour une chambre').toBeVisible();
    }

    /** Saisit l'entrée et la sortie ("AAAA-MM-JJTHH:mm") du séjour en chambre. */
    async setRoomStay(entry: string, exit: string): Promise<void> {
        const [entryInput, exitInput] = [this.roomBlock.locator('input[type="datetime-local"]').nth(0), this.roomBlock.locator('input[type="datetime-local"]').nth(1)];
        await entryInput.fill(entry);
        await entryInput.dispatchEvent('change');
        await exitInput.fill(exit);
        await exitInput.dispatchEvent('change');
    }

    /** Ligne d'une chambre à facturer, retrouvée par son entrée affichée "JJ/MM/AA HH:mm". */
    async findPendingRoom(room: string, entry: string): Promise<Locator> {
        await this.showAllPeriod();
        const row = this.lineOf(room).filter({ has: this.page.locator('.stay', { hasText: entry }) });
        await expect(row.first(), `Chambre "${room}" entrée le ${entry} à facturer`).toBeVisible({ timeout: 15000 });
        return row.first();
    }

    // ======================== Panier : actes à facturer ========================

    /** Période "Tous" : les actes plus anciens que la semaine restent visibles. */
    private async showAllPeriod(): Promise<void> {
        const all = this.cart.locator('.period-switch').getByRole('button', { name: /^Tous/ });
        if (await all.isVisible().catch(() => false) && !(await all.getAttribute('class'))?.includes('active')) await all.click();
    }

    /** Lignes du panier d'un acte (nom affiché, sans tenir compte de la casse ni des espaces). */
    lineOf(act: string): Locator {
        return this.lines.filter({ has: this.page.locator('.col-name .name', { hasText: new RegExp(`^\\s*${pattern(act)}\\s*$`, 'i') }) });
    }

    /** Champ "Prix unitaire" d'une ligne du panier. */
    priceInput(line: Locator): Locator {
        return line.locator('.col-price input');
    }

    /** Une ligne du panier est-elle cochée ? */
    async isSelected(line: Locator): Promise<boolean> {
        return (await line.getAttribute('class'))?.includes('selected') ?? false;
    }

    /**
     * Ligne à facturer d'un acte : la première dont le prix n'est pas saisi (sauf `anyRow`), en
     * préférant une ligne déjà cochée (acte qu'on vient d'ajouter) ; null si l'acte n'est pas dans le panier.
     */
    async showPendingAct(act: string, anyRow = false): Promise<Locator | null> {
        if (!await this.cart.isVisible().catch(() => false)) return null;
        await this.waitCartLoaded();
        await this.showAllPeriod();
        const rows = this.lineOf(act);
        if (anyRow) return await rows.count() > 0 ? rows.first() : null;
        for (const selectedFirst of [true, false]) {
            for (let i = 0; i < await rows.count(); i++) {
                const row = rows.nth(i);
                if ((await this.priceInput(row).inputValue()) === '' && (!selectedFirst || await this.isSelected(row))) return row;
            }
        }
        return null;
    }

    /**
     * Ligne cochée d'un acte dont le prix est celui repris automatiquement (dernier prix saisi sur ce
     * poste, égal à l'indication du champ) : un acte qu'on vient d'ajouter arrive ainsi chiffré.
     */
    private async autoPricedLine(act: string): Promise<Locator | null> {
        const rows = this.lineOf(act);
        for (let i = 0; i < await rows.count(); i++) {
            const row = rows.nth(i);
            const input = this.priceInput(row);
            const value = (await input.inputValue()).replace(/\s/g, '');
            const hint = ((await input.getAttribute('placeholder')) ?? '').replace(/\s/g, '');
            if (await this.isSelected(row) && value !== '' && value === hint) return row;
        }
        return null;
    }

    /** Saisit le prix unitaire (journalier pour une chambre) d'un acte non encore chiffré : la ligne se coche. */
    async setActAmount(act: string, amount: number): Promise<void> {
        const row = await this.showPendingAct(act) ?? await this.autoPricedLine(act);
        if (!row) throw new Error(`Acte "${act}" à facturer introuvable (ou déjà chiffré) dans le panier`);
        await this.priceInput(row).fill(String(amount));
        await expect.poll(() => this.isSelected(row), { message: `"${act}" coché par la saisie du prix` }).toBe(true);
    }

    /**
     * Saisit le prix d'une ligne non chiffrée (true si une ligne a été trouvée) : d'abord une ligne
     * déjà cochée (un acte qu'on vient d'ajouter arrive coché d'office), sinon la première venue.
     */
    async fillFirstAvailableActAmount(amount: string = '5000'): Promise<boolean> {
        await this.waitCartLoaded();
        await this.showAllPeriod();
        for (const selectedFirst of [true, false]) {
            for (let i = 0; i < await this.lines.count(); i++) {
                const line = this.lines.nth(i);
                const input = this.priceInput(line);
                if ((await input.inputValue()) === '' && (!selectedFirst || await this.isSelected(line))) {
                    await input.fill(amount);
                    return true;
                }
            }
        }
        return false;
    }

    /** Coche ou décoche une ligne (clic sur la ligne, hors du prix). */
    async toggleLine(line: Locator): Promise<void> {
        await line.locator('.col-date').click();
    }

    /** Actes du panier (toBill) et actes cochés pour la facture (inInvoice). */
    async counters(): Promise<{ toBill: number; inInvoice: number }> {
        await this.waitCartLoaded();
        const toBill = await this.lines.count();
        let inInvoice = 0;
        for (let i = 0; i < toBill; i++) if (await this.isSelected(this.lines.nth(i))) inInvoice++;
        return { toBill, inInvoice };
    }

    /** Ligne d'un acte coché dans le récapitulatif de la facture. */
    invoiceLine(act: string): Locator {
        return this.preview.locator('.preview-line').filter({ has: this.page.locator('.pl-name', { hasText: new RegExp(`^\\s*${pattern(act)}\\s*$`, 'i') }) });
    }

    /** Décoche les actes indiqués : ils sortent de la facture (et restent à facturer). */
    async removeFromInvoice(acts: string[]): Promise<void> {
        for (const act of acts) {
            const line = this.lineOf(act).first();
            if (await this.isSelected(line)) await this.toggleLine(line);
            await expect(this.invoiceLine(act), `"${act}" retiré de la facture`).toHaveCount(0);
        }
    }

    /** Étiquette d'une ligne du panier ("Exclu", "30 % · plafond 6 000 F", "En attente"…). */
    lineTag(act: string, text: RegExp | string): Locator {
        return this.lineOf(act).first().locator('.tag').filter({ hasText: text });
    }

    // ======================== Prise en charge et émission ========================

    /** Choisit la prise en charge de l'assureur indiqué (aucune n'est choisie par défaut). */
    async chooseCover(insurer: string): Promise<void> {
        await this.coverSelect.locator('.ng-select-container').click();
        const option = this.page.locator('.ng-dropdown-panel:visible .ng-option').filter({ hasText: insurer }).first();
        await expect(option, `Prise en charge "${insurer}" proposée`).toBeVisible({ timeout: 10000 });
        await option.click();
    }

    /** Choisit, s'il y en a une, la première prise en charge proposée. */
    async tryApplyFirstAvailableInsurance(): Promise<void> {
        if (!await this.coverSelect.isVisible().catch(() => false)) return;
        await this.coverSelect.locator('.ng-select-container').click();
        const option = this.page.locator('.ng-dropdown-panel:visible .ng-option:not(.ng-option-disabled)').first();
        if (await option.isVisible().catch(() => false)) await option.click();
        else await this.page.keyboard.press('Escape');
    }

    /** Retire la prise en charge choisie (croix du sélecteur) : le patient règle la totalité. */
    async clearCover(): Promise<void> {
        await this.coverSelect.locator('.ng-clear-wrapper').click();
        await expect(this.coverSelect.locator('.ng-value')).toHaveCount(0);
    }

    /** Taux et plafond de la prise en charge choisie, part garant et net patient (montants en nombres). */
    async coverSummary(): Promise<{ rate: number; cap: number; garant: number; patient: number }> {
        // Sans prise en charge le bloc "Taux / Plafond" n'existe pas : ne pas attendre un élément absent
        const metaBlock = this.preview.locator('.cover-meta').first();
        const meta = (await metaBlock.count() > 0 ? await metaBlock.innerText() : '').replace(/\s+/g, ' ');
        const after = (label: string) => toNumber(meta.match(new RegExp(`${label}\\s*([\\d\\s\\u202f\\u00a0.,]+)`))?.[1] ?? '');
        const value = async (label: string) => {
            const input = this.preview.getByLabel(label);
            return await input.isVisible().catch(() => false) ? toNumber(await input.inputValue()) : 0;
        };
        const covered = await this.coverSelect.locator('.ng-value').count() > 0;
        return {
            rate: covered ? after('Taux') : 0,
            cap: covered ? after('Plafond') : 0,
            garant: await value('Part prise en charge'),
            patient: await value('Net à payer patient'),
        };
    }

    /** Sans objet depuis la facture en une page : les actes chiffrés sont déjà cochés. */
    async proceedToBilling(): Promise<void> {
        await expect(this.preview.locator('.preview-line').first(), 'Au moins un acte dans la facture').toBeVisible({ timeout: 10000 });
    }

    /** Sans objet depuis la facture en une page (plus d'onglet "Facturation"). */
    async openInvoiceTab(): Promise<void> {
        await expect(this.cart).toBeVisible();
    }

    /** Sans objet depuis la facture en une page (plus d'onglet "Actes Médicaux"). */
    async openActsTab(): Promise<void> {
        await expect(this.cart).toBeVisible();
    }

    async expectGenerateButtonEnabled(): Promise<void> {
        await expect(this.generateButton).toBeEnabled({ timeout: 10000 });
    }

    /** "Valider et émettre la facture", confirmation, puis liste des factures du patient. */
    async generateInvoice(): Promise<void> {
        await this.expectGenerateButtonEnabled();
        await this.generateButton.click();
        await expect(this.page.getByText(/Émettre la facture pour ces actes/i)).toBeVisible();
        const created = this.page.waitForResponse(r => /\/invoices$/.test(r.url().split('?')[0]) && r.request().method() === 'POST', { timeout: 60000 });
        await this.confirmerButton.click();
        const res = await created;
        expect(res.status(), 'Émission de la facture : réponse du serveur').toBeLessThan(400);
        await this.page.waitForURL('**/billing/billings-patients**', { timeout: 30000 });
    }

    // ======================== Flux complets ========================

    /**
     * Facture au patient (recherché par identifiant) un acte réalisé par le praticien indiqué :
     * l'acte demandé, sinon le premier acte de la première catégorie, au montant donné.
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
        if (act) {
            await this.addAct(act, practitioner);
            // Montant saisi sur SA ligne (le patient peut avoir d'autres actes à facturer)
            await this.setActAmount(act.act, Number(amount));
        } else {
            await this.openAddActModal();
            await this.chooseCaregiver(practitioner);
            await this.addActModal.locator('.ama-cats .ama-cat').first().click();
            await this.addActModal.locator('.ama-acts .ama-act').first().click();
            await this.submitAddActForm();
            expect(await this.fillFirstAvailableActAmount(amount)).toBeTruthy();
        }
        await this.generateInvoice();
    }

    async createInvoiceForPatient(patientIdentifier: string, amount: string = '5000'): Promise<void> {
        await this.searchPatientByIdentifier(patientIdentifier);
        expect(await this.getSearchResultsCount(), `Aucun patient trouvé pour l'identifiant "${patientIdentifier}"`).toBeGreaterThan(0);
        await this.selectFirstSearchResult();
        await this.seedBillableAct();
        const filled = await this.fillFirstAvailableActAmount(amount);
        expect(filled, "Aucune ligne d'acte à chiffrer dans le panier après l'ajout de l'acte de test").toBeTruthy();
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

/** Libellé en expression : casse ignorée par l'appelant, espaces multiples tolérés. */
function pattern(label: string): string {
    return escapeRegExp(label.replace(/\s+/g, ' ').trim()).replace(/ /g, '\\s+');
}

/** "12 000", "12 000,00" ou "80 %" → nombre (séparateurs de milliers ignorés, virgule décimale). */
function toNumber(value: string): number {
    const cleaned = value.replace(/[\s  ]/g, '').replace(/[^\d,.-]/g, '').replace(',', '.');
    return Number(cleaned) || 0;
}
