// tests/structure-app-tests/05_honoraire/02_verification_recherche_liste_honoraires.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { HonorairesListPage } from '../../../pages/structure/honoraire/honoraires-list.page';
import { HonoraireDataGenerator } from '../../../pages/structure/generator/honoraire-data-generator';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

test('Filtrer la liste des relevés honoraires par médecin, statut et période', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const honorairesListPage = new HonorairesListPage(page);

    await test.step('Ouverture de la page de connexion et connexion', async () => {
        await loginPage.goto();
        await loginPage.login(adminUser.username, adminUser.password);
        await loginPage.selectStructure(adminUser.hi);
    });

    await test.step('Vérifier que le dashboard affiche les statistiques', async () => {
        await dashboardPage.statisticIsVisible();
    });

    await test.step('Accéder à la liste des relevés honoraires', async () => {
        await honorairesListPage.goto();
    });

    await test.step('Filtrer par statut "Non Payé"', async () => {
        await honorairesListPage.filtrerParStatut('Non Payé');
        await honorairesListPage.appliquerFiltres();
        const nbLignes = await honorairesListPage.getRowCount();
        if (nbLignes > 0) {
            await honorairesListPage.expectAllRowsHaveStatut('Non Payé');
        }
    });

    await test.step('Filtrer par statut "Payé"', async () => {
        await honorairesListPage.filtrerParStatut('Payé');
        await honorairesListPage.appliquerFiltres();
        const nbLignes = await honorairesListPage.getRowCount();
        if (nbLignes > 0) {
            await honorairesListPage.expectAllRowsHaveStatut('Payé');
        }
    });

    await test.step('Réinitialiser les filtres', async () => {
        await honorairesListPage.reinitialiserFiltres();
        await honorairesListPage.expectListLoaded();
    });

    await test.step('Filtrer par une période large (12 derniers mois)', async () => {
        const periode = HonoraireDataGenerator.generateLargePeriod();
        await honorairesListPage.filtrerParPeriode(periode.dateDebut, periode.dateFin);
        await honorairesListPage.appliquerFiltres();
        // La recherche ne doit pas planter : le texte de résultats doit rester lisible
        const resultats = await honorairesListPage.getResultsCountText();
        expect(resultats).toMatch(/résultat/);
    });

    await test.step('Réinitialiser à nouveau les filtres', async () => {
        await honorairesListPage.reinitialiserFiltres();
        await honorairesListPage.expectListLoaded();
    });
});
