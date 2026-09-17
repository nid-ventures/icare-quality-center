// tests/structure-app-tests/06_analyse/04_verification_selection_et_impression_bilans.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { LaboratoryWorklistPage } from '../../../pages/structure/analyse/laboratory-worklist.page';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

test('Sélectionner plusieurs bilans dans le worklist et vérifier la barre d’impression par lot', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const worklistPage = new LaboratoryWorklistPage(page);

    await test.step('Ouverture de la page de connexion', async () => {
        await loginPage.goto();
        await loginPage.login(adminUser.username, adminUser.password);
        await loginPage.selectStructure(adminUser.hi);
    });

    await test.step('Vérifier que le dashboard affiche les statistiques', async () => {
        await dashboardPage.statisticIsVisible();
    });

    await test.step('Accéder au worklist laboratoire', async () => {
        await worklistPage.gotoWorklist();
    });

    let rowCount = 0;
    await test.step("Vérifier qu'il y a au moins 2 bilans disponibles pour la sélection", async () => {
        rowCount = await worklistPage.getRowCount();
        expect(rowCount, 'Le worklist doit contenir au moins 2 bilans pour tester la sélection multiple.').toBeGreaterThanOrEqual(2);
    });

    await test.step('Sélectionner les 2 premières lignes via les cases à cocher', async () => {
        await worklistPage.selectRow(0);
        await worklistPage.selectRow(1);
    });

    await test.step('Vérifier que la barre de sélection apparaît avec le bouton "Imprimer la sélection"', async () => {
        await worklistPage.expectSelectionBarVisible(2);
    });

    await test.step('Désélectionner et vérifier que la barre de sélection disparaît', async () => {
        await worklistPage.deselectAll();
    });
});
