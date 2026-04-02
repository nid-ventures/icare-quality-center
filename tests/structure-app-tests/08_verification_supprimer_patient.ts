import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://pro-icare.com/auth/login');
  await page.getByRole('textbox', { name: 'Votre mot de passe' }).click();
  await page.getByRole('textbox', { name: 'Votre mot de passe' }).fill('BcIsX7V&ZRh7');
  await page.getByRole('textbox', { name: 'Votre HI CODE' }).click();
  await page.getByRole('textbox', { name: 'Votre HI CODE' }).fill('NEST');
  await page.getByRole('textbox', { name: 'Votre identifiant' }).click();
  await page.getByRole('textbox', { name: 'Votre identifiant' }).fill('hi-admin');
  await page.getByRole('button', { name: 'Connexion' }).click();
  await page.getByText('Menu').nth(3).click();
  await page.getByRole('link', { name: ' Patients' }).click();
  await page.goto('https://pro-icare.com/patient/patients');
  await page.locator('.compact-table tbody tr:first-child .btn-danger').first().click();
//  await page.getByRole('button', { name: 'Confirmer' }).click();
  // Confirmer la suppression dans la modale
  await expect(page.getByRole('button', { name: 'Confirmer' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmer' }).click();

  // Optionnel : vérifier que la suppression a bien eu lieu
  // Par exemple, attendre que la ligne ait disparu (ou que le nombre de lignes diminue)
  // Ici nous attendons simplement que la modale se ferme
  await expect(page.locator('.modal:has-text("Confirmer")')).toBeHidden();
});