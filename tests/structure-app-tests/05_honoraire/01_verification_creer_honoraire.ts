// tests/structure-app-tests/05_honoraire/01_verification_creer_honoraire.ts
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

test('Créer un nouveau relevé honoraire pour un médecin', async ({ page }) => {
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

    await test.step('Accéder à la page de création de note d\'honoraire', async () => {
        await createHonorairePage.gotoViaMenu();
    });

    await test.step('Sélectionner un médecin et une période large', async () => {
        medecinNom = await createHonorairePage.selectFirstMedecinDisponible();
        await createHonorairePage.fillPeriode(periode.dateDebut, periode.dateFin);
        await createHonorairePage.expectPeriodeValide();
    });

    await test.step('Rechercher les actes facturés éligibles', async () => {
        await createHonorairePage.rechercher();
    });

    await test.step('Sélectionner tous les actes sélectionnables trouvés', async () => {
        const hasActes = await createHonorairePage.hasActesTrouves();
        expect(hasActes, 'Aucun acte facturé trouvé pour le médecin/période sélectionnés').toBeTruthy();

        const nbSelectionnes = await createHonorairePage.selectAllSelectableActes();
        expect(nbSelectionnes).toBeGreaterThan(0);
    });

    await test.step('Vérifier la présence du bouton Annuler', async () => {
        await createHonorairePage.expectAnnulerButtonVisible();
    });

    await test.step('Créer le relevé honoraire', async () => {
        await createHonorairePage.creerHonoraire();
    });

    await test.step('Vérifier que le relevé créé apparaît dans la liste des honoraires', async () => {
        await honorairesListPage.expectListLoaded();
        const ligne = await honorairesListPage.getMostRecentRowForMedecinAndStatut(medecinNom, 'Non Payé');
        await expect(ligne).toBeVisible();
        const statut = await honorairesListPage.getRowStatutLibelle(ligne);
        expect(statut).toBe('Non Payé');
    });
});
