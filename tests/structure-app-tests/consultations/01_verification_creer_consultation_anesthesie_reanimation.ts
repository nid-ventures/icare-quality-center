// tests/structure-app-tests/22_verification_creer_consultation.ts
import { test, expect } from '@playwright/test';
import { ConsultationData, ConsultationDataGenerator } from '../../../pages/structure/generator/consultation-data-generator';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { ConsultationPage } from '../../../pages/structure/consultation/consultation.page';

const adminUser = {
    username: 'hi-admin',
    hicode: 'NEST',
    password: 'BcIsX7V&ZRh7',
};

test('Créer une consultation pour un patient', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const patientPage = new PatientPage(page);
    const consultationPage = new ConsultationPage(page);

    const consultationData: ConsultationData = ConsultationDataGenerator.generate();

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

    await test.step('Accéder à l’onglet Consultation', async () => {
        await consultationPage.goToConsultationTab();
        await consultationPage.expectConsultationsListLoaded();
    });

    await test.step('Ouvrir le modal de nouvelle consultation', async () => {
        await consultationPage.openNewConsultationModal();
    });

    await test.step('Remplir spécialité et type de consultation', async () => {
        await consultationPage.fillConsultationBasics(consultationData);
    });

    await test.step('Créer la consultation', async () => {
        await consultationPage.createConsultation();
    });

    await test.step('Remplir le formulaire médical détaillé', async () => {
        await consultationPage.fillMedicalConsultationForm(consultationData);
    });

    await test.step('Enregistrer la consultation', async () => {
        await consultationPage.saveConsultation();
    });

    await test.step(`Vérifier que la consultation ${consultationData.consultationType} apparaît dans la liste (optionnel)`, async () => {
        // Exemple : filtrer par type de consultation
        await consultationPage.filterByConsultationType(consultationData.consultationType);
        // Pause de 5 secondes pour inspection visuelle
        await page.waitForTimeout(5000);
    });
});