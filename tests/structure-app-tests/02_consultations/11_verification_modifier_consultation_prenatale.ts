// tests/structure-app-tests/02_consultations/12_verification_modifier_consultation_prenatale.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { ConsultationPrenatalPage } from '../../../pages/structure/consultation/consultation-prenatal.page';
import { ConsultationPrenatalDataGenerator } from '../../../pages/structure/generator/consultation-prenatal-data-generator';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

test.setTimeout(60000);

test('Modifier la première consultation prénatale d’un patient', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const patientPage = new PatientPage(page);
    const consultationPage = new ConsultationPrenatalPage(page);

    const updatedData = ConsultationPrenatalDataGenerator.generateUpdatedData();

    await test.step('Ouverture de la page de connexion', async () => {
        await loginPage.goto();
        await loginPage.login(adminUser.username, adminUser.password);
        await loginPage.selectStructure(adminUser.hi);
    });

    await test.step("Vérifier que le dashboard affiche les statistiques", async () => {
        await dashboardPage.statisticIsVisible();
    });

    await test.step("Choisir le premier patient de la liste des patients", async () => {
        await patientPage.chooseFirstPatient();
    });

    await test.step('Onglet Consultation', async () => {
        await consultationPage.goToConsultationTab();
        await consultationPage.expectConsultationsListLoaded();
    });

    await test.step('Filtrer les consultations prénatales', async () => {
        await consultationPage.filterByConsultationType('CONSULTATION PRÉNATALE');
        await page.waitForTimeout(2000);
    });

    await test.step('Ouvrir la première consultation', async () => {
        await consultationPage.openFirstConsultation();
    });

    await test.step('Activer le formulaire', async () => {
        await consultationPage.activateForm();
    });

    await test.step('Modifier les champs', async () => {
        await consultationPage.fillUpdatedPrenatalForm(updatedData);
        await page.waitForTimeout(2000);
    });

    await test.step('Sauvegarder', async () => {
        await consultationPage.updateConsultation();
        await page.waitForTimeout(2000);
    });

    await test.step('Filtrer pour afficher les consultations modifiées', async () => {
        await consultationPage.filterByConsultationType('CONSULTATION PRÉNATALE');
        await page.waitForTimeout(2000);
    });
});