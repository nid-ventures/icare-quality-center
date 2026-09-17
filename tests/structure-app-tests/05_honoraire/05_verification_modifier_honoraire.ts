// tests/structure-app-tests/05_honoraire/05_verification_modifier_honoraire.ts
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

test('Modifier un relevé honoraire', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const createHonorairePage = new CreateHonorairePage(page);
    const honorairesListPage = new HonorairesListPage(page);

    // Deux périodes larges mais distinctes (plages de "mois en arrière" différentes)
    // pour limiter le risque de collision et pouvoir vérifier que la modification a bien
    // remplacé la période initiale par la nouvelle.
    const periodeInitiale = HonoraireDataGenerator.generateLargePeriod(10, 12);
    const nouvellePeriode = HonoraireDataGenerator.generateLargePeriod(18, 20);
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
        await createHonorairePage.fillPeriode(periodeInitiale.dateDebut, periodeInitiale.dateFin);
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

    await test.step('Ouvrir la modale de modification du relevé', async () => {
        const ligne = await honorairesListPage.getMostRecentRowForMedecinAndStatut(medecinNom, 'Non Payé');
        await honorairesListPage.openEditModal(ligne);
    });

    await test.step('Modifier la période et resélectionner les actes éligibles', async () => {
        await honorairesListPage.fillPeriodeDansModal(nouvellePeriode.dateDebut, nouvellePeriode.dateFin);
        await honorairesListPage.rechercherActesDansModal();
        const nbSelectionnes = await honorairesListPage.selectAllSelectableActesDansModal();
        expect(nbSelectionnes).toBeGreaterThan(0);
    });

    await test.step('Enregistrer la modification', async () => {
        await honorairesListPage.confirmerModification();
    });

    await test.step('Vérifier que la nouvelle période a bien été enregistrée', async () => {
        const ligne = await honorairesListPage.getMostRecentRowForMedecinAndStatut(medecinNom, 'Non Payé');
        await honorairesListPage.openEditModal(ligne);
        const periodeEnregistree = await honorairesListPage.getPeriodeDansModal();
        expect(periodeEnregistree.dateDebut).toBe(nouvellePeriode.dateDebut);
        expect(periodeEnregistree.dateFin).toBe(nouvellePeriode.dateFin);
        await honorairesListPage.annulerModaleHonoraire();
    });
});
