// pages/structure/honoraire/honoraires-list.page.ts
import { amountOf } from './create-honoraire.page';
import { type Page, type Locator, expect } from '@playwright/test';

export type StatutLibelle = 'Non Payé' | 'Payé';

export class HonorairesListPage {
    private readonly page: Page;

    // Navigation
    private readonly honorairesNavLink: Locator;
    private readonly releveHonorairesNavLink: Locator;

    // En-tête / liste
    private readonly pageHeading: Locator;
    private readonly rows: Locator;
    private readonly loadingContainer: Locator;

    // Filtres
    private readonly medecinFilter: Locator;
    private readonly statutFilter: Locator;
    private readonly dateDebutFilter: Locator;
    private readonly dateFinFilter: Locator;
    private readonly reinitialiserButton: Locator;
    private readonly appliquerFiltresButton: Locator;
    private readonly actualiserButton: Locator;
    private readonly filterResultsText: Locator;
    private readonly nouveauButton: Locator;

    // Modal détail
    private readonly detailModalTitle: Locator;
    private readonly detailFermerButton: Locator;

    // Modal paiement
    private readonly paiementModalTitle: Locator;
    private readonly paiementDateInput: Locator;
    private readonly paiementAnnulerButton: Locator;
    private readonly paiementConfirmerButton: Locator;
    private readonly paiementSuccessHeading: Locator;
    private readonly paiementTerminerButton: Locator;

    // Modal création / édition (honoraire-modal, réutilisé)
    private readonly honoraireModalTitle: Locator;
    private readonly honoraireModalMedecinSelect: Locator;
    private readonly honoraireModalDateDebutInput: Locator;
    private readonly honoraireModalDateFinInput: Locator;
    private readonly honoraireModalAnnulerButton: Locator;
    private readonly honoraireModalConfirmButton: Locator;

    // Confirmation de suppression (ModalComponent générique)
    private readonly deleteConfirmText: Locator;
    private readonly deleteConfirmerButton: Locator;
    private readonly deleteFermerButton: Locator;

    constructor(page: Page) {
        this.page = page;

        // Entrée "Relevés d'honoraires" du menu latéral du module Honoraires.
        this.honorairesNavLink = page.locator('nav.iq-sidebar-menu').getByRole('link', { name: /Relevés d'honoraires$/ });
        this.releveHonorairesNavLink = this.honorairesNavLink;

        this.pageHeading = page.getByRole('heading', { name: /Relevés de Notes Honoraires/ });
        this.rows = page.locator('tr.honoraire-row');
        this.loadingContainer = page.locator('.loading-container');

        // Libellé exact : le champ Spécialité (masqué) contient l'option « Médecine générale ».
        this.medecinFilter = page.locator('.filter-field').filter({ has: page.locator('label.filter-label', { hasText: /^\s*Médecin\s*$/ }) }).locator('ng-select');
        this.statutFilter = page.locator('.filter-field', { hasText: 'Statut' }).locator('ng-select');
        this.dateDebutFilter = page.locator('.filter-field', { hasText: 'Date début Période' }).locator('input[type="date"]');
        this.dateFinFilter = page.locator('.filter-field', { hasText: 'Date fin Période' }).locator('input[type="date"]');
        // Scopé aux boutons d'action des filtres pour éviter le bouton icône ".btn-close-panel"
        // dont l'aria-label ("Réinitialiser les filtres") matche aussi la regex.
        this.reinitialiserButton = page.locator('.filter-buttons').getByRole('button', { name: /Réinitialiser/ });
        this.appliquerFiltresButton = page.getByRole('button', { name: /Appliquer les filtres/ });
        this.actualiserButton = page.getByTitle('Actualiser');
        this.filterResultsText = page.locator('.filter-results');
        this.nouveauButton = page.locator('.actions-group .btn-primary.compact-btn');

        this.detailModalTitle = page.getByRole('heading', { name: /Détails de l.Honoraire/ });
        this.detailFermerButton = page.getByRole('button', { name: /Fermer/ });

        this.paiementModalTitle = page.getByRole('heading', { name: /Paiement Relevé Honoraire/ });
        this.paiementDateInput = page.locator('input[formcontrolname="datePaiement"]');
        this.paiementAnnulerButton = page.getByRole('button', { name: /Annuler/ });
        this.paiementConfirmerButton = page.getByRole('button', { name: /Confirmer/ });
        this.paiementSuccessHeading = page.getByRole('heading', { name: 'Paiement Réussi' });
        this.paiementTerminerButton = page.getByRole('button', { name: /Terminer/ });

        this.honoraireModalTitle = page.getByRole('heading', { name: /Nouvelle Note honoraire|Modifier Note honoraire/ });
        this.honoraireModalMedecinSelect = page.locator('ng-select').filter({ hasText: 'Rechercher un médecin' });
        this.honoraireModalDateDebutInput = page.locator('.col-md-3', { hasText: 'Début' }).locator('input[type="date"]');
        this.honoraireModalDateFinInput = page.locator('.col-md-3', { hasText: 'Fin' }).locator('input[type="date"]');
        this.honoraireModalAnnulerButton = page.getByRole('button', { name: /Annuler/ });
        this.honoraireModalConfirmButton = page.getByRole('button', { name: /Créer|Modifier/ });

        this.deleteConfirmText = page.getByText(/voulez-vous supprimer ce relevé honoraire/i);
        this.deleteConfirmerButton = page.getByRole('button', { name: 'Confirmer' });
        this.deleteFermerButton = page.getByRole('button', { name: 'Fermer' });
    }

    /** Accède à la liste des relevés d'honoraires via le menu (Honoraires > Relevés honoraires). */
    async goto(): Promise<void> {
        await expect(this.honorairesNavLink).toBeVisible();
        await this.honorairesNavLink.click();
        await this.page.waitForURL('**/honoraire/honoraires');
        await expect(this.pageHeading).toBeVisible();
        await this.attendreChargement();
    }

    async expectListLoaded(): Promise<void> {
        await expect(this.pageHeading).toBeVisible();
    }

    private async attendreChargement(): Promise<void> {
        await this.loadingContainer.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => { });
    }

    // ---------- Filtres ----------

    /** Vide un filtre ng-select (croix) : revient à « Tous ». */
    private async viderFiltre(filtre: Locator): Promise<void> {
        const clear = filtre.locator('.ng-clear-wrapper');
        if (await clear.isVisible()) await clear.click();
    }

    /** Sélectionne un médecin dans le filtre (ng-select) à partir de son nom complet : saisi puis choisi. */
    async filtrerParMedecin(nomMedecin: string): Promise<void> {
        await this.medecinFilter.click();
        await this.medecinFilter.locator('input').fill(nomMedecin.toUpperCase());
        const option = this.medecinFilter.locator('.ng-option', { hasText: nomMedecin.toUpperCase() });
        if (!(await option.first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false))) {
            throw new Error(`Médecin "${nomMedecin}" introuvable dans le filtre de la liste des honoraires`);
        }
        await option.first().click();
    }

    async reinitialiserFiltreMedecin(): Promise<void> {
        await this.viderFiltre(this.medecinFilter);
    }

    async filtrerParStatut(libelle: StatutLibelle): Promise<void> {
        await this.statutFilter.click();
        // Libellé exact : « Payé » est contenu dans « Non Payé »
        await this.statutFilter.locator('.ng-option', { hasText: new RegExp(`^\\s*${libelle}\\s*$`) }).click();
    }

    async filtrerParTousLesStatuts(): Promise<void> {
        await this.viderFiltre(this.statutFilter);
    }

    async filtrerParPeriode(dateDebut: string, dateFin: string): Promise<void> {
        await this.dateDebutFilter.fill(dateDebut);
        await this.dateFinFilter.fill(dateFin);
    }

    async appliquerFiltres(): Promise<void> {
        // Attendre la réponse de la recherche : l'indicateur de chargement peut ne pas être encore
        // affiché au moment du contrôle, et l'ancienne liste serait lue
        const searched = this.page.waitForResponse(r => r.url().includes('/search/paged'), { timeout: 30000 }).catch(() => null);
        await this.appliquerFiltresButton.click();
        await searched;
        await this.attendreChargement();
        await this.page.waitForTimeout(300);
    }

    async reinitialiserFiltres(): Promise<void> {
        await this.reinitialiserButton.click();
        await this.attendreChargement();
    }

    async actualiser(): Promise<void> {
        await this.actualiserButton.click();
    }

    async getResultsCountText(): Promise<string> {
        return (await this.filterResultsText.textContent())?.trim() ?? '';
    }

    // ---------- Lignes du tableau ----------

    async getRowCount(): Promise<number> {
        return this.rows.count();
    }

    async getRowStatutLibelle(row: Locator): Promise<string> {
        return ((await row.locator('.status-indicator-compact').textContent()) ?? '').trim();
    }

    async getRowReference(row: Locator): Promise<string> {
        return ((await row.locator('.reference-code-compact').textContent()) ?? '').trim();
    }

    /** Vérifie que toutes les lignes actuellement affichées ont bien le statut attendu. */
    async expectAllRowsHaveStatut(libelle: StatutLibelle): Promise<void> {
        const count = await this.rows.count();
        for (let i = 0; i < count; i++) {
            const statut = await this.getRowStatutLibelle(this.rows.nth(i));
            expect(statut).toBe(libelle);
        }
    }

    /**
     * Retrouve, parmi les lignes actuellement affichées, celle dont la date de création
     * est la plus récente. Utile pour cibler de façon fiable le relevé qu'on vient de créer,
     * même si d'autres relevés existent déjà pour le même médecin/statut.
     * La colonne "Date de Création" partage la classe ".period-info" avec la colonne
     * "Période" : elle correspond donc au DERNIER élément ".period-info" de la ligne.
     */
    async getMostRecentRow(): Promise<Locator> {
        const count = await this.rows.count();
        if (count === 0) {
            throw new Error('Aucune ligne dans la liste des honoraires');
        }
        let bestIndex = 0;
        let bestTimestamp = -Infinity;
        for (let i = 0; i < count; i++) {
            const text = (await this.rows.nth(i).locator('.period-info').last().textContent())?.trim() ?? '';
            const match = text.match(/(\d{2})\/(\d{2})\/(\d{4})\D+(\d{2}):(\d{2})/);
            if (match) {
                const [, dd, mm, yyyy, hh, mi] = match;
                const ts = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi)).getTime();
                if (ts > bestTimestamp) {
                    bestTimestamp = ts;
                    bestIndex = i;
                }
            }
        }
        return this.rows.nth(bestIndex);
    }

    /**
     * Filtre par médecin + statut puis retourne la ligne la plus récente correspondante.
     * Combinée à {@link getMostRecentRow}, permet de cibler de façon fiable le relevé
     * qu'un test vient tout juste de créer, indépendamment des données déjà présentes.
     */
    async getMostRecentRowForMedecinAndStatut(nomMedecin: string, libelle: StatutLibelle): Promise<Locator> {
        await this.filtrerParMedecin(nomMedecin);
        await this.filtrerParStatut(libelle);
        await this.appliquerFiltres();
        const count = await this.getRowCount();
        if (count === 0) {
            throw new Error(`Aucun relevé "${libelle}" trouvé pour le médecin "${nomMedecin}"`);
        }
        return this.getMostRecentRow();
    }

    // ---------- Actions sur une ligne ----------

    async openDetailModal(row: Locator): Promise<void> {
        await row.getByTitle('Consulter').click();
        await expect(this.detailModalTitle).toBeVisible();
    }

    async closeDetailModal(): Promise<void> {
        await this.detailFermerButton.click();
        await expect(this.detailModalTitle).toBeHidden();
    }

    /**
     * Cible la valeur d'un champ du bloc "Informations Générales" à partir de son libellé
     * (ex. "Médecin", "Statut"). On filtre sur l'élément dédié au libellé (`.info-meta`)
     * plutôt que sur le texte de tout le bloc, car une valeur comme "Médecine Générale"
     * contiendrait sinon le mot "Médecin" et fausserait le filtrage.
     */
    getDetailInfoValue(label: string): Locator {
        return this.page
            .locator('.info-item-compact')
            .filter({ has: this.page.locator('.info-meta', { hasText: label }) })
            .locator('.info-value-compact')
            .first();
    }

    /**
     * Le bouton "Payer relevé" n'est rendu par le tableau que pour les relevés au
     * statut "Non Payé" : on vérifie donc explicitement sa présence avant de cliquer,
     * afin d'obtenir un message d'erreur clair si la ligne n'est pas (ou plus) payable.
     */
    async openPaymentModal(row: Locator): Promise<void> {
        const bouton = row.getByTitle('Payer relevé');
        await expect(bouton, 'Le bouton "Payer relevé" est réservé aux relevés au statut "Non Payé"').toBeVisible();
        await bouton.click();
        await expect(this.paiementModalTitle).toBeVisible();
    }

    getPaymentInfoValue(label: string): Locator {
        return this.page
            .locator('.honoraire-info-item')
            .filter({ has: this.page.locator('.info-label', { hasText: label }) })
            .locator('.info-value')
            .first();
    }

    async fillPaymentDate(date: string): Promise<void> {
        await this.paiementDateInput.fill(date);
    }

    async confirmerPaiement(): Promise<void> {
        await expect(this.paiementConfirmerButton).toBeEnabled();
        await this.paiementConfirmerButton.click();
        await expect(this.paiementSuccessHeading).toBeVisible({ timeout: 15000 });
    }

    async terminerPaiement(): Promise<void> {
        await this.paiementTerminerButton.click();
        await expect(this.paiementModalTitle).toBeHidden();
        await this.attendreChargement();
    }

    /**
     * Le bouton "Modifier" n'est rendu que pour les relevés au statut "Non Payé" :
     * on vérifie donc explicitement sa présence avant de cliquer.
     */
    async openEditModal(row: Locator): Promise<void> {
        const bouton = row.getByTitle('Modifier');
        await expect(bouton, 'Le bouton "Modifier" est réservé aux relevés au statut "Non Payé"').toBeVisible();
        await bouton.click();
        await expect(this.honoraireModalTitle).toBeVisible();
    }

    /** Lit les valeurs actuelles des champs de période dans la modale de création/édition. */
    async getPeriodeDansModal(): Promise<{ dateDebut: string; dateFin: string }> {
        return {
            dateDebut: await this.honoraireModalDateDebutInput.inputValue(),
            dateFin: await this.honoraireModalDateFinInput.inputValue()
        };
    }

    /** Clique sur "Rechercher les actes" dans la modale de création/édition (bouton avec title). */
    async rechercherActesDansModal(): Promise<void> {
        const bouton = this.page.getByTitle('Rechercher les actes');
        await expect(bouton).toBeEnabled();
        await bouton.click();
        await this.page.waitForTimeout(500);
    }

    async fillPeriodeDansModal(dateDebut: string, dateFin: string): Promise<void> {
        await this.honoraireModalDateDebutInput.fill(dateDebut);
        await this.honoraireModalDateFinInput.fill(dateFin);
    }

    async getActesSelectionnesCountDansModal(): Promise<number> {
        return this.page.locator('table.ultra-compact-table tbody input.selection-checkbox-compact:checked').count();
    }

    async selectAllSelectableActesDansModal(): Promise<number> {
        const checkboxes = this.page.locator('table.ultra-compact-table tbody tr.selectable input.selection-checkbox-compact');
        const count = await checkboxes.count();
        for (let i = 0; i < count; i++) {
            if (!(await checkboxes.nth(i).isChecked())) {
                await checkboxes.nth(i).check();
            }
        }
        return count;
    }

    async confirmerModification(): Promise<void> {
        await expect(this.honoraireModalConfirmButton).toBeEnabled();
        await this.honoraireModalConfirmButton.click();
        await expect(this.honoraireModalTitle).toBeHidden({ timeout: 15000 });
        await this.attendreChargement();
    }

    async annulerModaleHonoraire(): Promise<void> {
        await this.honoraireModalAnnulerButton.click();
        await expect(this.honoraireModalTitle).toBeHidden();
    }

    async ouvrirCreationDepuisListe(): Promise<void> {
        await this.nouveauButton.click();
        await expect(this.honoraireModalTitle).toBeVisible();
    }

    /**
     * Le bouton "Supprimer" n'est rendu que pour les relevés au statut "Non Payé" :
     * on vérifie donc explicitement sa présence avant de cliquer.
     */
    async supprimerLigne(row: Locator): Promise<void> {
        const bouton = row.getByTitle('Supprimer');
        await expect(bouton, 'Le bouton "Supprimer" est réservé aux relevés au statut "Non Payé"').toBeVisible();
        await bouton.click();
        await expect(this.deleteConfirmText).toBeVisible();
        // Attendre le rechargement de la liste : sinon la ligne supprimée est encore lue
        const reloaded = this.page.waitForResponse(r => r.url().includes('/search/paged'), { timeout: 30000 }).catch(() => null);
        await this.deleteConfirmerButton.click();
        await reloaded;
        await this.attendreChargement();
        await this.page.waitForTimeout(300);
    }

    /**
     * Indique si une ligne portant la référence donnée est présente parmi les lignes
     * actuellement affichées (utile pour vérifier qu'un relevé supprimé n'apparaît
     * plus dans la liste, dans le respect des filtres déjà appliqués).
     */
    /** Ligne du relevé de référence donnée, parmi les lignes affichées. */
    rowOfReference(reference: string): Locator {
        return this.rows.filter({ has: this.page.locator('.reference-code-compact', { hasText: reference }) });
    }

    /** Montants d'une ligne : prestations, honoraire brut et honoraire net (F CFA). */
    async amountsOf(row: Locator): Promise<{ prestation: number; brut: number; net: number }> {
        const cells = row.locator('td.cell-honoraire:not([hidden]) .amount-compact');
        const [prestation, brut, net] = (await cells.allInnerTexts()).map(amountOf);
        return { prestation, brut, net };
    }

    /**
     * Détail d'un relevé (fenêtre "Consulter") : lignes d'actes (acte, patient, montant, taux,
     * honoraire) et texte complet. Ouvre puis referme la fenêtre.
     */
    async detailOf(row: Locator): Promise<{ text: string; lines: { act: string; patient: string; amount: number; fee: number }[] }> {
        await this.openDetailModal(row);
        const modal = this.page.locator('.modal, .modal-content, [role="dialog"]').filter({ has: this.detailModalTitle }).last();
        const text = (await modal.innerText()).replace(/\s+/g, ' ');
        const lines: { act: string; patient: string; amount: number; fee: number }[] = [];
        for (const tr of await modal.locator('table tbody tr').all()) {
            const cells = (await tr.locator('td').allInnerTexts()).map(c => c.replace(/\s+/g, ' ').trim());
            if (cells.length < 6) continue;
            lines.push({ act: cells[0], patient: cells[1], amount: amountOf(cells[3]), fee: amountOf(cells[5]) });
        }
        await this.closeDetailModal();
        return { text, lines };
    }

    async referenceExisteDansListe(reference: string): Promise<boolean> {
        const count = await this.rows.count();
        for (let i = 0; i < count; i++) {
            const ref = await this.getRowReference(this.rows.nth(i));
            if (ref === reference) return true;
        }
        return false;
    }
}
