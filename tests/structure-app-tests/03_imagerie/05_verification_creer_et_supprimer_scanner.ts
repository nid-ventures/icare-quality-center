// tests/structure-app-tests/03_imagerie/05_verification_creer_et_supprimer_scanner.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { PatientPage } from '../../../pages/structure/patient/patient.page';
import { ImagerieDashboardPage } from '../../../pages/structure/imagerie/imagerie-dashboard.page';
import { ImagingWorklistPage } from '../../../pages/structure/imagerie/imaging-worklist.page';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

test.setTimeout(90000);

// Test de fumée : vérifie que le composant partagé app-imaging-item (utilisé par scanner, IRM
// et radiographie) fonctionne correctement de bout en bout, en complément des tests dédiés à
// l'échographie qui utilise son propre composant (app-echographie-simple-item).
test('Créer puis supprimer un scanner', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const patientPage = new PatientPage(page);
    const imagerieDashboardPage = new ImagerieDashboardPage(page);
    const worklistPage = new ImagingWorklistPage(page);

    let patientFirstName = '';
    let patientLastName = '';
    let found: Awaited<ReturnType<typeof worklistPage.findFirstRowOfKind>> = null;
    let fingerprint = '';

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

    await test.step('Créer un scanner', async () => {
        await imagerieDashboardPage.openNewActeModal();
        await imagerieDashboardPage.chooseType('SCANNER');
        await imagerieDashboardPage.fillScannerCreateForm();
        await imagerieDashboardPage.submitScannerCreateForm();
        await expect(imagerieDashboardPage.confirmButton).not.toBeVisible();
        await expect(imagerieDashboardPage.newActeButton).toBeVisible();
    });

    await test.step("Accéder au worklist d'imagerie", async () => {
        await worklistPage.goto();
    });

    await test.step('Rechercher les actes du patient', async () => {
        await worklistPage.searchByFirstAndLastName(patientFirstName, patientLastName);
    });

    await test.step('Déplier le premier acte de type scanner/IRM/radiographie trouvé', async () => {
        found = await worklistPage.findFirstRowOfKind('imaging');
        expect(found).not.toBeNull();
        fingerprint = (await found!.row.locator('td').nth(5).innerText()).trim();
    });

    await test.step('Supprimer ce scanner', async () => {
        await worklistPage.imagingSupprimerButton(found!.expandedRow).click();
        await worklistPage.confirmModal();
        await expect(worklistPage.confirmButton).not.toBeVisible();
    });

    await test.step('Vérifier que ce scanner ne réapparaît plus dans la recherche', async () => {
        await worklistPage.searchByFirstAndLastName(patientFirstName, patientLastName);
        const remainingRowsWithFingerprint = page.locator('table.compact-table tbody tr.table-row', { hasText: fingerprint });
        await expect(remainingRowsWithFingerprint).toHaveCount(0);
    });
});
