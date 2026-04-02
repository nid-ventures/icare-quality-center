import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
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
  
  // Cliquer sur la première ligne (dashboard patient)
  const firstRow = page.locator('.compact-table tbody tr:first-child');
  await firstRow.click();
  await page.getByText('Menu').nth(3).click();

  // Cliquer sur le lien "Voir Détails Administratifs"
  const detailsLink = page.locator('#button_details');
  await expect(detailsLink).toBeVisible();
  await detailsLink.click();
  
  // Vérifier que la page des détails administratifs est chargée
  // On peut vérifier la présence des onglets, par exemple
  await expect(page.getByRole('tab', { name: ' Détails' })).toBeVisible();
  await expect(page.getByRole('tab', { name: ' Personne à contacter' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Prise en charge' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Activer le formulaire' })).toBeVisible();
  
  // Activer le formulaire
  await page.getByRole('button', { name: 'Activer le formulaire' }).click();
  
  // Attendre que les champs deviennent éditables (par exemple, le champ date de naissance)
  await expect(page.locator('input[name="doB"]')).toBeEditable();
  
  // Modifier la date de naissance
  await page.locator('input[name="doB"]').fill('2026-04-05');
  
  // Modifier la ville (premier ng-select) – adapter selon le besoin
  // Ici on suppose que le premier ng-select correspond à la ville
  const citySelect = page.locator('ng-select').first();
  await citySelect.click();
  await page.getByRole('option', { name: 'SAINT-LOUIS' }).click();
  
  // Modifier la région/état (second ng-select) – adapter
  const stateSelect = page.locator('#state');
  await stateSelect.click();
  await page.getByRole('option', { name: 'KÉDOUGOU' }).click();
  
  // Enregistrer
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  
  // Confirmer la modification dans la modale
  await expect(page.getByRole('button', { name: 'Confirmer' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmer' }).click();
  
});