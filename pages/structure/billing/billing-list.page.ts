// pages/structure/billing/billing-list.page.ts
import { type Page, type Locator, expect, test } from '@playwright/test';

export interface BillingRowData {
    invoiceOrder: string;
    /** Nom du patient (champ "Nom" de la recherche, patientFirstname) */
    nomPatient: string;
    /** Prénom du patient (champ "Prénom" de la recherche, patientLastname) */
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

/** "dd/MM/yyyy" (éventuellement suivie d'autre texte) → "yyyy-MM-dd" pour un <input type="date">. */
function toIsoDate(displayDate: string): string {
    const [day, month, year] = (displayDate.match(/(\d{2})\/(\d{2})\/(\d{4})/) ?? []).slice(1);
    return `${year}-${month}-${day}`;
}

/** Numéro de téléphone affiché, pour le champ de recherche international. */
function toSearchPhone(phone: string): string {
    let formatted = phone.split('/')[0].replace(/\s/g, '');
    if (!formatted.startsWith('+')) formatted = `+221${formatted.replace(/^221/, '')}`;
    return formatted;
}

/**
 * Liste des factures (patients ou garants). Recherche : N° facture, prénom, nom, identifiant, période
 * en un clic (Aujourd'hui, 7 jours, Ce mois, Tout) ou dates ; les autres critères sont repliés sous
 * "Plus de critères". Colonnes : Date, N° facture, Patient (nom, identifiant, naissance), [Garant],
 * Téléphone, Facturé par, Montant, Actions. Un clic sur la ligne ouvre aussi le détail.
 */
abstract class BillingListPage {
    protected readonly page: Page;
    protected abstract readonly heading: RegExp;
    protected abstract readonly detailId: string;
    /** Colonnes (1 = première) */
    protected abstract readonly col: { date: number; order: number; patient: number; garant?: number; phone: number; billedBy: number; amount: number };

    protected readonly form: Locator;
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
    protected readonly rows: Locator;
    protected readonly firstRow: Locator;
    protected readonly confirmerButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.form = page.locator('form.invoice-search');
        this.invoiceOrderInput = this.form.locator('input[formcontrolname="invoiceOrder"]');
        this.nomPatientInput = this.form.locator('input[formcontrolname="firstName"]');
        this.prenomPatientInput = this.form.locator('input[formcontrolname="lastName"]');
        this.identifiantPatientInput = this.form.locator('input[formcontrolname="patientIdentifier"]');
        this.dateNaissanceInput = this.form.locator('input[formcontrolname="dob"]');
        this.facturantInput = this.form.locator('input[formcontrolname="billedBy"]');
        this.dateDebutInput = this.form.locator('input[formcontrolname="dateStart"]');
        this.dateFinInput = this.form.locator('input[formcontrolname="dateEnd"]');
        this.telephoneInput = this.form.getByPlaceholder('Entrez le numéro');
        this.reinitialiserButton = this.form.getByRole('button', { name: /Réinitialiser/ });
        this.rechercherButton = this.form.getByRole('button', { name: /Rechercher/ });
        this.rows = page.locator('table.compact-table tbody tr.table-row');
        this.firstRow = this.rows.first();
        this.confirmerButton = page.getByRole('button', { name: 'Confirmer' });
    }

    protected get listHeading(): Locator {
        return this.page.getByRole('heading', { name: this.heading });
    }

    protected get detailModal(): Locator {
        return this.page.locator(`#${this.detailId}`);
    }

    async expectListLoaded(): Promise<void> {
        await expect(this.listHeading).toBeVisible();
        for (const name of ['Date', 'N° facture', 'Patient', 'Montant (F CFA)', 'Actions']) {
            await expect(this.page.getByRole('columnheader', { name, exact: true }).first(), `Colonne "${name}"`).toBeVisible();
        }
        await expect(this.reinitialiserButton).toBeVisible();
        await expect(this.rechercherButton).toBeVisible();
        await this.waitForSearchSettled();
    }

    /** Spinner du bouton "Rechercher" disparu : la liste est relue. */
    protected async waitForSearchSettled(): Promise<void> {
        await this.rechercherButton.locator('.spinner-border').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => { });
    }

    /** Déplie "Plus de critères" (naissance, téléphone, facturant… selon la liste). */
    protected async showMoreCriteria(): Promise<void> {
        const more = this.form.getByRole('button', { name: /Plus de critères/ });
        if (await more.isVisible().catch(() => false)) await more.click();
    }

    /** Remplit un champ de recherche, en dépliant les critères repliés s'il y est. */
    protected async fillField(input: Locator, value: string): Promise<void> {
        if (!await input.isVisible().catch(() => false)) await this.showMoreCriteria();
        await input.fill(value);
    }

    async getRowCount(): Promise<number> {
        return this.rows.count();
    }

    protected async cell(row: Locator, index: number): Promise<string> {
        return ((await row.locator(`td:nth-child(${index})`).innerText()) ?? '').trim();
    }

    /** Données de la première ligne ; le nom du patient est découpé en nom (1er mot) et prénom (dernier mot). */
    protected async rowData(row: Locator): Promise<BillingRowData> {
        const patientCell = row.locator(`td:nth-child(${this.col.patient})`);
        const fullName = ((await patientCell.locator('.cell-strong').innerText()) ?? '').replace(/\s+/g, ' ').trim();
        const sub = ((await patientCell.locator('.cell-sub').first().innerText()) ?? '').replace(/\s+/g, ' ').trim();
        const words = fullName.split(' ');
        return {
            invoiceOrder: await this.cell(row, this.col.order),
            nomPatient: words[0] ?? '',
            prenomPatient: words.length > 1 ? words[words.length - 1] : '',
            identifiantPatient: sub.split('·')[0]?.trim() ?? '',
            dateNaissance: sub.match(/\d{2}\/\d{2}\/\d{4}/)?.[0] ?? '',
            telephone: await this.cell(row, this.col.phone),
            facturePar: await this.cell(row, this.col.billedBy),
            montant: await this.cell(row, this.col.amount),
            dateFacturation: (await this.cell(row, this.col.date)).match(/\d{2}\/\d{2}\/\d{4}/)?.[0] ?? '',
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
        await this.fillField(this.identifiantPatientInput, value);
    }

    /** Ligne de la facture N° `order` dans la liste affichée. */
    rowOf(order: string): Locator {
        return this.rows.filter({ has: this.page.locator(`td:nth-child(${this.col.order})`, { hasText: new RegExp(`^\\s*${order}\\s*$`) }) });
    }

    async expectInvoiceVisible(invoiceOrder: string): Promise<void> {
        await expect(this.rowOf(invoiceOrder).first(), `Facture ${invoiceOrder} listée`).toBeVisible({ timeout: 10000 });
    }

    async expectInvoiceNotVisible(invoiceOrder: string): Promise<void> {
        await expect(this.rowOf(invoiceOrder), `Facture ${invoiceOrder} plus listée`).toHaveCount(0, { timeout: 10000 });
    }

    /** Champs de recherche à essayer un par un pour une facture de référence. */
    protected searchFields(reference: BillingRowData): { name: string; fill: () => Promise<void> }[] {
        const fields: { name: string; fill: () => Promise<void> }[] = [];
        const has = (v: string) => !!v && v !== '-';
        if (has(reference.invoiceOrder)) fields.push({ name: 'N° facture', fill: () => this.fillField(this.invoiceOrderInput, reference.invoiceOrder) });
        if (has(reference.nomPatient)) fields.push({ name: 'Nom', fill: () => this.fillField(this.nomPatientInput, reference.nomPatient) });
        if (has(reference.prenomPatient)) fields.push({ name: 'Prénom', fill: () => this.fillField(this.prenomPatientInput, reference.prenomPatient) });
        if (has(reference.identifiantPatient)) fields.push({ name: 'Identifiant', fill: () => this.fillField(this.identifiantPatientInput, reference.identifiantPatient) });
        if (has(reference.facturePar)) fields.push({ name: 'Facturé par', fill: () => this.fillField(this.facturantInput, reference.facturePar) });
        if (has(reference.dateNaissance)) fields.push({ name: 'Date de naissance', fill: () => this.fillField(this.dateNaissanceInput, toIsoDate(reference.dateNaissance)) });
        if (has(reference.dateFacturation)) {
            fields.push({
                name: 'Période (du / au)',
                fill: async () => {
                    const iso = toIsoDate(reference.dateFacturation);
                    await this.dateDebutInput.fill(iso);
                    await this.dateFinInput.fill(iso);
                },
            });
        }
        if (has(reference.telephone)) fields.push({ name: 'Téléphone', fill: () => this.fillField(this.telephoneInput, toSearchPhone(reference.telephone)) });
        return fields;
    }

    /** Recherche sur chaque champ, un par un : la facture de référence est retrouvée à chaque fois. */
    async searchByEachField(reference: BillingRowData): Promise<void> {
        for (const field of this.searchFields(reference)) {
            await test.step(`Rechercher par ${field.name}`, async () => {
                await this.reset();
                await field.fill();
                await this.search();
                await this.expectInvoiceVisible(reference.invoiceOrder);
            });
        }
    }

    // ---------- Actions sur une ligne ----------

    async openDetailModal(row: Locator = this.firstRow): Promise<void> {
        await row.getByTitle('Voir le détail').last().click();
        await expect(this.detailModal).toBeVisible();
    }

    getDetailModal(): Locator {
        return this.detailModal;
    }

    async closeDetailModal(): Promise<void> {
        await this.detailModal.getByRole('button', { name: /Fermer/ }).click();
        await expect(this.detailModal).toBeHidden();
    }

    async expectPrintButtonVisible(row: Locator = this.firstRow): Promise<void> {
        await expect(row.getByTitle('Imprimer')).toBeVisible();
    }

    /** Supprime une ligne (confirmation) ; en cas de succès la liste est relue. */
    async deleteRow(row: Locator = this.firstRow): Promise<void> {
        await row.getByTitle('Supprimer').click();
        await expect(this.page.getByText(/voulez-vous supprimer cette facture/i)).toBeVisible();
        const refreshed = this.page.waitForResponse(r => /\/invoices\/(patients|garants)$/.test(r.url().split('?')[0]) && r.request().method() === 'POST', { timeout: 20000 }).catch(() => null);
        await this.confirmerButton.click();
        await refreshed;
        await expect(this.listHeading).toBeVisible({ timeout: 15000 });
    }

    /** Ouvre le détail de la facture N° `order` (liste déjà affichée), le lit puis le referme. */
    async detailOf(order: string): Promise<InvoiceDetail> {
        await this.openDetailModal(this.rowOf(order).first());
        const detail = await readInvoiceDetail(this.detailModal);
        await this.closeDetailModal();
        return detail;
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

    /** Toutes les factures du patient (N° et montant), période "Tout", sur la plus grande page. */
    async invoicesOf(patientIdentifier: string): Promise<InvoiceSummary[]> {
        await this.fillField(this.identifiantPatientInput, patientIdentifier);
        return readInvoices(this.page, this.rechercherButton, this.rows, this.col.order, this.col.amount, patientIdentifier);
    }

    /** N° de la première facture de la liste, sans critère. */
    async firstOrder(): Promise<string> {
        await this.rechercherButton.click();
        await this.waitForSearchSettled();
        await expect(this.rows.first(), 'Au moins une facture').toBeVisible({ timeout: 30000 });
        return this.cell(this.rows.first(), this.col.order);
    }

    /** HTML de la dernière impression interceptée (styles compris : police, couleur). */
    async lastPrintedHtml(): Promise<string> {
        return this.page.evaluate(() => (window as any).__qaPrintedHtml ?? '');
    }
}

/** Page des factures patients (`/billing/billings-patients`). */
export class BillingListPatientPage extends BillingListPage {
    protected readonly heading = /^\s*Factures patients/;
    protected readonly detailId = 'detail_invoice';
    protected readonly col = { date: 1, order: 2, patient: 3, phone: 4, billedBy: 5, amount: 6 };

    async getFirstRowData(): Promise<BillingRowData> {
        return this.rowData(this.firstRow);
    }
}

/** Page des factures garants (`/billing/billings-garants`). */
export class BillingListGarantPage extends BillingListPage {
    protected readonly heading = /^\s*Factures garants/;
    protected readonly detailId = 'detail_invoice_garant';
    protected readonly col = { date: 1, order: 2, patient: 3, garant: 4, phone: 5, billedBy: 6, amount: 7 };

    async getFirstRowData(): Promise<BillingGarantRowData> {
        return { ...(await this.rowData(this.firstRow)), garant: await this.cell(this.firstRow, 4) };
    }

    /** Choisit un garant dans le sélecteur "Garant" (texte normalisé exact). */
    async selectGarant(optionText: string): Promise<void> {
        await this.form.locator('ng-select[formcontrolname="garant"] .ng-select-container').click();
        const wanted = optionText.replace(/\s+/g, ' ').trim().toLowerCase();
        const option = this.page.locator('.ng-dropdown-panel:visible .ng-option')
            .filter({ hasText: new RegExp(`^\\s*${wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')}\\s*$`, 'i') }).first();
        await expect(option, `Garant "${optionText}" proposé`).toBeVisible({ timeout: 10000 });
        await option.click();
    }

    async searchByEachField(reference: BillingGarantRowData): Promise<void> {
        const fields = this.searchFields(reference);
        if (reference.garant && reference.garant !== '-') fields.splice(1, 0, { name: 'Garant', fill: () => this.selectGarant(reference.garant) });
        for (const field of fields) {
            await test.step(`Rechercher par ${field.name}`, async () => {
                await this.reset();
                await field.fill();
                await this.search();
                await this.expectInvoiceVisible(reference.invoiceOrder);
            });
        }
    }
}

export type InvoiceSummary = { order: string; amount: number };

/** Lance la recherche, affiche la plus grande page puis lit N° et montant de chaque ligne. */
async function readInvoices(page: Page, searchButton: Locator, rows: Locator, orderColumn: number, amountColumn: number, criterion?: string): Promise<InvoiceSummary[]> {
    // La liste lance aussi sa propre recherche à l'ouverture (juste après une facturation) : une
    // lecture vide est retentée deux fois ; une liste réellement vide ne coûte que ces relances.
    for (let attempt = 1; ; attempt++) {
        const result = await readInvoicesOnce(page, searchButton, rows, orderColumn, amountColumn, criterion);
        if (result.length > 0 || attempt >= 3) return result;
        await page.waitForTimeout(2000);
    }
}

async function readInvoicesOnce(page: Page, searchButton: Locator, rows: Locator, orderColumn: number, amountColumn: number, criterion?: string): Promise<InvoiceSummary[]> {
    // Période "Tout" (la liste peut avoir été ouverte sur "Aujourd'hui")
    const all = page.locator('.period-switch').getByRole('button', { name: /^Tout$/ });
    if (await all.isVisible().catch(() => false) && !(await all.getAttribute('class'))?.includes('active')) {
        const reloaded = page.waitForResponse(r => /\/invoices\/(patients|garants)/.test(r.url()) && r.request().method() === 'POST', { timeout: 30000 }).catch(() => null);
        await all.click();
        await reloaded;
    }
    // Réponse de CETTE recherche (avec le critère) : la liste lance aussi sa recherche sans filtre à l'ouverture
    const searched = page.waitForResponse(r => /\/invoices\/(patients|garants)/.test(r.url()) && r.request().method() !== 'OPTIONS'
        && (!criterion || (r.request().postData() ?? '').includes(criterion)), { timeout: 30000 }).catch(() => null);
    await searchButton.click();
    await searched;
    await page.waitForTimeout(300);
    await searchButton.locator('.spinner-border').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => { });
    const size = page.locator('ng-select.compact-select').first();
    if (await size.isVisible().catch(() => false)) {
        await size.click();
        await page.locator('.ng-dropdown-panel .ng-option').last().click();
        await page.waitForTimeout(1500);
    }
    const result: InvoiceSummary[] = [];
    for (const row of await rows.all()) {
        const order = (await row.locator(`td:nth-child(${orderColumn})`).innerText()).trim();
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
    // Montant qui suit le libellé (séparateurs de milliers : espace, espace insécable, virgule, point)
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
