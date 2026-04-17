import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { ConsultationPage } from '../../../pages/structure/consultation/consultation.page';
import { ConsultationStandardDataGenerator } from '../../../pages/structure/generator/consultation-standard-data-generator';

const adminUser = {
    username: 'hi-admin',
    hicode: 'NEST',
    password: 'BcIsX7V&ZRh7',
};

test.setTimeout(60000);

test('Modifier la première consultation d’un patient', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const patientPage = new PatientPage(page);
    const consultationPage = new ConsultationPage(page);

    // Génération des données de modification
    const updatedData = ConsultationStandardDataGenerator.generateUpdatedData();

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

    await test.step('Filtrer pour afficher les consultations (optionnel)', async () => {
        // Exemple : filtrer par type de consultation (selon votre UI)
        await consultationPage.filterByConsultationType('CONSULTATION ANESTHÉSIQUE');
        await page.waitForTimeout(2000);
    });

    await test.step('Sélectionner la première consultation', async () => {
        await consultationPage.selectFirstConsultation();
        await page.waitForTimeout(2000);

    });

    await test.step('Activer le formulaire de modification', async () => {
        await consultationPage.activateForm();
        await page.waitForTimeout(2000);

    });

    await test.step('Modifier les champs avec des données générées', async () => {
        await consultationPage.fillUpdatedForm(updatedData);
        await page.waitForTimeout(2000);

    });

    await test.step('Enregistrer les modifications', async () => {
        await consultationPage.updateConsultation();
        await page.waitForTimeout(2000);

    });

});