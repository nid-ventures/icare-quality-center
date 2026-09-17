// tests/structure-app-tests/05_honoraire/06_verification_supprimer_honoraire.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { CreateHonorairePage } from '../../../pages/structure/honoraire/create-honoraire.page';
import { HonorairesListPage } from '../../../pages/structure/honoraire/honoraires-list.page';
import { HonoraireDataGenerator } from '../../../pages/structure/generator/honoraire-data-generator';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

test('Supprimer un relevé honoraire', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const createHonorairePage = new CreateHonorairePage(page);
    const honorairesListPage = new HonorairesListPage(page);

    const periode = HonoraireDataGenerator.generateLargePeriod();
    let medecinNom = '';
    let reference = '';

    await test.step('Ouverture de la page de connexion et connexion', async () => {
        await loginPage.goto();
        await loginPage.login(adminUser.username, adminUser.password);
        await loginPage.selectStructure(adminUser.hi);
    });

    await test.step('Vérifier que le dashboard affiche les statistiques', async () => {
        await dashboardPage.statisticIsVisible();
    });

    await test.step('Créer un relevé honoraire à l\'état "Non Payé" (pré-requis du test)', async () => {
        await createHonorairePage.gotoViaMenu();
        medecinNom = await createHonorairePage.selectFirstMedecinDisponible();
        await createHonorairePage.fillPeriode(periode.dateDebut, periode.dateFin);
        await createHonorairePage.rechercher();
        const hasActes = await createHonorairePage.hasActesTrouves();
        expect(hasActes, 'Aucun acte facturé trouvé pour le médecin/période sélectionnés').toBeTruthy();
        const nbSelectionnes = await createHonorairePage.selectAllSelectableActes();
        expect(nbSelectionnes).toBeGreaterThan(0);
        await createHonorairePage.creerHonoraire();
    });

    await test.step('Repérer le relevé créé et relever sa référence', async () => {
        await honorairesListPage.expectListLoaded();
        const ligne = await honorairesListPage.getMostRecentRowForMedecinAndStatut(medecinNom, 'Non Payé');
        const statut = await honorairesListPage.getRowStatutLibelle(ligne);
        expect(statut).toBe('Non Payé');
        reference = await honorairesListPage.getRowReference(ligne);
        expect(reference).not.toBe('');
    });

    await test.step('Supprimer le relevé et confirmer la suppression', async () => {
        const ligne = await honorairesListPage.getMostRecentRowForMedecinAndStatut(medecinNom, 'Non Payé');
        await honorairesListPage.supprimerLigne(ligne);
    });

    await test.step('Vérifier que le relevé supprimé n\'apparaît plus dans la liste', async () => {
        // Les filtres médecin + statut "Non Payé" appliqués à l'étape précédente restent actifs :
        // on vérifie directement qu'aucune ligne affichée ne porte la référence supprimée.
        const existeEncore = await honorairesListPage.referenceExisteDansListe(reference);
        expect(existeEncore).toBeFalsy();
    });
});
