// tests/structure-app-tests/06_analyse/02_verification_creer_bilan_et_analyse.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { HealthChecksListPage, HealthCheckDetailPage } from '../../../pages/structure/analyse/health-check.page';
import { HealthCheckDataGenerator } from '../../../pages/structure/generator/health-check-data-generator';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

test.setTimeout(60000);

test('Créer un bilan et y ajouter une analyse pour un patient', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const patientPage = new PatientPage(page);
    const healthChecksListPage = new HealthChecksListPage(page);
    const healthCheckDetailPage = new HealthCheckDetailPage(page);

    await test.step('Ouverture de la page de connexion', async () => {
        await loginPage.goto();
        await loginPage.login(adminUser.username, adminUser.password);
        await loginPage.selectStructure(adminUser.hi);
    });

    await test.step('Vérifier que le dashboard affiche les statistiques', async () => {
        await dashboardPage.statisticIsVisible();
    });

    await test.step('Choisir le premier patient de la liste des patients', async () => {
        await patientPage.chooseFirstPatient();
    });

    await test.step("Aller sur la liste des bilans d'analyses du patient", async () => {
        await healthChecksListPage.goToHealthChecksList();
    });

    let ordersBefore: string[] = [];
    await test.step('Relever les bilans déjà existants', async () => {
        ordersBefore = await healthChecksListPage.getBilanOrderNumbers();
    });

    await test.step('Ouvrir le formulaire de création "Nouveau bilan"', async () => {
        await healthChecksListPage.openNewBilanModal();
    });

    await test.step('Remplir et enregistrer le nouveau bilan', async () => {
        await healthChecksListPage.selectFirstPrescripteur();
        await healthChecksListPage.selectFirstTypeBilan();
        await healthChecksListPage.fillDiagnostic(HealthCheckDataGenerator.generateDiagnostic());
        await healthChecksListPage.saveBilan();
    });

    let newBilanOrder = '';
    await test.step('Identifier le bilan nouvellement créé dans la liste', async () => {
        const ordersAfter = await healthChecksListPage.getBilanOrderNumbers();
        const newOrder = ordersAfter.find(order => !ordersBefore.includes(order));
        expect(newOrder, `Aucun nouveau N° de bulletin trouvé. Avant: ${JSON.stringify(ordersBefore)}, après: ${JSON.stringify(ordersAfter)}`).toBeTruthy();
        newBilanOrder = newOrder!;
    });

    await test.step('Ouvrir le détail du bilan créé', async () => {
        await healthChecksListPage.openBilanByOrderNumber(newBilanOrder);
        await healthCheckDetailPage.expectDetailLoaded();
    });

    let analyseCountBefore = 0;
    await test.step("Relever le nombre d'analyses avant ajout", async () => {
        analyseCountBefore = await healthCheckDetailPage.getAnalyseRowCount();
    });

    await test.step('Ouvrir le formulaire "Ajouter analyse"', async () => {
        await healthCheckDetailPage.openAddAnalyseModal();
    });

    await test.step("Remplir et enregistrer l'analyse", async () => {
        await healthCheckDetailPage.selectFirstConsultant();
        await healthCheckDetailPage.selectFirstAnalyse();
        await healthCheckDetailPage.saveAnalyse();
    });

    await test.step("Vérifier que l'analyse a bien été ajoutée au bulletin", async () => {
        await healthCheckDetailPage.expectAnalyseRowCount(analyseCountBefore + 1);
    });
});
