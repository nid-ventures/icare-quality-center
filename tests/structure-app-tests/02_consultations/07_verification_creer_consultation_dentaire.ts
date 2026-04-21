import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { ConsultationDentairePage } from '../../../pages/structure/consultation/consultation-dentaire.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { ConsultationDentaireDataGenerator, ConsultationDentaireData } from '../../../pages/structure/generator/consultation-dentaire-data-generator';

const adminUser = {
    username: 'hi-admin',
    hicode: 'NEST',
    password: 'BcIsX7V&ZRh7',
};

test('Créer une consultation dentaire pour un patient', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const patientPage = new PatientPage(page);
    const consultationPage = new ConsultationDentairePage(page);
    const consultationData: ConsultationDentaireData = ConsultationDentaireDataGenerator.generate();

    await test.step('Ouverture de la page de connexion', async () => {
        await loginPage.goto();
    });

    await test.step('Connexion', async () => {
        await loginPage.login(adminUser.username, adminUser.hicode, adminUser.password);
    });

    await test.step('Vérifier que le dashboard affiche les statistiques', async () => {
        await dashboardPage.statisticIsVisible();
    });

    await test.step('Choisir le premier patient de la liste des patients', async () => {
        await patientPage.chooseFirstPatient();
    });

    await test.step('Onglet Consultation', async () => {
        await consultationPage.goToConsultationTab();
        await consultationPage.expectConsultationsListLoaded();
    });

    await test.step('Filtrer pour afficher les consultations dentaires existantes', async () => {
        await consultationPage.filterByConsultationType('CONSULTATION DENTAIRE');
        await page.waitForTimeout(2000);
    });

    await test.step('Ouvrir modal nouvelle consultation', async () => {
        await consultationPage.openNewConsultationModal();
    });

    await test.step('Remplir spécialité et type (dentiste)', async () => {

        console.log(consultationData)
        await consultationPage.fillConsultationBasics({
            specialty: consultationData.specialty,
            consultationType: consultationData.consultationType
        });
    });

    await test.step('Créer la consultation', async () => {
        await consultationPage.createConsultation();
        await consultationPage.expectDentaireFormLoaded();
    });

    await test.step('Remplir le formulaire dentaire', async () => {
        await consultationPage.fillDentaireConsultationForm(consultationData);
    });

    await test.step('Enregistrer la consultation', async () => {
        await consultationPage.saveConsultation();
    });

    await test.step('Filtrer pour afficher les consultations dentaires après création', async () => {
        await consultationPage.filterByConsultationType('CONSULTATION DENTAIRE');
        await page.waitForTimeout(2000);
    });
});