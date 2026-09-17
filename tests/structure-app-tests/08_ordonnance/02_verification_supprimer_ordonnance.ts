// tests/structure-app-tests/08_ordonnance/02_verification_supprimer_ordonnance.ts
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

test('Supprimer une ordonnance', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const patientPage = new PatientPage(page);
    const ordonnancePage = new OrdonnancePage(page);

    const ordonnanceData: OrdonnanceData = {
        title: `Ordonnance à supprimer ${Date.now()}`,
        medicationName: 'Amoxicilline',
        posologie: '1 gélule 3 fois par jour',
        remarques: 'Terminer le traitement',
        recommandations: 'Revoir en consultation si absence d\'amélioration'
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

    await test.step('Créer une ordonnance de référence à supprimer', async () => {
        await ordonnancePage.createOrdonnance(ordonnanceData);
        await expect(ordonnancePage.firstOrdonnanceHeader).toBeVisible();
    });

    await test.step('Supprimer cette ordonnance', async () => {
        await ordonnancePage.deleteFirstOrdonnance();
    });

    await test.step('Vérifier que la suppression a réussi', async () => {
        await expect(ordonnancePage.ordonnanceDeletedToast).toBeVisible();
    });
});
