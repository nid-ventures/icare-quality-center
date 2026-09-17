// tests/structure-app-tests/03_imagerie/03_verification_modifier_echographie.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { ImagerieDashboardPage } from '../../../pages/structure/imagerie/imagerie-dashboard.page';
import { ImagingWorklistPage } from '../../../pages/structure/imagerie/imaging-worklist.page';
import { ImagingDataGenerator } from '../../../pages/structure/generator/imaging-data-generator';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

test.setTimeout(90000);

test('Modifier une échographie depuis le worklist', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const patientPage = new PatientPage(page);
    const imagerieDashboardPage = new ImagerieDashboardPage(page);
    const worklistPage = new ImagingWorklistPage(page);

    const echographieData = ImagingDataGenerator.generateEchographie();
    const updatedData = ImagingDataGenerator.generateEchographieUpdate();
    let patientFirstName = '';
    let patientLastName = '';
    let found: Awaited<ReturnType<typeof worklistPage.findFirstRowOfKind>> = null;

    await test.step('Ouverture de la page de connexion', async () => {
        await loginPage.goto();
        await loginPage.login(adminUser.username, adminUser.password);
        await loginPage.selectStructure(adminUser.hi);
    });

    await test.step('Vérifier que le dashboard affiche les statistiques', async () => {
        await dashboardPage.statisticIsVisible();
    });

    await test.step('Relever le nom du premier patient de la liste', async () => {
        await patientPage.gotoPatientsList();
        patientFirstName = await patientPage.getFirstPatientFirstName();
        patientLastName = await patientPage.getFirstPatientLastName();
    });

    await test.step('Choisir le premier patient de la liste des patients', async () => {
        await patientPage.chooseFirstPatient();
    });

    await test.step("Accéder au dashboard d'imagerie du patient", async () => {
        await imagerieDashboardPage.gotoFromPatientDashboard();
    });

    await test.step('Créer une échographie de référence à modifier', async () => {
        await imagerieDashboardPage.openNewActeModal();
        await imagerieDashboardPage.chooseType('ECHOGRAPHIE');
        await imagerieDashboardPage.fillEchographieCreateForm(echographieData);
        await imagerieDashboardPage.submitEchographieCreateForm();
        await expect(imagerieDashboardPage.confirmButton).not.toBeVisible();
    });

    await test.step("Accéder au worklist d'imagerie", async () => {
        await worklistPage.goto();
    });

    await test.step('Rechercher les actes du patient', async () => {
        await worklistPage.searchByFirstAndLastName(patientFirstName, patientLastName);
    });

    await test.step('Déplier la première échographie trouvée', async () => {
        found = await worklistPage.findFirstRowOfKind('echographie');
        expect(found).not.toBeNull();
    });

    await test.step('Activer le formulaire de modification', async () => {
        await worklistPage.echoActiverButton(found!.expandedRow).click();
    });

    await test.step('Modifier le résumé et le compte-rendu', async () => {
        const resumeInput = worklistPage.echoResumeInput(found!.expandedRow);
        const compteRenduTextarea = worklistPage.echoCompteRenduTextarea(found!.expandedRow);

        if (await resumeInput.isVisible().catch(() => false)) {
            await resumeInput.fill(updatedData.resume);
        }
        if (await compteRenduTextarea.isVisible().catch(() => false)) {
            await compteRenduTextarea.fill(updatedData.compteRendu);
        }
    });

    await test.step('Enregistrer la modification', async () => {
        await worklistPage.echoSubmitButton(found!.expandedRow).click();
        await worklistPage.confirmModal();
        await expect(worklistPage.confirmButton).not.toBeVisible();
    });
});
