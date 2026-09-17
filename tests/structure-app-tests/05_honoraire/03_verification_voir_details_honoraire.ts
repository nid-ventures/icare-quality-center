// tests/structure-app-tests/05_honoraire/03_verification_voir_details_honoraire.ts
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

test('Voir le détail d\'un relevé honoraire', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const createHonorairePage = new CreateHonorairePage(page);
    const honorairesListPage = new HonorairesListPage(page);

    const periode = HonoraireDataGenerator.generateLargePeriod();
    let medecinNom = '';

    await test.step('Ouverture de la page de connexion et connexion', async () => {
        await loginPage.goto();
        await loginPage.login(adminUser.username, adminUser.password);
        await loginPage.selectStructure(adminUser.hi);
    });

    await test.step('Vérifier que le dashboard affiche les statistiques', async () => {
        await dashboardPage.statisticIsVisible();
    });

    await test.step('Créer un relevé honoraire (pré-requis du test)', async () => {
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

    await test.step('Ouvrir les détails du relevé créé', async () => {
        await honorairesListPage.expectListLoaded();
        const ligne = await honorairesListPage.getMostRecentRowForMedecinAndStatut(medecinNom, 'Non Payé');
        await honorairesListPage.openDetailModal(ligne);
    });

    await test.step('Vérifier les informations générales du détail', async () => {
        await expect(honorairesListPage.getDetailInfoValue('Médecin')).toContainText(medecinNom);
        await expect(honorairesListPage.getDetailInfoValue('Statut')).toContainText('Non Payé');
        await expect(honorairesListPage.getDetailInfoValue('Montant Net des Honoraires')).not.toBeEmpty();
        await expect(honorairesListPage.getDetailInfoValue('Total actes')).not.toBeEmpty();
    });

    await test.step('Fermer la fenêtre de détail', async () => {
        await honorairesListPage.closeDetailModal();
    });
});
