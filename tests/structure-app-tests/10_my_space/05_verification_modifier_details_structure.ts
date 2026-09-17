// tests/structure-app-tests/10_my_space/05_verification_modifier_details_structure.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { DashboardPage } from '../../../pages/structure/patient/dashboard.page';
import { MyConfigurationPage } from '../../../pages/structure/my-space/configuration.page';

const adminUser = {
    username: 'hi-admin@gmail.com',
    hi: 'NEST FOR ALL',
    password: 'BcIsX7V&ZRh7',
    role: 'Administrateur'
};

// NOTE : confirmer la modale d'avertissement qui suit "Enregistrer" déclencherait une VRAIE mise à
// jour des détails de la structure ET une déconnexion forcée (authService.logout() en cas de succès,
// cf. hi-details.component.ts). Ce test vérifie donc que la modale de confirmation apparaît avec le
// bon message puis l'annule via "Fermer" (jamais "Confirmer"), à l'instar de la modale d'export.
test(`Vérification de la modification des détails de la structure par l'utilisateur ${adminUser.role}`, async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const configurationPage = new MyConfigurationPage(page);

    await test.step('Ouverture de la page de connexion et connexion', async () => {
        await loginPage.goto();
        await loginPage.login(adminUser.username, adminUser.password);
        await loginPage.selectStructure(adminUser.hi);
    });

    await test.step('Accéder à l\'espace paramétrage', async () => {
        await dashboardPage.goToConfiguration();
        await configurationPage.expectLoaded();
    });

    await test.step('Ouvrir la carte "Détails de la structure"', async () => {
        await configurationPage.openDetailsSection();
    });

    let originalName = '';
    await test.step('Activer le formulaire et modifier le nom', async () => {
        await configurationPage.enableHiDetailsForm();
        originalName = await configurationPage.getHiDetailsName();
        await configurationPage.fillHiDetailsName(`${originalName} QA`);
        // "primaryEmail" est vide sur cette structure de test : champ requis qui bloquerait
        // "Enregistrer" indépendamment de la modification du nom.
        await configurationPage.ensureHiDetailsEmailFilled('qa-structure@icaresenegal.com');
    });

    await test.step('Enregistrer : vérifier l\'apparition de la modale de confirmation puis l\'annuler', async () => {
        await configurationPage.saveHiDetailsAndExpectConfirmation();
        await configurationPage.dismissWarningModal();
    });

    await test.step('Annuler l\'édition : le formulaire redevient désactivé et reprend le nom d\'origine', async () => {
        await configurationPage.cancelHiDetailsEdit();
        const nameAfterCancel = await configurationPage.getHiDetailsName();
        expect(nameAfterCancel).toBe(originalName);
    });

    await test.step('Refermer la carte "Détails de la structure"', async () => {
        await configurationPage.closeDetailsSection();
    });
});
