// tests/structure-app-tests/10_my_space/03_verification_export_modal_reporting.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { MedicalActsReportingPage } from '../../../pages/structure/my-space/reporting.page';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

// NOTE : on ne clique JAMAIS "Télécharger" dans ce test (déclencherait un vrai export/téléchargement
// de fichier) : chaque étape (source / période / format) est vérifiée dans l'UI, puis la modale est
// fermée via "Annuler".
test(`Vérification de la modale d'export du Reporting Médical par l'utilisateur ${adminUser.role}`, async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const reportingPage = new MedicalActsReportingPage(page);

    await test.step('Ouverture de la page de connexion et connexion', async () => {
        await loginPage.goto();
        await loginPage.login(adminUser.username, adminUser.password);
        await loginPage.selectStructure(adminUser.hi);
    });

    await test.step('Accéder au Reporting Médical (Prestations)', async () => {
        await dashboardPage.goToReportingPrestations();
        await reportingPage.expectLoaded();
    });

    await test.step('Ouvrir la modale d\'export : source par défaut = Consultations, format par défaut = Excel', async () => {
        await reportingPage.openExportModal();
        await reportingPage.expectExportSourceActive('Consultations');
        await reportingPage.expectExportFormatActive('Excel');
        await reportingPage.expectExportSummary(/Export\s*:\s*Consultations\s+en\s+Excel/);
    });

    await test.step('Étape 1 - Source : choisir Imagerie', async () => {
        await reportingPage.selectExportSource('Imagerie');
        await reportingPage.expectExportSourceActive('Imagerie');
        await reportingPage.expectExportSubCategorySelectVisible();
        await reportingPage.expectExportSummary(/Export\s*:\s*Imagerie/);
    });

    await test.step('Étape 2 - Période : choisir le préréglage "Mois dernier"', async () => {
        const initialRange = await reportingPage.getExportDateRange();
        await reportingPage.selectExportPeriodPreset('Mois dernier');
        const updatedRange = await reportingPage.getExportDateRange();
        expect(updatedRange.start).not.toBe(initialRange.start);
        expect(new Date(updatedRange.start).getTime()).toBeLessThanOrEqual(new Date(updatedRange.end).getTime());
    });

    await test.step('Étape 3 - Format : choisir CSV puis DHIS2 (affiche les champs DHIS2)', async () => {
        await reportingPage.selectExportFormat('CSV');
        await reportingPage.expectExportFormatActive('CSV');
        await reportingPage.expectExportSummary(/en\s+CSV/);

        await reportingPage.selectExportFormat('DHIS2');
        await reportingPage.expectExportFormatActive('DHIS2');
        await reportingPage.expectDhis2FieldsVisible();

        await reportingPage.selectExportFormat('Excel');
        await reportingPage.expectExportFormatActive('Excel');
        await reportingPage.expectDhis2FieldsHidden();
    });

    await test.step('Fermer la modale via "Annuler" (sans télécharger)', async () => {
        await reportingPage.closeExportModalViaAnnuler();
    });
});
