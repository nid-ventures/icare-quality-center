// tests/structure-app-tests/consultations/06_verification_supprimer_consultation_pediatrique.ts
import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { ConsultationPediatriquePage } from '../../../pages/structure/consultation/consultation-pediatrique.page';


const adminUser = {
    username: 'hi-admin',
    hicode: 'NEST',
    password: 'BcIsX7V&ZRh7',
};

test.setTimeout(60000);

test('Supprimer la première consultation pédiatrique d’un patient', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const patientPage = new PatientPage(page);
    const consultationPage = new ConsultationPediatriquePage(page);

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

    await test.step('Onglet Consultation', async () => {
        await consultationPage.goToConsultationTab();
        await consultationPage.expectConsultationsListLoaded();
    });

    await test.step('Filtrer les consultations pédiatriques', async () => {
        await consultationPage.filterByConsultationType('CONSULTATION PÉDIATRIQUE');
        await page.waitForTimeout(2000);
    });

    await test.step('Ouvrir la première consultation', async () => {
        await consultationPage.openFirstConsultation();
    });

    await test.step('Supprimer la consultation', async () => {
        await consultationPage.deleteConsultation();
        await page.waitForTimeout(2000);

        await page.reload();
        await consultationPage.expectConsultationsListLoaded();
    });
    await test.step('Filtrer les consultations pédiatriques', async () => {
        await consultationPage.filterByConsultationType('CONSULTATION PÉDIATRIQUE');
        await page.waitForTimeout(2000);
    });

});