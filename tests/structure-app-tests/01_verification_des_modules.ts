import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/structure/login.page';

// Données de test
const adminUser = {
  username: 'hi-admin',
  hicode:'NEST',
  password: 'BcIsX7V&ZRh7',
  role:'Administrateur'
};



test(`Vérification des modules de l'application par l'utilisateur ${adminUser.role}`, async ({ page }) => {
  const loginPage = new LoginPage(page);
  
  await test.step('Ouverture de la page de connexion', async()=> {
    await loginPage.goto();
  })
  await test.step('connexion', async()=> { 
    await loginPage.login(adminUser.username,adminUser.hicode, adminUser.password);
  })
  
  // Vérifier que la page d'accueil affiche les trois sections principales
  await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Médecins' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sécretaires médicaux' })).toBeVisible();

  // Ouvrir le menu latéral (3ème élément "Menu")
  await page.getByText('Menu').nth(3).click();

  // Vérifier la présence des liens principaux du menu
  await expect(page.getByRole('link', { name: ' Dashboard' })).toBeVisible();
  await expect(page.getByRole('link', { name: ' Patients' })).toBeVisible();
  await expect(page.getByRole('link', { name: ' Facturations ' })).toBeVisible();

  // Cliquer sur le menu "Facturations" pour dérouler ses sous-menus
  await page.getByRole('link', { name: ' Facturations ' }).click();

  // Vérifier que les sous-menus de Facturations sont visibles
  await expect(page.getByRole('link', { name: ' Factures-Patient' })).toBeVisible();
  await expect(page.getByRole('link', { name: ' Factures-Garant' })).toBeVisible();

  // Vérifier la présence du lien "Rendez-vous" (visible pour certains rôles)
  await expect(page.getByRole('link', { name: ' Rendez-vous' })).toBeVisible();

  // Vérifier la présence du menu "Honoraires" (visible pour admin avec privilège)
  await expect(page.getByRole('link', { name: ' Honoraires ' })).toBeVisible();

  // Cliquer sur "Honoraires" pour afficher ses sous-menus
  await page.getByRole('link', { name: ' Honoraires ' }).click();

  // Vérifier que le sous-menu "Relevés honoraires" apparaît
  await expect(page.getByRole('link', { name: ' Relevés honoraires' })).toBeVisible();

  // Fermer le menu Facturations (clic à nouveau) pour tester la réouverture
  await page.getByRole('link', { name: ' Facturations ' }).click();

  // Re-cliquer sur "Honoraires" pour refermer (comportement de toggle)
  await page.getByRole('link', { name: ' Honoraires ' }).click();

  // Vérifier la présence du menu "Reporting" (admin uniquement)
  await expect(page.getByRole('link', { name: ' Reporting ' })).toBeVisible();

  // Ouvrir le menu "Reporting"
  await page.getByRole('link', { name: ' Reporting ' }).click();

  // Vérifier que les sous-menus de Reporting sont visibles
  await expect(page.getByRole('link', { name: ' Prestations' })).toBeVisible();
  await expect(page.getByRole('link', { name: ' Liste des actes' })).toBeVisible();

  // Refermer le menu "Reporting"
  await page.getByRole('link', { name: ' Reporting ' }).click();

  // Vérifier les liens "Utilisateurs" et "Paramètres" (admin uniquement)
  await expect(page.getByRole('link', { name: ' Utilisateurs' })).toBeVisible();
  await expect(page.getByRole('link', { name: ' Paramètres' })).toBeVisible();

  // Cliquer sur l'icône utilisateur pour ouvrir le menu de profil
  await page.locator('i').nth(1).click();

 

  console.log('\n✅ Test terminé avec succès');
});