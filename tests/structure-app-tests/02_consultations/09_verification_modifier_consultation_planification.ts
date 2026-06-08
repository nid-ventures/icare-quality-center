// tests/structure-app-tests/02_consultations/08_verification_modifier_consultation_planification.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { ConsultationPlanificationPage } from '../../../pages/structure/consultation/consultation-planification.page';
import { ConsultationPlanificationDataGenerator } from '../../../pages/structure/generator/consultation-planification-data-generator';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

test.setTimeout(60000);

test('Modifier la première consultation de planification familiale d’un patient', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const patientPage = new PatientPage(page);
    const consultationPage = new ConsultationPlanificationPage(page);

    const updatedData = ConsultationPlanificationDataGenerator.generateUpdatedData();

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

    await test.step('Filtrer pour afficher les consultations de planification familiale', async () => {
        await consultationPage.filterByConsultationType('CONSULTATION PLANIFICATION');
        await page.waitForTimeout(2000);
    });

    await test.step('Ouvrir la première consultation', async () => {
        await consultationPage.openFirstConsultation();
    });

    await test.step('Activer le formulaire', async () => {
        await consultationPage.activateForm();
    });

    await test.step('Modifier les champs', async () => {
        await consultationPage.fillUpdatedPlanificationForm(updatedData);
        await page.waitForTimeout(2000);
    });

    await test.step('Sauvegarder', async () => {
        await consultationPage.updateConsultation();
        await page.waitForTimeout(2000);
    });

    await test.step('Filtrer pour afficher les consultations modifiées', async () => {
        await consultationPage.filterByConsultationType('CONSULTATION PLANIFICATION');
        await page.waitForTimeout(2000);
    });
});