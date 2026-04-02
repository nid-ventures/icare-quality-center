import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://pro-icare.com/auth/login');

  // Saisie des identifiants
  await page.getByRole('textbox', { name: 'Votre identifiant' }).fill('hi-admin');
  await page.getByRole('textbox', { name: 'Votre HI CODE' }).fill('NEST');
  await page.getByRole('textbox', { name: 'Votre mot de passe' }).fill('BcIsX7V&ZRh7');

  // Connexion
  await page.getByRole('button', { name: 'Connexion' }).click();

  // Attendre que la page d'accueil soit chargée (par exemple présence du menu)
  await page.waitForSelector('.iq-sidebar-menu', { timeout: 10000 });

  // Ouvrir le menu (3e élément "Menu")
  await page.getByText('Menu').nth(3).click();

  // Cliquer sur le lien Patients et attendre la navigation
  await Promise.all([
    page.waitForURL('**/patient/patients'),
    page.getByRole('link', { name: ' Patients' }).click()
  ]);

  // Vérifications de la présence des éléments sur la page Patients
  await expect(page.getByText('Identifiant patient')).toBeVisible();
  await expect(page.locator('label').filter({ hasText: 'N° Dossier' })).toBeVisible();
  await expect(page.locator('label').filter({ hasText: /^Prénom$/ })).toBeVisible();
  await expect(page.locator('label').filter({ hasText: /^Nom$/ })).toBeVisible();
  await expect(page.locator('label').filter({ hasText: /^Date de naissance$/ })).toBeVisible();
  await expect(page.locator('label').filter({ hasText: /^Email$/ })).toBeVisible();
  await expect(page.locator('label').filter({ hasText: /^Sexe$/ })).toBeVisible();
  await expect(page.locator('label').filter({ hasText: /^Ville$/ })).toBeVisible();
  await expect(page.locator('label').filter({ hasText: 'Assurance' })).toBeVisible();
  await expect(page.locator('label').filter({ hasText: 'Date de création' })).toBeVisible();
  await expect(page.locator('label').filter({ hasText: /^Téléphone$/ })).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Liste des patients' })).toBeVisible();
  await expect(page.getByRole('button', { name: ' Réinitialiser' })).toBeVisible();
  await expect(page.getByRole('button', { name: ' Rechercher' })).toBeVisible();
  await expect(page.locator('ng-select').filter({ hasText: '× 20' }).getByRole('combobox')).toBeVisible();
  await expect(page.getByRole('button', { name: ' Nouveau patient' })).toBeVisible();

  // En-têtes du tableau
  await expect(page.getByRole('columnheader', { name: 'Identifiant' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'N° Dossier' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Prénom' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Nom', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Date de naissance' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Téléphone' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Email' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Ville' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Sexe' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Assurance' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Date de création' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Action' })).toBeVisible();

  // Pagination
  await expect(page.getByText('Précédent')).toBeVisible();
  await expect(page.getByText('Suivant')).toBeVisible();
});