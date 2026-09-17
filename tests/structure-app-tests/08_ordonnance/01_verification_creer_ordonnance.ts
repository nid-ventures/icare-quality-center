// tests/structure-app-tests/08_ordonnance/01_verification_creer_ordonnance.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { OrdonnancePage, OrdonnanceData } from '../../../pages/structure/ordonnance/ordonnance.page';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

test.setTimeout(60000);

test('Créer une ordonnance pour un patient', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const patientPage = new PatientPage(page);
    const ordonnancePage = new OrdonnancePage(page);

    const ordonnanceData: OrdonnanceData = {
        title: `Ordonnance test ${Date.now()}`,
        medicationName: 'Paracétamol',
        posologie: '1 comprimé matin et soir',
        remarques: 'À prendre avec un grand verre d\'eau',
        recommandations: 'Repos et hydratation recommandés'
    };

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

    await test.step('Accéder aux ordonnances du patient', async () => {
        await ordonnancePage.gotoFromPatientDashboard();
    });

    await test.step('Ouvrir la modale de nouvelle ordonnance', async () => {
        await ordonnancePage.openNewOrdonnanceModal();
    });

    await test.step("Remplir le formulaire de l'ordonnance", async () => {
        await ordonnancePage.fillOrdonnanceForm(ordonnanceData);
    });

    await test.step("Enregistrer l'ordonnance", async () => {
        await ordonnancePage.submitOrdonnance();
    });

    await test.step("Vérifier que l'ordonnance apparaît dans la liste", async () => {
        await expect(ordonnancePage.firstOrdonnanceHeader).toBeVisible();
    });
});
