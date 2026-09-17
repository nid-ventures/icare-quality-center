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
        this.honorairesNavLink = page.getByRole('link', { name: ' Honoraires ' });

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
    async selectFirstMedecinDisponible(): Promise<string> {
        await this.openMedecinDropdown();
        const options = this.page.locator('.ng-dropdown-panel .ng-option');
        await expect(options.first()).toBeVisible();

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
        await this.rechercherButton.click();
        // Attendre la fin du chargement (le libellé du bouton repasse de "Chargement..." à "Rechercher")
        await expect(this.rechercherButton).not.toContainText('Chargement', { timeout: 5000 });
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
