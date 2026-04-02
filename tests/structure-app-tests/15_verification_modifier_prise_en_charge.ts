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
  
  // Cliquer sur la première ligne (dashboard patient)
  const firstRow = page.locator('.table-striped tbody tr:first-child');
  await firstRow.click();
  await page.getByRole('link', { name: 'Voir Détails Administratifs' }).click();
  await page.getByRole('tab', { name: ' Prise en charge' }).click();
  await expect(page.getByRole('cell', { name: '1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Action' })).toBeVisible();
  await page.getByRole('button', { name: 'Action' }).click();
  await page.getByRole('link', { name: 'Modifier' }).click();
  await expect(page.getByRole('heading', { name: 'Modifier prise en charge' })).toBeVisible();
  await page.locator('#minsurerid').getByRole('textbox').click();
  await page.getByRole('option', { name: 'Ascoma Assurance (ASSURANCE)' }).click();
  await page.locator('#mendingDate').fill('2026-05-10');
  await expect(page.getByRole('button', { name: 'Modifier' })).toBeVisible();
  await page.getByRole('button', { name: 'Modifier' }).click();
});