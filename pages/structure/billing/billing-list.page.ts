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
}
