// pages/structure/honoraire/create-honoraire.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

export class CreateHonorairePage {
    private readonly honorairesNavLink: Locator;
    private readonly headerTitle: Locator;
    private readonly medecinSelect: Locator;
    private readonly dateDebutInput: Locator;
    private readonly dateFinInput: Locator;
    private readonly rechercherButton: Locator;
    private readonly creerButton: Locator;
    private readonly annulerButton: Locator;
    private readonly resultsRows: Locator;
    private readonly selectableRows: Locator;
    private readonly noResultsMessage: Locator;
    private readonly searchPromptMessage: Locator;
    private readonly periodErrorMessage: Locator;

    constructor(private readonly page: Page) {
        // Navigation (le lien "Honoraires" du menu principal mène directement à /honoraire/create)
        // Entrée "Nouveau relevé" du menu latéral du module Honoraires.
        this.honorairesNavLink = page.locator('nav.iq-sidebar-menu').getByRole('link', { name: /Nouveau relevé$/ });

        this.headerTitle = page.getByRole('heading', { name: /Nouvelle note d.honoraire|Modifier la note d.honoraire/ });

        // ng-select "Médecin *" (le champ interne n'a pas de rôle accessible standard)
        this.medecinSelect = page.locator('ng-select').filter({ hasText: 'Sélectionner un médecin' });

        // Champs date : pas de <label for=...>, on cible via le conteneur contenant le libellé
        this.dateDebutInput = page.locator('.search-field-compact', { hasText: 'Date début' }).locator('input[type="date"]');
        this.dateFinInput = page.locator('.search-field-compact', { hasText: 'Date fin' }).locator('input[type="date"]');

        // Boutons avec icône potentiellement sans texte accessible fiable -> regex partielle
        this.rechercherButton = page.getByRole('button', { name: /Rechercher/ });
        this.creerButton = page.getByRole('button', { name: /Créer/ });
        this.annulerButton = page.getByRole('button', { name: /Annuler/ });

        this.resultsRows = page.locator('.table-modern-compact tbody tr');
        this.selectableRows = page.locator('.table-modern-compact tbody tr.selectable-row');
        this.noResultsMessage = page.getByText('Aucun acte trouvé');
        this.searchPromptMessage = page.getByText("Recherche d'honoraires");
        this.periodErrorMessage = page.getByText('La date de fin doit être après la date de début');
    }

    /** Accède à la page de création d'honoraire via le menu principal (lien "Honoraires"). */
    async gotoViaMenu(): Promise<void> {
        await expect(this.honorairesNavLink).toBeVisible();
        await this.honorairesNavLink.click();
        await this.page.waitForURL('**/honoraire/create');
        await expect(this.headerTitle).toBeVisible();
    }

    private async openMedecinDropdown(): Promise<void> {
        await this.medecinSelect.click();
        const panel = this.page.locator('.ng-dropdown-panel:visible');
        await panel.waitFor({ state: 'visible', timeout: 5000 });
    }

    /**
     * Sélectionne le premier médecin disponible dans le ng-select "Médecin *".
     * Technique robuste (reprise de ConsultationPage.selectAndVerify) : ouverture du
     * panneau, attente de visibilité, sélection, attente de fermeture, puis vérification
     * que le libellé sélectionné est bien affiché.
     * Retourne le nom complet du médecin sélectionné (utile pour filtrer la liste ensuite).
     */
    /**
     * Indique si au moins un médecin est proposé. La liste vient de `/renumerations/profiles` :
     * elle est vide tant qu'aucun profil de rémunération médecin n'est configuré dans
     * l'environnement (Administration > Paramètres > Rémunération médecin).
     */
    async hasMedecinDisponible(): Promise<boolean> {
        const options = this.page.locator('.ng-dropdown-panel .ng-option:not(.ng-option-disabled)');
        const found = await expect(async () => {
            await this.page.keyboard.press('Escape');
            await this.openMedecinDropdown();
            await expect(options.first().locator('strong')).toBeVisible({ timeout: 2000 });
        }).toPass({ timeout: 10000 }).then(() => true, () => false);
        await this.page.keyboard.press('Escape');
        return found;
    }

    /** Sélectionne un médecin précis (nom complet) dans la liste des médecins. */
    async selectMedecin(nom: string): Promise<void> {
        const option = this.page.locator('.ng-dropdown-panel .ng-option:not(.ng-option-disabled)')
            .filter({ has: this.page.locator('strong', { hasText: nom }) }).first();
        await expect(async () => {
            await this.page.keyboard.press('Escape');
            await this.openMedecinDropdown();
            await expect(option).toBeVisible({ timeout: 2000 });
        }).toPass({ timeout: 20000 });
        await option.click();
        await expect(this.medecinSelect).toContainText(nom, { timeout: 3000 });
    }

    async selectFirstMedecinDisponible(): Promise<string> {
        // La liste des médecins est chargée de façon asynchrone (getReleveHonoraireMedecins) : si le
        // menu est ouvert trop tôt il affiche "No items found". On le referme et on réessaie.
        const options = this.page.locator('.ng-dropdown-panel .ng-option:not(.ng-option-disabled)');
        await expect(async () => {
            await this.page.keyboard.press('Escape');
            await this.openMedecinDropdown();
            await expect(options.first().locator('strong')).toBeVisible({ timeout: 2000 });
        }).toPass({ timeout: 20000 });

        const nom = (await options.first().locator('strong').first().textContent())?.replace(/\s+/g, ' ').trim() ?? '';
        if (!nom) {
            throw new Error('Impossible de récupérer le nom du premier médecin de la liste');
        }
        await options.first().click();

        await this.page.locator('.ng-dropdown-panel:visible').waitFor({ state: 'hidden', timeout: 3000 });
        await expect(this.medecinSelect).toContainText(nom, { timeout: 3000 });
        return nom;
    }

    async fillPeriode(dateDebut: string, dateFin: string): Promise<void> {
        await this.dateDebutInput.fill(dateDebut);
        await this.dateFinInput.fill(dateFin);
    }

    async expectPeriodeValide(): Promise<void> {
        await expect(this.periodErrorMessage).toBeHidden();
    }

    async rechercher(): Promise<void> {
        await expect(this.rechercherButton).toBeEnabled();
        const response = this.page.waitForResponse(r => r.url().includes('/feestatements/billableActs/search'), { timeout: 30000 });
        await this.rechercherButton.click();
        // L'application ne gère pas l'échec de cet appel : en cas d'erreur serveur, le bouton reste
        // indéfiniment sur "Chargement..." sans message. On contrôle donc la réponse de l'API.
        const result = await response;
        expect(result.status(), `Recherche des actes facturés (POST /feestatements/billableActs/search) : ${await result.text().catch(() => '')}`).toBe(200);
        // Pendant la recherche, le bouton s'intitule "Chargement..." : on attend qu'il redevienne "Rechercher".
        await expect(this.rechercherButton).toBeVisible({ timeout: 30000 });
        await Promise.race([
            this.resultsRows.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => { }),
            this.noResultsMessage.waitFor({ state: 'visible', timeout: 15000 }).catch(() => { })
        ]);
    }

    async hasActesTrouves(): Promise<boolean> {
        if (await this.noResultsMessage.isVisible().catch(() => false)) return false;
        return (await this.resultsRows.count()) > 0;
    }

    async getSelectableActesCount(): Promise<number> {
        return this.selectableRows.count();
    }

    /**
     * Sélectionne tous les actes sélectionnables (ceux disposant d'un profil de
     * rémunération pour le médecin choisi) et retourne leur nombre.
     */
    async selectAllSelectableActes(): Promise<number> {
        const checkboxes = this.selectableRows.locator('input.selection-checkbox-modern');
        const count = await checkboxes.count();
        for (let i = 0; i < count; i++) {
            await checkboxes.nth(i).check();
        }
        return count;
    }

    async expectAnnulerButtonVisible(): Promise<void> {
        await expect(this.annulerButton).toBeVisible();
    }

    async expectCreerButtonDisabled(): Promise<void> {
        await expect(this.creerButton).toBeDisabled();
    }

    /** Clique sur "Créer" et attend la redirection vers la liste des relevés d'honoraires. */
    async creerHonoraire(): Promise<void> {
        await expect(this.creerButton).toBeEnabled();
        await this.creerButton.click();
        await this.page.waitForURL('**/honoraire/honoraires', { timeout: 20000 });
    }
}
