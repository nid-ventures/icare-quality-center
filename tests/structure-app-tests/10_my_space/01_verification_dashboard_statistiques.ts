// tests/structure-app-tests/10_my_space/01_verification_dashboard_statistiques.ts
import { test } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

test(`Vérification des statistiques du dashboard my-space par l'utilisateur ${adminUser.role}`, async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await test.step('Ouverture de la page de connexion et connexion', async () => {
        await loginPage.goto();
        await loginPage.login(adminUser.username, adminUser.password);
        await loginPage.selectStructure(adminUser.hi);
    });

    await test.step('Vérifier que les 3 cartes de statistiques (Patients, Médecins, Sécretaires médicaux) sont visibles', async () => {
        await dashboardPage.statisticIsVisible();
    });

    await test.step('Vérifier que les 3 compteurs affichent des nombres valides et non négatifs', async () => {
        await dashboardPage.expectStatisticsAreValidNumbers();
    });
});
