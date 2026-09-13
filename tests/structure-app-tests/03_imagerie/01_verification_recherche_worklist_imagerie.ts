// tests/structure-app-tests/03_imagerie/01_verification_recherche_worklist_imagerie.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { ImagingWorklistPage } from '../../../pages/structure/imagerie/imaging-worklist.page';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

test.setTimeout(60000);

test("Rechercher des actes d'imagerie dans le worklist", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const worklistPage = new ImagingWorklistPage(page);

    await test.step('Ouverture de la page de connexion', async () => {
        await loginPage.goto();
        await loginPage.login(adminUser.username, adminUser.password);
        await loginPage.selectStructure(adminUser.hi);
    });

    await test.step('Vérifier que le dashboard affiche les statistiques', async () => {
        await dashboardPage.statisticIsVisible();
    });

    await test.step("Accéder au worklist d'imagerie", async () => {
        await worklistPage.goto();
    });

    await test.step('Vérifier que le formulaire de recherche est visible', async () => {
        await worklistPage.expectSearchFormVisible();
    });

    await test.step('Vérifier que le tableau des résultats est visible', async () => {
        await worklistPage.expectResultsTableVisible();
    });

    await test.step('Rechercher par numéro de dossier', async () => {
        const firstRow = worklistPage.tableRows.first();
        if (await firstRow.isVisible().catch(() => false)) {
            const folderOrder = (await firstRow.locator('td').nth(1).innerText()).trim();
            if (folderOrder && folderOrder !== '-') {
                await worklistPage.searchByFolderOrder(folderOrder);
                await expect(worklistPage.tableRows.first()).toBeVisible();
                await expect(worklistPage.tableRows.first().locator('td').nth(1)).toContainText(folderOrder);
                await worklistPage.resetSearch();
            }
        }
    });

    await test.step('Rechercher par prénom et nom', async () => {
        const firstRow = worklistPage.tableRows.first();
        if (await firstRow.isVisible().catch(() => false)) {
            const patientName = (await firstRow.locator('td').first().innerText()).trim();
            const [firstName, ...rest] = patientName.split(' ');
            const lastName = rest.join(' ');
            if (firstName) {
                await worklistPage.searchByFirstAndLastName(firstName, lastName);
                await worklistPage.resetSearch();
            }
        }
    });

    await test.step('Rechercher par date de naissance', async () => {
        const firstRow = worklistPage.tableRows.first();
        if (await firstRow.isVisible().catch(() => false)) {
            const doBText = (await firstRow.locator('td').nth(4).innerText()).trim();
            const match = doBText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (match) {
                const [, day, month, year] = match;
                await worklistPage.searchByDateNaissance(`${year}-${month}-${day}`);
                await worklistPage.resetSearch();
            }
        }
    });

    await test.step('Rechercher par prescripteur', async () => {
        await worklistPage.searchByFirstAvailablePrescripteur();
        await worklistPage.resetSearch();
    });
});
