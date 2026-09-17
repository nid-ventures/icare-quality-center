// tests/structure-app-tests/12_prsnl_infos/01_verification_pages_politique.ts
import { test } from '@playwright/test';
import { LoginPage } from '../../../pages/structure/patient/login.page';
import { PrsnlInfosPage } from '../../../pages/structure/prsnl-infos/prsnl-infos.page';

// Données de test
const adminUser = {
  username: 'hi-admin@gmail.com',
  hi: 'NEST FOR ALL',
  password: 'BcIsX7V&ZRh7',
  role: 'Administrateur'
};

test('Vérification des pages Politique de confidentialité et CGU', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const prsnlInfosPage = new PrsnlInfosPage(page);

  await test.step('Ouverture de la page de connexion', async () => {
    await loginPage.goto();
  });
  await test.step('connexion', async () => {
    await loginPage.login(adminUser.username, adminUser.password);
  });
  await test.step('Sélection de la structure', async () => {
    await loginPage.selectStructure(adminUser.hi);
  });

  await test.step('Ouvrir la page de politique via le lien de pied de page', async () => {
    await prsnlInfosPage.openFromFooterLink();
  });

  await test.step("Vérifier que l'onglet Politique de confidentialité est visible", async () => {
    await prsnlInfosPage.expectPcdTabContentVisible();
  });

  await test.step("Ouvrir l'onglet Conditions générales d'utilisation et vérifier son contenu", async () => {
    await prsnlInfosPage.openCguTab();
    await prsnlInfosPage.expectCguTabContentVisible();
  });
});
