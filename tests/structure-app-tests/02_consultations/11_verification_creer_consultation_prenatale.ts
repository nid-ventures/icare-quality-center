// tests/structure-app-tests/02_consultations/11_verification_creer_consultation_prenatale.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { ConsultationPrenatalPage } from '../../../pages/structure/consultation/consultation-prenatal.page';
import { ConsultationPrenatalData, ConsultationPrenatalDataGenerator } from '../../../pages/structure/generator/consultation-prenatal-data-generator';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

test('Créer une consultation prénatale pour un patient', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const patientPage = new PatientPage(page);
    const consultationPage = new ConsultationPrenatalPage(page);
    const consultationData: ConsultationPrenatalData = ConsultationPrenatalDataGenerator.generate();

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

    await test.step('Ouvrir modal nouvelle consultation', async () => {
        await consultationPage.openNewConsultationModal();
    });

    await test.step('Remplir spécialité et type (gynécologie / prénatale)', async () => {
        await consultationPage.fillConsultationBasics({
            specialty: consultationData.specialty,
            consultationType: consultationData.consultationType
        });
    });

    await test.step('Créer la consultation', async () => {
        await consultationPage.createConsultation();
        await consultationPage.expectPrenatalFormLoaded();
    });

    await test.step('Remplir le formulaire prénatal', async () => {
        await consultationPage.fillPrenatalForm(consultationData);
    });

    await test.step('Enregistrer la consultation', async () => {
        await consultationPage.saveConsultation();
    });

    await test.step('Filtrer pour afficher la consultation créée', async () => {
        await consultationPage.filterByConsultationType('CONSULTATION PRÉNATALE');
        await page.waitForTimeout(2000);
    });
});