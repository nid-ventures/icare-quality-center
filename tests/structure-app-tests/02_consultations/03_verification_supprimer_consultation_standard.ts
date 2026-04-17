import { test, expect } from '@playwright/test'; import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { ConsultationPage } from '../../../pages/structure/consultation/consultation.page';
;

const adminUser = {
    username: 'hi-admin',
    hicode: 'NEST',
    password: 'BcIsX7V&ZRh7',
};

test.setTimeout(60000);

test('Supprimer la première consultation d’un patient', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const patientPage = new PatientPage(page);
    const consultationPage = new ConsultationPage(page);

    await test.step('Ouverture de la page de connexion', async () => {
        await loginPage.goto();
    })
    await test.step('connexion', async () => {
        await loginPage.login(adminUser.username, adminUser.hicode, adminUser.password);
    })
    await test.step("Vérifier que le  dashboard affiche les statistiques ", async () => {
        await dashboardPage.statisticIsVisible();
    })
    await test.step("Choisir le premier patient de la liste des patients", async () => {
        await patientPage.chooseFirstPatient();
    })

    await test.step('Aller dans l’onglet Consultation', async () => {
        await consultationPage.goToConsultationTab();
        await consultationPage.expectConsultationsListLoaded();
    });

    await test.step('Filtrer pour afficher les consultations ', async () => {
        // Exemple : filtrer par type
        await consultationPage.filterByConsultationType('CONSULTATION ANESTHÉSIQUE');
        await page.waitForTimeout(2000);
    });

    await test.step('Ouvrir la première consultation', async () => {
        await consultationPage.openFirstConsultation();
    });

    await test.step('Supprimer la consultation', async () => {
        await consultationPage.deleteConsultation();
        await page.waitForTimeout(2000);


    });
    await test.step('Actualiser la page consultations', async () => {
        await page.reload();
        await consultationPage.expectConsultationsListLoaded();
    });
    await test.step('Filtrer pour afficher les consultations à nouveau après suppression .........', async () => {
        // Exemple : filtrer par type
        await consultationPage.filterByConsultationType('CONSULTATION ANESTHÉSIQUE');
        await page.waitForTimeout(2000);
    });

});