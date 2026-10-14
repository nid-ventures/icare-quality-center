// pages/structure/billing/billing-list.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

export interface BillingRowData {
    invoiceOrder: string;
    nomPatient: string;
    prenomPatient: string;
    identifiantPatient: string;
    dateNaissance: string;
    telephone: string;
    facturePar: string;
    montant: string;
    dateFacturation: string;
}

export interface BillingGarantRowData extends BillingRowData {
    garant: string;
}

/**
 * Convertit une date affichée "dd/MM/yyyy" (éventuellement suivie d'une heure) en "yyyy-MM-dd"
 * pour pouvoir remplir un <input type="date"> (même logique que PatientPage.definitionChamps).
 */
function toIsoDate(displayDate: string): string {
    const [day, month, yearPart] = displayDate.trim().split('/');
    const year = yearPart.split(' ')[0];
    return `${year}-${month}-${day}`;
}

/** Formate un numéro de téléphone affiché dans le tableau pour le champ de recherche international. */
function toSearchPhone(phone: string): string {
    let formatted = phone.split('/')[0].replace(/\s/g, '');
    if (!formatted.startsWith('+')) {
        formatted = `+221${formatted.replace(/^221/, '')}`;
    }
    return formatted;
}

/** Page des factures patients (`/billing/billings-patients`). */
export class BillingListPatientPage {
    protected readonly page: Page;

    // Champs de recherche (ciblés par attribut formcontrolname, absents de rôle/label accessible dédié)
    protected readonly invoiceOrderInput: Locator;
    protected readonly nomPatientInput: Locator;
    protected readonly prenomPatientInput: Locator;
    protected readonly identifiantPatientInput: Locator;
    protected readonly dateNaissanceInput: Locator;
    protected readonly facturantInput: Locator;
    protected readonly dateDebutInput: Locator;
    protected readonly dateFinInput: Locator;
    protected readonly telephoneInput: Locator;
    protected readonly reinitialiserButton: Locator;
    protected readonly rechercherButton: Locator;

    // Liste / tableau
    protected readonly listHeading: Locator;
    protected readonly rows: Locator;
    protected readonly firstRow: Locator;
    protected readonly columnheaderNFacture: Locator;
    protected readonly columnheaderNomPatient: Locator;
    protected readonly columnheaderPrenomPatient: Locator;
    protected readonly columnheaderIdentifiantPatient: Locator;
    protected readonly columnheaderDateNaissance: Locator;
    protected readonly columnheaderTelephone: Locator;
    protected readonly columnheaderFacturePar: Locator;
    protected readonly columnheaderMontant: Locator;
    protected readonly columnheaderDateFacturation: Locator;
    protected readonly columnheaderActions: Locator;

    // Modale de détail (#detail_invoice)
    protected readonly detailModal: Locator;
    protected readonly detailFermerButton: Locator;

    // Modale de confirmation partagée (ModalComponent : "voulez-vous supprimer cette facture ?")
    protected readonly confirmerButton: Locator;

    constructor(page: Page) {
        this.page = page;

        this.invoiceOrderInput = page.locator('input[formcontrolname="invoiceOrder"]');
        this.nomPatientInput = page.locator('input[formcontrolname="firstName"]');
        this.prenomPatientInput = page.locator('input[formcontrolname="lastName"]');
        this.identifiantPatientInput = page.locator('input[formcontrolname="patientIdentifier"]');
        this.dateNaissanceInput = page.locator('input[formcontrolname="dob"]');
        this.facturantInput = page.locator('input[formcontrolname="billedBy"]');
        this.dateDebutInput = page.locator('input[formcontrolname="dateStart"]');
        this.dateFinInput = page.locator('input[formcontrolname="dateEnd"]');
        this.telephoneInput = page.locator('form.search-form').getByPlaceholder('Entrez le numéro');
        this.reinitialiserButton = page.getByRole('button', { name: /Réinitialiser/ });
        this.rechercherButton = page.getByRole('button', { name: /Rechercher/ });

        this.listHeading = page.getByRole('heading', { name: /Liste des factures patients/ });
        this.rows = page.locator('table.compact-table tbody tr.table-row');
        this.firstRow = this.rows.first();
        this.columnheaderNFacture = page.getByRole('columnheader', { name: 'N°Facture' });
        this.columnheaderNomPatient = page.getByRole('columnheader', { name: 'Nom Patient', exact: true });
        this.columnheaderPrenomPatient = page.getByRole('columnheader', { name: 'Prénom Patient' });
        this.columnheaderIdentifiantPatient = page.getByRole('columnheader', { name: 'Identifiant Patient' });
        this.columnheaderDateNaissance = page.getByRole('columnheader', { name: 'Date de naissance' });
        this.columnheaderTelephone = page.getByRole('columnheader', { name: 'Téléphone' });
        this.columnheaderFacturePar = page.getByRole('columnheader', { name: 'Facturé Par' });
        this.columnheaderMontant = page.getByRole('columnheader', { name: 'Montant (F CFA)' });
        this.columnheaderDateFacturation = page.getByRole('columnheader', { name: 'Date de facturation' });
        this.columnheaderActions = page.getByRole('columnheader', { name: 'Actions' });

        this.detailModal = page.locator('#detail_invoice');
        this.detailFermerButton = this.detailModal.getByRole('button', { name: /Fermer/ });

        this.confirmerButton = page.getByRole('button', { name: 'Confirmer' });
    }

    async expectListLoaded(): Promise<void> {
        await expect(this.listHeading).toBeVisible();
        await expect(this.columnheaderNFacture).toBeVisible();
        await expect(this.columnheaderNomPatient).toBeVisible();
        await expect(this.columnheaderPrenomPatient).toBeVisible();
        await expect(this.columnheaderIdentifiantPatient).toBeVisible();
        await expect(this.columnheaderDateNaissance).toBeVisible();
        await expect(this.columnheaderTelephone).toBeVisible();
        await expect(this.columnheaderFacturePar).toBeVisible();
        await expect(this.columnheaderMontant).toBeVisible();
        await expect(this.columnheaderDateFacturation).toBeVisible();
        await expect(this.columnheaderActions).toBeVisible();
        await expect(this.reinitialiserButton).toBeVisible();
        await expect(this.rechercherButton).toBeVisible();
        await this.waitForSearchSettled();
    }

    // L'appel de chargement (forkJoin sur plusieurs sources, dont potentiellement
    // /invoices/getAll) peut être lent sur le backend local : on attend la disparition du
    // spinner du bouton "Rechercher" plutôt qu'un délai fixe trop court avant de lire les lignes.
    protected async waitForSearchSettled(): Promise<void> {
        await this.rechercherButton.locator('.spinner-border').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => { });
    }

    async getRowCount(): Promise<number> {
        return this.rows.count();
    }

    protected async getCellText(row: Locator, index: number): Promise<string> {
        return ((await row.locator(`td:nth-child(${index})`).innerText()) ?? '').trim();
    }

    async getFirstRowData(): Promise<BillingRowData> {
        const row = this.firstRow;
        return {
            invoiceOrder: await this.getCellText(row, 1),
            nomPatient: await this.getCellText(row, 2),
            prenomPatient: await this.getCellText(row, 3),
            identifiantPatient: await this.getCellText(row, 4),
            dateNaissance: await this.getCellText(row, 5),
            telephone: await this.getCellText(row, 6),
            facturePar: await this.getCellText(row, 7),
            montant: await this.getCellText(row, 8),
            dateFacturation: await this.getCellText(row, 9),
        };
    }

    async reset(): Promise<void> {
        await this.reinitialiserButton.click();
        await this.waitForSearchSettled();
    }

    async search(): Promise<void> {
        await this.rechercherButton.click();
        await this.waitForSearchSettled();
    }

    async fillIdentifiantPatient(value: string): Promise<void> {
        await this.identifiantPatientInput.fill(value);
    }

    async expectInvoiceVisible(invoiceOrder: string): Promise<void> {
        await expect(
            this.page.locator(`table.compact-table tbody tr td:first-child:has-text("${invoiceOrder}")`)
        ).toBeVisible({ timeout: 5000 });
    }

    async expectInvoiceNotVisible(invoiceOrder: string): Promise<void> {
        await expect(
            this.page.locator(`table.compact-table tbody tr td:first-child:has-text("${invoiceOrder}")`)
        ).toHaveCount(0, { timeout: 5000 });
    }

    /**
     * Recherche individuellement sur chaque champ du formulaire (un par un), en utilisant les
     * valeurs d'une facture de référence (même approche que PatientPage.definitionChamps) :
     * pour chaque champ renseigné, on réinitialise le formulaire, on remplit UNIQUEMENT ce
     * champ, on lance la recherche puis on vérifie que la facture de référence est retrouvée.
     */
    async searchByEachField(reference: BillingRowData): Promise<void> {
        const fields: { name: string; fill: () => Promise<void> }[] = [];

        if (reference.invoiceOrder && reference.invoiceOrder !== '-') {
            fields.push({ name: 'N°Facture', fill: () => this.invoiceOrderInput.fill(reference.invoiceOrder) });
        }
        if (reference.nomPatient && reference.nomPatient !== '-') {
            fields.push({ name: 'Nom Patient', fill: () => this.nomPatientInput.fill(reference.nomPatient) });
        }
        if (reference.prenomPatient && reference.prenomPatient !== '-') {
            fields.push({ name: 'Prénom Patient', fill: () => this.prenomPatientInput.fill(reference.prenomPatient) });
        }
        if (reference.identifiantPatient && reference.identifiantPatient !== '-') {
            fields.push({ name: 'Identifiant Patient', fill: () => this.identifiantPatientInput.fill(reference.identifiantPatient) });
        }
        if (reference.facturePar && reference.facturePar !== '-') {
            fields.push({ name: 'Facturant', fill: () => this.facturantInput.fill(reference.facturePar) });
        }
        if (reference.dateNaissance && reference.dateNaissance !== '-') {
            fields.push({ name: 'Date de naissance', fill: () => this.dateNaissanceInput.fill(toIsoDate(reference.dateNaissance)) });
        }
        if (reference.dateFacturation && reference.dateFacturation !== '-') {
            fields.push({
                name: 'Date de début / Date de fin',
                fill: async () => {
                    const iso = toIsoDate(reference.dateFacturation);
                    await this.dateDebutInput.fill(iso);
                    await this.dateFinInput.fill(iso);
                },
            });
        }
        if (reference.telephone && reference.telephone !== '-') {
            fields.push({ name: 'Téléphone', fill: () => this.telephoneInput.fill(toSearchPhone(reference.telephone)) });
        }

        for (const field of fields) {
            await this.reset();
            await field.fill();
            await this.search();
            await this.expectInvoiceVisible(reference.invoiceOrder);
        }
    }

    // ---------- Actions sur une ligne ----------

    async openDetailModal(row: Locator = this.firstRow): Promise<void> {
        await row.getByTitle('Voir le détail').click();
        await expect(this.detailModal).toBeVisible();
    }

    getDetailModal(): Locator {
        return this.detailModal;
    }

    async closeDetailModal(): Promise<void> {
        await this.detailFermerButton.click();
        await expect(this.detailModal).toBeHidden();
    }

    async expectPrintButtonVisible(row: Locator = this.firstRow): Promise<void> {
        await expect(row.getByTitle('Imprimer')).toBeVisible();
    }

    /**
     * Supprime une ligne de facture. En cas de succès, le composant Angular fait un
     * `window.location.reload()` complet : on attend donc le rechargement de la page puis la
     * réapparition de l'en-tête de la liste avant de continuer.
     */
    async deleteRow(row: Locator = this.firstRow): Promise<void> {
        await row.getByTitle('Supprimer').click();
        await expect(this.page.getByText(/voulez-vous supprimer cette facture/i)).toBeVisible();
        await Promise.all([
            this.page.waitForEvent('load', { timeout: 20000 }).catch(() => { }),
            this.confirmerButton.click(),
        ]);
        await expect(this.listHeading).toBeVisible({ timeout: 15000 });
    }

    /** Ouvre le détail de la facture N° `order` (liste déjà affichée), le lit puis le referme. */
    async detailOf(order: string): Promise<InvoiceDetail> {
        const row = this.rows.filter({ has: this.page.locator('td:nth-child(1)', { hasText: new RegExp(`^\\s*${order}\\s*$`) }) }).first();
        await this.openDetailModal(row);
        const detail = await readInvoiceDetail(this.detailModal);
        await this.closeDetailModal();
        return detail;
    }

    /** Ligne de la facture N° `order` dans la liste affichée. */
    rowOf(order: string): Locator {
        return this.rows.filter({ has: this.page.locator('td:nth-child(1)', { hasText: new RegExp(`^\\s*${order}\\s*$`) }) });
    }

    /** Supprime la facture N° `order` (confirmation comprise). */
    async deleteInvoice(order: string): Promise<void> {
        await this.deleteRow(this.rowOf(order).first());
    }

    /**
     * Imprime la facture N° `order` sans ouvrir la boîte d'impression du système : l'impression
     * passe par un cadre caché dont on intercepte window.print, et renvoie le texte imprimé.
     */
    async printOf(order: string): Promise<string> {
        await interceptPrint(this.page);
        await this.rowOf(order).first().getByTitle('Imprimer').click();
        await expect.poll(() => this.page.evaluate(() => (window as any).__qaPrinted ?? ''), { message: 'Contenu imprimé', timeout: 15000 }).not.toBe('');
        return this.page.evaluate(() => (window as any).__qaPrinted as string);
    }

    /** Toutes les factures du patient (N° et montant), sur la plus grande page de la liste. */
    async invoicesOf(patientIdentifier: string): Promise<InvoiceSummary[]> {
        await this.identifiantPatientInput.fill(patientIdentifier);
        return readInvoices(this.page, this.rechercherButton, this.rows, 8);
    }

    /** N° de la première facture de la liste, sans critère. */
    async firstOrder(): Promise<string> {
        await this.rechercherButton.click();
        await this.page.locator('.loading-compact, .loader').first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => { });
        await expect(this.rows.first(), 'Au moins une facture patient').toBeVisible({ timeout: 30000 });
        return (await this.rows.first().locator('td:nth-child(1)').innerText()).trim();
    }

    /** HTML de la dernière impression interceptée (styles compris : police, couleur). */
    async lastPrintedHtml(): Promise<string> {
        return this.page.evaluate(() => (window as any).__qaPrintedHtml ?? '');
    }
}

/** Page des factures garants (`/billing/billings-garants`). */
export class BillingListGarantPage {
    protected readonly page: Page;

    protected readonly invoiceOrderInput: Locator;
    protected readonly nomPatientInput: Locator;
    protected readonly prenomPatientInput: Locator;
    protected readonly identifiantPatientInput: Locator;
    protected readonly dateNaissanceInput: Locator;
    protected readonly facturantInput: Locator;
    protected readonly dateDebutInput: Locator;
    protected readonly dateFinInput: Locator;
    protected readonly telephoneInput: Locator;
    protected readonly garantSelect: Locator;
    protected readonly reinitialiserButton: Locator;
    protected readonly rechercherButton: Locator;

    protected readonly listHeading: Locator;
    protected readonly rows: Locator;
    protected readonly firstRow: Locator;
    protected readonly columnheaderNFacture: Locator;
    protected readonly columnheaderGarant: Locator;
    protected readonly columnheaderNomPatient: Locator;
    protected readonly columnheaderPrenomPatient: Locator;
    protected readonly columnheaderIdentifiantPatient: Locator;
    protected readonly columnheaderDateNaissance: Locator;
    protected readonly columnheaderTelephone: Locator;
    protected readonly columnheaderFacturePar: Locator;
    protected readonly columnheaderMontant: Locator;
    protected readonly columnheaderDateFacturation: Locator;
    protected readonly columnheaderActions: Locator;

    // Modale de détail (#detail_invoice_garant)
    protected readonly detailModal: Locator;
    protected readonly detailFermerButton: Locator;

    protected readonly confirmerButton: Locator;

    constructor(page: Page) {
        this.page = page;

        this.invoiceOrderInput = page.locator('input[formcontrolname="invoiceOrder"]');
        this.nomPatientInput = page.locator('input[formcontrolname="firstName"]');
        this.prenomPatientInput = page.locator('input[formcontrolname="lastName"]');
        this.identifiantPatientInput = page.locator('input[formcontrolname="patientIdentifier"]');
        this.dateNaissanceInput = page.locator('input[formcontrolname="dob"]');
        this.facturantInput = page.locator('input[formcontrolname="billedBy"]');
        this.dateDebutInput = page.locator('input[formcontrolname="dateStart"]');
        this.dateFinInput = page.locator('input[formcontrolname="dateEnd"]');
        this.telephoneInput = page.locator('form.search-form').getByPlaceholder('Entrez le numéro');
        this.garantSelect = page.locator('ng-select[formcontrolname="garant"]');
        this.reinitialiserButton = page.getByRole('button', { name: /Réinitialiser/ });
        this.rechercherButton = page.getByRole('button', { name: /Rechercher/ });

        this.listHeading = page.getByRole('heading', { name: /Liste des factures garants/ });
        this.rows = page.locator('table.compact-table tbody tr.table-row');
        this.firstRow = this.rows.first();
        this.columnheaderNFacture = page.getByRole('columnheader', { name: 'N°Facture' });
        this.columnheaderGarant = page.getByRole('columnheader', { name: 'Garant' });
        this.columnheaderNomPatient = page.getByRole('columnheader', { name: 'Nom Patient', exact: true });
        this.columnheaderPrenomPatient = page.getByRole('columnheader', { name: 'Prénom Patient' });
        this.columnheaderIdentifiantPatient = page.getByRole('columnheader', { name: 'Identifiant Patient' });
        this.columnheaderDateNaissance = page.getByRole('columnheader', { name: 'Date de naissance' });
        this.columnheaderTelephone = page.getByRole('columnheader', { name: 'Téléphone' });
        this.columnheaderFacturePar = page.getByRole('columnheader', { name: 'Facturé Par' });
        this.columnheaderMontant = page.getByRole('columnheader', { name: 'Montant (F CFA)' });
        this.columnheaderDateFacturation = page.getByRole('columnheader', { name: 'Date de facturation' });
        this.columnheaderActions = page.getByRole('columnheader', { name: 'Actions' });

        this.detailModal = page.locator('#detail_invoice_garant');
        this.detailFermerButton = this.detailModal.getByRole('button', { name: /Fermer/ });

        this.confirmerButton = page.getByRole('button', { name: 'Confirmer' });
    }

    async expectListLoaded(): Promise<void> {
        await expect(this.listHeading).toBeVisible();
        await expect(this.columnheaderNFacture).toBeVisible();
        await expect(this.columnheaderGarant).toBeVisible();
        await expect(this.columnheaderNomPatient).toBeVisible();
        await expect(this.columnheaderPrenomPatient).toBeVisible();
        await expect(this.columnheaderIdentifiantPatient).toBeVisible();
        await expect(this.columnheaderDateNaissance).toBeVisible();
        await expect(this.columnheaderTelephone).toBeVisible();
        await expect(this.columnheaderFacturePar).toBeVisible();
        await expect(this.columnheaderMontant).toBeVisible();
        await expect(this.columnheaderDateFacturation).toBeVisible();
        await expect(this.columnheaderActions).toBeVisible();
        await expect(this.reinitialiserButton).toBeVisible();
        await expect(this.rechercherButton).toBeVisible();
        await this.waitForSearchSettled();
    }

    protected async waitForSearchSettled(): Promise<void> {
        await this.rechercherButton.locator('.spinner-border').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => { });
    }

    async getRowCount(): Promise<number> {
        return this.rows.count();
    }

    protected async getCellText(row: Locator, index: number): Promise<string> {
        return ((await row.locator(`td:nth-child(${index})`).innerText()) ?? '').trim();
    }

    async getFirstRowData(): Promise<BillingGarantRowData> {
        const row = this.firstRow;
        return {
            invoiceOrder: await this.getCellText(row, 1),
            garant: await this.getCellText(row, 2),
            nomPatient: await this.getCellText(row, 3),
            prenomPatient: await this.getCellText(row, 4),
            identifiantPatient: await this.getCellText(row, 5),
            dateNaissance: await this.getCellText(row, 6),
            telephone: await this.getCellText(row, 7),
            facturePar: await this.getCellText(row, 8),
            montant: await this.getCellText(row, 9),
            dateFacturation: await this.getCellText(row, 10),
        };
    }

    async reset(): Promise<void> {
        await this.reinitialiserButton.click();
        await this.waitForSearchSettled();
    }

    async search(): Promise<void> {
        await this.rechercherButton.click();
        await this.waitForSearchSettled();
    }

    async expectInvoiceVisible(invoiceOrder: string): Promise<void> {
        await expect(
            this.page.locator(`table.compact-table tbody tr td:first-child:has-text("${invoiceOrder}")`)
        ).toBeVisible({ timeout: 5000 });
    }

    async expectInvoiceNotVisible(invoiceOrder: string): Promise<void> {
        await expect(
            this.page.locator(`table.compact-table tbody tr td:first-child:has-text("${invoiceOrder}")`)
        ).toHaveCount(0, { timeout: 5000 });
    }

    /** Sélectionne une option du ng-select "Garant" en cherchant le texte normalisé exact (cf. ConsultationPage.selectAndVerify). */
    async selectGarant(optionText: string): Promise<void> {
        await this.garantSelect.click();
        const panel = this.page.locator('.ng-dropdown-panel:visible');
        await panel.waitFor({ state: 'visible', timeout: 5000 });
        const options = panel.locator('.ng-option');
        const normalizedValue = optionText.replace(/\s+/g, ' ').trim().toLowerCase();
        const count = await options.count();
        for (let i = 0; i < count; i++) {
            const text = (await options.nth(i).textContent())?.replace(/\s+/g, ' ').trim().toLowerCase();
            if (text === normalizedValue) {
                await options.nth(i).click();
                return;
            }
        }
        throw new Error(`Garant "${optionText}" introuvable dans la liste déroulante.`);
    }

    /**
     * Recherche individuellement sur chaque champ du formulaire (un par un), en utilisant les
     * valeurs d'une facture de référence (même approche que PatientPage.definitionChamps).
     */
    async searchByEachField(reference: BillingGarantRowData): Promise<void> {
        const fields: { name: string; fill: () => Promise<void> }[] = [];

        if (reference.invoiceOrder && reference.invoiceOrder !== '-') {
            fields.push({ name: 'N°Facture', fill: () => this.invoiceOrderInput.fill(reference.invoiceOrder) });
        }
        if (reference.garant && reference.garant !== '-') {
            fields.push({ name: 'Garant', fill: () => this.selectGarant(reference.garant) });
        }
        if (reference.nomPatient && reference.nomPatient !== '-') {
            fields.push({ name: 'Nom Patient', fill: () => this.nomPatientInput.fill(reference.nomPatient) });
        }
        if (reference.prenomPatient && reference.prenomPatient !== '-') {
            fields.push({ name: 'Prénom Patient', fill: () => this.prenomPatientInput.fill(reference.prenomPatient) });
        }
        if (reference.identifiantPatient && reference.identifiantPatient !== '-') {
            fields.push({ name: 'Identifiant Patient', fill: () => this.identifiantPatientInput.fill(reference.identifiantPatient) });
        }
        if (reference.facturePar && reference.facturePar !== '-') {
            fields.push({ name: 'Facturant', fill: () => this.facturantInput.fill(reference.facturePar) });
        }
        if (reference.dateNaissance && reference.dateNaissance !== '-') {
            fields.push({ name: 'Date de naissance', fill: () => this.dateNaissanceInput.fill(toIsoDate(reference.dateNaissance)) });
        }
        if (reference.dateFacturation && reference.dateFacturation !== '-') {
            fields.push({
                name: 'Date de début / Date de fin',
                fill: async () => {
                    const iso = toIsoDate(reference.dateFacturation);
                    await this.dateDebutInput.fill(iso);
                    await this.dateFinInput.fill(iso);
                },
            });
        }
        if (reference.telephone && reference.telephone !== '-') {
            fields.push({ name: 'Téléphone', fill: () => this.telephoneInput.fill(toSearchPhone(reference.telephone)) });
        }

        for (const field of fields) {
            await this.reset();
            await field.fill();
            await this.search();
            await this.expectInvoiceVisible(reference.invoiceOrder);
        }
    }

    // ---------- Actions sur une ligne ----------

    async openDetailModal(row: Locator = this.firstRow): Promise<void> {
        await row.getByTitle('Voir le détail').click();
        await expect(this.detailModal).toBeVisible();
    }

    getDetailModal(): Locator {
        return this.detailModal;
    }

    async closeDetailModal(): Promise<void> {
        await this.detailFermerButton.click();
        await expect(this.detailModal).toBeHidden();
    }

    async expectPrintButtonVisible(row: Locator = this.firstRow): Promise<void> {
        await expect(row.getByTitle('Imprimer')).toBeVisible();
    }

    /**
     * Supprime une ligne de facture. En cas de succès, le composant Angular fait un
     * `window.location.reload()` complet : on attend donc le rechargement de la page puis la
     * réapparition de l'en-tête de la liste avant de continuer.
     */
    async deleteRow(row: Locator = this.firstRow): Promise<void> {
        await row.getByTitle('Supprimer').click();
        await expect(this.page.getByText(/voulez-vous supprimer cette facture/i)).toBeVisible();
        await Promise.all([
            this.page.waitForEvent('load', { timeout: 20000 }).catch(() => { }),
            this.confirmerButton.click(),
        ]);
        await expect(this.listHeading).toBeVisible({ timeout: 15000 });
    }

    /** Ouvre le détail de la facture N° `order` (liste déjà affichée), le lit puis le referme. */
    async detailOf(order: string): Promise<InvoiceDetail> {
        const row = this.rows.filter({ has: this.page.locator('td:nth-child(1)', { hasText: new RegExp(`^\\s*${order}\\s*$`) }) }).first();
        await this.openDetailModal(row);
        const detail = await readInvoiceDetail(this.detailModal);
        await this.closeDetailModal();
        return detail;
    }

    /** Ligne de la facture N° `order` dans la liste affichée. */
    rowOf(order: string): Locator {
        return this.rows.filter({ has: this.page.locator('td:nth-child(1)', { hasText: new RegExp(`^\\s*${order}\\s*$`) }) });
    }

    /** Supprime la facture N° `order` (confirmation comprise). */
    async deleteInvoice(order: string): Promise<void> {
        await this.deleteRow(this.rowOf(order).first());
    }

    /**
     * Imprime la facture N° `order` sans ouvrir la boîte d'impression du système : l'impression
     * passe par un cadre caché dont on intercepte window.print, et renvoie le texte imprimé.
     */
    async printOf(order: string): Promise<string> {
        await interceptPrint(this.page);
        await this.rowOf(order).first().getByTitle('Imprimer').click();
        await expect.poll(() => this.page.evaluate(() => (window as any).__qaPrinted ?? ''), { message: 'Contenu imprimé', timeout: 15000 }).not.toBe('');
        return this.page.evaluate(() => (window as any).__qaPrinted as string);
    }

    /** Toutes les factures du patient (N° et montant), sur la plus grande page de la liste. */
    async invoicesOf(patientIdentifier: string): Promise<InvoiceSummary[]> {
        await this.identifiantPatientInput.fill(patientIdentifier);
        return readInvoices(this.page, this.rechercherButton, this.rows, 9);
    }
}

export type InvoiceSummary = { order: string; amount: number };

/** Lance la recherche, affiche la plus grande page puis lit N° (colonne 1) et montant (colonne amountColumn). */
async function readInvoices(page: Page, searchButton: Locator, rows: Locator, amountColumn: number): Promise<InvoiceSummary[]> {
    await searchButton.click();
    await page.locator('.loading-compact, .loader').first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => { });
    const size = page.locator('ng-select.compact-select').first();
    if (await size.isVisible().catch(() => false)) {
        await size.click();
        await page.locator('.ng-dropdown-panel .ng-option').last().click();
        await page.waitForTimeout(1500);
    }
    const result: InvoiceSummary[] = [];
    for (const row of await rows.all()) {
        const order = (await row.locator('td:nth-child(1)').innerText()).trim();
        const amount = Number((await row.locator(`td:nth-child(${amountColumn})`).innerText()).replace(/[^\d]/g, '')) || 0;
        result.push({ order, amount });
    }
    return result;
}

/** Ligne d'acte du détail d'une facture (montants en F CFA). */
export type InvoiceDetailLine = { act: string; quantity: number; unit: number; amount: number; cap: number; rate: number; net: number };

/** Détail d'une facture : montants du résumé (0 si absents) et une ligne par acte. */
export type InvoiceDetail = { text: string; total: number; rate: number; patient: number; garant: number; cap: number; lines: InvoiceDetailLine[] };

const toNumber = (value: string) => Number(value.replace(/[^\d]/g, '')) || 0;

async function readInvoiceDetail(modal: Locator): Promise<InvoiceDetail> {
    await expect(modal.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });
    const text = (await modal.innerText()).replace(/\s+/g, ' ');
    // Montant qui suit le libell\u00e9 (s\u00e9parateurs de milliers : espace, espace ins\u00e9cable, virgule, point)
    const amountAfter = (label: string) => toNumber(text.match(new RegExp(`${label}\\s*:?\\s*([\\d\\s.,\\u202f\\u00a0]+)`))?.[1] ?? '');
    const lines: InvoiceDetailLine[] = [];
    for (const row of await modal.locator('table tbody tr').all()) {
        const cells = (await row.locator('td').allInnerTexts()).map(c => c.trim());
        if (cells.length !== 8) continue;
        lines.push({ act: cells[0], quantity: toNumber(cells[2]), unit: toNumber(cells[3]), amount: toNumber(cells[4]), cap: toNumber(cells[5]), rate: toNumber(cells[6]), net: toNumber(cells[7]) });
    }
    return {
        text,
        total: amountAfter('Total Facture'),
        rate: amountAfter('Taux garant'),
        patient: amountAfter('Reste à payer par le patient') || amountAfter('Quote-part du patient'),
        garant: amountAfter('Reste à payer par le garant'),
        cap: amountAfter('Plafond global garant'),
        lines,
    };
}

/**
 * Remplace window.print des cadres d'impression ajoutés à la page : le texte qui aurait été imprimé
 * est gardé dans window.__qaPrinted (la boîte d'impression bloquerait le test).
 */
async function interceptPrint(page: Page): Promise<void> {
    await page.evaluate(() => {
        const w = window as any;
        w.__qaPrinted = '';
        if (w.__qaPrintIntercepted) return;
        w.__qaPrintIntercepted = true;
        const append = Node.prototype.appendChild;
        Node.prototype.appendChild = function <T extends Node>(this: Node, child: T): T {
            const result = append.call(this, child) as T;
            if (child instanceof HTMLIFrameElement && child.contentWindow) {
                const frame = child.contentWindow as any;
                frame.print = () => {
                    w.__qaPrintedHtml = frame.document.documentElement?.outerHTML ?? '';
                    w.__qaPrinted = frame.document.body?.innerText ?? '';
                };
            }
            return result;
        };
    });
}
