// tests/structure-app-tests/05_honoraire/04_verification_payer_honoraire.ts
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

test('Payer un relevé honoraire', async ({ page }) => {
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

    await test.step('Repérer le relevé créé et vérifier son statut "Non Payé"', async () => {
        await honorairesListPage.expectListLoaded();
        const ligne = await honorairesListPage.getMostRecentRowForMedecinAndStatut(medecinNom, 'Non Payé');
        const statut = await honorairesListPage.getRowStatutLibelle(ligne);
        expect(statut).toBe('Non Payé');
    });

    await test.step('Ouvrir la modale de paiement du relevé', async () => {
        const ligne = await honorairesListPage.getMostRecentRowForMedecinAndStatut(medecinNom, 'Non Payé');
        await honorairesListPage.openPaymentModal(ligne);
    });

    await test.step('Renseigner la date de paiement et confirmer', async () => {
        const datePaiement = HonoraireDataGenerator.generatePaymentDate();
        await honorairesListPage.fillPaymentDate(datePaiement);
        // confirmerPaiement() clique sur "Confirmer" et attend l'apparition du panneau de succès.
        await honorairesListPage.confirmerPaiement();
    });

    await test.step('Terminer le paiement et vérifier la fermeture de la modale', async () => {
        await honorairesListPage.terminerPaiement();
    });

    await test.step('Vérifier que le relevé apparaît désormais avec le statut "Payé"', async () => {
        const ligne = await honorairesListPage.getMostRecentRowForMedecinAndStatut(medecinNom, 'Payé');
        await expect(ligne).toBeVisible();
        const statut = await honorairesListPage.getRowStatutLibelle(ligne);
        expect(statut).toBe('Payé');
    });
});
