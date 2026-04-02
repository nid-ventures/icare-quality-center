import { test, expect } from '@playwright/test';

test('Cliquer et vérifier le dashboard de la première ligne de la liste des patients', async ({ page }) => {
  // Connexion
  await page.goto('https://pro-icare.com/auth/login');
  await page.getByRole('textbox', { name: 'Votre identifiant' }).fill('hi-admin');
  await page.getByRole('textbox', { name: 'Votre HI CODE' }).fill('NEST');
  await page.getByRole('textbox', { name: 'Votre mot de passe' }).fill('BcIsX7V&ZRh7');
  await page.getByRole('button', { name: 'Connexion' }).click();

  // Attendre la page d'accueil et ouvrir le menu
  await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();
  await page.getByText('Menu').nth(3).click();
  await page.getByRole('link', { name: ' Patients' }).click();
  await page.waitForURL('**/patient/patients');

  // Attendre que le tableau soit chargé
  await expect(page.locator('.compact-table tbody tr:first-child')).toBeVisible();

  // Cliquer sur la première ligne (n'importe quelle cellule de la ligne)
  // On peut cliquer sur la première cellule (identifiant) ou sur toute la ligne
  const firstRow = page.locator('.compact-table tbody tr:first-child');
  await firstRow.click();

  // Vérifier que la page du patient s'affiche
  await expect(page.getByRole('heading', { name: 'Informations Administratives' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Identité Médicale' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Antécédents' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Prestation Médicale' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Parcours de soins' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Informations Utiles' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Voir Détails Administratifs' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Dernières activités' })).toBeVisible();
});