// tests/structure-app-tests/10_my_space/06_verification_modifier_configuration_facture.ts
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

// NOTE : comme pour hi-details, confirmer la modale d'avertissement déclencherait une VRAIE mise à
// jour de la configuration de facture ET une déconnexion forcée (authService.logout() en cas de
// succès, cf. invoice.component.ts). Ce test s'arrête donc à la vérification de la modale de
// confirmation puis l'annule via "Fermer" (jamais "Confirmer").
test(`Vérification de la modification de la configuration de facture par l'utilisateur ${adminUser.role}`, async ({ page }) => {
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

    await test.step('Ouvrir la carte "Configuration de facture"', async () => {
        await configurationPage.openInvoiceSection();
    });

    let originalFooter = '';
    await test.step('Activer la modification et modifier l\'en-tête / le pied de page', async () => {
        await configurationPage.enableInvoiceForm();
        originalFooter = await configurationPage.getInvoiceFooter();
        await configurationPage.fillInvoiceHeaderAndFooter('En-tête QA', 'Pied de page QA');
    });

    await test.step('Enregistrer : vérifier l\'apparition de la modale de confirmation puis l\'annuler', async () => {
        await configurationPage.saveInvoiceAndExpectConfirmation();
        await configurationPage.dismissWarningModal();
    });

    await test.step('Annuler l\'édition : le formulaire redevient désactivé et reprend le pied de page d\'origine', async () => {
        await configurationPage.cancelInvoiceEdit();
        const footerAfterCancel = await configurationPage.getInvoiceFooter();
        expect(footerAfterCancel).toBe(originalFooter);
    });

    await test.step('Refermer la carte "Configuration de facture"', async () => {
        await configurationPage.closeInvoiceSection();
    });
});
