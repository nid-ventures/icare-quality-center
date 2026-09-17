// tests/structure-app-tests/02_consultations/05_verification_modifier_consultation_pediatrique.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { ConsultationPediatriquePage } from '../../../pages/structure/consultation/consultation-pediatrique.page';
import { ConsultationPediatriqueDataGenerator } from '../../../pages/structure/generator/consultation-pediatrique-data-generator';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

test.setTimeout(60000);

test('Modifier la première consultation pédiatrique d’un patient', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const patientPage = new PatientPage(page);
    const consultationPage = new ConsultationPediatriquePage(page);

    const updatedData = ConsultationPediatriqueDataGenerator.generateUpdatedData();

    await test.step('Ouverture de la page de connexion', async () => {
        await loginPage.goto();
        await loginPage.login(adminUser.username, adminUser.password);
        await loginPage.selectStructure(adminUser.hi);
    })

    await test.step("Vérifier que le dashboard affiche les statistiques", async () => {
        await dashboardPage.statisticIsVisible();
    })

    await test.step("Choisir le premier patient de la liste des patients", async () => {
        await patientPage.chooseFirstPatient();
    })

    await test.step('Onglet Consultation', async () => {
        await consultationPage.goToConsultationTab();
        await consultationPage.expectConsultationsListLoaded();
    });

    await test.step('Filtrer pour afficher les consultations pédiatriques', async () => {
        await consultationPage.filterByConsultationType('CONSULTATION PÉDIATRIQUE');
        await expect(page.locator('app-consultations').getByRole('button', { name: /Consultation/ }).first()).toBeVisible();
    });

    await test.step('Ouvrir la première consultation', async () => {
        await consultationPage.openFirstConsultation();
        await consultationPage.expectPediatriqueFormLoaded();
    });

    await test.step('Activer le formulaire', async () => {
        // activateForm() attend déjà que les champs deviennent modifiables.
        await consultationPage.activateForm();
    });

    await test.step('Modifier les champs', async () => {
        await consultationPage.fillUpdatedPediatriqueForm(updatedData);
    });

    await test.step('Sauvegarder', async () => {
        await consultationPage.updateConsultation();
        await expect(consultationPage.confirmButton).not.toBeVisible();
    });

    await test.step('Filtrer pour afficher les consultations pédiatriques', async () => {
        await consultationPage.filterByConsultationType('CONSULTATION PÉDIATRIQUE');
        await expect(page.locator('app-consultations').getByRole('button', { name: /Consultation/ }).first()).toBeVisible();
    });
});
