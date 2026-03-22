import { test, expect } from '@playwright/test';

test("Création d'un admin de structure d'un medecin et de son planinng", async ({ page }) => {
  await page.goto('https://rdv.pro-icare.com');
  await page.getByRole('textbox', { name: 'Nom d\'utilisateur' }).click();
  await page.getByRole('textbox', { name: 'Nom d\'utilisateur' }).fill('hi-nid@gmail.com');
  await page.getByRole('textbox', { name: 'Mot de passe' }).click();
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill('BcIsX7V&ZRh7');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.getByRole('link', { name: 'Utilisateurs' }).click();
  await page.getByRole('button', { name: 'Ajouter un admininistrateur' }).click();
  await page.getByRole('textbox', { name: 'Entrer le nom', exact: true }).click();
  await page.getByRole('textbox', { name: 'Entrer le nom', exact: true }).fill('AUTO');
  await page.getByRole('textbox', { name: 'Entrer le prenom' }).click();
  await page.getByRole('textbox', { name: 'Entrer le prenom' }).fill('ADMIN');
  await page.locator('div:nth-child(4) > .focus\\:border-\\[\\#ff8041\\] > .css-13cymwt-control > .css-hlgwow > .css-19bb58m').click();
  await page.getByRole('option', { name: 'Clinique Tests Auto' }).click();
  await page.getByRole('textbox', { name: 'Entrer le nom d\'utilisateur' }).click();
  await page.getByRole('textbox', { name: 'Entrer le nom d\'utilisateur' }).fill('auto.admin@yopmail.com');
  await page.getByRole('textbox', { name: 'Entrer le mot de passe' }).click();
  await page.getByRole('textbox', { name: 'Entrer le mot de passe' }).fill('Passer2026*2026');
  await page.getByRole('button', { name: 'Ajouter' }).click();
  await page.locator('td:nth-child(3)').first().click();
  await page.locator('body').press('Shift+ArrowRight');
  await page.getByRole('link', { name: 'Medecins' }).click();
  await page.getByRole('button', { name: 'Ajouter un nouveau docteur' }).click();
  await page.getByRole('textbox', { name: 'Entrer le nom', exact: true }).click();
  await page.getByRole('textbox', { name: 'Entrer le nom', exact: true }).fill('AUTO');
  await page.getByRole('textbox', { name: 'Entrer le prenom' }).click();
  await page.getByRole('textbox', { name: 'Entrer le prenom' }).fill('Medecin');
  await page.getByRole('textbox', { name: 'Entrer le temps' }).click();
  await page.getByRole('textbox', { name: 'Entrer le temps' }).fill('30');
  await page.locator('div:nth-child(5) > div:nth-child(2) > .focus\\:border-\\[\\#ff8041\\] > .css-13cymwt-control > .css-hlgwow > .css-19bb58m').click();
  await page.getByRole('option', { name: 'Pédiatrie' }).click();
  await page.locator('div:nth-child(6) > .focus\\:border-\\[\\#ff8041\\] > .css-13cymwt-control > .css-hlgwow > .css-19bb58m').click();
  await page.getByRole('option', { name: 'Clinique Tests Auto' }).click();
  await page.getByRole('textbox', { name: 'Entrer le nom d\'utilisateur' }).click();
  await page.getByRole('textbox', { name: 'Entrer le nom d\'utilisateur' }).fill('auto.medecin@yopmail.com');
  await page.getByRole('textbox', { name: 'Entrer le mot de passe' }).click();
  await page.getByRole('textbox', { name: 'Entrer le mot de passe' }).fill('Passer2026*2026');
  await page.getByRole('button', { name: 'Ajouter' }).click();
  await page.locator('#color').fill('#d77e7e');
  await page.getByRole('button', { name: 'Ajouter' }).click();
  await page.getByRole('button', { name: 'userProfile' }).click();
  await page.getByRole('link', { name: 'Déconnexion' }).click();
  await page.getByRole('textbox', { name: 'Nom d\'utilisateur' }).click();
  await page.getByRole('textbox', { name: 'Nom d\'utilisateur' }).fill('auto.admin@yopmail.com');
  await page.getByRole('textbox', { name: 'Nom d\'utilisateur' }).press('Tab');
  await page.getByRole('textbox', { name: 'Mot de passe' }).fill('Passer2026*2026');
  await page.getByRole('button').filter({ hasText: /^$/ }).click();
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.getByRole('link', { name: 'Plannings' }).click();
  await page.locator('.css-8mmkcg').click();
  await page.getByRole('option', { name: 'Medecin AUTO' }).click();
  await page.getByRole('button', { name: 'Modifier le créneau' }).click();

  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

  for (const day of days) {
    const dayBlock = page.locator('div.border').filter({ hasText: day });
    const pickers = dayBlock.locator('.react-timerange-picker');

    // ===== MATIN (Tranche 1) : 08:00 → 12:00 =====
    const t1 = pickers.nth(0);
    await t1.locator('input[name="hour24"]').nth(0).focus();
    await t1.locator('input[name="hour24"]').nth(0).fill('8');
    await t1.locator('input[name="minute"]').nth(0).focus();
    await t1.locator('input[name="minute"]').nth(0).fill('0');
    await t1.locator('input[name="hour24"]').nth(1).focus();
    await t1.locator('input[name="hour24"]').nth(1).fill('12');
    await t1.locator('input[name="minute"]').nth(1).focus();
    await t1.locator('input[name="minute"]').nth(1).fill('0');
  }

  await page.getByRole('button', { name: 'Appliquer' }).click();
  await page.getByRole('button', { name: 'Oui' }).click();
  await page.reload();
});